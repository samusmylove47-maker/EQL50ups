/** Share links: a full round trip, and every way a pasted link can be broken. */

import { createCharacter, expect, expectCleanText, openSlotPicker, test } from './helpers';

/** base64url of a UTF-8 string, matching lib/base64url. */
function encode(text: string): string {
  return Buffer.from(text, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

test('a complex set survives the round trip byte for byte', async ({ page }) => {
  test.slow();
  page.on('dialog', (d) => d.accept());

  const name = 'Ávenraë 🐉 "The/Bold"';
  const hash = await createCharacter(page, { name, classes: [0, 4, 7], race: 2 });

  await page.getByRole('button', { name: /auto-fill/i }).click();
  await expect(page.locator('.notice')).toContainText(/placed \d+ items?/i, { timeout: 60_000 });

  // Vary the tiers so the codec has something to carry.
  const steppers = page.locator('.slot-wrap .stepper');
  for (let i = 0; i < 5; i++) {
    const plus = steppers.nth(i).locator('button').last();
    for (let k = 0; k <= i; k++) await plus.click();
  }

  await page.goto(`/${hash}/weights`);
  await page.locator('#w-AC').fill('4.25');
  await page.locator('#w-HP').fill('-0.5');
  await page.locator('#w-HP').blur();

  await page.goto(`/${hash}`);
  await page.getByRole('button', { name: /edit/i }).click();
  await page.locator('.modal input[type=text]').fill('Sét ñame 🐉 / <b>');
  await page.locator('.modal textarea').fill('Notes: "quotes", <tags>, 🐲, back\\slash');
  await page.getByRole('button', { name: /^save$/i }).click();
  await page.waitForTimeout(300);

  /*
   * Field by field rather than by row text: a shared set is read-only, so its
   * rows carry a stated `+N` where an editable set carries the stepper and the
   * clear control. Everything that describes the *plan* — slot, item, stat line
   * and upgrade tier — has to survive the round trip exactly.
   */
  const snapshot = async () => ({
    header: (await page.locator('.set-header').innerText()).replace(/\s+/g, ' ').replace(/ ▾$/, ''),
    notes: await page.locator('.set-notes').innerText(),
    stats: (await page.locator('.stats').innerText()).replace(/\s+/g, ' '),
    slots: await page.locator('.slot-wrap').evaluateAll((rows) =>
      rows.map((row) => {
        const text = (sel: string) => row.querySelector(sel)?.textContent?.trim() ?? '';
        return [
          text('.slot-name'),
          text('.slot-item'),
          text('.slot-stats'),
          text('.stepper .value') || text('.tier-chip') || '+0',
        ].join(' | ');
      }),
    ),
  });
  const before = await snapshot();

  await page.getByRole('button', { name: /share/i }).click();
  const link = await page.locator('.copy-field input').inputValue();
  await page.keyboard.press('Escape');

  await page.goto(link);
  await expect(page.locator('.set-header h1')).toHaveText(name);
  await page.waitForTimeout(1500);
  const after = await snapshot();

  expect(after.header).toBe(before.header);
  expect(after.notes).toBe(before.notes);
  expect(after.stats).toBe(before.stats);
  expect(after.slots).toEqual(before.slots);

  await page.getByRole('tab', { name: 'Weights' }).click();
  await expect(page.locator('#w-AC')).toHaveValue('4.25');
  await expect(page.locator('#w-HP')).toHaveValue('-0.5');

  // Saving a copy lands in the library, editable.
  await page.getByRole('button', { name: /save a copy/i }).click();
  await page.waitForURL(/#\/set\//);
  await expect(page.locator('.slot-foot .btn').first()).toBeVisible();
  await expectCleanText(page);
});

const BROKEN: Array<[label: string, payload: string]> = [
  ['garbage characters', '!!!!!!'],
  ['valid base64 of prose', encode('hello world')],
  ['null', encode('null')],
  ['a number', encode('42')],
  ['an object', encode(JSON.stringify({ hi: 1 }))],
  ['a truncated tuple', encode(JSON.stringify([1, 'A', 50]))],
  ['a future version', encode(JSON.stringify([2, 'A', 50, null, 'WAR', 'S', [], [], '']))],
  ['version zero', encode(JSON.stringify([0, 'A', 50, null, 'WAR', 'S', [], [], '']))],
  [
    'a truncated payload',
    encode(JSON.stringify([1, 'Avenrae', 50, null, 'WAR', 'Set', [['HEAD', 'Dagas', 3, 0]], [], '']))
      .slice(0, 40),
  ],
  ['an enormous payload', 'A'.repeat(200_000)],
];

for (const [label, payload] of BROKEN) {
  test(`a share link with ${label} explains itself instead of crashing`, async ({ page }) => {
    await page.goto(`/#/share/${payload}`);
    await expect(page.locator('.empty-state h2')).toHaveText(/could not be read/i);
    await expectCleanText(page);
    await page.getByRole('link', { name: /go to the planner/i }).click();
    await expect(page).toHaveURL(/#\/$/);
  });
}

test('a hand-edited link cannot smuggle in junk slots, weights or a repeated class', async ({
  page,
}) => {
  const payload = encode(
    JSON.stringify([
      1,
      'Tampered',
      1e9,
      'ELF',
      'WAR/WAR/NOPE/CLR',
      'Set',
      [
        ['NOT_A_SLOT', 'Dagas', 1, 0],
        ['HEAD', '', 1, 0],
        ['HEAD', 'Dagas', 'x', 'y'],
        'not-an-array',
        null,
      ],
      [['AC', 'x'], ['', 5], ['HP', 2]],
      42,
    ]),
  );
  await page.goto(`/#/share/${payload}`);

  // Level clamps, the trio is distinct and real, and the junk slots are gone.
  await expect(page.locator('.set-header .sub')).toContainText('WAR/CLR');
  await expect(page.locator('.set-header .sub')).not.toContainText('WAR/WAR');
  await expect(page.locator('.set-header .sub')).not.toContainText('NOPE');
  await expect(page.locator('.slot-wrap .slot.filled, .slot-wrap .slot.unresolved')).toHaveCount(1);
  await expectCleanText(page);

  await page.getByRole('tab', { name: 'Weights' }).click();
  await expect(page.locator('#w-AC')).toHaveValue('0');
  await expect(page.locator('#w-HP')).toHaveValue('2');
});

test('a set URL that is not in this library says so and offers a way out', async ({ page }) => {
  await page.goto('/#/set/set_nothing_here');
  await expect(page.locator('.empty-state h2')).toHaveText(/set not found/i);
  await page.getByRole('link', { name: /your characters/i }).click();
  await expect(page).toHaveURL(/#\/characters$/);
});

test('a full 23-slot link is short enough to paste, and an old link still opens', async ({
  page,
}) => {
  test.slow();
  page.on('dialog', (d) => d.accept());

  const hash = await createCharacter(page, { name: 'Compressor', classes: [0, 7, 15] });
  await page.getByRole('button', { name: /auto-fill/i }).click();
  await expect(page.locator('.notice')).toContainText(/placed \d+ items?/i, { timeout: 60_000 });

  await page.getByRole('button', { name: /share/i }).click();
  const link = await page.locator('.copy-field input').inputValue();
  await page.keyboard.press('Escape');

  /*
   * The v1 codec produced 1,348 characters for this exact set — a wall of
   * base64 that Discord wraps. Interning item names against the shipped
   * catalog and packing the frame as bytes brings it under 400.
   */
  expect(link.length).toBeLessThan(400);
  const payload = link.split('#/share/')[1] ?? '';
  expect(payload.length).toBeLessThan(350);

  // And it is still lossless: every slot comes back.
  const equipped = await page.locator('.slot-item').count();
  await page.goto(link);
  await expect(page.locator('.set-header h1')).toHaveText('Compressor');
  await page.waitForTimeout(1200);
  expect(await page.locator('.slot-item').count()).toBe(equipped);
  await expectCleanText(page);
});

test('a link made by the previous version still opens', async ({ page }) => {
  // v1 was a positional JSON tuple. Those links are in people's chat history;
  // they have to keep working, mapping the old single level onto the old trio.
  const legacy = encode(
    JSON.stringify([
      1,
      'Old Timer',
      50,
      null,
      'BRD/WAR/BER',
      'Legacy Set',
      [['PRIMARY', 'Earthshaker', 6, 0], ['HEAD', 'Indicolite Helm', 0, 0]],
      [['AC', 2], ['HP', 0.5]],
      'made before the rework',
    ]),
  );
  await page.goto(`/#/share/${legacy}`);
  await expect(page.locator('.set-header h1')).toHaveText('Old Timer');
  await expect(page.locator('.identity .sub')).toContainText('50 BRD/WAR/BER');
  await expect(page.locator('body')).toContainText('Earthshaker');
  await expect(page.locator('.set-notes')).toContainText('made before the rework');
  await expectCleanText(page);
});
