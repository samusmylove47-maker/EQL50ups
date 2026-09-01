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

import type { ClassCode, SlotType } from './constants';

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

/**
 * Where an item can be got, in the shape =Lockouts keys on.
 *
 * **Ruled 31 Aug 20:3x:** B owns *item -> boss / zone / difficulty*, D owns
 * *boss / zone / difficulty -> can this character run it this week*. D does not
 * take item ids and must never be sent one.
 *
 * ## Two honest limits, measured rather than assumed
 *
 * **1. `difficulty` is never populated, and the reason is more interesting than
 * "no data".** `grep -roic difficulty web/public/data/` finds it in exactly one
 * place: `meta.zones.surveyed[].coverage.difficulty`, on 13 zones, where the
 * value is a *survey grade* — `"measured"` or `"sourced"` — saying whether
 * anyone has surveyed that zone's difficulty. **It is not a difficulty value.**
 * Emitting it as one would turn "we looked" into "it is hard", which is the
 * precise failure this contract exists to prevent, so `difficulty` stays `null`.
 * It is typed because it is D's key and the gap should be visible in the shape.
 *
 * **What CAN be offered instead is `zoneLevels`** — those same 13 surveyed zones
 * carry a real level range (`"7-25+"`, `"20-45"`, `"32-50"`). Measured reach:
 * **752 of 3,663 items** have a zone list touching a surveyed zone, **463 of
 * them carrying stats.** That is a genuine difficulty proxy for a fifth of the
 * catalogue and it is offered as what it is, not relabelled as difficulty.
 *
 * **0. Nothing here promises a drop.** The LOOT lockout is not observable from
 * a log — its only source is the client's alt+Z window — so no field in this
 * type can support "you will get this". `measuredDrop` means *a mob was
 * observed dropping this item at least once*, which is evidence the source is
 * real, not a rate and not a guarantee. Consumers must phrase accordingly.
 *
 * **2. `mobs` are mobs, not bosses.** The catalogue's drop data is a flat list
 * of creature names — `"a goblin magician"`, `"an alligator"`, `"Ekeros"` — with
 * no marker separating a named boss from trash. Calling the field `boss` would
 * assert a distinction the data does not carry. Consumers that need bosses
 * must apply their own test; this field will hand them everything.
 */
export interface Obtainable {
  /** Zone names, as the catalogue records them. D's key, first field. */
  zones: string[];
  /** Creature names. NOT filtered to bosses — see the note above. */
  mobs: string[];
  /**
   * Always `null`. No difficulty VALUE exists in this payload — only a survey
   * grade about difficulty, on 13 zones. Never guessed. Present so D's key
   * shape is complete and the gap is visible rather than silently absent.
   */
  difficulty: null;
  /**
   * The surveyed level range of the first zone that has one — `"20-45"` — or
   * `null`. The nearest real signal to difficulty this catalogue holds, offered
   * under its own name. Reaches 752 of 3,663 items; 463 of those carry stats.
   */
  zoneLevels: string | null;
  quests: string[];
  vendors: string[];
  crafted: boolean;
  /**
   * True when a mob was *measured* dropping this in parsed combat logs — Tier M
   * existence, the strongest evidence here. Distinct from a wiki drop table,
   * and the only obtainability claim in this catalogue backed by observation.
   */
  measuredDrop: boolean;
}

/**
 * Three-way, never a boolean. Ruled 31 Aug: *"a ranker that treats 'I have not
 * seen this character's log for that zone' as 'go and farm it' produces exactly
 * the recommendation that loses trust in one click."*
 *
 * ## A NAME COLLISION ACROSS THIS SEAM, and why the value was renamed
 *
 * `EQLSLockouts:src/lockoutCore.js` exports `actionability(state, now, …)`
 * returning **`'yes' | 'no' | 'unknown'`** with `because` and `unknownKind`.
 * This field is also called actionability and, until 2026-09-01, also had a
 * value called `'unknown'` — **and the two meant different things.** D's
 * `'unknown'` means *asked, and cannot answer*, qualified by `unknownKind`.
 * B's meant *nobody has asked*.
 *
 * A consumer joining the two would read "not yet asked" as "D says unknown".
 * The contract already said so in prose, and prose is a convention: per R75, a
 * rule that can be satisfied by remembering to do something has not been
 * satisfied. **So the value is now `'not-yet-asked'`, and no value this field
 * can hold is a value D's function can return.** The shape carries the rule.
 *
 * B only ever emits `not-yet-asked` or `no-source`. **Whether a run is actually
 * available this week is D's answer, not B's** — B publishes the key and the
 * fact that it has not been resolved, and a consumer that leaves it `unknown`
 * must band it separately rather than treating it as actionable or dropping it.
 *
 * **B must not infer actionability from anything, and must not pre-filter on
 * it.** Two measured reasons, both from D (31 Aug):
 *
 * 1. **The weekly token cap decides actionability, not the lockout grid.**
 *    Avenrae's week of 11 Aug: 18 roster boss kills, 3 grants, 3 tokens. A boss
 *    can read `open` on the grid while the cap is spent.
 * 2. **`completed` is still actionable** — a locked-out kill pays a guaranteed
 *    drop (patch note, 28 Jul 2026). Filtering out "content done this week"
 *    would delete real upgrades from the ranking: the opposite error to the one
 *    the three-way band guards against, and just as costly.
 *
 * So B hands over everything eligible and anticipates nothing.
 */
export type Actionability =
  /**
   * The catalogue records where this drops. **Nobody has asked =Lockouts yet.**
   * Renamed from `'unknown'` on 2026-09-01 — see the collision note below.
   */
  | 'not-yet-asked'
  /** The catalogue records no source at all. No lookup can make it actionable. */
  | 'no-source';

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
  /**
   * Never `true`/`false`. See `Actionability` — the not-knowing value is loud
   * rather than falsy, and B is not the party that can resolve it.
   */
  actionability: Actionability;
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
