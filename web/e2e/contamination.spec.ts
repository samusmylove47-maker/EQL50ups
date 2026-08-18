/**
 * The contamination page in a real browser.
 *
 * jsdom already asserts what the page *says* — that it names its own worst
 * finding, quotes our own source lines, and prints a mark rule beside every
 * count. What only a browser can check is what the page *is*: two very wide
 * tables of prose and quoted code, on a screen that must not scroll sideways at
 * 320px, with the good-news and bad-news figures actually landing on different
 * colours rather than both falling back to the same inherited one.
 *
 * The colour assertion is the reason this file exists. The whole page turns on
 * one distinction — a badged figure is fine, a bare one is the fault — and if
 * `--source-distrust` and `--source-trusted` resolve to the same computed value
 * that distinction is invisible to everyone who is not reading the numbers
 * carefully. The design doc's own note applies: a boundary that carries meaning
 * has to clear the bar, and one that does not is worse than no boundary at all.
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
  await page.goto('/#/contamination');
  await expect(page.locator('h1')).toContainText('What the scanner');
  await page.waitForTimeout(600);

  // The live half: these come out of contamination.json, and if the fetch
  // failed the page says so rather than printing a clean bill of health.
  await expect(page.locator('.cn')).toContainText('A hit is a question, not a verdict.');
  await expect(page.locator('.cn')).toContainText('haste-pct');
  await expect(page.locator('.cn')).not.toContainText('No scan was published');

  await expectCleanText(page);
  await expectNoHorizontalScroll(page);
  expect(warnings, 'React warnings').toEqual([]);
});

test('the unmarked column and the marked column are visibly different colours', async ({ page }) => {
  await page.goto('/#/contamination');
  await page.locator('.cn-table').first().waitFor();

  const colourOf = async (tone: string) =>
    page.locator(`.cn-num[data-tone="${tone}"]`).first().evaluate((n) => getComputedStyle(n).color);

  const bad = await colourOf('bad');
  const ok = await colourOf('ok');
  expect(bad).not.toBe(ok);

  // The score strip carries the same distinction at figure size, and it is the
  // first thing on the page, so it has to hold there too.
  const strip = await page
    .locator('.cn-score-cell[data-tone="bad"] b')
    .first()
    .evaluate((n) => getComputedStyle(n).color);
  expect(strip).toBe(bad);
});

test('the wide tables scroll inside themselves, not the page', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/#/contamination');
  await page.locator('.cn-scroll').first().waitFor();

  const overflows = await page.locator('.cn-scroll').first().evaluate((node) => ({
    inner: node.scrollWidth > node.clientWidth,
    overflow: getComputedStyle(node).overflowX,
  }));
  expect(overflows.overflow).toBe('auto');
  expect(overflows.inner, 'the table is wider than a phone, which is expected').toBe(true);

  await expectNoHorizontalScroll(page);
});

test('the footer reaches it from anywhere in the app', async ({ page }) => {
  await page.goto('/#/items');
  /*
   * Wait for the footer itself before reaching for the link. The item browser
   * fetches every slot shard on arrival and the footer moves down the document
   * as they land, so clicking the instant the link exists can click where it
   * used to be. This failed once that way before the wait was added.
   */
  const link = page.getByRole('contentinfo').getByRole('link', {
    name: /what the scanner finds here/i,
  });
  await link.waitFor({ state: 'visible' });
  await page.waitForLoadState('networkidle');
  await link.click();
  await expect(page).toHaveURL(/#\/contamination$/);
  await expect(page.locator('h1')).toContainText('What the scanner');
});
