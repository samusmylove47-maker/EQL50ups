import { describe, it, expect } from 'vitest';
import { indexItems, reindexShard } from './catalog';
import type { Item } from '../engine/types';

/**
 * Incremental shard folding must produce exactly what a full rebuild produces.
 *
 * Loading a shard used to re-index the whole catalog — nineteen buckets across
 * every item, once per shard — which was the largest remaining block on opening
 * a slot picker. The optimisation is only safe if the index it leaves behind is
 * indistinguishable from the naive one, so every test here compares the two
 * directly rather than asserting a shape by hand.
 */

function item(n: string, sl: string[], extra: Partial<Item> = {}): Item {
  return { id: null, n, sl, cl: ['ALL'], ra: ['ALL'], st: {}, sv: {}, fl: [], av: true, ...extra };
}

/** Merge by name the way the store does, so both sides index the same array. */
function merge(existing: Item[], incoming: Item[]): Item[] {
  const out = existing.slice();
  const at = new Map(existing.map((i, idx) => [i.n.toLowerCase(), idx]));
  for (const inc of incoming) {
    const key = inc.n.toLowerCase();
    const pos = at.get(key);
    if (pos === undefined) {
      at.set(key, out.length);
      out.push(inc);
    } else {
      out[pos] = inc;
    }
  }
  return out;
}

/** Compare two indexes by content, not identity. */
function sameIndex(a: ReturnType<typeof indexItems>, b: ReturnType<typeof indexItems>) {
  expect([...a.byName.keys()].sort()).toEqual([...b.byName.keys()].sort());
  for (const [key, value] of a.byName) expect(b.byName.get(key)).toBe(value);
  for (const [slot, bucket] of a.bySlot) {
    expect(bucket.map((i) => i.n)).toEqual((b.bySlot.get(slot) ?? []).map((i) => i.n));
  }
}

function foldAndCompare(base: Item[], incoming: Item[]) {
  const merged = merge(base, incoming);
  sameIndex(reindexShard(indexItems(base), merged, incoming), indexItems(merged));
}

describe('reindexShard equals a full rebuild', () => {
  const base = [
    item('Earthshaker', ['PRIMARY']),
    item('Cloak of Flames', ['BACK']),
    item('Bladestopper', ['SECONDARY']),
    item('Indicolite Helm', ['HEAD']),
  ];

  it('when a shard enriches an existing record', () => {
    foldAndCompare(base, [item('Earthshaker', ['PRIMARY'], { wt: 16, st: { STR: 6 } })]);
  });

  it('when a shard introduces names the index did not carry', () => {
    foldAndCompare(base, [item('Turmoil Warts', ['AMMO']), item('New Ring', ['FINGERS'])]);
  });

  it('when an incoming record claims two slots', () => {
    foldAndCompare(base, [item('Whitened Treant Fists', ['PRIMARY', 'SECONDARY'])]);
  });

  it('when an incoming record disagrees with the slot it displaces', () => {
    // The displaced record's old bucket must be rebuilt too, or it keeps a
    // stale entry pointing at an item that no longer belongs to it.
    foldAndCompare(base, [item('Earthshaker', ['SECONDARY'])]);
  });

  it('across a sequence of shard loads, as a real session does', () => {
    let items = base;
    let index = indexItems(items);
    for (const shard of [
      [item('Earthshaker', ['PRIMARY'], { wt: 16 })],
      [item('Indicolite Helm', ['HEAD'], { st: { AC: 20 } })],
      [item('Bone-Clasped Girdle', ['WAIST'])],
    ]) {
      items = merge(items, shard);
      index = reindexShard(index, items, shard);
    }
    sameIndex(index, indexItems(items));
  });

  it('when the shard is empty', () => {
    foldAndCompare(base, []);
  });

  it('keys names case-insensitively, as the picker looks them up', () => {
    const index = indexItems([item("Djarn's Amethyst Ring", ['FINGERS'])]);
    expect(index.byName.get("djarn's amethyst ring")).toBeDefined();
  });
});
