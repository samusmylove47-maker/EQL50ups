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

/*
 * The palette, as `styles/tokens.css` declares it after the eqlsource re-skin
 * (`research/DESIGN-EQLSOURCE.md`). Azure #3b9fe8 became the doc's steel blue
 * and the client's usable-item green became its sage; both still do exactly the
 * jobs asserted below, which is why these are constants rather than deletions.
 */
const ACCENT = 'rgb(117, 149, 184)';
const USABLE = 'rgb(143, 174, 130)';

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

/**
 * The type audit, run per screen.
 *
 * It used to run on the gear tab only — which is the one screen where
 * `table.data th`, `table.data th button` and `.feature h3` are all absent, so
 * it could never see the fourth, UA-default weight those three shipped. Three
 * critics counted three weights from the gear tab and were all wrong.
 */
async function typeAudit(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const sizes: Record<string, number> = {};
    const weights: Record<string, number> = {};
    const offenders: string[] = [];
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walk.nextNode())) {
      if (!node.textContent?.trim()) continue;
      const el = node.parentElement;
      if (!el || !el.offsetParent) continue;
      const cs = getComputedStyle(el);
      sizes[cs.fontSize] = (sizes[cs.fontSize] ?? 0) + 1;
      weights[cs.fontWeight] = (weights[cs.fontWeight] ?? 0) + 1;
      if (!['400', '600', '800'].includes(cs.fontWeight) || !cs.fontSize.endsWith('px')) {
        offenders.push(`${cs.fontWeight}/${cs.fontSize} on ${el.tagName}.${el.className}`);
      }
    }
    return { sizes: Object.keys(sizes), weights: Object.keys(weights), offenders: [...new Set(offenders)] };
  });
}

test('every rendered size and weight comes off the declared scale — on all three screens', async ({
  page,
}) => {
  test.slow();
  await filledSet(page);

  const screens: Array<[string, () => Promise<unknown>]> = [
    ['gear tab', async () => undefined],
    [
      'item browser',
      async () => {
        await page.goto('/#/items');
        await page.locator('table.data tbody tr').first().waitFor({ timeout: 30_000 });
        await page.waitForTimeout(1500);
      },
    ],
    [
      'landing page',
      async () => {
        await page.goto('/#/');
        await page.waitForTimeout(800);
      },
    ],
  ];

  for (const [name, go] of screens) {
    await go();
    const type = await typeAudit(page);
    expect(type.sizes.filter((s) => !TYPE_SCALE.includes(s)), `off-scale font sizes on the ${name}`).toEqual([]);
    expect(
      type.weights.filter((w) => !WEIGHTS.includes(w)),
      `off-scale font weights on the ${name}: ${type.offenders.join(' | ')}`,
    ).toEqual([]);
  }
});

/**
 * Is the focus ring this element declares actually drawn, or is it clipped away
 * by an ancestor?
 *
 * `.stat-group { overflow: hidden }` plus a positive `outline-offset` put the
 * ring entirely outside the clipping parent's padding box, so a control with a
 * perfectly good 2px azure outline rendered zero azure pixels. Computed styles
 * cannot see that; geometry can. Only ancestors that clip unconditionally
 * (`hidden` / `clip`) count, and only for elements that themselves fit inside
 * that ancestor — a row scrolled halfway out of a list is not this bug.
 */
