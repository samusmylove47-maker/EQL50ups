/**
 * Set-vs-set diff.
 *
 * DESIGN.md §4 P1 #11 calls an explicit A/B view the chance to leapfrog the
 * tool this planner is modelled on, whose own answer is "open two tabs". This
 * is the selector half: no new maths, only a rearrangement of numbers the
 * engine already produces — `computeTotals` for the stat vectors, `scoreItem`
 * for EP, `statDeltas` for the per-slot stat lines.
 *
 * The one idea that is this product's own is carried through: attributes and
 * resists have ceilings (510 / 1000), so a raw gain is not the same thing as a
 * gain you can feel. Every capped row therefore reports **three** numbers —
 * what moved, how much of it counts, and how much falls off the top of the
 * ceiling. `creditable` is measured exactly the way `ep.ts` measures it, as the
 * movement of the *capped* total, so the diff and the scoring agree.
 */

import {
  ATTRIBUTES, ATTRIBUTE_CAP, ATTRIBUTE_NAMES,
  RESIST_CAP, SAVES, SAVE_NAMES, type SlotPosition,
} from '../engine/constants';
import { scoreItem, type WeightProfile } from '../engine/ep';
import { computeTotals, type StatTotals } from '../engine/stats';
import type { GearSet, Item } from '../engine/types';
import { BASE_STATE, normalizeState, type UpgradeState } from '../engine/upgrade';
import type { CatalogState } from '../data/catalog';
import {
  scoreContextFrom, slotViews, statDeltas, totalsFor,
  type ScoreExisting, type SlotView, type StatDelta,
} from '../selectors/gear';
import { finite } from './format';

/* ------------------------------------------------------------- slot level */

export type SlotDiffStatus =
  /** Neither set has anything here. */
  | 'both-empty'
  /** Same item, same tier, same donors. */
  | 'same'
  /** Same item, different +N or different exaltation donors. */
  | 'retuned'
  /** Different item in both. */
  | 'swapped'
  /** Empty on the left, filled on the right. */
  | 'added'
  /** Filled on the left, empty on the right. */
  | 'removed';

export interface DiffSide {
  itemName: string;
  item: Item | undefined;
  upgrade: UpgradeState;
  /** Equipped by name but absent from the catalog. */
  unresolved: boolean;
  /** EP under the comparison lens, so the two sides are on one scale. */
  ep: number;
  donors: Array<{ kind: string; donor: string }>;
}

export interface SlotDiff {
  position: SlotPosition;
  a: DiffSide | null;
  b: DiffSide | null;
  status: SlotDiffStatus;
  /** `b.ep - a.ep`, both scored under the lens weights. */
  epDelta: number;
  /** Per-stat movement from A's item to B's item. */
  stats: StatDelta[];
  changed: boolean;
}

/* ------------------------------------------------------------- stat level */

export interface PlainRow {
  key: string;
  label: string;
  a: number;
  b: number;
  delta: number;
  /** Decimal places for display; whole numbers by default. */
  places?: number;
  suffix?: string;
  /**
   * A row where "up" is not "better" — weapon delay — so the view must not
   * paint it green for rising.
   */
  neutral?: boolean;
}

export interface CapRow extends PlainRow {
  cap: number;
  /** Movement of the capped total: what the character actually feels. */
  creditable: number;
  /** `delta - creditable`: gain lost above the ceiling, or loss absorbed by it. */
  uncredited: number;
  atCapA: boolean;
  atCapB: boolean;
}

export type DiffGroup =
  | { title: string; kind: 'plain'; rows: PlainRow[] }
  | { title: string; kind: 'capped'; cap: number; rows: CapRow[] };

export interface CapSummary {
  /** Signed sum of raw movement across every capped row. */
  raw: number;
  /** Signed sum of the part that moves the capped total. */
  credited: number;
  /** Gains that land above a ceiling and buy nothing. */
  wasted: number;
  /** Losses taken entirely above a ceiling, which cost nothing. */
  absorbed: number;
  /** Rows sitting at their ceiling in B. */
  atCap: string[];
}

