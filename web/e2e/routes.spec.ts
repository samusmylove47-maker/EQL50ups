/** Every route, deep-linked in a fresh session, must render cleanly. */

import {
  expect,
  expectCleanText,
  expectNoHorizontalScroll,
  test,
  watchReactWarnings,
} from './helpers';

const ROUTES: Array<[name: string, hash: string, heading: RegExp]> = [
  ['landing', '#/', /gear at speed/i],
  ['characters', '#/characters', /characters/i],
  ['new character', '#/character/new', /create character/i],
  ['items', '#/items', /items/i],
  ['unknown route', '#/nope/nope', /nothing here/i],
  ['missing set', '#/set/does-not-exist', /set not found/i],
  ['missing set tab', '#/set/does-not-exist/weights', /set not found/i],
  ['missing set bad tab', '#/set/does-not-exist/bogus', /set not found/i],
  ['share with no payload', '#/share/', /nothing here/i],
  ['share with junk payload', '#/share/!!!!!', /could not be read/i],
];

for (const [name, hash, heading] of ROUTES) {
  test(`${name} renders cleanly at every width`, async ({ page }) => {
    const warnings = watchReactWarnings(page);
    await page.goto(`/${hash}`);
    await expect(page.locator('h1, h2').first()).toContainText(heading);
    await page.waitForTimeout(600);
    await expectCleanText(page);
    await expectNoHorizontalScroll(page);
    expect(warnings, 'React warnings').toEqual([]);
  });
}

test('primary navigation reaches every screen and marks the current one', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Items', exact: true }).click();
  await expect(page).toHaveURL(/#\/items$/);
  await expect(page.getByRole('link', { name: 'Items', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );

  await page.getByRole('link', { name: 'Characters', exact: true }).click();
  await expect(page).toHaveURL(/#\/characters$/);

  await page.getByRole('link', { name: 'Home', exact: true }).click();
  await expect(page).toHaveURL(/#\/$/);

  /*
   * The wordmark used to read `EQL Upgrades` and go to `#/`, and this line
   * clicked it to check that it did. The chrome is eqlsource.com's now: the
   * wordmark and the first two breadcrumb segments are the way *out* of this
   * tool and into the site it is published on, and `Home` above is the way
   * back to the tool's own front page.
   *
   * The destinations are asserted rather than followed, because the site is a
   * real host and the test runner has no route to it — clicking would land on
   * `chrome-error://chromewebdata/`, which is a property of this container and
   * not of the app.
   */
  /*
   * Extensionless, not `.html`.
   *
   * These three read `/index.html` and `/tools/index.html` until the chrome's
   * 32 outbound links were moved off the `.html` form — the site 307s from it,
   * so every one cost a redirect, and the whole footer depended on that rule
   * continuing to exist. The assertions kept the old spelling and this spec went
   * red for two commits before anyone read its output.
   */
  const mark = page.locator('.site-bar .mark');
  await expect(mark).toHaveAttribute('href', 'https://eqlsource.com/');
  await expect(mark).toContainText('EQL Source');

  const crumb = page.locator('.crumb');
  /*
   * The tool's name is READ off the page, not typed here.
   *
   * This asserted the literal "50 Upgrades" and went red when the site renamed
   * every tool to the `=` convention on 2026-08-31 and `TOOL_NAME` followed it
   * to "=Upgrades" — a typed copy of a name that the app holds in one constant
   * and `breadcrumb.test.tsx` already derives from it.
   *
   * What is checked instead is the invariant that constant exists for, in its
   * own words: a reader who clicks this tool in the site footer and lands on a
   * breadcrumb naming it differently "has been shown two names for one thing".
   * The footer marks this tool `aria-current="true"`, so the two surfaces are
   * compared to each other and neither name is written down here.
   */
  const footMark = page.locator('.site-foot a[aria-current="true"]');
  const toolName = (await footMark.innerText()).trim();
  expect(toolName, 'the footer must mark exactly one tool as this one').not.toBe('');
  await expect(crumb).toContainText(toolName);
  await expect(crumb.locator('a').first()).toHaveAttribute(
    'href',
    'https://eqlsource.com/',
  );
  await expect(crumb.locator('a').nth(1)).toHaveAttribute(
    'href',
    'https://eqlsource.com/tools/',
  );

  // No chrome link may carry the `.html` form again: it exists only as a
  // redirect on the far side, and depending on it is depending on someone
  // else's rewrite rule.
  const dotHtml = await page.evaluate(() =>
    [...document.querySelectorAll('a[href^="https://eqlsource.com"]')]
      .map((a) => (a as HTMLAnchorElement).href)
      .filter((href) => href.endsWith('.html')));
  expect(dotHtml, 'chrome links must be extensionless').toEqual([]);
});

test('back and forward walk the whole history', async ({ page }) => {
  await page.goto('/');
  await page.goto('/#/items');
  await page.goto('/#/characters');
  await page.goto('/#/character/new');

  await page.goBack();
  await expect(page).toHaveURL(/#\/characters$/);
  await page.goBack();
  await expect(page).toHaveURL(/#\/items$/);
  await page.goForward();
  await expect(page).toHaveURL(/#\/characters$/);
  await expectCleanText(page);
});
