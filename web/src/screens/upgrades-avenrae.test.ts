/**
 * The upgrade ranking against the real catalog and a real character.
 *
 * `research/validation/tier0-inventory-Avenrae.txt` is an `/outputfile
 * inventory` export from a level 50 BRD/WAR/BER. Nothing in this file is
 * invented: the gear set is what the app's own importer makes of that export,
 * the catalog is what the pipeline published, and the ranking is the one the
 * screen runs. It is the strongest available test that the list a player
 * actually sees obeys the rules the fixtures pin.
 *
 * Skipped when the pipeline has not published, which is a supported state.
 */

import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { activeContext, buildCharacter, canUse } from '../engine/character';
import { SLOT_TYPES } from '../engine/constants';
import { profileById } from '../engine/ep';
import { tier } from '../engine/upgrade';
import type { GearSet, Item } from '../engine/types';
import type { CatalogState } from '../data/catalog';
import { normalizeCatalog, statsAreUnknown, type SlotCode } from '../data/normalize';
import { itemIdIndex, readInventory, toSlotMap } from '../lib/inventoryImport';
import { DEFAULT_SET_FILTERS } from '../lib/setFilters';
import { slotViews } from '../selectors/gear';
import { computeUpgrades, isLore } from './Upgrades';

const INVENTORY = '../research/validation/tier0-inventory-Avenrae.txt';
const INDEX = 'public/data/items-index.json';
const published = existsSync(INDEX) && existsSync(INVENTORY);

const AVENRAE = buildCharacter({
  id: 'avenrae',
  name: 'Avenrae',
  classes: ['BRD', 'WAR', 'BER'],
  level: 50,
});
const CONTEXT = activeContext(AVENRAE);

/** Index plus every shard, merged the way the catalog store merges them. */
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
    shards: {}, usingFixture: false, revision: 9_100,
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

