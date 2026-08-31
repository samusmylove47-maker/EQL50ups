/**
 * Exaltations — EverQuest Legends' augment system.
 *
 * Sockets are modelled as a function of an item's upgrade level. That is a
 * deliberate simplification, not a measured fact, and the distinction is
 * recorded here because it used to be stated the other way round.
 *
 * What is measured: the corpus carries socket data on exactly one of 11,375
 * items, and a live inventory export shows sub-slots appearing one per upgrade
 * level. Scoring that whole export rather than the four items originally quoted
 * — `node research/validation/audit_socket_ladder.mjs` — 0 of 119 `+N` items
 * unlock a socket earlier than this ladder predicts, but 9 are missing one it
 * predicts, always the click socket, and the discriminator is per-item rather
 * than per-tier. See `research/validation/TIER0-VALIDATION.md` §2.
 *
 * The simplification is kept on the player's standing ruling of 2026-08-16 —
 * *do not model this* — because the client counts sockets inconsistently and
 * the inconsistency is the game's, not a rule to reverse-engineer.
 */

import type { UpgradeState } from './upgrade';
import { normalizeState } from './upgrade';

export type ExaltationKind = 'ornamentation' | 'focus' | 'click' | 'worn' | 'proc';

export interface ExaltationSocket {
  kind: ExaltationKind;
  label: string;
  /** Upgrade tier at which this socket appears. */
  unlockTier: number;
  /** Numeric sub-slot id used by the client's inventory export. */
  exportSlot: number;
}

/**
 * The unlock ladder. Its **order and thresholds** are confirmed against the
 * client's item window ordering and against sub-slot numbering in an inventory
 * export; nothing in that export unlocks early. Its **completeness is not** —
 * nine items there lack a click socket this ladder gives them. See the module
 * comment above for the count and the command that produces it.
 *
 * Ornamentation is the odd one out: the socket exists from +0, but it is filled
 * with a Marketplace token rather than by transferring an effect, and it is
 * cosmetic only. It therefore contributes nothing to stats.
 */
export const EXALTATION_LADDER: readonly ExaltationSocket[] = [
  { kind: 'ornamentation', label: 'Ornamentation', unlockTier: 0, exportSlot: 2 },
  { kind: 'focus', label: 'Focus Exaltation', unlockTier: 1, exportSlot: 7 },
  { kind: 'click', label: 'Click Exaltation', unlockTier: 2, exportSlot: 8 },
  { kind: 'worn', label: 'Worn Exaltation', unlockTier: 3, exportSlot: 9 },
  { kind: 'proc', label: 'Proc Exaltation', unlockTier: 4, exportSlot: 10 },
];

/** Sockets available on an item at a given upgrade state. */
export function socketsFor(state: UpgradeState): ExaltationSocket[] {
  const { full } = normalizeState(state);
  return EXALTATION_LADDER.filter((s) => full >= s.unlockTier);
}

/** Sockets that actually affect stats — everything but the cosmetic slot. */
export function functionalSocketsFor(state: UpgradeState): ExaltationSocket[] {
  return socketsFor(state).filter((s) => s.kind !== 'ornamentation');
}

/** The effect kinds an item can donate, keyed by the socket they fill. */
export const EFFECT_KIND_TO_SOCKET: Record<string, ExaltationKind> = {
  focus: 'focus',
  click: 'click',
  worn: 'worn',
  proc: 'proc',
  combat: 'proc',
};

export interface ExaltationSource {
  itemName: string;
  kind: ExaltationKind;
  effectName: string;
  detail?: string;
  /** Restrictions inherited from the donor item. */
  classes: string[];
  slots: string[];
}

/**
 * Whether a donor exaltation may be socketed into a host item.
 * The wiki's stated rule is a shared slot plus at least one shared class.
 */
