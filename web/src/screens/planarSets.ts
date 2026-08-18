/**
 * The planar armour sets, and how they are resolved against this catalog.
 *
 * -------------------------------------------------------------------------
 * WHERE THE SET LIST COMES FROM
 *
 * The eighteen set names and the class each belongs to are transcribed from
 * eqlsource.com's own `/tools/planar-gear.html`, read on 2026-08-18. That is a
 * **Tier 3** statement under `research/SOURCING-STANDARD.md` — a named
 * community source — and it is used here for exactly one thing: deciding which
 * eighteen names are set names, and which class each set belongs to.
 *
 * **No stat, no slot, no class restriction and no eligibility rule is taken
 * from it.** Every one of those is read off this project's own catalog record
 * for the piece, which carries `cl`, `ra`, `sl`, `st`, `sv`, `sd`, `ex` and
 * `src`. Where the two disagree, this file does not average them: the catalog
 * wins and `reconcilePlanarSets` reports the disagreement so a test can fail on
 * it. See `planar.test.ts`.
 *
 * -------------------------------------------------------------------------
 * THE ONE INFERENCE, STATED
 *
 * Membership is decided by name: a catalog item belongs to a set when its name
 * begins with the set's name followed by a space, **and** it is worn in one of
 * the seven slots the sets cover. That is a name inference, which this
 * repository is otherwise hostile to (`SOURCING-STANDARD.md` rule 7: "what must
 * not happen is filling the blanks from the name").
 *
 * It is admitted here, narrowly, because of what it is and is not doing. It
 * fills in **no field** — every attribute of every piece still comes from the
 * piece's own record. It only groups records that already exist under a heading.
 * A wrong grouping shows a piece under the wrong set name; it cannot invent a
 * stat, a slot or a class, and the class check below catches the case where the
 * grouping and the catalog disagree about who can wear the thing.
 *
 * The slot requirement is not decoration. `Carmine Spiroc Feather` is a Plane of
 * Sky quest item with no worn slot at all, and a bare prefix match filed it
 * under the Wizard set.
 */

import { canUse, type LoadoutContext } from '../engine/character';
import type { ClassCode, SlotPosition } from '../engine/constants';
import { SLOT_POSITIONS } from '../engine/constants';
import { rankScorer, type WeightProfile } from '../engine/ep';
import type { Item } from '../engine/types';
import { BASE_STATE, type UpgradeState } from '../engine/upgrade';
import { statsAreUnknown } from '../data/normalize';
import { finite } from '../lib/format';

/* ------------------------------------------------------------- the sets */

export interface PlanarSetDef {
  /** The set name, exactly as the source page publishes it. */
  name: string;
  /** The class the set belongs to, or `null` for the two shared sets. */
  cls: ClassCode | null;
}

/**
 * The eighteen sets, in the order the source page lists them: the two shared
 * sets first, then the sixteen class sets.
 */
export const PLANAR_SETS: readonly PlanarSetDef[] = [
  { name: 'Lustrous Russet', cls: null },
  { name: 'Midnight Clad', cls: null },
  { name: 'Ethereal Mist', cls: 'CLR' },
  { name: 'Vermiculated', cls: 'DRU' },
  { name: 'Rune Etched', cls: 'SHM' },
  { name: 'Anthemion', cls: 'BST' },
  { name: 'Thorny Vine', cls: 'RNG' },
  { name: 'Valorium', cls: 'PAL' },
  { name: 'Shadow Rage', cls: 'BER' },
  { name: 'Shiverback-hide', cls: 'MNK' },
  { name: 'Insidious', cls: 'ENC' },
  { name: 'Apothic', cls: 'MAG' },
  { name: 'Blighted', cls: 'NEC' },
  { name: 'Carmine', cls: 'WIZ' },
  { name: 'Imbrued Platemail', cls: 'BRD' },
  { name: 'Umbral Platemail', cls: 'SHD' },
  { name: 'Woven Shadow', cls: 'ROG' },
  { name: 'Indicolite', cls: 'WAR' },
];

