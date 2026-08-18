/** Every route, deep-linked in a fresh session, must render cleanly. */

import {
  expect,
  expectCleanText,
  expectNoHorizontalScroll,
  test,
  watchReactWarnings,
} from './helpers';

const ROUTES: Array<[name: string, hash: string, heading: RegExp]> = [
  ['landing', '#/', /gear at speed/i],
  ['characters', '#/characters', /characters/i],
  ['new character', '#/character/new', /create character/i],
  ['items', '#/items', /items/i],
  ['unknown route', '#/nope/nope', /nothing here/i],
  ['missing set', '#/set/does-not-exist', /set not found/i],
  ['missing set tab', '#/set/does-not-exist/weights', /set not found/i],
  ['missing set bad tab', '#/set/does-not-exist/bogus', /set not found/i],
  ['share with no payload', '#/share/', /nothing here/i],
  ['share with junk payload', '#/share/!!!!!', /could not be read/i],
];

for (const [name, hash, heading] of ROUTES) {
  test(`${name} renders cleanly at every width`, async ({ page }) => {
    const warnings = watchReactWarnings(page);
    await page.goto(`/${hash}`);
    await expect(page.locator('h1, h2').first()).toContainText(heading);
    await page.waitForTimeout(600);
    await expectCleanText(page);
    await expectNoHorizontalScroll(page);
    expect(warnings, 'React warnings').toEqual([]);
  });
}

test('primary navigation reaches every screen and marks the current one', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Items', exact: true }).click();
  await expect(page).toHaveURL(/#\/items$/);
  await expect(page.getByRole('link', { name: 'Items', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );

  await page.getByRole('link', { name: 'Characters', exact: true }).click();
  await expect(page).toHaveURL(/#\/characters$/);

  await page.getByRole('link', { name: 'Home', exact: true }).click();
  await expect(page).toHaveURL(/#\/$/);

  /*
   * The wordmark used to read `EQL Upgrades` and go to `#/`, and this line
   * clicked it to check that it did. The chrome is eqlsource.com's now: the
   * wordmark and the first two breadcrumb segments are the way *out* of this
   * tool and into the site it is published on, and `Home` above is the way
   * back to the tool's own front page.
   *
   * The destinations are asserted rather than followed, because the site is a
   * real host and the test runner has no route to it — clicking would land on
   * `chrome-error://chromewebdata/`, which is a property of this container and
   * not of the app.
   */
  const mark = page.locator('.site-bar .mark');
  await expect(mark).toHaveAttribute('href', 'https://eqlsource.com/index.html');
  await expect(mark).toContainText('EQL Source');

  const crumb = page.locator('.crumb');
  await expect(crumb).toContainText('50 Upgrades');
  await expect(crumb.locator('a').first()).toHaveAttribute(
    'href',
    'https://eqlsource.com/index.html',
  );
  await expect(crumb.locator('a').nth(1)).toHaveAttribute(
    'href',
    'https://eqlsource.com/tools/index.html',
  );
});

test('back and forward walk the whole history', async ({ page }) => {
  await page.goto('/');
  await page.goto('/#/items');
  await page.goto('/#/characters');
  await page.goto('/#/character/new');

  await page.goBack();
  await expect(page).toHaveURL(/#\/characters$/);
  await page.goBack();
  await expect(page).toHaveURL(/#\/items$/);
  await page.goForward();
  await expect(page).toHaveURL(/#\/characters$/);
  await expectCleanText(page);
});