export function canSocket(
  source: Pick<ExaltationSource, 'classes' | 'slots'>,
  host: { classes: string[]; slots: string[] },
): boolean {
  const shareSlot =
    source.slots.length === 0 ||
    host.slots.length === 0 ||
    source.slots.some((s) => host.slots.includes(s));
  if (!shareSlot) return false;

  const sourceAll = source.classes.length === 0 || source.classes.includes('ALL');
  const hostAll = host.classes.length === 0 || host.classes.includes('ALL');
  if (sourceAll || hostAll) return true;
  return source.classes.some((c) => host.classes.includes(c));
}

/**
 * A socketed exaltation intersects its own restrictions onto the host, which
 * can narrow the host out of slots or classes it previously qualified for.
 */
export function intersectRestrictions(
  host: { classes: string[]; slots: string[] },
  sources: ReadonlyArray<Pick<ExaltationSource, 'classes' | 'slots'>>,
): { classes: string[]; slots: string[] } {
  let classes = [...host.classes];
  let slots = [...host.slots];

  for (const src of sources) {
    if (src.classes.length && !src.classes.includes('ALL')) {
      classes = classes.includes('ALL')
        ? [...src.classes]
        : classes.filter((c) => src.classes.includes(c));
    }
    if (src.slots.length) {
      slots = slots.length ? slots.filter((s) => src.slots.includes(s)) : [...src.slots];
    }
  }
  return { classes, slots };
}

/**
 * "Only the highest rank in a family counts; ranks do not add up."
 *
 * This app applies that rule — `dedupeByFamily` below, and the "does not count"
 * lines on the Exaltations tab. It is stated here because **its standing is the
 * weakest of any rule this engine enforces**, and a Tier 5 rule applied silently
 * is indistinguishable from a fact.
 *
 * Where it comes from, in full. `research/github-data-inventory.md`:
 *
 *   "**Exaltations do not stack** — only the highest rank in a family counts …
 *   *(This no-stack claim is sourced to Thiole's reading of the wiki; jmoyers
 *   does not restate it.)*"
 *
 * Three things about that provenance, none of them comfortable:
 *
 * 1. **One community author's reading of a wiki page** — Tier 5 under
 *    `research/SOURCING-STANDARD.md`, which warns that large parts of that wiki
 *    are "a Project 1999 import, sometimes word for word". Uncorroborated: the
 *    second tool covering the same ground does not restate it.
 * 2. **The same file disowns that author.** `github-data-inventory.md` ends its
 *    scaling section "**Use jmoyers. Do not use Thiole's math.**", written after
 *    documenting that this author's model was wrong in three ways and had
 *    negative stats backwards. We ruled the source unreliable for arithmetic and
 *    then took its stacking rule without comment.
 * 3. **It is classic EverQuest's focus-effect rule, down to the family names.**
 *    `Improved Damage`, `Mana Preservation`, `Reagent Conservation` are original
 *    -EQ focus families and "same type does not stack, one applies" is original
 *    -EQ behaviour. That is the shape this repository exists to catch: a rule
 *    everybody repeats because that is how the old game worked.
 *
 * Nothing in this repository has observed it. No capture in
 * `research/validation/TIER0-VALIDATION.md` shows two same-family effects on one
 * character. The alternative — letting them stack — is not a neutral fallback
 * either; it is the other candidate answer, asserted. So the corroborated one is
 * applied and **marked**, and `research/validation/CAPTURE-REQUESTS.md` §1 names
 * the single screenshot that would end the argument either way.
 *
 * Note also what is applied beyond what is even claimed: the sourced sentence is
 * about *focus* effects, and `selectors/exaltations.ts` pools all four socket
 * kinds into one call, so a worn effect and a focus effect of one family compete.
 * No source says they do. That widening is unsourced on top of a Tier 5 rule and
 * is not separately marked, because it cannot be settled separately — the same
 * capture answers both.
 */
