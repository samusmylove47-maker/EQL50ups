/**
 * The item browser has to agree with the set it is browsing for.
 *
 * Four measured defects, each re-checked in a real Chromium against the real
 * 3,533-item catalog rather than a fixture:
 *
 *  - searching a deliberately withheld item ("Ragebringer", "Jade Mace",
 *    "Wurmslayer") answered "NOTHING MATCHES — Loosen a filter", with no filter
 *    set, on the one screen where the project's largest decision is met;
 *  - the dialog printed "THIS LOADOUT CANNOT EQUIP IT" and offered EQUIP IN
 *    MAIN SET four lines below it;
 *  - Dagas read 41.0 EP here and 53.0 EP in the slot picker;
 *  - with a WAR/BRD/BER character loaded the class filter still opened on
 *    "Any class", so 57 of the first 100 names rendered in the red that means
 *    *not for you*.
 *
 * The last of those has two halves and they were fixed in two places. The
 * default view no longer opens on the whole catalog at all, which is what this
 * file asserts below; and when the reader does ask for the whole catalog, §12
 * of `styles.css` inverts which of the two states is the loud one, because at
 * 69 rows in 100 "cannot wear" is the default and a warning colour spent on a
 * default is not a warning. Both halves are asserted together.
 */

import {
  createCharacter, expect, expectCleanText, expectNoHorizontalScroll, test, token,
} from './helpers';

const BLOCKED = 'red';
const USABLE = 'green';
const PLAIN = 'plain';
/**
 * What "cannot wear this" looks like on this table now.
 *
 * `--item-blocked` is still the one brick red everywhere else in the app — the
 * doll's blocked tile, the item window's Requirements lines, `--danger`. On the
 * catalog table §12 of `styles.css` re-points it, because "your trio cannot
 * wear this" is the *normal* state of a 3,533-item catalog: opened to the whole
 * game the page painted 69 of 100 names brick, which is the app's one warning
 * hue spent on saying "default". The emphasis is inverted instead — sage marks
 * the minority you can act on, and the rest recede to `--text-dim`.
 */
const RECEDED = 'receded';

/** Open the browser and wait for `ensureAll` to stop moving the match count. */
async function open(page: import('@playwright/test').Page) {
  await page.goto('/#/items');
  await page.locator('table.data tbody tr, .empty-state').first().waitFor({ timeout: 30_000 });
  const hint = page.locator('.page-head .hint');
  let previous = '';
  for (let i = 0; i < 60; i++) {
    const current = await hint.innerText();
    if (current === previous) return;
    previous = current;
    await page.waitForTimeout(500);
  }
  throw new Error('item catalog never settled');
}

async function search(page: import('@playwright/test').Page, term: string) {
  await page.locator('input[aria-label="Search items"]').fill(term);
  await page.waitForTimeout(1200);
}

/**
 * The rendered colour of every item name on the page, bucketed.
 *
 * Read off computed style rather than off the class list, because the whole
 * point of the finding was what the reader's eye actually meets.
 */
async function nameColours(page: import('@playwright/test').Page) {
  // Resolved from the tokens rather than written out as literals, so a
  // repalette cannot turn this into an assertion about a colour the app no
  // longer has. See `token` in helpers.ts.
  const swatch = {
    red: await token(page, '--item-blocked'),
    green: await token(page, '--item-usable'),
    plain: await token(page, '--text-strong'),
    receded: await token(page, '--text-dim'),
  };
  return page.evaluate((colours) => {
    const tally: Record<string, number> = { red: 0, green: 0, plain: 0, receded: 0, other: 0 };
    for (const tr of document.querySelectorAll('table.data tbody tr')) {
      const button = tr.querySelector('td:first-child button');
      if (!button) continue;
      const colour = getComputedStyle(button).color;
      const hit = Object.entries(colours).find(([, value]) => value === colour);
      if (hit) tally[hit[0]]! += 1;
      else tally.other! += 1;
    }
    return tally;
  }, swatch);
}

const epOf = async (page: import('@playwright/test').Page) =>
  (await page.locator('table.data tbody tr td.num').first().innerText()).trim();

