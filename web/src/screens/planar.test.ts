/**
 * The planar set resolution, against the catalog this build actually ships.
 *
 * These read `public/data/` off disk rather than a fixture, for the same reason
 * `data/shipped-catalog.test.ts` does: the set table in `planarSets.ts` is
 * transcribed from a page on another site, and a transcription is only worth
 * anything if something checks it against what we hold. If the pipeline has not
 * run, the block skips — an absent catalog is a supported state, not a failure.
 */

import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { makeContext } from '../engine/character';
import { PRESET_PROFILES, type WeightProfile } from '../engine/ep';
import type { Item } from '../engine/types';
import { BASE_STATE, tier } from '../engine/upgrade';
import { normalizeCatalog } from '../data/normalize';
import {
  PLANAR_SETS,
  PLANAR_SLOTS,
  coveredPositionCount,
  positionsFor,
  rankPlanarSlot,
  reconcilePlanarSets,
  resolvePlanarPieces,
  setsAvailable,
  uncoveredPositions,
  wearCount,
  type PlanarPiece,
} from './planarSets';

const SHARDS = PLANAR_SLOTS.map((slot) => `public/data/items/${slot}.json`);
const published = SHARDS.every((path) => existsSync(path));

function loadPlanarCatalog(): Item[] {
  const byName = new Map<string, Item>();
  for (const path of SHARDS) {
    for (const item of normalizeCatalog(JSON.parse(readFileSync(path, 'utf8')))) {
      byName.set(item.n.toLowerCase(), item);
    }
  }
  return [...byName.values()];
}

const TANK: WeightProfile = PRESET_PROFILES.find((p) => p.id === 'tank')?.weights ?? {};

/* -------------------------------------------------------- slot geometry */

describe('planar slot geometry', () => {
  it('counts Wrist twice and every other covered slot once', () => {
    expect(wearCount('WRIST')).toBe(2);
    expect(positionsFor('WRIST').map((p) => p.id)).toEqual(['WRIST_1', 'WRIST_2']);
    for (const slot of PLANAR_SLOTS) {
      if (slot === 'WRIST') continue;
      expect(wearCount(slot)).toBe(1);
    }
    expect(coveredPositionCount()).toBe(8);
  });

  it('does not offer the slots the sets do not cover', () => {
    const uncovered = uncoveredPositions().map((p) => p.type);
    // The two the tool this replaces calls out by name.
    expect(uncovered).toContain('FINGERS');
    expect(uncovered).toContain('EAR');
    // And every position on the doll is accounted for one way or the other.
    expect(uncoveredPositions().length + coveredPositionCount()).toBe(23);
  });
});

/* ------------------------------------------------------- the set table */

describe.skipIf(!published)('the transcribed set table, against the shipped catalog', () => {
  const items = loadPlanarCatalog();
  const pieces = resolvePlanarPieces(items);

  it('resolves every one of the eighteen sets to at least one piece', () => {
    const empty = reconcilePlanarSets(pieces)
      .filter((row) => row.pieces.length === 0)
      .map((row) => row.set.name);
    expect(empty).toEqual([]);
  });

  it('never disagrees with the catalog about who can wear a set', () => {
    // The set table says which class a set belongs to; the catalog says which
    // classes may wear the piece. Two sources, checked against each other. A
    // mismatch is a transcription error or a patch, and either way it must be
    // seen rather than silently regrouped.
    const mismatches = reconcilePlanarSets(pieces).flatMap((row) => row.classMismatch);
    expect(mismatches).toEqual([]);
  });

  it('files no piece under a set that has no worn planar slot', () => {
    // `Carmine Spiroc Feather` is a Plane of Sky quest item with no slot at all,
    // and a bare name-prefix match filed it under the Wizard set.
    expect(pieces.some((piece) => piece.item.n === 'Carmine Spiroc Feather')).toBe(false);
    for (const piece of pieces) {
      expect(piece.item.sl).toContain(piece.slot);
    }
  });

  it('places every piece in one of the seven covered slots', () => {
    for (const piece of pieces) expect(PLANAR_SLOTS).toContain(piece.slot);
  });

  it('holds more than a hundred pieces across eighteen sets', () => {
    // Not an exact figure: the catalog is rebuilt by a pipeline this test does
    // not own, and pinning the count would make a patch day a test failure. The
    // floor is what matters — a resolution that suddenly finds twelve pieces is
    // a broken matcher, not a smaller game.
    expect(pieces.length).toBeGreaterThan(100);
    expect(PLANAR_SETS.length).toBe(18);
  });
});

