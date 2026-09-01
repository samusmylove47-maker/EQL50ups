/**
 * MAKE ME BIS — candidate enumeration.
 *
 * Implements `web/src/engine/bis-contract.ts`. Read that first: it carries the
 * seam, the field meanings and the two limits this catalogue has.
 *
 * **This module answers exactly one question: what could this character equip
 * that is better on some axis than what they hold?** It does not rank, does not
 * model damage, and does not decide what matters. Those are the gap engine's.
 *
 * ## Three rules it will not break
 *
 * 1. **Never invent a number.** A stat nobody recorded is reported in
 *    `statDelta.unknown`, never as a zero. `A zero is a claim.`
 * 2. **Never offer an item the character cannot wear.** Eligibility is computed
 *    with `engine/character.ts`'s own predicates, not a second copy of them —
 *    recommending unequippable gear is the failure that loses trust in one
 *    click.
 * 3. **Never assert obtainability we do not have.** `difficulty` is always
 *    `null`, and an unasked actionability is `'not-yet-asked'` — never `false`,
 *    and no longer `'unknown'`. That value was renamed on 2026-09-01 precisely
 *    so that nothing this module emits can collide with D's own
 *    `'yes' | 'no' | 'unknown'`; this line still named the old one, which is
 *    the drift the rename was meant to end.
 */

import { SLOT_POSITIONS, type SlotType } from './constants';
import { canUseClass, canUseRace, type LoadoutContext } from './character';
import type { Item } from './types';
import type {
  Actionability, BisCandidate, BisInput, Obtainable, StatDelta,
  BisZoneSurvey,
  CandidatesFn,
} from './bis-contract';

/**
 * Zone survey rows, as `meta.zones.surveyed` publishes them.
 *
 * Declared in `bis-contract.ts` — it is seam surface, and it lived here while
 * the contract could not name it. Re-exported under the contract's name only;
 * the bare `ZoneSurvey` is deliberately NOT re-exported, because
 * `engine/types.ts` already owns that name for a six-field shape.
 */
export type { BisZoneSurvey } from './bis-contract';

/**
 * The level gate is SUPPLIED, not derived, and that is deliberate.
 *
 * `engine/character.ts`'s `levelCheck` takes the HIGHEST qualifying class
 * level. `research/eql-game-systems.md:279` says the effective level is the
 * LOWEST. **That contradiction is unresolved** — it is finding 5 in `HANDOFF.md`
 * and it is blocked on the capture in `research/validation/CAPTURE-REQUESTS.md`
 * §2. Deriving the gate here would silently pick a side in a dispute this
 * module has no evidence to settle, on the one field the brief calls the hard
 * part.
 *
 * So `BisInput.level` is the gate and the caller owns it. That is honest, and
 * it means the answer changes with the rule rather than baking one in.
 */
function meetsSuppliedLevel(item: Item, level: number): boolean {
  const required = Number.isFinite(item.rl) ? Math.max(0, Math.trunc(item.rl as number)) : 0;
  return required === 0 || level >= required;
}

function eligibility(
  item: Item,
  ctx: LoadoutContext,
  level: number,
): { eligible: boolean; reason: string } {
  const restrictions = { classes: item.cl ?? [], races: item.ra ?? [] };
  if (!canUseClass(restrictions, ctx)) {
    return { eligible: false, reason: `no class in the trio may use it (${(item.cl ?? []).join('/') || 'none listed'})` };
  }
  if (!canUseRace(restrictions, ctx)) {
    return { eligible: false, reason: `race ${ctx.race ?? 'unset'} may not use it` };
  }
  if (!meetsSuppliedLevel(item, level)) {
    return { eligible: false, reason: `requires level ${item.rl}, trio is gated at ${level}` };
  }
  return { eligible: true, reason: '' };
}

