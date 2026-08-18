/**
 * The upgrade ranking itself, without a DOM.
 *
 * Everything here is a rule the screen inherits from the engine and must not
 * quietly route around: an unmeasured item is never ranked *and* never ranked
 * against, an item the trio cannot equip is not an upgrade, the tier being
 * compared at is the one that was asked for, and the EP a row prints is the
 * same number the slot's own picker prints.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { canUse, makeContext } from '../engine/character';
import { scoreItem, type WeightProfile } from '../engine/ep';
import { tier, type UpgradeState } from '../engine/upgrade';
import type { GearSet, Item } from '../engine/types';
import { useCatalog, type CatalogState } from '../data/catalog';
import { rankSlotItems, scoreContextFrom, slotViews, statDeltas, totalsFor } from '../selectors/gear';
import { DEFAULT_SET_FILTERS, type SetFilters } from '../lib/setFilters';
import {
  acquisitionLines, computeUpgrades, hasAnyWeight, isLore, unweightedLosses, weightedDeltas,
  type CompareBasis, type UpgradeReport,
} from './Upgrades';

const CONTEXT = makeContext(['WAR', 'BRD', 'BER'], null, { WAR: 50, BRD: 50, BER: 50 });

/** Rewards AC and raw stat density; a weapon still counts through RATIO. */
const WEIGHTS: WeightProfile = { AC: 2, STR: 1, STA: 1, HP: 0.2, RATIO: 20 };

function catalog(): CatalogState {
  return useCatalog.getState();
}

function gearSet(slots: GearSet['slots'] = {}, weights: WeightProfile = WEIGHTS): GearSet {
  return {
    id: 'set_1',
    characterId: 'char_1',
    name: 'Main Set',
    slots,
    weights: { ...weights },
    createdAt: 1,
    updatedAt: 2,
  };
}

function report(
  set: GearSet,
  options: { basis?: CompareBasis; filters?: SetFilters } = {},
): UpgradeReport {
  return computeUpgrades(catalog(), slotViews(set, catalog()), CONTEXT, set.weights, {
    filters: options.filters ?? { ...DEFAULT_SET_FILTERS },
    basis: options.basis ?? { kind: 'worn' },
  });
}

function rowFor(result: UpgradeReport, positionId: string) {
  return result.rows.find((row) => row.position.id === positionId);
}

/** Push an extra item into the loaded fixture catalog, index and all. */
function addItem(item: Item): void {
  const state = catalog();
  const items = [...state.items, item];
  const bySlot = new Map(state.bySlot);
  for (const slot of item.sl) {
    bySlot.set(slot as never, [...(bySlot.get(slot as never) ?? []), item]);
  }
  useCatalog.setState({
    items,
    byName: new Map(items.map((i) => [i.n.toLowerCase(), i])),
    bySlot,
    revision: state.revision + 1,
  });
}

function item(partial: Partial<Item> & Pick<Item, 'n' | 'sl'>): Item {
  return {
    id: null, cl: ['ALL'], ra: ['ALL'], st: {}, sv: {}, fl: [], av: true, era: 'Classic', ...partial,
  };
}

beforeEach(() => {
  useCatalog.getState().loadFixture();
});