test('a search for a purged item explains the purge instead of blaming the reader', async ({
  page,
}) => {
  await open(page);

  for (const [term, rule, expansion] of [
    ['Ragebringer', 'era:Epic Quests', /epic quest/i],
    ['Jade Mace', 'era:Kunark', /Ruins of Kunark/i],
    ['Wurmslayer', 'era:Kunark', /Ruins of Kunark/i],
  ] as const) {
    await search(page, term);
    const empty = page.locator('.empty-state');
    await expect(empty).toHaveAttribute('data-empty', 'quarantined');
    const text = await empty.innerText();

    expect(text, `${term}: the item is named back`).toContain(term);
    expect(text, `${term}: the pipeline's own rule is cited`).toContain(rule);
    expect(text).toMatch(expansion);
    // The counts come from the pipeline, not from prose.
    /*
     * Read from the payload rather than pinned, because these move whenever the
     * catalog does — and they just did, when EQL Source's measured sightings
     * released 120 items the era purge had been holding.
     */
    const counts = await page.evaluate(async () => {
      const res = await fetch('/quarantine.json');
      return (await res.json()).counts as { shipped: number; quarantined: number };
    });
    expect(text).toContain(counts.shipped.toLocaleString('en-US'));
    expect(text).toContain(counts.quarantined.toLocaleString('en-US'));
    expect(text).toContain('pipeline/quarantine.json');
    // The sentence that told a reader with no filters to loosen one is gone.
    expect(text, `${term}: still blaming the reader`).not.toMatch(/loosen a filter/i);
    await expectCleanText(page);
  }

  // A name nobody has ever heard of is still an honest dead end, and says so.
  await search(page, 'zzzznotathing');
  await expect(page.locator('.empty-state')).toHaveAttribute('data-empty', 'none');
  await expect(page.locator('.empty-state')).toContainText(/no withheld record carries that name/i);

  // And there is a way out of the dead end.
  await page.getByRole('button', { name: /clear search and filters/i }).click();
  await page.waitForTimeout(600);
  await expect(page.locator('table.data tbody tr').first()).toBeVisible();
  await expectNoHorizontalScroll(page);
});

test('the withheld list is not downloaded until a search has already failed', async ({ page }) => {
  const hits: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('quarantine.json')) hits.push(request.url());
  });

  await open(page);
  expect(hits, 'opening the browser must not cost a 174 KB fetch').toEqual([]);

  await search(page, 'Dagas');
  expect(hits, 'a search that finds rows must not cost it either').toEqual([]);

  await search(page, 'Ragebringer');
  await expect(page.locator('.empty-state')).toHaveAttribute('data-empty', 'quarantined');
  expect(hits).toHaveLength(1);

  await search(page, 'Jade Mace');
  await expect(page.locator('.empty-state')).toHaveAttribute('data-empty', 'quarantined');
  expect(hits, 'a second dead search reuses it').toHaveLength(1);
});

test('one item carries one EP across the browser and the slot picker', async ({ page }) => {
  // Regression: ItemBrowser hardcoded PRESET_PROFILES[0] (Melee DPS) and never
  // read the set, so Dagas was 41.0 here and 53.0 in the picker.
  const hash = await createCharacter(page, { name: 'Critic', classes: [0, 7, 15] });

  await open(page);
  await expect(page.locator('select[aria-label="Scoring profile"]')).toHaveValue('set');
  await search(page, 'Dagas');
  const browserEp = await epOf(page);
  expect(browserEp).not.toBe('41.0');

  // The same item, in the picker that ranks with the same weights.
  await page.goto(`/${hash}`);
  await page.locator('.slot-wrap button.slot').first().waitFor();
  const labels = await page.locator('.slot-wrap button.slot .slot-name').allInnerTexts();
  const primary = labels.findIndex((t) => /^primary/i.test(t.trim()));
  expect(primary).toBeGreaterThanOrEqual(0);
  await page.locator('.slot-wrap button.slot').nth(primary).click();
  await page.locator('.modal').waitFor();
  await page.locator('.results .result, .results .empty-state').first().waitFor({ timeout: 30_000 });
  await page.waitForTimeout(1500);
  await page.locator('.modal input[type=search]').first().fill('Dagas');
  await page.waitForTimeout(1200);

  const pickerRow = await page.locator('.results .result').first().innerText();
  expect(pickerRow).toContain('Dagas');
  expect(pickerRow, `browser said ${browserEp}, picker said something else`).toContain(
    `${browserEp} EP`,
  );
  await page.keyboard.press('Escape');
});

