/**
 * The visual system, asserted.
 *
 * Every check here corresponds to a defect a reviewer measured with computed
 * styles rather than with the DOM, which is how each one survived several
 * passes. They are cheap and they are the kind of thing that decays silently.
 */

import { createCharacter, expect, openSlotPicker, test } from './helpers';

/**
 * The type scale declared in `styles/tokens.css`. Nothing else may render.
 *
 * 17px is `--fs-heading`, added when an audit found the item browser rendering
 * 660 text runs of which one was ≥16px and none were in the heading face: the
 * scale ran 15px → 20px with the card title at the bottom of that gap and
 * nothing for the name of the thing a row is *about*. It is a step on the
 * scale, not an exception to it — the assertion below is what keeps it one.
 */
/*
 * The reading and data tiers are fixed; the display tier is fluid.
 *
 * `--fs-large`, `--fs-title` and `--fs-hero` are `clamp()` now, because
 * eqlsource.com's whole display tier is — 25 clamps in their stylesheet against
 * 0 in ours, and the consequence was measurable: their interior h1 renders
 * 72–78px at 1440 where ours rendered 30px, so the name of a page weighed the
 * same as one statistic printed beneath it.
 *
 * A closed list of pixel values cannot describe that, and loosening the
 * assertion to "anything goes above 20px" would delete the check. So the
 * allowed display sizes are READ OUT OF THE TOKENS at runtime: whatever those
 * three clamps resolve to at this viewport is legal, and nothing else is. The
 * scale stays closed; it is just no longer constant.
 *
 * The fixed tiers stay fixed on purpose. A table of numbers that reflows its
 * own type is harder to read, not easier.
 */
/*
 * 18.5px is `--fs-mark`, and only the masthead wordmark may render it. It is a
 * step rather than an exception for the same reason 17px is: it is declared in
 * `tokens.css` and listed here, so a stray 18.5px anywhere else fails this
 * assertion rather than passing as "near enough the heading size".
 *
 * It exists because `--fs-heading` was sizing the wordmark and item names at
 * once, and the two want opposite things — see the note at the token.
 */
const TYPE_SCALE_FIXED = ['10px', '11px', '13px', '15px', '17px', '18.5px'];
const FLUID_TOKENS = ['--fs-large', '--fs-title', '--fs-hero'];

async function typeScaleFor(page: import('@playwright/test').Page): Promise<string[]> {
  const fluid = await page.evaluate((tokens) => {
    const probe = document.createElement('span');
    probe.style.position = 'absolute';
    probe.style.visibility = 'hidden';
    document.body.append(probe);
    const out = tokens.map((token) => {
      probe.style.fontSize = `var(${token})`;
      return getComputedStyle(probe).fontSize;
    });
    probe.remove();
    return out;
  }, FLUID_TOKENS);
  return [...new Set([...TYPE_SCALE_FIXED, ...fluid])];
}
const WEIGHTS = ['400', '600', '800'];

/*
 * The palette, as `styles/tokens.css` declares it after the eqlsource re-skin
 * (`research/DESIGN-EQLSOURCE.md`). Azure #3b9fe8 became the doc's steel blue
 * and the client's usable-item green became its sage; both still do exactly the
 * jobs asserted below, which is why these are constants rather than deletions.
 */
const ACCENT = 'rgb(117, 149, 184)';
const USABLE = 'rgb(143, 174, 130)';

