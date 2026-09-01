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
import type { Item } from './types';

/**
 * A surveyed zone, as `manifest.surveyedZonesAt` publishes them.
 *
 * **Named `BisZoneSurvey`, not `ZoneSurvey`, because that name is already taken
 * in this repository by a different shape.** `engine/types.ts:84` declares
 * `ZoneSurvey` as `{ zone, slug, title, survey, measured, facets }` — the rich
 * published record the Upgrades screen renders. This one is
 * `{ title, levels? }`, which is all `publish-bis.mjs` emits into the seam.
 *
 * Two unrelated shapes under one name, in one codebase, is the hazard R81 names
 * across repositories. A consumer reading this contract and then grepping for
 * `ZoneSurvey` would land on the other one and build to six fields that are not
 * there. The name carries the distinction so no one has to notice it.
 */
export interface BisZoneSurvey {
  title: string;
  levels?: string;
}

/* ------------------------------------------------------------------ input */

/**
 * The character state a recommendation is computed for.
 *
 * `classes` is the trio. **Eligibility is the union of what the trio can wear** —
 * a Paladin in the mix opens plate to the group.
 *
 * **`level` is supplied by the caller and this module derives nothing from it.**
 * An earlier version of this comment said the gate was "the LOWEST level in the
 * active loadout" and attributed that to `engine/character.ts`. **Both halves
 * were wrong.** `character.ts`'s `levelCheck` takes the **highest** qualifying
 * class level; `research/eql-game-systems.md:279` says effective level is the
 * lowest; `eql-source/CLAUDE.md:122-124` says lowest; and
 * `research/eql-game-systems.md:285-288` says caps take the highest while
 * spell access runs at the lowest — so there are at least three quantities.
 *
 * **And underneath all of it sits an unmeasured premise:** the only Tier M
 * sighting of "Required Level" in this repository is on a *click effect*, not
 * on wearing an item, so it is not established that equipping is level-gated at
 * all. See `docs/UNREPORTED-FINDINGS.md` entry 1.
 *
 * The caller owns the number. Ruled R71/R55; the shape is the point.
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
  /**
   * True when the caller named a worn item this catalogue cannot resolve.
   *
   * **Not the same as an empty slot**, and the difference fabricates. An empty
   * slot contributes a measured zero, so a candidate's whole stat line IS the
   * gain. An unresolvable one means something is in the slot and nobody knows
   * what it does — crediting the full line there is a confident wrong number.
   * When this is true, `delta` is empty and every key is in `unknown`.
   */
  replacesUnresolved: boolean;
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
  /** Creature names, VERBATIM as the catalogue records them. Not filtered to bosses. */
  mobs: string[];
  /**
   * The same creatures, case-folded and deduped, for a consumer that needs to
   * JOIN on them.
   *
   * Measured over 2,315 distinct mob strings: **90 differ from another only by
   * case**, so a raw name used as a key turns one mob into two and a lookup
   * silently misses. EQ capitalises a leading article line-initially and not
   * mid-sentence, so the case says where the name was written, not which mob it
   * is. Session C's board moved 72.2% → 86.8% on this class of fault alone.
   *
   * **The leading article is NOT stripped.** 35 further strings differ only by
   * `a`/`an`/`the`; merging those would assert they name the same creature,
   * which is a claim about the game that nobody here has measured. Unresolved,
   * and filed rather than guessed.
   */
  mobKeys: string[];
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
  /**
   * The stat standing of the CANDIDATE's numbers — `tier-M`, `tier-2`,
   * `tier-5` or `unattributed`. E should treat this as a confidence input:
   * only 5 records in the whole catalogue are `tier-M`.
   */
  standing: string;
}

/**
 * ## There is no `eligible` field, and its absence IS the guarantee
 *
 * This type carried `eligible: boolean` and `eligibilityReason: string` until
 * 2026-09-01. Measured over 2,066 real candidates, `eligible` had **one**
 * distinct value (`true`) and `eligibilityReason` had **one** (`""`).
 *
 * They were not merely unused — they were **worse than unused**. A consumer
 * writing `candidates.filter(c => c.eligible)` would believe it was doing work,
 * and would reasonably infer the field could be `false` if something were
 * wrong. It could not: `candidates()` skips an ineligible item entirely, so the
 * state those fields described was unrepresentable.
 *
 * That is the `_nr` shape — a field that looks like it does something, on an
 * object whose consumer never asks — and it has now been found in three
 * repositories. Removing it is the structural fix rather than documenting it:
 * **an ineligible item cannot appear in this array at all.** A guarantee the
 * shape enforces beats a flag a reader has to trust, and a flag that can only
 * ever hold one value is a control that cannot fire.
 *
 * If a caller needs to know WHY something was excluded, that is a different
 * function returning a different type, not a constant on this one.
 */

/**
 * The function 50 Upgrades exposes. Unordered — see the module note.
 *
 * **This declared a single `input` parameter until 1 Sep, and the shipped
 * function has always taken the catalogue as a second, required one.** Probed
 * against the published bundle rather than reasoned about:
 *
 * ```
 * EQLS50Upgrades.candidates.length            -> 2
 * EQLS50Upgrades.candidates({classes:['WAR'], level:50, race:null,
 *                            currentGear:{}}) -> TypeError: catalog is not iterable
 * ```
 *
 * A consumer writing to this type, exactly as published, got a crash. Nothing
 * compared the two: a type in one file and a function in another drift in
 * silence, which is the same shape as R106's fixture that nothing loaded.
 *
 * `bis.ts` now carries `const _contractShape: CandidatesFn = candidates;` — one
 * line, checked by `tsc` on every CI run. It rejects this exact drift with
 * *"Target signature provides too few arguments. Expected 2 or more, but got
 * 1."*, which is the message that would have prevented it.
 *
 * The catalogue is deliberately NOT optional. A `candidates()` that quietly
 * returned `[]` for a missing catalogue would be R98 again: an empty answer
 * carrying a completeness claim, indistinguishable from "nothing qualifies".
 */
export type CandidatesFn = (
  input: BisInput,
  catalog: readonly Item[],
  options?: { byId?: Map<string, Item>; surveyedZones?: readonly BisZoneSurvey[] },
) => BisCandidate[];

/**
 * Contract version. Bump the major when a field is removed or its meaning
 * changes; E asserts on this before reading a payload.
 */
export const BIS_CONTRACT_VERSION = '1.0.0';
