/**
 * The set-vs-set diff and the per-set JSON file.
 *
 * Both were declared in DESIGN.md and never built, so these drive the whole
 * path a user takes: reach the diff from the two places it is offered, read the
 * centre column, and take a set out to a file and back in again.
 */

import { readFileSync } from 'node:fs';
import {
  createCharacter,
  expect,
  expectCleanText,
  expectNoHorizontalScroll,
  test,
} from './helpers';

/** A character with two sets, the second differing from the first. */
async function twoSets(page: import('@playwright/test').Page): Promise<[string, string]> {
  const hash = await createCharacter(page, { name: 'Differ', classes: [0, 7, 15] });
  const first = hash.replace('#/set/', '');

  await page.getByRole('button', { name: /auto-fill/i }).click();
  await expect(page.locator('.notice')).toContainText(/auto-fill placed/i, { timeout: 30_000 });

  await page.locator('summary[aria-label="More set actions"]').click();
  await page.locator('.menu-body.right .menu-item', { hasText: 'Duplicate set' }).click();
  await expect(page.locator('.set-switch .name')).toHaveText('Main Set (copy)');
  const second = new URL(page.url()).hash.replace('#/set/', '');

  // Change one slot so the diff has something to say.
  await page.locator('.slot-wrap button.slot').nth(1).click();
  await page.locator('.modal').waitFor();
  await page.locator('.results .result').nth(3).click();
  await expect(page.locator('.modal')).toHaveCount(0);
  return [first, second];
}

test('the diff is reachable from the overflow menu and from the switcher', async ({ page }) => {
  const [first, second] = await twoSets(page);

  await page.goto(`/#/set/${first}`);
  await page.locator('summary[aria-label="More set actions"]').click();
  await page.locator('.menu-body.right .menu-item', { hasText: 'Compare with…' }).click();
  await expect(page).toHaveURL(new RegExp(`#/set/${first}/compare/${second}$`));
  await expect(page.locator('.page-title')).toHaveText(/compare sets/i);

  await page.goto(`/#/set/${second}`);
  await page.locator('.set-switch').click();
  await page.locator('.setmenu-compare').first().click();
  await expect(page).toHaveURL(/\/compare\//);
  await expectCleanText(page);
});

test('the centre column names what changed, and what a gain is worth against the cap', async ({
  page,
}) => {
  const [first, second] = await twoSets(page);
  await page.goto(`/#/set/${first}/compare/${second}`);
  await expect(page.locator('.cmp-slots')).toBeVisible();

  // One row per position, whether or not anything is in it.
  await expect(page.locator('.cmp-slot')).toHaveCount(23);
  await expect(page.locator('.cmp-slot .cmp-status', { hasText: 'Swapped' })).toHaveCount(1);
  await expect(page.locator('.cmp-slot.quiet')).toHaveCount(22);

  // The KPI strip carries the diff's own idea: creditable, not raw.
  const kpis = page.locator('.cmp-kpi');
  await expect(kpis).toHaveCount(4);
  await expect(kpis.filter({ hasText: 'Creditable stat gain' })).toContainText(/raw/);
  await expect(kpis.filter({ hasText: 'Equivalency points' })).toContainText(/→/);

  // Both ceilings are stated on the groups that have them.
  await expect(page.locator('.cmp-group', { hasText: 'Stats' }).first()).toContainText(
    /ceiling 510/,
  );
  await expect(page.locator('.cmp-group', { hasText: 'Resists' }).first()).toContainText(
    /ceiling 1,?000/,
  );

  // Swap sides inverts the comparison.
  await page.getByRole('link', { name: /swap sides/i }).click();
  await expect(page).toHaveURL(new RegExp(`#/set/${second}/compare/${first}$`));

  await expectCleanText(page);
  await expectNoHorizontalScroll(page, [1600, 1280, 1024, 768, 390]);
});

test('every awkward pairing has an answer', async ({ page }) => {
  const [first, second] = await twoSets(page);

  // A set against itself.
  await page.goto(`/#/set/${first}/compare/${first}`);
  await expect(page.locator('.cmp-banner').first()).toContainText(/same set on both sides/i);
  await expectCleanText(page);

  // A second id that is not in the library.
  await page.goto(`/#/set/${first}/compare/set_does_not_exist`);
  await expect(page.locator('.notice')).toContainText(/no longer in this library/i);
  await expect(page.locator('.cmp-choice')).toHaveCount(1);
  await expectCleanText(page);

  // No second id at all: the chooser.
  await page.goto(`/#/set/${first}/compare`);
  await expect(page.locator('.page-title')).toContainText(/compare "main set" with/i);
  await page.locator('.cmp-choice').first().click();
  await expect(page).toHaveURL(new RegExp(`#/set/${first}/compare/${second}$`));

  // A first id that is not in the library.
  await page.goto('/#/set/set_gone/compare/set_also_gone');
  await expect(page.locator('.empty-state h2')).toHaveText(/set not found/i);
  await expectCleanText(page);
});

test('sets belonging to different characters are compared, and said to be', async ({ page }) => {
  const [first] = await twoSets(page);
  const otherHash = await createCharacter(page, { name: 'Stranger', classes: [1] });
  const other = otherHash.replace('#/set/', '');

  await page.goto(`/#/set/${first}/compare/${other}`);
  await expect(page.locator('.cmp-banner').first()).toContainText(/different characters/i);
  await expect(page.locator('.cmp-banner').first()).toContainText('Stranger');
  await expect(page.locator('.cmp-slot .cmp-status', { hasText: 'Removed' }).first()).toBeVisible();
  await expectCleanText(page);
});

test('the diff page is keyboard reachable with a visible ring', async ({ page }) => {
  const [first, second] = await twoSets(page);
  await page.goto(`/#/set/${first}/compare/${second}`);
  await expect(page.locator('.cmp-slots')).toBeVisible();

  // Walk in from the top of the document and stop on the first control the
  // diff itself owns.
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    const inside = await page.evaluate(() =>
      Boolean(document.activeElement?.closest('.cmp')),
    );
    if (inside) break;
  }

  const focus = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return null;
    const style = getComputedStyle(el);
    return {
      inside: Boolean(el.closest('.cmp')),
      ring: `${style.boxShadow} ${style.outline}`,
      name: (el.getAttribute('aria-label') ?? el.textContent ?? '').trim(),
    };
  });
  expect(focus?.inside, 'tabbing reaches the diff').toBe(true);
  // `--accent`, which the eqlsource re-skin moved from azure to steel blue.
  expect(focus?.ring, `no visible focus on "${focus?.name}"`).toMatch(/rgb\(117, 149, 184\)/);
});

