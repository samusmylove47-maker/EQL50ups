/** The gear set workspace: steppers, tabs, the switcher, and every menu item. */

import {
  createCharacter,
  expect,
  expectCleanText,
  expectNoHorizontalScroll,
  openSlotPicker,
  test,
} from './helpers';

test('the +N stepper covers its whole range by mouse and by keyboard', async ({ page }) => {
  await createCharacter(page);
  await openSlotPicker(page, 0);
  await page.locator('.results .result').first().click();

  const stepper = page.locator('.slot-wrap').first().locator('.stepper');
  const minus = stepper.locator('button').first();
  const plus = stepper.locator('button').last();
  const value = stepper.locator('.value');

  await expect(value).toHaveText('+0');
  await expect(minus).toBeDisabled(); // floor
  await expect(plus).toBeEnabled();

  const before = await page.locator('.slot-wrap').first().locator('.slot-stats').innerText();
  for (let i = 0; i < 10; i++) await plus.click();
  await expect(value).toHaveText('+10');
  await expect(plus).toBeDisabled(); // ceiling
  await expect(minus).toBeEnabled();
  const after = await page.locator('.slot-wrap').first().locator('.slot-stats').innerText();
  expect(after).not.toBe(before); // the stats actually scaled

  // Rapid clicking cannot overshoot.
  await Promise.all(
    Array.from({ length: 15 }, () => plus.click({ force: true, noWaitAfter: true }).catch(() => {})),
  );
  await expect(value).toHaveText('+10');

  await value.focus();
  await page.keyboard.press('Home');
  await expect(value).toHaveText('+0');
  await page.keyboard.press('ArrowDown'); // already at the floor
  await expect(value).toHaveText('+0');
  await page.keyboard.press('ArrowUp');
  await expect(value).toHaveText('+1');
  await page.keyboard.press('ArrowRight');
  await expect(value).toHaveText('+2');
  await page.keyboard.press('ArrowLeft');
  await expect(value).toHaveText('+1');
  await page.keyboard.press('End');
  await expect(value).toHaveText('+10');
  await page.keyboard.press('ArrowUp'); // already at the ceiling
  await expect(value).toHaveText('+10');
  await expect(value).toHaveAttribute('aria-valuenow', '10');
  await expectCleanText(page);
});

test('tabs move through the URL and survive back and forward', async ({ page }) => {
  const hash = await createCharacter(page);
  const id = hash.split('/')[2];

  await page.getByRole('tab', { name: 'Exaltations' }).click();
  await expect(page).toHaveURL(new RegExp(`#/set/${id}/exaltations$`));
  await page.getByRole('tab', { name: 'Weights' }).click();
  await expect(page).toHaveURL(new RegExp(`#/set/${id}/weights$`));
  await page.getByRole('tab', { name: 'Gear' }).click();
  await expect(page).toHaveURL(new RegExp(`#/set/${id}$`));

  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`#/set/${id}/weights$`));
  await expect(page.getByRole('tab', { name: 'Weights' })).toHaveAttribute('aria-selected', 'true');
  await page.goForward();
  await expect(page).toHaveURL(new RegExp(`#/set/${id}$`));
  await expect(page.getByRole('tab', { name: 'Gear' })).toHaveAttribute('aria-selected', 'true');

  // Deep-linking a tab in a fresh session lands on that tab.
  await page.goto(`/#/set/${id}/exaltations`);
  await expect(page.getByRole('tab', { name: 'Exaltations' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
});

test('the tab row answers to the arrow keys and holds one tab stop', async ({ page }) => {
  await createCharacter(page);
  const gear = page.getByRole('tab', { name: 'Gear' });
  await gear.focus();

  // Roving tabindex: the selected tab is the group's only tab stop.
  expect(await page.locator('.tab').evaluateAll((tabs) => tabs.map((t) => t.tabIndex))).toEqual([
    0, -1, -1,
  ]);

  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Exaltations' })).toBeFocused();
  await expect(page).toHaveURL(/\/exaltations$/);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight'); // wraps
  await expect(gear).toBeFocused();
  await page.keyboard.press('End');
  await expect(page.getByRole('tab', { name: 'Weights' })).toBeFocused();
  await page.keyboard.press('Home');
  await expect(gear).toBeFocused();
  await page.keyboard.press('ArrowLeft'); // wraps backwards
  await expect(page.getByRole('tab', { name: 'Weights' })).toBeFocused();

  // The tablist contains tabs and nothing else.
  expect(
    await page.locator('[role=tablist]').evaluate((el) =>
      [...el.children].every((child) => child.getAttribute('role') === 'tab'),
    ),
  ).toBe(true);

  // One more Tab leaves the group entirely.
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement?.getAttribute('role'))).not.toBe('tab');
});

