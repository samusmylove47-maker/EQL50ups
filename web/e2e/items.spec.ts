/** The global item browser: search, filters, and every sort column both ways. */

import { createCharacter, expect, expectCleanText, expectNoHorizontalScroll, test } from './helpers';

/**
 * Open the browser and wait for the shards to stop arriving — the match count
 * climbs while `ensureAll` streams in per-slot detail, and a test that reads it
 * mid-flight measures the load, not the filter.
 */
async function open(page: import('@playwright/test').Page) {
  await page.goto('/#/items');
  await page.locator('table.data tbody tr').first().waitFor({ timeout: 30_000 });
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

const names = (page: import('@playwright/test').Page) =>
  page.locator('table.data tbody tr td:first-child span').first().innerText();

const column = async (page: import('@playwright/test').Page, index: number, take = 8) =>
  (await page.locator(`table.data tbody tr td:nth-child(${index})`).allInnerTexts())
    .slice(0, take)
    .map((t) => t.split('\n')[0]?.trim() ?? '');

test('every sort column reverses on a second click and says so', async ({ page }) => {
  // Regression: clicking the active header did nothing, and aria-sort read
  // "descending" even while names were sorted A-Z.
  await open(page);

  for (const [label, columnIndex, natural] of [
    ['Item', 1, 'asc'],
    ['Slot', 2, 'asc'],
    ['Era', 5, 'asc'],
    ['EP', 6, 'desc'],
  ] as const) {
    const header = page.getByRole('button', { name: new RegExp(`^${label}`) });
    await header.click();
    await page.waitForTimeout(400);
    const th = page.locator('th', { has: header });
    await expect(th).toHaveAttribute('aria-sort', natural === 'asc' ? 'ascending' : 'descending');
    const first = await column(page, columnIndex);

    await header.click();
    await page.waitForTimeout(400);
    await expect(th).toHaveAttribute('aria-sort', natural === 'asc' ? 'descending' : 'ascending');
    const second = await column(page, columnIndex);

    expect(second, `${label} did not reverse`).not.toEqual(first);
    await expectCleanText(page);
  }
});

test('name sorting really is alphabetical in both directions', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: /^Item/ }).click();
  await page.waitForTimeout(400);
  const ascending = await column(page, 1);
  expect(ascending).toEqual([...ascending].sort((a, b) => a.localeCompare(b)));

  await page.getByRole('button', { name: /^Item/ }).click();
  await page.waitForTimeout(400);
  const descending = await column(page, 1);
  expect(descending).toEqual([...descending].sort((a, b) => b.localeCompare(a)));
});

test('EP sorting is monotonic and stable across repeat renders', async ({ page }) => {
  await open(page);
  const scores = async () =>
    (await page.locator('table.data tbody tr td.num').allInnerTexts())
      .slice(0, 20)
      .map((t) => Number(t.replace(/,/g, '')));

  const first = await scores();
  for (let i = 1; i < first.length; i++) {
    expect(first[i - 1]).toBeGreaterThanOrEqual(first[i] as number);
  }

  const before = await column(page, 1, 20);
  await page.getByRole('button', { name: /^Item/ }).click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /^EP/ }).click();
  await page.waitForTimeout(300);
  expect(await column(page, 1, 20), 'sort order is not stable').toEqual(before);
});

