import { beforeEach, describe, expect, it } from 'vitest';
import { activeContext, buildCharacter, type Character } from '../engine/character';
import { SLOT_POSITIONS } from '../engine/constants';
import { tier } from '../engine/upgrade';
import type { GearSet } from '../engine/types';
import { useCatalog, type CatalogState } from '../data/catalog';
import { DEFAULT_SET_FILTERS, type SetFilters } from '../lib/setFilters';
import {
  autoFill,
  describeAutoFill,
  rankSlotItems,
  slotViews,
  statDeltas,
  statVector,
  summarizeItem,
  totalsFor,
  ratioText,
} from './gear';

const WARRIOR: Character = buildCharacter({
  id: 'c', name: 'Test', classes: ['WAR', 'BRD', 'BER'], level: 50,
});
const CASTER: Character = buildCharacter({ id: 'c2', name: 'Test2', classes: ['WIZ'], level: 50 });
const WARRIOR_CTX = activeContext(WARRIOR);
const CASTER_CTX = activeContext(CASTER);

function gearSet(slots: GearSet['slots'] = {}): GearSet {
  return {
    id: 's',
    characterId: 'c',
    name: 'Set',
    slots,
    weights: { AC: 2, STR: 1, HP: 0.2, RATIO: 20 },
    createdAt: 0,
    updatedAt: 0,
  };
}

function catalog(): CatalogState {
  return useCatalog.getState();
}

beforeEach(() => {
  useCatalog.getState().loadFixture();
});

describe('slot views', () => {
  it('produces one view per position, in SLOT_POSITIONS order', () => {
    const views = slotViews(gearSet(), catalog());
    expect(views).toHaveLength(SLOT_POSITIONS.length);
    expect(views).toHaveLength(23);
    expect(views.map((v) => v.position.id)).toEqual(SLOT_POSITIONS.map((p) => p.id));
    expect(views.every((v) => v.item === undefined && !v.unresolved)).toBe(true);
  });

  it('resolves equipped names case-insensitively and flags unknown ones', () => {
    const views = slotViews(
      gearSet({
        PRIMARY: { itemName: '[fixture] bronze longsword', upgrade: tier(0) },
        HEAD: { itemName: 'Nonexistent Hat', upgrade: tier(0) },
      }),
      catalog(),
    );
    const primary = views.find((v) => v.position.id === 'PRIMARY');
    const head = views.find((v) => v.position.id === 'HEAD');
    expect(primary?.item?.n).toBe('[Fixture] Bronze Longsword');
    expect(primary?.unresolved).toBe(false);
    expect(head?.item).toBeUndefined();
    expect(head?.unresolved).toBe(true);
  });
});

describe('totals', () => {
  it('is numerically clean for an empty set — no NaN anywhere', () => {
    const totals = totalsFor(slotViews(gearSet(), catalog()));
    const numbers = [
      totals.ac, totals.hp, totals.mana, totals.endurance, totals.haste, totals.weight,
      ...Object.values(totals.attributes), ...Object.values(totals.saves),
      ...Object.values(totals.heroic), ...Object.values(totals.spellMods),
      ...Object.values(totals.skillMods),
    ];
    expect(numbers.every((n) => Number.isFinite(n))).toBe(true);
    expect(numbers.every((n) => n === 0)).toBe(true);
  });

  it('sums equipped items and responds to the upgrade level', () => {
    const base = totalsFor(slotViews(gearSet({
      HEAD: { itemName: '[Fixture] Iron Helm', upgrade: tier(0) },
    }), catalog()));
    const upgraded = totalsFor(slotViews(gearSet({
      HEAD: { itemName: '[Fixture] Iron Helm', upgrade: tier(4) },
    }), catalog()));
    expect(base.ac).toBe(8);
    expect(upgraded.ac).toBeGreaterThan(base.ac);
    // Two qualifying fields (STA and SV MAGIC) synthesize the Void save.
    expect(upgraded.saves.VOID).toBe(4);
    expect(base.saves.VOID).toBe(0);
  });

  it('excludes a named position, which is what cap-aware scoring needs', () => {
    const views = slotViews(
      gearSet({
        HEAD: { itemName: '[Fixture] Iron Helm', upgrade: tier(0) },
        ARMS: { itemName: '[Fixture] Plated Vambraces', upgrade: tier(0) },
      }),
      catalog(),
    );
    expect(totalsFor(views).ac).toBe(19);
    expect(totalsFor(views, 'HEAD').ac).toBe(11);
    expect(totalsFor(views, 'ARMS').ac).toBe(8);
  });
});

