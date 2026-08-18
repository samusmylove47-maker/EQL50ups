/** Layout resilience: hostile content must not widen the page. */

import {
  createCharacter,
  expect,
  expectCleanText,
  expectNoHorizontalScroll,
  openSlotPicker,
  test,
} from './helpers';

const LONG_NAME = 'Wörcestershiresauceenthusiastonaverylongday'.repeat(2).slice(0, 64);
const LONG_SET = 'Ultramegasuperlongsetnamewithoutanyspacesatall'.repeat(2).slice(0, 80);
const LONG_NOTES = 'Unbreakablewordthatgoesonforever'.repeat(8);

test('unbroken names in every field leave the page unscrollable sideways', async ({ page }) => {
  test.slow();
  page.on('dialog', (d) => d.accept());

  // Regression: a 64-character word with no spaces pushed the set header — and
  // the whole document — past the viewport at every width, 1600px included.
  const hash = await createCharacter(page, { name: LONG_NAME, classes: [0, 1, 2] });
  await openSlotPicker(page, 0);
  await page.locator('.results .result').first().click();

  await page.getByRole('button', { name: /edit/i }).click();
  await page.locator('.modal input[type=text]').fill(LONG_SET);
  await page.locator('.modal textarea').fill(LONG_NOTES);
  await page.getByRole('button', { name: /^save$/i }).click();
  await expect(page.locator('.set-notes')).toBeVisible();

  for (const route of [hash, `${hash}/exaltations`, `${hash}/weights`, '#/characters', '#/']) {
    await page.goto(`/${route}`);
    await page.waitForTimeout(500);
    await expectNoHorizontalScroll(page);
    await expectCleanText(page);
  }

  // And the same content arriving through a share link.
  await page.goto(`/${hash}`);
  await page.getByRole('button', { name: /share/i }).click();
  const link = await page.locator('.copy-field input').inputValue();
  await page.keyboard.press('Escape');
  await page.goto(link);
  await expect(page.locator('.set-header h1')).toHaveText(LONG_NAME);
  await expectNoHorizontalScroll(page);
});

test('the picker stays inside the viewport at every width', async ({ page }) => {
  await createCharacter(page);
  await openSlotPicker(page, 12); // primary: the longest names and most rows

  for (const width of [1600, 1280, 1024, 768]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(200);
    const box = await page.evaluate(() => {
      const modal = document.querySelector('.modal') as HTMLElement;
      const rect = modal.getBoundingClientRect();
      return {
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        client: document.documentElement.clientWidth,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    expect(box.left, `modal off the left edge at ${width}px`).toBeGreaterThanOrEqual(0);
    expect(box.right, `modal off the right edge at ${width}px`).toBeLessThanOrEqual(box.client);
    expect(box.overflow, `page scrolls sideways at ${width}px`).toBeLessThanOrEqual(1);
  }
});

test('a fully equipped set renders cleanly at every width', async ({ page }) => {
  test.slow();
  page.on('dialog', (d) => d.accept());
  await createCharacter(page, { name: 'Loaded', classes: [0, 1, 2] });
  await page.getByRole('button', { name: /auto-fill/i }).click();
  await expect(page.locator('.notice')).toContainText(/placed \d+ items?/i, { timeout: 60_000 });
  await expect(page.locator('.slot-wrap .slot.filled')).toHaveCount(23);
  await expectNoHorizontalScroll(page);
  await expectCleanText(page);
});

/**
 * An open menu must be inside the window.
 *
 * `.menu-body` anchors to its own `<details>` — `left: 0`, or `right: 0` for
 * `.menu-body.right`. That is right on a wide screen and wrong on a phone,
 * where the anchor can sit anywhere along the row. Measured at 390px on the
 * gear tab: the set-actions menu opened at x = 275…465, **75px of a 190px menu
 * past the right edge**, and a right-aligned one at −35…181, 35px past the
 * left. Neither the document nor the body scrolls sideways, by design, so those
 * pixels were unreachable rather than merely untidy — half of "Compare" could
 * not be tapped.
 *
 * The correction depends on a measurement, so it is made in `App.tsx` where
 * measurements live, and asserted here in the only place it matters: every menu
 * the set editor has, opened one at a time, at the narrowest width we support.
 */
test('no open menu leaves the window at phone width', async ({ page }) => {
  test.slow();
  page.on('dialog', (d) => d.accept());
  await createCharacter(page, { name: 'Narrow', classes: [0, 1, 2] });

  for (const width of [390, 360, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.waitForTimeout(250);

    const menus = page.locator('summary[aria-label]');
    const count = await menus.count();
    expect(count, 'the set editor should have menus to open').toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const summary = menus.nth(i);
      const label = await summary.getAttribute('aria-label');
      await summary.click();
      await page.waitForTimeout(200);

      const boxes = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('details.menu[open] .menu-body')].map((el) => {
          const rect = el.getBoundingClientRect();
          return {
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            client: document.documentElement.clientWidth,
          };
        }),
      );
      expect(boxes.length, `"${label}" should open a menu at ${width}px`).toBe(1);
      for (const box of boxes) {
        expect(box.left, `"${label}" hangs off the left at ${width}px`).toBeGreaterThanOrEqual(0);
        expect(box.right, `"${label}" hangs off the right at ${width}px`).toBeLessThanOrEqual(
          box.client,
        );
      }
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
    }

    await expectNoHorizontalScroll(page, [width]);
  }
});
