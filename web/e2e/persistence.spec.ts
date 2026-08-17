/** Storage: what survives a reload, and what happens when storage misbehaves. */

import { createCharacter, expect, expectCleanText, openSlotPicker, test } from './helpers';

const KEY = 'eqlups.state.v1';

test('an edit made immediately before a reload is not lost', async ({ page }) => {
  // Regression: saves are debounced 200ms, and nothing flushed them, so a
  // reload (or a closed tab) inside that window dropped the change.
  await createCharacter(page, { name: 'Flusher' });
  await openSlotPicker(page, 0);
  await page.locator('.results .result').first().click();
  const equipped = await page.locator('.slot-wrap').first().locator('.slot-item').innerText();

  await page.reload(); // no waiting: straight into the debounce window
  await expect(page.locator('.slot-wrap').first().locator('.slot-item')).toHaveText(equipped);
});

test('several characters and sets all round-trip a reload', async ({ page }) => {
  await createCharacter(page, { name: 'Alpha', classes: [0] });
  await createCharacter(page, { name: 'Beta', classes: [1, 2] });
  await page.locator('.set-switch').click();
  await page.locator('.menu-body .menu-item', { hasText: '+ New set' }).click();
  await page.locator('.modal input[type=text]').fill('Set 2');
  await page.getByRole('button', { name: /^create$/i }).click();
  await expect(page.locator('.set-switch .name')).toHaveText('Set 2');

  await page.goto('/#/characters');
  await page.reload();
  await expect(page.locator('.card h3')).toHaveText(['Alpha', 'Beta']);
  await expect(page.locator('.card').nth(1).locator('.set-line')).toHaveCount(2);
  await expectCleanText(page);
});

test('deleting the set you are looking at leaves you somewhere sensible', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  const hash = await createCharacter(page, { name: 'Doomed' });
  await page.locator('summary[aria-label="More set actions"]').click();
  await page.locator('.menu-body.right .menu-item', { hasText: 'Delete set' }).click();
  await expect(page).toHaveURL(/#\/characters$/);

  await page.goto(`/${hash}`); // the dead link
  await expect(page.locator('.empty-state h2')).toHaveText(/set not found/i);

  await page.goto('/#/characters');
  await expect(page.locator('.card h3')).toHaveText(['Doomed']);
  await expect(page.locator('li.hint')).toHaveText(/no sets yet/i);
});

test('deleting a character takes its sets with it', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await createCharacter(page, { name: 'Alpha' });
  await createCharacter(page, { name: 'Beta' });
  await page.goto('/#/characters');
  await page.locator('.card', { hasText: 'Alpha' }).getByRole('button', { name: /delete character/i }).click();
  await expect(page.locator('.card h3')).toHaveText(['Beta']);
  await page.reload();
  await expect(page.locator('.card h3')).toHaveText(['Beta']);
});

test('unreadable storage is quarantined and the planner starts fresh', async ({ page }) => {
  await page.goto('/');
  await page.evaluate((key) => localStorage.setItem(key, '{not json'), KEY);
  await page.reload();

  await expect(page.locator('.notice-warn')).toContainText(/could not be read/i);
  expect(await page.evaluate((key) => localStorage.getItem(`${key}.corrupt`), KEY)).toBe('{not json');
  await expectCleanText(page);

  await page.goto('/#/characters');
  await expect(page.locator('.empty-state h2')).toHaveText(/no characters yet/i);
});

test('storage of the wrong shape is rejected without taking the app down', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(
    (key) => localStorage.setItem(key, JSON.stringify({ characters: 'nope', sets: 42 })),
    KEY,
  );
  await page.reload();
  await expect(page.locator('.notice-warn')).toContainText(/could not be read/i);
  await page.goto('/#/character/new');
  await expect(page.locator('.page-title')).toHaveText(/create character/i);
});

