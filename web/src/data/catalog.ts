/**
 * Catalog store: loads the shipped item data and keeps it indexed.
 *
 * Layout expected under `${BASE_URL}data/`:
 *   meta.json           — CatalogMeta (version, counts, attribution)
 *   items-index.json    — every item, ideally lightweight
 *   items/<SLOT>.json   — per-slot detail shards, lazily fetched
 *
 * All three are optional. A missing index is an empty state, not an error;
 * a missing shard just means the index entries stand alone. The pipeline that
 * produces these files is owned by another process and may not have run yet.
 */

import { create } from 'zustand';
import { ATTRIBUTION, SLOT_TYPES } from '../engine/constants';
import type { CatalogMeta, Item } from '../engine/types';
import { finite } from '../lib/format';
import { FIXTURE_ITEMS } from './fixture';
import { normalizeCatalog, type SlotCode } from './normalize';

/**
 * Shards the pipeline emits that are not paper-doll slot types. `OTHER`
 * carries everything with no wearable slot (potions, components, tradeskill
 * items) and is only needed by the global browser.
 */
const EXTRA_SHARDS = ['OTHER'];

export type CatalogStatus = 'idle' | 'loading' | 'ready' | 'missing' | 'error';
export type ShardStatus = 'loading' | 'ready' | 'missing';

/**
 * One published focus effect: a name, prose, and the client's per-spell-slot
 * breakdown. There are **no numbers a planner could score** in here — that is
 * the point of shipping it. It exists so an exaltation can be described
 * accurately instead of being reduced to a made-up stat contribution.
 */
export interface FocusEffectEntry {
  n: string;
  d?: string;
  sl?: Array<{ s: number; e: string }>;
}

export interface CatalogState {
  status: CatalogStatus;
  error: string | null;
  meta: CatalogMeta | null;
  items: Item[];
  byName: Map<string, Item>;
  bySlot: Map<SlotCode, Item[]>;
  shards: Record<string, ShardStatus | undefined>;
  /**
   * Item names exactly as the index published them, captured once at load.
   *
   * The share dictionary keys off this rather than off `items`, which grows as
   * slot shards arrive: two clients that had loaded different shards would
   * otherwise build different dictionaries and refuse each other's links. The
   * index is verified to carry every name the shards do.
   */
  indexNames: string[];
  /** Published focus-effect descriptions, keyed by lowercased effect name. */
  effects: Map<string, FocusEffectEntry>;
  effectsStatus: 'idle' | 'loading' | 'ready' | 'missing';
  usingFixture: boolean;
  /** Bumped on every mutation; memoised selectors key off it. */
  revision: number;
  load: () => Promise<void>;
  ensureSlot: (slot: SlotCode) => Promise<void>;
  ensureAll: () => Promise<void>;
  ensureEffects: () => Promise<void>;
  loadFixture: () => void;
}

function dataUrl(path: string): string {
  const base = (import.meta.env?.BASE_URL ?? '/').replace(/\/+$/, '');
  return `${base}/data/${path}`;
}

/** Fetch and parse JSON. `null` means "not published", which is not an error. */
async function fetchJson(path: string): Promise<unknown | null> {
  const response = await fetch(dataUrl(path), { cache: 'no-cache' });
  if (response.status === 404 || response.status === 403) return null;
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const text = await response.text();
  const trimmed = text.trim();
  // A dev server with SPA fallback answers 200 with index.html for missing files.
  if (!trimmed || trimmed.startsWith('<')) return null;
  return JSON.parse(trimmed) as unknown;
}

