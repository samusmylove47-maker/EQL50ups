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

  await page.getByRole('link', { name: /EQL/ }).first().click();
  await expect(page).toHaveURL(/#\/$/);
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
