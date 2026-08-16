/**
 * The shipped catalog, driven through the app's own loading path.
 *
 * The data files come from a pipeline this UI does not own, so these tests
 * assert that whatever it published is understood by the normaliser, the
 * search index and the ranking selector — and that ranking 10k items stays
 * fast enough to feel instant. If the pipeline has not run, the whole block
 * skips rather than failing: an absent catalog is a supported state.
 */

import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Character } from '../engine/character';
import type { Item } from '../engine/types';
import { tier } from '../engine/upgrade';
import { rankSlotItems } from '../selectors/gear';
import type { CatalogState } from './catalog';
import { normalizeCatalog, type SlotCode } from './normalize';
import { SearchIndex } from './searchIndex';

const INDEX_PATH = 'public/data/items-index.json';
const PRIMARY_PATH = 'public/data/items/PRIMARY.json';
const published = existsSync(INDEX_PATH);

function load(path: string): Item[] {
  return existsSync(path) ? normalizeCatalog(JSON.parse(readFileSync(path, 'utf8'))) : [];
}

function fakeCatalog(items: Item[]): CatalogState {
  const byName = new Map<string, Item>();
  const bySlot = new Map<SlotCode, Item[]>();
  for (const item of items) {
    byName.set(item.n.toLowerCase(), item);
    for (const slot of item.sl) {
      const bucket = bySlot.get(slot as SlotCode);
      if (bucket) bucket.push(item);
      else bySlot.set(slot as SlotCode, [item]);
    }
  }
  return {
    status: 'ready',
    error: null,
    meta: null,
    items,
    byName,
    bySlot,
    shards: {},
    usingFixture: false,
    revision: 1000,
    load: async () => undefined,
    ensureSlot: async () => undefined,
    ensureAll: async () => undefined,
    loadFixture: () => undefined,
  };
}

describe.skipIf(!published)('shipped catalog', () => {
  const index = load(INDEX_PATH);
  const primary = load(PRIMARY_PATH);

  it('parses into a substantial catalog', () => {
    expect(index.length).toBeGreaterThan(1000);
    expect(index.every((item) => typeof item.n === 'string' && item.n.length > 0)).toBe(true);
  });

  it('carries slot, class and stat data on the per-slot shards', () => {
    expect(primary.length).toBeGreaterThan(100);
    const withStats = primary.filter((item) => Object.keys(item.st).length > 0);
    expect(withStats.length).toBeGreaterThan(50);
    expect(primary.every((item) => item.sl.includes('PRIMARY'))).toBe(true);
  });

  it('finds a known item by name through the search index', () => {
    const catalog = new SearchIndex(index);
    const hits = catalog.search('earthshaker');
    expect(hits).not.toBeNull();
    expect([...(hits ?? [])].some((item) => item.n === 'Earthshaker')).toBe(true);
  });

  it('ranks a full slot without producing a single non-finite score', () => {
    const character: Character = {
      id: 'c',
      name: 'Perf',
      level: 50,
      classes: ['WAR', 'BRD', 'BER'],
      race: null,
    };
    const catalog = fakeCatalog(primary.length ? primary : index);
    const started = performance.now();
    const ranked = rankSlotItems(catalog, {
      slot: 'PRIMARY',
      character,
      weights: { RATIO: 40, STR: 1, AC: 0.3, HP: 0.1 },
      upgrade: tier(0),
      includeUnreleased: true,
    });
    const elapsed = performance.now() - started;

    expect(ranked.length).toBeGreaterThan(50);
    expect(ranked.every((entry) => Number.isFinite(entry.score))).toBe(true);
    const scores = ranked.map((entry) => entry.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
    // A cold ranking pass over the whole slot has to feel instant.
    expect(elapsed).toBeLessThan(500);
  });

  it('builds a search index over the whole catalog quickly', () => {
    const started = performance.now();
    const built = new SearchIndex(index);
    const elapsed = performance.now() - started;
    expect(built.search('sword')).not.toBeNull();
    expect(elapsed).toBeLessThan(2000);
  });
});