export interface SetDiff {
  slots: SlotDiff[];
  groups: DiffGroup[];
  totalsA: StatTotals;
  totalsB: StatTotals;
  capSummary: CapSummary;
  /** EP of each set under its own weights, and of both under the lens. */
  epA: number;
  epB: number;
  epALens: number;
  epBUnderLens: number;
  /** `epBUnderLens - epALens`: both ends on the lens scale, never mixed. */
  epDelta: number;
  lens: WeightProfile;
  /**
   * Whose weight profile the lens is.
   *
   * A carries it whenever A has any weight at all; an all-zero A falls through
   * to B's profile, and a view that hard-codes "scored under A's weights" then
   * names the wrong set. Derived here so no caller has to re-derive it.
   */
  lensOwner: 'a' | 'b';
  weightsDiffer: boolean;
  counts: Record<SlotDiffStatus, number>;
  filledA: number;
  filledB: number;
  /** No slot differs and no stat moved. */
  identical: boolean;
  sameCharacter: boolean;
}

/** How much of `delta` a cap actually lets through, per `ep.ts`. */
export function creditableDelta(a: number, b: number, cap: number): number {
  return Math.min(b, cap) - Math.min(a, cap);
}

/**
 * One side of one slot row.
 *
 * `existing` is what the *rest of that side's set* already contributes, so the
 * EP printed here is scored exactly the way `rankSlotItems` scores the same
 * item in the same position: cap-aware, and with weapon value credited only
 * where a weapon is actually swung. Scoring the item in isolation instead made
 * this column the one surface in the app that disagreed with the app's own
 * numbers — the same item, tier and profile read 130.0 EP here and 80.0 EP in
 * the picker, because 50 points of it were above a ceiling the picker knew
 * about and the diff did not.
 */
function sideFor(view: SlotView, lens: WeightProfile, existing: ScoreExisting): DiffSide | null {
  if (!view.equipped) return null;
  const upgrade = normalizeState(view.equipped.upgrade ?? BASE_STATE);
  const donors = Object.entries(view.equipped.exaltations ?? {})
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1] !== '')
    .sort((x, y) => x[0].localeCompare(y[0]))
    .map(([kind, donor]) => ({ kind, donor }));
  return {
    itemName: view.equipped.itemName,
    item: view.item,
    upgrade,
    unresolved: view.unresolved,
    ep: view.item
      ? finite(
          scoreItem(view.item, upgrade, lens, {
            existing,
            weaponCounts: view.position.type !== 'ANY',
          }).total,
        )
      : 0,
    donors,
  };
}

function sameDonors(a: DiffSide, b: DiffSide): boolean {
  if (a.donors.length !== b.donors.length) return false;
  return a.donors.every((entry, i) => {
    const other = b.donors[i];
    return Boolean(other) && other?.kind === entry.kind && other?.donor === entry.donor;
  });
}

function statusFor(a: DiffSide | null, b: DiffSide | null): SlotDiffStatus {
  if (!a && !b) return 'both-empty';
  if (!a) return 'added';
  if (!b) return 'removed';
  if (a.itemName.toLowerCase() !== b.itemName.toLowerCase()) return 'swapped';
  const sameTier = a.upgrade.full === b.upgrade.full && a.upgrade.fraction === b.upgrade.fraction;
  return sameTier && sameDonors(a, b) ? 'same' : 'retuned';
}

function plain(key: string, label: string, a: number, b: number, extra: Partial<PlainRow> = {}): PlainRow {
  const av = finite(a);
  const bv = finite(b);
  return { key, label, a: av, b: bv, delta: bv - av, ...extra };
}

function capped(key: string, label: string, a: number, b: number, cap: number): CapRow {
  const row = plain(key, label, a, b);
  const creditable = creditableDelta(row.a, row.b, cap);
  return {
    ...row,
    cap,
    creditable,
    uncredited: row.delta - creditable,
    atCapA: row.a >= cap,
    atCapB: row.b >= cap,
  };
}

function weaponRows(a: StatTotals, b: StatTotals): PlainRow[] {
  const rows: PlainRow[] = [];
  for (const hand of ['primary', 'secondary'] as const) {
    const wa = a.weapons[hand];
    const wb = b.weapons[hand];
    if (!wa && !wb) continue;
    const label = hand === 'primary' ? 'Primary' : 'Secondary';
    rows.push(plain(`${hand}_DMG`, `${label} damage`, wa?.damage ?? 0, wb?.damage ?? 0));
    rows.push(plain(`${hand}_DLY`, `${label} delay`, wa?.delay ?? 0, wb?.delay ?? 0, { neutral: true }));
    rows.push(
      plain(`${hand}_RATIO`, `${label} ratio`, wa?.ratio ?? 0, wb?.ratio ?? 0, { places: 3 }),
    );
  }
  return rows;
}

