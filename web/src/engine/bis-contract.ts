/**
 * MAKE ME BIS — the contract between 50 Upgrades and the gap engine.
 *
 * **Published before it is implemented, deliberately.** Session E codes against
 * this shape tonight; a schema agreed early is worth more than a perfect one
 * late. If a field here turns out to be wrong, it changes here first and the
 * change is announced — E should never discover a rename by a runtime failure.
 *
 * ## The seam
 *
 * ```
 *   50 Upgrades (B)  what could this character equip that is better?
 *   gap engine (E)   how much would that actually matter?
 * ```
 *
 * B produces **candidates with stat deltas**. E converts a stat delta into a
 * damage or survivability delta and does the final ranking. Neither side needs
 * the other to start: B needs no damage model, E needs no catalogue.
 *
 * **B does not rank.** `candidates()` returns an unordered set. Any order in the
 * array is an artefact of enumeration and must not be read as priority — the
 * whole point of the seam is that B cannot know what matters.
 *
 * ## The rule that governs every number here
 *
 * `research/SOURCING-STANDARD.md` rule 4: **never invent a number.** Where a
 * stat is not recorded, the field is absent and `statDelta.unknown` names it.
 * **A zero is a claim.** An item whose stats nobody has recorded must not
 * present as "no change" — that is indistinguishable from a genuine zero delta
 * and it is the one error that would make the ranking confidently wrong.
 *
 * ## What is measured, so E can size its side
 *
 * Counted over the shipped payload at 2026-08-31 (`meta.counts.items` 3,663;
 * figures from `node pipeline/catalogue-audit.mjs --json`):
 *
 * | | records |
 * |---|---|
 * | shipped items | 3,663 |
 * | carrying stat values (`st`) | 1,713 |
 * | carrying weapon data (`wp`) | 560 |
 * | carrying obtainability (`src`) | 3,456 |
 * | carrying **both** stats and obtainability | 1,658 |
 * | stat standing `tier-M` — read off a live client window | **5** |
 *
 * That last row is not a typo and E should design around it: **the stat values
 * are overwhelmingly wiki-derived (`tier-2`), not client-verified.** Every
 * candidate carries `standing` so E can discount or refuse on it rather than
 * inheriting our confidence blind.
 */

import type { SlotType } from './constants';
import type { ClassCode } from './types';

/* ------------------------------------------------------------------ input */

/**
 * The character state a recommendation is computed for.
 *
 * `classes` is the trio. **Eligibility is the union of what the trio can wear,
 * gated by the LOWEST level in the active loadout** — a Paladin in the mix opens
 * plate to the group, and a level 12 member holds the whole trio to level 12
 * requirements. That rule lives in `engine/character.ts` and is not restated
 * here, because a second copy is a second thing to go stale.
 */
export interface BisInput {
  classes: ClassCode[];
  /** The level the trio is gated at. See `contextForLoadout`. */
  level: number;
  race: string | null;
  /** What is worn now, by slot position id. `null` means the slot is empty. */
  currentGear: Record<string, string | null>;
}

/* ----------------------------------------------------------------- output */

/**
 * A stat difference between a candidate and what is worn.
 *
 * Keys are the catalogue's own stat codes (`AC`, `HP`, `MANA`, `STR`, `SV_FIRE`,
 * …). **Only keys with a known, non-zero difference appear.** A key absent from
 * `delta` and absent from `unknown` genuinely did not change.
 */
export interface StatDelta {
  delta: Record<string, number>;
  /**
   * Stat keys that could not be differenced because a value is not recorded on
   * one side or the other. **These are not zeroes.** A candidate with a
   * non-empty `unknown` is offering an incomplete comparison and should rank
   * below an equal candidate whose comparison is complete.
   */
  unknown: string[];
  /**
   * True when the candidate itself carries no stat values at all — the
   * catalogue knows the item exists and nothing about what it does. The whole
   * comparison is then unavailable rather than partial.
   */
  candidateStatsUnknown: boolean;
}

/** Where an item can actually be got. `null` when the catalogue does not say. */
export interface Obtainable {
  zones: string[];
  mobs: string[];
  quests: string[];
  vendors: string[];
  crafted: boolean;
  /**
   * True when a mob was *measured* dropping this in parsed combat logs — Tier M
   * existence, the strongest evidence here. Distinct from a wiki drop table.
   */
  measuredDrop: boolean;
}

export interface BisCandidate {
  slot: SlotType | 'ANY';
  /** The slot POSITION this fills — `EAR_1` and `EAR_2` are different answers. */
  positionId: string;
  candidateItemId: number | null;
  candidateName: string;
  replacesItemId: number | null;
  replacesName: string | null;
  statDelta: StatDelta;
  /** `"not recorded"` where the catalogue carries no source data at all. */
  obtainable: Obtainable | 'not recorded';
  eligible: boolean;
  /** Why not, when `eligible` is false. Empty string when it is true. */
  eligibilityReason: string;
  /**
   * The stat standing of the CANDIDATE's numbers — `tier-M`, `tier-2`,
   * `tier-5` or `unattributed`. E should treat this as a confidence input:
   * only 5 records in the whole catalogue are `tier-M`.
   */
  standing: string;
}

/** The function 50 Upgrades exposes. Unordered — see the module note. */
export type CandidatesFn = (input: BisInput) => BisCandidate[];

/**
 * Contract version. Bump the major when a field is removed or its meaning
 * changes; E asserts on this before reading a payload.
 */
export const BIS_CONTRACT_VERSION = '1.0.0';
