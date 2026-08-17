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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SLOT_TYPES } from '../engine/constants';
import type { Item } from '../engine/types';
import { useCatalog } from './catalog';

const SHARD_COUNT = SLOT_TYPES.length + 1; // every slot type, plus OTHER

function shardPayload(slot: string): Item[] {
  return [
    {
      id: null,
      n: `${slot} Thing`,
      sl: [slot === 'OTHER' ? 'HEAD' : slot],
      cl: ['ALL'],
      ra: ['ALL'],
      st: { AC: 5 },
      sv: {},
      fl: [],
      av: true,
      era: 'Classic',
    },
  ];
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
    expect(state.items).toHaveLength(SHARD_COUNT - 2);
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