describe('what the ranking offers', () => {
  it('gives an empty slot the candidate’s whole score as the gain', () => {
    const result = report(gearSet());
    const head = rowFor(result, 'HEAD');

    expect(head?.candidate.item.n).toBe('[Fixture] Iron Helm');
    expect(head?.wornName).toBeUndefined();
    expect(head?.wornEp).toBe(0);
    expect(head?.gain).toBeCloseTo(head?.candidate.ep ?? 0, 10);
    expect(head?.gain).toBeGreaterThan(0);
  });

  it('orders rows by gain, biggest first', () => {
    const gains = report(gearSet()).rows.map((row) => row.gain);
    expect(gains.length).toBeGreaterThan(3);
    for (let i = 1; i < gains.length; i++) {
      expect(gains[i - 1]).toBeGreaterThanOrEqual(gains[i] as number);
    }
  });

  it('never offers an item this trio cannot equip, however well it scores', () => {
    // Under caster weights the Wizard-only cowl is the highest scoring item in
    // the Head pool by a wide margin — and a Warrior/Bard/Berserker still
    // cannot put it on.
    const caster: WeightProfile = { INT: 5, MANA: 2, AC: 0.1 };
    const cowl = catalog().byName.get('[fixture] silk cowl') as Item;
    for (const other of catalog().items.filter((i) => i.sl.includes('HEAD') && i !== cowl)) {
      expect(scoreItem(cowl, tier(0), caster).total).toBeGreaterThan(
        scoreItem(other, tier(0), caster).total,
      );
    }

    const result = report(gearSet({}, caster));
    expect(result.rows.map((row) => row.candidate.item.n)).not.toContain('[Fixture] Silk Cowl');
    // Nothing offered anywhere fails the eligibility gate.
    for (const row of result.rows) {
      expect(
        canUse(
          { classes: row.candidate.item.cl, races: row.candidate.item.ra },
          CONTEXT,
        ),
        row.candidate.item.n,
      ).toBe(true);
    }
  });

  it('does not offer an item already worn somewhere else in the set', () => {
    const set = gearSet({ ANY_1: { itemName: '[Fixture] Charm of Anywhere', upgrade: tier(0) } });
    const result = report(set);

    expect(rowFor(result, 'ANY_2')?.candidate.item.n).not.toBe('[Fixture] Charm of Anywhere');
    // The slot wearing it still measures against it rather than skipping it.
    expect(result.withheld.map((w) => w.position.id)).not.toContain('ANY_1');
  });

  it('offers a Lore item once, in the position where it gains the most', () => {
    // Both fingers want it and the game allows one. `Band of Small Favours` is
    // the fixture's other ring, so the loser has somewhere to fall to.
    addItem(item({ n: 'Lorebound Signet', sl: ['FINGERS'], st: { AC: 25 }, fl: ['LORE'] }));
    const result = report(gearSet());

    const offered = result.rows
      .filter((row) => row.candidate.item.n === 'Lorebound Signet')
      .map((row) => row.position.id);
    expect(offered).toHaveLength(1);

    const other = offered[0] === 'FINGERS_1' ? 'FINGERS_2' : 'FINGERS_1';
    expect(rowFor(result, other)?.candidate.item.n).toBe('[Fixture] Band of Small Favours');
  });

  it('still offers an ordinary item twice — and says how many you would need', () => {
    const result = report(gearSet());
    const fingers = ['FINGERS_1', 'FINGERS_2'].map((id) => rowFor(result, id));
    expect(fingers[0]?.candidate.item.n).toBe('[Fixture] Band of Small Favours');
    expect(fingers[1]?.candidate.item.n).toBe('[Fixture] Band of Small Favours');
    expect(fingers[0]?.alsoFor).toContain('Fingers 2');
    expect(fingers[1]?.alsoFor).toContain('Fingers 1');
  });

  it('never says a Lore item is also best somewhere else', () => {
    addItem(item({ n: 'Lorebound Signet', sl: ['FINGERS'], st: { AC: 25 }, fl: ['LORE'] }));
    const result = report(gearSet());
    const lore = result.rows.find((row) => row.candidate.item.n === 'Lorebound Signet');
    expect(lore?.alsoFor).toEqual([]);
  });

  it('reports a settled slot instead of a zero-gain row', () => {
    const empty = report(gearSet());
    const bestHead = rowFor(empty, 'HEAD')?.candidate.item.n as string;

    const filled = report(gearSet({ HEAD: { itemName: bestHead, upgrade: tier(0) } }));
    expect(rowFor(filled, 'HEAD')).toBeUndefined();
    expect(filled.settled).toBeGreaterThan(0);
  });
});

describe('items nobody has measured', () => {
  const PHANTOM = item({
    n: '[Fixture] Unrecorded Crown',
    sl: ['HEAD'],
    // Stats that would win the slot outright — and a record that says out loud
    // that nobody has confirmed them.
    st: { AC: 500, STR: 100 },
    statsUnknown: true,
    evidence: 'Worn in the owner’s client; no catalog carries its numbers.',
  });

  it('never recommends an item whose stats are unknown', () => {
    addItem(PHANTOM);
    const result = report(gearSet());

    expect(rowFor(result, 'HEAD')?.candidate.item.n).toBe('[Fixture] Iron Helm');
    expect(result.rows.map((row) => row.candidate.item.n)).not.toContain(PHANTOM.n);
  });

  it('withholds a slot whose worn item has no published stats, and claims no gain', () => {
    addItem(PHANTOM);
    const result = report(gearSet({ HEAD: { itemName: PHANTOM.n, upgrade: tier(5) } }));

    expect(rowFor(result, 'HEAD')).toBeUndefined();
    const held = result.withheld.find((entry) => entry.position.id === 'HEAD');
    expect(held?.reason).toBe('worn-unstatted');
    expect(held?.wornName).toBe(PHANTOM.n);
    expect(held?.wornUpgrade.full).toBe(5);
    expect(held?.evidence).toContain('no catalog carries its numbers');
    // It still says what the slot's best scoring item is — with no subtraction.
    expect(held?.candidate?.item.n).toBe('[Fixture] Iron Helm');
    expect(held).not.toHaveProperty('gain');
  });

  it('withholds a slot whose worn item is not in the catalog at all', () => {
    const result = report(gearSet({ FEET: { itemName: 'Item That Does Not Exist', upgrade: tier(2) } }));

    expect(rowFor(result, 'FEET')).toBeUndefined();
    const held = result.withheld.find((entry) => entry.position.id === 'FEET');
    expect(held?.reason).toBe('worn-unresolved');
    expect(held?.wornName).toBe('Item That Does Not Exist');
  });
});

