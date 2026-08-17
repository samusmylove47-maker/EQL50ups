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
 *
 * `incoming` is de-duplicated against **itself** as well as against `existing`.
 * There used to be a fast path returning `incoming` verbatim when `existing`
 * was empty, which was sound only while this was called once per shard: an item
 * that ships in two shards — `Dagas` is in both `PRIMARY.json` and
 * `SECONDARY.json` — arrives twice in one concatenated batch, and adopting that
 * array wholesale put two rows in the catalog for one item. A search narrowed
 * to "1 match" then left six rows on screen. The guard bought one array copy of
 * an empty list; it cost duplicate catalog entries whenever a cold `ensureAll`
 * won the race against the index load.
 */
interface MergeResult {
  /** The whole catalog, one entry per name. */
  items: Item[];
  /**
   * The resulting record for each name `incoming` touched — merged, not raw,
   * and one per name however many payloads carried it. This is what the index
   * has to be pointed at: indexing the raw shard record instead left `byName`
   * holding a record that `items` and `bySlot` had already superseded, so the
   * equipped-item lookup and the ranking read two different objects for one
   * item.
   */
  touched: Item[];
}

function mergeItems(existing: Item[], incoming: Item[]): MergeResult {
  const position = new Map<string, number>();
  existing.forEach((item, i) => position.set(item.n.toLowerCase(), i));
  const merged = existing.slice();
  const keys = new Set<string>();

  for (const item of incoming) {
    const key = item.n.toLowerCase();
    keys.add(key);
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

  const touched: Item[] = [];
  for (const key of keys) {
    const at = position.get(key);
    if (at !== undefined) touched.push(merged[at] as Item);
  }
  return { items: merged, touched };
}

interface LoadedShard {
  slot: SlotCode;
  items: Item[];
}

/** Fetch and normalise one shard. A failure is an empty shard, never a throw. */
async function loadShard(slot: SlotCode): Promise<LoadedShard> {
  try {
    return { slot, items: normalizeCatalog(await fetchJson(`items/${slot}.json`)) };
  } catch {
    return { slot, items: [] };
  }
}

/**
 * Fold any number of loaded shards into the catalog in a single commit.
 *
 * One merge, one reindex, one revision bump, however many shards arrived. The
 * revision is what every memoised selector keys off, so bumping it once per
 * shard is what made an Any Slot picker re-rank nineteen times.
 */
function commitShards(
  loaded: readonly LoadedShard[],
  get: () => CatalogState,
  set: (partial: Partial<CatalogState>) => void,
): void {
  const before = get();
  const shards = { ...before.shards };
  const incoming: Item[] = [];

  for (const shard of loaded) {
    if (!shard.items.length) {
      shards[shard.slot] = 'missing';
      continue;
    }
    shards[shard.slot] = 'ready';
    for (const item of shard.items) incoming.push(item);
  }

  if (!incoming.length) {
    set({ shards });
    return;
  }

  // One merge over the concatenation rather than one per shard: `mergeItems`
  // builds a name→index map of the whole catalog before it starts, so calling
  // it nineteen times built that map nineteen times over 11,249 items. Merging
  // the shards in order gives the same result, because a later shard still
  // lands on whatever an earlier one already merged — and it de-duplicates
  // within the batch, which matters here because an item can ship in two
  // shards at once.
  const { items, touched } = mergeItems(before.items, incoming);

  set({
    items,
    // `touched`, not `incoming`: the index must name the merged record.
    ...reindexShard({ byName: before.byName, bySlot: before.bySlot }, items, touched),
    shards,
    status: 'ready',
    revision: before.revision + 1,
  });
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

      /*
       * A shard can beat the index to the finish line — the index is ~2 MB and
       * a slot shard is ~60 KB, so on a slow connection the shard lands first
       * and merges into an empty catalog. Replacing `items` wholesale here
       * then threw that detail away, and because `shards[slot]` still read
       * 'ready' it was never fetched again: the picker silently lost every
       * `src`, `fx` and `rl` it had, and `rl` gates eligibility.
       *
       * So the index is folded in as the *base* and anything a shard already
       * enriched wins over it. `indexNames` still comes from the index alone,
       * because the share dictionary must be identical between two clients
       * that happen to have loaded different shards.
       */
      const prior = get().items;
      const merged = prior.length ? mergeItems(items, prior).items : items;

      set({
        status: 'ready',
        meta: normalizeMeta(metaRaw),
        items: merged,
        indexNames: items.map((item) => item.n),
        ...indexItems(merged),
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
    const loaded = await loadShard(slot);
    commitShards([loaded], get, set);
  },

  /**
   * Load every remaining shard as **one** state commit.
   *
   * This used to fan out to nineteen `ensureSlot` calls, each of which set its
   * own revision bump when its fetch landed. Every bump invalidates the rank
   * cache, so an Any Slot picker — which is what asks for `ensureAll` in the
   * first place — re-scored roughly seven thousand candidates once per shard:
   * twenty-one consecutive long tasks and 2.6 s of blocked main thread over
   * three and a half seconds, all of it *after* the dialog had already painted
   * rows. The work of loading is unchanged; only the number of times the
   * consumers are told about it is.
   *
   * The fetches still run in parallel — they are network-bound and there are
   * nineteen of them — and the merge and the single revision bump happen
   * synchronously once they have all resolved, so a concurrent `ensureSlot`
   * cannot interleave between reading the previous state and writing the new.
   */
  async ensureAll() {
    if (get().usingFixture) return;
    const wanted = ([...SLOT_TYPES, ...EXTRA_SHARDS] as SlotCode[]).filter((s) => !get().shards[s]);
    if (!wanted.length) return;

    const pending: Record<string, ShardStatus> = {};
    for (const slot of wanted) pending[slot] = 'loading';
    set({ shards: { ...get().shards, ...pending } });

    const loaded = await Promise.all(wanted.map((slot) => loadShard(slot)));
    commitShards(loaded, get, set);
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