test('search and filters narrow the catalog and can be undone', async ({ page }) => {
  await open(page);
  const countText = () => page.locator('.page-head .hint').innerText();
  const parse = (text: string) => Number((text.match(/[\d,]+/)?.[0] ?? '0').replace(/,/g, ''));
  const all = parse(await countText());
  expect(all).toBeGreaterThan(1000);

  const search = page.locator('input[aria-label="Search items"]');
  await search.fill("Hotof's"); // apostrophes are everywhere in EQ item names
  await page.waitForTimeout(500);
  expect(parse(await countText())).toBeGreaterThan(0);
  expect(await names(page)).toContain("Hotof's");

  await search.fill('[');
  await page.waitForTimeout(500);
  await expect(page.locator('.empty-state h2')).toHaveText(/nothing matches/i);
  await search.fill('');
  await page.waitForTimeout(500);
  expect(parse(await countText())).toBe(all);

  await page.locator('select[aria-label="Filter by slot"]').selectOption('HEAD');
  await page.waitForTimeout(400);
  const heads = parse(await countText());
  expect(heads).toBeLessThan(all);
  for (const slot of await column(page, 2)) expect(slot).toContain('HEAD');

  await page.locator('select[aria-label="Filter by class"]').selectOption({ index: 2 });
  await page.waitForTimeout(400);
  expect(parse(await countText())).toBeLessThanOrEqual(heads);

  await page.locator('select[aria-label="Filter by slot"]').selectOption('any');
  await page.locator('select[aria-label="Filter by class"]').selectOption('any');
  await page.waitForTimeout(400);
  expect(parse(await countText())).toBe(all);

  // Unreleased content is hidden by default and can be revealed.
  await page.locator('.checkline input').uncheck();
  await page.waitForTimeout(600);
  expect(parse(await countText())).toBeGreaterThan(all);
  await page.locator('.checkline input').check();
  await page.waitForTimeout(600);
  expect(parse(await countText())).toBe(all);
  await expectNoHorizontalScroll(page);
});

test('the scoring profile and the +N preview change the numbers', async ({ page }) => {
  await open(page);
  const top = await names(page);

  await page.locator('select[aria-label="Scoring profile"]').selectOption({ index: 1 });
  await page.waitForTimeout(600);
  expect(await names(page)).not.toBe(top);

  const stepper = page.locator('.rowline .stepper').first();
  const before = await page.locator('table.data tbody tr td.num').first().innerText();
  for (let i = 0; i < 3; i++) await stepper.locator('button').last().click();
  await expect(stepper.locator('.value')).toHaveText('+3');
  await page.waitForTimeout(600);
  expect(await page.locator('table.data tbody tr td.num').first().innerText()).not.toBe(before);

  await page.getByRole('button', { name: /^reset$/i }).click();
  await expect(stepper.locator('.value')).toHaveText('+0');
  await expectCleanText(page);
});

test('every item in the catalog is reachable, and rows open a detail window', async ({ page }) => {
  // Regression: the browser rendered the first 250 of 5,848 matches with no
  // pagination and inert `<tr>`s, so items 251+ could not be reached at all
  // and no row could be clicked.
  await open(page);

  const head = page.locator('.page-head .hint');
  await expect(head).toContainText('1–100');
  expect(await page.locator('table.data tbody tr').count()).toBe(100);

  // A nav above the table as well as below it, so the control is not buried
  // under six screens of rows.
  await expect(page.locator('.page-nav')).toHaveCount(2);

  const nav = page.locator('.page-nav').first();
  await expect(nav.getByRole('button', { name: /previous/i })).toBeDisabled();
  await nav.getByRole('button', { name: /next/i }).click();
  await expect(head).toContainText('101–200');

  // The last page — the region that was previously unreachable by any means.
  const pages = Number(
    ((await nav.innerText()).match(/of ([\d,]+)/)?.[1] ?? '1').replace(/,/g, ''),
  );
  expect(pages).toBeGreaterThan(10);
  await page.getByLabel('Jump to page (top)').fill(String(pages));
  await expect(nav.getByRole('button', { name: /next/i })).toBeDisabled();
  const total = Number(((await head.innerText()).match(/^([\d,]+)/)?.[1] ?? '0').replace(/,/g, ''));
  await expect(head).toContainText(String(total).replace(/\B(?=(\d{3})+(?!\d))/g, ','));

  // Narrowing the search puts you back on page one rather than on a page that
  // no longer exists.
  await page.locator('input[aria-label="Search items"]').fill('ring');
  await page.waitForTimeout(800);
  await expect(head).toContainText('1–');

  await expectCleanText(page);
});