describe('the tier the comparison is made at', () => {
  const SET = gearSet({ PRIMARY: { itemName: '[Fixture] Bronze Longsword', upgrade: tier(5) } });

  it('scores the candidate at the slot’s own tier by default', () => {
    // The buckler is the only Secondary this trio can wear, and Secondary is
    // empty, so it is the row that moves when the basis does.
    const worn = report(SET);
    const secondary = rowFor(worn, 'SECONDARY');
    expect(secondary?.candidate.upgrade.full).toBe(0);

    const fixed = report(SET, { basis: { kind: 'fixed', upgrade: tier(10) } });
    const lifted = rowFor(fixed, 'SECONDARY');
    expect(lifted?.candidate.upgrade.full).toBe(10);
    expect(lifted?.gain).toBeGreaterThan(secondary?.gain ?? 0);
  });

  it('keeps the worn item at its own tier under a fixed basis', () => {
    const result = report(SET, { basis: { kind: 'fixed', upgrade: tier(0) } });
    // Primary holds the only weapon this trio can use, so nothing can beat it
    // at +0 while it sits at +5: the slot is settled, not a row.
    expect(rowFor(result, 'PRIMARY')).toBeUndefined();

    const views = slotViews(SET, catalog());
    const existing = scoreContextFrom(totalsFor(views, 'PRIMARY'));
    const sword = catalog().byName.get('[fixture] bronze longsword') as Item;
    const at5 = scoreItem(sword, tier(5), SET.weights, { existing }).total;
    const at0 = scoreItem(sword, tier(0), SET.weights, { existing }).total;
    expect(at5).toBeGreaterThan(at0);
  });
});

describe('the numbers agree with the rest of the app', () => {
  it('prints the EP the slot’s own picker prints', () => {
    const set = gearSet({ HEAD: { itemName: '[Fixture] Iron Helm', upgrade: tier(3) } });
    const views = slotViews(set, catalog());
    const result = report(set);

    for (const row of result.rows) {
      const existing = scoreContextFrom(totalsFor(views, row.position.id));
      const ranked = rankSlotItems(catalog(), {
        slot: row.position.type as never,
        context: CONTEXT,
        weights: set.weights,
        upgrade: row.candidate.upgrade,
        existing,
      });
      const seen = ranked.find((entry) => entry.item.n === row.candidate.item.n);
      expect(seen?.score, `${row.position.label} · ${row.candidate.item.n}`).toBeCloseTo(
        row.candidate.ep,
        10,
      );
    }
  });

  it('measures the worn item cap-aware against the rest of the set', () => {
    // A charm in the off hand, which the buckler beats: a slot with both a worn
    // item to subtract and a better candidate to subtract it from.
    const set = gearSet({ SECONDARY: { itemName: '[Fixture] Charm of Anywhere', upgrade: tier(2) } });
    const row = rowFor(report(set), 'SECONDARY');
    expect(row?.candidate.item.n).toBe('[Fixture] Buckler of Practice');

    const views = slotViews(set, catalog());
    const existing = scoreContextFrom(totalsFor(views, 'SECONDARY'));
    const charm = catalog().byName.get('[fixture] charm of anywhere') as Item;
    const expected = scoreItem(charm, tier(2), set.weights, { existing }).total;

    expect(row?.wornEp).toBeCloseTo(expected, 10);
    expect(row?.gain).toBeCloseTo((row?.candidate.ep ?? 0) - expected, 10);
  });
});

describe('the set’s own filters', () => {
  it('narrows the candidates exactly as the pickers and auto-fill do', () => {
    const sky: SetFilters = { era: 'Sky', source: 'any', hideNoDrop: false };
    const result = report(gearSet(), { filters: sky });

    for (const row of result.rows) {
      expect(row.candidate.item.era, row.candidate.item.n).toBe('Sky');
    }
    // Head only holds Classic items for this trio, so it drops out entirely.
    expect(rowFor(result, 'HEAD')).toBeUndefined();
    expect(result.nothing).toContain('Head');
  });
});

