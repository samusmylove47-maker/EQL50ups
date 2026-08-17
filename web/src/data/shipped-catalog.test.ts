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
import { activeContext, buildCharacter, type Character } from '../engine/character';
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
    indexNames: items.map((i) => i.n),
    effects: new Map(),
    effectsStatus: 'idle',
    ensureEffects: async () => undefined,
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
    const character: Character = buildCharacter({
      id: 'c', name: 'Perf', classes: ['WAR', 'BRD', 'BER'], level: 50,
    });
    const catalog = fakeCatalog(primary.length ? primary : index);
    const started = performance.now();
    const ranked = rankSlotItems(catalog, {
      slot: 'PRIMARY',
      context: activeContext(character),
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

  /*
   * The Tier 0 correction, checked where it actually has to be true: in the
   * payload the browser downloads. The pipeline has its own assertions, but the
   * app has to be able to read the result through its own normaliser, and this
   * is the only place both halves meet.
   *
   * Source: research/validation/TIER0-PLAYER-REPORTS.md — the player's report
   * that Shadow Rage is the Berserker planar set EQL added to Fear and Hate.
   */
  describe('the Shadow Rage set, corrected on Tier 0 authority', () => {
    const shadowRage = index.filter((entry) => /^Shadow Rage /.test(entry.n));

    it('ships all six known pieces, one per armour slot', () => {
      expect(shadowRage.map((entry) => entry.n).sort()).toEqual([
        'Shadow Rage Boots',
        'Shadow Rage Gloves',
        'Shadow Rage Helm',
        'Shadow Rage Leggings',
        'Shadow Rage Sleeves',
        'Shadow Rage Wristguard',
      ]);
      expect(shadowRage.flatMap((entry) => entry.sl).sort()).toEqual([
        'ARMS', 'FEET', 'HANDS', 'HEAD', 'LEGS', 'WRIST',
      ]);
    });

    it('tags every piece FearHateRevamp and BER, with no era left unknown', () => {
      for (const piece of shadowRage) {
        expect(piece.era, piece.n).toBe('FearHateRevamp');
        expect(piece.eraUnknown, piece.n).toBeUndefined();
        expect(piece.cl, piece.n).toEqual(['BER']);
      }
    });

    it('invents no stats for the three pieces no wiki has ever carried', () => {
      const invented = shadowRage.filter(
        (piece) =>
          piece.statsUnknown === true &&
          (Object.keys(piece.st).length > 0 || Object.keys(piece.sv).length > 0 || piece.wp),
      );
      expect(invented).toEqual([]);

      const unstatted = shadowRage.filter((piece) => piece.statsUnknown);
      expect(unstatted.map((piece) => [piece.n, piece.id]).sort()).toEqual([
        ['Shadow Rage Boots', 55607],
        ['Shadow Rage Gloves', 55605],
        ['Shadow Rage Helm', 55601],
      ]);
      // Each one says what proves it exists, in words a reader can check.
      for (const piece of unstatted) {
        expect(piece.evidence ?? '', piece.n).toContain('tier0-inventory-Avenrae.txt');
      }
    });

    it('keeps the stats the wiki did carry for the other three', () => {
      const statted = shadowRage.filter((piece) => !piece.statsUnknown);
      expect(statted.map((piece) => piece.n).sort()).toEqual([
        'Shadow Rage Leggings',
        'Shadow Rage Sleeves',
        'Shadow Rage Wristguard',
      ]);
      // The correction touched the era and nothing else: these numbers are the
      // wiki's, unchanged.
      const sleeves = statted.find((piece) => piece.n === 'Shadow Rage Sleeves');
      expect(sleeves?.st).toEqual({ AC: 10, DEX: 5, ENDUR: 15, STA: 5, STR: 3 });
    });
  });

  it('builds a search index over the whole catalog quickly', () => {
    const started = performance.now();
    const built = new SearchIndex(index);
    const elapsed = performance.now() - started;
    expect(built.search('sword')).not.toBeNull();
    expect(elapsed).toBeLessThan(2000);
  });
});