/** The pipeline's meta file uses its own field names; accept either spelling. */
function normalizeMeta(raw: unknown): CatalogMeta | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const record = raw as Record<string, unknown>;
  const counts =
    typeof record.counts === 'object' && record.counts !== null
      ? (record.counts as Record<string, number>)
      : {};
  return {
    version: finite(record.version ?? record.v, 1),
    generated:
      typeof record.generated === 'string'
        ? record.generated
        : typeof record.builtAt === 'string'
          ? record.builtAt
          : '',
    counts,
    attribution: typeof record.attribution === 'string' ? record.attribution : ATTRIBUTION,
    sources: record.sources,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

interface CatalogIndex {
  byName: Map<string, Item>;
  bySlot: Map<SlotCode, Item[]>;
}

export function indexItems(items: Item[]): CatalogIndex {
  const byName = new Map<string, Item>();
  const bySlot = new Map<SlotCode, Item[]>();
  for (const slot of SLOT_TYPES) bySlot.set(slot, []);
  bySlot.set('ANY', []);

  for (const item of items) {
    byName.set(item.n.toLowerCase(), item);
    for (const slot of item.sl) {
      const bucket = bySlot.get(slot as SlotCode);
      if (bucket) bucket.push(item);
    }
  }
  return { byName, bySlot };
}

/**
 * Fold one loaded shard into an existing index.
 *
 * A shard replaces index-level records with richer ones for a single slot, but
 * the previous implementation re-ran the full `indexItems` over the whole
 * catalog each time — rebuilding all nineteen buckets across 11,249 items on
 * every shard load, eighteen times over a session. That was the largest single
 * block left on opening a slot picker.
 *
 * Only the buckets an incoming item can appear in are rebuilt: the slots it
 * claims, plus the slots of whatever record it displaces, in case the two
 * disagree. Everything else keeps its existing array.
 */
export function reindexShard(prev: CatalogIndex, items: Item[], incoming: Item[]): CatalogIndex {
  const byName = new Map(prev.byName);
  const touched = new Set<SlotCode>();

  for (const item of incoming) {
    const key = item.n.toLowerCase();
    const displaced = prev.byName.get(key);
    byName.set(key, item);
    for (const slot of item.sl) touched.add(slot as SlotCode);
    if (displaced) for (const slot of displaced.sl) touched.add(slot as SlotCode);
  }

  const bySlot = new Map(prev.bySlot);
  if (touched.size) {
    const rebuilt = new Map<SlotCode, Item[]>();
    for (const slot of touched) rebuilt.set(slot, []);
    for (const item of items) {
      for (const slot of item.sl) {
        rebuilt.get(slot as SlotCode)?.push(item);
      }
    }
    for (const [slot, bucket] of rebuilt) bySlot.set(slot, bucket);
  }

  return { byName, bySlot };
}

/**
 * Merge detail entries over index entries by name. Detail wins field by field
 * so a shard can enrich an index entry without discarding what it already had.
 */
function mergeItems(existing: Item[], incoming: Item[]): Item[] {
  if (!existing.length) return incoming;
  const position = new Map<string, number>();
  existing.forEach((item, i) => position.set(item.n.toLowerCase(), i));
  const merged = existing.slice();
  for (const item of incoming) {
    const key = item.n.toLowerCase();
    const at = position.get(key);
    if (at === undefined) {
      position.set(key, merged.length);
      merged.push(item);
    } else {
      const before = merged[at] as Item;
      merged[at] = {
        ...before,
        ...item,
        st: { ...before.st, ...item.st },
        sv: { ...before.sv, ...item.sv },
        sl: item.sl.length ? item.sl : before.sl,
        cl: item.cl.length ? item.cl : before.cl,
        fl: item.fl.length ? item.fl : before.fl,
      };
    }
  }
  return merged;
}

export const useCatalog = create<CatalogState>((set, get) => ({
  status: 'idle',
  error: null,
  meta: null,
  items: [],
  byName: new Map(),
  bySlot: new Map(),
  shards: {},
  indexNames: [],
  effects: new Map(),
  effectsStatus: 'idle',
  usingFixture: false,
  revision: 0,

  async load() {
    if (get().status === 'loading' || get().status === 'ready') return;
    set({ status: 'loading', error: null });
    try {
      const [metaRaw, indexRaw] = await Promise.all([
        fetchJson('meta.json').catch(() => null),
        fetchJson('items-index.json'),
      ]);

      const items = normalizeCatalog(indexRaw);
      if (!items.length) {
        set({
          status: 'missing',
          meta: normalizeMeta(metaRaw),
          items: [],
          byName: new Map(),
          bySlot: new Map(),
          revision: get().revision + 1,
        });
        return;
      }

      set({
        status: 'ready',
        meta: normalizeMeta(metaRaw),
        items,
        indexNames: items.map((item) => item.n),
        ...indexItems(items),
        revision: get().revision + 1,
      });
    } catch (error) {
      set({
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
        revision: get().revision + 1,
      });
    }
  },

  async ensureSlot(slot) {
    const state = get();
    if (state.usingFixture) return;
    if (slot === 'ANY') {
      await state.ensureAll();
      return;
    }
    if (state.shards[slot]) return;
    set({ shards: { ...get().shards, [slot]: 'loading' } });
    try {
      const raw = await fetchJson(`items/${slot}.json`);
      const incoming = normalizeCatalog(raw);
      if (!incoming.length) {
        set({ shards: { ...get().shards, [slot]: 'missing' } });
        return;
      }
      const before = get();
      const items = mergeItems(before.items, incoming);
      set({
        items,
        ...reindexShard({ byName: before.byName, bySlot: before.bySlot }, items, incoming),
        shards: { ...get().shards, [slot]: 'ready' },
        status: 'ready',
        revision: get().revision + 1,
      });
    } catch {
      set({ shards: { ...get().shards, [slot]: 'missing' } });
    }
  },

  async ensureAll() {
    const state = get();
    if (state.usingFixture) return;
    const wanted = [...SLOT_TYPES, ...EXTRA_SHARDS] as SlotCode[];
    await Promise.all(wanted.filter((s) => !state.shards[s]).map((s) => get().ensureSlot(s)));
  },

  async ensureEffects() {
    if (get().effectsStatus !== 'idle') return;
    set({ effectsStatus: 'loading' });
    try {
      const raw = await fetchJson('focus-effects.json');
      const list = isRecord(raw) && Array.isArray(raw.effects) ? raw.effects : [];
      const effects = new Map<string, FocusEffectEntry>();
      for (const entry of list) {
        if (!isRecord(entry) || typeof entry.n !== 'string' || !entry.n) continue;
        const item: FocusEffectEntry = { n: entry.n };
        if (typeof entry.d === 'string' && entry.d) item.d = entry.d;
        if (Array.isArray(entry.sl)) {
          item.sl = entry.sl
            .filter(isRecord)
            .map((slot) => ({ s: finite(slot.s), e: typeof slot.e === 'string' ? slot.e : '' }))
            .filter((slot) => slot.e !== '');
        }
        effects.set(item.n.toLowerCase(), item);
      }
      set({
        effects,
        effectsStatus: effects.size ? 'ready' : 'missing',
        revision: get().revision + 1,
      });
    } catch {
      set({ effectsStatus: 'missing' });
    }
  },

  loadFixture() {
    const items = FIXTURE_ITEMS;
    set({
      status: 'ready',
      error: null,
      usingFixture: true,
      items,
      indexNames: items.map((item) => item.n),
      ...indexItems(items),
      shards: Object.fromEntries(SLOT_TYPES.map((s) => [s, 'ready' as ShardStatus])),
      revision: get().revision + 1,
    });
  },
}));

/** Items that can legally occupy a paper-doll position type. */
export function itemsForSlot(state: CatalogState, slot: SlotCode): Item[] {
  if (slot === 'ANY') {
    // The two EQL "Any Slot" positions take any item that is worn somewhere.
    return state.items.filter((item) => item.sl.length > 0);
  }
  const direct = state.bySlot.get(slot) ?? [];
  const wildcards = state.bySlot.get('ANY') ?? [];
  return wildcards.length ? [...direct, ...wildcards] : direct;
}

export function findItem(state: CatalogState, name: string | undefined): Item | undefined {
  if (!name) return undefined;
  return state.byName.get(name.toLowerCase());
}
