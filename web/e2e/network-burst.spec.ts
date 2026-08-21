/**
 * The planner under a bad network, which is the one it is about to get.
 *
 * `data-failure.spec.ts` covers the network failing *completely* — every request
 * 500s, or aborts, or comes back as the SPA fallback. Those are the easy cases:
 * nothing arrived, and the app knows it.
 *
 * The cases here are partial and ordered, and that is where the bugs live. The
 * catalog is one ~2 MB index plus nineteen ~60 KB shards, so on a real
 * connection they land in an order nobody chose, some may not land at all, and
 * the app has to be right for every interleaving rather than for the one that
 * happens on localhost. The store-level version of this question found a live
 * defect on 2026-08-20 — `src/data/load-race.test.ts` — and this asks it of the
 * browser instead.
 *
 * Every test asserts **zero page errors**, because the failure mode that matters
 * is not a wrong number. It is a screen that renders nothing at all while the
 * console holds the reason.
 */

import { createCharacter, expect, pickerMatchCount, test } from './helpers';

/**
 * Remove the console noise a deliberate 404 produces, and prove it was there.
 *
 * The `errors` fixture fails a test on any console error, which is right — but a
 * test that breaks a request on purpose will produce one. Splicing it out blind
 * is how a real error gets hidden next to an expected one, so this asserts the
 * expected line was actually present before removing it, and leaves everything
 * else in place for the fixture to fail on.
 */
function expectOnlyNoise(errors: string[], noise: RegExp): void {
  const matched = errors.filter((line) => noise.test(line));
  expect(matched.length, `no ${noise} in the console — the request was not broken`)
    .toBeGreaterThan(0);
  errors.splice(0, errors.length, ...errors.filter((line) => !noise.test(line)));
}

/** The browser's own log line for the shard this suite 404s on purpose. */
const SHARD_404 = /Failed to load resource.*404/i;

