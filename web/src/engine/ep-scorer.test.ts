/**
 * The ranking scorer against the scorer it specialises.
 *
 * `rankScorer` exists only because `scoreItem` is too slow to run seven
 * thousand times per keystroke-equivalent, and the moment the two disagree the
 * picker's EP column starts lying about a number the item window computes a
 * different way. So the contract is not "close enough" — it is *the same
 * double*, for every item in the shipped catalog, at every tier, under profiles
 * that exercise every branch: capped attributes, capped resists, the synthetic
 * Void save, the endurance alias, each flat-stat spelling, skill damage mods
 * and both weapon terms.
 *
 * A drift here is invisible in the UI until someone compares two screens, which
 * is exactly how the cap-awareness bug on the compare screen survived a review.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { normalizeCatalog } from '../data/normalize';
import { ATTRIBUTE_CAP, RESIST_CAP } from './constants';
import { rankScorer, scoreItem, type ScoreContext, type WeightProfile } from './ep';
import type { Item } from './types';
import { tier, type UpgradeState } from './upgrade';

const INDEX_PATH = 'public/data/items-index.json';

function load(path: string): Item[] {
  return existsSync(path) ? normalizeCatalog(JSON.parse(readFileSync(path, 'utf8'))) : [];
}

/** Every item the pipeline published, index entries enriched by their shards. */
function shippedItems(): Item[] {
  const byName = new Map<string, Item>();
  for (const item of load(INDEX_PATH)) byName.set(item.n.toLowerCase(), item);
  if (existsSync('public/data/items')) {
    for (const file of readdirSync('public/data/items')) {
      for (const item of load(`public/data/items/${file}`)) byName.set(item.n.toLowerCase(), item);
    }
  }
  return [...byName.values()];
}

const PROFILES: Array<{ label: string; weights: WeightProfile; ctx: ScoreContext }> = [
  {
    label: 'melee, weapons counting',
    weights: { RATIO: 40, DMG: 0.5, STR: 1, DEX: 0.8, AGI: 0.5, STA: 0.6, HP: 0.1, AC: 0.3, HASTE: 2 },
    ctx: { weaponCounts: true },
  },
  {
    label: 'worn position, weapons refused',
    weights: { RATIO: 40, DMG: 0.5, AC: 2, HP: 0.2, ENDUR: 0.4 },
    ctx: { weaponCounts: false },
  },
  {
    label: 'every capped stat, against a set already near both ceilings',
    weights: {
      STR: 1, STA: 1, INT: 1, WIS: 1, AGI: 1, DEX: 1, CHA: 1,
      SV_MAGIC: 2, SV_FIRE: 2, SV_COLD: 2, SV_DISEASE: 2, SV_POISON: 2, SV_VOID: 5,
    },
    ctx: {
      existing: {
        attributes: { STR: ATTRIBUTE_CAP - 5, STA: 300, INT: ATTRIBUTE_CAP + 40, WIS: 0, AGI: 12, DEX: 509, CHA: 7 },
        saves: { MAGIC: RESIST_CAP - 3, FIRE: 500, COLD: RESIST_CAP + 100, DISEASE: 0, POISON: 999, VOID: 4 },
      },
    },
  },
  {
    label: 'cap awareness switched off',
    weights: { STR: 1, SV_MAGIC: 1 },
    ctx: {
      capAware: false,
      existing: { attributes: { STR: ATTRIBUTE_CAP }, saves: { MAGIC: RESIST_CAP } },
    },
  },
  {
    label: 'flat stats under every spelling, plus skill damage mods',
    weights: {
      HASTE: 3, REGEN: 5, HP_REGEN: 5, 'MANA REGEN': 8, MANA_REGEN: 8,
      END_REGEN: 3, ENDUR_REGEN: 3, ATTACK: 0.4,
      BACKSTAB: 2, KICK: 1, BASH: 1, FRENZY: 1, TIGER_CLAW: 1,
      DRAGON_PUNCH: 1, EAGLE_STRIKE: 1, FLYING_KICK: 1, ROUND_KICK: 1,
    },
    ctx: {},
  },
  {
    label: 'negative weights, which a player is free to enter',
    weights: { CHA: -2, HP: 0.1, DMG: -1 },
    ctx: {},
  },
  { label: 'nothing weighted at all', weights: {}, ctx: {} },
  { label: 'weights that address no scorable stat', weights: { NONSENSE: 9, DLY: 4 }, ctx: {} },
];