/** Create a filled 23-slot set and return its id. */
async function filledSet(page: import('@playwright/test').Page): Promise<string> {
  page.on('dialog', (d) => d.accept());
  const hash = await createCharacter(page, { name: 'Avenrae', classes: [0, 1, 15], level: '50' });
  await page.getByRole('button', { name: /auto-fill/i }).click();
  await expect(page.locator('.slot-wrap .slot.filled')).toHaveCount(23, { timeout: 60_000 });
  return hash.replace('#/set/', '');
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
  /*
   * The two assertions below are "none of this collection is tinted", which is
   * satisfied by an empty collection — so a selector that stops matching would
   * turn them into passes rather than failures. `names` is already protected by
   * the `toBe(1)` above; these two were not.
   */
  expect(audit.glyphStrokes.length, 'no glyphs found — the strokes assertion would be vacuous')
    .toBeGreaterThan(0);
  expect(audit.tiles.length, 'no filled cells found — the tiles assertion would be vacuous')
    .toBeGreaterThan(0);
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
    return {
      sizes: Object.keys(sizes),
      weights: Object.keys(weights),
      offenders: [...new Set(offenders)],
      /*
       * How many text runs were actually walked.
       *
       * Without this the audit below is `[].filter(…)` on a screen that failed
       * to render — every off-scale assertion is satisfied by having measured
       * nothing, and the suite reports a pass. That is the shape of the defect
       * found in the drift checks on 18 Aug, and this file is where it would do
       * the most damage: it is the only thing standing between the type scale
       * and a screen quietly rendering whatever it likes.
       */
      runs: Object.values(sizes).reduce((a, b) => a + b, 0),
    };
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
    const scale = await typeScaleFor(page);
    /*
     * The audit measured something.
     *
     * Counts printed by this test on 2026-08-20 at 1440x950: landing page 147
     * runs, gear tab 495, item browser 724. The floor is 40 — comfortably under
     * the smallest, so catalog growth and copy edits do not brush it, and far
     * enough above zero to catch a screen that rendered nothing. Without it the
     * two assertions below are `[].filter(…)`, which passes.
     */
    expect(type.runs, `the ${name} rendered nothing to audit`).toBeGreaterThan(40);
    expect(
      type.sizes.filter((s) => !scale.includes(s)),
      `off-scale font sizes on the ${name} (scale: ${scale.join(', ')})`,
    ).toEqual([]);
    expect(
      type.weights.filter((w) => !WEIGHTS.includes(w)),
      `off-scale font weights on the ${name}: ${type.offenders.join(' | ')}`,
    ).toEqual([]);
  }
});

/**
 * The four type roles, counted where the product is.
 *
 * An art review walked every visible text node and found the roles doing no
 * work on the two screens that *are* the app: the item browser rendered 660
 * runs of which **one** was ≥16px and **none** were in the heading face, 528 of
 * them at 13px; the set editor managed one heading run in 430. The heading role
 * was bound to six card and dialog titles and the item name — the most
 * important text in a gear planner — was not one of them.
 *
 * This asserts the shape of the fix rather than a count that will drift with
 * the catalog: on every surface that lists items, the *name* is in the heading
 * face at the heading step, and it out-sizes the stat line beside it.
 */
async function nameRole(page: import('@playwright/test').Page, selector: string) {
  return page.locator(selector).first().evaluate((el) => {
    const cs = getComputedStyle(el);
    return { family: cs.fontFamily, size: parseFloat(cs.fontSize), weight: cs.fontWeight };
  });
}