/**
 * The seven worn slot types the planar sets cover.
 *
 * Everything else is **not offered**, rather than offered empty. The sets carry
 * no rings and no earrings; they also carry no neck, face, shoulders, back,
 * waist, range, ammo, weapon or Any Slot piece. `uncoveredPositions()` names
 * every one of them so the page can say what it is not answering.
 */
export const PLANAR_SLOTS = ['HEAD', 'CHEST', 'ARMS', 'WRIST', 'HANDS', 'LEGS', 'FEET'] as const;
export type PlanarSlot = (typeof PLANAR_SLOTS)[number];

const PLANAR_SLOT_SET: ReadonlySet<string> = new Set(PLANAR_SLOTS);

/** Reading order down the body, which is how the page lays the slots out. */
export const PLANAR_SLOT_LABELS: Record<PlanarSlot, string> = {
  HEAD: 'Head',
  CHEST: 'Chest',
  ARMS: 'Arms',
  WRIST: 'Wrist',
  HANDS: 'Hands',
  LEGS: 'Legs',
  FEET: 'Feet',
};

/**
 * How many of each slot a character actually wears.
 *
 * Derived from `SLOT_POSITIONS` — the paper doll's own twenty-three positions,
 * validated against a live `/outputfile inventory` — rather than from a literal
 * here, so Wrist counting twice is the same fact on this screen as on the doll
 * instead of a second copy of it that could drift.
 */
export function positionsFor(slot: PlanarSlot): SlotPosition[] {
  return SLOT_POSITIONS.filter((position) => position.type === slot);
}

export function wearCount(slot: PlanarSlot): number {
  return positionsFor(slot).length;
}

/** Every worn position the planar sets cannot fill. */
export function uncoveredPositions(): SlotPosition[] {
  return SLOT_POSITIONS.filter((position) => !PLANAR_SLOT_SET.has(position.type));
}

/** Positions the sets do cover, counting Wrist twice. */
export function coveredPositionCount(): number {
  return PLANAR_SLOTS.reduce((total, slot) => total + wearCount(slot), 0);
}

/* -------------------------------------------------------- the resolution */

export interface PlanarPiece {
  item: Item;
  set: PlanarSetDef;
  slot: PlanarSlot;
}

/**
 * Longest match first, so a set whose name is a prefix of another's cannot
 * swallow it. None of the eighteen currently collide; sorting costs nothing and
 * removes the possibility that a nineteenth quietly does.
 */
const BY_LENGTH: readonly PlanarSetDef[] = [...PLANAR_SETS].sort(
  (a, b) => b.name.length - a.name.length,
);

function setForName(name: string): PlanarSetDef | undefined {
  const lower = name.toLowerCase();
  return BY_LENGTH.find((def) => lower.startsWith(`${def.name.toLowerCase()} `));
}

/**
 * Every planar piece this catalog holds, one entry per (piece, covered slot).
 *
 * A piece worn in two of the seven slots would appear under both, which is the
 * truthful answer for a slot list — none currently is.
 */
export function resolvePlanarPieces(items: readonly Item[]): PlanarPiece[] {
  const out: PlanarPiece[] = [];
  for (const item of items) {
    const set = setForName(item.n);
    if (!set) continue;
    for (const slot of item.sl) {
      if (PLANAR_SLOT_SET.has(slot)) out.push({ item, set, slot: slot as PlanarSlot });
    }
  }
  return out.sort((a, b) => a.item.n.localeCompare(b.item.n));
}

/* ------------------------------------------------------- reconciliation */

/**
 * Where the transcribed set table and this catalog disagree about a piece.
 *
 * The set table says which class a set belongs to. The catalog says which
 * classes may wear the piece. Those are two independent sources and they are
 * checked against each other rather than merged:
 *
 *   - a class set's piece must name that class, and only that class;
 *   - a shared set's piece must name more than one class.
 *
 * Held at zero by `planar.test.ts`. If a patch ever breaks it, the failure is a
 * test failure and a line on the page — not a silent regrouping.
 */
export interface SetReconciliation {
  set: PlanarSetDef;
  pieces: PlanarPiece[];
  /** Names of pieces whose catalog class list contradicts the set's class. */
  classMismatch: string[];
}

