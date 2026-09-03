/**
 * Product screenshots for the site's `/tools/50-upgrades` page, taken from the
 * running product against the real payload.
 *
 * `public/tools/50-upgrades.html` carries no imagery at all — the Director
 * measured `grep -cE '<img|<video|<figure|background-image'` at **0** on the
 * page that sells a visual planning tool. Nobody else can take these: the
 * planner is the imagery, and a shot driven through the real UI cannot
 * misrepresent the tool because it *is* the tool.
 *
 * It runs with the rest of the suite, which was not the original intent — the
 * first draft of this comment said it did not, and that was simply wrong. It is
 * left in for a reason that turned out to matter: the shots are byte-identical
 * across runs, so a full suite re-taking them changes nothing and the hashes in
 * `MANIFEST.md` stay valid. The day they stop being identical is the day the
 * rendering moved, and a dirty `handover/shots` is a reasonable way to hear it.
 *
 * CI does not run Playwright at all — `deploy.yml` runs tsc, vitest, verify,
 * catalogue-audit and the build — so nothing here writes files on a runner.
 *
 * To take them alone:
 *
 *   cd web && npx playwright test --config=playwright.config.ts e2e/handover-shots
 *
 * THREE THINGS THIS FILE IS CAREFUL ABOUT
 *
 * **No player data.** The character is built in the UI and filled with
 * Auto-fill against the shipped catalogue. The real Tier 0 inventory export is
 * never loaded, so no character name, no account and nothing the owner has not
 * already published can reach a frame. `handover/shots/MANIFEST.md` records
 * that as a claim a reader can check rather than a promise.
 *
 * **Real gear, not an empty state.** An empty planner photographs as an empty
 * planner. Auto-fill is the product doing its actual job, so the deltas in the
 * ranking are ones the engine computed rather than ones a mock invented.
 *
 * **Provenance.** A screenshot is a snapshot and it goes stale. The manifest
 * script beside this records the commit and the payload hash the shots were
 * taken from, so a stale one can be identified rather than merely suspected.
 */

import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCharacter } from './helpers';

/*
 * Resolved from this file, not from the working directory.
 *
 * It was `'../handover/shots'`, which is correct only when Playwright is run
 * from `web/`. Run once from the repository root it silently wrote seven PNGs
 * to `/home/user/handover/` — outside the repository entirely — and left the
 * real directory holding the previous run, so a CSS fix looked like it had not
 * worked when it had. Nothing failed; the files just went somewhere else.
 */
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../../handover/shots');

/**
 * A Berserker/Warrior/Bard trio at the cap.
 *
 * BER is deliberate: it is one of the classes EQ Legends added on top of
 * classic, so the shots show the game this tool is actually for rather than
 * the original EverQuest the catalogue is contaminated by. The name is
 * invented and belongs to nobody.
 */
const NAME = 'Ashvane';

test.beforeAll(() => mkdirSync(OUT, { recursive: true }));

/** Give fonts and the catalogue fetch time to settle before the shutter. */
async function settle(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
}

