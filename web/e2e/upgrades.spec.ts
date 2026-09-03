/**
 * The upgrades list, in a real browser, against the real shipped catalog.
 *
 * The unit suites prove the ranking obeys its rules. This proves the screen a
 * player actually meets: that the nav reaches it, that twenty-three slot
 * rankings finish and paint, that a row says where its item comes from, that
 * Equip changes the set the row was ranked against, and that none of it scrolls
 * the page sideways on a phone.
 */

import {
  createCharacter,
  expect,
  expectCleanText,
  expectNoHorizontalScroll,
  test,
  watchReactWarnings,
} from './helpers';

/** Wait for the sliced ranking to finish, whichever way it lands. */
async function settle(page: import('@playwright/test').Page): Promise<void> {
  await page.locator('.upg-list, .empty-state').first().waitFor();
  await page.waitForTimeout(300);
}

test('the primary nav reaches it, and it ranks the set it lands on', async ({ page }) => {
  const warnings = watchReactWarnings(page);
  await createCharacter(page, { name: 'Avenrae', classes: [0, 1, 2] });

  await page.getByRole('link', { name: 'Upgrades', exact: true }).click();
  await expect(page).toHaveURL(/#\/set\/[^/]+\/upgrades$/);
  await expect(page.getByRole('link', { name: 'Upgrades', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await settle(page);

  await expect(page.locator('h1')).toContainText(/upgrades/i);
  const rows = page.locator('.upg-row');
  await expect(rows.first()).toBeVisible();
  expect(await rows.count()).toBeGreaterThan(5);

  // Biggest gain first, and every gain is a real signed number.
  const gains = (await page.locator('.upg-gainvalue').allInnerTexts()).map((t) =>
    Number(t.replace('+', '')),
  );
  for (const gain of gains) expect(Number.isFinite(gain) && gain > 0).toBe(true);
  for (let i = 1; i < gains.length; i++) {
    expect(gains[i - 1]).toBeGreaterThanOrEqual(gains[i] as number);
  }

  await expectCleanText(page);
  expect(warnings, 'React warnings').toEqual([]);
});

test('a row says what it is worth and where it comes from', async ({ page }) => {
  await createCharacter(page, { name: 'Avenrae', classes: [0, 1, 2] });
  await page.goto('/#/upgrades');
  await settle(page);

  const first = page.locator('.upg-row').first();
  await expect(first.locator('.upg-slot')).not.toBeEmpty();
  await expect(first.locator('.upg-name')).not.toBeEmpty();
  await expect(first.locator('.upg-gainvalue')).toContainText('+');

  // Acquisition data, or an honest admission that the catalog carries none.
  const source = await first.locator('.upg-source').innerText();
  expect(source.length).toBeGreaterThan(0);
  // The eyebrows are uppercased by CSS, so `innerText` reads them shouting.
  expect(
    /zone|drops from|quest|vendor|crafted|no acquisition data/i.test(source),
    `source block read: ${source}`,
  ).toBe(true);

  // The tier being compared at is stated on both sides of the row.
  await expect(first.locator('.tier-chip').first()).toContainText('+');
});

test('Equip applies the row and the list re-ranks without it', async ({ page }) => {
  const hash = await createCharacter(page, { name: 'Avenrae', classes: [0, 1, 2] });
  await page.goto('/#/upgrades');
  await settle(page);

  const first = page.locator('.upg-row').first();
  const item = (await first.locator('.upg-name').innerText()).trim();
  const slot = (await first.locator('.upg-slot').innerText()).trim();
  await first.getByRole('button', { name: /^Equip/ }).click();

  // `.upg .notice` rather than any `[role=status]`: the progress line and the
  // data banner are both live regions too, and which one answers first is a
  // race.
  await expect(page.locator('.upg .notice')).toContainText(item);
  await settle(page);
  // The row it just applied is gone: the set it was measured against changed.
  await expect(page.locator('.upg-row').first().locator('.upg-name')).not.toHaveText(item);

  // And the set really holds it.
  await page.goto(`/${hash}`);
  await expect(page.locator('.doll')).toContainText(item);
  await expect(page.locator('.doll')).toContainText(new RegExp(slot, 'i'));
});

test('opening a row shows the item window without leaving the page', async ({ page }) => {
  await createCharacter(page, { name: 'Avenrae', classes: [0, 1, 2] });
  await page.goto('/#/upgrades');
  await settle(page);

  const item = (await page.locator('.upg-row').first().locator('.upg-name').innerText()).trim();
  await page.locator('.upg-row').first().getByRole('button', { name: /^Open/ }).click();
  await expect(page.locator('.modal .iwin')).toContainText(item);
  await expect(page).toHaveURL(/upgrades$/);
  await page.keyboard.press('Escape');
  await expect(page.locator('.modal')).toHaveCount(0);
});

test('it holds up at every width, and explains itself with no set', async ({ page }) => {
  await createCharacter(page, { name: 'Avenrae', classes: [0, 1, 2] });
  await page.goto('/#/upgrades');
  await settle(page);
  await expectNoHorizontalScroll(page);
  await expectCleanText(page);

  // The nav gained a fourth item with this screen; on the narrowest phone it
  // wraps rather than printing its labels over each other.
  //
  // `.topbar nav a` until the chrome became eqlsource.com's. The app's own nav
  // is `.tool-nav` now, on the breadcrumb rail below the site masthead — see
  // `components/SiteChrome`. Same assertion, same defect it guards against,
  // new selector; the site nav above it is checked the same way.
  await page.setViewportSize({ width: 320, height: 900 });
  await page.waitForTimeout(200);
  const clipped = await page.evaluate(() =>
    [...document.querySelectorAll('.tool-nav a, .site-nav a')].some(
      (a) => a.scrollWidth > a.clientWidth + 1,
    ),
  );
  expect(clipped, 'a nav label narrower than its own text').toBe(false);
});

test('with no character at all it says so rather than ranking nothing', async ({ page }) => {
  await page.goto('/#/upgrades');
  await expect(page.locator('h2')).toContainText(/no set to rank/i);
  await expectCleanText(page);
  await expectNoHorizontalScroll(page);
});

/*
 * The source-standing band has to be findable.
 *
 * `.iwin` quotes the game client, whose first row is a red title bar. The band
 * was a 2px brick rule laid straight on that gradient and measured as one band
 * with it — at 4x you could not find the join, so the device carried no
 * information on the one surface it shipped on. It now sits on the top edge of
 * the content, against the window's stone.
 */
test('the source-standing band is visible against what sits above it', async ({ page }) => {
  await createCharacter(page, { name: 'Avenrae', classes: [0, 1, 2] });
  await page.goto('/#/upgrades');
  await settle(page);
  await page.locator('.upg-row').first().getByRole('button', { name: /^Open/ }).click();

  const win = page.locator('.modal .iwin');
  await expect(win).toBeVisible();

  const seen = await win.evaluate((el) => {
    const parse = (c: string) => (c.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
    const body = el.querySelector('.iwin-body') as HTMLElement | null;
    if (!body) return null;
    const band = getComputedStyle(body);
    // What the band is drawn against: the window's own stone, one pixel below.
    const ground = getComputedStyle(el).backgroundColor;
    const [r1, g1, b1] = parse(band.borderTopColor);
    const [r2, g2, b2] = parse(ground);
    return {
      standing: el.getAttribute('data-standing'),
      width: parseFloat(band.borderTopWidth),
      distance: Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2),
      titleIsGradient: getComputedStyle(
        el.querySelector('.iwin-title') as HTMLElement,
      ).backgroundImage.includes('gradient'),
    };
  });

  expect(seen).not.toBeNull();
  expect(seen!.standing).toBeTruthy();
  expect(seen!.width).toBeGreaterThanOrEqual(2);
  // The title bar is still the client's red gradient — the band simply is not
  // sitting on it any more.
  expect(seen!.titleIsGradient).toBe(true);
  // Comfortably separable from the ground it now sits on.
  expect(seen!.distance).toBeGreaterThan(60);
});

/**
 * The screen may never say more items are unmeasured than actually are.
 *
 * `catalog.status === 'ready'` is set on `items-index.json` alone, and the index
 * carries no `src` and no `ms` — acquisition lives in the 19 per-slot shards
 * fetched afterwards. So the ranking paints 23 rows while those are in flight,
 * and every one of them rendered the absence branch: "No acquisition data is
 * recorded for this item, and nobody has measured it dropping. That is a gap in
 * our data, not a statement that it cannot be obtained."
 *
 * Measured on a local preview with the payload warm, sampling every 100ms from
 * navigation: 23 rows said it at 100ms where the true count is 1. A first-time
 * visitor over the network fetches 693KB of index against 1.6MB of shards, so
 * their window is longer — and what they are shown in it is a confident,
 * considered-sounding false statement rather than a loading state. This is the
 * first screen a new reader reaches after making a character.
 *
 * Fixing it once was not enough: reading the LIVE shard flags merely moved the
 * window, because the ranking is computed from a snapshot and there is a gap
 * between the shards landing and the re-ranked report arriving. The flag is now
 * captured beside the report it describes.
 *
 * The assertion is a relation, not a number: whatever the true count of
 * unmeasured items turns out to be, the claim may never be made about more rows
 * than that. It cannot go stale when the catalogue changes.
 */
test('never claims more items are unmeasured than the settled page shows', async ({ page }) => {
  test.slow();
  const NOBODY = /nobody has measured it dropping/g;
  const countClaims = () =>
    page.evaluate(() => (document.body.innerText.match(/nobody has measured it dropping/g) ?? []).length);

  const hash = await createCharacter(page, { name: 'Cold Load' });
  await page.goto(`/${hash.replace(/\/[a-z]*$/, '')}/upgrades`);

  const during: number[] = [];
  for (let i = 0; i < 25; i++) {
    during.push(await countClaims());
    await page.waitForTimeout(100);
  }

  await expect(page.locator('.upg-list > li').first()).toBeVisible();
  await page.waitForTimeout(1500);
  const settled = await countClaims();

  const worst = Math.max(...during);
  expect(
    worst,
    `claimed "nobody has measured it dropping" on ${worst} rows mid-load,`
    + ` but only ${settled} are actually unmeasured (samples: ${during.join(',')})`,
  ).toBeLessThanOrEqual(settled);
  // And the sentence must really be reachable, or this passes vacuously.
  expect(NOBODY.test(await page.evaluate(() => document.body.innerText))).toBe(true);
});

/*
 * The zone rows must not print one column over the next.
 *
 * Found by photographing this screen for the site's tool page, not by a test.
 * `.upg-zoneseen` carried `white-space: nowrap` inside a 140px grid track, and
 * its longest form — `16 sightings · 6 unplaced` — is wider than that. The text
 * left its cell rather than wrapping and overprinted the column beside it, so
 * the flagship screen read `6 unplacedPARTIAL SURVEY`.
 *
 * TWO THINGS THIS TEST HAD TO GET RIGHT, AND GOT WRONG FIRST.
 *
 * It is asserted **geometrically**, not by reading text. A string check passes
 * on any wording that still collides, which is how every existing guard on this
 * screen missed it: they all read content, and none could see two boxes
 * occupying the same pixels.
 *
 * And the fixture must actually produce the long form. The first version used a
 * bare character and passed with the bug deliberately reinstated — the rows it
 * rendered were short enough to fit either way, so it asserted nothing. The
 * `unplaced` clause only appears when a sighting spans more than one zone, so
 * the test now refuses to pass unless it found one.
 */
test('no zone row prints one column over the next', async ({ page }) => {
  await createCharacter(page, { name: 'Ashvane', classes: [15, 0, 7], level: '50' });
  await page.getByRole('button', { name: /Auto-fill/i }).click();
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            Object.keys(
              JSON.parse(localStorage.getItem('eqlups.state.v1') ?? '{}').sets?.[0]?.slots ?? {},
            ).length,
        ),
      { timeout: 60_000 },
    )
    .toBeGreaterThan(15);

  // Clear positions so the ranking has candidates, which is what puts measured
  // drop zones on the page at all.
  await page.evaluate(() => {
    const key = 'eqlups.state.v1';
    const lib = JSON.parse(localStorage.getItem(key) ?? '{}');
    for (const set of lib.sets ?? []) {
      for (const p of ['HEAD', 'CHEST', 'LEGS', 'FEET', 'HANDS', 'ARMS', 'WRIST_1', 'NECK', 'BACK']) {
        delete set.slots[p];
      }
    }
    localStorage.setItem(key, JSON.stringify(lib));
  });
  await page.goto('/#/upgrades');
  await page.reload();
  await settle(page);

  const zones = page.locator('.upg-zone');
  await expect(zones.first()).toBeVisible({ timeout: 20_000 });

  /*
   * The guard on the guard. Without this the whole test passes on a page whose
   * rows are too short to collide — which it did, against the bug reinstated on
   * purpose.
   */
  await expect(page.locator('.upg-zoneunplaced').first()).toBeVisible();

  /*
   * Measured as CONTENT OVERFLOWING ITS OWN BOX, not as two boxes intersecting.
   *
   * The second version of this test compared `getBoundingClientRect()` between
   * neighbouring cells and passed with the bug reinstated, because the grid cell
   * never moves: it stays 140px wide and it is the *text* that paints outside
   * it. Element boxes cannot overlap in a grid row, so there was nothing there
   * to find. `scrollWidth > clientWidth` is the thing that is actually true when
   * a `nowrap` run is too wide for its track.
   */
  const overflowing = await zones.evaluateAll((rows) =>
    rows.flatMap((row) =>
      [...row.children]
        .filter((c) => (c as HTMLElement).scrollWidth > (c as HTMLElement).clientWidth + 1)
        .map(
          (c) =>
            `"${(c as HTMLElement).innerText.trim()}" needs ${(c as HTMLElement).scrollWidth}px ` +
            `in a ${(c as HTMLElement).clientWidth}px cell`,
        ),
    ),
  );

  expect(overflowing).toEqual([]);
});