/** Every stat key either side carries, so a missing value is visible as missing. */
function statKeys(a: Item | null, b: Item | null): string[] {
  const keys = new Set<string>();
  for (const item of [a, b]) {
    if (!item) continue;
    for (const k of Object.keys(item.st ?? {})) keys.add(k);
    for (const k of Object.keys(item.sv ?? {})) keys.add(`SV_${k}`);
  }
  return [...keys];
}

/**
 * What is in the slot now. Three states, and conflating two of them fabricates.
 *
 * - an `Item`      -> compare against it
 * - `null`         -> the slot is EMPTY. It contributes zero, and that zero is
 *                     measured rather than guessed.
 * - `'unresolved'` -> the caller named something worn that this catalogue
 *                     cannot resolve. **Not the same as empty.** Something IS
 *                     in the slot and we do not know what it does.
 */
export type Worn = Item | null | 'unresolved';

function statValue(item: Item | null, key: string): number | undefined {
  if (!item) return 0; // an empty slot genuinely contributes zero; that is not a guess
  if (key.startsWith('SV_')) return item.sv?.[key.slice(3)];
  return item.st?.[key];
}

/**
 * The difference between a candidate and what is worn, with the unknowns named.
 *
 * `statsUnknown` on the candidate means the catalogue knows the item exists and
 * nothing about what it does — the whole comparison is unavailable, not partial,
 * and it must not read as "no change".
 */
export function statDelta(candidate: Item, worn: Worn): StatDelta {
  const candidateStatsUnknown = Boolean(candidate.statsUnknown)
    || (!Object.keys(candidate.st ?? {}).length && !Object.keys(candidate.sv ?? {}).length);

  /*
   * The caller says something is worn and this catalogue cannot resolve it.
   * **Every key is unknown, and none is a difference.** Treating it as an empty
   * slot would credit the candidate's WHOLE stat line as a gain against a zero
   * nobody measured -- a confident wrong number, which is the one failure this
   * module exists to avoid. `Upgrades.tsx` has always handled this as
   * `worn-unresolved`; this module did not until 2026-09-01.
   */
  if (worn === 'unresolved') {
    return {
      delta: {},
      unknown: statKeys(candidate, null).sort(),
      candidateStatsUnknown,
      replacesUnresolved: true,
    };
  }

  const delta: Record<string, number> = {};
  const unknown: string[] = [];
  for (const key of statKeys(candidate, worn)) {
    const to = statValue(candidate, key);
    const from = statValue(worn, key);
    if (to === undefined || from === undefined) { unknown.push(key); continue; }
    const diff = to - from;
    if (diff !== 0) delta[key] = diff;
  }
  return { delta, unknown: unknown.sort(), candidateStatsUnknown, replacesUnresolved: false };
}

/** Is the candidate better on ANY axis? Unknowns do not count as better. */
function betterOnSomeAxis(d: StatDelta): boolean {
  return Object.values(d.delta).some((v) => v > 0);
}

/**
 * Did we manage to compare every axis, on both sides?
 *
 * **Only a complete comparison may be used to REJECT a candidate**, and that
 * distinction is the whole of this function. `betterOnSomeAxis` reads `delta`
 * alone; a candidate whose entire gain sits on an axis the worn item does not
 * record has an empty `delta` and looks, to that test, exactly like a candidate
 * that is not better.
 *
 * Measured on the shipped bundle 2026-09-01: worn Banded Cloak `{AC:7}`,
 * candidate Mammoth Hide Cloak `{AC:7, WIS:4}` — equal AC, four more WIS, five
 * more cold resist — and `candidates()` returned **nothing**. The same item
 * against an empty slot returned the full `{AC:7, WIS:4, SV_COLD:5}`. Over
 * 220,430 same-slot pairs, 3,910 of 40,054 strictly-better pairs were dropped.
 *
 * The contract already said what should happen instead. `StatDelta.unknown`'s
 * own doc: a candidate with a non-empty `unknown` *"is offering an incomplete
 * comparison and **should rank below** an equal candidate whose comparison is
 * complete."* Rank below — not vanish. And the module note says **B does not
 * rank**; dropping a row is ranking it last, silently, in the one module whose
 * job is to enumerate and let E decide.
 *
 * `candidateStatsUnknown` and `replacesUnresolved` were already exempted at the
 * call site for exactly this reason. `unknown` is the third state of the same
 * kind and was the one nobody added.
 */