describe.skipIf(!published)('Avenrae’s upgrades, against the shipped catalog', () => {
  const items = loadCatalog();
  const state = catalogState(items);
  const imported = readInventory(readFileSync(INVENTORY, 'utf8'), {
    byName: state.byName,
    byId: itemIdIndex(items),
  });

  /** The set the app's own importer produces from that export. */
  const base = (slots: GearSet['slots']): GearSet => ({
    id: 'set_avenrae',
    characterId: AVENRAE.id,
    name: 'Avenrae — imported',
    slots,
    // What `createSet` gives a new set: the Balanced preset.
    weights: profileById('balanced'),
    createdAt: 1,
    updatedAt: 2,
  });

  const importedSet = base(toSlotMap(imported));
  const report = computeUpgrades(
    state,
    slotViews(importedSet, state),
    CONTEXT,
    importedSet.weights,
    { filters: { ...DEFAULT_SET_FILTERS }, basis: { kind: 'worn' } },
  );

  /*
   * No slot may be recommended on a weapon number the stat sheet will not read
   * back.
   *
   * This screen shipped with a Throwing Boulder ranked fifth at +30.9 EP, above
   * real armour gains, because the rank scorer paid for damage ratio in every
   * slot except the two Any Slots while `computeTotals` reads a weapon only
   * from PRIMARY and SECONDARY. A player told to go farm Permafrost for an
   * Ammo slot would have gained nothing measurable.
   */
  it('never recommends a slot on damage the set cannot use', () => {
    const offenders = report.rows
      .filter((row) => row.position.type !== 'PRIMARY' && row.position.type !== 'SECONDARY')
      .filter((row) => Boolean(row.candidate?.item?.wp))
      .map((row) => `${row.position.type}: ${row.candidate?.item?.n}`);
    expect(offenders).toEqual([]);
  });

  it('reads the export into a set the ranking can work on', () => {
    // 22 filled worn positions in the export; the Shadow Rage Helm is the one
    // the importer withholds, because no catalog carries its stats.
    expect(imported.stats.filledPositions).toBe(22);
    expect(imported.unstatted.map((entry) => entry.itemName)).toContain('Shadow Rage Helm');
    expect(Object.keys(importedSet.slots).length).toBe(21);
  });

  it('accounts for all 23 positions exactly once', () => {
    expect(
      report.rows.length + report.withheld.length + report.settled + report.nothing.length,
    ).toBe(23);
  });

  it('ranks by gain, biggest first, and every gain is real', () => {
    expect(report.rows.length).toBeGreaterThan(0);
    for (let i = 1; i < report.rows.length; i++) {
      expect(report.rows[i - 1]?.gain).toBeGreaterThanOrEqual(report.rows[i]?.gain as number);
    }
    for (const row of report.rows) {
      expect(row.gain, `${row.position.label}`).toBeGreaterThan(0);
      expect(Number.isFinite(row.gain)).toBe(true);
      expect(row.candidate.ep).toBeGreaterThan(row.wornEp);
    }
  });

  it('never recommends an item this trio cannot equip', () => {
    for (const row of report.rows) {
      const item = row.candidate.item;
      expect(
        canUse({ classes: item.cl, races: item.ra, ...(item.rl ? { rl: item.rl } : {}) }, CONTEXT),
        `${row.position.label} · ${item.n}`,
      ).toBe(true);
    }
  });

  it('never recommends an item whose stats nobody published', () => {
    for (const row of report.rows) {
      expect(statsAreUnknown(row.candidate.item), row.candidate.item.n).toBe(false);
    }
    for (const entry of report.withheld) {
      if (entry.candidate) expect(statsAreUnknown(entry.candidate.item)).toBe(false);
    }
  });

  it('never offers back an item Avenrae is already wearing elsewhere', () => {
    const worn = new Set(
      Object.entries(importedSet.slots)
        .filter(([, value]) => value)
        .map(([position, value]) => `${position}:${(value?.itemName ?? '').toLowerCase()}`),
    );
    for (const row of report.rows) {
      const key = `${row.position.id}:${row.candidate.item.n.toLowerCase()}`;
      const elsewhere = [...worn].some(
        (entry) => entry.endsWith(`:${row.candidate.item.n.toLowerCase()}`) && entry !== key,
      );
      expect(elsewhere, `${row.candidate.item.n} in ${row.position.label}`).toBe(false);
    }
  });

  it('never asks for two of a Lore item', () => {
    // Ranked per slot and nothing else, three positions all wanted the same
    // Cloak of Scales and both fingers wanted the same Engineer's Ring — a
    // shopping list the client refuses. Lore items are handed out once.
    const lore = report.rows
      .filter((row) => isLore(row.candidate.item))
      .map((row) => row.candidate.item.n.toLowerCase());
    expect(new Set(lore).size).toBe(lore.length);
    expect(lore.length).toBeGreaterThan(0);
  });

  it('names what a recommendation gives up outside these weights', () => {
    // The Balanced preset weights no regeneration, and Avenrae's neck piece is
    // nothing but regeneration, so the row that replaces it has to say so.
    const neck = report.rows.find((row) => row.position.id === 'NECK');
    if (neck?.wornName === 'Talisman of Kejaar Kerrath') {
      expect(neck.unweighted.length).toBeGreaterThan(0);
      for (const delta of neck.unweighted) expect(delta.delta).toBeLessThan(0);
    }
    // Whatever the row, an uncounted loss is never a stat the set weights.
    for (const row of report.rows) {
      for (const delta of row.unweighted) {
        expect(row.deltas.map((d) => d.key)).not.toContain(delta.key);
      }
    }
  });

  it('scores each candidate at the tier its slot already carries', () => {
    for (const row of report.rows) {
      expect(row.candidate.upgrade.full, row.position.label).toBe(row.wornUpgrade.full);
    }
  });

  it('withholds the Shadow Rage Helm slot rather than scoring a zero', () => {
    // What a share link or a hand-built set can hold: the helm the player is
    // genuinely wearing, which the catalog can name and cannot measure.
    const helm = state.byName.get('shadow rage helm') as Item;
    expect(statsAreUnknown(helm)).toBe(true);

    const worn = base({
      ...importedSet.slots,
      HEAD: { itemName: helm.n, upgrade: tier(5) },
    });
    const result = computeUpgrades(state, slotViews(worn, state), CONTEXT, worn.weights, {
      filters: { ...DEFAULT_SET_FILTERS },
      basis: { kind: 'worn' },
    });

    expect(result.rows.some((row) => row.position.id === 'HEAD')).toBe(false);
    const held = result.withheld.find((entry) => entry.position.id === 'HEAD');
    expect(held?.reason).toBe('worn-unstatted');
    expect(held?.wornName).toBe('Shadow Rage Helm');
    expect(held?.wornUpgrade.full).toBe(5);
    // It still names the best scoring alternative — with no subtraction claimed.
    expect(held?.candidate?.item.n).toBeTruthy();
  });

  it('tells the player where the recommendation comes from', () => {
    const withSource = report.rows.filter((row) => row.candidate.item.src);
    // The shards carry acquisition data for the overwhelming majority of the
    // catalog; this asserts the screen is reading it rather than that every
    // single row has one.
    expect(withSource.length).toBeGreaterThan(report.rows.length / 2);
    for (const row of withSource) {
      const src = row.candidate.item.src;
      expect(
        Boolean(src?.z?.length || src?.m?.length || src?.q?.length || src?.v?.length || src?.c),
        row.candidate.item.n,
      ).toBe(true);
    }
  });
});