/** Hold a route open until released — a slow response, not a failed one. */
function deferred(): { promise: Promise<void>; release: () => void } {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

test('one shard that 404s does not take the catalog with it', async ({ page, errors }) => {
  /*
   * `loadShard` turns a failed fetch into an empty shard rather than a throw,
   * and the index carries every item's name regardless of shards — so a missing
   * shard costs acquisition detail for one slot and nothing else. This is the
   * browser-level proof of that, and of the part that would be easy to get
   * wrong: no failure notice, because the catalog did not fail.
   */
  await page.route('**/data/items/HEAD.json', (route) => route.fulfill({ status: 404, body: '' }));

  await page.goto('/#/items');
  await page.locator('table.data tbody tr').first().waitFor({ timeout: 30_000 });

  expect(
    await page.locator('table.data tbody tr').count(),
    'the browser still lists items with one shard missing',
  ).toBeGreaterThan(0);
  await expect(
    page.locator('.notice-warn'),
    'a missing shard is not a missing catalog and must not say it is',
  ).toHaveCount(0);
  expectOnlyNoise(errors, SHARD_404);
});

test('a slot whose shard 404s still opens its own picker', async ({ page, errors }) => {
  await page.route('**/data/items/HEAD.json', (route) => route.fulfill({ status: 404, body: '' }));

  await createCharacter(page, { name: 'Avenrae', classes: [0, 1, 15], level: '50' });
  await page.locator('.slot-wrap button.slot[aria-label^="Head"]').first().click();
  await page.locator('.modal').waitFor();
  await page.locator('.results .result, .results .empty-state').first().waitFor();

  // A list, not a crash: the shard is where acquisition detail lives, not where
  // the items themselves live.
  await expect(page.locator('.modal-head h2')).toContainText(/head/i);
  expect(await pickerMatchCount(page), 'Head still has candidates').toBeGreaterThan(0);
  expectOnlyNoise(errors, SHARD_404);
});

test('the index arriving last does not throw away what a shard brought', async ({
  page,
  errors,
}) => {
  /*
   * The race that produced the real defect: the 2 MB index is still in flight
   * when a 60 KB shard lands and commits. The index is *held* rather than merely
   * slowed, so the ordering is decided by this test and not by the runner's
   * mood — a timing-dependent test of a timing bug proves nothing.
   *
   * **What is asserted matters more than the ordering.** The first version of
   * this test checked that the catalog was *populated* after the index landed,
   * which it always is — the index is where the names come from. Reinstating the
   * regression it was written for left it green. `src` is the thing the index
   * has and the shard does not, so the observable is the picker's own source
   * filter: if the index overwrote the shard, `Drops` matches nothing.
   */
  const held = deferred();
  await page.route('**/data/items-index.json', async (route) => {
    await held.promise;
    await route.continue();
  });

  await createCharacter(page, { name: 'Avenrae', classes: [0, 1, 15], level: '50' });

  // While the index is outstanding the app must say it is working — and this is
  // also what proves the hold took effect, rather than the test racing an index
  // that had already landed.
  await expect(page.locator('.notice[role="status"]')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.notice-warn')).toHaveCount(0);

  // The 60 KB shard wins, and it is the half carrying acquisition detail.
  await page.locator('.slot-wrap button.slot[aria-label^="Primary"]').first().click();
  await page.locator('.modal').waitFor();
  await page.locator('.results .result, .results .empty-state').first().waitFor();

  held.release();
  await expect(page.locator('.notice[role="status"]')).toBeHidden({ timeout: 30_000 });

  const all = await pickerMatchCount(page);
  expect(all, 'the picker has candidates once both have landed').toBeGreaterThan(0);

  await page.locator('.modal select[aria-label="Filter by source"]').selectOption('drop');
  await page.waitForTimeout(300);
  expect(
    await pickerMatchCount(page),
    'no candidate has a drop source — the index overwrote what the shard brought',
  ).toBeGreaterThan(0);

  expect(errors).toEqual([]);
});

test('a slow catalog reads as loading, never as broken or empty', async ({ page, errors }) => {
  /*
   * Three seconds is past the point where a reader decides a page is broken, and
   * comfortably inside what a phone on a train produces. The banner is the whole
   * point: an empty table with no explanation is the defect under test, and it
   * is the shape a first-time visitor arriving from the site would meet.
   */
  await page.route('**/data/**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 3_000));
    await route.continue();
  });

  await page.goto('/#/');
  const banner = page.locator('.notice[role="status"]');
  await expect(banner, 'a slow load must announce itself').toBeVisible({ timeout: 10_000 });
  await expect(
    page.locator('.notice-warn'),
    'slow is not failed, and must not be reported as failed',
  ).toHaveCount(0);

  await expect(banner, 'and it must clear once the data lands').toBeHidden({ timeout: 30_000 });
  expect(errors).toEqual([]);
});

test('nineteen shards at once list every candidate exactly once', async ({ page, errors }) => {
  /*
   * The Any Slot picker calls `ensureAll`, which fans out every remaining shard
   * and commits them as one state change. An item can ship in two shards at
   * once, so the merge has to de-duplicate within the batch as well as against
   * what is already loaded — `mergeItems` has a comment saying exactly that, and
   * until now nothing exercised it through the browser.
   */
  await createCharacter(page, { name: 'Avenrae', classes: [0, 1, 15], level: '50' });
  await page.locator('.slot-wrap button.slot[aria-label^="Any Slot 1"]').first().click();
  await page.locator('.modal').waitFor();
  await page.locator('.results .result, .results .empty-state').first().waitFor();

  const total = await pickerMatchCount(page);
  expect(total, 'the Any Slot picker listed candidates').toBeGreaterThan(0);

  // The list is windowed, so this reads what is rendered rather than the whole
  // pool — a duplicate anywhere in the merge shows up as one on screen.
  const rendered = (await page.locator('.results .result .result-name').allTextContents())
    .map((name) => name.trim())
    .filter(Boolean);
  expect(rendered.length, 'rows rendered').toBeGreaterThan(0);
  expect(
    new Set(rendered).size,
    'an item listed twice means the nineteen-shard merge did not de-duplicate',
  ).toBe(rendered.length);
  expect(errors).toEqual([]);
});