function comparisonIsComplete(d: StatDelta): boolean {
  return !d.candidateStatsUnknown && !d.replacesUnresolved && d.unknown.length === 0;
}

/**
 * A zone string the wiki wrote as a note rather than as a place.
 *
 * The same test as `pipeline/contamination.mjs` signature 11
 * `removed-from-game` — deliberately the same regex, not a paraphrase of it.
 * That scanner finds 1 record in the shipped catalogue: `Basoon Haste
 * Gauntlets`, whose `src.z` is `["ITEM REMOVED FROM GAME"]`.
 *
 * The payload keeps the note ON PURPOSE — the scanner's own `markRule` says
 * the wiki's note survives and is rendered as if it were a place you could go,
 * and making that visible is the point. **But it must not cross this seam.**
 * `zones` is the key =Lockouts looks a raid up by, and "ITEM REMOVED FROM
 * GAME" is not a raid; passing it would put a garbage key into another
 * session's lookup. Filtered here rather than in the payload, because the
 * payload's decision to show it is correct for a reader and wrong for a
 * machine.
 */
const NOT_A_PLACE = /removed from game/i;

/**
 * A mob name folded to a key another repository can join on.
 *
 * **Case only.** Measured 2026-09-01 over 2,315 distinct `src.m` strings:
 * **90 differ from another only by case** — `"a magician"` / `"A Magician"`,
 * `"The gnoll high shaman"` / `"the gnoll high shaman"`. EQ capitalises a
 * leading article line-initially and not mid-sentence, so the case is a
 * property of where the name was written down, not of the mob. Folding it is
 * lossless and it collapses one mob's two keys into one.
 *
 * **What is deliberately NOT folded: the leading article.** 35 further strings
 * differ only by `a` / `an` / `the` — `"a goblin warrior"` against
 * `"goblin warrior"` — and stripping it would be a claim that those name the
 * same creature. That is a mechanism claim about the game, and every reversal
 * this project logged last night was a mechanism claim. It is filed in
 * `docs/UNREPORTED-FINDINGS.md` as unresolved rather than silently merged.
 *
 * `mobs` keeps every string verbatim; this only ADDS a joinable key beside it,
 * so nothing a consumer already reads changes.
 */
function mobKey(name: string): string {
  return String(name).trim().toLowerCase();
}

function obtainability(item: Item, surveyed: Map<string, BisZoneSurvey>): {
  obtainable: Obtainable | 'not recorded';
  actionability: Actionability;
} {
  const src = item.src;
  const zones = (src?.z ?? []).filter((z) => !NOT_A_PLACE.test(String(z)));
  const mobs = src?.m ?? [];
  const quests = src?.q ?? [];
  const vendors = src?.v ?? [];
  const crafted = Boolean(src?.c);
  const measuredDrop = Array.isArray(item.ms) && item.ms.length > 0;

  if (!zones.length && !mobs.length && !quests.length && !vendors.length && !crafted && !measuredDrop) {
    return { obtainable: 'not recorded', actionability: 'no-source' };
  }
  const hit = zones.map((z) => surveyed.get(String(z).toLowerCase())).find((z) => z?.levels);
  return {
    obtainable: {
      zones, mobs, quests, vendors, crafted, measuredDrop,
      mobKeys: [...new Set(mobs.map(mobKey))],
      difficulty: null,
      zoneLevels: hit?.levels ?? null,
    },
    actionability: 'not-yet-asked',
  };
}

