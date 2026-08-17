/** The slot picker: focus, keyboard, filters, and every way out of it. */

import { createCharacter, expect, expectCleanText, openSlotPicker, test } from './helpers';

test('the search box takes focus on open, so typing searches immediately', async ({ page }) => {
  // Regression: Modal's setup effect depended on `onClose` (a fresh arrow each
  // render), so its cleanup restored focus to the slot button one render after
  // the picker had focused the search box, and typing went nowhere.
  await createCharacter(page);
  await openSlotPicker(page, 0);

  const search = page.locator('.modal input[aria-label="Search items by name"]');
  await expect(search).toBeFocused();

  await page.waitForTimeout(600); // catalog shard lands and re-renders the tree
  await expect(search).toBeFocused();

  await page.keyboard.type('ring');
  await expect(search).toHaveValue('ring');
});

test('Tab stays inside the open picker', async ({ page }) => {
  await createCharacter(page);
  await openSlotPicker(page, 0);

  for (let i = 0; i < 14; i++) {
    await page.keyboard.press('Tab');
    const inside = await page.evaluate(() => Boolean(document.activeElement?.closest('.modal')));
    expect(inside, `focus escaped the dialog after ${i + 1} tabs`).toBe(true);
  }
  await page.keyboard.press('Shift+Tab');
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest('.modal')))).toBe(true);
});

test('keyboard navigation moves, jumps and equips', async ({ page }) => {
  await createCharacter(page);
  await openSlotPicker(page, 0);
  const active = page.locator('.results .result[data-active="true"]');

  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await expect(active).toHaveAttribute('id', 'picker-option-2');
  await page.keyboard.press('ArrowUp');
  await expect(active).toHaveAttribute('id', 'picker-option-1');
  await page.keyboard.press('PageDown');
  await expect(active).toHaveAttribute('id', 'picker-option-11');
  await page.keyboard.press('PageUp');
  await expect(active).toHaveAttribute('id', 'picker-option-1');
  await page.keyboard.press('Control+Home');
  await expect(active).toHaveAttribute('id', 'picker-option-0');
  await page.keyboard.press('Control+End');
  const count = await page.locator('.results .result').count();
  await expect(active).toHaveAttribute('id', `picker-option-${count - 1}`);
  await page.keyboard.press('Control+Home');

  // The row's icon is a drawn slot glyph now, not a two-letter monogram, so the
  // name is the row's own `.iname` rather than the second line of its text.
  const name = (
    await page.locator('.results .result').first().locator('.result-name .iname').innerText()
  ).trim();
  await page.keyboard.press('Enter');
  await expect(page.locator('.modal')).toHaveCount(0);
  await expect(page.locator('.slot-wrap').first().locator('.slot-item')).toHaveText(name ?? '');
});

test('the filter controls keep the keys they own', async ({ page }) => {
  // Regression: the list's key handler swallowed everything, so the era and
  // source dropdowns could not be changed with the arrow keys and Home in the
  // search box jumped the list instead of the caret.
  await createCharacter(page);
  await openSlotPicker(page, 0);

  const search = page.locator('.modal input[aria-label="Search items by name"]');
  await search.fill('ring');
  await search.focus();
  await page.keyboard.press('End');
  await page.keyboard.press('Home');
  expect(await search.evaluate((el: HTMLInputElement) => el.selectionStart)).toBe(0);
  await page.keyboard.press('End');
  expect(await search.evaluate((el: HTMLInputElement) => el.selectionStart)).toBe(4);

  // But the list still answers to the arrows from the same field.
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('.results .result[data-active="true"]')).toHaveAttribute(
    'id',
    'picker-option-1',
  );

  const era = page.locator('.modal select[aria-label="Filter by era"]');
  await era.focus();
  await page.keyboard.press('ArrowDown');
  await expect(era).not.toHaveValue('any');

  const source = page.locator('.modal select[aria-label="Filter by source"]');
  await source.focus();
  await page.keyboard.press('ArrowDown');
  await expect(source).not.toHaveValue('any');

  const liveOnly = page.locator('.modal .checkline input').first();
  await liveOnly.focus();
  await page.keyboard.press('Space');
  await expect(liveOnly).not.toBeChecked();
});

test('every exit path closes the picker', async ({ page }) => {
  await createCharacter(page);

  await openSlotPicker(page, 1);
  await page.keyboard.press('Escape');
  await expect(page.locator('.modal')).toHaveCount(0);

  await openSlotPicker(page, 1);
  await page.mouse.click(4, 4); // backdrop
  await expect(page.locator('.modal')).toHaveCount(0);

  await openSlotPicker(page, 1);
  await page.locator('.modal-foot').getByRole('button', { name: /^cancel$/i }).click();
  await expect(page.locator('.modal')).toHaveCount(0);

  await openSlotPicker(page, 1);
  await page.getByRole('button', { name: /close dialog/i }).click();
  await expect(page.locator('.modal')).toHaveCount(0);

  // Focus returns to the slot that opened it, and the page scrolls again.
  await expect(page.locator('.slot-wrap button.slot').nth(1)).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
});