/* --------------------------------------------------------- the refusal */

describe.skipIf(!published)('an unmeasured piece is never ranked', () => {
  const pieces = resolvePlanarPieces(loadPlanarCatalog());
  const berserker = makeContext(['BER', 'WAR', 'BRD'], null, { BER: 50, WAR: 50, BRD: 50 });

  it('lists Shadow Rage by name and gives it no score', () => {
    const shadowRage = pieces.filter((piece) => piece.set.name === 'Shadow Rage');
    expect(shadowRage.length).toBeGreaterThan(0);
    // Every Shadow Rage piece this catalog holds is an existence-only record:
    // the owner reported the set and the live export holds four of them, and no
    // source anywhere publishes their stats.
    for (const piece of shadowRage) expect(piece.item.statsUnknown).toBe(true);

    const seen: string[] = [];
    for (const slot of PLANAR_SLOTS) {
      const result = rankPlanarSlot(pieces, slot, berserker, TANK);
      for (const entry of result.ranked) {
        expect(entry.piece.item.statsUnknown).not.toBe(true);
      }
      for (const piece of result.unmeasured) seen.push(piece.item.n);
    }
    expect(seen.sort()).toEqual(shadowRage.map((p) => p.item.n).sort());
  });

  it('scores nothing at zero that merely lacks a record', () => {
    for (const slot of PLANAR_SLOTS) {
      const { ranked, unmeasured } = rankPlanarSlot(pieces, slot, berserker, TANK);
      // Anything that made it into the ranking has a stat block; with a tank
      // profile every planar piece carries AC, so a genuine zero here would be
      // the fabricated one this refusal exists to prevent.
      for (const entry of ranked) expect(entry.score).toBeGreaterThan(0);
      for (const piece of unmeasured) expect(piece.item.st.AC ?? 0).toBe(0);
    }
  });
});

/* ------------------------------------------------------- the canUse gate */

describe.skipIf(!published)('eligibility runs through the same gate as the picker', () => {
  const pieces = resolvePlanarPieces(loadPlanarCatalog());

  it('withholds a race-restricted set from a shaman of the wrong race', () => {
    const runeEtched = pieces.filter((piece) => piece.set.name === 'Rune Etched');
    expect(runeEtched.length).toBeGreaterThan(0);
    // Read off the catalog rather than asserted from the wiki: the set is
    // Barbarian, Troll and Ogre only, and that is a restriction the tool this
    // replaces has no concept of at all.
    for (const piece of runeEtched) {
      expect(piece.item.ra).toEqual(expect.arrayContaining(['BAR', 'TRL', 'OGR']));
    }

    const barbarian = makeContext(['SHM', 'WAR', 'ROG'], 'BAR', { SHM: 50, WAR: 50, ROG: 50 });
    const highElf = makeContext(['SHM', 'WAR', 'ROG'], 'HEF', { SHM: 50, WAR: 50, ROG: 50 });

    const named = (ctx: ReturnType<typeof makeContext>) =>
      PLANAR_SLOTS.flatMap((slot) =>
        rankPlanarSlot(pieces, slot, ctx, TANK).ranked.map((entry) => entry.piece.set.name),
      );

    expect(named(barbarian)).toContain('Rune Etched');
    expect(named(highElf)).not.toContain('Rune Etched');
  });

  it('offers nothing at all when no trio has been chosen', () => {
    const nobody = makeContext([], null);
    for (const slot of PLANAR_SLOTS) {
      const result = rankPlanarSlot(pieces, slot, nobody, TANK);
      expect(result.ranked).toEqual([]);
      expect(result.unmeasured).toEqual([]);
    }
  });

  it('counts what it refused rather than dropping it silently', () => {
    const warrior = makeContext(['WAR', 'BRD', 'BER'], null, { WAR: 50, BRD: 50, BER: 50 });
    const chest = rankPlanarSlot(pieces, 'CHEST', warrior, TANK);
    // A Warrior/Bard/Berserker cannot wear the twelve other classes' chests.
    expect(chest.ineligible).toBeGreaterThan(0);
    const chestPieces = pieces.filter((piece) => piece.slot === 'CHEST').length;
    expect(chest.ranked.length + chest.unmeasured.length + chest.ineligible).toBe(chestPieces);
  });
});

