/**
 * Set-vs-set diff.
 *
 * The cap-awareness column is the part worth testing hardest: it is the one
 * number in the diff that is not a subtraction, and it is the reason the view
 * exists rather than being two stat panels side by side.
 */

import { describe, expect, it } from 'vitest';
import type { CatalogState } from '../data/catalog';
import { ATTRIBUTE_CAP, RESIST_CAP } from '../engine/constants';
import { BASE_STATE, tier } from '../engine/upgrade';
import type { GearSet, Item } from '../engine/types';
import { rankSlotItems, scoreContextFrom, slotViews, totalsFor } from '../selectors/gear';
import { creditableDelta, diffSets, type CapRow } from './setDiff';

function item(name: string, patch: Partial<Item> = {}): Item {
  return {
    id: null, n: name, sl: ['HEAD'], cl: ['ALL'], ra: ['ALL'],
    st: {}, sv: {}, fl: [], av: true, era: 'Classic', ...patch,
  };
}

/** `diffSets` reads only `byName` off the catalog, so that is all a test needs. */
function catalogOf(items: Item[]): CatalogState {
  return {
    byName: new Map(items.map((i) => [i.n.toLowerCase(), i])),
  } as unknown as CatalogState;
}

/**
 * A catalog complete enough for `rankSlotItems` too, so a test can put the
 * diff's EP column and the picker's ranking side by side and require them to
 * agree. `revision` is unique per call because the ranking is memoised on it.
 */
let revisionCounter = 90_000;
function rankableCatalog(items: Item[]): CatalogState {
  revisionCounter += 1;
  const bySlot = new Map<string, Item[]>();
  for (const item of items) {
    for (const slot of item.sl) {
      const bucket = bySlot.get(slot) ?? [];
      bucket.push(item);
      bySlot.set(slot, bucket);
    }
  }
  return {
    status: 'ready',
    items,
    byName: new Map(items.map((i) => [i.n.toLowerCase(), i])),
    bySlot,
    revision: revisionCounter,
  } as unknown as CatalogState;
}

let counter = 0;
function set(patch: Partial<GearSet> = {}): GearSet {
  counter += 1;
  return {
    id: `set_${counter}`,
    characterId: 'char_1',
    name: `Set ${counter}`,
    slots: {},
    weights: { STR: 1, AC: 1, SV_MAGIC: 1 },
    createdAt: 0,
    updatedAt: 0,
    ...patch,
  };
}

const equipped = (itemName: string, full = 0) => ({
  itemName,
  upgrade: full ? tier(full) : BASE_STATE,
});

function capRow(groups: ReturnType<typeof diffSets>['groups'], title: string, key: string): CapRow {
  const group = groups.find((g) => g.title === title);
  if (!group || group.kind !== 'capped') throw new Error(`no capped group ${title}`);
  const row = group.rows.find((r) => r.key === key);
  if (!row) throw new Error(`no row ${key}`);
  return row;
}

describe('creditableDelta', () => {
  it('credits the whole move when both ends sit under the ceiling', () => {
    expect(creditableDelta(100, 140, ATTRIBUTE_CAP)).toBe(40);
  });

  it('credits only the part below the ceiling', () => {
    expect(creditableDelta(500, 540, ATTRIBUTE_CAP)).toBe(10);
  });

  it('credits nothing at all once the ceiling is already reached', () => {
    expect(creditableDelta(600, 700, ATTRIBUTE_CAP)).toBe(0);
  });

  // The symmetric case: a loss taken entirely above the ceiling costs nothing,
  // which is what stops the diff from reporting a penalty nobody can feel.
  it('charges nothing for a loss taken above the ceiling', () => {
    expect(creditableDelta(600, 560, ATTRIBUTE_CAP)).toBe(0);
  });

  it('charges the part of a loss that crosses back under the ceiling', () => {
    expect(creditableDelta(530, 480, ATTRIBUTE_CAP)).toBe(-30);
  });
});