test('a set exports to JSON and imports back losslessly', async ({ page }) => {
  const [first] = await twoSets(page);
  await page.goto(`/#/set/${first}`);

  /*
   * Saves are debounced by 200 ms, so the baseline has to be read once the
   * write has actually landed — the same poll the imported side already does
   * below. Without it this reads whatever storage held *before* Auto-fill, and
   * the round trip is then compared against an empty slot map: the assertion
   * only held while the app happened to be slow enough for the timer to fire
   * first.
   */
  await expect
    .poll(() =>
      page.evaluate((id) => {
        const set = JSON.parse(localStorage.getItem('eqlups.state.v1') ?? '{}').sets?.find(
          (s: { id: string }) => s.id === id,
        );
        return Object.keys(set?.slots ?? {}).length;
      }, first),
    )
    .toBeGreaterThan(0);

  const before = await page.evaluate((id) => {
    const set = JSON.parse(localStorage.getItem('eqlups.state.v1') ?? '{}').sets.find(
      (s: { id: string }) => s.id === id,
    );
    return { name: set.name, slots: set.slots, weights: set.weights };
  }, first);

  const download = page.waitForEvent('download');
  await page.locator('summary[aria-label="More set actions"]').click();
  await page.locator('.menu-body.right .menu-item', { hasText: 'Export this set' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('eql-set-main-set.json');
  const path = await file.path();

  /*
   * A whole new library, as if the file had crossed browsers. Clearing storage
   * from the live page is not enough: the app flushes its in-memory library on
   * `beforeunload`, so the reload would write it straight back. Clearing from an
   * init script runs after that flush and before the app hydrates.
   */
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/#/characters');
  await page.reload();
  await expect(page.locator('.empty-state h2')).toHaveText(/no characters yet/i);

  await page.locator('input[type=file]').setInputFiles(path);
  await expect(page.locator('.notice')).toContainText(/imported 1 character and 1 set/i);

  // Saves are debounced, so read the store once it has actually been written.
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem('eqlups.state.v1') ?? '{}').sets?.length ?? 0,
      ),
    )
    .toBe(1);
  const after = await page.evaluate(() => {
    const set = JSON.parse(localStorage.getItem('eqlups.state.v1') ?? '{}').sets[0];
    return { name: set.name, slots: set.slots, weights: set.weights };
  });
  expect(after.name).toBe(before.name);
  expect(after.weights).toEqual(before.weights);
  expect(after.slots).toEqual(before.slots);
  await expectCleanText(page);
});

test('a damaged file imports its good half and names what it dropped', async ({ page }) => {
  const [first] = await twoSets(page);
  await page.goto(`/#/set/${first}`);

  const download = page.waitForEvent('download');
  await page.locator('summary[aria-label="More set actions"]').click();
  await page.locator('.menu-body.right .menu-item', { hasText: 'Export this set' }).click();
  const path = await (await download).path();
  const original = JSON.parse(readFileSync(path, 'utf8'));

  original.sets[0].slots.HAT = { itemName: 'Nowhere' };
  original.sets[0].slots.CHEST = { itemName: 'Overcooked', upgrade: { full: 999, fraction: 0 } };
  original.sets[0].weights.AC = 'two';
  original.sets.push({ id: 'orphan', characterId: 'nobody', name: 'Orphan', slots: {}, weights: {} });

  await page.goto('/#/characters');
  await page.locator('input[type=file]').setInputFiles({
    name: 'damaged.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(original)),
  });

  const notice = page.locator('.notice');
  await expect(notice).toContainText(/could not be used/i);
  await expect(notice).toContainText(/unknown slot "HAT"/);
  await expect(notice).toContainText(/clamped to \+10/);
  await expect(notice).toContainText(/weight AC was not a finite number/);
  await expect(notice).toContainText(/Orphan.*no matching character/);
  await expectCleanText(page);
});