test('search survives regex metacharacters, padding and absurd length', async ({ page }) => {
  await createCharacter(page);
  await openSlotPicker(page, 0);
  const search = page.locator('.modal input[aria-label="Search items by name"]');
  const meta = page.locator('.picker-meta span').first();

  const all = await page.locator('.results .result').count();
  expect(all).toBeGreaterThan(0);

  for (const query of ['[', '*', '(', ')', '\\', '.*', '^$', 'x'.repeat(500)]) {
    await search.fill(query);
    await expect(meta).toContainText('0 matches');
    await expectCleanText(page);
  }

  await search.fill('  ring  ');
  await page.waitForTimeout(300);
  const padded = await page.locator('.results .result').count();
  await search.fill('ring');
  await page.waitForTimeout(300);
  expect(await page.locator('.results .result').count()).toBe(padded);

  await search.fill('zzzzzzzz');
  await expect(page.locator('.results .empty-state h2')).toHaveText(/no matching items/i);

  await search.fill('');
  await page.waitForTimeout(300);
  expect(await page.locator('.results .result').count()).toBe(all);
});

test('filters narrow the list and combine', async ({ page }) => {
  await createCharacter(page);
  await openSlotPicker(page, 0);
  const rows = () => page.locator('.results .result').count();
  const base = await rows();

  await page.locator('.modal select[aria-label="Filter by source"]').selectOption('quest');
  await page.waitForTimeout(250);
  const quest = await rows();
  expect(quest).toBeLessThanOrEqual(base);

  await page.locator('.modal select[aria-label="Filter by era"]').selectOption('Classic');
  await page.waitForTimeout(250);
  expect(await rows()).toBeLessThanOrEqual(quest);

  await page.locator('.modal select[aria-label="Filter by source"]').selectOption('any');
  await page.locator('.modal select[aria-label="Filter by era"]').selectOption('any');
  await page.waitForTimeout(250);
  expect(await rows()).toBe(base);

  // Live-only is on by default; allowing unreleased content can only add rows.
  const liveOnly = page.locator('.modal .checkline input').first();
  await expect(liveOnly).toBeChecked();
  await liveOnly.uncheck();
  await page.waitForTimeout(400);
  expect(await rows()).toBeGreaterThanOrEqual(base);
  await liveOnly.check();

  await page.locator('.modal input[aria-label="Filter by source text"]').fill('zzzzz');
  await expect(page.locator('.results .empty-state h2')).toHaveText(/no matching items/i);
});

test('the ranking preview rescoring is reflected in scores and in the equipped tier', async ({
  page,
}) => {
  await createCharacter(page);
  await openSlotPicker(page, 0);

  const topScore = async () =>
    Number((await page.locator('.results .result-score .n').first().innerText()).replace(/,/g, ''));
  const at0 = await topScore();

  const stepper = page.locator('.modal-head .stepper');
  for (let i = 0; i < 10; i++) await stepper.locator('button').last().click();
  await expect(stepper.locator('.value')).toHaveText('+10');
  await page.waitForTimeout(400);
  expect(await topScore()).toBeGreaterThan(at0);

  await page.locator('.results .result').first().click();
  await expect(page.locator('.slot-wrap').first().locator('.stepper .value')).toHaveText('+10');
});

test('re-picking the item already equipped is a no-op, and Clear empties the slot', async ({
  page,
}) => {
  await createCharacter(page);
  await openSlotPicker(page, 0);
  await page.locator('.results .result').first().click();
  const equipped = await page.locator('.slot-wrap').first().locator('.slot-item').innerText();

  await openSlotPicker(page, 0);
  await expect(page.locator('.picker-meta')).toContainText(`Equipped: ${equipped}`);
  await expect(page.locator('.results .result.equipped-now')).toHaveCount(1);
  await page.locator('.results .result.equipped-now').click();
  await expect(page.locator('.slot-wrap').first().locator('.slot-item')).toHaveText(equipped);

  await openSlotPicker(page, 0);
  // §A1: the slot name *is* the empty state, so nothing is printed in its
  // place. An emptied slot has no `.slot-item` at all and is marked `.empty`.
  await page.getByRole('button', { name: /clear slot/i }).click();
  await expect(page.locator('.slot-wrap').first().locator('.slot-item')).toHaveCount(0);
  await expect(page.locator('.slot-wrap').first().locator('.slot')).toHaveClass(/\bempty\b/);
  await expect(page.locator('.slot-wrap').first()).toContainText('Ear 1');
});

test('every one of the 23 positions can be filled from its own picker', async ({ page }) => {
  test.slow();
  await createCharacter(page);
  const slots = page.locator('.slot-wrap button.slot');
  await expect(slots).toHaveCount(23);

  for (let i = 0; i < 23; i++) {
    await openSlotPicker(page, i);
    const rows = await page.locator('.results .result').count();
    expect(rows, `no candidates for position ${i}`).toBeGreaterThan(0);
    await page.locator('.results .result').first().click();
    await expect(page.locator('.modal')).toHaveCount(0);
  }
  await expect(page.locator('.slot-wrap .slot.filled')).toHaveCount(23);
  await expectCleanText(page);
});