export const EXALTATION_STACKING = {
  /** Chip text wherever an effect is struck out. */
  chip: 'Tier 5 rule',
  rule: 'Only the highest rank in a family counts. Ranks do not add up.',
  short:
    'Whether same-family exaltations stack is unsettled. The no-stack rule comes from one community author’s reading of a wiki this project treats as partly a Project 1999 import, is not restated by the second tool covering the same ground, and matches classic EverQuest exactly — which is corroboration by inheritance, not observation.',
  standing:
    'Assumed, not measured. Tier 5, single-source, from an author this repository disowns by name for arithmetic, and never observed in the running client.',
  /** The contamination page's device: name the evidence that would end it. */
  settle:
    'Three readings settle it, and the character in our own client export already holds both items: the Stats window’s Spell Damage with neither Burning Affliction socketed, with one, and with both. research/validation/CAPTURE-REQUESTS.md §1 is the instruction, including what it means if the field does not move at all.',
} as const;

const ROMAN: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6 };

/**
 * A trailing integer that names a *level* is not a rank.
 *
 * Two forms occur in the shipped catalog — `Complete Healing as Level 20` (14
 * names) and `Allure of Death req. level 20` (1) — and in both the number is a
 * cast or requirement level printed as part of the effect's name. Reading it as
 * a rank would assert that two clickies of one spell at different cast levels
 * supersede one another, which nobody has observed and which is not even what
 * the stacking rule is about. One rule covers both: the word `level` before the
 * number means the number is a level.
 *
 * Measured, not guessed: `node` over `web/public/data/items/*.json` finds 401
 * distinct effect names, of which exactly these 15 end in an integer preceded by
 * `level`, and 14 more end in a bare integer — the bard resonances.
 */
const LEVEL_SUFFIX = /\blevel\s+\d+$/i;

/**
 * Split an effect name into its family and its rank.
 *
 * **The client prints two rank notations, four lines apart in the one capture we
 * have** (`research/validation/TIER0-VALIDATION.md:143-144`):
 *
 *     Focus Effect: String Resonance 11
 *     Click Effect: Rune IV (Must Equip)
 *
 * This read Roman numerals only, so `Wind Resonance 11` became a family of its
 * own at rank 1 and the five ranks of one bard focus in the catalog — 0, 10, 11,
 * 12, 14 — all survived side by side while `Improved Healing I/II/III` collapsed
 * to one. That is wrong under *either* answer to the stacking question, which is
 * why it is fixed here and separately from `EXALTATION_STACKING` above: the
 * parse is a reading of the client's own notation, not a claim about the game.
 */
export function parseEffectRank(name: string): { family: string; rank: number } {
  const trimmed = name.trim();
  if (LEVEL_SUFFIX.test(trimmed)) return { family: trimmed, rank: 1 };

  const match = /^(.*?)\s+(I{1,3}|IV|VI?|\d+)$/.exec(trimmed);
  const stem = match?.[1];
  const suffix = match?.[2];
  if (!stem || !suffix) return { family: trimmed, rank: 1 };
  return { family: stem, rank: suffix in ROMAN ? (ROMAN[suffix] as number) : Number(suffix) };
}

/**
 * Collapse a set of effects to the highest rank within each family.
 *
 * The rule it applies is `EXALTATION_STACKING`, whose standing is stated there.
 * Ties keep the first: two sockets holding the *same* effect name are one
 * family at one rank, so the family counts once — and the caller distinguishes
 * that case, because "X does not count, X is the higher rank" is not a sentence
 * a reader can act on.
 */
export function dedupeByFamily<T extends { effectName: string }>(effects: readonly T[]): T[] {
  const best = new Map<string, { rank: number; item: T }>();
  for (const e of effects) {
    const { family, rank } = parseEffectRank(e.effectName);
    const current = best.get(family);
    if (!current || rank > current.rank) best.set(family, { rank, item: e });
  }
  return [...best.values()].map((v) => v.item);
}
