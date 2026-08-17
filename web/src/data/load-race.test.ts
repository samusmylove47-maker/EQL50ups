import { describe, it, expect } from 'vitest';
import { indexItems, reindexShard } from './catalog';
import type { Item } from '../engine/types';

/**
 * The index must not overwrite shard detail that has already arrived.
 *
 * `items-index.json` is about 2 MB; a slot shard is about 60 KB. On a slow
 * connection the shard genuinely wins, merges into an empty catalog, and marks
 * itself `ready`. The index load then used to replace `items` wholesale — so
 * every `src`, `fx` and `rl` the shard had contributed vanished, and because
 * the shard still read `ready` it was never fetched again. `rl` gates
 * eligibility, so this was a correctness bug, not just missing detail.
 *
 * The index is the *base*; anything a shard already enriched wins over it.
 */

function indexRecord(n: string, sl: string[]): Item {
  return { id: null, n, sl, cl: ['ALL'], ra: ['ALL'], st: {}, sv: {}, fl: [], av: true };
}

function shardRecord(n: string, sl: string[]): Item {
  return {
    ...indexRecord(n, sl),
    rl: 40,
    src: { z: ['Plane of Hate'], m: ['Innoruuk'] },
    fx: [{ k: 'proc', n: 'Rune IV' }],
    st: { AC: 25 },
  };
}

/** The store's rule: index first, then whatever a shard already enriched. */
function foldIndexUnder(indexItemsList: Item[], prior: Item[]): Item[] {
  const out = indexItemsList.slice();
  const at = new Map(out.map((i, idx) => [i.n.toLowerCase(), idx]));
  for (const item of prior) {
    const key = item.n.toLowerCase();
    const pos = at.get(key);
    if (pos === undefined) {
      at.set(key, out.length);
      out.push(item);
    } else {
      out[pos] = { ...(out[pos] as Item), ...item };
    }
  }
  return out;
}

describe('a shard that beats the index keeps its detail', () => {
  const shardFirst = [shardRecord('Bladestopper', ['SECONDARY'])];
  const index = [
    indexRecord('Bladestopper', ['SECONDARY']),
    indexRecord('Earthshaker', ['PRIMARY']),
  ];

  it('keeps the required level, which gates eligibility', () => {
    const merged = foldIndexUnder(index, shardFirst);
    expect(merged.find((i) => i.n === 'Bladestopper')?.rl).toBe(40);
  });

  it('keeps acquisition sources and effects', () => {
    const merged = foldIndexUnder(index, shardFirst);
    const item = merged.find((i) => i.n === 'Bladestopper');
    expect(item?.src?.z).toEqual(['Plane of Hate']);
    expect(item?.fx).toHaveLength(1);
  });

  it('still adopts every name the index carries', () => {
    const merged = foldIndexUnder(index, shardFirst);
    expect(merged.map((i) => i.n).sort()).toEqual(['Bladestopper', 'Earthshaker']);
  });

  it('leaves exactly one entry per name', () => {
    const merged = foldIndexUnder(index, shardFirst);
    expect(merged.length).toBe(new Set(merged.map((i) => i.n.toLowerCase())).size);
  });

  it('points every index structure at the surviving record', () => {
    const merged = foldIndexUnder(index, shardFirst);
    const { byName, bySlot } = indexItems(merged);
    const fromName = byName.get('bladestopper');
    const fromSlot = (bySlot.get('SECONDARY') ?? []).find((i) => i.n === 'Bladestopper');
    expect(fromName?.rl).toBe(40);
    // One object, not two views of one name — this drifted apart once before.
    expect(fromSlot).toBe(fromName);
  });

  it('survives a later shard folding in on top', () => {
    const merged = foldIndexUnder(index, shardFirst);
    const nextShard = [shardRecord('Earthshaker', ['PRIMARY'])];
    const after = foldIndexUnder(merged, nextShard);
    const idx = reindexShard(indexItems(merged), after, nextShard);
    expect(idx.byName.get('earthshaker')?.rl).toBe(40);
    expect(idx.byName.get('bladestopper')?.rl).toBe(40);
  });
});