const TIERS: UpgradeState[] = [tier(0), tier(1), tier(3), tier(10), { full: 4, fraction: 9 }];

describe('rankScorer', () => {
  const catalog = shippedItems();

  it.skipIf(!catalog.length)(
    'returns exactly what scoreItem totals, for every shipped item at every tier',
    () => {
      let compared = 0;
      const disagreements: string[] = [];

      for (const profile of PROFILES) {
        for (const upgrade of TIERS) {
          const fast = rankScorer(profile.weights, profile.ctx);
          for (const item of catalog) {
            const slow = scoreItem(item, upgrade, profile.weights, profile.ctx).total;
            const quick = fast(item, upgrade);
            compared += 1;
            if (quick !== slow && disagreements.length < 5) {
              disagreements.push(
                `${item.n} @+${upgrade.full} under ${profile.label}: ${quick} vs ${slow}`,
              );
            }
          }
        }
      }

      expect(disagreements).toEqual([]);
      // Guard against the loop silently degenerating to nothing.
      expect(compared).toBeGreaterThan(100_000);
    },
  );

  it('agrees on hand-built edge cases the catalog may not contain', () => {
    const build = (patch: Partial<Item>): Item => ({
      id: null, n: 'Edge', sl: ['HEAD'], cl: ['ALL'], ra: ['ALL'],
      st: {}, sv: {}, fl: [], av: true, era: 'Classic', ...patch,
    });

    const cases: Item[] = [
      build({ st: { STR: -12, STA: -3 } }),
      build({ st: { END: 40 } }),
      build({ st: { ENDUR: 0, END: 40 } }),
      build({ st: { ENDUR: 25, END: 40 } }),
      // Two spellings of one save: the first present wins, and they never sum.
      build({ st: { SV_MAGIC: 30 }, sv: { MAGIC: 90 } }),
      build({ sv: { 'SV COLD': 12 } }),
      build({ st: { VOID: 6 }, sv: {} }),
      // Two trigger fields, so an upgraded copy synthesises SV Void.
      build({ st: { STR: 5, STA: 5 } }),
      // One trigger field only, so it does not.
      build({ st: { STR: 5, AC: 40 } }),
      build({ st: { STR: 5, STA: 5 }, sv: { VOID: 3 } }),
      build({ wp: { dmg: 0, dly: 40, skill: '1H Blunt' } }),
      build({ wp: { dmg: 25, dly: 0, skill: '1H Blunt' } }),
      build({ st: { HASTE: 11, ATTACK: 20, REGEN: 3, 'MANA REGEN': 4, ENDUR_REGEN: 2 } }),
      build({ st: { BACKSTAB: 7, KICK: -2 } }),
    ];

    for (const profile of PROFILES) {
      for (const upgrade of TIERS) {
        const fast = rankScorer(profile.weights, profile.ctx);
        for (const item of cases) {
          expect(
            fast(item, upgrade),
            `${JSON.stringify(item.st)}/${JSON.stringify(item.sv)} @+${upgrade.full} under ${profile.label}`,
          ).toBe(scoreItem(item, upgrade, profile.weights, profile.ctx).total);
        }
      }
    }
  });

  it('is cheaper than the scorer it stands in for', () => {
    const items = catalog.length
      ? catalog.slice(0, 4000)
      : Array.from({ length: 4000 }, (_, i) => ({
          id: null, n: `Item ${i}`, sl: ['HEAD'], cl: ['ALL'], ra: ['ALL'],
          st: { AC: i % 30, HP: i % 90, STR: i % 12 }, sv: { SV_MAGIC: i % 8 },
          fl: [], av: true, era: 'Classic',
        }) as Item);
    const weights = { AC: 2, HP: 0.2, STR: 1, STA: 1, RATIO: 20 };
    const upgrade = tier(3);

    const run = (fn: (item: Item) => number) => {
      for (const item of items) fn(item);
      const started = performance.now();
      for (const item of items) fn(item);
      return performance.now() - started;
    };

    const slow = run((item) => scoreItem(item, upgrade, weights).total);
    const fast = run(((score) => (item: Item) => score(item, upgrade))(rankScorer(weights)));

    // The whole reason this function exists. A generous bar: the measured gap
    // is far wider, and a regression that closes it is worth knowing about.
    expect(fast).toBeLessThan(slow / 2);
  });
});