const POSITIONS_BY_TYPE = new Map<string, string[]>();
for (const position of SLOT_POSITIONS) {
  const bucket = POSITIONS_BY_TYPE.get(position.type) ?? [];
  bucket.push(position.id);
  POSITIONS_BY_TYPE.set(position.type, bucket);
}

/**
 * Every eligible item that beats what is worn, for every slot position.
 *
 * **Unordered.** The array order is an enumeration artefact — see the contract.
 */
/*
 * THE CONTRACT AND THIS FUNCTION AGREE, checked by `tsc` on every CI run.
 *
 * One line, and it earns its place: `CandidatesFn` declared a single `input`
 * parameter until 1 Sep while this function has always required the catalogue
 * as a second. Probed against the published bundle, not reasoned about —
 * `EQLS50Upgrades.candidates({...})` threw `TypeError: catalog is not
 * iterable`. A consumer writing to the contract exactly as published got a
 * crash, and nothing in the repository compared the two.
 *
 * With the type wrong, this assignment fails with the message that would have
 * prevented it: *"Target signature provides too few arguments. Expected 2 or
 * more, but got 1."* A type in one file and a function in another drift in
 * silence otherwise — the same shape as the fixture nothing loaded (R106).
 */
const _contractShape: CandidatesFn = candidates;
void _contractShape;

export function candidates(
  input: BisInput,
  catalog: readonly Item[],
  options: { byId?: Map<string, Item>; surveyedZones?: readonly BisZoneSurvey[] } = {},
): BisCandidate[] {
  const ctx: LoadoutContext = {
    classes: input.classes,
    race: input.race,
    // `levels` is unused by the predicates this module calls; the gate is
    // `input.level`. See `meetsSuppliedLevel`.
    levels: {} as LoadoutContext['levels'],
  };
  const surveyed = new Map<string, BisZoneSurvey>();
  for (const z of options.surveyedZones ?? []) surveyed.set(z.title.toLowerCase(), z);
  const byId = options.byId ?? new Map<string, Item>();

  const out: BisCandidate[] = [];
  for (const item of catalog) {
    // Ineligible items are not candidates, they are noise. Skipped rather than
    // flagged: the contract has no `eligible` field precisely so that an item
    // the trio cannot wear is UNREPRESENTABLE here rather than representable
    // and marked. A flag that can only hold one value is a control that cannot
    // fire -- see the note on `CandidatesFn`.
    if (!eligibility(item, ctx, input.level).eligible) continue;

    for (const slot of (item.sl ?? []) as (SlotType | 'ANY')[]) {
      for (const positionId of POSITIONS_BY_TYPE.get(slot) ?? []) {
        const wornId = input.currentGear[positionId] ?? null;
        // A named-but-unresolvable id is NOT an empty slot -- see `Worn`.
        const worn: Worn = wornId ? (byId.get(wornId) ?? 'unresolved') : null;
        if (worn !== 'unresolved' && worn && worn.n === item.n) continue; // already wearing it

        const d = statDelta(item, worn);
        // An item whose stats are entirely unrecorded is still a candidate:
        // dropping it would hide a real upgrade behind a data gap. It carries
        // `candidateStatsUnknown` and ranks in the unknown band.
        // An unresolved slot yields no positive axis by construction, so it is
        // kept for the same reason an unstatted candidate is: dropping it would
        // hide a real upgrade behind a data gap rather than naming the gap.
        // Reject only on a comparison we actually completed. See comparisonIsComplete.
        if (comparisonIsComplete(d) && !betterOnSomeAxis(d)) continue;

        const { obtainable, actionability } = obtainability(item, surveyed);
        out.push({
          slot,
          positionId,
          candidateItemId: item.id ?? null,
          candidateName: item.n,
          replacesItemId: worn === 'unresolved' ? null : (worn?.id ?? null),
          replacesName: worn === 'unresolved' ? null : (worn?.n ?? null),
          statDelta: d,
          obtainable,
          actionability,
          standing: item.sd ?? 'unattributed',
        });
      }
    }
  }
  return out;
}
