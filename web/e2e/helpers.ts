/**
 * Shared harness for the browser suite.
 *
 * Every spec runs under `test` from here rather than from `@playwright/test`,
 * so three standing assertions are enforced on every page the suite touches
 * without each spec restating them:
 *
 *  1. no console errors, page errors or unhandled rejections;
 *  2. no `NaN`, `undefined`, `[object Object]` or `Infinity` in visible text;
 *  3. no horizontal page scroll at 1600 / 1280 / 1024 / 768 px.
 *
 * (2) and (3) are opt-in per assertion point because they need a settled page;
 * (1) is automatic and fails the test at teardown.
 */

import { expect, test as base, type Page } from '@playwright/test';

const FORBIDDEN = ['NaN', 'undefined', '[object Object]', 'Infinity'];

/**
 * Console noise that is not the app's fault. Kept deliberately tiny — anything
 * added here is a defect the suite has stopped watching.
 */
const IGNORED = [/favicon/i, /Failed to load resource: net::ERR_/i];

export const test = base.extend<{ errors: string[] }>({
  errors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('console', (message) => {
        if (message.type() !== 'error') return;
        const text = message.text();
        if (IGNORED.some((r) => r.test(text))) return;
        errors.push(`console.error: ${text}`);
      });
      page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));

      // A rejected promise nobody handled is neither a console error nor a page
      // error, so record it from inside the page.
      await page.addInitScript(() => {
        const seen: string[] = [];
        (window as unknown as { __rejections: string[] }).__rejections = seen;
        window.addEventListener('unhandledrejection', (event) => {
          seen.push(String(event.reason));
        });
      });

      await use(errors);

      const rejections = await page
        .evaluate(() => (window as unknown as { __rejections?: string[] }).__rejections ?? [])
        .catch(() => []);
      for (const reason of rejections) errors.push(`unhandledrejection: ${reason}`);
      expect(errors, 'console/page errors during test').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** Visible text must never leak a formatting failure. */
export async function expectCleanText(page: Page): Promise<void> {
  const text = await page.evaluate(() => document.body.innerText);
  for (const needle of FORBIDDEN) {
    const at = text.indexOf(needle);
    expect(
      at,
      `body text contains ${needle}: …${text.slice(Math.max(0, at - 70), at + 70)}…`,
    ).toBe(-1);
  }
}

/** The page may never scroll sideways at any supported width. */
export async function expectNoHorizontalScroll(
  page: Page,
  widths: number[] = [1600, 1280, 1024, 768],
): Promise<void> {
  const original = page.viewportSize();
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(150);
    const { scroll, client } = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }));
    expect(scroll, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(client + 1);
  }
  if (original) await page.setViewportSize(original);
}

/** React key/act warnings are never acceptable. */
export function watchReactWarnings(page: Page): string[] {
  const warnings: string[] = [];
  page.on('console', (message) => {
    if (message.type() !== 'warning') return;
    const text = message.text();
    if (/unique "key"|act\(\)|Each child in a list/i.test(text)) warnings.push(text);
  });
  return warnings;
}

export interface NewCharacterOptions {
  name?: string;
  classes?: number[];
  race?: number;
  level?: string;
}

/** Create a character and land on its first gear set. Returns the set URL hash. */
export async function createCharacter(
  page: Page,
  { name = 'Tester', classes = [0], race, level }: NewCharacterOptions = {},
): Promise<string> {
  await page.goto('/#/character/new');
  await page.locator('input[type=text]').first().fill(name);
  if (level !== undefined) await page.locator('input[type=number]').first().fill(level);
  if (race !== undefined) await page.locator('select').first().selectOption({ index: race });
  for (const index of classes) await page.locator('.class-chip').nth(index).click();
  await page.getByRole('button', { name: /create character/i }).click();
  await page.waitForURL(/#\/set\//);
  await page.waitForTimeout(400);
  return new URL(page.url()).hash;
}

/** Open the picker for a paper-doll position and wait for its list. */
export async function openSlotPicker(page: Page, index: number): Promise<void> {
  await page.locator('.slot-wrap button.slot').nth(index).click();
  await page.locator('.modal').waitFor();
  await page.locator('.results .result, .results .empty-state').first().waitFor();
}