function buildGroups(a: StatTotals, b: StatTotals): DiffGroup[] {
  const groups: DiffGroup[] = [
    {
      title: 'Vitals',
      kind: 'plain',
      rows: [
        plain('HP', 'Hit Points', a.hp, b.hp),
        plain('MANA', 'Mana', a.mana, b.mana),
        plain('ENDUR', 'Endurance', a.endurance, b.endurance),
        plain('AC', 'AC', a.ac, b.ac),
        plain('ATTACK', 'Attack', a.attack, b.attack),
        /*
         * No percent sign, for the reason `HASTE_PROVENANCE` in `engine/stats.ts`
         * sets out at length: the label is the client's own, the number under it
         * is the wiki's per-item haste field, and two sources disagree about
         * whether they are the same quantity. The stat panel carries the full
         * note; this row must at minimum stop asserting the disputed reading.
         */
        plain('HASTE', 'Attack Speed', a.haste, b.haste),
        plain('WEIGHT', 'Equipped Weight', a.weight, b.weight, { places: 1, neutral: true }),
      ],
    },
    {
      title: 'Stats',
      kind: 'capped',
      cap: ATTRIBUTE_CAP,
      rows: ATTRIBUTES.map((attr) =>
        capped(attr, ATTRIBUTE_NAMES[attr], a.attributes[attr], b.attributes[attr], ATTRIBUTE_CAP),
      ),
    },
    {
      title: 'Resists',
      kind: 'capped',
      cap: RESIST_CAP,
      rows: SAVES.map((save) =>
        capped(`SV_${save}`, SAVE_NAMES[save], a.saves[save], b.saves[save], RESIST_CAP),
      ),
    },
    {
      title: 'Regen',
      kind: 'plain',
      rows: [
        plain('HP_REGEN', 'Combat HP Regen', a.hpRegen, b.hpRegen),
        plain('MANA_REGEN', 'Combat Mana Regen', a.manaRegen, b.manaRegen),
        plain('END_REGEN', 'Combat End Regen', a.endRegen, b.endRegen),
      ],
    },
  ];

  const weapons = weaponRows(a, b);
  if (weapons.length) groups.push({ title: 'Weapons', kind: 'plain', rows: weapons });
  return groups;
}

function summarizeCaps(groups: DiffGroup[]): CapSummary {
  const summary: CapSummary = { raw: 0, credited: 0, wasted: 0, absorbed: 0, atCap: [] };
  for (const group of groups) {
    if (group.kind !== 'capped') continue;
    for (const row of group.rows) {
      summary.raw += row.delta;
      summary.credited += row.creditable;
      if (row.delta > 0) summary.wasted += Math.max(0, row.delta - row.creditable);
      if (row.delta < 0) summary.absorbed += Math.max(0, row.creditable - row.delta);
      if (row.atCapB) summary.atCap.push(row.label);
    }
  }
  return summary;
}

/**
 * A whole set's EP under one profile.
 *
 * Two details keep this agreeing with the rest of the app rather than merely
 * looking plausible.
 *
 * **A weapon only counts where it is swung.** `computeTotals` reports a weapon
 * from Primary and Secondary alone, so a weapon parked in an Any Slot adds no
 * damage and no ratio to the stat panel, and neither the picker nor the
 * per-slot column scores it there. This total credited it anyway, which is how
 * the headline tile came to disagree with the column beneath it by 10.6 EP on a
 * set with a weapon in an Any Slot — the one number on the screen that
 * contradicted the numbers it was summarising.
 *
 * **Cap headroom is spent as the walk proceeds**, not reset for every item.
 * Each slot is credited `min(running + amount, cap) − min(running, cap)`, so the
 * sum telescopes to `min(total, cap)`: the value of the set's *capped* totals,
 * which is what a character actually feels. Scoring each item against an empty
 * context instead lets two items each claim the same headroom and bill for it
 * twice. No set of gear currently reaches 510, so today this changes nothing —
 * it is here so the number stays right on the day one does.
 *
 * The per-slot column asks a different question — what one item is worth *given
 * the rest of the set* — and marginal contributions under a binding ceiling do
 * not sum to the whole. While no cap binds the two agree exactly, which is the
 * case `setdiff` asserts.
 */