describe('stat vectors and summaries', () => {
  it('lists only non-zero stats and scales them', () => {
    const item = catalog().byName.get('[fixture] iron helm');
    expect(item).toBeDefined();
    const vector = statVector(item!, tier(0));
    expect(vector.map((e) => e.key).sort()).toEqual(['AC', 'STA', 'SV_MAGIC']);
    const upgraded = statVector(item!, tier(2));
    expect(upgraded.find((e) => e.key === 'AC')?.value).toBe(10);
  });

  it('never emits NaN in a summary, even for a stat-free item', () => {
    const bare = { ...catalog().byName.get('[fixture] iron helm')!, st: {}, sv: {}, wp: undefined };
    expect(summarizeItem(bare, tier(3), {})).toBe('No stats');
    const weapon = catalog().byName.get('[fixture] bronze longsword')!;
    const text = summarizeItem(weapon, tier(2), { RATIO: 20 });
    expect(text).not.toMatch(/NaN/);
    expect(text).toMatch(/^\d+\/\d+/);
  });

  it('computes deltas against the worn item in both directions', () => {
    const helm = catalog().byName.get('[fixture] iron helm')!;
    const cowl = catalog().byName.get('[fixture] silk cowl')!;
    const deltas = statDeltas(cowl, tier(0), helm, tier(0));
    const byKey = Object.fromEntries(deltas.map((d) => [d.key, d.delta]));
    expect(byKey.AC).toBe(-8);
    expect(byKey.INT).toBe(6);
    expect(byKey.MANA).toBe(25);
    expect(byKey.SV_MAGIC).toBe(-3);
  });

  it('formats a ratio without dividing by zero', () => {
    expect(ratioText(14, 30)).toBe('0.467');
    expect(ratioText(14, 0)).toBe('—');
  });

  it('prints every Tier 0 ratio exactly as the live client does', () => {
    // research/validation/TIER0-VALIDATION.md §1.
    expect(ratioText(14, 28)).toBe('0.5');
    expect(ratioText(15, 28)).toBe('0.536');
    expect(ratioText(16, 28)).toBe('0.571');
    expect(ratioText(18, 28)).toBe('0.643');
    expect(ratioText(74, 70)).toBe('1.057');
  });
});