test('Edit renames, saves notes, and refuses to blank the name', async ({ page }) => {
  await createCharacter(page);
  await page.getByRole('button', { name: /edit/i }).click();
  await page.locator('.modal input[type=text]').fill('  Ráid Sét 🐉 <b>  ');
  await page.locator('.modal textarea').fill('Notes with "quotes" & <tags>');
  await page.getByRole('button', { name: /^save$/i }).click();

  await expect(page.locator('.set-switch .name')).toHaveText('Ráid Sét 🐉 <b>');
  await expect(page.locator('.set-notes')).toHaveText('Notes with "quotes" & <tags>');

  // A blank name is refused up front now: Save goes disabled and says why,
  // rather than accepting the click and silently keeping the old name.
  await page.getByRole('button', { name: /edit/i }).click();
  await page.locator('.modal input[type=text]').fill('');
  await expect(page.getByRole('button', { name: /^save$/i })).toBeDisabled();
  await expect(page.locator('.setconfig-footnote')).toContainText(/give the set a name/i);
  await page.getByRole('button', { name: /^cancel$/i }).click();
  await expect(page.locator('.set-switch .name')).toHaveText('Ráid Sét 🐉 <b>');

  // Cancel discards.
  await page.getByRole('button', { name: /edit/i }).click();
  await page.locator('.modal input[type=text]').fill('Discarded');
  await page.getByRole('button', { name: /^cancel$/i }).click();
  await expect(page.locator('.set-switch .name')).toHaveText('Ráid Sét 🐉 <b>');
});

test('Edit is the same dialog as create: weights and default filters, in one place', async ({
  page,
}) => {
  await createCharacter(page);
  await page.getByRole('button', { name: /edit/i }).click();

  // UI-REFERENCE §A4's three sections, on the edit path too.
  // Rendered uppercase by `.section-label`; the source strings are sentence case.
  await expect(page.locator('.setconfig .section-label')).toHaveText([
    'BASIC DETAILS',
    'EQUIVALENCY POINTS',
    'DEFAULT FILTERS',
  ], { useInnerText: true });

  // A preset seeds the weights and explains itself in its own words.
  await page.locator('.setconfig-section select').first().selectOption('tank');
  await expect(page.locator('.setconfig-help')).toHaveText(/mitigation and health/i);
  await expect(page.getByLabel('AC weight')).toHaveValue('2');

  // `+ Add Point` adds one stat at a time, and never offers the same one twice.
  const before = await page.locator('.setconfig-weight').count();
  await page.locator('.setconfig-add').click();
  await page.locator('[aria-label="Stat to add"]').selectOption('HASTE');
  await page.locator('.setconfig-addrow .btn-primary').click();
  await expect(page.locator('.setconfig-weight')).toHaveCount(before + 1);
  await page.locator('.setconfig-add').click();
  await expect(page.locator('[aria-label="Stat to add"] option[value=HASTE]')).toHaveCount(0);
  await page.locator('.setconfig-addrow .btn', { hasText: 'Cancel' }).click();

  // Emptying the profile is refused: nothing can be ranked without weights.
  for (const label of await page.locator('.setconfig-weight .k').allInnerTexts()) {
    await page.locator(`[aria-label="Remove ${label}"]`).click();
  }
  await expect(page.getByRole('button', { name: /^save$/i })).toBeDisabled();
  await expect(page.locator('.setconfig-footnote')).toContainText(/non-zero weight/i);

  await page.locator('.setconfig-add').click();
  await page.locator('[aria-label="Stat to add"]').selectOption('AC');
  await page.locator('.setconfig-addrow .btn-primary').click();

  await page.locator('.setconfig-filters select').nth(0).selectOption('Kunark');
  await page.locator('.setconfig-filters select').nth(1).selectOption('quest');
  await page.locator('.setconfig-filters input[type=checkbox]').check();
  await page.getByRole('button', { name: /^save$/i }).click();
  await expect(page.locator('.modal')).toHaveCount(0);

  // Saves are debounced, so poll rather than reading storage the same tick.
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem('eqlups.state.v1') ?? '{}').sets?.[0]?.defaultFilters,
      ),
    )
    .toEqual({ era: 'Kunark', source: 'quest', hideNoDrop: true });
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('eqlups.state.v1') ?? '{}'),
  );
  expect(stored.sets[0].weights).toEqual({ AC: 1 });
  await expectCleanText(page);
});

test('the overflow menu duplicates, clears and deletes', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await createCharacter(page);
  await openSlotPicker(page, 0);
  await page.locator('.results .result').first().click();
  await expect(page.locator('.slot-wrap .slot.filled')).toHaveCount(1);

  const overflow = page.locator('summary[aria-label="More set actions"]');
  await overflow.click();
  await page.locator('.menu-body.right .menu-item', { hasText: 'Duplicate set' }).click();
  await expect(page.locator('.set-switch .name')).toHaveText('Main Set (copy)');
  await expect(page.locator('.slot-wrap .slot.filled')).toHaveCount(1); // gear came along

  await overflow.click();
  await page.locator('.menu-body.right .menu-item', { hasText: 'Clear all slots' }).click();
  await expect(page.locator('.slot-wrap .slot.filled')).toHaveCount(0);

  await overflow.click();
  await page.locator('.menu-body.right .menu-item', { hasText: 'Delete set' }).click();
  await expect(page).toHaveURL(/#\/characters$/);
  await expect(page.locator('.set-line a')).toHaveText(['Main Set']);
});