test('the item name carries the heading role on every surface that lists items', async ({
  page,
}) => {
  test.slow();
  await filledSet(page);

  // The doll.
  const doll = await nameRole(page, '.slot-item');
  expect(doll.family, 'doll row name').toMatch(/Saira Condensed/);
  expect(doll.size, 'doll row name').toBe(17);

  // The picker.
  await openSlotPicker(page, 0);
  const picker = await nameRole(page, '.result-name .iname');
  expect(picker.family, 'picker row name').toMatch(/Saira Condensed/);
  expect(picker.size, 'picker row name').toBe(17);
  // A dialog title must out-rank the rows it introduces; at `--fs-mid` it did not.
  const title = await nameRole(page, '.modal-head h2');
  expect(title.size, 'the picker title sits above its rows').toBeGreaterThan(picker.size);
  await page.keyboard.press('Escape');

  // The browser.
  await page.goto('/#/items');
  await page.locator('table.data tbody tr').first().waitFor({ timeout: 30_000 });
  await page.waitForTimeout(1200);
  const browser = await nameRole(page, 'table.data tbody .cell-item .iname');
  expect(browser.family, 'browser row name').toMatch(/Saira Condensed/);
  expect(browser.size, 'browser row name').toBe(17);

  // …and it is not one run in six hundred. Every name on the page has it.
  const audit = await page.evaluate(() => {
    const runs = [...document.querySelectorAll<HTMLElement>('table.data tbody .cell-item .iname')];
    return {
      total: runs.length,
      heading: runs.filter((el) => /Saira Condensed/.test(getComputedStyle(el).fontFamily)).length,
    };
  });
  expect(audit.total, 'a full page of rows').toBeGreaterThan(50);
  expect(audit.heading, 'every item name is in the heading face').toBe(audit.total);
});

/**
 * Every enabled text run clears WCAG AA against the background actually behind
 * it.
 *
 * Declared colours are not what a reader meets: an ancestor's `opacity` and a
 * translucent panel both change the number, and neither is visible to a check
 * that reads `color` alone. `.cmp-slot.quiet` was `opacity: 0.55` over
 * `--text-faint` — a token documented at 4.57:1 — and landed **316 runs on the
 * compare screen at 2.21–3.22:1**, invisible to every earlier audit because
 * every one of them read the declared hex. This composites the whole ancestor
 * chain, both colour and alpha, and it is why the recession on that screen is
 * done with colours rather than with alpha.
 */
const CONTRAST_PROBE = `(() => {
  const parse = (s) => {
    const m = String(s).match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    const p = m[1].split(/[,\\s\\/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const over = (f, b) => ({
    r: f.r * f.a + b.r * (1 - f.a),
    g: f.g * f.a + b.g * (1 - f.a),
    b: f.b * f.a + b.b * (1 - f.a),
    a: 1,
  });
  const lum = (c) => {
    const f = (v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const ratio = (a, b) => {
    const l1 = lum(a), l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };

  // Composite every painted background from the element up to the root, then
  // the page's own black underneath.
  const groundOf = (el) => {
    const stack = [];
    for (let n = el; n; n = n.parentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0) stack.push(c);
    }
    stack.push({ r: 0, g: 0, b: 0, a: 1 });
    let acc = stack[stack.length - 1];
    for (let i = stack.length - 2; i >= 0; i--) acc = over(stack[i], acc);
    return acc;
  };
  const alphaOf = (el) => {
    let o = 1;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const v = parseFloat(getComputedStyle(n).opacity);
      if (!Number.isNaN(v)) o *= v;
    }
    return o;
  };

  const bad = [];
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node, seen = 0;
  while ((node = walk.nextNode())) {
    const text = (node.nodeValue || '').trim();
    if (!text) continue;
    const el = node.parentElement;
    if (!el || !el.offsetParent) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden') continue;
    const box = el.getBoundingClientRect();
    if (box.width < 1 || box.height < 1) continue;

    // A control the reader cannot operate is exempt (WCAG 1.4.3), and so is
    // anything faded almost out — those are states, not text.
    const alpha = alphaOf(el);
    if (alpha < 0.5) continue;
    if (el.closest('[disabled],[aria-disabled="true"],:disabled')) continue;

    const raw = parse(cs.color) || { r: 255, g: 255, b: 255, a: 1 };
    const ground = groundOf(el);
    const ink = over({ ...raw, a: raw.a * alpha }, ground);
    const size = parseFloat(cs.fontSize);
    const weight = Number(cs.fontWeight);
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const r = ratio(ink, ground);
    seen += 1;
    if (r < (large ? 3 : 4.5)) {
      bad.push(\`\${r.toFixed(2)}:1 \${size}px "\${text.slice(0, 28)}" on \${el.tagName}.\${String(el.className).slice(0, 30)}\`);
    }
  }
  return { seen, bad: [...new Set(bad)].slice(0, 12) };
})()`;

