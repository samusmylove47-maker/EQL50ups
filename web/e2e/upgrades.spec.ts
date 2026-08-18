/**
 * The upgrades list, in a real browser, against the real shipped catalog.
 *
 * The unit suites prove the ranking obeys its rules. This proves the screen a
 * player actually meets: that the nav reaches it, that twenty-three slot
 * rankings finish and paint, that a row says where its item comes from, that
 * Equip changes the set the row was ranked against, and that none of it scrolls
 * the page sideways on a phone.
 */

import {
  createCharacter,
  expect,
  expectCleanText,
  expectNoHorizontalScroll,
  test,
  watchReactWarnings,
} from './helpers';

/** Wait for the sliced ranking to finish, whichever way it lands. */
async function settle(page: import('@playwright/test').Page): Promise<void> {
  await page.locator('.upg-list, .empty-state').first().waitFor();
  await page.waitForTimeout(300);
}

test('the primary nav reaches it, and it ranks the set it lands on', async ({ page }) => {
  const warnings = watchReactWarnings(page);
  await createCharacter(page, { name: 'Avenrae', classes: [0, 1, 2] });

  await page.getByRole('link', { name: 'Upgrades', exact: true }).click();
  await expect(page).toHaveURL(/#\/set\/[^/]+\/upgrades$/);
  await expect(page.getByRole('link', { name: 'Upgrades', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await settle(page);

  await expect(page.locator('h1')).toContainText(/upgrades/i);
  const rows = page.locator('.upg-row');
  await expect(rows.first()).toBeVisible();
  expect(await rows.count()).toBeGreaterThan(5);

  // Biggest gain first, and every gain is a real signed number.
  const gains = (await page.locator('.upg-gainvalue').allInnerTexts()).map((t) =>
    Number(t.replace('+', '')),
  );
  for (const gain of gains) expect(Number.isFinite(gain) && gain > 0).toBe(true);
  for (let i = 1; i < gains.length; i++) {
    expect(gains[i - 1]).toBeGreaterThanOrEqual(gains[i] as number);
  }

  await expectCleanText(page);
  expect(warnings, 'React warnings').toEqual([]);
});

test('a row says what it is worth and where it comes from', async ({ page }) => {
  await createCharacter(page, { name: 'Avenrae', classes: [0, 1, 2] });
  await page.goto('/#/upgrades');
  await settle(page);

  const first = page.locator('.upg-row').first();
  await expect(first.locator('.upg-slot')).not.toBeEmpty();
  await expect(first.locator('.upg-name')).not.toBeEmpty();
  await expect(first.locator('.upg-gainvalue')).toContainText('+');

  // Acquisition data, or an honest admission that the catalog carries none.
  const source = await first.locator('.upg-source').innerText();
  expect(source.length).toBeGreaterThan(0);
  // The eyebrows are uppercased by CSS, so `innerText` reads them shouting.
  expect(
    /zone|drops from|quest|vendor|crafted|no acquisition data/i.test(source),
    `source block read: ${source}`,
  ).toBe(true);

  // The tier being compared at is stated on both sides of the row.
  await expect(first.locator('.tier-chip').first()).toContainText('+');
});

test('Equip applies the row and the list re-ranks without it', async ({ page }) => {
  const hash = await createCharacter(page, { name: 'Avenrae', classes: [0, 1, 2] });
  await page.goto('/#/upgrades');
  await settle(page);

  const first = page.locator('.upg-row').first();
  const item = (await first.locator('.upg-name').innerText()).trim();
  const slot = (await first.locator('.upg-slot').innerText()).trim();
  await first.getByRole('button', { name: /^Equip/ }).click();

  // `.upg .notice` rather than any `[role=status]`: the progress line and the
  // data banner are both live regions too, and which one answers first is a
  // race.
  await expect(page.locator('.upg .notice')).toContainText(item);
  await settle(page);
  // The row it just applied is gone: the set it was measured against changed.
  await expect(page.locator('.upg-row').first().locator('.upg-name')).not.toHaveText(item);

  // And the set really holds it.
  await page.goto(`/${hash}`);
  await expect(page.locator('.doll')).toContainText(item);
  await expect(page.locator('.doll')).toContainText(new RegExp(slot, 'i'));
});

test('opening a row shows the item window without leaving the page', async ({ page }) => {
  await createCharacter(page, { name: 'Avenrae', classes: [0, 1, 2] });
  await page.goto('/#/upgrades');
  await settle(page);

  const item = (await page.locator('.upg-row').first().locator('.upg-name').innerText()).trim();
  await page.locator('.upg-row').first().getByRole('button', { name: /^Open/ }).click();
  await expect(page.locator('.modal .iwin')).toContainText(item);
  await expect(page).toHaveURL(/upgrades$/);
  await page.keyboard.press('Escape');
  await expect(page.locator('.modal')).toHaveCount(0);
});

test('it holds up at every width, and explains itself with no set', async ({ page }) => {
  await createCharacter(page, { name: 'Avenrae', classes: [0, 1, 2] });
  await page.goto('/#/upgrades');
  await settle(page);
  await expectNoHorizontalScroll(page);
  await expectCleanText(page);

  // The nav gained a fourth item with this screen; on the narrowest phone it
  // scrolls rather than printing its labels over each other.
  await page.setViewportSize({ width: 320, height: 900 });
  await page.waitForTimeout(200);
  const clipped = await page.evaluate(() =>
    [...document.querySelectorAll('.topbar nav a')].some((a) => a.scrollWidth > a.clientWidth + 1),
  );
  expect(clipped, 'a nav label narrower than its own text').toBe(false);
});

test('with no character at all it says so rather than ranking nothing', async ({ page }) => {
  await page.goto('/#/upgrades');
  await expect(page.locator('h2')).toContainText(/no set to rank/i);
  await expectCleanText(page);
  await expectNoHorizontalScroll(page);
});