test('the set switcher lists siblings and makes new sets', async ({ page }) => {
  await createCharacter(page);
  await page.locator('.set-switch').click();
  await page.locator('.menu-body .menu-item', { hasText: '+ New set' }).click();
  // `+ New set` now asks before it makes anything: §A4's create dialog.
  await expect(page.locator('.modal-head h2')).toHaveText(/new gear set/i);
  await expect(page.getByRole('button', { name: /^create$/i })).toBeDisabled();
  await page.locator('.modal input[type=text]').fill('Set 2');
  await page.getByRole('button', { name: /^create$/i }).click();
  await expect(page.locator('.set-switch .name')).toHaveText('Set 2');

  await page.locator('.set-switch').click();
  const items = page.locator('.menu-body').first().locator('.menu-item');
  await expect(items).toHaveCount(3); // two sets plus "+ New set"
  await items.filter({ hasText: 'Main Set' }).click();
  await expect(page.locator('.set-switch .name')).toHaveText('Main Set');

  // The switcher menu closes on Escape.
  await page.locator('.set-switch').click();
  await expect(page.locator('.menu-body').first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.menu-body').first()).toBeHidden();
});

test('Share produces a link that reopens the same set read-only', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await createCharacter(page, { name: 'Sharer', classes: [0, 1] });
  await openSlotPicker(page, 0);
  await page.locator('.results .result').first().click();
  const equipped = await page.locator('.slot-wrap').first().locator('.slot-item').innerText();

  await page.getByRole('button', { name: /share/i }).click();
  const link = await page.locator('.copy-field input').inputValue();
  expect(link).toContain('#/share/');
  await page.getByRole('button', { name: /^copy$/i }).click();
  await expect(page.locator('.copy-field button')).toHaveText(/copied/i);
  await page.keyboard.press('Escape');
  await expect(page.locator('.modal')).toHaveCount(0);

  await page.goto(link);
  await expect(page.locator('.set-header h1')).toHaveText('Sharer');
  await expect(page.locator('.slot-wrap').first().locator('.slot-item')).toHaveText(equipped);
  await expect(page.locator('.slot-foot .btn')).toHaveCount(0); // no Clear, read-only
  await expect(page.getByRole('button', { name: /save a copy/i })).toBeVisible();
  await expectCleanText(page);
});

test('auto-fill fills, asks before replacing, and explains a full set', async ({ page }) => {
  test.slow();
  const messages: string[] = [];
  page.on('dialog', (d) => {
    messages.push(d.message());
    d.accept();
  });
  await createCharacter(page, { name: 'Filler' });

  await page.getByRole('button', { name: /auto-fill/i }).click();
  await expect(page.locator('.notice')).toContainText(/placed \d+ items?/i, { timeout: 60_000 });
  await expect(page.locator('.slot-wrap .slot.filled')).toHaveCount(23);
  expect(messages, 'no confirmation needed for an empty set').toEqual([]);
  await expectCleanText(page);
  await expectNoHorizontalScroll(page);

  // Second run asks before replacing hand-picked gear.
  await page.getByRole('button', { name: /auto-fill/i }).click();
  await expect(page.locator('.notice')).toContainText(/placed \d+ items?/i, { timeout: 60_000 });
  expect(messages[0]).toMatch(/replace all 23 equipped items/i);

  // Declining leaves everything alone and says so honestly.
  page.removeAllListeners('dialog');
  page.on('dialog', (d) => d.dismiss());
  await page.getByRole('button', { name: /auto-fill/i }).click();
  await expect(page.locator('.notice')).toContainText(/every slot is already filled/i, {
    timeout: 60_000,
  });
  await expect(page.locator('.slot-wrap .slot.filled')).toHaveCount(23);
});

test('an unresolvable equipped item is flagged rather than hidden', async ({ page }) => {
  await createCharacter(page, { name: 'Ghosted' });
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('eqlups.state.v1') ?? '{}');
    raw.sets[0].slots.HEAD = { itemName: 'No Such Item', upgrade: { full: 2, fraction: 0 } };
    localStorage.setItem('eqlups.state.v1', JSON.stringify(raw));
  });
  await page.reload();
  await expect(page.locator('.slot.unresolved')).toHaveCount(1);
  await expect(page.locator('.slot.unresolved')).toContainText('No Such Item');
  await expect(page.locator('.slot.unresolved')).toContainText('Not in catalog');
  await expectCleanText(page);
});