const RING_PROBE = `(() => {
  const ACCENT = 'rgb(117, 149, 184)';
  const el = document.activeElement;
  if (!el || el === document.body) return null;
  const cs = getComputedStyle(el);
  const r = el.getBoundingClientRect();

  // Each way the app can draw a ring, with how far outside the border box it
  // reaches. An inset shadow and a negative outline offset both reach nowhere,
  // which is the whole point of the fix.
  const rings = [];
  if (!/none/.test(cs.outlineStyle) && parseFloat(cs.outlineWidth) > 0 && cs.outlineColor === ACCENT) {
    rings.push({ kind: 'outline', reach: (parseFloat(cs.outlineOffset) || 0) + parseFloat(cs.outlineWidth) });
  }
  const shadow = cs.boxShadow && cs.boxShadow !== 'none' ? cs.boxShadow : '';
  if (shadow.includes(ACCENT)) {
    const lengths = (shadow.match(/-?[\\d.]+px/g) || []).map((l) => Math.abs(parseFloat(l)));
    rings.push({ kind: 'shadow', reach: shadow.includes('inset') ? 0 : Math.max(0, ...lengths) });
  }

  // Ancestors that clip unconditionally. A scroll container that has scrolled
  // the element itself half out of view is a different thing, so an element
  // that does not already fit is skipped.
  const clippers = [];
  for (let p = el.parentElement; p; p = p.parentElement) {
    const ps = getComputedStyle(p);
    if (!/hidden|clip/.test(ps.overflowX) && !/hidden|clip/.test(ps.overflowY)) continue;
    const pr = p.getBoundingClientRect();
    const box = {
      top: pr.top + parseFloat(ps.borderTopWidth),
      left: pr.left + parseFloat(ps.borderLeftWidth),
      right: pr.right - parseFloat(ps.borderRightWidth),
      bottom: pr.bottom - parseFloat(ps.borderBottomWidth),
    };
    if (!(r.top >= box.top - 0.5 && r.bottom <= box.bottom + 0.5
       && r.left >= box.left - 0.5 && r.right <= box.right + 0.5)) continue;
    clippers.push({ box, who: \`\${p.tagName}.\${String(p.className).slice(0, 30)}\` });
  }

  const survivors = [];
  const losses = [];
  for (const ring of rings) {
    const rect = { top: r.top - ring.reach, left: r.left - ring.reach,
                   right: r.right + ring.reach, bottom: r.bottom + ring.reach };
    let lost = null;
    for (const c of clippers) {
      const edges = [];
      if (rect.top < c.box.top - 0.5) edges.push('top');
      if (rect.bottom > c.box.bottom + 0.5) edges.push('bottom');
      if (rect.left < c.box.left - 0.5) edges.push('left');
      if (rect.right > c.box.right + 0.5) edges.push('right');
      if (edges.length) lost = \`\${ring.kind} \${edges.join('+')} clipped by \${c.who}\`;
    }
    if (lost) losses.push(lost); else survivors.push(ring.kind);
  }

  // Marked so the walk can tell "wrapped back to the start" from "another
  // control that happens to share a class name" — 23 slot buttons do.
  const already = el.hasAttribute('data-ring-walked');
  el.setAttribute('data-ring-walked', '1');

  return {
    where: \`\${el.tagName}.\${String(el.className).slice(0, 40)}\`,
    isStatGroup: el.matches('.stat-group > summary'),
    already, rings: rings.length, survivors, losses,
  };
})()`;

test('every keyboard stop on the gear tab focuses at a ring that is really drawn', async ({
  page,
}) => {
  test.slow();
  await filledSet(page);
  await page.locator('body').click({ position: { x: 2, y: 2 } });

  const seen: string[] = [];
  const summaries: string[] = [];
  const clipped: string[] = [];
  const ringless: string[] = [];
  let statGroups = 0;

  /*
   * One complete pass of the document's tab order, rather than two sampled
   * controls. The previous version reached the picker's search box and one
   * checkbox, so it could never land on a `<summary>` — which is exactly where
   * the broken ring was, on the app's default screen. The walk stops when it
   * wraps back to a control it has already marked.
   */
  for (let i = 0; i < 220; i += 1) {
    await page.keyboard.press('Tab');
    const probe = await page.evaluate(RING_PROBE);
    if (!probe) continue;
    if (probe.already) break;
    seen.push(probe.where);
    if (probe.where.startsWith('SUMMARY')) summaries.push(probe.where);
    if (probe.isStatGroup) statGroups += 1;
    if (!probe.rings) ringless.push(`${probe.where} — no accent outline and no accent shadow`);
    // A control may declare two rings; it only needs one of them to survive.
    else if (!probe.survivors.length) clipped.push(`${probe.where}: ${probe.losses.join(', ')}`);
  }

  expect(seen.length, 'the walk should cross the whole gear page').toBeGreaterThan(60);
  expect(summaries.length, 'the walk must reach <summary> elements').toBeGreaterThan(2);
  expect(statGroups, 'the walk must reach the stat sheet disclosures').toBeGreaterThan(0);
  expect(ringless, 'focusable controls with no visible ring').toEqual([]);
  expect(clipped, 'focus rings drawn outside a clipping ancestor').toEqual([]);
});

