/**
 * Fidelity: the same set must produce the same numbers however it travelled.
 *
 * A share link, a JSON export and a browser reload all rebuild a gear set from
 * a serialised form. If any of them rounds, reorders or quietly drops a field,
 * two players comparing the same plan see different totals. These tests hold a
 * deliberately awkward set — every position filled, banked fractions, both
 * doubled slots, both Any Slots, exaltation donors, negative and capped stats —
 * and assert the totals come back byte-identical.
 *
 * They also pin the ranking invariants: a score depends on the item, the tier,
 * the weights and the cap context, and on nothing else.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { SLOT_POSITIONS } from '../engine/constants';
import { computeTotals } from '../engine/stats';
import { tier, type UpgradeState } from '../engine/upgrade';
import type { GearSet, Item } from '../engine/types';
import { useCatalog, type CatalogState } from '../data/catalog';
import { decodePlan, encodePlan, planFrom, type SharedPlan } from '../share/codec';
import { sanitizeState } from '../state/persistence';
import { activeContext, buildCharacter, type Character } from '../engine/character';
import { rankSlotItems, resolvedEntries, slotViews, totalsFor } from './gear';

const CHARACTER: Character = buildCharacter({
  id: 'char_1', name: 'Avenrae', classes: ['BRD', 'WAR', 'BER'], level: 50, race: 'HFL',
});
const CONTEXT = activeContext(CHARACTER);

const WEIGHTS = { AC: 2, STR: 1.25, HP: 0.2, RATIO: 20, HASTE: 2, SV_MAGIC: 0.3 };

function catalog(): CatalogState {
  return useCatalog.getState();
}

/** A set that exercises every awkward corner at once. */
function complexSet(items: Item[]): GearSet {
  const slots: GearSet['slots'] = {};
  // Deliberately uneven tiers, including banked fractions and both extremes.
  const tiers: UpgradeState[] = [
    { full: 0, fraction: 0 },
    { full: 3, fraction: 5 },
    { full: 10, fraction: 0 },
    { full: 7, fraction: 63 },
    { full: 1, fraction: 1 },
  ];
  SLOT_POSITIONS.forEach((position, index) => {
    const item = items[index % items.length];
    if (!item) return;
    slots[position.id] = {
      itemName: item.n,
      upgrade: tiers[index % tiers.length] as UpgradeState,
      ...(index % 4 === 0 ? { exaltations: { worn: item.n, focus: item.n } } : {}),
    };
  });
  return {
    id: 'set_1', characterId: CHARACTER.id, name: 'Everything At Once',
    slots, weights: { ...WEIGHTS }, notes: 'round trip · fixture',
    createdAt: 1_700_000_000_000, updatedAt: 1_700_000_100_000,
  };
}

beforeEach(() => {
  useCatalog.getState().loadFixture();
});

describe('a round-tripped set produces identical totals', () => {
  it('survives the share codec unchanged', () => {
    const set = complexSet(catalog().items);
    const before = totalsFor(slotViews(set, catalog()));

    const decoded = decodePlan(encodePlan(planFrom(CHARACTER, set)));
    expect(decoded).not.toBeNull();
    const rebuilt: GearSet = { ...set, slots: (decoded as SharedPlan).set.slots };
    const after = totalsFor(slotViews(rebuilt, catalog()));

    expect(after).toEqual(before);
    expect(JSON.stringify(after)).toBe(JSON.stringify(before));
  });

  it('carries every filled position, tier and donor across the link', () => {
    const set = complexSet(catalog().items);
    const decoded = decodePlan(encodePlan(planFrom(CHARACTER, set)));
    const slots = (decoded as SharedPlan).set.slots;

    expect(Object.keys(slots).sort()).toEqual(Object.keys(set.slots).sort());
    for (const position of SLOT_POSITIONS) {
      const original = set.slots[position.id];
      const copy = slots[position.id];
      if (!original) continue;
      expect(copy?.itemName).toBe(original.itemName);
      expect(copy?.upgrade).toEqual(original.upgrade);
      expect(copy?.exaltations).toEqual(original.exaltations);
    }
  });

  it('preserves the character and the weight profile', () => {
    const set = complexSet(catalog().items);
    const decoded = decodePlan(encodePlan(planFrom(CHARACTER, set))) as SharedPlan;
    expect(decoded.character.name).toBe('Avenrae');
    expect(decoded.character.race).toBe('HFL');
    expect(decoded.character.loadouts[0]?.classes).toEqual(['BRD', 'WAR', 'BER']);
    expect(decoded.character.levels).toEqual(CHARACTER.levels);
    expect(decoded.set.weights).toEqual(WEIGHTS);
    expect(decoded.set.notes).toBe('round trip · fixture');
  });

  it('is idempotent: encoding the decoded plan gives the same payload', () => {
    const plan = planFrom(CHARACTER, complexSet(catalog().items));
    const once = encodePlan(plan);
    const twice = encodePlan(decodePlan(once) as SharedPlan);
    expect(twice).toBe(once);
  });

  it('survives the persistence sanitiser unchanged', () => {
    const set = complexSet(catalog().items);
    const before = totalsFor(slotViews(set, catalog()));
    const clean = sanitizeState({
      characters: [CHARACTER], sets: [set], activeCharacterId: CHARACTER.id,
    });
    expect(clean).not.toBeNull();
    const restored = clean?.sets[0] as GearSet;
    expect(totalsFor(slotViews(restored, catalog()))).toEqual(before);
  });

  it('survives a JSON storage round trip unchanged', () => {
    const set = complexSet(catalog().items);
    const before = totalsFor(slotViews(set, catalog()));
    const restored = JSON.parse(JSON.stringify(set)) as GearSet;
    expect(totalsFor(slotViews(restored, catalog()))).toEqual(before);
  });
});