describe('diffSets', () => {
  const helm = item('Helm', { st: { AC: 8, STA: 4 }, sv: { SV_MAGIC: 3 } });
  const crown = item('Crown', { st: { AC: 20, STA: 4 } });

  it('reports a set against itself as identical, with nothing changed', () => {
    const a = set({ slots: { HEAD: equipped('Helm') } });
    const diff = diffSets(a, a, catalogOf([helm]));

    expect(diff.identical).toBe(true);
    expect(diff.epDelta).toBe(0);
    expect(diff.counts.same).toBe(1);
    expect(diff.counts['both-empty']).toBe(22);
    expect(diff.slots.every((slot) => !slot.changed)).toBe(true);
    expect(diff.groups.every((group) => group.rows.every((row) => row.delta === 0))).toBe(true);
  });

  it('reports every slot of an empty set as a removal, and the reverse as additions', () => {
    const filled = set({ slots: { HEAD: equipped('Helm'), PRIMARY: equipped('Crown') } });
    const empty = set({ slots: {} });
    const catalog = catalogOf([helm, crown]);

    const losing = diffSets(filled, empty, catalog);
    expect(losing.counts.removed).toBe(2);
    expect(losing.counts.added).toBe(0);
    expect(losing.filledA).toBe(2);
    expect(losing.filledB).toBe(0);
    expect(losing.identical).toBe(false);
    expect(losing.epDelta).toBeLessThan(0);

    const gaining = diffSets(empty, filled, catalog);
    expect(gaining.counts.added).toBe(2);
    expect(gaining.epDelta).toBeGreaterThan(0);
    // Removal rows still describe the stats that leave, signed the other way.
    const head = losing.slots.find((slot) => slot.position.id === 'HEAD');
    expect(head?.stats.find((s) => s.key === 'AC')?.delta).toBe(-8);
  });

  it('separates a swapped item from a retuned one', () => {
    const catalog = catalogOf([helm, crown]);
    const a = set({ slots: { HEAD: equipped('Helm') } });
    const swapped = diffSets(a, set({ slots: { HEAD: equipped('Crown') } }), catalog);
    const retuned = diffSets(a, set({ slots: { HEAD: equipped('Helm', 4) } }), catalog);

    expect(swapped.slots.find((s) => s.position.id === 'HEAD')?.status).toBe('swapped');
    expect(retuned.slots.find((s) => s.position.id === 'HEAD')?.status).toBe('retuned');
    expect(retuned.counts.swapped).toBe(0);
    // Same item, higher tier: the AC still moves, so the row is not "same".
    expect(retuned.slots.find((s) => s.position.id === 'HEAD')?.epDelta).toBeGreaterThan(0);
  });

  it('treats a changed exaltation donor as a retune, not as unchanged', () => {
    const catalog = catalogOf([helm]);
    const a = set({ slots: { HEAD: equipped('Helm') } });
    const b = set({
      slots: { HEAD: { ...equipped('Helm'), exaltations: { ornamentation: 'Some Donor' } } },
    });
    const diff = diffSets(a, b, catalog);
    expect(diff.slots.find((s) => s.position.id === 'HEAD')?.status).toBe('retuned');
    expect(diff.slots.find((s) => s.position.id === 'HEAD')?.b?.donors).toEqual([
      { kind: 'ornamentation', donor: 'Some Donor' },
    ]);
  });

  it('splits an attribute gain into the part that counts and the part above 510', () => {
    const low = item('Girdle of 500', { sl: ['WAIST'], st: { STR: 500 } });
    const high = item('Girdle of 540', { sl: ['WAIST'], st: { STR: 540 } });
    const diff = diffSets(
      set({ slots: { WAIST: equipped('Girdle of 500') } }),
      set({ slots: { WAIST: equipped('Girdle of 540') } }),
      catalogOf([low, high]),
    );

    const str = capRow(diff.groups, 'Stats', 'STR');
    expect(str.a).toBe(500);
    expect(str.b).toBe(540);
    expect(str.delta).toBe(40);
    expect(str.creditable).toBe(10);
    expect(str.uncredited).toBe(30);
    expect(str.atCapA).toBe(false);
    expect(str.atCapB).toBe(true);
    expect(str.cap).toBe(ATTRIBUTE_CAP);

    expect(diff.capSummary.raw).toBe(40);
    expect(diff.capSummary.credited).toBe(10);
    expect(diff.capSummary.wasted).toBe(30);
    expect(diff.capSummary.atCap).toContain('Strength');
  });

  it('charges nothing for a loss that stays above the ceiling', () => {
    const over = item('Girdle of 560', { sl: ['WAIST'], st: { STR: 560 } });
    const under = item('Girdle of 520', { sl: ['WAIST'], st: { STR: 520 } });
    const diff = diffSets(
      set({ slots: { WAIST: equipped('Girdle of 560') } }),
      set({ slots: { WAIST: equipped('Girdle of 520') } }),
      catalogOf([over, under]),
    );

    const str = capRow(diff.groups, 'Stats', 'STR');
    expect(str.delta).toBe(-40);
    expect(str.creditable).toBe(0);
    expect(diff.capSummary.absorbed).toBe(40);
    expect(diff.capSummary.wasted).toBe(0);
  });

  it('applies the same rule to resists at their own ceiling', () => {
    const a = item('Cloak 990', { sl: ['BACK'], sv: { SV_MAGIC: 990 } });
    const b = item('Cloak 1090', { sl: ['BACK'], sv: { SV_MAGIC: 1090 } });
    const diff = diffSets(
      set({ slots: { BACK: equipped('Cloak 990') } }),
      set({ slots: { BACK: equipped('Cloak 1090') } }),
      catalogOf([a, b]),
    );

    const magic = capRow(diff.groups, 'Resists', 'SV_MAGIC');
    expect(magic.cap).toBe(RESIST_CAP);
    expect(magic.delta).toBe(100);
    expect(magic.creditable).toBe(10);
    expect(magic.uncredited).toBe(90);
  });

  it('says plainly when the two sets belong to different characters', () => {
    const a = set({ characterId: 'char_1' });
    const b = set({ characterId: 'char_2' });
    expect(diffSets(a, b, catalogOf([])).sameCharacter).toBe(false);
    expect(diffSets(a, set({ characterId: 'char_1' }), catalogOf([])).sameCharacter).toBe(true);
  });

  it('scores both sides under one lens when the weight profiles differ', () => {
    const catalog = catalogOf([helm, crown]);
    const a = set({ slots: { HEAD: equipped('Helm') }, weights: { AC: 1 } });
    const b = set({ slots: { HEAD: equipped('Crown') }, weights: { AC: 10 } });
    const diff = diffSets(a, b, catalog);

    expect(diff.weightsDiffer).toBe(true);
    // Under A's lens (AC 1) the Crown is worth 20; under its own it is worth 200.
    expect(diff.epBUnderLens).toBe(20);
    expect(diff.epB).toBe(200);
    expect(diff.epDelta).toBe(12); // 20 under the lens, against the Helm's 8
  });

  it('keeps an item the catalog does not know rather than dropping the row', () => {
    const diff = diffSets(
      set({ slots: { HEAD: equipped('Ghost Item') } }),
      set({ slots: {} }),
      catalogOf([]),
    );
    const head = diff.slots.find((s) => s.position.id === 'HEAD');
    expect(head?.a?.unresolved).toBe(true);
    expect(head?.a?.itemName).toBe('Ghost Item');
    expect(head?.a?.ep).toBe(0);
    expect(head?.status).toBe('removed');
  });

  /*
   * The compare screen prints "EP scored under … weights, cap-aware" over this
   * column. It said so while scoring every item in isolation, which is how the
   * same item, tier and profile came to read 130.0 EP on the diff and 80.0 EP
   * in the picker one screen away.
   */
  describe('per-slot EP is cap-aware, like every other surface', () => {
    const girdle = item('Girdle of 500', { sl: ['WAIST'], st: { STR: 500 } });
    const helm = item('Helm of 50', { sl: ['HEAD'], st: { STR: 50 } });
    const weights = { STR: 1 };

    it('charges the rest of the set against the ceiling before crediting a slot', () => {
      const loaded = set({ slots: { WAIST: equipped('Girdle of 500'), HEAD: equipped('Helm of 50') }, weights });
      const diff = diffSets(loaded, loaded, rankableCatalog([girdle, helm]));
      const head = diff.slots.find((s) => s.position.id === 'HEAD');

      // 500 of the 510 ceiling is already spent by the girdle, so only ten of
      // the helm's fifty points are worth anything. Scored in isolation it read
      // the full fifty.
      expect(head?.a?.ep).toBe(10);
    });

    it('agrees to the point with what the picker would score in that slot', () => {
      const catalog = rankableCatalog([girdle, helm]);
      const loaded = set({ slots: { WAIST: equipped('Girdle of 500'), HEAD: equipped('Helm of 50') }, weights });
      const diff = diffSets(loaded, loaded, catalog);
      const views = slotViews(loaded, catalog);

      const ranked = rankSlotItems(catalog, {
        slot: 'HEAD',
        context: undefined,
        weights,
        upgrade: BASE_STATE,
        existing: scoreContextFrom(totalsFor(views, 'HEAD')),
        includeUnreleased: true,
      });
      const inPicker = ranked.find((entry) => entry.item.n === 'Helm of 50')?.score;

      expect(inPicker).toBe(10);
      expect(diff.slots.find((s) => s.position.id === 'HEAD')?.a?.ep).toBe(inPicker);
    });

    it('refuses weapon value in an Any Slot, exactly as the ranking does', () => {
      // An Any Slot is a worn position, not a hand: `computeTotals` reports no
      // weapon from it, so the diff must not print EP the stat panel disowns.
      const blade = item('Sharp Thing', {
        sl: ['PRIMARY'], st: {}, wp: { dmg: 20, dly: 20, skill: '1H Slashing' },
      });
      const catalog = rankableCatalog([blade]);
      const ratio = { RATIO: 100 };
      const inHand = set({ slots: { PRIMARY: equipped('Sharp Thing') }, weights: ratio });
      const worn = set({ slots: { ANY_1: equipped('Sharp Thing') }, weights: ratio });

      const hand = diffSets(inHand, inHand, catalog).slots.find((s) => s.position.id === 'PRIMARY');
      const any = diffSets(worn, worn, catalog).slots.find((s) => s.position.id === 'ANY_1');
      expect(hand?.a?.ep).toBe(100);
      expect(any?.a?.ep).toBe(0);
    });
  });

  /*
   * The KPI headline is `epBUnderLens - epALens`, so its subtitle has to be the
   * two ends of that same subtraction. Printing A under its own weights instead
   * rendered "−1860" in red above an ascending "0.0 → 1,427.5" for any set
   * whose weights had been cleared — which the Weights tab does on a 0.
   */
  describe('the lens when set A carries no weights at all', () => {
    const helm = item('Helm', { st: { AC: 8 } });
    const crown = item('Crown', { st: { AC: 20 } });
    const catalog = catalogOf([helm, crown]);

    it('names B as the lens owner rather than silently borrowing its profile', () => {
      const a = set({ slots: { HEAD: equipped('Helm') }, weights: {} });
      const b = set({ slots: { HEAD: equipped('Crown') }, weights: { AC: 2 } });
      const diff = diffSets(a, b, catalog);

      expect(diff.lensOwner).toBe('b');
      expect(diff.lens).toBe(b.weights);
    });

    it('reports both ends of the headline on the lens scale', () => {
      const a = set({ slots: { HEAD: equipped('Helm') }, weights: {} });
      const b = set({ slots: { HEAD: equipped('Crown') }, weights: { AC: 2 } });
      const diff = diffSets(a, b, catalog);

      // A is worth nothing under its own empty profile, and 16 under the lens.
      expect(diff.epA).toBe(0);
      expect(diff.epALens).toBe(16);
      expect(diff.epBUnderLens).toBe(40);
      expect(diff.epDelta).toBe(24);
      // The headline and the from→to pair must never disagree about direction.
      expect(Math.sign(diff.epDelta)).toBe(Math.sign(diff.epBUnderLens - diff.epALens));
      expect(diff.epDelta).toBe(diff.epBUnderLens - diff.epALens);
    });

    it('still reads as a loss when the cleared-weight set was the better one', () => {
      const a = set({ slots: { HEAD: equipped('Crown') }, weights: {} });
      const b = set({ slots: { HEAD: equipped('Helm') }, weights: { AC: 2 } });
      const diff = diffSets(a, b, catalog);

      expect(diff.epALens).toBe(40);
      expect(diff.epBUnderLens).toBe(16);
      expect(diff.epDelta).toBe(-24);
      expect(diff.epALens).toBeGreaterThan(diff.epBUnderLens);
    });

    it('keeps A as the lens owner whenever A weighs anything', () => {
      const a = set({ slots: { HEAD: equipped('Helm') }, weights: { AC: 1 } });
      const b = set({ slots: { HEAD: equipped('Crown') }, weights: { AC: 10 } });
      const diff = diffSets(a, b, catalog);
      expect(diff.lensOwner).toBe('a');
      expect(diff.epALens).toBe(diff.epA);
    });

    it('falls through to B even when B is empty too, without NaN', () => {
      const a = set({ slots: { HEAD: equipped('Helm') }, weights: {} });
      const b = set({ slots: { HEAD: equipped('Crown') }, weights: {} });
      const diff = diffSets(a, b, catalog);
      expect(diff.lensOwner).toBe('b');
      expect(diff.epALens).toBe(0);
      expect(diff.epBUnderLens).toBe(0);
      expect(diff.epDelta).toBe(0);
      expect(diff.weightsDiffer).toBe(false);
    });
  });

  it('covers all twenty-three positions, empty or not', () => {
    const diff = diffSets(set(), set(), catalogOf([]));
    expect(diff.slots).toHaveLength(23);
    expect(diff.counts['both-empty']).toBe(23);
    expect(diff.capSummary.raw).toBe(0);
    expect(Number.isFinite(diff.epDelta)).toBe(true);
  });
});