describe('ranking', () => {
  it('sorts candidates by EP descending', () => {
    const ranked = rankSlotItems(catalog(), {
      slot: 'HEAD',
      context: WARRIOR_CTX,
      weights: { AC: 2, STA: 1 },
      upgrade: tier(0),
      includeUnreleased: false,
    });
    expect(ranked.length).toBeGreaterThan(0);
    const scores = ranked.map((r) => r.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
    expect(ranked[0]?.item.n).toBe('[Fixture] Iron Helm');
  });

  it('respects class eligibility across the whole trio', () => {
    const warrior = rankSlotItems(catalog(), {
      slot: 'HEAD',
      context: WARRIOR_CTX,
      weights: { AC: 1, INT: 1 },
      upgrade: tier(0),
      includeUnreleased: false,
    });
    const caster = rankSlotItems(catalog(), {
      slot: 'HEAD',
      context: CASTER_CTX,
      weights: { AC: 1, INT: 1 },
      upgrade: tier(0),
      includeUnreleased: false,
    });
    expect(warrior.map((r) => r.item.n)).not.toContain('[Fixture] Silk Cowl');
    expect(caster.map((r) => r.item.n)).toContain('[Fixture] Silk Cowl');
  });

  it('hides content that is not live unless asked', () => {
    const live = rankSlotItems(catalog(), {
      slot: 'PRIMARY',
      context: WARRIOR_CTX,
      weights: { RATIO: 20 },
      upgrade: tier(0),
      includeUnreleased: false,
    });
    const all = rankSlotItems(catalog(), {
      slot: 'PRIMARY',
      context: WARRIOR_CTX,
      weights: { RATIO: 20 },
      upgrade: tier(0),
      includeUnreleased: true,
    });
    expect(live.map((r) => r.item.n)).not.toContain('[Fixture] Unreleased Blade of Tomorrow');
    expect(all.map((r) => r.item.n)).toContain('[Fixture] Unreleased Blade of Tomorrow');
  });

  it('offers wearable items to the EQL Any Slot positions', () => {
    const ranked = rankSlotItems(catalog(), {
      slot: 'ANY',
      context: WARRIOR_CTX,
      weights: { AC: 1, HP: 0.2, CHA: 1 },
      upgrade: tier(0),
      includeUnreleased: false,
    });
    expect(ranked.map((r) => r.item.n)).toContain('[Fixture] Charm of Anywhere');
    expect(ranked.map((r) => r.item.n)).toContain('[Fixture] Iron Helm');
  });

  it('scores cap-aware: a maxed attribute earns nothing more', () => {
    const uncapped = rankSlotItems(catalog(), {
      slot: 'HEAD',
      context: CASTER_CTX,
      weights: { INT: 1 },
      upgrade: tier(0),
      includeUnreleased: false,
    });
    const capped = rankSlotItems(catalog(), {
      slot: 'HEAD',
      context: CASTER_CTX,
      weights: { INT: 1 },
      upgrade: tier(0),
      includeUnreleased: false,
      existing: {
        attributes: { INT: 510 },
        saves: {},
      },
    });
    const cowlUncapped = uncapped.find((r) => r.item.n === '[Fixture] Silk Cowl');
    const cowlCapped = capped.find((r) => r.item.n === '[Fixture] Silk Cowl');
    expect(cowlUncapped?.score).toBe(6);
    expect(cowlCapped?.score).toBe(0);
  });

  it('returns the identical array for repeated identical queries (memoised)', () => {
    const options = {
      slot: 'HEAD' as const,
      context: WARRIOR_CTX,
      weights: { AC: 1 },
      upgrade: tier(0),
      includeUnreleased: false,
    };
    expect(rankSlotItems(catalog(), options)).toBe(rankSlotItems(catalog(), options));
  });
});

describe('auto-fill', () => {
  it('fills empty slots without wearing the same item twice', () => {
    const views = slotViews(gearSet(), catalog());
    const result = autoFill(catalog(), views, WARRIOR_CTX, { AC: 2, STR: 1, HP: 0.2, RATIO: 20 }, {
      includeUnreleased: false,
      keepFilled: false,
      filters: DEFAULT_SET_FILTERS,
    });
    expect(result.assigned.length).toBeGreaterThan(0);
    const names = result.assigned.map((a) => a.itemName);
    expect(new Set(names).size).toBe(names.length);
    expect(result.assigned.every((a) => SLOT_POSITIONS.some((p) => p.id === a.position))).toBe(true);
  });

  it('leaves already-filled slots alone when asked to', () => {
    const views = slotViews(
      gearSet({ HEAD: { itemName: '[Fixture] Silk Cowl', upgrade: tier(0) } }),
      catalog(),
    );
    const result = autoFill(catalog(), views, WARRIOR_CTX, { AC: 2 }, {
      includeUnreleased: false,
      keepFilled: true,
      filters: DEFAULT_SET_FILTERS,
    });
    expect(result.assigned.some((a) => a.position === 'HEAD')).toBe(false);
  });

  it('places nothing when every weight is zero', () => {
    const views = slotViews(gearSet(), catalog());
    const result = autoFill(catalog(), views, WARRIOR_CTX, {}, {
      includeUnreleased: false,
      keepFilled: false,
      filters: DEFAULT_SET_FILTERS,
    });
    expect(result.assigned).toEqual([]);
    expect(result.skipped.length).toBe(23);
    // Nothing scored, so nothing was excluded — the two reasons a slot can be
    // empty are not interchangeable.
    expect(result.excludedByFilters).toEqual([]);
  });
});

/*
 * The set-creation dialog states, verbatim, "Every item picker in this set
 * opens with these already applied." Auto-fill accepted no era, source or No
 * Drop setting at all, so a set configured for Sky-era / No-Drop-hidden filled
 * itself with a byte-identical answer to the unfiltered run — including items
 * its own HEAD picker reported "1 match" for. Two surfaces on one screen
 * disagreeing about the set's own rules is the defect; these pin both halves.
 */
describe('auto-fill and the set default filters', () => {
  const WEIGHTS = { AC: 2, STR: 1, HP: 0.2, RATIO: 20 };
  const fill = (filters: SetFilters, keepFilled = false) =>
    autoFill(catalog(), slotViews(gearSet(), catalog()), WARRIOR_CTX, WEIGHTS, {
      includeUnreleased: false,
      keepFilled,
      filters,
    });

  const nameAt = (result: ReturnType<typeof fill>, position: string) =>
    result.assigned.find((a) => a.position === position)?.itemName;

  it('places only items from the era the set asks for', () => {
    const unfiltered = fill(DEFAULT_SET_FILTERS);
    const sky = fill({ ...DEFAULT_SET_FILTERS, era: 'Sky' });

    // The fixture's only Sky items are the Boots and the caster-only Mace.
    expect(nameAt(unfiltered, 'FEET')).toBe('[Fixture] Boots of the Swift');
    expect(sky.assigned.map((a) => a.itemName)).toEqual(['[Fixture] Boots of the Swift']);
    // Everything else is left empty rather than filled from outside the filter.
    expect(sky.skipped).toContain('Head');
    expect(sky.skipped).toContain('Primary');
  });

  it('reports a slot the filter emptied as excluded, not as unscorable', () => {
    const sky = fill({ ...DEFAULT_SET_FILTERS, era: 'Sky' });

    // Head has a candidate that scores; the era filter is what removed it.
    expect(sky.skipped).toContain('Head');
    expect(sky.excludedByFilters).toContain('Head');
    // Feet was filled, so it is in neither list.
    expect(sky.skipped).not.toContain('Feet');
    expect(sky.excludedByFilters).not.toContain('Feet');
    expect(sky.excludedByFilters.every((label) => sky.skipped.includes(label))).toBe(true);
  });

  it('never reaches past a No Drop filter to fill a slot', () => {
    const bound = {
      ...catalog().byName.get('[fixture] iron helm')!,
      n: '[Fixture] Bound Helm',
      st: { AC: 40 },
      fl: ['FIXTURE', 'NO_DROP'],
    };
    const items = [...catalog().items, bound];
    useCatalog.setState({
      items,
      byName: new Map(items.map((i) => [i.n.toLowerCase(), i])),
      bySlot: new Map([
        ...catalog().bySlot,
        ['HEAD', [...(catalog().bySlot.get('HEAD') ?? []), bound]],
      ] as never),
      revision: catalog().revision + 1,
    });

    // It out-scores everything in the slot, so an unfiltered run wears it.
    const unfiltered = fill(DEFAULT_SET_FILTERS);
    expect(unfiltered.assigned.map((a) => a.itemName)).toContain('[Fixture] Bound Helm');

    // With No Drop hidden it is not worn anywhere — not on the head, and not
    // pushed into an Any Slot instead. No Drop is a hard raid-planning
    // constraint: a fresh alt cannot buy or trade its way to one.
    const filtered = fill({ ...DEFAULT_SET_FILTERS, hideNoDrop: true });
    expect(filtered.assigned.map((a) => a.itemName)).not.toContain('[Fixture] Bound Helm');
    for (const entry of filtered.assigned) {
      expect(catalog().byName.get(entry.itemName.toLowerCase())?.fl).not.toContain('NO_DROP');
    }
    // The next-best helm is still worn — the filter narrows the pool, it does
    // not stop the fill.
    expect(filtered.assigned.map((a) => a.itemName)).toContain('[Fixture] Iron Helm');
  });

  it('honours the filters on both passes, so cap-awareness sees the same pool', () => {
    // Pass two re-ranks against pass one's totals. If only one pass filtered,
    // the second could reintroduce an excluded item.
    const sky = fill({ ...DEFAULT_SET_FILTERS, era: 'Sky' });
    const skyNames = new Set(sky.assigned.map((a) => a.itemName));
    for (const name of skyNames) {
      expect(catalog().byName.get(name.toLowerCase())?.era).toBe('Sky');
    }
  });

  it('changes nothing when the filters are the defaults', () => {
    const a = fill(DEFAULT_SET_FILTERS);
    const b = autoFill(catalog(), slotViews(gearSet(), catalog()), WARRIOR_CTX, WEIGHTS, {
      includeUnreleased: false,
      keepFilled: false,
      filters: { era: 'any', source: 'any', hideNoDrop: false },
    });
    expect(b.assigned).toEqual(a.assigned);
    expect(a.excludedByFilters).toEqual([]);
  });
});

describe('describeAutoFill', () => {
  const base = { assigned: [], skipped: [], excludedByFilters: [], filters: DEFAULT_SET_FILTERS };

  it('names the filters it applied and the slots they emptied', () => {
    const text = describeAutoFill({
      ...base,
      assigned: Array.from({ length: 21 }, (_, i) => ({ position: `P${i}`, itemName: `I${i}` })),
      skipped: ['Face', 'Range'],
      excludedByFilters: ['Face', 'Range'],
      filters: { era: 'Sky', source: 'any', hideNoDrop: true },
    });
    expect(text).toBe('Auto-fill placed 21 items (Sky era, No Drop hidden) · 2 slots had no match: Face, Range.');
  });

  it('says nothing about filters that are not narrowing anything', () => {
    const text = describeAutoFill({
      ...base,
      assigned: [{ position: 'HEAD', itemName: 'Helm' }],
    });
    expect(text).toBe('Auto-fill placed 1 item.');
  });

  it('blames the filters when they are what emptied the run', () => {
    const text = describeAutoFill({
      ...base,
      skipped: ['Head'],
      excludedByFilters: ['Head'],
      filters: { era: 'Sky', source: 'quest', hideNoDrop: false },
    });
    expect(text).toContain('(Sky era, Quest only)');
    expect(text).toContain("excluded by this set's filters");
  });

  it('blames the weights when the filters are not the reason', () => {
    const text = describeAutoFill({ ...base, skipped: ['Head'] });
    expect(text).toContain('weights are not all zero');
    expect(text).not.toContain('filters');
  });
});