/* ---------------------------------------------------------- the scoring */

describe.skipIf(!published)('scoring uses the real engine, not a preset expression', () => {
  const pieces = resolvePlanarPieces(loadPlanarCatalog());
  const trio = makeContext(['WAR', 'BRD', 'BER'], null, { WAR: 50, BRD: 50, BER: 50 });

  it('changes the winner when the weights change', () => {
    const acOnly = rankPlanarSlot(pieces, 'HEAD', trio, { AC: 1 });
    const chaOnly = rankPlanarSlot(pieces, 'HEAD', trio, { CHA: 1 });
    expect(acOnly.ranked[0]).toBeDefined();
    expect(chaOnly.ranked[0]).toBeDefined();
    // Indicolite Helm has the most AC of anything a Warrior trio can wear at the
    // head; Imbrued Platemail Helm carries the Charisma. A tool that only ever
    // ranked by AC could not tell those apart.
    expect(acOnly.ranked[0]?.piece.item.n).not.toBe(chaOnly.ranked[0]?.piece.item.n);
  });

  it('ranks a weighted stat above an unweighted one', () => {
    const { ranked } = rankPlanarSlot(pieces, 'CHEST', trio, { AC: 1 });
    const scores = ranked.map((entry) => entry.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    const best = ranked[0];
    expect(best).toBeDefined();
    expect(best?.score).toBe(best?.piece.item.st.AC ?? 0);
  });

  it('scores an upgraded piece above its own +0 self', () => {
    const base = rankPlanarSlot(pieces, 'CHEST', trio, TANK, BASE_STATE);
    const upgraded = rankPlanarSlot(pieces, 'CHEST', trio, TANK, tier(10));
    const byName = new Map(upgraded.ranked.map((entry) => [entry.piece.item.n, entry.score]));
    for (const entry of base.ranked) {
      expect(byName.get(entry.piece.item.n) ?? 0).toBeGreaterThan(entry.score);
    }
  });

  it('gives every piece zero when every weight is zero, and says nothing more', () => {
    const { ranked } = rankPlanarSlot(pieces, 'HANDS', trio, {});
    for (const entry of ranked) expect(entry.score).toBe(0);
    // Alphabetical, because there is nothing else to order by. Not a ranking.
    const names = ranked.map((entry) => entry.piece.item.n);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });
});

/* -------------------------------------------------- "five sets compete" */

describe.skipIf(!published)('how many sets actually compete', () => {
  const pieces = resolvePlanarPieces(loadPlanarCatalog());

  it('counts the sets open to this trio rather than repeating "five"', () => {
    // Warrior/Bard/Berserker: three class sets plus Lustrous Russet. Midnight
    // Clad is not open to any of them, so four sets compete, not five — which
    // is the claim the headline of the tool this replaces makes unconditionally.
    const wbb = setsAvailable(pieces, makeContext(['WAR', 'BRD', 'BER'], null, { WAR: 50, BRD: 50, BER: 50 }));
    expect(wbb.map((set) => set.name).sort()).toEqual(
      ['Imbrued Platemail', 'Indicolite', 'Lustrous Russet', 'Shadow Rage'].sort(),
    );

    // Rogue/Monk/Druid reaches both shared sets, so five really do compete.
    const rmd = setsAvailable(pieces, makeContext(['ROG', 'MNK', 'DRU'], null, { ROG: 50, MNK: 50, DRU: 50 }));
    expect(rmd.map((set) => set.name).sort()).toEqual(
      ['Lustrous Russet', 'Midnight Clad', 'Shiverback-hide', 'Vermiculated', 'Woven Shadow'].sort(),
    );
  });

  it('has nothing to offer a trio with no planar armour', () => {
    const pieces2: PlanarPiece[] = [];
    expect(setsAvailable(pieces2, makeContext(['WAR'], null))).toEqual([]);
  });
});