test('the class filter opens on the character, and the default page is not a candy stripe', async ({
  page,
}) => {
  await createCharacter(page, { name: 'Critic', classes: [0, 7, 15] });
  await open(page);

  const classes = page.locator('select[aria-label="Filter by class"]');
  await expect(classes).toHaveValue('loadout');
  await expect(classes.locator('option').first()).toContainText('WAR/BRD/BER');

  /*
   * Every row is wearable by construction here, so no name is tinted: a value
   * every row shares is a full-screen tint, not a signal — the reasoning the
   * paper doll already applies. What matters for the art finding is the red
   * count, which was 57 of 100.
   */
  const narrowed = await nameColours(page);
  expect(narrowed[BLOCKED], 'the default view must not open on red').toBe(0);
  expect(narrowed[PLAIN]).toBeGreaterThan(0);
  expect(narrowed[USABLE], 'nor on a hundred identical greens').toBe(0);

  /*
   * Asking for the whole catalog brings the signal back, because it
   * discriminates again — but it comes back *inverted*.
   *
   * This assertion used to read `wide[BLOCKED] > 0`, and it was true: 69 of the
   * first 100 names painted brick. That is the app's one warning hue carrying
   * the majority state of its primary view, which is the frequency at which red
   * stops meaning anything. Sage now marks the minority the trio can act on and
   * the rest recede, so the table discriminates exactly as hard and spends no
   * red doing it.
   */
  await classes.selectOption('any');
  await page.waitForTimeout(1200);
  const wide = await nameColours(page);
  expect(wide[USABLE], 'the whole catalog must still mark what you can wear').toBeGreaterThan(0);
  expect(wide[RECEDED], 'and what you cannot must recede rather than shout').toBeGreaterThan(0);
  expect(wide[BLOCKED], 'no name on this table may paint the warning red').toBe(0);
  expect(wide[USABLE], 'the marked state is the minority').toBeLessThan(wide[RECEDED]!);

  /*
   * And the signal does not travel on hue alone. WCAG 1.4.1: every sage name
   * carries the word too, so a reader who cannot separate sage from cream reads
   * the same fact.
   */
  const wearable = await page.locator('table.data tbody .cell-wearable').count();
  expect(wearable, 'every wearable name is marked in words as well').toBe(wide[USABLE]);

  await expectCleanText(page);
});

test('the dialog refuses what the picker refuses, and the doll says so in words', async ({
  page,
}) => {
  // A Monk creates the set, so the sash is legally equipped…
  const hash = await createCharacter(page, { name: 'Sasher', classes: [6] });
  await open(page);
  await search(page, 'Golden Sash of Tranquility');
  await page.locator('table.data tbody tr').first().click();
  await expect(page.locator('.modal')).toBeVisible();
  await expect(page.locator('.modal .chip-row .btn').first()).toBeVisible();
  await page.locator('.modal .chip-row .btn').first().click();
  await page.waitForURL(/#\/set\//);
  await expect(page.locator('.slot-item').first()).toBeVisible({ timeout: 30_000 });

  // …and then the loadout changes underneath it, which is how a blocked item
  // legitimately reaches a paper doll.
  await page.goto('/#/characters');
  await page.getByRole('link', { name: /loadout/i }).first().click();
  await page.getByRole('button', { name: /^edit$/i }).first().click();
  await expect(page.locator('.modal')).toBeVisible();
  await page.locator('.modal .class-chip').nth(6).click(); // MNK off
  await page.locator('.modal .class-chip').nth(0).click(); // WAR on
  await page.getByRole('button', { name: /save loadout/i }).click();
  await expect(page.locator('.modal')).toHaveCount(0);

  await page.goto(`/${hash}`);
  await page.locator('.slot-wrap button.slot').first().waitFor();
  await page.waitForTimeout(1500);

  const marker = page.locator('.slot-blocked');
  await expect(marker, 'the doll marked it in colour only').toHaveCount(1);
  await expect(marker).toBeVisible();
  await expect(marker).toHaveText(/can.t equip/i);
  await expect(marker).toHaveAttribute('title', /MNK/);

  const row = page.locator('.slot-wrap', { has: marker });
  await expect(row.locator('button.slot')).toHaveAttribute(
    'aria-label',
    /This loadout cannot equip it/,
  );

  // A marker that clips is not a text affordance. Measured on the row itself,
  // because the doll is the one place in the app where a 34px clip has shipped.
  for (const width of [1600, 1024, 768, 390, 360, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(200);
    const measured = await page.evaluate(() => {
      const el = document.querySelector('.slot-blocked');
      const clipped = [...document.querySelectorAll('.slot-name, .slot-item')]
        .filter((n) => n.scrollWidth > n.clientWidth + 1)
        .map((n) => (n.textContent ?? '').slice(0, 40));
      return {
        visible: Boolean(el && el.getBoundingClientRect().width > 0),
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
        clipped,
      };
    });
    expect(measured.visible, `marker vanished at ${width}px`).toBe(true);
    expect(measured.clipped, `clipped doll text at ${width}px`).toEqual([]);
    expect(measured.scroll, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(
      measured.client + 1,
    );
  }
  await page.setViewportSize({ width: 1440, height: 950 });

  // The browser's dialog now applies the picker's rule to the same item.
  await open(page);
  await page.locator('select[aria-label="Filter by class"]').selectOption('any');
  await search(page, 'Golden Sash of Tranquility');
  await page.locator('table.data tbody tr').first().click();
  await expect(page.locator('.modal')).toBeVisible();
  await expect(page.locator('.modal')).toContainText(/this loadout cannot equip it/i);
  await expect(
    page.locator('.modal .chip-row .btn'),
    'the window says it cannot and the dialog offered it anyway',
  ).toHaveCount(0);
  await expect(page.locator('.modal [data-blocked="equip"]')).toContainText('MNK');
  await expectCleanText(page);
  await expectNoHorizontalScroll(page);
});
