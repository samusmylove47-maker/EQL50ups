/**
 * The picker's windowed, uncapped result list, in a real browser.
 *
 * Three regressions live here. The list used to build 150 rows to show about
 * nine; every one of those rows was a tab stop, so Cancel was 157 Tab presses
 * away; and the 150th row was the end of the list, silently, with ~1,690
 * legal candidates unreachable on an Any Slot.
 */

import {
  createCharacter, expect, expectCleanText, openSlotPicker, pickerMatchCount as matchCount, test,
} from './helpers';

test('the list renders a small window of a long candidate list', async ({ page }) => {
  await createCharacter(page);
  await openSlotPicker(page, 21); // Any Slot 1 — the largest pool in the app
  await page.waitForTimeout(900);

  const matches = await matchCount(page);
  expect(matches, 'Any Slot should offer well over a thousand candidates').toBeGreaterThan(1000);

  const rendered = await page.locator('.results .result').count();
  expect(rendered, 'rows built').toBeGreaterThan(0);
  expect(rendered, 'the window must be a fraction of the list').toBeLessThan(matches / 20);

  // Node count is the cost that actually blocked the main thread.
  const nodes = await page.locator('.results').evaluate((el) => el.querySelectorAll('*').length);
  expect(nodes, 'DOM nodes inside the results list').toBeLessThan(800);
});

test('Tab reaches Cancel in a handful of presses', async ({ page }) => {
  await createCharacter(page);
  await openSlotPicker(page, 12); // Primary — 380+ candidates
  await page.waitForTimeout(600);
  await page.locator('.modal input[aria-label="Search items by name"]').focus();

  let presses = 0;
  for (; presses < 40; presses++) {
    await page.keyboard.press('Tab');
    const onCancel = await page.evaluate(() => {
      const el = document.activeElement;
      return Boolean(
        el && el.closest('.modal-foot') && /^cancel$/i.test((el.textContent ?? '').trim()),
      );
    });
    if (onCancel) break;
  }
  expect(presses + 1, 'Tab presses from the search box to Cancel').toBeLessThanOrEqual(12);

  // And the rows themselves are not tab stops.
  const stops = await page.locator('.results .result:not([tabindex="-1"])').count();
  expect(stops, 'result rows in the tab order').toBe(0);
});

test('no picker truncates silently — every candidate is reachable', async ({ page }) => {
  test.slow();
  await createCharacter(page);
  const slots = page.locator('.slot-wrap button.slot');
  await expect(slots).toHaveCount(23);

  for (let i = 0; i < 23; i++) {
    await openSlotPicker(page, i);
    await page.waitForTimeout(500);
    const meta = await page.locator('.picker-meta span').first().innerText();
    expect(meta, `position ${i} still advertises a cap`).not.toMatch(/showing top/i);

    const matches = await matchCount(page);
    if (matches > 0) {
      // End must select the final candidate, and that row must be mounted —
      // which is also what `aria-activedescendant` is pointing at.
      await page.locator('.modal input[aria-label="Search items by name"]').focus();
      await page.keyboard.press('Control+End');
      await page.waitForTimeout(250);
      const active = page.locator('.results .result[data-active="true"]');
      await expect(active, `last candidate unreachable at position ${i}`).toHaveAttribute(
        'id',
        `picker-option-${matches - 1}`,
      );
      const pointed = await page
        .locator('.modal input[aria-label="Search items by name"]')
        .getAttribute('aria-activedescendant');
      expect(pointed, `aria-activedescendant at position ${i}`).toBe(`picker-option-${matches - 1}`);
    }
    await page.keyboard.press('Escape');
    await expect(page.locator('.modal')).toHaveCount(0);
  }
  await expectCleanText(page);
});

test('scrolling to the bottom of an Any Slot list reaches its last item', async ({ page }) => {
  await createCharacter(page);
  await openSlotPicker(page, 22); // Any Slot 2
  await page.waitForTimeout(900);
  const matches = await matchCount(page);

  const bottom = await page.evaluate(async () => {
    const frames = (n: number) =>
      new Promise<void>((resolve) => {
        let left = n;
        const tick = () => (left-- <= 0 ? resolve() : requestAnimationFrame(tick));
        tick();
      });
    const list = document.querySelector('.results') as HTMLElement;
    // Estimated row heights are replaced as rows mount, so the true bottom
    // takes a few passes to settle.
    for (let i = 0; i < 20; i++) {
      list.scrollTop = list.scrollHeight;
      await frames(4);
    }
    const rows = document.querySelectorAll('.results .result');
    const last = rows[rows.length - 1];
    return { lastId: last?.id ?? null, rendered: rows.length };
  });

  expect(bottom.lastId).toBe(`picker-option-${matches - 1}`);
  expect(bottom.rendered, 'still a window at the bottom').toBeLessThan(matches / 20);
});

test('Auto-fill says it is working while it works', async ({ page }) => {
  await createCharacter(page);
  const button = page.getByRole('button', { name: /auto-fill/i });

  // Sample the button while the fill runs; it used to stay enabled, unlabelled
  // and not busy for the whole 2.6s freeze.
  const sampled = page.evaluate(async () => {
    const frames = () => new Promise((r) => requestAnimationFrame(r));
    const find = () =>
      [...document.querySelectorAll('button')].find((b) => /auto-fill|filling/i.test(b.textContent ?? ''));
    const seen: Array<{ disabled: boolean; busy: string | null; text: string }> = [];
    for (let i = 0; i < 400; i++) {
      const b = find();
      if (b) seen.push({ disabled: b.disabled, busy: b.getAttribute('aria-busy'), text: (b.textContent ?? '').trim() });
      if (document.querySelector('.notice')) break;
      await frames();
    }
    return seen;
  });

  await button.click();
  const samples = await sampled;
  expect(
    samples.some((s) => s.disabled && s.busy === 'true' && /filling/i.test(s.text)),
    'the button never announced that it was busy',
  ).toBe(true);

  await expect(page.locator('.notice')).toContainText(/auto-fill placed/i);
  await expect(page.locator('.slot-wrap .slot.filled')).toHaveCount(23);
  await expectCleanText(page);
});
