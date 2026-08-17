/**
 * Per-class levels and loadouts, driven the way a player would.
 *
 * The property that matters most: switching the active loadout must re-rank
 * and re-filter everything, live, without touching the gear set — and the
 * migration must never lose a library written by the previous model.
 */

import { createCharacter, expect, expectCleanText, pickerMatchCount, test } from './helpers';

const V1_LIBRARY = {
  version: 1,
  characters: [
    { id: 'char_1', name: 'Avenrae', level: 50, classes: ['BRD', 'WAR', 'BER'], race: null },
  ],
  sets: [
    {
      id: 'set_1',
      characterId: 'char_1',
      name: 'Main Set',
      slots: {
        PRIMARY: { itemName: 'Earthshaker', upgrade: { full: 6, fraction: 0 } },
        HEAD: { itemName: 'Indicolite Helm', upgrade: { full: 0, fraction: 0 } },
      },
      weights: { AC: 1, HP: 0.2, RATIO: 20 },
      createdAt: 1,
      updatedAt: 2,
      notes: 'from the old model',
    },
  ],
  activeCharacterId: 'char_1',
};

test('a library saved by the previous model survives the upgrade intact', async ({ page }) => {
  await page.goto('/');
  await page.evaluate((library) => {
    localStorage.setItem('eqlups.state.v1', JSON.stringify(library));
  }, V1_LIBRARY);
  await page.goto('/#/characters');
  await page.reload();

  // The header reads exactly what it read before the rework.
  await expect(page.locator('.card').first()).toContainText('50 BRD/WAR/BER');
  await expect(page.locator('.card').first()).toContainText('Main Set');

  // The set is still there, still equipped, still at the tier it was saved at.
  await page.goto('/#/set/set_1');
  await expect(page.locator('.slot-item').first()).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('body')).toContainText('Earthshaker');
  await expect(page.locator('body')).toContainText('from the old model');

  /*
   * And the migrated shape has been written back, so it is not re-migrated on
   * every load and an export taken now carries the new model.
   *
   * Polled, not sampled once. The write-back is scheduled through the store's
   * 200 ms persist debounce (`schedulePersist` in `state/store.ts`), so "has
   * been written back" is an *eventual* property and reading it at one
   * arbitrary instant tests the scheduler as much as the migration. This
   * assertion failed exactly once, under two workers on a loaded machine,
   * reading version 1 — and did not reproduce in twelve further runs, isolated
   * and under deliberate CPU load.
   *
   * The bar is unchanged: the stored version must still become 2, and if the
   * write-back never happens this still fails, just after a timeout rather
   * than instantly.
   */
  await expect
    .poll(
      async () =>
        (
          await page.evaluate(() =>
            JSON.parse(localStorage.getItem('eqlups.state.v1') ?? '{}'),
          )
        ).version,
      { message: 'the migrated library is written back to storage' },
    )
    .toBe(2);

  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('eqlups.state.v1') ?? '{}'),
  );
  expect(stored.characters[0].loadouts).toHaveLength(1);
  expect(stored.characters[0].loadouts[0].classes).toEqual(['BRD', 'WAR', 'BER']);
  expect(stored.characters[0].levels.BRD).toBe(50);
  expect(stored.characters[0].levels.WIZ).toBe(1);
  await expectCleanText(page);
});

test('a second loadout re-ranks the pickers and re-titles the header, live', async ({ page }) => {
  const hash = await createCharacter(page, { name: 'Switcher', classes: [0, 7, 15] }); // WAR/BRD/BER
  const id = hash.replace('#/set/', '');
  await expect(page.locator('.identity .sub')).toContainText('50 WAR/BRD/BER');

  // How many head candidates does the plate trio see?
  await page.locator('.slot-wrap button.slot').nth(1).click();
  await page.locator('.results .result, .results .empty-state').first().waitFor();
  const asPlate = await pickerMatchCount(page);
  await page.keyboard.press('Escape');

  // Build a caster loadout on the character page.
  await page.goto('/#/characters');
  await page.locator('.card a', { hasText: /loadout/ }).first().click();
  await expect(page.locator('h1')).toContainText('Switcher');

  await page.getByRole('button', { name: /add loadout/i }).click();
  await expect(page.locator('.modal')).toBeVisible();
  // Seeded from the first loadout, so clear it before choosing a new trio.
  await page.locator('.modal .class-chip').nth(7).click(); // drop BRD
  await page.locator('.modal .class-chip').nth(15).click(); // drop BER
  await page.locator('.modal .class-chip').nth(1).click(); // add CLR
  await page.locator('.modal .class-chip').nth(11).click(); // add WIZ
  await page.locator('.modal input[type=text]').fill('Casters');
  await page.getByRole('button', { name: /save loadout/i }).click();
  await expect(page.locator('.modal')).toHaveCount(0);

  // Per-class levels are independent: drop the Warrior to 12.
  await page.getByLabel('Warrior level').fill('12');
  await expect(page.locator('body')).toContainText('12 WAR/CLR/WIZ');

  // Switch from the set page and watch everything follow.
  await page.goto(`/#/set/${id}`);
  await page.locator('summary[aria-label="Switch loadout"]').click();
  const menu = page.locator('details.menu:has(summary[aria-label="Switch loadout"]) .menu-item');
  await menu.filter({ hasText: 'Casters' }).click();

  // The header now shows the new primary and *its* level, not a character level.
  await expect(page.locator('.identity .sub')).toContainText('12 WAR/CLR/WIZ');

  await page.locator('.slot-wrap button.slot').nth(1).click();
  await page.locator('.results .result, .results .empty-state').first().waitFor();
  const asCaster = await pickerMatchCount(page);
  await page.keyboard.press('Escape');

  // A different trio must see a different pool — that is the whole feature.
  expect(asCaster).not.toBe(asPlate);
  await expectCleanText(page);
});
