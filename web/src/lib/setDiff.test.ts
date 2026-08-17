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

  it('covers all twenty-three positions, empty or not', () => {
    const diff = diffSets(set(), set(), catalogOf([]));
    expect(diff.slots).toHaveLength(23);
    expect(diff.counts['both-empty']).toBe(23);
    expect(diff.capSummary.raw).toBe(0);
    expect(Number.isFinite(diff.epDelta)).toBe(true);
  });
});