test('the stat sheet disclosure rings on all four edges, open and closed', async ({ page }) => {
  await filledSet(page);

  // The measurement that mattered: azure pixels around the summary, counted off
  // a screenshot. A computed `outline-width: 2px` was true the whole time it was
  // rendering nothing.
  for (const open of [false, true]) {
    await page.evaluate((wanted) => {
      for (const d of document.querySelectorAll<HTMLDetailsElement>('details.stat-group')) {
        d.open = wanted;
      }
    }, open);
    await page.locator('body').click({ position: { x: 2, y: 2 } });

    let reached = false;
    for (let i = 0; i < 160 && !reached; i += 1) {
      await page.keyboard.press('Tab');
      reached = await page.evaluate(() => document.activeElement?.matches('.stat-group > summary') ?? false);
    }
    expect(reached, `could not tab to a ${open ? 'open' : 'closed'} stat group`).toBe(true);

    const box = await page.evaluate(() => {
      const r = document.activeElement!.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    });
    const pad = 6;
    const shot = (
      await page.screenshot({
        clip: {
          x: Math.max(0, box.x - pad),
          y: Math.max(0, box.y - pad),
          width: box.width + pad * 2,
          height: box.height + pad * 2,
        },
      })
    ).toString('base64');

    const bands = await page.evaluate(
      async ({ shot, pad }) => {
        const img = new Image();
        img.src = `data:image/png;base64,${shot}`;
        await img.decode();
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        // The steel blue of `--accent`, per channel, with the same ±40 slack.
        const accent = (i: number) =>
          Math.abs(data[i]! - 117) < 40 && Math.abs(data[i + 1]! - 149) < 40 && Math.abs(data[i + 2]! - 184) < 40;
        const out = { top: 0, bottom: 0, left: 0, right: 0 };
        for (let y = 0; y < canvas.height; y += 1) {
          for (let x = 0; x < canvas.width; x += 1) {
            const i = (y * canvas.width + x) * 4;
            if (!accent(i)) continue;
            if (y < pad + 3) out.top += 1;
            if (y > canvas.height - pad - 4) out.bottom += 1;
            if (x < pad + 3) out.left += 1;
            if (x > canvas.width - pad - 4) out.right += 1;
          }
        }
        return out;
      },
      { shot, pad },
    );

    for (const edge of ['top', 'bottom', 'left', 'right'] as const) {
      expect(bands[edge], `${edge} edge of the ${open ? 'open' : 'closed'} summary ring`).toBeGreaterThan(10);
    }
  }
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

/**
 * Clipping, measured from the rendered text rather than from `scrollWidth`.
 *
 * `scrollWidth === clientWidth` is structurally blind: it is equal whenever the
 * element has already been shrunk to its container, which is exactly what
 * happens on a narrow doll. This unclamps the element in place, reads the
 * height and width the content actually wants, restores it, and compares.
 */
const CLIP_PROBE = `(() => {
  const out = [];
  for (const el of document.querySelectorAll('.slot-item, .slot-stats, .slot-name')) {
    if (!el.offsetParent) continue;
    const text = (el.textContent || '').trim();
    if (!text) continue;
    const shown = el.getBoundingClientRect().height;
    const previous = el.getAttribute('style') || '';
    el.style.webkitLineClamp = 'unset';
    el.style.display = 'block';
    el.style.overflow = 'visible';
    const wantedHeight = el.getBoundingClientRect().height;
    const wantedWidth = el.scrollWidth;
    el.setAttribute('style', previous);
    if (wantedHeight > shown + 1 || wantedWidth > el.clientWidth + 1) {
      out.push(\`\${el.className}: "\${text.slice(0, 44)}"\`);
    }
  }
  return out;
})()`;

test('no doll row clips its own text at any width down to 360px', async ({ page }) => {
  test.slow();
  await filledSet(page);

  // 768px was the worst breakpoint in the app: the doll kept two columns there,
  // so `.slot-body` measured 152px — less than the 166px the same row gets on a
  // 390px phone — and 6 names plus 19 stat lines were cut, several inside a
  // numeral.
  const widths = [1600, 1280, 1100, 1024, 900, 768, 600, 430, 390, 360];
  const bodies: Record<number, number> = {};
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(250);
    const clips = await page.evaluate(CLIP_PROBE);
    bodies[width] = await page.evaluate(() =>
      Math.round(document.querySelector('.slot-body')!.getBoundingClientRect().width),
    );
    expect(clips, `clipped text at ${width}px (slot body ${bodies[width]}px)`).toEqual([]);
  }

  // And tablet portrait may never be tighter than a phone again.
  expect(bodies[768], '768px must not be narrower than 390px').toBeGreaterThan(bodies[390]!);
  await page.setViewportSize({ width: 1440, height: 950 });
});

test('the equipment map narrows at the head and again at the feet', async ({ page }) => {
  await filledSet(page);

  // Two comments asserted this silhouette while the measured row extents were
  // 152 / 48 / 256 / 256 / 256 / 152 / 256 — flat at the bottom, because the two
  // Any Slots sat in the outer columns at ankle level.
  const extents = await page.evaluate(() => {
    const rows = new Map<number, { left: number; right: number }>();
    for (const cell of document.querySelectorAll('.figure-body button')) {
      const r = cell.getBoundingClientRect();
      const key = Math.round(r.top);
      const row = rows.get(key) ?? { left: Infinity, right: -Infinity };
      rows.set(key, { left: Math.min(row.left, r.left), right: Math.max(row.right, r.right) });
    }
    return [...rows.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, r]) => Math.round(r.right - r.left));
  });

  expect(extents.length, 'seven anatomical rows').toBe(7);
  const widest = Math.max(...extents);
  expect(extents[0], 'the head is narrower than the shoulders').toBeLessThan(widest);
  expect(extents[extents.length - 1], 'the feet are narrower than the shoulders').toBeLessThan(widest);
  expect(extents[extents.length - 1], 'the feet are no wider than the legs above them').toBeLessThanOrEqual(
    extents[extents.length - 2]!,
  );
});
