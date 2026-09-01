/**
 * The Sources page in a real browser.
 *
 * It is the densest page in the app — six card grids, four tables and two
 * full-width cards — so the things worth asserting here are the ones jsdom
 * cannot see: that it holds together at 320px without scrolling the page
 * sideways, that the tier accent survives the cascade (the card declares its
 * own `border` shorthand, which is exactly how an accent rule gets silently
 * overwritten), and that a reader can actually get to it from the footer.
 */

import {
  expect,
  expectCleanText,
  expectNoHorizontalScroll,
  test,
  watchReactWarnings,
} from './helpers';

test('deep-links cleanly at every width', async ({ page }) => {
  const warnings = watchReactWarnings(page);
  await page.goto('/#/sources');
  await expect(page.locator('h1')).toContainText('Sources');
  await page.waitForTimeout(600);

  // The live half of the page: these numbers come out of meta.json, and if the
  // fetch failed the page says so instead of printing them.
  await expect(page.locator('.src')).toContainText('do not use as an authoritative filter');
  await expect(page.locator('.src')).toContainText('Earthshaker');

  await expectCleanText(page);
  await expectNoHorizontalScroll(page);
  expect(warnings, 'React warnings').toEqual([]);
});

test('the tier accent bar reaches the cards, and distrust is its own colour', async ({ page }) => {
  await page.goto('/#/sources');
  await page.locator('.src-card').first().waitFor();

  const read = async (standing: string) =>
    page.locator(`.src-card[data-standing="${standing}"]`).first().evaluate((node) => {
      const style = getComputedStyle(node);
      return { width: style.borderTopWidth, color: style.borderTopColor };
    });

  const trusted = await read('trusted');
  const distrust = await read('distrust');

  expect(trusted.width).toBe('2px');
  expect(distrust.width).toBe('2px');
  // Sage for the trusted tiers, brick for the one the standard says to
  // distrust. Same device as the item window, same three tokens.
  expect(distrust.color).not.toBe(trusted.color);
});

test('the footer reaches it from anywhere in the app', async ({ page }) => {
  await page.goto('/#/items');
  await page.getByRole('link', { name: /sources/i }).click();
  await expect(page).toHaveURL(/#\/sources$/);
  await expect(page.locator('h1')).toContainText('Sources');
});

test('the landing page cites the client capture rather than the wiki', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(400);
  const body = await page.evaluate(() => document.body.innerText);
  expect(body.toLowerCase()).not.toContain('wiki-verified');
  /*
   * This asserted the literal "nine of nine predictions exact" — a second typed
   * copy of a count that `TIER0-VALIDATION.md` holds and that
   * `prose-vs-record.test.ts` DERIVES from it. The record's table has seven
   * MATCH rows, the page was corrected to "seven of seven", and this copy went
   * stale in the same breath, exactly as a typed number does.
   *
   * So this stops carrying a number at all. What it checks is what only a
   * browser can: that the claim reaches a reader, self-consistent (N of the same
   * N), citing the client capture. Which N is right is the derived test's job,
   * and there is now one place that knows.
   */
  expect(body.toLowerCase()).toContain('read off a live client');
  expect(body.toLowerCase(), 'a self-consistent "N of N" claim, whatever N is')
    .toMatch(/\b(\w+) of \1 predictions exact\b/);
});
