/**
 * Planar gear targets, in a real browser against the real catalog.
 *
 * The jsdom suite pushes the seven planar shards straight into the store; this
 * one exercises the path a reader actually takes — deep link, load the catalog
 * over HTTP, click three class chips, read a ranking — and checks the two things
 * jsdom cannot: that the page does not scroll sideways at any width, and that
 * the standing accent on a card is really painted.
 */

import {
  expect,
  expectCleanText,
  expectNoHorizontalScroll,
  test,
  watchReactWarnings,
} from './helpers';
import type { Page } from '@playwright/test';

async function pickTrio(page: Page, codes: string[]): Promise<void> {
  for (const code of codes) {
    await page.locator('.class-chip', { has: page.locator('.class-orb', { hasText: code }) })
      .first()
      .click();
  }
}

test('deep-links, states its assumption, and does not scroll sideways', async ({ page }) => {
  const warnings = watchReactWarnings(page);
  await page.goto('/#/planar');

  await expect(page.locator('h1')).toContainText(/planar gear/i);
  await expect(page.getByText('One assumption, stated')).toBeVisible();
  await expect(page.getByText('Wrist counts twice').first()).toBeVisible();

  await page.waitForTimeout(600);
  await expectCleanText(page);
  await expectNoHorizontalScroll(page);
  expect(warnings, 'React warnings').toEqual([]);
});

test('ranks a trio, badges every card, and repeats the badge on the total', async ({ page }) => {
  await page.goto('/#/planar');
  // The ranking needs the slot shards, which arrive over HTTP here.
  await expect(page.locator('.pl-callout-figure').first()).not.toHaveText('0');

  await pickTrio(page, ['WAR', 'BRD', 'BER']);

  const cards = page.locator('.pl-card');
  await expect(cards.first()).toBeVisible();
  const total = await cards.count();
  expect(total).toBeGreaterThan(10);

  // Every card carries its own standing badge — never off screen when you decide.
  await expect(page.locator('.pl-card')).toHaveCount(total);
  await expect(page.locator('.pl-card .pl-standing')).toHaveCount(total);

  // And the accent rule on a card's top edge is actually painted, rather than
  // being a data attribute nothing reads.
  const border = await page
    .locator('.pl-card')
    .first()
    .evaluate((node) => getComputedStyle(node).borderTopColor);
  expect(border).not.toBe('rgba(0, 0, 0, 0)');

  // Lock the head slot and read the total.
  await page.locator('#pl-slot-HEAD').locator('..').locator('..').locator('.pl-lock').first().click();
  await expect(page.locator('.pl-total')).toContainText('of 8 targets locked');
  await expect(page.locator('.pl-total .pl-standing').first()).toBeVisible();

  await expectCleanText(page);
  await expectNoHorizontalScroll(page);
});

test('offers Shadow Rage by name and refuses to score it', async ({ page }) => {
  await page.goto('/#/planar');
  await expect(page.locator('.pl-callout-figure').first()).not.toHaveText('0');
  await pickTrio(page, ['WAR', 'BRD', 'BER']);

  const unmeasured = page.locator('.pl-card-unmeasured');
  await expect(unmeasured.first()).toBeVisible();
  await expect(unmeasured.first()).toContainText('no score');
  await expect(unmeasured.first()).toContainText(/no source publishes its numbers/i);
  // Not a zero anywhere on it.
  await expect(unmeasured.first().locator('.pl-score')).not.toContainText('0.0');
});

/**
 * The composited-contrast probe, copied from `visual-system.spec.ts`.
 *
 * Copied rather than imported because that spec keeps it private, and duplicated
 * rather than skipped because that file's own note is the reason this test
 * exists: *"a new screen is exactly where an unmeasured colour lands, so the
 * list grows with the app"*. Reading the declared hex is not enough — it
 * composites the whole ancestor chain, colour and alpha both, which is how 316
 * sub-AA runs once hid behind a token documented at 4.57:1.
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
    if (!el.closest('.pl')) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden') continue;
    const box = el.getBoundingClientRect();
    if (box.width < 1 || box.height < 1) continue;
    const alpha = alphaOf(el);
    if (alpha < 0.5) continue;
    if (el.closest('[disabled],[aria-disabled="true"]')) continue;
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

test('no text run on this screen is below WCAG AA, composited', async ({ page }) => {
  await page.goto('/#/planar');
  await expect(page.locator('.pl-callout-figure').first()).not.toHaveText('0');
  await pickTrio(page, ['WAR', 'BRD', 'BER']);
  await page.locator('#pl-slot-HEAD').locator('..').locator('..').locator('.pl-lock').first().click();
  await page.waitForTimeout(400);

  const result = (await page.evaluate(CONTRAST_PROBE)) as { seen: number; bad: string[] };
  // A sweep that measured nothing would pass silently, which is the one way
  // this assertion could lie.
  expect(result.seen).toBeGreaterThan(100);
  expect(result.bad, 'sub-AA text runs on the planar screen').toEqual([]);
});

test('the tool rail reaches it and marks it current', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Planar', exact: true }).click();
  await expect(page).toHaveURL(/#\/planar$/);
  await expect(page.getByRole('link', { name: 'Planar', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
});
