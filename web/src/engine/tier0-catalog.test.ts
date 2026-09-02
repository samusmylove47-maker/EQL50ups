/**
 * The shipped catalog measured against the live client.
 *
 * `research/validation/tier0-inventory-Avenrae.txt` is an `/outputfile
 * inventory` export from a level 50 BRD/WAR/BER. Every worn position in it is
 * a thing the game itself allowed that character to equip, which makes it the
 * strongest available test of what the catalog must contain and what the picker
 * must offer: all of it has to ship, and none of it may be withheld.
 *
 * Only the **worn positions** carry that guarantee. The bags hold gems, food
 * and spell components, and the `Equipment` key-ring is a collection rather
 * than a wardrobe — it records Cleric-, Paladin- and Monk-only pieces this
 * character cannot wear — so neither is asserted as equippable here.
 *
 * The block skips if the pipeline has not published, which is a supported
 * state rather than a failure.
 */

import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { activeContext, buildCharacter, canUse, type Character } from '../engine/character';
import type { Item } from '../engine/types';
import { itemsForSlot, type CatalogState } from '../data/catalog';
import { normalizeCatalog, type SlotCode } from '../data/normalize';
import { rankSlotItems, unstattedForSlot } from '../selectors/gear';
import { tier } from './upgrade';
import { SLOT_TYPES } from './constants';

const INVENTORY = '../research/validation/tier0-inventory-Avenrae.txt';
const INDEX = 'public/data/items-index.json';
const published = existsSync(INDEX) && existsSync(INVENTORY);

const AVENRAE: Character = buildCharacter({
  id: 'avenrae', name: 'Avenrae', classes: ['BRD', 'WAR', 'BER'], level: 50,
});
const AVENRAE_CTX = activeContext(AVENRAE);

/** Client inventory location label to the planner's slot code. */
const LOCATION_SLOT: Record<string, SlotCode> = {
  Ear: 'EAR', Head: 'HEAD', Face: 'FACE', Neck: 'NECK', Shoulders: 'SHOULDERS',
  Arms: 'ARMS', Back: 'BACK', Wrist: 'WRIST', Range: 'RANGE', Hands: 'HANDS',
  Primary: 'PRIMARY', Secondary: 'SECONDARY', Fingers: 'FINGERS', Chest: 'CHEST',
  Legs: 'LEGS', Feet: 'FEET', Waist: 'WAIST', Ammo: 'AMMO', 'Any Slot': 'ANY',
};

interface WornEntry { location: string; slot: SlotCode; name: string; id: number }

function loadCatalog(): Item[] {
  const items = normalizeCatalog(JSON.parse(readFileSync(INDEX, 'utf8')));
  const byName = new Map(items.map((item) => [item.n.toLowerCase(), item]));
  for (const slot of [...SLOT_TYPES, 'OTHER']) {
    const path = `public/data/items/${slot}.json`;
    if (!existsSync(path)) continue;
    for (const detail of normalizeCatalog(JSON.parse(readFileSync(path, 'utf8')))) {
      const existing = byName.get(detail.n.toLowerCase());
      if (existing) {
        Object.assign(existing, detail, {
          st: { ...existing.st, ...detail.st },
          sv: { ...existing.sv, ...detail.sv },
        });
      } else {
        byName.set(detail.n.toLowerCase(), detail);
        items.push(detail);
      }
    }
  }
  return items;
}

/**
 * Every item name anywhere in the export — worn, bagged, banked, keyring.
 *
 * The era purge treats the whole export as Tier 0 proof of existence, not just
 * the worn positions: an item sitting in a bag is no less in the game than one
 * on the character. This is the set that lets a Kunark-tagged Batskull Earring
 * ship while the other 1,457 Kunark records do not.
 */
function ownedItemNames(): Set<string> {
  const out = new Set<string>();
  for (const line of readFileSync(INVENTORY, 'utf8').split('\n').slice(1)) {
    const raw = line.split('\t')[1];
    if (!raw || raw === 'Empty') continue;
    out.add(raw.replace(/\s*\(Exaltation\)\s*/g, ' ').replace(/\s*\+\d+\s*/g, ' ').replace(/\s+/g, ' ').trim());
  }
  return out;
}