describe('the supporting readouts', () => {
  it('shows the stats the set actually weights, strongest contribution first', () => {
    const before = item({ n: 'Before', sl: ['HEAD'], st: { AC: 10, CHA: 40 } });
    const after = item({ n: 'After', sl: ['HEAD'], st: { AC: 30, CHA: 0, STR: 4 } });
    const deltas = weightedDeltas(statDeltas(after, tier(0), before, tier(0)), {
      AC: 2, STR: 1,
    });

    expect(deltas.map((d) => d.key)).toEqual(['AC', 'STR']);
    expect(deltas[0]?.delta).toBe(20);
  });

  it('names what a swap gives up outside the weights', () => {
    // The exact shape of Avenrae's neck slot: regeneration the Balanced preset
    // does not weight, traded for AC that it does.
    const before = item({ n: 'Regen Charm', sl: ['NECK'], st: { HP_REGEN: 2, MANA_REGEN: 2 } });
    const after = item({ n: 'Plain Charm', sl: ['NECK'], st: { AC: 20 } });
    const deltas = statDeltas(after, tier(0), before, tier(0));

    expect(weightedDeltas(deltas, { AC: 1 }).map((d) => d.key)).toEqual(['AC']);
    const lost = unweightedLosses(deltas, { AC: 1 });
    expect(lost.map((d) => d.key).sort()).toEqual(['MANA_REGEN', 'REGEN']);
    for (const delta of lost) expect(delta.delta).toBeLessThan(0);
    // A stat the set does weight never appears as an uncounted loss.
    expect(unweightedLosses(deltas, { AC: 1, HP_REGEN: 5, MANA_REGEN: 5 })).toEqual([]);
  });

  it('keeps a stat the corpus and the weight editor spell differently', () => {
    const before = item({ n: 'Before', sl: ['HEAD'], st: {} });
    const after = item({ n: 'After', sl: ['HEAD'], st: { HP_REGEN: 3 } });
    // `statVector` emits this as REGEN; the weight is called HP_REGEN.
    const deltas = weightedDeltas(statDeltas(after, tier(0), before, tier(0)), { HP_REGEN: 5 });
    expect(deltas.map((d) => d.key)).toEqual(['REGEN']);
  });

  it('reads acquisition data off the catalog and counts what it truncates', () => {
    const lines = acquisitionLines(
      item({
        n: 'Sourced',
        sl: ['HEAD'],
        src: {
          z: ['Lower Guk', 'Upper Guk', 'Najena', 'Befallen'],
          m: ['a ghoul cavalier'],
          q: ['The Harvester'],
          v: ['Merchant Vahn'],
          c: true,
        },
      }),
    );

    expect(lines.map((l) => l.label)).toEqual(['Zone', 'Drops from', 'Quest', 'Vendor', 'Crafted']);
    expect(lines[0]?.text).toBe('Lower Guk · Upper Guk · Najena');
    expect(lines[0]?.more).toBe(1);
    expect(lines[1]?.more).toBe(0);
  });

  it('returns nothing rather than a guess when the catalog records no source', () => {
    expect(acquisitionLines(item({ n: 'Bare', sl: ['HEAD'] }))).toEqual([]);
  });

  it('reads Lore in either spelling the corpus uses', () => {
    expect(isLore(item({ n: 'A', sl: ['HEAD'], fl: ['LORE'] }))).toBe(true);
    expect(isLore(item({ n: 'B', sl: ['HEAD'], fl: ['LORE_EQUIPPED'] }))).toBe(true);
    expect(isLore(item({ n: 'C', sl: ['HEAD'], fl: ['MAGIC', 'NO_DROP'] }))).toBe(false);
  });

  it('knows when a set weights nothing at all', () => {
    expect(hasAnyWeight({})).toBe(false);
    expect(hasAnyWeight({ AC: 0, HP: 0 })).toBe(false);
    expect(hasAnyWeight({ AC: 0, HP: 0.2 })).toBe(true);
  });
});

describe('the report as a whole', () => {
  it('accounts for every position exactly once', () => {
    const set = gearSet({
      HEAD: { itemName: '[Fixture] Iron Helm', upgrade: tier(0) },
      FEET: { itemName: 'Item That Does Not Exist', upgrade: tier(0) as UpgradeState },
    });
    const result = report(set);
    const positions = slotViews(set, catalog()).length;

    expect(
      result.rows.length + result.withheld.length + result.settled + result.nothing.length,
    ).toBe(positions);
  });

  it('sums the listed gains it printed, and nothing else', () => {
    const result = report(gearSet());
    const sum = result.rows.reduce((total, row) => total + row.gain, 0);
    expect(result.totalGain).toBeCloseTo(sum, 10);
  });
});
