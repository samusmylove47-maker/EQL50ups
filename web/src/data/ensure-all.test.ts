/**
 * `ensureAll` must be one commit, not nineteen.
 *
 * Every memoised selector in the app keys off `catalog.revision`, so a revision
 * bump is a re-rank of whatever picker is open. `ensureAll` used to fan out to
 * nineteen independent `ensureSlot` calls, each committing its own bump when
 * its fetch landed, which made an Any Slot picker re-score roughly seven
 * thousand candidates once per shard — twenty-one consecutive long tasks and
 * 2.6 s of blocked main thread, all of it after the dialog had already painted.
 *
 * Counting revisions is the assertion that would have caught it. The previous
 * perf test measured wall-clock time on a warm cache, which is exactly the
 * number this defect leaves untouched.
 */

import { existsSync, readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SLOT_TYPES } from '../engine/constants';
import type { Item } from '../engine/types';
import { useCatalog } from './catalog';

const SHARD_COUNT = SLOT_TYPES.length + 1; // every slot type, plus OTHER

/**
 * A two-handed weapon ships in both hand shards, exactly as `Dagas` does in the
 * real corpus: one item, two files, one entry.
 */
const SHARED = 'Two-Handed Thing';

function shardPayload(slot: string): Item[] {
  const item = (n: string, sl: string[], st: Record<string, number>): Item => ({
    id: null, n, sl, cl: ['ALL'], ra: ['ALL'], st, sv: {}, fl: [], av: true, era: 'Classic',
  });
  const out = [item(`${slot} Thing`, [slot === 'OTHER' ? 'HEAD' : slot], { AC: 5 })];
  if (slot === 'PRIMARY') out.push(item(SHARED, ['PRIMARY', 'SECONDARY'], { AC: 9, STR: 3 }));
  if (slot === 'SECONDARY') out.push(item(SHARED, ['PRIMARY', 'SECONDARY'], { AC: 9, HP: 20 }));
  return out;
}

let fetched: string[] = [];

function stubFetch(missing: ReadonlySet<string> = new Set()): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      fetched.push(url);
      const match = /items\/([A-Z_]+)\.json$/.exec(url);
      if (!match) return new Response('not found', { status: 404 });
      const slot = match[1] as string;
      if (missing.has(slot)) return new Response('not found', { status: 404 });
      // Resolve out of order, so the test cannot pass by accident of timing.
      await new Promise((resolve) => setTimeout(resolve, slot.length % 3));
      return new Response(JSON.stringify(shardPayload(slot)), { status: 200 });
    }),
  );
}

/** Serve the real published shards through the store's own loading path. */
function stubRealFetch(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input).replace(/^https?:\/\/[^/]+/, '');
      const path = `public${url.startsWith('/') ? url : `/${url}`}`;
      if (!existsSync(path)) return new Response('not found', { status: 404 });
      return new Response(readFileSync(path, 'utf8'), { status: 200 });
    }),
  );
}

function names(items: readonly Item[]): string[] {
  return items.map((item) => item.n.toLowerCase());
}

function reset(): void {
  fetched = [];
  useCatalog.setState({
    status: 'ready',
    error: null,
    meta: null,
    items: [],
    byName: new Map(),
    bySlot: new Map(),
    shards: {},
    indexNames: [],
    usingFixture: false,
    revision: 0,
  });
}

beforeEach(() => {
  reset();
  stubFetch();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ensureAll', () => {
  it('bumps the revision exactly once for all nineteen shards', async () => {
    await useCatalog.getState().ensureAll();

    expect(fetched.filter((u) => u.includes('/items/')).length).toBe(SHARD_COUNT);
    expect(useCatalog.getState().revision).toBe(1);
  });

  it('notifies subscribers about the data once, not once per shard', async () => {
    const revisions: number[] = [];
    const unsubscribe = useCatalog.subscribe((state) => revisions.push(state.revision));

    await useCatalog.getState().ensureAll();
    unsubscribe();

    // Every distinct revision a consumer saw. One for "nothing yet" is fine —
    // more than one means the picker re-ranked more than once.
    expect([...new Set(revisions)]).toEqual([0, 1]);
  });

  it('marks every shard loading in one commit before any of them land', async () => {
    const snapshots: Array<Record<string, unknown>> = [];
    const unsubscribe = useCatalog.subscribe((state) => snapshots.push({ ...state.shards }));

    const work = useCatalog.getState().ensureAll();
    // The loading flags are set synchronously, before the first await resolves.
    const loading = Object.values(useCatalog.getState().shards).filter((s) => s === 'loading');
    expect(loading).toHaveLength(SHARD_COUNT);
    await work;
    unsubscribe();

    // Two commits in total: all-loading, then all-resolved.
    expect(snapshots).toHaveLength(2);
    expect(Object.values(useCatalog.getState().shards).every((s) => s === 'ready')).toBe(true);
  });

  it('still lands every shard payload, and reports the ones with none', async () => {
    reset();
    stubFetch(new Set(['AMMO', 'RANGE']));
    await useCatalog.getState().ensureAll();

    const state = useCatalog.getState();
    expect(state.shards.AMMO).toBe('missing');
    expect(state.shards.RANGE).toBe('missing');
    expect(state.shards.HEAD).toBe('ready');
    // One per shard that landed, plus the two-handed item the two hand shards share.
    expect(state.items).toHaveLength(SHARD_COUNT - 2 + 1);
    expect(state.byName.get('head thing')?.st.AC).toBe(5);
    expect(state.bySlot.get('CHEST')?.map((i) => i.n)).toEqual(['CHEST Thing']);
    // OTHER's payload claims HEAD, so both land in the same bucket.
    expect(state.bySlot.get('HEAD')?.map((i) => i.n).sort()).toEqual(['HEAD Thing', 'OTHER Thing']);
    expect(state.revision).toBe(1);
  });

  it('does nothing at all when every shard is already in', async () => {
    await useCatalog.getState().ensureAll();
    const before = useCatalog.getState().revision;
    await useCatalog.getState().ensureAll();
    expect(useCatalog.getState().revision).toBe(before);
  });

  it('leaves a single ensureSlot as a single commit too', async () => {
    await useCatalog.getState().ensureSlot('HEAD');
    expect(useCatalog.getState().revision).toBe(1);
    expect(useCatalog.getState().shards.HEAD).toBe('ready');
    expect(useCatalog.getState().byName.get('head thing')).toBeTruthy();
  });
});

