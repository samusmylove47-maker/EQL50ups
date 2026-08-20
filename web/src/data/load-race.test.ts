import { afterEach, describe, it, expect, vi } from 'vitest';
import { indexItems, reindexShard, useCatalog } from './catalog';
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
 *
 * -------------------------------------------------------------------------
 * WHY THE FIRST GROUP BELOW IS NOT THE GUARD, AND THE SECOND ONE IS
 *
 * Everything under *the merge rule, in isolation* exercises `foldIndexUnder` —
 * a copy of the rule written in this file. That was the whole of this file
 * until 2026-08-20, and it guarded nothing: the shipped rule is one line in
 * `catalog.ts`'s `load()`,
 *
 *     const merged = prior.length ? mergeItems(items, prior).items : items;
 *
 * and nothing called it. Put the regression back — the wholesale replacement
 * the paragraph above describes — and measure:
 *
 *     # catalog.ts:  ...  ->  const merged = items;
 *     before this file's second group:
 *       npx vitest run src/data/load-race.test.ts  ->  6 passed   (all of them)
 *       npx vitest run                             ->  902 passed (all of them)
 *     after:
 *       npx vitest run  ->  1 failed | 905 passed, and the one failure is the
 *                           first test in the second group — the only test in
 *                           the repository that notices.
 *
 * A test that reimplements the thing it is guarding tests the copy. The copy
 * was correct, and stayed correct, while the original was free to rot.
 *
 * One trap worth recording, because it cost a wrong first attempt at this
 * comment: **swapping the two arguments is not the regression.** `mergeItems`
 * merges field by field, and an index record simply has no `rl`, `src` or `fx`
 * key to overwrite with — so `mergeItems(prior, items)` leaves the shard's
 * detail intact and every test here stays green. The failure mode is dropping
 * `prior` entirely, not reordering it.
 *
 * The first group is kept because the rule it states is worth stating and the
 * cases are cheap. The second group is the one that fails when the product
 * breaks: it drives the real store through the real race with a stubbed
 * `fetch`, in the order the network produces it.
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

describe('the merge rule, in isolation', () => {
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

/* ------------------------------------------------------------------------ */

/**
 * The same race, through the shipped code path.
 *
 * `load()` reads `get().items` and folds the index under whatever is already
 * there. Nothing above this point calls it, so nothing above this point would
 * notice the fold being written the other way round.
 */
describe('the shipped load path, driven through the real race', () => {
  const INDEX = [
    { n: 'Bladestopper', sl: ['SECONDARY'], cl: ['ALL'], ra: ['ALL'], av: true },
    { n: 'Earthshaker', sl: ['PRIMARY'], cl: ['ALL'], ra: ['ALL'], av: true },
  ];
  const SHARD = [
    {
      n: 'Bladestopper', sl: ['SECONDARY'], cl: ['ALL'], ra: ['ALL'], av: true,
      rl: 40, st: { AC: 25 },
      src: { z: ['Plane of Hate'], m: ['Innoruuk'] },
      fx: [{ k: 'proc', n: 'Rune IV' }],
    },
  ];

  /**
   * The index fetch is held open until the test releases it.
   *
   * This is what the race actually is, and the first version of this test got
   * it wrong: `load()` is called once at mount and returns early if the status
   * is already `ready`, so awaiting a shard *before* calling it does not
   * reproduce anything — it just skips the index entirely. The real sequence is
   * `load()` in flight (status `loading`, its 2 MB fetch outstanding) when the
   * 60 KB shard lands and commits.
   */
  function stubNetwork(): { releaseIndex: () => void } {
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('items-index.json')) {
        await held;
        return new Response(JSON.stringify(INDEX), { status: 200 });
      }
      if (url.includes('items/SECONDARY.json')) {
        return new Response(JSON.stringify(SHARD), { status: 200 });
      }
      if (url.includes('meta.json')) {
        return new Response(JSON.stringify({ counts: { items: INDEX.length } }), { status: 200 });
      }
      return new Response('', { status: 404 });
    }));
    return { releaseIndex: release };
  }

  function reset() {
    useCatalog.setState({
      status: 'idle', error: null, meta: null, items: [], byName: new Map(),
      bySlot: new Map(), shards: {}, indexNames: [], usingFixture: false, revision: 0,
    });
  }

  /** Run the race: index in flight, shard lands first, then the index arrives. */
  async function shardBeatsIndex(): Promise<void> {
    reset();
    const { releaseIndex } = stubNetwork();
    const loading = useCatalog.getState().load();       // not awaited: in flight
    await useCatalog.getState().ensureSlot('SECONDARY'); // the 60 KB wins
    releaseIndex();
    await loading;
  }

  afterEach(() => {
    vi.unstubAllGlobals();
    reset();
  });

  it('keeps the shard’s detail when the shard lands first', async () => {
    await shardBeatsIndex();

    const item = useCatalog.getState().byName.get('bladestopper');
    expect(item, 'the shard record survived the index load').toBeDefined();
    expect(item?.rl, 'rl gates eligibility — losing it is a correctness bug').toBe(40);
    expect(item?.src?.z).toEqual(['Plane of Hate']);
    expect(item?.fx).toHaveLength(1);
  });

  it('still adopts every name the index carries', async () => {
    await shardBeatsIndex();

    expect([...useCatalog.getState().byName.keys()].sort())
      .toEqual(['bladestopper', 'earthshaker']);
    // The share dictionary is the index's alone, whichever shards happened to load.
    expect(useCatalog.getState().indexNames.sort()).toEqual(['Bladestopper', 'Earthshaker']);
  });

  it('leaves one record per name, reachable identically by name and by slot', async () => {
    await shardBeatsIndex();

    const state = useCatalog.getState();
    expect(state.items).toHaveLength(2);
    const fromName = state.byName.get('bladestopper');
    const fromSlot = (state.bySlot.get('SECONDARY') ?? []).find((i) => i.n === 'Bladestopper');
    expect(fromSlot).toBe(fromName);
  });

  it('is unharmed when the index wins, which is the ordinary case', async () => {
    reset();
    const { releaseIndex } = stubNetwork();
    releaseIndex();
    await useCatalog.getState().load();
    await useCatalog.getState().ensureSlot('SECONDARY');

    const item = useCatalog.getState().byName.get('bladestopper');
    expect(item?.rl, 'the shard enriches the index it arrives after').toBe(40);
    expect([...useCatalog.getState().byName.keys()].sort())
      .toEqual(['bladestopper', 'earthshaker']);
  });
});
