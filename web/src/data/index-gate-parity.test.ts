/**
 * The verdict the app gives before the shards land must be the verdict it gives
 * after.
 *
 * `items-index.json` is ~693 KB and lands first; the nineteen per-slot shards
 * are ~1.6 MB and land later. Everything that judges eligibility — the pickers,
 * the ranking, the paper doll, Auto-fill — runs against whatever the catalog
 * holds at the moment it runs, which for the first stretch of every visit is
 * the index alone. `Upgrades.tsx` documents that same pre-shard paint for
 * acquisition data.
 *
 * So any field `canUse` reads that rides only the shards is a gate that does
 * not run during that window. `rl` was one: three shipped records carried a
 * required level in their shard and none in the index, so a level-10 character
 * was offered a level-15 Refugee Shroud until `SHOULDERS.json` arrived, and
 * then watched it vanish.
 *
 * `pipeline/verify.mjs` asserts the same property as a fact about the payload's
 * *shape* — every gate field present on a shard record is present and equal on
 * the index record. This asserts it as a fact about the app's *behaviour*, by
 * running the real `canUse` over both catalogs and comparing the answers. Two
 * instruments of different kinds: a shape check cannot see a field the gate
 * stops reading, and this cannot see a field no shipped record happens to
 * carry.
 */

import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { canUse, makeContext } from '../engine/character';
import { CLASSES, SLOT_TYPES } from '../engine/constants';
import type { Item } from '../engine/types';
import { normalizeCatalog } from './normalize';

const INDEX = 'public/data/items-index.json';
const published = existsSync(INDEX);

function readIndex(): Item[] {
  return normalizeCatalog(JSON.parse(readFileSync(INDEX, 'utf8')));
}

/** The index with every shard merged over it, the way `catalog.ts` merges them. */
function readMerged(): Item[] {
  const items = readIndex();
  const at = new Map(items.map((item, i) => [item.n.toLowerCase(), i]));
  for (const slot of [...SLOT_TYPES, 'OTHER']) {
    const path = `public/data/items/${slot}.json`;
    if (!existsSync(path)) continue;
    for (const detail of normalizeCatalog(JSON.parse(readFileSync(path, 'utf8')))) {
      const key = detail.n.toLowerCase();
      const i = at.get(key);
      if (i === undefined) {
        at.set(key, items.length);
        items.push(detail);
      } else {
        const before = items[i] as Item;
        items[i] = { ...before, ...detail, st: { ...before.st, ...detail.st } };
      }
    }
  }
  return items;
}

/**
 * Levels chosen to straddle every required level the payload actually ships,
 * read off the payload rather than picked: a level above them all would make
 * this pass no matter what the index omitted.
 */
function probeLevels(merged: readonly Item[]): number[] {
  const required = [...new Set(merged.map((i) => i.rl).filter((v): v is number => !!v))];
  const levels = new Set<number>([1, 50]);
  for (const level of required) {
    levels.add(Math.max(1, level - 1));
    levels.add(level);
  }
  return [...levels].sort((a, b) => a - b);
}

describe.skipIf(!published)('eligibility does not change when the shards arrive', () => {
  const index = readIndex();
  const merged = readMerged();
  const byName = new Map(merged.map((item) => [item.n.toLowerCase(), item]));

  it('the payload actually carries a required level, or this proves nothing', () => {
    // Guard against the guard: if `rl` ever stops shipping, the parity test
    // below passes vacuously and would go on passing while the gate rotted.
    const carrying = merged.filter((item) => item.rl);
    expect(carrying.length, 'shipped records carrying rl').toBeGreaterThan(0);
    // And the index must be where the check can reach it before the shards do.
    expect(index.filter((item) => item.rl).length).toBe(carrying.length);
  });

  it('gives the same verdict from the index alone as from the whole catalog', () => {
    const levels = probeLevels(merged);
    const disagreements: string[] = [];
    let compared = 0;

    for (const level of levels) {
      const context = makeContext(
        [...CLASSES],
        null,
        Object.fromEntries(CLASSES.map((code) => [code, level])),
      );
      for (const lean of index) {
        const full = byName.get(lean.n.toLowerCase());
        if (!full) continue;
        compared += 1;
        const before = canUse({ classes: lean.cl, races: lean.ra, ...(lean.rl ? { rl: lean.rl } : {}) }, context);
        const after = canUse({ classes: full.cl, races: full.ra, ...(full.rl ? { rl: full.rl } : {}) }, context);
        if (before !== after) {
          disagreements.push(`${lean.n} at level ${level}: index says ${before}, shards say ${after}`);
        }
      }
    }

    expect(compared, 'comparisons made').toBeGreaterThan(1000);
    expect(disagreements, `${disagreements.length} items change verdict when their shard lands`)
      .toEqual([]);
  });
});
