/**
 * The upgrade ranking itself, without a DOM.
 *
 * Everything here is a rule the screen inherits from the engine and must not
 * quietly route around: an unmeasured item is never ranked *and* never ranked
 * against, an item the trio cannot equip is not an upgrade, the tier being
 * compared at is the one that was asked for, and the EP a row prints is the
 * same number the slot's own picker prints.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { canUse, makeContext } from '../engine/character';
import { scoreItem, type WeightProfile } from '../engine/ep';
import { tier, type UpgradeState } from '../engine/upgrade';
import type { GearSet, Item } from '../engine/types';
import { useCatalog, type CatalogState } from '../data/catalog';
import { normalizeCatalog } from '../data/normalize';
import { rankSlotItems, scoreContextFrom, slotViews, statDeltas, totalsFor } from '../selectors/gear';
import { DEFAULT_SET_FILTERS, type SetFilters } from '../lib/setFilters';
import {
  acquisitionLines, computeUpgrades, dateSpan, hasAnyWeight, isLore, isTwoHanded, measuredDrops,
  WITHHELD_MARK, WITHHELD_TEXT, type WithheldReason,
  totalSightings, unweightedLosses, weightedDeltas, zoneTallies,
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

/**
 * The measured half, which is the reason this tool is worth opening.
 *
 * `acquisitionLines` above says where a wiki page claims an item comes from.
 * These functions say where the game was watched producing it. The rule that
 * governs every one of them is the publisher's own first rule for
 * `sightings.v1.json` and this project's rule independently: **a count, never a
 * rate.** No test here asserts a percentage, because no code path may produce
 * one, and the last test in the file is a scan of the source that says so.
 */