export function reconcilePlanarSets(pieces: readonly PlanarPiece[]): SetReconciliation[] {
  return PLANAR_SETS.map((set) => {
    const mine = pieces.filter((piece) => piece.set.name === set.name);
    const classMismatch: string[] = [];
    for (const piece of mine) {
      const classes = piece.item.cl.filter((code) => code !== 'ALL');
      const ok = set.cls
        ? classes.length === 1 && classes[0] === set.cls
        : classes.length > 1 || piece.item.cl.includes('ALL');
      if (!ok) classMismatch.push(piece.item.n);
    }
    return { set, pieces: mine, classMismatch };
  });
}

/* ------------------------------------------------------------- the rank */

export interface RankedPiece {
  piece: PlanarPiece;
  /** Equivalency points at the chosen weights and upgrade tier. */
  score: number;
}

export interface PlanarSlotResult {
  slot: PlanarSlot;
  /** Wearable, measured, scored, best first. */
  ranked: RankedPiece[];
  /**
   * Wearable, and refused a rank because nobody has published its numbers.
   * Listed by name and never scored — see `SOURCING-STANDARD.md` rule 4.
   */
  unmeasured: PlanarPiece[];
  /** Pieces the trio cannot equip, counted rather than silently dropped. */
  ineligible: number;
}

/** Does this loadout's class, race and level let it wear the piece? */
export function pieceIsWearable(item: Item, context: LoadoutContext | undefined): boolean {
  if (!context || !context.classes.length) return false;
  return canUse(
    { classes: item.cl, races: item.ra, ...(item.rl ? { rl: item.rl } : {}) },
    context,
  );
}

/**
 * Rank one slot.
 *
 * Uses `rankScorer` — the same compiled scorer the item picker and Auto-fill
 * rank with — so a piece's EP here is the number it carries everywhere else in
 * this planner rather than a second scoring model that happens to live on one
 * screen. `weaponCounts` is off because none of these is a weapon and paying
 * for a ratio the stat sheet would never show is how AMMO once out-ranked
 * armour on the upgrades screen.
 */
export function rankPlanarSlot(
  pieces: readonly PlanarPiece[],
  slot: PlanarSlot,
  context: LoadoutContext | undefined,
  weights: WeightProfile,
  upgrade: UpgradeState = BASE_STATE,
): PlanarSlotResult {
  const score = rankScorer(weights, { weaponCounts: false });
  const ranked: RankedPiece[] = [];
  const unmeasured: PlanarPiece[] = [];
  let ineligible = 0;

  for (const piece of pieces) {
    if (piece.slot !== slot) continue;
    if (!pieceIsWearable(piece.item, context)) {
      ineligible++;
      continue;
    }
    // An item nobody has measured cannot be ranked. Reading its absent stats as
    // zero would print a real-looking `0.0 EP` beside numbers that were
    // actually observed, so it is listed and left unscored instead.
    if (statsAreUnknown(piece.item)) {
      unmeasured.push(piece);
      continue;
    }
    ranked.push({ piece, score: finite(score(piece.item, upgrade)) });
  }

  ranked.sort((a, b) => b.score - a.score || a.piece.item.n.localeCompare(b.piece.item.n));
  unmeasured.sort((a, b) => a.item.n.localeCompare(b.item.n));
  return { slot, ranked, unmeasured, ineligible };
}

/**
 * The sets a trio can draw on at all.
 *
 * The headline claim of the tool this replaces — "five sets compete for every
 * slot" — is true of a trio of three *different* classes with both shared sets
 * open to them. It is not true of every trio, and this counts rather than
 * repeats it: a Warrior/Bard/Berserker can wear Midnight Clad from none of its
 * three classes, so four sets compete, not five.
 */
export function setsAvailable(
  pieces: readonly PlanarPiece[],
  context: LoadoutContext | undefined,
): PlanarSetDef[] {
  const seen = new Map<string, PlanarSetDef>();
  for (const piece of pieces) {
    if (!pieceIsWearable(piece.item, context)) continue;
    if (!seen.has(piece.set.name)) seen.set(piece.set.name, piece.set);
  }
  return PLANAR_SETS.filter((set) => seen.has(set.name));
}
