import { beforeEach, describe, expect, it } from 'vitest';
import type { Character } from '../engine/character';
import { SLOT_POSITIONS } from '../engine/constants';
import { tier } from '../engine/upgrade';
import type { GearSet } from '../engine/types';
import { useCatalog, type CatalogState } from '../data/catalog';
import {
  autoFill,
  rankSlotItems,
  slotViews,
  statDeltas,
  statVector,
  summarizeItem,
  totalsFor,
  ratioText,
} from './gear';

const WARRIOR: Character = {
  id: 'c',
  name: 'Test',
  level: 50,
  classes: ['WAR', 'BRD', 'BER'],
  race: null,
};

const CASTER: Character = {
  id: 'c2',
  name: 'Test2',
  level: 50,
  classes: ['WIZ'],
  race: null,
};

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
    expect(ratioText(14, 30)).toBe('0.47');
    expect(ratioText(14, 0)).toBe('—');
  });
});

describe('ranking', () => {
  it('sorts candidates by EP descending', () => {
    const ranked = rankSlotItems(catalog(), {
      slot: 'HEAD',
      character: WARRIOR,
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
      character: WARRIOR,
      weights: { AC: 1, INT: 1 },
      upgrade: tier(0),
      includeUnreleased: false,
    });
    const caster = rankSlotItems(catalog(), {
      slot: 'HEAD',
      character: CASTER,
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
      character: WARRIOR,
      weights: { RATIO: 20 },
      upgrade: tier(0),
      includeUnreleased: false,
    });
    const all = rankSlotItems(catalog(), {
      slot: 'PRIMARY',
      character: WARRIOR,
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
      character: WARRIOR,
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
      character: CASTER,
      weights: { INT: 1 },
      upgrade: tier(0),
      includeUnreleased: false,
    });
    const capped = rankSlotItems(catalog(), {
      slot: 'HEAD',
      character: CASTER,
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
      character: WARRIOR,
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
    const result = autoFill(catalog(), views, WARRIOR, { AC: 2, STR: 1, HP: 0.2, RATIO: 20 }, {
      includeUnreleased: false,
      keepFilled: false,
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
    const result = autoFill(catalog(), views, WARRIOR, { AC: 2 }, {
      includeUnreleased: false,
      keepFilled: true,
    });
    expect(result.assigned.some((a) => a.position === 'HEAD')).toBe(false);
  });

  it('places nothing when every weight is zero', () => {
    const views = slotViews(gearSet(), catalog());
    const result = autoFill(catalog(), views, WARRIOR, {}, {
      includeUnreleased: false,
      keepFilled: false,
    });
    expect(result.assigned).toEqual([]);
    expect(result.skipped.length).toBe(23);
  });
});
