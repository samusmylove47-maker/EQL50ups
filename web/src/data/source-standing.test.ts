/**
 * Provenance, measured on the payload the browser actually downloads.
 *
 * `research/SOURCING-STANDARD.md` rule 5 — *"a player looking at a number is
 * entitled to know whether it came from the game or from a wiki page of
 * uncertain provenance"* — is a claim about coverage, so it is tested as one:
 * every shipped record must state a standing, and the counts per standing are
 * asserted exactly rather than described.
 *
 * The two facts are checked separately on purpose. They were one fact once, and
 * the conflation printed "Tier M · confirmed in the live game" over Orb of
 * Tishan's wiki stat block while leaving Earthshaker — the only stat block in
 * this project checked digit-for-digit against a live client window — bare.
 * Both items are named below so that particular inversion cannot come back.
 *
 * Skips if the pipeline has not published, which is a supported state.
 */

import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Item } from '../engine/types';
import { TIER0_ERA_RESCUE_ITEMS } from '../engine/constants';
import { normalizeCatalog, normalizeItem } from './normalize';
import { existenceMark, isStatClientVerified, sourceStanding } from '../lib/itemStyle';

const INDEX_PATH = 'public/data/items-index.json';
const META_PATH = 'public/data/meta.json';
const published = existsSync(INDEX_PATH) && existsSync(META_PATH);

const items: Item[] = published
  ? normalizeCatalog(JSON.parse(readFileSync(INDEX_PATH, 'utf8')))
  : [];
const meta = published ? JSON.parse(readFileSync(META_PATH, 'utf8')) : null;
const byName = new Map(items.map((i) => [i.n.toLowerCase(), i]));
const get = (name: string): Item => {
  const item = byName.get(name.toLowerCase());
  if (!item) throw new Error(`${name} is not in the shipped catalog`);
  return item;
};

/**
 * Counts as measured against the payload built on 2026-08-17 from
 * `pipeline/build.mjs`. Asserted exactly, not approximately: the point of the
 * exercise is that the numbers are known and stay known, and a silent drift in
 * how much of the catalog can state its provenance is exactly the regression
 * this file exists to catch.
 */
const EXPECTED_STANDING = {
  'tier-M': 5,
  'tier-2': 2045,
  'tier-5': 126,
  unattributed: 1477,
} as const;
const EXPECTED_TOTAL = 3653;
/**
 * Four marks now, in strength order, and the two new ones come from EQL Source's
 * own published datasets rather than from this repository.
 *
 * `measured-drop` is `sightings.v1.json`: a mob was watched dropping the item in
 * parsed combat logs. `eqlsource-id` is `items.v1.json`, the name-to-game-ID
 * table built from `/outputfile inventory` dumps across more characters than
 * this repo's single export.
 *
 * `player-report` is absent, and that is the hierarchy working rather than a
 * regression. It only ever covered the Shadow Rage set, and all six pieces now
 * carry harder evidence: three were measured dropping in the Plane of Hate
 * (Sleeves off a forsaken revenant and an ire ghast, Wristguard off an
 * abhorrent, Leggings off Innoruuk's Chosen), and three sit in the client
 * export. The owner's report was right, and it has been superseded by
 * measurement — which is exactly what Tier M is for.
 */
const EXPECTED_EXISTENCE = {
  'measured-drop': 275,
  'live-export': 190,
  'eqlsource-id': 93,
} as const;

describe.skipIf(!published)('every shipped item states where its numbers came from', () => {
  it('ships the number of items the counts are measured against', () => {
    expect(items.length).toBe(EXPECTED_TOTAL);
  });

  it('leaves no row silent — 100% of the catalog carries a standing', () => {
    const silent = items.filter((i) => i.sd === undefined);
    expect(silent.map((i) => i.n)).toEqual([]);
  });

  it('counts each standing exactly', () => {
    const tally: Record<string, number> = {};
    for (const item of items) tally[item.sd ?? '(none)'] = (tally[item.sd ?? '(none)'] ?? 0) + 1;
    expect(tally).toEqual(EXPECTED_STANDING);
    // And the four buckets are the whole catalog, with nothing double-counted.
    expect(Object.values(EXPECTED_STANDING).reduce((a, b) => a + b, 0)).toBe(EXPECTED_TOTAL);
  });

  it('counts each existence mark exactly, and does not conflate it with standing', () => {
    const tally: Record<string, number> = {};
    for (const item of items) if (item.ex) tally[item.ex] = (tally[item.ex] ?? 0) + 1;
    expect(tally).toEqual(EXPECTED_EXISTENCE);

    // 558 items are known to exist; 5 have client-verified numbers. If those
    // two ever coincide, one fact has swallowed the other again.
    const exists = items.filter((i) => i.ex).length;
    const verified = items.filter((i) => i.sd === 'tier-M').length;
    expect(exists).toBe(558);
    expect(verified).toBe(5);
    expect(exists).not.toBe(verified);
  });

  it('publishes the same counts in meta, so the payload documents itself', () => {
    expect(meta.counts.standing).toEqual(EXPECTED_STANDING);
    expect(meta.counts.existence).toEqual(EXPECTED_EXISTENCE);
    expect(meta.sourceStanding.existence.field).toBe('ex');
    expect(meta.sourceStanding.stats.field).toBe('sd');
    expect(meta.sourceStanding.stats.vocabulary.map((v: { code: string }) => v.code))
      .toEqual(['tier-M', 'tier-2', 'tier-5', 'unattributed']);
  });
});

