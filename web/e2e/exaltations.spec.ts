/** The exaltation tab: derived sockets, donors, and the effects they carry. */

import { createCharacter, expect, expectCleanText, openSlotPicker, test } from './helpers';

async function equipFirstEar(page: import('@playwright/test').Page) {
  await openSlotPicker(page, 0);
  await page.locator('.results .result').first().click();
  await expect(page.locator('.modal')).toHaveCount(0);
}

/** The first equipped item's row on the exaltations tab. */
function row(page: import('@playwright/test').Page) {
  return page.locator('.exalt-row').first();
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

  /*
   * At +0 the row states the tier that opens the first socket instead of
   * printing five rows of a rule the reader already knows. This is the whole
   * point of the rewrite: no locked rows, no `Cosmetic — no effect`, no
   * `Unlocks at +N` anywhere on the page.
   */
  await expect(row(page)).toContainText('first socket at +1');
  await expect(page.locator('.exalt-row .socket')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('Unlocks at');
  await expect(page.locator('body')).not.toContainText('Cosmetic');

  const plus = row(page).locator('.stepper button').last();
  for (let i = 0; i < 4; i++) await plus.click();
  await expect(row(page).locator('.socket')).toHaveCount(4);
  await expect(row(page).getByRole('button', { name: 'Add' })).toHaveCount(4);
  await expect(row(page)).toContainText('0/4 socketed');

  const minus = row(page).locator('.stepper button').first();
  for (let i = 0; i < 4; i++) await minus.click();
  await expect(row(page).locator('.socket')).toHaveCount(0);
  await expect(row(page)).toContainText('first socket at +1');
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
  await row(page).locator('.stepper button').last().click();

  await page.goto('/#/characters'); // leave, then come back cold
  await page.reload();
  await page.goto(`/${hash}/exaltations`);

  await page.getByRole('button', { name: 'Add' }).first().click();
  await expect(page.locator('.modal')).toBeVisible();
  await expect(page.locator('.modal .results .result').first()).toBeVisible({ timeout: 30_000 });
  expect(await page.locator('.modal .results .result').count()).toBeGreaterThan(0);
});

test('a donor can be added, changed and removed, and names the effect it carries', async ({
  page,
}) => {
  const hash = await createCharacter(page);
  await equipFirstEar(page);
  await page.goto(`/${hash}/exaltations`);
  await row(page).locator('.stepper button').last().click();

  const focusSocket = row(page).locator('.socket').first();
  await expect(focusSocket).toContainText('Focus Exaltation');
  await focusSocket.getByRole('button', { name: 'Add' }).click();
  await expect(page.locator('.modal .results .result').first()).toBeVisible({ timeout: 30_000 });

  const donors = page.locator('.modal .results .result');
  const chosen = await donors.first().locator('.result-name').innerText();
  const effect = await donors.first().locator('.result-line').first().innerText();
  await donors.first().click();

  // Donor and effect, both named — the pairing the client prints.
  await expect(focusSocket.locator('.donor')).toContainText(chosen);
  await expect(focusSocket.locator('.donor')).toContainText(effect);

  // And a set-wide effects panel that says plainly that it is not scoring them.
  await expect(page.locator('.effect-list').first()).toContainText(effect);
  await expect(page.locator('body')).toContainText('listed, not scored');

  await focusSocket.getByRole('button', { name: 'Change' }).click();
  await expect(page.locator('.modal .results .result').first()).toBeVisible({ timeout: 30_000 });
  const search = page.locator('.modal input[aria-label="Search exaltation donors"]');
  await expect(search).toBeFocused();
  await search.fill('zzzzzz');
  await expect(page.locator('.modal .empty-state h2')).toHaveText(/no eligible donors/i);
  await page.keyboard.press('Escape');
  await expect(focusSocket.locator('.donor')).toContainText(chosen); // cancel kept it

  await focusSocket.getByRole('button', { name: /remove/i }).click();
  await expect(focusSocket.locator('.donor')).toHaveText('—');
  await expect(page.locator('.effect-list')).toHaveCount(0);
  await expectCleanText(page);
});

test('a donor travels in the share link and the shared view cannot edit it', async ({ page }) => {
  const hash = await createCharacter(page, { name: 'Exalter' });
  await equipFirstEar(page);
  await page.goto(`/${hash}/exaltations`);
  await row(page).locator('.stepper button').last().click();
  const focusSocket = row(page).locator('.socket').first();
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
  await expect(page.locator('.exalt-row').first().locator('.socket').first().locator('.donor'))
    .toContainText(chosen);
  await expect(page.getByRole('button', { name: 'Add' })).toHaveCount(0);
  await expect(page.locator('.exalt-row').first().locator('.stepper button').last()).toBeDisabled();
});
