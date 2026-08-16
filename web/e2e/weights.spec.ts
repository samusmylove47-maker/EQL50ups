/** The EP weight editor — presets, hand-tuning, and what it does to rankings. */

import { createCharacter, expect, expectCleanText, openSlotPicker, test } from './helpers';

test('a negative weight can be typed', async ({ page }) => {
  // Regression: the field rendered `String(finite(value))` back, so the lone
  // "-" of a negative number round-tripped to "0" and was overwritten.
  const hash = await createCharacter(page);
  await page.goto(`/${hash}/weights`);

  const ac = page.locator('#w-AC');
  await ac.click();
  await page.keyboard.press('Control+a');
  await page.keyboard.type('-2.5');
  await expect(ac).toHaveValue('-2.5');

  await page.locator('#w-HP').click(); // blur commits
  await page.reload();
  await expect(page.locator('#w-AC')).toHaveValue('-2.5');
});

test('decimals, zeroing and the arrow keys all behave', async ({ page }) => {
  const hash = await createCharacter(page);
  await page.goto(`/${hash}/weights`);
  const ac = page.locator('#w-AC');

  await ac.click();
  await page.keyboard.press('Control+a');
  await page.keyboard.type('1.5');
  await expect(ac).toHaveValue('1.5');

  await ac.press('ArrowUp');
  await expect(ac).toHaveValue('1.6');
  await ac.press('ArrowDown');
  await ac.press('ArrowDown');
  await expect(ac).toHaveValue('1.4');

  await ac.fill('0');
  await ac.blur();
  await expect(ac).toHaveValue('0');
  await expectCleanText(page);
});

test('presets load, Clear all zeroes everything, and edits mark the profile custom', async ({
  page,
}) => {
  const hash = await createCharacter(page);
  await page.goto(`/${hash}/weights`);
  const preset = page.locator('select').first();
  await expect(preset).toHaveValue('balanced');

  const ids: string[] = await preset.locator('option').evaluateAll((os) =>
    os.map((o) => (o as HTMLOptionElement).value),
  );
  for (const id of ids) {
    await preset.selectOption(id);
    await expect(preset).toHaveValue(id);
    await expectCleanText(page);
  }

  await preset.selectOption('tank');
  const tankAc = await page.locator('#w-AC').inputValue();
  expect(Number(tankAc)).toBeGreaterThan(0);

  await page.locator('#w-AC').fill('9');
  await expect(preset).toHaveValue('custom');

  await page.getByRole('button', { name: /clear all/i }).click();
  const values = await page.locator('.weight-row input').evaluateAll((els) =>
    els.map((e) => (e as HTMLInputElement).value),
  );
  expect(values.every((v) => v === '0')).toBe(true);
});

test('weights re-rank the picker live', async ({ page }) => {
  const hash = await createCharacter(page);
  await page.goto(`/${hash}/weights`);
  await page.getByRole('button', { name: /clear all/i }).click();
  await page.locator('#w-MANA').fill('10');
  await page.locator('#w-MANA').blur();

  await page.goto(`/${hash}`);
  await openSlotPicker(page, 0);
  const manaFirst = await page.locator('.results .result').first().innerText();
  expect(manaFirst).toMatch(/Mana/i);
  await page.keyboard.press('Escape');

  await page.goto(`/${hash}/weights`);
  await page.getByRole('button', { name: /clear all/i }).click();
  await page.locator('#w-HP').fill('10');
  await page.locator('#w-HP').blur();
  await page.goto(`/${hash}`);
  await openSlotPicker(page, 0);
  const hpFirst = await page.locator('.results .result').first().innerText();
  expect(hpFirst).toMatch(/HP/i);
});

test('a shared set shows its weights read-only', async ({ page }) => {
  const hash = await createCharacter(page, { name: 'Weighted' });
  await page.goto(`/${hash}/weights`);
  await page.locator('#w-AC').fill('4.25');
  await page.locator('#w-AC').blur();

  await page.goto(`/${hash}`);
  await page.getByRole('button', { name: /share/i }).click();
  const link = await page.locator('.copy-field input').inputValue();
  await page.keyboard.press('Escape');

  await page.goto(link);
  await page.getByRole('tab', { name: 'Weights' }).click();
  await expect(page.locator('#w-AC')).toHaveValue('4.25');
  await expect(page.locator('#w-AC')).toBeDisabled();
  await expect(page.getByRole('button', { name: /clear all/i })).toBeDisabled();
});
