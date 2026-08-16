/** The exaltation tab: derived sockets, donors, and the unlock ladder. */

import { createCharacter, expect, expectCleanText, openSlotPicker, test } from './helpers';

async function equipFirstEar(page: import('@playwright/test').Page) {
  await openSlotPicker(page, 0);
  await page.locator('.results .result').first().click();
  await expect(page.locator('.modal')).toHaveCount(0);
}

test('with nothing equipped the tab explains itself instead of rendering nothing', async ({
  page,
}) => {
  const hash = await createCharacter(page);
  await page.goto(`/${hash}/exaltations`);
  await expect(page.locator('.empty-state h2')).toHaveText(/nothing equipped yet/i);
  await expectCleanText(page);
});

test('sockets unlock with the tier and lock again when it drops', async ({ page }) => {
  const hash = await createCharacter(page);
  await equipFirstEar(page);
  await page.goto(`/${hash}/exaltations`);

  const sockets = page.locator('.exalt-item').first().locator('.socket');
  await expect(sockets).toHaveCount(5);
  await expect(sockets.nth(0)).toContainText(/cosmetic/i); // ornamentation, always there
  await expect(sockets.nth(1)).toContainText('Unlocks at +1');
  await expect(sockets.nth(4)).toContainText('Unlocks at +4');
  await expect(page.locator('.socket.locked')).toHaveCount(4);

  const plus = page.locator('.exalt-item').first().locator('.stepper button').last();
  for (let i = 0; i < 4; i++) await plus.click();
  await expect(page.locator('.socket.locked')).toHaveCount(0);
  await expect(page.locator('.exalt-item').first().getByRole('button', { name: 'Add' })).toHaveCount(
    4,
  );

  const minus = page.locator('.exalt-item').first().locator('.stepper button').first();
  for (let i = 0; i < 4; i++) await minus.click();
  await expect(page.locator('.socket.locked')).toHaveCount(4);
  await expectCleanText(page);
});

test('donors are offered on a fresh load, not only after a picker has been opened', async ({
  page,
}) => {
  // Regression: effects live in the per-slot shards, so on a cold load the
  // donor list was empty and claimed no eligible donors existed.
  const hash = await createCharacter(page);
  await equipFirstEar(page);
  await page.goto(`/${hash}/exaltations`);
  await page.locator('.exalt-item').first().locator('.stepper button').last().click();

  await page.goto('/#/characters'); // leave, then come back cold
  await page.reload();
  await page.goto(`/${hash}/exaltations`);

  await page.getByRole('button', { name: 'Add' }).first().click();
  await expect(page.locator('.modal')).toBeVisible();
  await expect(page.locator('.modal .results .result').first()).toBeVisible({ timeout: 30_000 });
  expect(await page.locator('.modal .results .result').count()).toBeGreaterThan(0);
});

test('a donor can be added, changed and removed', async ({ page }) => {
  const hash = await createCharacter(page);
  await equipFirstEar(page);
  await page.goto(`/${hash}/exaltations`);
  await page.locator('.exalt-item').first().locator('.stepper button').last().click();

  const focusSocket = page.locator('.exalt-item').first().locator('.socket').nth(1);
  await focusSocket.getByRole('button', { name: 'Add' }).click();
  await expect(page.locator('.modal .results .result').first()).toBeVisible({ timeout: 30_000 });

  const donors = page.locator('.modal .results .result');
  const chosen = await donors.first().locator('.result-name').innerText();
  await donors.first().click();
  await expect(focusSocket.locator('.donor')).toHaveText(chosen);

  await focusSocket.getByRole('button', { name: 'Change' }).click();
  await expect(page.locator('.modal .results .result').first()).toBeVisible({ timeout: 30_000 });
  const search = page.locator('.modal input[aria-label="Search exaltation donors"]');
  await expect(search).toBeFocused();
  await search.fill('zzzzzz');
  await expect(page.locator('.modal .empty-state h2')).toHaveText(/no eligible donors/i);
  await page.keyboard.press('Escape');
  await expect(focusSocket.locator('.donor')).toHaveText(chosen); // cancel kept it

  await focusSocket.getByRole('button', { name: /remove/i }).click();
  await expect(focusSocket.locator('.donor')).toHaveText('Empty');
  await expectCleanText(page);
});

test('a donor travels in the share link and the shared view cannot edit it', async ({ page }) => {
  const hash = await createCharacter(page, { name: 'Exalter' });
  await equipFirstEar(page);
  await page.goto(`/${hash}/exaltations`);
  await page.locator('.exalt-item').first().locator('.stepper button').last().click();
  const focusSocket = page.locator('.exalt-item').first().locator('.socket').nth(1);
  await focusSocket.getByRole('button', { name: 'Add' }).click();
  await expect(page.locator('.modal .results .result').first()).toBeVisible({ timeout: 30_000 });
  const chosen = await page.locator('.modal .results .result').first().locator('.result-name').innerText();
  await page.locator('.modal .results .result').first().click();

  await page.goto(`/${hash}`);
  await page.getByRole('button', { name: /share/i }).click();
  const link = await page.locator('.copy-field input').inputValue();
  await page.keyboard.press('Escape');

  await page.goto(link);
  await page.getByRole('tab', { name: 'Exaltations' }).click();
  const shared = page.locator('.exalt-item').first().locator('.socket').nth(1);
  await expect(shared.locator('.donor')).toHaveText(chosen);
  await expect(page.getByRole('button', { name: 'Add' })).toHaveCount(0);
  await expect(page.locator('.exalt-item').first().locator('.stepper button').last()).toBeDisabled();
});