/**
 * The headline tile and the column beneath it are one number.
 *
 * The KPI used to be scored a different way from the per-slot column it
 * summarises: it credited weapon damage and ratio from *any* position, while
 * the column — like the picker, and like the stat panel — credits a weapon only
 * from a hand. A set with a weapon parked in an Any Slot therefore printed a
 * total 10.6 EP adrift of the rows that were supposed to add up to it, with
 * nothing on screen to explain the gap.
 */
describe('the compare headline agrees with the column it summarises', () => {
  const blade = item('Borrowed Blade', {
    sl: ['PRIMARY'],
    st: { STR: 10 },
    wp: { dmg: 40, dly: 20, skill: '1H Slashing' },
  });
  const helm = item('Plain Helm', { st: { STR: 5, AC: 10 } });
  const weights = { STR: 1, AC: 1, RATIO: 40, DMG: 2 };
  const catalog = catalogOf([blade, helm]);

  const columnTotal = (diff: ReturnType<typeof diffSets>, side: 'a' | 'b') =>
    diff.slots.reduce((sum, slot) => sum + (slot[side]?.ep ?? 0), 0);

  it('credits a weapon in a hand and not in an Any Slot', () => {
    const held = set({ weights, slots: { PRIMARY: equipped('Borrowed Blade') } });
    const worn = set({ weights, slots: { ANY_1: equipped('Borrowed Blade') } });

    const heldEp = diffSets(held, held, catalog).epALens;
    const wornEp = diffSets(worn, worn, catalog).epALens;

    // `computeTotals` reports no weapon from an Any Slot, so the score must not
    // claim value the stat panel then refuses to show: STR 10 and nothing else.
    expect(wornEp).toBe(10);
    expect(heldEp).toBeGreaterThan(wornEp);
  });

  it('sums to its own per-slot column with a weapon in an Any Slot', () => {
    const a = set({
      weights,
      slots: { HEAD: equipped('Plain Helm'), ANY_1: equipped('Borrowed Blade') },
    });
    const b = set({
      weights,
      slots: { HEAD: equipped('Plain Helm'), PRIMARY: equipped('Borrowed Blade', 4) },
    });
    const diff = diffSets(a, b, catalog);

    // No ceiling binds at these magnitudes, so the marginal contributions the
    // column prints and the whole-set total must be the same number exactly.
    expect(diff.epALens).toBeCloseTo(columnTotal(diff, 'a'), 10);
    expect(diff.epBUnderLens).toBeCloseTo(columnTotal(diff, 'b'), 10);
    expect(diff.epDelta).toBeCloseTo(columnTotal(diff, 'b') - columnTotal(diff, 'a'), 10);
  });

  it('sums to its column across every slot of a full set', () => {
    const slots: GearSet['slots'] = {};
    for (const position of ['HEAD', 'CHEST', 'ARMS', 'LEGS', 'FEET', 'HANDS', 'WRIST_1']) {
      slots[position] = equipped('Plain Helm', 3);
    }
    slots.PRIMARY = equipped('Borrowed Blade', 7);
    slots.ANY_1 = equipped('Borrowed Blade', 2);
    slots.ANY_2 = equipped('Plain Helm');

    const full = set({ weights, slots });
    const diff = diffSets(full, set({ weights }), catalog);
    expect(diff.epALens).toBeCloseTo(columnTotal(diff, 'a'), 10);
    expect(diff.epALens).toBeGreaterThan(0);
  });

  it('spends cap headroom once across the set rather than per item', () => {
    // Two items that individually fit under the ceiling but together exceed it.
    // Scoring each against an empty context would bill for the same headroom
    // twice; the total must be the value of the *capped* total, min(600, 510).
    const hoard = item('Hoarded Strength', { sl: ['HEAD'], st: { STR: 300 } });
    const capCatalog = catalogOf([hoard]);
    const a = set({
      weights: { STR: 1 },
      slots: { HEAD: equipped('Hoarded Strength'), CHEST: equipped('Hoarded Strength') },
    });
    const diff = diffSets(a, set({ weights: { STR: 1 } }), capCatalog);
    expect(diff.epALens).toBe(ATTRIBUTE_CAP);
  });
});