describe.skipIf(!published)('the standing follows from evidence, never from a guess', () => {
  it('gives every tier-M row a citation and the fields the client actually covered', () => {
    const verified = items.filter((i) => i.sd === 'tier-M');
    expect(verified.map((i) => i.n).sort()).toEqual([
      'Bladestopper', 'Bone-Clasped Girdle', 'Cloak of Flames', 'Earthshaker',
      'Whitened Treant Fists',
    ]);
    for (const item of verified) {
      expect(item.sdc, `${item.n} citation`).toMatch(/TIER0-VALIDATION\.md/);
      expect(item.vf?.length, `${item.n} verified fields`).toBeGreaterThan(0);
      // A client window is a sighting too: nothing can have verified stats
      // without the game having handed the item to somebody.
      // At least export-grade. `measured-drop` is stronger, not different.
      expect(['measured-drop', 'live-export'], `${item.n} existence`).toContain(item.ex);
    }
  });

  it('never claims a number is client-verified when no capture covers it', () => {
    // The Earthshaker captures cover damage, delay, Strength and Stamina. Its
    // DEX -5 appears in no client window in the validation set, so the row is
    // Tier M and that one field is not.
    const earthshaker = get('Earthshaker');
    expect(earthshaker.vf).toEqual(['DLY', 'DMG', 'STA', 'STR']);
    expect(isStatClientVerified(earthshaker, 'STR')).toBe(true);
    expect(isStatClientVerified(earthshaker, 'DEX')).toBe(false);
    expect(earthshaker.st.DEX).toBe(-5);

    // And no other row borrows the claim.
    const claiming = items.filter((i) => i.vf?.length && i.sd !== 'tier-M');
    expect(claiming.map((i) => i.n)).toEqual([]);
  });

  it('marks era-unplaced stat blocks tier-5, and only those', () => {
    const IN_ERA = new Set(['Classic', 'Fear', 'Hate', 'Paineel', 'Temple', 'Sky']);
    const tier5 = items.filter((i) => i.sd === 'tier-5');
    expect(tier5.length).toBe(126);
    for (const item of tier5) {
      // Either no era anywhere, or an era past this game's content.
      expect(IN_ERA.has(item.era ?? ''), `${item.n} era ${item.era}`).toBe(false);
      // And it prints numbers — a row with nothing on it is unattributed, not
      // distrusted. Red is spent on numbers that could be wrong.
      const numbers = Object.keys(item.st).length || Object.keys(item.sv).length || item.wp;
      expect(Boolean(numbers), `${item.n} prints numbers`).toBe(true);
    }
    // Every tier-2 row is the converse: in era, and carrying numbers.
    for (const item of items.filter((i) => i.sd === 'tier-2')) {
      expect(IN_ERA.has(item.era ?? ''), `${item.n} era ${item.era}`).toBe(true);
    }
  });

  it('never tiers a row whose stats are withheld', () => {
    const withheld = items.filter((i) => i.statsUnknown);
    expect(withheld.length).toBe(6);
    for (const item of withheld) {
      expect(item.sd, `${item.n}`).toBe('unattributed');
      expect(sourceStanding(item).label).toBe('Unattributed · stats withheld');
      // Shadow Rage is confirmed to exist and has no sourced numbers. Both
      // halves are said, separately.
      expect(item.ex, `${item.n} existence`).toBeDefined();
    }
  });
});