function totalEp(views: readonly SlotView[], weights: WeightProfile): number {
  const filled = views.flatMap((view) =>
    view.item && view.equipped
      ? [{
          position: view.position,
          item: view.item,
          upgrade: normalizeState(view.equipped.upgrade),
        }]
      : [],
  );
  let total = 0;

  for (const [index, entry] of filled.entries()) {
    // Prefix totals via the engine's own accumulator, so "headroom already
    // spent" is measured the same way the stat panel measures it.
    const spent = computeTotals(
      filled.slice(0, index).map((prior) => ({
        position: prior.position.id,
        item: prior.item,
        upgrade: prior.upgrade,
      })),
    );

    total += finite(
      scoreItem(entry.item, entry.upgrade, weights, {
        existing: scoreContextFrom(spent),
        weaponCounts: entry.position.type !== 'ANY',
      }).total,
    );
  }

  return total;
}

function hasWeights(weights: WeightProfile): boolean {
  return Object.values(weights).some((v) => finite(v) !== 0);
}

function weightsMatch(a: WeightProfile, b: WeightProfile): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) if (finite(a[key]) !== finite(b[key])) return false;
  return true;
}

/**
 * Diff two sets.
 *
 * `a` is the baseline and `b` the candidate, so every delta reads "what
 * changing to B does". Per-slot EP uses one profile as a single lens, because
 * scoring each side under its own would put two different scales in one
 * subtraction column; when the profiles differ the caller is told, and each
 * set's score under its own weights is reported alongside.
 *
 * The lens is A's profile, unless A carries no weight at all — a set whose
 * weights were all cleared — in which case it falls through to B's. Which one
 * it landed on is published as `lensOwner`, because the totals and every banner
 * that names the profile have to name the set the numbers actually came from.
 * `epALens` and `epBUnderLens` are the two ends of that one scale; `epA` and
 * `epB` are each set under its own, and the two pairs must never be mixed in a
 * single tile.
 */
export function diffSets(a: GearSet, b: GearSet, catalog: CatalogState): SetDiff {
  const viewsA = slotViews(a, catalog);
  const viewsB = slotViews(b, catalog);
  const lensOwner: 'a' | 'b' = hasWeights(a.weights) ? 'a' : 'b';
  const lens = lensOwner === 'a' ? a.weights : b.weights;

  const slots: SlotDiff[] = viewsA.map((viewA, index) => {
    const viewB = viewsB[index] ?? viewA;
    // What the rest of each set contributes, exactly as the picker computes it
    // from `totalsFor(views, position)` before opening (`gear.ts`).
    const sideA = sideFor(viewA, lens, scoreContextFrom(totalsFor(viewsA, viewA.position.id)));
    const sideB = sideFor(viewB, lens, scoreContextFrom(totalsFor(viewsB, viewB.position.id)));
    const status = statusFor(sideA, sideB);
    const stats =
      sideB?.item
        ? statDeltas(sideB.item, sideB.upgrade, sideA?.item, sideA?.upgrade ?? BASE_STATE)
        : sideA?.item
          ? statDeltas(sideA.item, sideA.upgrade, undefined, BASE_STATE).map((d) => ({
              ...d,
              before: d.after,
              after: 0,
              delta: -d.delta,
            }))
          : [];
    return {
      position: viewA.position,
      a: sideA,
      b: sideB,
      status,
      epDelta: (sideB?.ep ?? 0) - (sideA?.ep ?? 0),
      stats,
      changed: status !== 'same' && status !== 'both-empty',
    };
  });

  const totalsA = totalsFor(viewsA);
  const totalsB = totalsFor(viewsB);
  const groups = buildGroups(totalsA, totalsB);

  const counts: Record<SlotDiffStatus, number> = {
    'both-empty': 0, same: 0, retuned: 0, swapped: 0, added: 0, removed: 0,
  };
  for (const slot of slots) counts[slot.status] += 1;

  const epA = totalEp(viewsA, a.weights);
  const epB = totalEp(viewsB, b.weights);
  const epBUnderLens = totalEp(viewsB, lens);
  const epALens = totalEp(viewsA, lens);

  const statsMoved = groups.some((group) => group.rows.some((row) => row.delta !== 0));

  return {
    slots,
    groups,
    totalsA,
    totalsB,
    capSummary: summarizeCaps(groups),
    epA,
    epB,
    epALens,
    epBUnderLens,
    epDelta: epBUnderLens - epALens,
    lens,
    lensOwner,
    weightsDiffer: !weightsMatch(a.weights, b.weights),
    counts,
    filledA: viewsA.filter((v) => v.equipped).length,
    filledB: viewsB.filter((v) => v.equipped).length,
    identical: !slots.some((s) => s.changed) && !statsMoved,
    sameCharacter: a.characterId === b.characterId,
  };
}