test('half-valid storage keeps what it can and repairs the rest', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(
    (key) =>
      localStorage.setItem(
        key,
        JSON.stringify({
          version: 1,
          characters: [
            { id: 'c1', name: 'Ghost', level: 'abc', classes: ['WAR', 'NOPE', 'WAR'], race: 5 },
            { junk: true },
          ],
          sets: [
            {
              id: 's1',
              characterId: 'c1',
              name: '',
              slots: {
                HEAD: { itemName: 'Nonexistent Item', upgrade: { full: 99, fraction: -3 } },
                JUNK: { itemName: '' },
              },
              weights: { AC: 'x', HP: 2 },
              createdAt: 'nope',
              updatedAt: null,
            },
            { id: 's2', characterId: 'missing', name: 'Orphan', slots: {}, weights: {} },
          ],
          activeCharacterId: 'gone',
        }),
      ),
    KEY,
  );
  await page.goto('/#/characters');
  await page.reload();

  await expect(page.locator('.card h3')).toHaveText(['Ghost']); // the junk character is dropped
  await expect(page.locator('.set-line a')).toHaveText(['Untitled Set']); // the orphan set too
  await page.locator('.set-line a').click();

  // Level coerced, the repeated class collapsed, the impossible tier clamped.
  await expect(page.locator('.set-header .sub')).toContainText('50 WAR');
  await expect(page.locator('.set-header .sub')).not.toContainText('WAR/WAR');
  await expect(page.locator('.slot.unresolved')).toHaveCount(1);
  await expect(page.locator('.slot-wrap').nth(1).locator('.stepper .value')).toHaveText('+10');
  await expectCleanText(page);
});

test('a full quota is reported, and the planner keeps working', async ({ page }) => {
  await page.addInitScript(() => {
    const real = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key.startsWith('eqlups.state.v1') && !key.endsWith('.probe')) {
        const error = new Error('quota');
        error.name = 'QuotaExceededError';
        throw error;
      }
      return real.call(this, key, value);
    };
  });
  await createCharacter(page, { name: 'Quota' });
  await expect(page.locator('.notice-warn')).toContainText(/storage is full/i);
  await openSlotPicker(page, 0);
  await page.locator('.results .result').first().click();
  await expect(page.locator('.slot-wrap .slot.filled')).toHaveCount(1);
  await expectCleanText(page);
});

test('a browser with no storage at all says so once and stays usable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('denied');
      },
      configurable: true,
    });
  });
  await page.goto('/');
  await expect(page.locator('.notice-warn')).toContainText(/not allowing local storage/i);
  await createCharacter(page, { name: 'Ephemeral' });
  await expect(page.locator('.set-header h1')).toHaveText('Ephemeral');
  await expectCleanText(page);
});

test('every tab stop on the characters screen is visible', async ({ page }) => {
  // Regression: the clipped file input behind "Import JSON" was focusable, so
  // keyboard users hit an invisible, unnamed control.
  await createCharacter(page, { name: 'Tabbable' });
  await page.goto('/#/characters');
  await page.locator('body').click({ position: { x: 2, y: 300 } });

  for (let i = 0; i < 14; i++) {
    await page.keyboard.press('Tab');
    const stop = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      const rect = el.getBoundingClientRect();
      return {
        tag: el.tagName,
        visible: rect.width > 2 && rect.height > 2 && getComputedStyle(el).visibility !== 'hidden',
      };
    });
    if (stop.tag === 'BODY') break;
    expect(stop.visible, `invisible tab stop: ${stop.tag}`).toBe(true);
  }
});

test('JSON export downloads, and a foreign file is refused politely', async ({ page }) => {
  await createCharacter(page, { name: 'Exporter' });
  await page.goto('/#/characters');

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /export json/i }).click();
  expect((await download).suggestedFilename()).toBe('eql-upgrades-export.json');

  await page.locator('input[type=file]').setInputFiles({
    name: 'not-ours.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"format":"something-else"}'),
  });
  await expect(page.locator('.notice')).toContainText(/not an EQL Upgrades export/i);

  await page.locator('input[type=file]').setInputFiles({
    name: 'broken.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{not json'),
  });
  await expect(page.locator('.notice')).toContainText(/could not be read as JSON/i);
});

test('an exported library imports back in as new entries', async ({ page }) => {
  await createCharacter(page, { name: 'Original' });
  await page.goto('/#/characters');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /export json/i }).click();
  const path = await (await download).path();

  await page.locator('input[type=file]').setInputFiles(path);
  await expect(page.locator('.notice')).toContainText(/imported 1 character and 1 set/i);
  await expect(page.locator('.card h3')).toHaveText(['Original', 'Original']);
  await expectCleanText(page);
});
