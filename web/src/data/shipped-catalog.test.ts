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

    /*
     * Six pieces the player named, and a seventh the wiki did.
     *
     * `Shadow Rage Tunic` arrived on 2 September 2026 with the live-wiki
     * supplement, a month after the scrape that supplied the other six. The
     * player never named it, so it is not Tier M and the pipeline does not file
     * it as `player-confirmed`; its own ship reason is `piece of a confirmed
     * set`. It is listed here because the standing the rest of this describe
     * block asserts — no era, no stats, marked — applies to it identically, and
     * that is the point: the set is held to one rule regardless of which month
     * a given piece happened to arrive in.
     */
    it('ships all seven known pieces, one per armour slot', () => {
      expect(shadowRage.map((entry) => entry.n).sort()).toEqual([
        'Shadow Rage Boots',
        'Shadow Rage Gloves',
        'Shadow Rage Helm',
        'Shadow Rage Leggings',
        'Shadow Rage Sleeves',
        'Shadow Rage Tunic',
        'Shadow Rage Wristguard',
      ]);
      expect(shadowRage.flatMap((entry) => entry.sl).sort()).toEqual([
        'ARMS', 'CHEST', 'FEET', 'HANDS', 'HEAD', 'LEGS', 'WRIST',
      ]);
    });

    /*
     * The set claims no era at all.
     *
     * A previous build tagged it `FearHateRevamp`, on the reasoning that the
     * wiki's five sets under that era were EQL planar class gear and Shadow Rage
     * was their Berserker sibling. That was an inference reported as
     * confirmation, and it was wrong twice over: FearHateRevamp is an
     * original-EverQuest patch, and none of those five sets are in this game.
     *
     * What the player actually said is that Shadow Rage comes from the Planes of
     * Fear and Hate — two planes, seven pieces, no mapping between them. So the
     * set ships on player authority with its era left unknown, because that is
     * the true state of the evidence. The Tunic's wiki page states `Classic`
     * outright and is overridden to match its siblings: an era for one piece of
     * a set the player placed elsewhere is a contradiction to disclose, not a
     * field to accept because it happens to be populated.
     */
    it('claims no era, and says so rather than guessing one', () => {
      for (const piece of shadowRage) {
        expect(piece.era, piece.n).toBeUndefined();
        expect(piece.eraUnknown, piece.n).toBe(true);
        expect(piece.cl, piece.n).toEqual(['BER']);
      }
    });

    /*
     * Every piece ships unstatted — including the four the wiki does carry
     * numbers for. Three of those numbers come from the same scrape that
     * supplied ~7,700 items from expansions this game does not have, so nothing
     * shows they describe the Legends item rather than an original-EverQuest one
     * of the same name. Withholding a number we cannot source beats showing one
     * that would rank, auto-fill and total as though it were measured.
     *
     * The fourth, the Tunic, is the interesting one, because the case for
     * trusting its block is genuinely better: its page restricts the item to
     * BER, and Berserker is not a class in the era of original EverQuest this
     * wiki is contaminated by. That is a good argument and it is still an
     * argument. The player's instruction was to withhold out-of-era stat blocks
     * for this set until they supply verified numbers, and a good argument is
     * not the verified numbers.
     */
    it('ships stats only for the pieces a client window covers', () => {
      /*
       * Five of seven now carry numbers. On 2026-09-02 the owner supplied client
       * item windows for four pieces, which released three withheld wiki blocks
       * and recovered a fourth by inverting the capture; the Tunic's block was
       * released by the owner reading it back.
       *
       * Gloves and Boots were never captured and no wiki carries them, so they
       * stay silent — and that is what this test is really for. The interesting
       * assertion was never "nothing has stats", it was "nothing has stats it
       * has not earned", and only the second one survives new evidence.
       */
      const CAPTURED = new Set([
        'Shadow Rage Helm', 'Shadow Rage Leggings', 'Shadow Rage Sleeves',
        'Shadow Rage Wristguard', 'Shadow Rage Tunic',
      ]);
      expect(shadowRage.filter((p) => !p.statsUnknown).map((p) => p.n).sort())
        .toEqual([...CAPTURED].sort());

      for (const piece of shadowRage.filter((p) => !CAPTURED.has(p.n))) {
        expect(piece.statsUnknown, piece.n).toBe(true);
        expect(Object.keys(piece.st), piece.n).toEqual([]);
        expect(Object.keys(piece.sv), piece.n).toEqual([]);
        expect(piece.wp, piece.n).toBeFalsy();
        // Each one says what proves it exists, in words a reader can check.
        expect(piece.evidence ?? '', piece.n).toMatch(/tier0-inventory-Avenrae\.txt|player report/i);
      }
    });

    it('still carries the ids the live export proves', () => {
      const ids = Object.fromEntries(shadowRage.map((piece) => [piece.n, piece.id]));
      expect(ids['Shadow Rage Helm']).toBe(55601);
      expect(ids['Shadow Rage Gloves']).toBe(55605);
      expect(ids['Shadow Rage Boots']).toBe(55607);
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
