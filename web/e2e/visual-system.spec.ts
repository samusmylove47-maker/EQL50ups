/**
 * The visual system, asserted.
 *
 * Every check here corresponds to a defect a reviewer measured with computed
 * styles rather than with the DOM, which is how each one survived several
 * passes. They are cheap and they are the kind of thing that decays silently.
 */

import { createCharacter, expect, openSlotPicker, test } from './helpers';

/** The type scale declared in `styles/tokens.css`. Nothing else may render. */
const TYPE_SCALE = ['10px', '11px', '13px', '15px', '20px', '30px', '44px'];
const WEIGHTS = ['400', '600', '800'];

const ACCENT = 'rgb(59, 159, 232)';
const USABLE = 'rgb(78, 192, 106)';

async function filledSet(page: import('@playwright/test').Page): Promise<void> {
  page.on('dialog', (d) => d.accept());
  await createCharacter(page, { name: 'Avenrae', classes: [0, 1, 15], level: '50' });
  await page.getByRole('button', { name: /auto-fill/i }).click();
  await expect(page.locator('.slot-wrap .slot.filled')).toHaveCount(23, { timeout: 60_000 });
}

test('the accent is signal: no slot glyph is stroked in azure', async ({ page }) => {
  await filledSet(page);

  // 48 of these once, against 5 azure words — a 10:1 decoration-to-signal
  // ratio on the one colour reserved for what you act on.
  const azureStrokes = await page.evaluate(
    (accent) =>
      [...document.querySelectorAll('svg *')].filter(
        (el) => getComputedStyle(el).stroke === accent,
      ).length,
    ACCENT,
  );
  expect(azureStrokes, 'azure SVG strokes on the gear tab').toBe(0);
});

test('the doll tints the name only, and only when the tint means something', async ({ page }) => {
  await filledSet(page);

  const audit = await page.evaluate(() => ({
    names: [...document.querySelectorAll('.slot-item')].map((e) => getComputedStyle(e).color),
    glyphStrokes: [...document.querySelectorAll('.doll svg *')].map(
      (e) => getComputedStyle(e).stroke,
    ),
    tiles: [...document.querySelectorAll('.figure-cell.on')].map(
      (e) => getComputedStyle(e).borderTopColor,
    ),
  }));

  // Auto-fill only ever places equippable items, so a usability tint here can
  // take exactly one value — which is a full-screen wash, not a signal.
  expect(new Set(audit.names).size, 'the doll should not paint 23 names one colour that varies never').toBe(1);
  expect(audit.names[0], 'usable names render as ordinary strong text').not.toBe(USABLE);
  expect(audit.glyphStrokes.filter((c) => c === USABLE), 'glyphs carry no item colour').toEqual([]);
  expect(audit.tiles.filter((c) => c === USABLE), 'tile borders carry no item colour').toEqual([]);
});

test('the +N chip is tinted by tier, so the differentiator is visible at rest', async ({ page }) => {
  await filledSet(page);

  const first = page.locator('.stepper .value').first();
  const seen: string[] = [];
  for (const tier of [0, 3, 7, 10]) {
    await first.click();
    await page.keyboard.press('Home');
    for (let i = 0; i < tier; i += 1) await page.keyboard.press('ArrowUp');
    await expect(first).toHaveAttribute('data-tier', String(tier));
    seen.push(await first.evaluate((e) => getComputedStyle(e).color));
  }
  expect(new Set(seen).size, 'four tiers should not share one colour').toBe(seen.length);
});

test('the equipment map is a summary: one tab stop, arrow keys inside it', async ({ page }) => {
  await filledSet(page);

  const cells = page.locator('.figure-body button');
  await expect(cells).toHaveCount(23);

  // 46 `Change item` buttons with byte-identical accessible names is the whole
  // set announced twice and 23 surplus tab stops across the middle of the doll.
  const stops = await cells.evaluateAll((els) => els.filter((e) => e.tabIndex >= 0).length);
  expect(stops, 'the map is one composite widget').toBe(1);
  expect(await page.locator('button[aria-label*="Change item"]').count()).toBe(23);

  await cells.first().focus();
  const start = await page.evaluate(() => document.activeElement?.getAttribute('data-pos'));
  await page.keyboard.press('ArrowRight');
  const right = await page.evaluate(() => document.activeElement?.getAttribute('data-pos'));
  expect(right).not.toBe(start);
  await page.keyboard.press('ArrowDown');
  const down = await page.evaluate(() => document.activeElement?.getAttribute('data-pos'));
  expect(down).not.toBe(right);
  await page.keyboard.press('End');
  expect(await page.evaluate(() => document.activeElement?.getAttribute('data-pos'))).toBe('ANY_2');

  // Clicking still opens the picker for that position.
  await page.locator('.figure-body button[data-pos="HEAD"]').click();
  await expect(page.locator('.modal-head h2')).toHaveText(/head/i);
});

test('every rendered size and weight comes off the declared scale', async ({ page }) => {
  await filledSet(page);

  const type = await page.evaluate(() => {
    const sizes: Record<string, number> = {};
    const weights: Record<string, number> = {};
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walk.nextNode())) {
      if (!node.textContent?.trim()) continue;
      const el = node.parentElement;
      if (!el || !el.offsetParent) continue;
      const cs = getComputedStyle(el);
      sizes[cs.fontSize] = (sizes[cs.fontSize] ?? 0) + 1;
      weights[cs.fontWeight] = (weights[cs.fontWeight] ?? 0) + 1;
    }
    return { sizes: Object.keys(sizes), weights: Object.keys(weights) };
  });

  expect(type.sizes.filter((s) => !TYPE_SCALE.includes(s)), 'off-scale font sizes').toEqual([]);
  expect(type.weights.filter((w) => !WEIGHTS.includes(w)), 'off-scale font weights').toEqual([]);
});

test('text inputs and checkboxes focus at a ring you can see', async ({ page }) => {
  await createCharacter(page);
  await openSlotPicker(page, 0);

  // `input:focus` at (0,1,1) used to beat the token ring's `:where()` at
  // (0,1,0), leaving every input on a 14%-alpha shadow: 1.24:1 against 3:1.
  const search = page.locator('.picker-controls input[type=search]').first();
  await search.focus();
  await expect(search).toHaveCSS('box-shadow', `${ACCENT} 0px 0px 0px 2px`);

  /*
   * Tabbed to, not focused programmatically: `:focus-visible` on a checkbox
   * only matches after a keyboard interaction, and a keyboard interaction is
   * the only way anyone reaches these two 15px boxes anyway. They had no
   * border to fall back on, so before this they showed nothing at all.
   */
  for (let i = 0; i < 8; i += 1) {
    const tag = await page.evaluate(() => {
      const el = document.activeElement as HTMLInputElement | null;
      return el?.tagName === 'INPUT' && el.type === 'checkbox' ? 'checkbox' : 'other';
    });
    if (tag === 'checkbox') break;
    await page.keyboard.press('Tab');
  }
  const ring = await page.evaluate(() => {
    const el = document.activeElement as HTMLInputElement;
    const cs = getComputedStyle(el);
    return { type: el.type, outline: cs.outlineWidth, colour: cs.outlineColor, accent: cs.accentColor };
  });
  expect(ring.type).toBe('checkbox');
  expect(parseFloat(ring.outline)).toBeGreaterThanOrEqual(2);
  expect(ring.colour).toBe(ACCENT);
  expect(ring.accent).toBe(ACCENT);
});
