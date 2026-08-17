/**
 * The shipped catalog measured against the live client.
 *
 * `research/validation/tier0-inventory-Avenrae.txt` is an `/outputfile
 * inventory` export from a level 50 BRD/WAR/BER. Every worn position in it is
 * a thing the game itself allowed that character to equip, which makes it the
 * strongest available test of eligibility and era gating: the picker must
 * offer all of it, and hide none of it.
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
import { isLive } from '../lib/itemStyle';
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
    expect(helm?.era).toBe('FearHateRevamp');
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

  it('shows every worn item as live, gating none of it out', () => {
    const gated = worn
      .map(resolve)
      .filter((item): item is Item => Boolean(item))
      .filter((item) => !isLive(item))
      .map((item) => item.n);
    expect(gated).toEqual([]);
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
        includeUnreleased: false,
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

  it('never lets an unstatted item into a ranking, however the slot is asked for', () => {
    for (const slot of ['HEAD', 'HANDS', 'FEET', 'ANY'] as SlotCode[]) {
      for (const includeUnreleased of [true, false]) {
        const ranked = rankSlotItems(state, {
          slot,
          context: AVENRAE_CTX,
          weights: { AC: 1, STR: 1, HP: 0.2 },
          upgrade: tier(0),
          includeUnreleased,
        });
        expect(ranked.filter((row) => row.item.statsUnknown)).toEqual([]);
      }
    }
  });

  it('never offers a candidate the character cannot use', () => {
    for (const slot of ['PRIMARY', 'CHEST', 'FINGERS', 'ANY'] as SlotCode[]) {
      const ranked = rankSlotItems(state, {
        slot,
        context: AVENRAE_CTX,
        weights: { AC: 1 },
        upgrade: tier(0),
        includeUnreleased: true,
      });
      const illegal = ranked.filter(
        (row) => !canUse({ classes: row.item.cl, races: row.item.ra }, AVENRAE_CTX),
      );
      expect(illegal.map((row) => row.item.n)).toEqual([]);
    }
  });

  it('never hides a usable, live candidate that the slot pool holds', () => {
    for (const slot of ['PRIMARY', 'CHEST', 'WAIST'] as SlotCode[]) {
      const eligible = itemsForSlot(state, slot).filter(
        (item) => isLive(item) && canUse({ classes: item.cl, races: item.ra }, AVENRAE_CTX),
      );
      const ranked = rankSlotItems(state, {
        slot,
        context: AVENRAE_CTX,
        weights: { AC: 1 },
        upgrade: tier(0),
        includeUnreleased: false,
      });
      expect(ranked).toHaveLength(eligible.length);
    }
  });

  it('hides content that is not live until the filter is lifted', () => {
    const live = rankSlotItems(state, {
      slot: 'PRIMARY', context: AVENRAE_CTX, weights: { AC: 1 },
      upgrade: tier(0), includeUnreleased: false,
    });
    const all = rankSlotItems(state, {
      slot: 'PRIMARY', context: AVENRAE_CTX, weights: { AC: 1 },
      upgrade: tier(0), includeUnreleased: true,
    });
    expect(all.length).toBeGreaterThan(live.length);
    expect(live.every((row) => isLive(row.item))).toBe(true);
  });

  it('keeps items of unknown era visible, which is the deliberate choice', () => {
    const unknown = items.filter((item) => item.eraUnknown && item.av !== false);
    expect(unknown.length).toBeGreaterThan(100);
    expect(unknown.every((item) => isLive(item))).toBe(true);
  });

  it('un-gates exactly the items Tier 0 proves are obtainable, and nothing else', () => {
    const overridden = items.filter((item) => item.av === false && isLive(item));
    expect(overridden.map((item) => item.n).sort()).toEqual([
      'Batskull Earring',
      'Crystalline Spear',
      'Dragon Bone Bracelet',
      'Gauntlets of Fiery Might',
      'Gold Plated Koshigatana',
      "Hamed's Ring of Tears",
      'Hierophant`s Crook',
      'McVaxius` Horn of War',
      'Orb of Tishan',
      'Selo`s Drums of the March',
      // The six Shadow Rage pieces. The wiki's `FearHateRevamp` era ranks after
      // Sky, so re-tagging them to their real era gated them out — while the
      // player is wearing one. Five are in this export; the Leggings rest on
      // the player's statement that Shadow Rage is one set.
      'Shadow Rage Boots',
      'Shadow Rage Gloves',
      'Shadow Rage Helm',
      'Shadow Rage Leggings',
      'Shadow Rage Sleeves',
      'Shadow Rage Wristguard',
      "Tobrin's Mystical Eyepatch",
      'Warhammer of Divine Grace',
      'White Satin Gloves',
    ]);
  });

  it('leaves the rest of the FearHateRevamp era gated, having no evidence for it', () => {
    // The finding this guards: the era is under-covered by the wiki, not
    // proven live. Un-gating the other 53 of its 59 items on the strength of
    // one set would be exactly the inference this project refuses to make.
    const stillGated = items.filter(
      (item) => item.era === 'FearHateRevamp' && !isLive(item),
    );
    expect(stillGated.length).toBe(53);
    expect(stillGated.some((item) => /^Shadow Rage/.test(item.n))).toBe(false);
  });

  it('scores every candidate in every slot to a finite number', () => {
    for (const slot of [...SLOT_TYPES, 'ANY'] as SlotCode[]) {
      const ranked = rankSlotItems(state, {
        slot, context: AVENRAE_CTX,
        weights: { AC: 1, STR: 1, HP: 0.2, RATIO: 20, HASTE: 2, BACKSTAB: 0.5, ATTACK: 0.5 },
        upgrade: tier(6),
        includeUnreleased: true,
      });
      expect(ranked.every((row) => Number.isFinite(row.score))).toBe(true);
      const scores = ranked.map((row) => row.score);
      expect([...scores].sort((a, b) => b - a)).toEqual(scores);
    }
  });
});