describe('the measured drop data', () => {
  const NAGAFEN = {
    zone: "Nagafen's Lair - Group",
    slug: 'nagafenslair',
    title: "Nagafen's Lair",
    survey: 'partial',
    measured: 4,
    facets: 5,
  };

  const BOULDER = item({
    n: 'Throwing Boulder',
    sl: ['AMMO'],
    ms: [
      {
        mob: 'King Tranix', seen: 7, sessions: 7, zones: [NAGAFEN.zone], zs: [NAGAFEN],
        first: '10 Aug 2026', last: '12 Aug 2026',
      },
      {
        mob: 'Fire Giant Warrior', seen: 73, sessions: 5, zones: [NAGAFEN.zone], zs: [NAGAFEN],
        first: '10 Aug 2026', last: '12 Aug 2026',
      },
      {
        mob: 'An ice giant priest', seen: 18, sessions: 5,
        zones: ['The Permafrost Caverns - Group'],
        first: '10 Aug 2026', last: '11 Aug 2026', offRoster: true,
      },
    ],
  });

  it('orders the sources by how often the drop was seen, not by payload order', () => {
    expect(measuredDrops(BOULDER).map((row) => row.mob)).toEqual([
      'Fire Giant Warrior', 'An ice giant priest', 'King Tranix',
    ]);
  });

  it('returns nothing for an item nobody has watched, rather than an empty claim', () => {
    expect(measuredDrops(item({ n: 'Unwatched', sl: ['HEAD'] }))).toEqual([]);
    expect(measuredDrops(item({ n: 'Empty', sl: ['HEAD'], ms: [] }))).toEqual([]);
  });

  /*
   * `seen` adds because each sighting is one drop attributed to one mob.
   * `sessions` must not: one evening can produce two mobs, and summing the
   * column would print a sample size larger than the sample.
   */
  it('adds the sightings and refuses to add the sessions', () => {
    expect(totalSightings(measuredDrops(BOULDER))).toBe(98);
    const rows = measuredDrops(BOULDER);
    const sessionSum = rows.reduce((n, row) => n + row.sessions, 0);
    expect(sessionSum).toBe(17);
    // Nothing exported from the screen reports that number, because it is not
    // a count of anything: the same session appears in three rows.
    expect(totalSightings(rows)).not.toBe(sessionSum);
  });

  it('spans the dates it can read and withholds the span when it cannot', () => {
    expect(dateSpan(measuredDrops(BOULDER))).toEqual({ first: '10 Aug 2026', last: '12 Aug 2026' });
    expect(dateSpan([{ mob: 'X', seen: 1, sessions: 1, first: 'last tuesday' }])).toBeNull();
    expect(dateSpan([{ mob: 'X', seen: 1, sessions: 1 }])).toBeNull();
  });

  it('rolls the listed upgrades up by zone, counting each item once per zone', () => {
    const rows = [
      { candidate: { item: BOULDER } },
      { candidate: { item: item({
        n: 'Second',
        sl: ['HEAD'],
        ms: [{ mob: 'Magus Rokyl', seen: 7, sessions: 7, zones: [NAGAFEN.zone], zs: [NAGAFEN] }],
      }) } },
      { candidate: { item: item({ n: 'Unwatched', sl: ['FEET'] }) } },
    ] as unknown as UpgradeReport['rows'];

    const tallies = zoneTallies(rows);
    expect(tallies.map((t) => t.zone)).toEqual([
      "Nagafen's Lair - Group", 'The Permafrost Caverns - Group',
    ]);
    // Two items listed in Nagafen's, even though three drop rows name it.
    expect(tallies[0]?.items).toBe(2);
    expect(tallies[0]?.seen).toBe(87);
    expect(tallies[0]?.survey?.measured).toBe(4);
    // No published survey for Permafrost, so none is invented.
    expect(tallies[1]?.survey).toBeNull();
    expect(tallies[1]?.title).toBe('The Permafrost Caverns - Group');
  });

  it('has nothing to roll up when nothing on the list has been measured', () => {
    const rows = [
      { candidate: { item: item({ n: 'Unwatched', sl: ['FEET'] }) } },
    ] as unknown as UpgradeReport['rows'];
    expect(zoneTallies(rows)).toEqual([]);
  });

  /**
   * The rule, enforced against the file rather than against a render.
   *
   * Every other test here can be satisfied by code that also, somewhere, prints
   * `73 / 5 = 14.6 per session`. This one cannot: it reads the screen's own
   * source and fails if any arithmetic is performed on a sighting count at all.
   * A drop seen once is seen once, and nothing in this project may turn that
   * into a rate.
   */
  it('performs no division and prints no percentage on a measured figure', () => {
    const source = readFileSync('src/screens/Upgrades.tsx', 'utf8');
    const strip = (text: string) =>
      text
        // Comments discuss rates and percentages by name; the rule is about
        // what the code does, not about what it is allowed to explain.
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '')
        // Prose legitimately contains the word "rate" when denying there is one.
        .replace(/'[^'\n]*'|"[^"\n]*"|`[^`]*`/g, "''");
    const between = (from: string, to: string) => {
      const start = source.indexOf(from);
      const end = source.indexOf(to, start + 1);
      expect(start, `marker ${from}`).toBeGreaterThan(-1);
      expect(end, `marker ${to}`).toBeGreaterThan(start);
      return strip(source.slice(start, end));
    };

    const whole = strip(source);
    // Nowhere in the screen is a sighting count an operand of a division.
    expect(whole).not.toMatch(/\b(?:seen|sessions|sightings)\s*\//);
    expect(whole).not.toMatch(/\/\s*(?:row|drop|tally)?\.?(?:seen|sessions|sightings)\b/);

    /*
     * And inside the two regions that build the measured card there is no
     * percent sign at all — not on a figure, not on a bar, not anywhere. The
     * EP bar elsewhere on the row is a width relative to the best gain and is
     * deliberately outside this scope; nothing about a drop is.
     */
    for (const region of [
      between('export function measuredDrops', 'export function acquisitionLines'),
      between('function MeasuredDrops(', 'function SourceBlock('),
      between('<section className="upg-zones"', '</section>'),
    ]) {
      expect(region).not.toContain('%');
      expect(region).not.toMatch(/toFixed|toLocaleString\(.*style/);
    }
  });
});

/**
 * The measured data survives the trip from the pipeline to the screen.
 *
 * Every function above was tested against a hand-built row, which proves the
 * logic and nothing about the payload. This reads what the build actually
 * wrote and normalises it exactly as the app does, because the failure this
 * guards against is silent and total: the normaliser constructs a fresh item
 * and copies named fields, so a new field that nobody adds to it is dropped
 * between the shard and the screen with no error anywhere.
 */
describe('the shipped payload reaches the screen with its sightings intact', () => {
  const DIR = 'public/data/items';

  it('carries measured drops on the items the build says carry them', () => {
    if (!existsSync(DIR)) return; // a checkout with no build is not a failure
    let raw = 0;
    let normalised = 0;
    let rows = 0;
    for (const file of readdirSync(DIR)) {
      const payload = JSON.parse(readFileSync(`${DIR}/${file}`, 'utf8')) as {
        items?: Array<{ ms?: unknown[] }>;
      };
      raw += (payload.items ?? []).filter((entry) => Array.isArray(entry.ms) && entry.ms.length)
        .length;
      for (const shipped of normalizeCatalog(payload)) {
        const drops = measuredDrops(shipped);
        if (!drops.length) continue;
        normalised += 1;
        rows += drops.length;
        for (const drop of drops) {
          expect(drop.mob.length).toBeGreaterThan(0);
          expect(Number.isInteger(drop.seen)).toBe(true);
          expect(drop.seen).toBeGreaterThanOrEqual(0);
          expect(Number.isInteger(drop.sessions)).toBe(true);
        }
      }
    }
    expect(raw).toBeGreaterThan(0);
    expect(normalised).toBe(raw);
    expect(rows).toBeGreaterThanOrEqual(normalised);
  });
});

/* ------------------------------------------------------------------------- *
 * A profile with no weapon term cannot rank a hand slot.
 *
 * Measured 2026-08-31: tank, caster and healer weight neither RATIO nor DMG,
 * `add()` returns on a falsy weight, so the weapon block scores exactly zero
 * and Primary is ranked on its stat line alone — putting a 1-damage baton above
 * a 40-damage greatsword, by 18x on tank.
 *
 * These tests exercise `computeUpgrades`, NOT the `scoresWeapons` predicate.
 * The predicate has its own file, and when the withholding was first written
 * that file passed while the screen behaviour was reverted — 973 green with the
 * fix disabled. A guard on the predicate is not a guard on the screen.
 * ------------------------------------------------------------------------- */

/** Tank, verbatim from PRESET_PROFILES: no RATIO, no DMG. */
const BLIND_WEIGHTS: WeightProfile = {
  AC: 2, HP: 0.5, STA: 1.2, STR: 0.4, AGI: 0.6, SV_MAGIC: 0.3, SV_FIRE: 0.2, SV_COLD: 0.2,
};

describe('a weight profile that scores no weapon term', () => {
  it('withholds PRIMARY and SECONDARY instead of ranking them', () => {
    const result = report(gearSet({}, BLIND_WEIGHTS));

    for (const id of ['PRIMARY', 'SECONDARY']) {
      expect(rowFor(result, id)).toBeUndefined();
      const held = result.withheld.find((w) => w.position.id === id);
      expect(held?.reason).toBe('profile-blind-to-weapons');
    }
  });

  it('still ranks every non-hand position, so the remedy is not a blanket refusal', () => {
    const result = report(gearSet({}, BLIND_WEIGHTS));
    const hands = new Set(['PRIMARY', 'SECONDARY']);
    const blindHeld = result.withheld.filter((w) => w.reason === 'profile-blind-to-weapons');
    expect(blindHeld.every((w) => hands.has(w.position.id))).toBe(true);
    // Not vacuous: the profile must actually produce a ranking elsewhere.
    expect(result.rows.length).toBeGreaterThan(0);
  });

  it('ranks the hands normally under a profile that DOES weight a weapon', () => {
    const result = report(gearSet({}, WEIGHTS));
    const blindHeld = result.withheld.filter((w) => w.reason === 'profile-blind-to-weapons');
    expect(blindHeld).toEqual([]);
  });
});

/* ------------------------------------------------------------------------- *
 * A two-handed winner pays for the offhand it empties.
 *
 * The 23 positions are ranked independently, so without netting a two-hander
 * gives up the Secondary for free and can win on paper while losing the trade.
 * Ruled 31 Aug: subtract the worn secondary's EP from the Primary row's value,
 * and PRINT the subtraction rather than suppressing the Secondary row —
 * suppressing hides the evidence and keeps the wrong number.
 *
 * Keyed on `wp.skill` because zero of the 124 two-handed rows in the shipped
 * catalogue list SECONDARY in their slot list: the payload records nothing
 * about a weapon occupying both hands.
 * ------------------------------------------------------------------------- */

describe('a two-handed primary nets off the offhand it costs', () => {
  /*
   * Numbers chosen so the trade is CLEARLY worth it: under WEIGHTS
   * (AC 2, STR 1, STA 1, HP 0.2, RATIO 20) the greatsword is
   * 60*2 + 40 + 3.0*20 = 220 EP and the offhand is 20*2 = 40, so the netted
   * gain is still large. A first draft used a 60 EP greatsword against a 100 EP
   * offhand and the row vanished — which was the netting working correctly and
   * my data being wrong, not a defect. That case is now its own test below.
   */
  const GREATSWORD = item({
    n: '[Test] Greatsword', sl: ['PRIMARY'],
    st: { STR: 40, AC: 60 }, wp: { dmg: 60, dly: 20, skill: '2H Slashing' },
  });
  const ONEHANDER = item({
    n: '[Test] Shortsword', sl: ['PRIMARY'],
    st: { STR: 40, AC: 60 }, wp: { dmg: 60, dly: 20, skill: '1H Slashing' },
  });
  const SMALL_OFFHAND = item({ n: '[Test] Plain Dirk', sl: ['SECONDARY'], st: { AC: 20 } });
  const BIG_OFFHAND = item({ n: '[Test] Great Shield', sl: ['SECONDARY'], st: { AC: 90, STA: 40 } });

  function worn(candidate: Item, offhand: Item) {
    addItem(candidate);
    addItem(offhand);
    return report(gearSet({ SECONDARY: { itemName: offhand.n, upgrade: tier(0) } }));
  }

  it('states the subtraction on the row instead of leaving it inferred', () => {
    const primary = rowFor(worn(GREATSWORD, SMALL_OFFHAND), 'PRIMARY');
    expect(primary?.twoHanded).toBeTruthy();
    expect(primary?.twoHanded?.offhandName).toBe(SMALL_OFFHAND.n);
    expect(primary?.twoHanded?.offhandEp).toBeGreaterThan(0);
    // The dependency is named, because the netting rests on a Tier 2 wiki field.
    expect(primary?.twoHanded?.via).toContain('2H Slashing');
  });

  it('subtracts that EP from the gain, so the trade is priced', () => {
    const primary = rowFor(worn(GREATSWORD, SMALL_OFFHAND), 'PRIMARY');
    if (!primary?.twoHanded) throw new Error('expected a two-handed row to price');
    expect(primary.gain).toBeCloseTo(
      primary.candidate.ep - primary.wornEp - primary.twoHanded.offhandEp, 10,
    );
    // And the netting actually moved the number, or this proves nothing.
    expect(primary.twoHanded.offhandEp).toBeGreaterThan(0);
    expect(primary.gain).toBeLessThan(primary.candidate.ep - primary.wornEp);
  });

  /**
   * The defect this whole change exists to fix. Ranked independently, a
   * two-hander gives up the offhand for free and wins on paper; netted, it
   * loses the trade and must not be recommended.
   *
   * **This assertion was changed on 2026-09-01, and it was passing when I
   * changed it.** It read `expect(rowFor(result, 'PRIMARY')).toBeUndefined()` —
   * the whole slot gone. That is one CONSEQUENCE of the rule in the sentence
   * above, not the rule: what must not happen is that the greatsword is
   * recommended. The slot vanishing was the symptom of a separate defect —
   * `take()` returned a single candidate, so a two-hander losing its netting
   * ended the position and the reader was told "already best" — and this
   * assertion had frozen that symptom in place as though it were the
   * requirement.
   *
   * Now it asserts the rule: the greatsword is not offered, and whatever IS
   * offered is a real gain. A test that pins a symptom will fail when the
   * symptom is fixed, and the temptation then is to revert the fix.
   */
  it('REFUSES a two-hander that loses the trade, which is the whole point', () => {
    const result = worn(GREATSWORD, BIG_OFFHAND);
    const primary = rowFor(result, 'PRIMARY');

    // The rule: this weapon, netted, is not the recommendation.
    expect(primary?.candidate.item.n).not.toBe(GREATSWORD.n);
    // Dropped as settled rather than withheld: it is a priced answer, not an
    // unmeasurable one.
    expect(result.withheld.map((w) => w.position.id)).not.toContain('PRIMARY');
    // And if something else IS offered, it is offered because it wins.
    if (primary) expect(primary.gain).toBeGreaterThanOrEqual(0.05);
  });

  it('leaves a one-handed winner alone — the netting is not a blanket penalty', () => {
    const primary = rowFor(worn(ONEHANDER, SMALL_OFFHAND), 'PRIMARY');
    expect(primary?.twoHanded).toBeNull();
    expect(primary?.gain).toBeCloseTo((primary?.candidate.ep ?? 0) - (primary?.wornEp ?? 0), 10);
  });

  it('costs nothing when the offhand is empty, which is measured and not assumed', () => {
    addItem(GREATSWORD);
    const primary = rowFor(report(gearSet()), 'PRIMARY');
    expect(primary?.twoHanded).toBeNull();
  });
});

/* ------------------------------------------------------------------------- *
 * A two-handed weapon takes BOTH hands, and the offhand is a slot like any
 * other until it isn't.
 *
 * The screen already handles one direction: a two-handed CANDIDATE has the
 * offhand it empties subtracted from its gain, and says so. The other
 * direction — a two-hander already WORN — was not handled at all, and it is
 * the one that produces a recommendation a player cannot act on.
 * ------------------------------------------------------------------------- */

const TWO_HANDER = item({
  n: '[Fixture] Greatsword of Both Hands',
  sl: ['PRIMARY'],
  st: { STR: 10, AC: 5 },
  wp: { skill: '2H Slashing', dmg: 20, dly: 40 },
});

const SHIELD = item({
  n: '[Fixture] Sturdy Buckler',
  sl: ['SECONDARY'],
  st: { AC: 12, STA: 5 },
});

describe('a worn two-hander occupies the offhand', () => {
  beforeEach(() => {
    addItem(TWO_HANDER);
    addItem(SHIELD);
  });

  it('is recognised as two-handed from the only marker the payload carries', () => {
    expect(isTwoHanded(TWO_HANDER)).toBe(true);
    expect(isTwoHanded(SHIELD)).toBe(false);
  });

  /**
   * The defect. With a two-hander worn in Primary, Secondary is not a slot this
   * character can fill — so ranking a shield into it is advice they cannot take.
   * It is the same class of error as offering a Wizard-only cowl to a Warrior,
   * and that case has been guarded since the first week.
   */
  it('does not offer an upgrade into an offhand the worn weapon occupies', () => {
    const set = gearSet({ PRIMARY: { itemName: TWO_HANDER.n, upgrade: tier(0) } });
    const result = report(set);

    expect(rowFor(result, 'SECONDARY')).toBeUndefined();
  });

  it('says WHY the offhand is not ranked, rather than dropping it silently', () => {
    const set = gearSet({ PRIMARY: { itemName: TWO_HANDER.n, upgrade: tier(0) } });
    const held = report(set).withheld.find((entry) => entry.position.id === 'SECONDARY');

    expect(held?.reason).toBe('offhand-occupied');
  });

  /** And with a one-hander worn, the offhand ranks normally. */
  it('still ranks the offhand when the worn Primary leaves a hand free', () => {
    const oneHander = item({
      n: '[Fixture] Short Blade',
      sl: ['PRIMARY'],
      st: { STR: 4 },
      wp: { skill: '1H Slashing', dmg: 9, dly: 22 },
    });
    addItem(oneHander);

    const set = gearSet({ PRIMARY: { itemName: oneHander.n, upgrade: tier(0) } });
    const result = report(set);

    expect(rowFor(result, 'SECONDARY')).toBeDefined();
    expect(result.withheld.find((e) => e.position.id === 'SECONDARY')).toBeUndefined();
  });
});

/* ------------------------------------------------------------------------- *
 * A ratio is printed for both sides or for neither.
 * ------------------------------------------------------------------------- */

describe('the RATIO chip never prints a side the engine refused to compute', () => {
  /**
   * `before` was ungated while `after` was gated on `weaponCounts`.
   *
   * `WEAPON_POSITIONS` is `{PRIMARY, SECONDARY}` — RANGE is excluded on purpose,
   * because this engine models no ranged attack and paying for ratio there would
   * invent a benefit the rest of the app cannot see. But the WORN side computed
   * its ratio anyway, and the `?? 0` fallback turned the refused side into the
   * number zero, so a worn bow rendered `RATIO 0.167 → 0.000` against a
   * candidate that need not carry a weapon block at all.
   *
   * That zero is not a measurement. It is the engine declining to answer,
   * printed as an answer — and printed as a LOSS, which is worse than printing
   * nothing.
   */
  it('shows no ratio at a position where weapons do not count', () => {
    const bow = item({
      n: '[Fixture] Ash Longbow', sl: ['RANGE'], st: { DEX: 5 },
      wp: { skill: 'Archery', dmg: 12, dly: 40 },
    });
    const quiver = item({ n: '[Fixture] Sturdy Quiver', sl: ['RANGE'], st: { DEX: 9, AC: 4 } });
    addItem(bow); addItem(quiver);

    const set = gearSet({ RANGE: { itemName: bow.n, upgrade: tier(0) } });
    const row = rowFor(report(set), 'RANGE');

    expect(row).toBeDefined();
    // The worn bow HAS a ratio; the position simply does not pay for one.
    expect(row?.ratio).toBeNull();
  });

  /** And where weapons DO count, both sides are still shown. */
  it('still shows both sides in a hand', () => {
    const blade = item({
      n: '[Fixture] Keen Blade', sl: ['PRIMARY'], st: { STR: 6 },
      wp: { skill: '1H Slashing', dmg: 14, dly: 24 },
    });
    addItem(blade);
    const set = gearSet({ PRIMARY: { itemName: blade.n, upgrade: tier(0) } });
    const row = rowFor(report(set), 'PRIMARY');
    if (row?.ratio) {
      expect(row.ratio.before).toBeGreaterThan(0);
      expect(row.ratio.after).toBeGreaterThan(0);
    }
  });
});

/* ------------------------------------------------------------------------- *
 * "Already best" is a claim about the whole pool, not about one candidate.
 * ------------------------------------------------------------------------- */

describe('a two-hander that loses its netting does not settle the slot', () => {
  const shield = item({ n: '[Fixture] Tower Shield', sl: ['SECONDARY'], st: { AC: 20 } });
  // Ranks FIRST on raw EP, and nets to nothing once the offhand it empties is paid for.
  // Measured under WEIGHTS: 35.00 EP. The shield it empties is 40.00, so the
  // netted gain is -5 — below MIN_GAIN — while 35.00 still outranks the
  // shortsword's 26.67 and is therefore taken first.
  const greatsword = item({
    n: '[Fixture] Ponderous Greatsword', sl: ['PRIMARY'], st: { AC: 15 },
    wp: { skill: '2H Slashing', dmg: 10, dly: 40 },
  });
  // Ranks second, and is a real gain: a one-hander pays no offhand cost.
  const shortsword = item({
    n: '[Fixture] Plain Shortsword', sl: ['PRIMARY'], st: { AC: 10 },
    wp: { skill: '1H Slashing', dmg: 10, dly: 30 },
  });

  beforeEach(() => {
    addItem(shield); addItem(greatsword); addItem(shortsword);
  });

  /**
   * The pool is ranked on raw EP, so the greatsword is taken first; its netting
   * then drives the gain below `MIN_GAIN`. The slot was counted as **settled** —
   * which the screen renders verbatim as "N already best" — and the shortsword,
   * a genuine positive gain one place down the list, was never looked at.
   *
   * Two separate wrongs from one `continue`: a real upgrade is missed, and the
   * reader is told the opposite of what happened. "Already best" asserts that
   * nothing in the pool beats what you hold. What actually happened is that the
   * single candidate we tried lost its trade.
   */
  it('falls through to the next candidate instead of declaring the slot settled', () => {
    const set = gearSet({ SECONDARY: { itemName: shield.n, upgrade: tier(0) } });
    const result = report(set);
    const primary = rowFor(result, 'PRIMARY');

    expect(primary).toBeDefined();
    expect(primary?.candidate.item.n).toBe(shortsword.n);
    expect(primary?.gain).toBeGreaterThan(0);
    // And it is a one-hander, so nothing is netted off it.
    expect(primary?.twoHanded).toBeNull();
  });
});

/* ------------------------------------------------------------------------- *
 * An offhand we cannot price is not an offhand that costs nothing.
 * ------------------------------------------------------------------------- */

describe('a two-hander is not netted against an unpriceable offhand', () => {
  const TWO_H = item({
    n: '[Fixture] Great Cleaver', sl: ['PRIMARY'], st: { AC: 40, STR: 20 },
    wp: { skill: '2H Slashing', dmg: 40, dly: 25 },
  });

  /**
   * `twoHandedCost` bailed to `null` whenever `view.item` was undefined, which
   * covers TWO different states: the slot is genuinely empty, and the worn item
   * is not in this catalogue. Empty costs nothing and that zero is measured.
   * **Unresolved means something IS in that hand and nobody knows what it is
   * worth** — and `gain` then subtracted `?? 0`, asserting a cost of zero and
   * printing no note at all.
   *
   * That is the fabrication `worn-unresolved` exists to prevent, one slot over.
   */
  it('does not price a two-hander against a worn offhand it cannot resolve', () => {
    addItem(TWO_H);
    const set = gearSet({
      SECONDARY: { itemName: 'Item That Does Not Exist', upgrade: tier(0) },
    });
    const result = report(set);
    const primary = rowFor(result, 'PRIMARY');

    // Either the two-hander is not the recommendation, or if it is, the row
    // must not claim the offhand was free.
    if (primary && isTwoHanded(primary.candidate.item)) {
      throw new Error('a two-hander was priced against an unresolvable offhand');
    }
  });

  /** An EMPTY offhand still costs nothing, and that zero is measured. */
  it('still costs nothing against a genuinely empty offhand', () => {
    addItem(TWO_H);
    const primary = rowFor(report(gearSet()), 'PRIMARY');
    expect(primary?.twoHanded).toBeNull();
  });
});

describe('an offhand that scores nothing still gets its note', () => {
  /**
   * `twoHandedCost` used to `return null` when the worn offhand scored 0 EP.
   * The subtraction is a no-op either way — but returning null also drops the
   * row's TWO-HANDED note, so the reader is never told their offhand empties.
   *
   * The arithmetic was never wrong here; the disclosure was missing, and this
   * screen's whole argument is that the reader is told what the trade is.
   * Caught by an A/B: reverting the fix left all 1,044 tests green.
   */
  it('reports a measured zero rather than staying silent', () => {
    // WIS is unweighted by WEIGHTS, so this offhand scores exactly 0.
    const trinket = item({ n: '[Fixture] Dull Charm', sl: ['SECONDARY'], st: { WIS: 10 } });
    const cleaver = item({
      n: '[Fixture] Heavy Cleaver', sl: ['PRIMARY'], st: { AC: 40, STR: 20 },
      wp: { skill: '2H Slashing', dmg: 40, dly: 25 },
    });
    addItem(trinket); addItem(cleaver);

    const set = gearSet({ SECONDARY: { itemName: trinket.n, upgrade: tier(0) } });
    const primary = rowFor(report(set), 'PRIMARY');

    expect(primary?.candidate.item.n).toBe(cleaver.n);
    // The note exists, and it states a cost of zero rather than being absent.
    expect(primary?.twoHanded).not.toBeNull();
    expect(primary?.twoHanded?.offhandEp).toBe(0);
    expect(primary?.twoHanded?.offhandName).toBe(trinket.n);
  });
});

/* ------------------------------------------------------------------------- *
 * The KPI line is an accounting, and an accounting has to balance.
 * ------------------------------------------------------------------------- */

describe('every position lands in exactly one bucket', () => {
  /**
   * The screen prints `rows.length` of `views.length`, then
   * "N already best · N not comparable · N with nothing to offer" — four numbers
   * that together claim to account for all 23 paper-doll positions. Nothing
   * asserted that they add up.
   *
   * It matters because each bucket is a different sentence to the reader, and a
   * position that falls out of all four disappears with no explanation while the
   * headline still reads "22 / 23". This is the shape of the two defects already
   * fixed in this file: `settled` was absorbing positions that had never been
   * fully searched, and an occupied offhand was landing in no bucket at all.
   *
   * Checked over four gear-set shapes rather than one, because three of the four
   * buckets are empty in the default case and a single-shape test would be
   * asserting almost nothing.
   */
  it('balances across empty, worn, unresolved and blind-profile sets', () => {
    const anyHead = catalog().items.find((i) => i.sl?.includes('HEAD'));
    expect(anyHead).toBeDefined();

    const cases: [string, GearSet][] = [
      ['an empty set', gearSet()],
      ['one worn item', gearSet({ HEAD: { itemName: anyHead?.n ?? '', upgrade: tier(0) } })],
      ['an unresolvable worn item', gearSet({ FEET: { itemName: 'No Such Item', upgrade: tier(0) } })],
      // Caster weights on a melee trio: the hand slots go to
      // `profile-blind-to-weapons`, which is the only way to populate `withheld`
      // without an unresolvable item.
      ['a profile blind to weapons', gearSet({}, { INT: 5, MANA: 2 })],
    ];

    for (const [label, set] of cases) {
      const result = report(set);
      const views = slotViews(set, catalog());
      const sum = result.rows.length + result.settled
        + result.withheld.length + result.nothing.length;
      expect(sum, `${label}: buckets do not account for every position`).toBe(views.length);

      /*
       * And no position is counted twice across the three enumerable buckets.
       *
       * Compared by LABEL, not by id: `report.nothing` is published as labels
       * (`nothing.map((position) => position.label)`), while `rows` and
       * `withheld` carry the position objects. Reaching for `.id` on all three
       * type-checks nowhere and vitest never noticed — `tsc` did.
       */
      const labels = [
        ...result.rows.map((r) => r.position.label),
        ...result.withheld.map((w) => w.position.label),
        ...result.nothing,
      ];
      expect(new Set(labels).size, `${label}: a position appears in two buckets`)
        .toBe(labels.length);
    }
  });
});

describe('every withheld reason has its own badge', () => {
  /**
   * The badge was a three-branch ternary over a five-member union, so three
   * reasons rendered "Not in catalog" — a claim about missing data — including
   * the two added on 2026-09-01 for an occupied and an unpriceable offhand.
   *
   * `WITHHELD_TEXT` beside it is a `Record<WithheldReason, string>` and was
   * never wrong, because the compiler will not let it be. This asserts the same
   * property for the badge, and that the false label is gone from the reasons it
   * was false about.
   */
  it('says something true, and something different, for each reason', () => {
    const reasons: WithheldReason[] = [
      'worn-unstatted', 'worn-unresolved', 'profile-blind-to-weapons',
      'offhand-occupied', 'offhand-unpriceable',
    ];
    for (const reason of reasons) {
      expect(WITHHELD_MARK[reason], `no badge for ${reason}`).toBeTruthy();
      expect(WITHHELD_TEXT[reason], `no body text for ${reason}`).toBeTruthy();
    }
    // "Not in catalog" belongs to exactly one reason — the one where it is true.
    const notInCatalog = reasons.filter((r) => WITHHELD_MARK[r] === 'Not in catalog');
    expect(notInCatalog).toEqual(['worn-unresolved']);
    // And no two reasons share a badge, or the badge is not telling them apart.
    expect(new Set(reasons.map((r) => WITHHELD_MARK[r])).size).toBe(reasons.length);
  });

  /**
   * The table being complete is not the same as the screen USING it.
   *
   * Measured: restoring the old inline ternary left all 1,053 tests green,
   * because everything above asserts on the Record and the ternary bypasses it.
   * `tsc` catches a missing KEY (TS2741) but has nothing to say about a branch
   * that never reads the table.
   *
   * So this asserts the wiring at the only level that distinguishes them: the
   * phrase belongs to `WITHHELD_MARK` and must appear in this file exactly
   * once. A second occurrence is an inline branch deciding the badge again.
   */
  it('renders the badge FROM the table, not from a second inline branch', () => {
    const source = readFileSync('src/screens/Upgrades.tsx', 'utf8');
    const occurrences = source.split("'Not in catalog'").length - 1;
    expect(occurrences, 'the phrase should live only in WITHHELD_MARK').toBe(1);
    // And the render site reads the table by key.
    expect(source).toContain('WITHHELD_MARK[entry.reason]');
  });
});
