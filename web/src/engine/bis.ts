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
 *    `null` and unknown actionability is `'unknown'`, never `false`.
 */

import { SLOT_POSITIONS, type SlotType } from './constants';
import { canUseClass, canUseRace, type LoadoutContext } from './character';
import type { Item } from './types';
import type {
  Actionability, BisCandidate, BisInput, Obtainable, StatDelta,
} from './bis-contract';

/** Zone survey rows, as `meta.zones.surveyed` publishes them. */
export interface ZoneSurvey {
  title: string;
  levels?: string;
}

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
export function statDelta(candidate: Item, worn: Item | null): StatDelta {
  const candidateStatsUnknown = Boolean(candidate.statsUnknown)
    || (!Object.keys(candidate.st ?? {}).length && !Object.keys(candidate.sv ?? {}).length);

  const delta: Record<string, number> = {};
  const unknown: string[] = [];
  for (const key of statKeys(candidate, worn)) {
    const to = statValue(candidate, key);
    const from = statValue(worn, key);
    if (to === undefined || from === undefined) { unknown.push(key); continue; }
    const diff = to - from;
    if (diff !== 0) delta[key] = diff;
  }
  return { delta, unknown: unknown.sort(), candidateStatsUnknown };
}

/** Is the candidate better on ANY axis? Unknowns do not count as better. */
function betterOnSomeAxis(d: StatDelta): boolean {
  return Object.values(d.delta).some((v) => v > 0);
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

function obtainability(item: Item, surveyed: Map<string, ZoneSurvey>): {
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
      difficulty: null,
      zoneLevels: hit?.levels ?? null,
    },
    actionability: 'unknown',
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
export function candidates(
  input: BisInput,
  catalog: readonly Item[],
  options: { byId?: Map<string, Item>; surveyedZones?: readonly ZoneSurvey[] } = {},
): BisCandidate[] {
  const ctx: LoadoutContext = {
    classes: input.classes,
    race: input.race,
    // `levels` is unused by the predicates this module calls; the gate is
    // `input.level`. See `meetsSuppliedLevel`.
    levels: {} as LoadoutContext['levels'],
  };
  const surveyed = new Map<string, ZoneSurvey>();
  for (const z of options.surveyedZones ?? []) surveyed.set(z.title.toLowerCase(), z);
  const byId = options.byId ?? new Map<string, Item>();

  const out: BisCandidate[] = [];
  for (const item of catalog) {
    const { eligible, reason } = eligibility(item, ctx, input.level);
    if (!eligible) continue; // ineligible items are not candidates, they are noise

    for (const slot of (item.sl ?? []) as (SlotType | 'ANY')[]) {
      for (const positionId of POSITIONS_BY_TYPE.get(slot) ?? []) {
        const wornId = input.currentGear[positionId] ?? null;
        const worn = wornId ? byId.get(wornId) ?? null : null;
        if (worn && worn.n === item.n) continue; // already wearing it

        const d = statDelta(item, worn);
        // An item whose stats are entirely unrecorded is still a candidate:
        // dropping it would hide a real upgrade behind a data gap. It carries
        // `candidateStatsUnknown` and ranks in the unknown band.
        if (!d.candidateStatsUnknown && !betterOnSomeAxis(d)) continue;

        const { obtainable, actionability } = obtainability(item, surveyed);
        out.push({
          slot,
          positionId,
          candidateItemId: item.id ?? null,
          candidateName: item.n,
          replacesItemId: worn?.id ?? null,
          replacesName: worn?.n ?? null,
          statDelta: d,
          obtainable,
          actionability,
          eligible: true,
          eligibilityReason: reason,
          standing: item.sd ?? 'unattributed',
        });
      }
    }
  }
  return out;
}