test('no enabled text run on any product screen is below WCAG AA', async ({ page }) => {
  test.slow();
  const first = await filledSet(page);

  /*
   * Raise the whole set off +0 before measuring anything.
   *
   * `filledSet` auto-fills at +0, and the first exaltation socket unlocks at
   * +1 — so the exaltations screen this sweep had been measuring rendered
   * *zero* sockets ("23 waiting on +N") and the entire socket UI, 92 elements
   * on a +5 set, was never composited by any assertion here. That blind spot
   * hid `.donor.none` at 4.29:1 through a whole review round. A fixture that
   * cannot reach a state is a state nobody is testing.
   */
  await page.locator('.bulk-tiers button', { hasText: /^\+5$/ }).click();
  await page.waitForTimeout(600);

  // A second set, so the diff has both sides and its 22 unchanged rows render.
  await page.locator('summary[aria-label="More set actions"]').click();
  await page.locator('.menu-body.right .menu-item', { hasText: 'Duplicate set' }).click();
  await expect(page.locator('.set-switch .name')).toHaveText('Main Set (copy)');
  const second = new URL(page.url()).hash.replace('#/set/', '');

  /*
   * Each screen names the row a pointer can land on, because contrast is a
   * property of a *state*, not of a stylesheet. `.slot-stats` measured 4.57:1
   * at rest and 4.29:1 under the hover that lifts its row's ground — sub-AA on
   * all 23 doll rows, invisible to every audit that only ever looked at the
   * page sitting still.
   */
  const screens: Array<[string, () => Promise<unknown>, string?]> = [
    ['gear tab', async () => {
      await page.goto(`/#/set/${first}`);
      await expect(page.locator('.slot-wrap .slot.filled').first()).toBeVisible();
    }, '.slot-wrap'],
    ['exaltations', async () => {
      await page.goto(`/#/set/${first}/exaltations`);
      await expect(page.locator('.socket').first()).toBeVisible();
      await page.waitForTimeout(900);
    }, '.socket'],
    ['weights', async () => {
      await page.goto(`/#/set/${first}/weights`);
      await page.waitForTimeout(600);
    }],
    ['compare', async () => {
      await page.goto(`/#/set/${first}/compare/${second}`);
      await expect(page.locator('.cmp-slots')).toBeVisible();
      await page.waitForTimeout(600);
    }],
    ['item browser', async () => {
      await page.goto('/#/items');
      await page.locator('table.data tbody tr').first().waitFor({ timeout: 30_000 });
      await page.waitForTimeout(1500);
    }, 'table.data tbody tr'],
    /*
     * The two screens this round added. Neither was in this list, which is why
     * `.upg-arrow` shipped at 3.22:1 — a new screen is exactly where an
     * unmeasured colour lands, so the list grows with the app.
     */
    ['upgrades', async () => {
      await page.goto(`/#/set/${first}/upgrades`);
      await expect(page.locator('.upg-row').first()).toBeVisible({ timeout: 60_000 });
      await page.waitForTimeout(600);
    }, '.upg-row'],
    ['sources', async () => {
      await page.goto('/#/sources');
      await expect(page.locator('.src-card').first()).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(800);
    }, '.src-card'],
    ['landing', async () => {
      await page.goto('/#/');
      await page.waitForTimeout(800);
    }],
  ];

  for (const [name, go, hoverable] of screens) {
    await go();
    const result = await page.evaluate(CONTRAST_PROBE);
    expect(result.seen, `${name} should have text to measure`).toBeGreaterThan(20);
    expect(result.bad, `sub-AA text on the ${name}`).toEqual([]);

    /*
     * And again narrow, because a control that only exists at one width is
     * only audited at that width.
     *
     * This sweep ran at the project's 1440-wide default for two rounds and
     * reported zero. The masthead's `.burger` is `display: none` above 760px,
     * so it was never in a single measurement — and it shipped with no
     * `background` at all, which meant Chromium's `ButtonFace`
     * (`rgb(107,107,107)` under `color-scheme: dark`) under `--text-dim`:
     * **2.32:1, on every screen in the app, below 760px.** A zero from a sweep
     * that cannot see half the components is not a zero.
     */
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(250);
    const narrow = await page.evaluate(CONTRAST_PROBE);
    expect(narrow.seen, `${name} at 390px should have text to measure`).toBeGreaterThan(20);
    expect(narrow.bad, `sub-AA text on the ${name} at 390px`).toEqual([]);

    // The burger's open panel is a different ground again, and it is the only
    // way to reach the site nav at this width.
    const burger = page.locator('.burger');
    if (await burger.isVisible()) {
      await burger.click();
      await page.locator('.site-nav.open').waitFor({ timeout: 5_000 });
      await page.waitForTimeout(200);
      const opened = await page.evaluate(CONTRAST_PROBE);
      expect(opened.bad, `sub-AA text on the ${name} with the site nav open`).toEqual([]);
      await burger.click();
    }
    await page.setViewportSize({ width: 1440, height: 950 });
    await page.waitForTimeout(250);

    // …and again with a pointer resting on the screen's own row, which is a
    // different set of colours wherever hovering lifts the ground.
    if (!hoverable) continue;
    const rows = page.locator(hoverable);
    const reach = Math.min(await rows.count(), 4);
    for (let i = 0; i < reach; i++) {
      await rows.nth(i).hover();
      await page.waitForTimeout(120);
      const hovered = await page.evaluate(CONTRAST_PROBE);
      expect(hovered.bad, `sub-AA text on the ${name} with row ${i} hovered`).toEqual([]);
    }
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

/*
 * The map is the game's Equipment tab, measured in a real browser.
 *
 * This asserted a 5x7 anatomical silhouette — narrow at the head, wide at the
 * shoulders, narrow at the feet — which was a correct measurement of a layout
 * that had been invented rather than observed. A capture of the client's own
 * Equipment window (Director, 2026-08-18) settles the arrangement: six columns,
 * four rows, 23 positions, row 1 indented by one, the three doubled slots
 * mirrored to the outside.
 *
 * Row extents are the wrong instrument for a grid, so this measures cell
 * centres against the column they should sit in.
 */
test('the equipment map reproduces the game Equipment tab', async ({ page }) => {
  await filledSet(page);

  const grid = await page.evaluate(() => {
    const cells = [...document.querySelectorAll<HTMLElement>('.figure-body button')];
    const rows = new Map<number, number[]>();
    for (const cell of cells) {
      const box = cell.getBoundingClientRect();
      const key = Math.round(box.top);
      rows.set(key, [...(rows.get(key) ?? []), Math.round(box.left)]);
    }
    const ordered = [...rows.entries()].sort((a, b) => a[0] - b[0]);
    const lefts = [...new Set(cells.map((c) => Math.round(c.getBoundingClientRect().left)))]
      .sort((a, b) => a - b);
    return {
      cells: cells.length,
      rowSizes: ordered.map(([, xs]) => xs.length),
      columns: lefts.length,
      // Which column index each row starts in, 0-based against the column grid.
      rowStart: ordered.map(([, xs]) => lefts.indexOf(Math.min(...xs))),
    };
  });

  expect(grid.cells, '23 positions').toBe(23);
  expect(grid.columns, 'six columns').toBe(6);
  expect(grid.rowSizes, 'five on the first row, six on the rest').toEqual([5, 6, 6, 6]);
  // The gap is at the left of row 1 and nowhere else.
  expect(grid.rowStart, 'row 1 is indented by one column').toEqual([1, 0, 0, 0]);
});
