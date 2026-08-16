/** What the planner does when the item data will not load at all. */

import { createCharacter, expect, expectCleanText, test } from './helpers';

/** Console noise from the deliberately broken requests is the point, not a defect. */
const FETCH_NOISE = /Failed to load resource|500|net::ERR/i;

test('a failed catalog fetch is reported, and the planner still works', async ({ page, errors }) => {
  await page.route('**/data/**', (route) => route.fulfill({ status: 500, body: 'boom' }));
  await page.goto('/#/items');
  await expect(page.locator('.notice')).toContainText(/failed to load/i);
  await expect(page.getByRole('button', { name: /load fixture items/i })).toBeVisible();
  await expectCleanText(page);

  // A character can still be made, and the picker says why it is empty.
  await createCharacter(page, { name: 'Offline' });
  await expect(page.getByRole('button', { name: /auto-fill/i })).toBeDisabled();
  await page.locator('.slot-wrap button.slot').first().click();
  await expect(page.locator('.results .empty-state')).toContainText(/no catalog data/i);
  await expectCleanText(page);

  errors.splice(0, errors.length, ...errors.filter((line) => !FETCH_NOISE.test(line)));
});

test('an aborted catalog fetch behaves the same way', async ({ page, errors }) => {
  await page.route('**/data/**', (route) => route.abort('failed'));
  await page.goto('/#/');
  await expect(page.locator('.notice')).toContainText(/failed to load/i);
  await expectCleanText(page);

  // The fixture fallback keeps the app demonstrable.
  await page.getByRole('button', { name: /load fixture items/i }).click();
  await page.goto('/#/items');
  await expect(page.locator('table.data tbody tr').first()).toBeVisible();
  await expectCleanText(page);

  errors.splice(0, errors.length, ...errors.filter((line) => !FETCH_NOISE.test(line)));
});

test('an SPA fallback that answers with HTML is read as "no data published"', async ({ page }) => {
  await page.route('**/data/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><h1>index' }),
  );
  await page.goto('/#/');
  await expect(page.locator('.notice')).toContainText(/no item catalog published/i);
  await expectCleanText(page);
});