describe.skipIf(!published)('the two items the inverted mark was measured on', () => {
  /*
   * Orb of Tishan: `DMG 7 DLY 25 MANA +35 STR +9 STA +9`, every digit a wiki
   * scrape of a page tagged Kunark. It is in the catalog because the export
   * holds it. Both facts, stated apart.
   */
  it('Orb of Tishan is vouched for as an item and distrusted as a stat block', () => {
    const orb = get('Orb of Tishan');
    expect(orb.era).toBe('Kunark');
    expect(orb.wp).toEqual({ dmg: 7, dly: 25, skill: '1H Blunt' });

    // Orb of Tishan is held in the export and has NOT been measured dropping,
    // so it keeps the weaker of the two marks. Earthshaker has both and shows
    // the stronger — which is the whole point of ordering them.
    expect(existenceMark(orb)?.label).toBe('Tier M · held in a live inventory');
    expect(sourceStanding(orb).label).toBe('Tier 5 · wiki stats, era unplaced');
    expect(sourceStanding(orb).band).toBe('distrust');
    // The claim it used to make, and must never make again.
    expect(sourceStanding(orb).label).not.toMatch(/read off the client/);
    expect(orb.vf).toBeUndefined();
  });

  /*
   * Earthshaker: nine of nine predictions exact against a live client window,
   * and until now the app said nothing about it at all.
   */
  it('Earthshaker carries the mark its evidence earned', () => {
    const earthshaker = get('Earthshaker');
    expect(earthshaker.wp?.dmg).toBe(37);
    expect(earthshaker.wp?.dly).toBe(70);
    expect(earthshaker.st.STR).toBe(6);
    expect(earthshaker.st.STA).toBe(6);

    expect(sourceStanding(earthshaker).standing).toBe('tier-M');
    expect(sourceStanding(earthshaker).label).toBe('Tier M · stats read off the client');
    expect(sourceStanding(earthshaker).band).toBe('trusted');
    expect(existenceMark(earthshaker)?.label).toBe('Tier M · seen dropping in game');
    expect(sourceStanding(earthshaker).citation).toContain('Nine of nine predictions exact');
  });
});

describe.skipIf(!published)('the era-purge rescue list is a rescue list, not an inventory', () => {
  /*
   * `TIER0_ERA_RESCUE_ITEMS` was the source of the inverted mark: it is the
   * nineteen out-of-era names Tier 0 evidence keeps in the catalog, and it was
   * read as "the items seen in the live game". Both halves of that are checked
   * here — every name really is rescued (out of era, and vouched for), and the
   * list is nowhere near the export it was mistaken for.
   */
  it('every rescued name ships, is out of era, and carries Tier M existence', () => {
    const bad: string[] = [];
    for (const lower of TIER0_ERA_RESCUE_ITEMS) {
      const item = byName.get(lower);
      if (!item) { bad.push(`${lower}: not in the catalog`); continue; }
      if (item.era !== null && item.era !== undefined && item.era !== 'Kunark') {
        bad.push(`${item.n}: era ${item.era} needed no rescue`);
      }
      if (!item.ex) bad.push(`${item.n}: rescued with no Tier M evidence`);
    }
    expect(bad).toEqual([]);
    expect(TIER0_ERA_RESCUE_ITEMS.size).toBe(19);
  });

  it('is a small fraction of what the export actually vouches for', () => {
    // 19 names against 558 items the game is known to hold. Treating the first
    // number as the second is what put the strongest label in the vocabulary on
    // twelve wiki stat blocks.
    const vouched = items.filter((i) => i.ex).length;
    expect(TIER0_ERA_RESCUE_ITEMS.size).toBeLessThan(vouched / 10);
    const rescuedAndVerified = items.filter(
      (i) => i.sd === 'tier-M' && TIER0_ERA_RESCUE_ITEMS.has(i.n.toLowerCase()),
    );
    // None of the client-verified stat blocks is on that list at all, which is
    // exactly why reading it as evidence about stats produced a blank window.
    expect(rescuedAndVerified.map((i) => i.n)).toEqual([]);
  });
});

describe('the normaliser carries provenance and refuses to invent it', () => {
  it('carries both facts through unchanged', () => {
    const item = normalizeItem({
      n: 'Bladestopper', sl: ['ANY'], st: { AC: 25 },
      ex: 'measured-drop', sd: 'tier-M', sdc: 'TIER0-VALIDATION.md §5', vf: ['AC'],
    });
    expect(['measured-drop', 'live-export']).toContain(item?.ex);
    expect(item?.sd).toBe('tier-M');
    expect(item?.sdc).toBe('TIER0-VALIDATION.md §5');
    expect(item?.vf).toEqual(['AC']);
  });

  it('drops a standing outside the published vocabulary rather than showing it', () => {
    const item = normalizeItem({ n: 'Forged', sd: 'tier-best', ex: 'a friend told me' });
    expect(item?.sd).toBeUndefined();
    expect(item?.ex).toBeUndefined();
    // Which reads as the honest default, not as a trusted one.
    expect(sourceStanding(item!).standing).toBe('unattributed');
    expect(sourceStanding(item!).band).toBe('unattributed');
    expect(existenceMark(item!)).toBeNull();
  });

  it('reads an absent standing as unattributed, never as silence', () => {
    const item = normalizeItem({ n: 'Rusty Dagger', st: { AC: 1 } });
    expect(sourceStanding(item!).label).toBe('Unattributed · no sourced stats');
    // Including in the short form a table cell would use: a word, not a dash.
    expect(sourceStanding(item!).short).toBe('Unattributed');
  });

  it('offers a short form for surfaces with no room for the eyebrow', () => {
    const shorts = (['tier-M', 'tier-2', 'tier-5', 'unattributed'] as const).map(
      (sd) => sourceStanding({ ...({} as Item), n: 'x', sd }).short,
    );
    expect(shorts).toEqual(['Tier M', 'Tier 2', 'Tier 5', 'Unattributed']);
  });
});