test('the row stays a row: six columns, scoped headers, a caption that follows the filters', async ({
  page,
}) => {
  await open(page);

  /*
   * `role="button"` removed the row from the table structure and orphaned its
   * six `<td>`s; `aria-label` on a button then *replaces* its contents as the
   * accessible name. Between them, the screen that exists to expose SLOT /
   * CLASSES / STATS / ERA / EP across 5,861 items announced exactly one thing
   * per row, for three consecutive reviews.
   */
  const semantics = await page.evaluate(() => {
    const row = document.querySelector('table.data tbody tr')!;
    return {
      role: row.getAttribute('role'),
      label: row.getAttribute('aria-label'),
      cells: row.querySelectorAll('td').length,
      cellText: [...row.querySelectorAll('td')].map((td) => (td.textContent ?? '').trim()),
      scopes: [...document.querySelectorAll('table.data thead th')].map((th) => th.getAttribute('scope')),
      rows: document.querySelectorAll('table.data tbody tr').length,
      stops: [...document.querySelectorAll<HTMLElement>('table.data tbody tr, table.data tbody tr *')]
        .filter((el) => el.tabIndex >= 0)
        .map((el) => el.tagName),
    };
  });

  expect(semantics.role, 'a row is a row').toBeNull();
  expect(semantics.label, 'an aria-label on the row replaces all six cells').toBeNull();
  expect(semantics.cells).toBe(6);
  expect(semantics.cellText.filter(Boolean).length, 'every column carries text').toBeGreaterThanOrEqual(5);
  expect(semantics.scopes).toEqual(['col', 'col', 'col', 'col', 'col', 'col']);

  // The name is a real control now, and it is deliberately not a second tab
  // stop: 100 rows must not cost 200 stops.
  expect(new Set(semantics.stops)).toEqual(new Set(['TR']));
  expect(semantics.stops).toHaveLength(semantics.rows);
  await expect(page.locator('table.data tbody tr').first().locator('td button')).toHaveCount(1);

  // A caption is the table's accessible name, and the filters are the only
  // thing that separates "5,861 items" from "94 items".
  const caption = page.locator('table.data caption');
  await expect(caption).toHaveCount(1);
  await expect(caption).toHaveClass(/sr-only/);
  await expect(caption).toContainText(/any slot, any class, any era, live content only/i);
  await expect(caption).toContainText(/sorted by ep, descending/i);

  await page.locator('select[aria-label="Filter by slot"]').selectOption('HEAD');
  await page.waitForTimeout(400);
  await expect(caption).toContainText('slot HEAD');
  await page.getByRole('button', { name: /^Item/ }).click();
  await page.waitForTimeout(400);
  await expect(caption).toContainText(/sorted by name, ascending/i);
  await expectCleanText(page);
});

test('a row opens the item, by mouse and by keyboard, and can equip it', async ({ page }) => {
  await open(page);

  const first = page.locator('table.data tbody tr').first();
  const name = (await first.locator('td:first-child button').first().innerText()).trim();

  // The affordance in the first cell opens it too, without firing twice.
  await first.locator('td:first-child button').click();
  await expect(page.locator('.modal')).toHaveCount(1);
  await expect(page.locator('.modal')).toContainText(name);
  await page.keyboard.press('Escape');
  await expect(page.locator('.modal')).toHaveCount(0);

  await first.click();
  await expect(page.locator('.modal')).toBeVisible();
  await expect(page.locator('.modal')).toContainText(name);
  await page.keyboard.press('Escape');
  await expect(page.locator('.modal')).toHaveCount(0);

  await first.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.modal')).toBeVisible();
  await page.keyboard.press('Escape');

  // With no character there is nothing to equip into, and the dialog says
  // nothing rather than offering a dead button.
  await expect(page.locator('body')).not.toContainText('Equip in');
});

test('an item found in the browser can be equipped straight into a set', async ({ page }) => {
  await createCharacter(page, { name: 'Looter', classes: [0] });
  await open(page);

  await page.locator('input[aria-label="Search items"]').fill('helm');
  await page.waitForTimeout(900);
  const first = page.locator('table.data tbody tr').first();
  const name = (await first.locator('td:first-child span').first().innerText()).trim();
  await first.click();
  await expect(page.locator('.modal')).toBeVisible();

  const equip = page.locator('.modal .chip-row .btn').first();
  await expect(equip).toBeVisible();
  await equip.click();

  // It lands in the set, and takes you there.
  await page.waitForURL(/#\/set\//);
  await expect(page.locator('.slot-item').first()).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('body')).toContainText(name);
  await expectCleanText(page);
});
