/** Character creation: validation, the class trio, and hostile input. */

import { createCharacter, expect, expectCleanText, test } from './helpers';

const create = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: /create character/i });

test('Create stays disabled until a name and at least one class exist', async ({ page }) => {
  await page.goto('/#/character/new');
  const name = page.locator('input[type=text]').first();

  await expect(create(page)).toBeDisabled();

  await name.fill('   ');
  await expect(create(page)).toBeDisabled();

  await page.locator('.class-chip').nth(0).click();
  await expect(create(page)).toBeDisabled(); // whitespace is still no name

  await name.fill('Avenrae');
  await expect(create(page)).toBeEnabled();

  await page.locator('.class-chip').nth(0).click(); // deselect the only class
  await expect(create(page)).toBeDisabled();
});

test('the trio picker takes three classes, blocks a fourth and never repeats one', async ({
  page,
}) => {
  await page.goto('/#/character/new');
  await page.locator('input[type=text]').first().fill('Trio');
  const chips = page.locator('.class-chip');

  await chips.nth(0).click();
  await expect(chips.nth(0)).toHaveAttribute('aria-pressed', 'true');
  await expect(chips.nth(0)).toContainText('Primary');

  await chips.nth(0).click(); // same class twice = deselect, not duplicate
  await expect(chips.nth(0)).toHaveAttribute('aria-pressed', 'false');

  await chips.nth(0).click();
  await chips.nth(1).click();
  await chips.nth(2).click();
  await expect(page.locator('.class-chip[aria-pressed="true"]')).toHaveCount(3);
  await expect(chips.nth(2)).toContainText('Third');

  // Every unselected chip is disabled once the trio is full.
  const total = await chips.count();
  await expect(page.locator('.class-chip[disabled]')).toHaveCount(total - 3);

  await chips.nth(1).click(); // deselect the second
  await expect(page.locator('.class-chip[aria-pressed="true"]')).toHaveCount(2);
  await expect(page.locator('.class-chip[disabled]')).toHaveCount(0);
});

test('the level field keeps what is typed, refuses nonsense and snaps on blur', async ({ page }) => {
  await page.goto('/#/character/new');
  await page.locator('input[type=text]').first().fill('Leveller');
  await page.locator('.class-chip').nth(0).click();
  const level = page.locator('input[type=number]').first();

  // Regression: clamping per keystroke rewrote the field mid-edit, so clearing
  // it and typing "40" produced 140 and then the cap.
  await level.fill('');
  await level.pressSequentially('40');
  await expect(level).toHaveValue('40');
  await expect(create(page)).toBeEnabled();

  await level.fill('999');
  await expect(level).toHaveValue('999');
  await expect(create(page)).toBeDisabled();
  await expect(page.getByRole('alert')).toContainText(/between 1 and 50/i);
  await level.blur();
  await expect(level).toHaveValue('50');
  await expect(create(page)).toBeEnabled();

  await level.fill('0');
  await expect(create(page)).toBeDisabled();
  await level.blur();
  await expect(level).toHaveValue('1');

  await level.fill('-1');
  await expect(create(page)).toBeDisabled();
  await level.blur();
  await expect(level).toHaveValue('1');

  await level.fill('');
  await expect(create(page)).toBeDisabled();
  await level.blur();
  await expect(level).toHaveValue('50');
});

test('a long, unicode, quote-laden name survives creation as text, not markup', async ({ page }) => {
  const hostile = 'Ávenraë 🐉 <b>"x"</b> \'y\' & <script>alert(1)</script>';
  await page.goto('/#/character/new');
  const name = page.locator('input[type=text]').first();

  await name.fill('A'.repeat(500));
  await expect(name).toHaveValue('A'.repeat(64)); // maxLength holds

  await name.fill(hostile);
  await page.locator('.class-chip').nth(0).click();
  await create(page).click();
  await page.waitForURL(/#\/set\//);

  await expect(page.locator('.set-header h1')).toHaveText(hostile.slice(0, 64));
  expect(await page.locator('.set-header h1 b').count()).toBe(0);
  await expectCleanText(page);
});

test('race can be set and unset, and the codes come from the catalog', async ({ page }) => {
  await page.goto('/#/character/new');
  const race = page.locator('select').first();
  const options = await race.locator('option').allInnerTexts();
  expect(options[0]).toBe('Unset');
  expect(options.length).toBeGreaterThan(1);

  await page.locator('input[type=text]').first().fill('Racer');
  await page.locator('.class-chip').nth(0).click();
  await race.selectOption({ index: 1 });
  await expect(create(page)).toBeEnabled();
  await race.selectOption('');
  await expect(create(page)).toBeEnabled();

  await race.selectOption({ index: 1 });
  await create(page).click();
  await page.waitForURL(/#\/set\//);
  /*
   * The header carries the CODE, which is what this test's name claims and what
   * `SetWorkspace` prints. It used to assert the whole option label instead, and
   * that assumption broke the moment race options gained display names: the
   * dropdown reads "Human (HUM)" via `raceLabel` while the header reads
   * "50 WAR · HUM". Neither is wrong — the test was pinning one surface's
   * formatting to another's. So the code is extracted from the label rather than
   * typed here, and a label with no name (KER, which has no sourced display
   * name) still yields its bare code.
   */
  const label = options[1] ?? '';
  const code = /\(([A-Z]+)\)\s*$/.exec(label)?.[1] ?? label.trim();
  expect(code, 'a race code, not a sentence').toMatch(/^[A-Z]{2,4}$/);
  await expect(page.locator('.set-header .sub')).toContainText(code);
});

test('the form submits from the keyboard alone', async ({ page }) => {
  await page.goto('/#/character/new');
  await page.keyboard.type('Keyboardist');
  await page.locator('.class-chip').nth(3).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.class-chip').nth(3)).toHaveAttribute('aria-pressed', 'true');
  await page.locator('input[type=text]').first().focus();
  await page.keyboard.press('Enter');
  await page.waitForURL(/#\/set\//);
  await expect(page.locator('.set-header h1')).toHaveText('Keyboardist');
});

test('characters and their sets survive a reload', async ({ page }) => {
  const hash = await createCharacter(page, { name: 'Persistent', classes: [0, 1] });
  await page.reload();
  await expect(page.locator('.set-header h1')).toHaveText('Persistent');
  await page.goto('/#/characters');
  await expect(page.locator('.card h3')).toHaveText(['Persistent']);
  await expect(page.locator('.set-line a')).toHaveText(['Main Set']);
  expect(hash).toMatch(/#\/set\//);
});