/*
 * Batching the shard loads into one commit made the merge see all nineteen
 * payloads at once, and `mergeItems` used to adopt `incoming` verbatim whenever
 * the catalog it was merging into was empty — which a cold `ensureAll` that
 * wins the race against the index load is. An item shipping in two shards
 * (`Dagas` is in both PRIMARY and SECONDARY) then landed twice, and a search
 * narrowed to "1 match" left six rows on screen. Uniqueness is the invariant to
 * hold, not the symptom to patch.
 */
describe('the catalog holds one entry per item', () => {
  it('de-duplicates a shared item when the starting catalog is empty', async () => {
    // The exact race: no index has landed, so `items` is empty when the batch
    // of shards is merged.
    expect(useCatalog.getState().items).toHaveLength(0);
    await useCatalog.getState().ensureAll();

    const state = useCatalog.getState();
    const shared = state.items.filter((item) => item.n === SHARED);
    expect(shared).toHaveLength(1);

    // Both shards' fields survive on the one entry, exactly as a sequential
    // per-shard merge produced.
    expect(shared[0]?.st).toEqual({ AC: 9, STR: 3, HP: 20 });
    expect(state.byName.get(SHARED.toLowerCase())).toBe(shared[0]);

    // And every bucket it claims lists it once.
    for (const slot of ['PRIMARY', 'SECONDARY'] as const) {
      const bucket = state.bySlot.get(slot) ?? [];
      expect(bucket.filter((item) => item.n === SHARED)).toHaveLength(1);
      expect(bucket).toContain(shared[0]);
    }
  });

  it('holds the no-duplicates invariant after a cold ensureAll', async () => {
    await useCatalog.getState().ensureAll();
    const { items, byName, bySlot } = useCatalog.getState();

    expect(items).toHaveLength(new Set(names(items)).size);
    expect(byName.size).toBe(items.length);
    for (const [slot, bucket] of bySlot) {
      expect(new Set(names(bucket)).size, `${slot} bucket lists an item twice`).toBe(bucket.length);
      for (const item of bucket) expect(byName.get(item.n.toLowerCase())).toBe(item);
    }
  });

  it('holds it when the index landed first, too', async () => {
    await useCatalog.getState().load();
    await useCatalog.getState().ensureAll();
    const { items, byName } = useCatalog.getState();
    expect(items).toHaveLength(new Set(names(items)).size);
    expect(byName.size).toBe(items.length);
  });

  /**
   * Both orders against the real files. `ensureAll` first is the losing side of
   * the race the defect needed — a cold Any Slot picker, or Auto-fill, firing
   * before `items-index.json` has landed.
   */
  for (const indexFirst of [false, true]) {
    it(`holds it against the real published shards, index ${indexFirst ? 'first' : 'last'}`, async () => {
      vi.unstubAllGlobals();
      if (!existsSync('public/data/items-index.json')) return;
      stubRealFetch();

      if (indexFirst) await useCatalog.getState().load();
      await useCatalog.getState().ensureAll();
      if (!indexFirst) await useCatalog.getState().load();

      const { items, byName, bySlot } = useCatalog.getState();
      expect(items.length).toBeGreaterThan(1000);
      expect(items).toHaveLength(new Set(names(items)).size);
      expect(byName.size).toBe(items.length);
      // A real two-hander that ships in both PRIMARY.json and SECONDARY.json.
      expect(items.filter((item) => item.n === 'Dagas')).toHaveLength(1);
      expect(byName.get('dagas')).toBe(items.find((item) => item.n === 'Dagas'));
      for (const [slot, bucket] of bySlot) {
        expect(new Set(names(bucket)).size, `${slot} bucket lists an item twice`).toBe(
          bucket.length,
        );
      }
    });
  }
});