test('captures the product for the site page', async ({ page }) => {
  test.slow();

  // 01 — the landing screen, which is what a visitor from the site meets first.
  await page.goto('/#/');
  await settle(page);
  await page.screenshot({ path: `${OUT}/01-landing.png`, fullPage: false });

  // A real trio, created through the form rather than seeded into storage, so
  // the shots below are of a set the app itself built.
  const setHash = await createCharacter(page, {
    name: NAME,
    classes: [15, 0, 7],
    level: '50',
  });
  expect(setHash).toMatch(/#\/set\//);

  // Fill it with the product's own Auto-fill against the shipped catalogue.
  await page.getByRole('button', { name: /Auto-fill/i }).click();
  await expect
    .poll(
      () => page.locator('.slot-wrap button.slot.filled, .slot-wrap button.slot').evaluateAll(
        (nodes) => nodes.filter((n) => !/empty/i.test(n.className)).length,
      ),
      { timeout: 60_000 },
    )
    .toBeGreaterThan(15);
  await settle(page);

  // 02 — the set editor, paper doll filled. The core loop, closed.
  await page.screenshot({ path: `${OUT}/02-set-editor.png`, fullPage: false });

  /*
   * 03 — the ranked upgrades.
   *
   * The set is deliberately UN-filled first, and that is the whole point.
   * Auto-fill *is* the ranking, so a set it just built is optimal by
   * construction: the first run of this file photographed the flagship screen
   * reading "NOTHING OUTRANKS WHAT YOU ARE WEARING", 0/23, +0.0. A true
   * statement about a set nobody would ever have, and the worst possible
   * picture of the screen this tool is named after.
   *
   * A real player is mid-progression — some slots good, some empty, some
   * carrying whatever dropped. Nine positions are cleared here to produce that,
   * which is the state the ranking exists to answer. Nothing is faked: the
   * gains below are computed by the engine against the catalogue, and the only
   * thing staged is that the character has not finished gearing.
   */
  const FULL_SLOTS = await page.evaluate(
    () => JSON.parse(localStorage.getItem('eqlups.state.v1') ?? '{}').sets?.[0]?.slots ?? {},
  );

  const CLEARED = ['HEAD', 'CHEST', 'LEGS', 'FEET', 'HANDS', 'ARMS', 'WRIST_1', 'NECK', 'BACK'];
  await page.evaluate((positions) => {
    const key = 'eqlups.state.v1';
    const lib = JSON.parse(localStorage.getItem(key) ?? '{}');
    for (const set of lib.sets ?? []) {
      for (const p of positions) delete set.slots[p];
    }
    localStorage.setItem(key, JSON.stringify(lib));
  }, CLEARED);
  await page.goto('/#/upgrades');
  await page.reload();
  await page.waitForTimeout(2000);
  await settle(page);
  await page.screenshot({ path: `${OUT}/03-upgrades.png`, fullPage: false });

  // 04 — Planar. A differentiator: which planar pieces are open to this trio.
  await page.goto('/#/planar');
  await page.waitForTimeout(1200);
  await settle(page);
  await page.screenshot({ path: `${OUT}/04-planar.png`, fullPage: false });

  // 05 — the item browser, which shows the catalogue's size and its marks.
  await page.goto('/#/items');
  await page.waitForTimeout(1200);
  await settle(page);
  await page.screenshot({ path: `${OUT}/05-items.png`, fullPage: false });

  // 06 — Sources. The provenance page is a differentiator in its own right and
  // the owner's "better sourced" story is literally this screen.
  await page.goto('/#/sources');
  await page.waitForTimeout(1200);
  await settle(page);
  await page.screenshot({ path: `${OUT}/06-sources.png`, fullPage: false });

  /*
   * 07 — the comparison. A second set is cloned from the first and given back
   * the nine positions the first one lost, so the two differ the way a planned
   * build differs from a worn one, which is the question this screen answers.
   */
  await page.goto('/#/characters');
  await page.evaluate((FULL) => {
    const key = 'eqlups.state.v1';
    const lib = JSON.parse(localStorage.getItem(key) ?? '{}');
    const base = lib.sets?.[0];
    if (!base) return;
    lib.sets.push({
      ...structuredClone(base),
      id: `${base.id}_target`,
      name: 'Target build',
      slots: JSON.parse(JSON.stringify(FULL)),
    });
    localStorage.setItem(key, JSON.stringify(lib));
  }, FULL_SLOTS);
  /*
   * The route is `#/set/<id>/compare/<id2>`, not `#/compare/...` — I guessed
   * the latter twice and got the planner's (correct) "nothing here" page both
   * times. Read the ids back from storage and build the URL the way `href.compare`
   * does rather than assembling one by hand.
   */
  const ids = await page.evaluate(() => {
    const lib = JSON.parse(localStorage.getItem('eqlups.state.v1') ?? '{}');
    return (lib.sets ?? []).map((s: { id: string }) => s.id);
  });
  expect(ids.length).toBeGreaterThan(1);
  await page.goto(`/#/set/${encodeURIComponent(ids[0])}/compare/${encodeURIComponent(ids[1])}`);
  await page.reload();
  await page.waitForTimeout(2000);
  await settle(page);
  await page.screenshot({ path: `${OUT}/07-compare.png`, fullPage: false });
});

/*
 * Compare needs two sets and lives in the test above rather than its own,
 * because Playwright gives each test a fresh context and the library this one
 * compares is in `localStorage`. Split out, it skipped every run.
 */