/** Reads the worn block only — everything before the KeyRing section. */
function wornPositions(): WornEntry[] {
  const out: WornEntry[] = [];
  for (const line of readFileSync(INVENTORY, 'utf8').split('\n')) {
    const cells = line.split('\t');
    if (cells[0] === 'KeyRing') break;
    if (cells.length < 3) continue;
    const [location = '', raw = '', id = ''] = cells;
    if (!raw || raw === 'Empty' || raw === 'Name') continue;
    const slot = LOCATION_SLOT[location];
    if (!slot) continue; // bags, bank, held — not worn positions
    out.push({
      location,
      slot,
      name: raw.trim().replace(/\s\+\d+$/, ''),
      id: Number(id),
    });
  }
  return out;
}

function catalogState(items: Item[]): CatalogState {
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
    status: 'ready', error: null, meta: null, items, byName, bySlot,
    shards: {}, usingFixture: false, revision: 5150,
    indexNames: items.map((i) => i.n),
    effects: new Map(),
    effectsStatus: 'idle',
    ensureEffects: async () => undefined,
    load: async () => undefined,
    ensureSlot: async () => undefined,
    ensureAll: async () => undefined,
    loadFixture: () => undefined,
  };
}

describe.skipIf(!published)('Tier 0 inventory vs the picker', () => {
  const items = loadCatalog();
  const state = catalogState(items);
  const byId = new Map<number, Item>();
  for (const item of items) if (item.id) byId.set(item.id, item);
  const byName = state.byName;
  const worn = wornPositions();
  const ownedNames = ownedItemNames();

  const resolve = (entry: WornEntry): Item | undefined =>
    byId.get(entry.id) ?? byName.get(entry.name.toLowerCase());

  it('reads all 22 filled worn positions from the export', () => {
    expect(worn).toHaveLength(22);
    expect(worn.filter((w) => w.slot === 'ANY')).toHaveLength(2);
  });

  it('has a catalog row for every single worn item', () => {
    const missing = worn.filter((entry) => !resolve(entry)).map((entry) => entry.name);
    // Shadow Rage Helm was the last hold-out: no wiki scrape has a page for it,
    // and the pipeline now ships it on Tier 0 authority (the player's own
    // report plus its id in this very export). See
    // research/validation/TIER0-PLAYER-REPORTS.md.
    expect(missing).toEqual([]);
  });

  it('ships the wiki-less Shadow Rage Helm without inventing a single number', () => {
    const helm = resolve(worn.find((w) => w.name === 'Shadow Rage Helm') as WornEntry);
    expect(helm).toBeDefined();
    expect(helm?.id).toBe(55601);
    expect(helm?.sl).toEqual(['HEAD']);
    expect(helm?.cl).toEqual(['BER']);
    // No era: the player placed the set in two planes, not one, so naming an
    // era for any single piece would be an inference dressed as data.
    expect(helm?.era).toBeUndefined();
    expect(helm?.eraUnknown).toBe(true);
    // The whole point: existence is asserted, stats are not.
    expect(helm?.statsUnknown).toBe(true);
    expect(helm?.st).toEqual({});
    expect(helm?.sv).toEqual({});
    expect(helm?.wp).toBeUndefined();
    expect(helm?.evidence ?? '').toContain('tier0-inventory-Avenrae.txt');
  });

  it('files every worn item under the slot the client put it in', () => {
    const wrong: string[] = [];
    for (const entry of worn) {
      const item = resolve(entry);
      if (!item) continue;
      const ok = entry.slot === 'ANY' ? item.sl.length > 0 : item.sl.includes(entry.slot);
      if (!ok) wrong.push(`${entry.name} -> ${item.sl.join(',')} (worn in ${entry.slot})`);
    }
    expect(wrong).toEqual([]);
  });

  it('lets the character use every item the client let them wear', () => {
    const refused: string[] = [];
    for (const entry of worn) {
      const item = resolve(entry);
      if (!item) continue;
      if (!canUse({ classes: item.cl, races: item.ra }, AVENRAE_CTX)) {
        refused.push(`${entry.name} (${item.cl.join(',')})`);
      }
    }
    expect(refused).toEqual([]);
  });

  it('ships every worn item as available, withholding none of it', () => {
    const withheld = worn
      .map(resolve)
      .filter((item): item is Item => Boolean(item))
      .filter((item) => item.av !== true)
      .map((item) => item.n);
    expect(withheld).toEqual([]);
  });

  it('offers every worn item the picker can score, and only withholds the unscorable', () => {
    const absent: string[] = [];
    for (const entry of worn) {
      const item = resolve(entry);
      if (!item) continue;
      const ranked = rankSlotItems(state, {
        slot: entry.slot,
        context: AVENRAE_CTX,
        weights: { AC: 1, STR: 1, HP: 0.2, RATIO: 20 },
        upgrade: tier(0),
      });
      if (!ranked.some((row) => row.item.n === item.n)) {
        absent.push(`${item.n} missing from ${entry.slot}`);
      }
    }
    // One exception, and it is the deliberate one: an item with no stats has
    // nothing to rank. It is not hidden — `unstattedForSlot` hands it to the
    // picker to name underneath the list.
    expect(absent).toEqual(['Shadow Rage Helm missing from HEAD']);
    expect(unstattedForSlot(state, 'HEAD', AVENRAE_CTX).map((i) => i.n)).toEqual([
      'Shadow Rage Helm',
    ]);
  });

  it('never lets an unstatted item into a ranking, in any slot', () => {
    for (const slot of ['HEAD', 'HANDS', 'FEET', 'ANY'] as SlotCode[]) {
      const ranked = rankSlotItems(state, {
        slot,
        context: AVENRAE_CTX,
        weights: { AC: 1, STR: 1, HP: 0.2 },
        upgrade: tier(0),
      });
      expect(ranked.filter((row) => row.item.statsUnknown)).toEqual([]);
    }
  });

  it('never offers a candidate the character cannot use', () => {
    for (const slot of ['PRIMARY', 'CHEST', 'FINGERS', 'ANY'] as SlotCode[]) {
      const ranked = rankSlotItems(state, {
        slot,
        context: AVENRAE_CTX,
        weights: { AC: 1 },
        upgrade: tier(0),
      });
      const illegal = ranked.filter(
        (row) => !canUse({ classes: row.item.cl, races: row.item.ra }, AVENRAE_CTX),
      );
      expect(illegal.map((row) => row.item.n)).toEqual([]);
    }
  });

  /*
   * "Usable" here means usable *and scoreable*. An item whose stats are withheld
   * is deliberately absent from every ranking — three other tests in this file
   * and in `selectors/gear.test.ts` assert that — because a row with no numbers
   * cannot be placed in an order built out of numbers.
   *
   * That exclusion used to be invisible to this test, since no unstatted item
   * happened to sit in PRIMARY, CHEST or WAIST. `Shadow Rage Tunic` arrived in
   * CHEST on 2 September 2026 and the assumption became load-bearing, so it is
   * now written down. The item is still reachable — it is in the slot pool this
   * test reads, in the picker and in the search index. It is only unranked.
   */
  it('never hides a usable candidate that the slot pool holds', () => {
    for (const slot of ['PRIMARY', 'CHEST', 'WAIST'] as SlotCode[]) {
      const eligible = itemsForSlot(state, slot).filter((item) =>
        canUse({ classes: item.cl, races: item.ra }, AVENRAE_CTX),
      ).filter((item) => !item.statsUnknown);
      const ranked = rankSlotItems(state, {
        slot,
        context: AVENRAE_CTX,
        weights: { AC: 1 },
        upgrade: tier(0),
      });
      expect(ranked).toHaveLength(eligible.length);
    }
  });

  /*
   * There is no unreleased content left to hide.
   *
   * These three tests used to describe a catalog that shipped all 11,252 wiki
   * items and hid the out-of-era ones behind a "Live content only" toggle. The
   * player's verdict on that design was blunt: a planner that will rank an item
   * you can never obtain "poisons and ruins this entire project". EQ Legends is
   * classic-era only, and the wiki it was built from carries the whole
   * original-EverQuest corpus, so 7,719 records were quarantined out of the
   * build entirely and the toggle was removed with them.
   *
   * What is asserted now is the purge itself: nothing ships that the app would
   * have had to hide.
   */
  it('marks every shipped item available, leaving nothing for a filter to hide', () => {
    // `av` survives normalisation verbatim — only an explicit `av: false` in the
    // payload can fail this — so it is the app-side reading of the purge
    // invariant `pipeline/verify.mjs` enforces on the way out.
    const unavailable = items.filter((item) => item.av !== true);
    expect(unavailable.map((item) => item.n)).toEqual([]);
  });

  it('carries no item from an expansion this game does not have', () => {
    const OUT_OF_ERA = ['Kunark', 'Velious', 'Luclin', 'FearHateRevamp', 'Chardok Revamp', 'Epic Quests'];
    /*
     * ...unless Tier M evidence says otherwise, in which case the wiki's era tag
     * is wrong rather than the item unobtainable.
     *
     * Asserted through `ex` rather than by re-listing the sources, so the rule
     * stays true as evidence classes are added. Today `ex` can be a measured
     * drop from EQL Source's combat logs, a line in the client export, the
     * published ID table, or a player report — all Tier M, all about existence,
     * none about stats.
     */
    const contraband = items.filter(
      (item) => OUT_OF_ERA.includes(item.era ?? '') && !item.ex && !ownedNames.has(item.n),
    );
    expect(contraband.map((item) => `${item.n} [${item.era}]`)).toEqual([]);
  });

  /*
   * The one exception, and the reason it is an exception rather than a hole in
   * the rule: an item the player is demonstrably carrying exists in this game,
   * whatever era the wiki assigned it. Tier 0 outranks the wiki.
   */
  it('keeps the items the live export proves, whatever the wiki called them', () => {
    for (const name of ['Batskull Earring', 'Crystalline Spear', 'Dragon Bone Bracelet']) {
      const item = items.find((entry) => entry.n === name);
      // Shipping at all *is* the assertion now. These three carry the wiki's
      // `Kunark` tag, which used to hide them behind the era gate and would
      // now quarantine them out of the build; the export is why they survive.
      expect(item, name).toBeDefined();
      expect(item?.era, name).toBe('Kunark');
      expect(item?.av, name).toBe(true);
    }
  });

  /*
   * And era-less is not classic. ~2,300 records carry no era in any source;
   * shipping them on the assumption they are in-era is the same mistake in a
   * quieter form, so they are quarantined too. Shadow Rage survives because the
   * player named it directly — six pieces of it — plus one the wiki attributes
   * to that set, which is the single admission in this catalog resting on an
   * argument rather than an observation.
   */
  it('quarantines era-less items rather than presuming them classic', () => {
    // ~2,200 records carry no era in any source and were dropped. What survives
    // is only what Tier 0 vouches for: the Shadow Rage set the player named, and
    // era-less items the export shows in their bags.
    const unvouched = items.filter(
      (item) => item.eraUnknown && !item.ex && !ownedNames.has(item.n) && !/^Shadow Rage /.test(item.n),
    );
    expect(unvouched.map((item) => item.n)).toEqual([]);
    expect(items.filter((item) => /^Shadow Rage /.test(item.n) && item.eraUnknown)).toHaveLength(7);
    /*
     * The Tunic is the whole of the exception, and naming it here is the point:
     * `unvouched` above passes it over via the `Shadow Rage` prefix, so without
     * this line that prefix would quietly launder any future era-less item
     * whose name began with those two words.
     */
    expect(
      items.filter((item) => item.eraUnknown && !item.ex && !ownedNames.has(item.n)).map((i) => i.n),
    ).toEqual(['Shadow Rage Tunic']);
  });

  it('scores every candidate in every slot to a finite number', () => {
    for (const slot of [...SLOT_TYPES, 'ANY'] as SlotCode[]) {
      const ranked = rankSlotItems(state, {
        slot, context: AVENRAE_CTX,
        weights: { AC: 1, STR: 1, HP: 0.2, RATIO: 20, HASTE: 2, BACKSTAB: 0.5, ATTACK: 0.5 },
        upgrade: tier(6),
      });
      expect(ranked.every((row) => Number.isFinite(row.score))).toBe(true);
      const scores = ranked.map((row) => row.score);
      expect([...scores].sort((a, b) => b - a)).toEqual(scores);
    }
  });
});