describe('aggregation is order-independent', () => {
  it('gives the same totals whatever order the positions are summed in', () => {
    const set = complexSet(catalog().items);
    const entries = resolvedEntries(slotViews(set, catalog()));
    const forward = computeTotals(entries);
    const backward = computeTotals([...entries].reverse());
    expect(backward).toEqual(forward);
  });

  it('drops the whole contribution of a position when it is cleared', () => {
    const set = complexSet(catalog().items);
    const full = totalsFor(slotViews(set, catalog()));
    const withoutChest: GearSet = { ...set, slots: { ...set.slots, CHEST: undefined } };
    const cleared = totalsFor(slotViews(withoutChest, catalog()));
    const excluded = totalsFor(slotViews(set, catalog()), 'CHEST');
    expect(cleared).toEqual(excluded);
    expect(cleared.ac).toBeLessThanOrEqual(full.ac);
  });

  it('empties to exactly zero when every slot is cleared', () => {
    const empty: GearSet = { ...complexSet(catalog().items), slots: {} };
    const totals = totalsFor(slotViews(empty, catalog()));
    expect(totals).toEqual(computeTotals([]));
  });
});

describe('ranking is stable and deterministic', () => {
  const options = {
    slot: 'PRIMARY' as const,
    context: CONTEXT,
    weights: WEIGHTS,
    upgrade: tier(0),
    includeUnreleased: false,
  };

  it('returns the same order for the same inputs', () => {
    const a = rankSlotItems(catalog(), options).map((row) => row.item.n);
    const b = rankSlotItems(catalog(), options).map((row) => row.item.n);
    expect(b).toEqual(a);
  });

  it('breaks ties by name, so equal scores never shuffle', () => {
    const ranked = rankSlotItems(catalog(), { ...options, weights: {} });
    const names = ranked.map((row) => row.item.n);
    expect(names).toEqual([...names].sort((x, y) => x.localeCompare(y)));
  });

  it('does not move when an unrelated slot changes, with caps far away', () => {
    const base = rankSlotItems(catalog(), options);
    const withContext = rankSlotItems(catalog(), {
      ...options,
      existing: { attributes: { STR: 40, AGI: 12 }, saves: { MAGIC: 20 } },
    });
    expect(withContext.map((row) => row.item.n)).toEqual(base.map((row) => row.item.n));
    expect(withContext.map((row) => row.score)).toEqual(base.map((row) => row.score));
  });

  it('does move once the context reaches a ceiling, which is the point', () => {
    const base = rankSlotItems(catalog(), options);
    const capped = rankSlotItems(catalog(), {
      ...options,
      existing: { attributes: { STR: 510, STA: 510, AGI: 510, WIS: 510 }, saves: {} },
    });
    expect(capped.some((row, i) => row.score !== base[i]?.score)).toBe(true);
  });

  it('scores a slot at the previewed tier, which is the tier the picker equips', () => {
    const zero = rankSlotItems(catalog(), options);
    const seven = rankSlotItems(catalog(), { ...options, upgrade: tier(7) });
    const best = seven[0];
    expect(best).toBeDefined();
    const at0 = zero.find((row) => row.item.n === best?.item.n);
    expect(best?.score).toBeGreaterThan(at0?.score ?? 0);

    // What the picker previews at +7 is what a set holding it at +7 totals.
    const set: GearSet = {
      id: 's', characterId: CHARACTER.id, name: 'S',
      slots: { PRIMARY: { itemName: best?.item.n ?? '', upgrade: tier(7) } },
      weights: WEIGHTS, createdAt: 0, updatedAt: 0,
    };
    const totals = totalsFor(slotViews(set, catalog()));
    const solo = computeTotals([
      { position: 'PRIMARY', item: best?.item as Item, upgrade: tier(7) },
    ]);
    expect(totals).toEqual(solo);
  });
});
