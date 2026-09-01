/**
 * Character model and item eligibility.
 *
 * Reworked against Tier 0 evidence (the client's Loadouts tab, recorded in
 * `research/validation/TIER0-VALIDATION.md` §6). Two things the earlier model
 * got wrong:
 *
 *  1. **Every class has its own level.** The sampled character reads Bard 50,
 *     Berserker 50, Warrior 50, Monk 36, Druid 36, Shadow Knight 36, Paladin
 *     21, Magician 11 and 10 for the rest. A character levels all sixteen
 *     classes, not just the three it is currently running.
 *  2. **A character holds several named loadouts**, each a race plus a primary
 *     class and two secondaries, one of them active. Switching loadout changes
 *     which items are usable without changing the character.
 *
 * The consequence for a planner is the one the client's own item windows imply:
 * an item's level requirement is checked against the level of the class that
 * *qualifies* you for it. If a greatsword is usable because you are a Warrior,
 * it is your Warrior level the requirement must clear — your Bard 50 does not
 * pay for it.
 */

import { CLASSES, CLASS_SET, type ClassCode } from './constants';

/** Level every class starts at until the player says otherwise. */
export const DEFAULT_CLASS_LEVEL = 1;

/** Level of all sixteen classes. Always complete — no holes to guard against. */
export type ClassLevels = Record<ClassCode, number>;

/**
 * One selectable class combination.
 *
 * `race` is present because the client attaches race to the loadout rather
 * than to the character; it is optional here and falls back to the character's
 * own race, which is what almost every planner user will want.
 */
export interface Loadout {
  id: string;
  name: string;
  /** Primary first, then up to two secondaries. */
  classes: ClassCode[];
  race?: string | null;
}

export interface Character {
  id: string;
  name: string;
  /** Default race, used by any loadout that does not override it. */
  race: string | null;
  levels: ClassLevels;
  loadouts: Loadout[];
  activeLoadoutId: string;
}

/** A complete level map, filled from a partial one. */
export function makeLevels(partial?: Partial<Record<string, number>>): ClassLevels {
  const out = {} as ClassLevels;
  for (const code of CLASSES) {
    out[code] = clampLevel(partial?.[code] ?? DEFAULT_CLASS_LEVEL);
  }
  return out;
}

export function clampLevel(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_CLASS_LEVEL;
  return Math.max(1, Math.min(255, Math.round(n)));
}

/**
 * Everything eligibility depends on, detached from identity and persistence.
 *
 * Screens that filter items for something other than a saved character — the
 * item browser's class filter, a test fixture — build one of these directly
 * rather than faking a whole Character.
 */
export interface LoadoutContext {
  classes: ClassCode[];
  race: string | null;
  levels: ClassLevels;
}

export function makeContext(
  classes: ClassCode[],
  race: string | null = null,
  levels?: Partial<Record<string, number>>,
): LoadoutContext {
  return { classes: [...classes], race, levels: makeLevels(levels) };
}

export function activeLoadout(character: Character): Loadout | undefined {
  return (
    character.loadouts.find((l) => l.id === character.activeLoadoutId) ?? character.loadouts[0]
  );
}

export function loadoutClasses(character: Character): ClassCode[] {
  return activeLoadout(character)?.classes ?? [];
}

/** The race in force: the active loadout's, or the character's own. */
export function activeRace(character: Character): string | null {
  const loadout = activeLoadout(character);
  return loadout?.race !== undefined && loadout.race !== null ? loadout.race : character.race;
}

/** Eligibility context for the character's active loadout. */
export function activeContext(character: Character): LoadoutContext {
  return {
    classes: loadoutClasses(character),
    race: activeRace(character),
    levels: character.levels,
  };
}

/** Eligibility context for any loadout, active or not — used to preview a switch. */
export function contextForLoadout(character: Character, loadout: Loadout): LoadoutContext {
  return {
    classes: [...loadout.classes],
    race: loadout.race !== undefined && loadout.race !== null ? loadout.race : character.race,
    levels: character.levels,
  };
}

/**
 * The loadout a saved plan belongs to.
 *
 * A gear set is a plan for one class combination, not for a character in the
 * abstract: a Berserker-only breastplate belongs to the BER trio and is dead
 * weight under a CLR/DRU/SHM one. Binding eligibility to whichever loadout
 * happened to be *active* meant switching loadouts silently re-judged every
 * saved set, and a compare of two sets built for two different trios printed
 * the same trio on both sides.
 *
 * `loadoutId` is optional because sets saved before this existed carry none,
 * and because a set whose loadout has since been deleted must still open. Both
 * fall back to the active loadout, which is what those sets were implicitly
 * scored against all along — so the fallback is the old behaviour exactly,
 * not a guess.
 */
export function loadoutFor(character: Character, loadoutId?: string): Loadout | undefined {
  if (loadoutId) {
    const named = character.loadouts.find((l) => l.id === loadoutId);
    if (named) return named;
  }
  return activeLoadout(character);
}

/** Eligibility context for a saved plan, by the loadout it was planned for. */
export function contextFor(character: Character, loadoutId?: string): LoadoutContext {
  const loadout = loadoutFor(character, loadoutId);
  return loadout ? contextForLoadout(character, loadout) : activeContext(character);
}

/**
 * How a saved plan's class combination reads in a header: `50 BRD/WAR/BER`.
 *
 * Distinct from `describeCharacter`, which always speaks for the active
 * loadout. Two sets side by side must each name their own.
 */
export function describeFor(character: Character, loadoutId?: string): string {
  const loadout = loadoutFor(character, loadoutId);
  return loadout ? describeLoadout(character, loadout) : describeCharacter(character);
}

export function levelOf(levels: ClassLevels, code: ClassCode): number {
  return levels[code] ?? DEFAULT_CLASS_LEVEL;
}

/** The level the header shows: that of the active loadout's primary class. */
export function primaryLevel(character: Character): number {
  const primary = loadoutClasses(character)[0];
  return primary ? levelOf(character.levels, primary) : DEFAULT_CLASS_LEVEL;
}

/**
 * Formats the header the way the client does: `50 BRD/WAR/BER`, where the
 * number is the *primary* class's level rather than a character-wide one.
 */
export function describeCharacter(character: Character): string {
  const classes = loadoutClasses(character);
  if (!classes.length) return `${DEFAULT_CLASS_LEVEL}`;
  return `${primaryLevel(character)} ${classes.join('/')}`;
}

/** The same string for a loadout that is not (yet) the active one. */
export function describeLoadout(character: Character, loadout: Loadout): string {
  const primary = loadout.classes[0];
  const level = primary ? levelOf(character.levels, primary) : DEFAULT_CLASS_LEVEL;
  return loadout.classes.length ? `${level} ${loadout.classes.join('/')}` : `${level}`;
}

export interface ItemRestrictions {
  classes: string[];
  races: string[];
  /** Required level, where the catalog carries one. */
  rl?: number;
}

function isUnrestricted(list: readonly string[]): boolean {
  return list.length === 0 || list.includes('ALL');
}

/**
 * What a `cl` or `ra` list is actually saying.
 *
 * `ALL` and `NONE` and `ALL_EXCEPT` are sentinels this catalog writes *inside*
 * the list, so a consumer that treats the list as a plain vocabulary is wrong
 * in a way that reads perfectly. `ALL_EXCEPT` in particular marks a list whose
 * remaining entries are **exclusions**, mirroring the wiki's "ALL except X"
 * phrasing — and `blockReason.ts` rendered it with `join(', ')` for months,
 * telling readers of 255 class-restricted and 59 race-restricted records the
 * exact opposite of who may wear the item, with a non-existent class named
 * first.
 *
 * This exists so that the sentence a reader sees and the gate that refuses them
 * read the *same* ladder, in the same precedence, and cannot drift: `ALL`
 * before `NONE` before `ALL_EXCEPT` before a plain list. Every eligibility
 * check below goes through it, so there is one copy of that order.
 */
export type RestrictionReading =
  | { kind: 'unrestricted' }
  | { kind: 'none' }
  /** `codes` are barred; everything else qualifies. Empty means nothing is barred. */
  | { kind: 'except'; codes: string[] }
  /** `codes` are the only ones that qualify. */
  | { kind: 'only'; codes: string[] };

export function readRestriction(list: readonly string[]): RestrictionReading {
  if (isUnrestricted(list)) return { kind: 'unrestricted' };
  if (list.includes('NONE')) return { kind: 'none' };
  if (list.includes('ALL_EXCEPT')) {
    return { kind: 'except', codes: list.filter((v) => v !== 'ALL_EXCEPT') };
  }
  return { kind: 'only', codes: [...list] };
}

function matchesList(list: readonly string[], candidates: readonly string[]): boolean {
  const reading = readRestriction(list);
  switch (reading.kind) {
    case 'unrestricted':
      return true;
    case 'none':
      return false;
    case 'except':
      return candidates.some((c) => !reading.codes.includes(c));
    case 'only':
      return candidates.some((c) => reading.codes.includes(c));
  }
}

/** An item is usable when any one of the loadout's classes qualifies. */
export function canUseClass(
  item: Pick<ItemRestrictions, 'classes'>,
  ctx: LoadoutContext,
): boolean {
  return matchesList(item.classes, ctx.classes);
}

export function canUseRace(item: Pick<ItemRestrictions, 'races'>, ctx: LoadoutContext): boolean {
  const reading = readRestriction(item.races);
  if (reading.kind === 'unrestricted') return true;
  // `NONE` excludes every race, so it refuses whether or not we know theirs.
  // Skipping that check when the race is unset made the same item appear or
  // vanish depending on a field the restriction does not depend on.
  if (reading.kind === 'none') return false;
  if (!ctx.race) return true; // race unset: don't narrow on it
  return matchesList(item.races, [ctx.race]);
}

/** Which of the loadout's classes make a given item usable. */
export function qualifyingClasses(
  item: Pick<ItemRestrictions, 'classes'>,
  ctx: LoadoutContext,
): ClassCode[] {
  const reading = readRestriction(item.classes);
  switch (reading.kind) {
    case 'unrestricted':
      return [...ctx.classes];
    // No class qualifies, which is what the old code arrived at by filtering
    // the trio against a list whose only member was the sentinel `NONE`.
    case 'none':
      return [];
    case 'except':
      return ctx.classes.filter((c) => !reading.codes.includes(c));
    case 'only':
      return ctx.classes.filter((c) => reading.codes.includes(c));
  }
}

export interface LevelCheck {
  /** The item's requirement, 0 when it has none. */
  required: number;
  /** Highest level among the classes that qualify for the item. */
  best: number;
  /** The qualifying class supplying `best`, if any. */
  via: ClassCode | null;
  ok: boolean;
}

/**
 * Level requirement, judged against the *qualifying* class.
 *
 * A trio of Bard 50 / Warrior 12 / Berserker 50 does not get to wear a
 * Warrior-only level-40 item: only the Warrior qualifies, and the Warrior is
 * level 12. Where an item is open to more than one of the three, the highest
 * qualifying class wins.
 *
 * **What that last sentence rests on, now that its precedent is gone.** It used
 * to end "…which is the same 'best of the trio' rule armour proficiency already
 * follows". `ARMOR_TIER` was deleted on 2026-08-31 as an unsourced invention, so
 * that clause is withdrawn rather than reworded — it was one unsourced rule
 * citing another, and deleting the cited one leaves the citation with nothing
 * under it.
 *
 * What remains under it is weaker, and is stated here rather than implied:
 *
 *  - **The qualifying-class half is a planner inference, not an observation.**
 *    `research/validation/TIER0-VALIDATION.md:131-133` says *"Planner
 *    consequence: … item level requirements **should** be checked against the
 *    level of the *qualifying* class."* "Should" and "consequence" — a design
 *    reading of the Loadouts screenshot, not a reading of an item window.
 *  - **The highest-of-the-qualifiers half is contradicted by this project's own
 *    research.** `research/eql-game-systems.md:279` records as *confirmed* that
 *    a character's **effective level is the lowest of the three class levels**.
 *    That note is about effective level rather than about an item requirement,
 *    so it is not decisive — but it points the other way and nobody has
 *    reconciled them.
 *  - **It is not established that Legends gates equipping by level at all.** The
 *    only Tier M sighting of "Required Level" in this repository is on a *click
 *    effect* (`TIER0-VALIDATION.md:145`), not on wearing the item.
 *
 * **Blast radius today is three records.** Exactly 3 of 3,663 carry `rl`. The
 * choice is dormant, and it should stay written down rather than settled by
 * argument: whichever way it goes, it wants a capture, and a patch that
 * populates `rl` turns it live on every list at once.
 */
export function levelCheck(item: ItemRestrictions, ctx: LoadoutContext): LevelCheck {
  const required = Number.isFinite(item.rl) ? Math.max(0, Math.trunc(item.rl as number)) : 0;
  const qualifying = qualifyingClasses(item, ctx);
  let best = 0;
  let via: ClassCode | null = null;
  for (const code of qualifying) {
    const level = levelOf(ctx.levels, code);
    if (level > best) {
      best = level;
      via = code;
    }
  }
  // An unrestricted item with no qualifying class list still has to clear its
  // requirement somehow; fall back to the best level in the loadout.
  if (!qualifying.length) {
    for (const code of ctx.classes) {
      const level = levelOf(ctx.levels, code);
      if (level > best) {
        best = level;
        via = code;
      }
    }
  }
  return { required, best, via, ok: required === 0 || best >= required };
}

export function meetsLevel(item: ItemRestrictions, ctx: LoadoutContext): boolean {
  return levelCheck(item, ctx).ok;
}

export function canUse(item: ItemRestrictions, ctx: LoadoutContext): boolean {
  return canUseClass(item, ctx) && canUseRace(item, ctx) && meetsLevel(item, ctx);
}

/**
 * "Can this character actually swing a weapon in the offhand?"
 *
 * **Two rules wear one name, and only one of them is ours to enforce.**
 *
 * *The item rule is Tier M and this app already applies it:* unless a weapon
 * lists SECONDARY it cannot be held in the offhand. The owner corrected that
 * directly, and it is enforced here by construction rather than by a check —
 * `data/catalog.ts` indexes items into `bySlot` straight off `item.sl`, so a
 * weapon is only ever offered for a slot it lists. Measured: **219 PRIMARY-only
 * weapons, none of which lists SECONDARY.**
 *
 * *The class rule is Tier 5 and this app deliberately does NOT enforce it.*
 * Classic EverQuest gated Dual Wield by class, and the obvious thing is to carry
 * that table over. Session E audited exactly that and concluded against it: the
 * rule is inherited from classic, is unmeasured on Legends, no log in 138 shows
 * a two-handed primary, and eqlwiki's Dual Wield section presumes the rule
 * without ever stating it. **A hard gate built on that would refuse equipment
 * the game may well allow**, which is a worse failure than the one it prevents —
 * an item silently missing from a list cannot be argued with.
 *
 * **So this is a mark, not a gate**, and the distinction is the whole point:
 * `canUse` above is unchanged and nothing is filtered. The reader is told the
 * class rule is unsettled and left to decide.
 *
 * The correction that produced this is worth keeping attached. I first reported
 * the absent gate as a defect in this engine — which took the classic table as
 * ground truth and marked the engine down for not implementing it. That is the
 * same inherited-rule fault this project exists to catch, committed inside an
 * audit for it.
 */
export const DUAL_WIELD_STANDING = {
  /** Chip text wherever an offhand weapon is shown. */
  chip: 'Tier 5 rule',
  rule: 'Whether every class may wield a weapon in the offhand is unsettled.',
  short:
    'This app does not check whether your classes can dual wield. Classic EverQuest gated it by class, but nothing has measured that rule on Legends, and refusing an item the game may allow is worse than showing one it may not. The slot rule — a weapon must list Secondary to go there — is confirmed and is applied.',
  standing:
    'Assumed by others, not measured here. Tier 5: inherited from classic EverQuest, presumed rather than stated by the wiki, and absent from 138 logs. Deliberately not enforced.',
  settle:
    'One log line or screenshot of a character with no dual-wield class equipping a weapon in Secondary settles it — and so does one of the client refusing to let them. research/validation/CAPTURE-REQUESTS.md §2 is the instruction.',
} as const;

/**
 * Whether the offhand advisory applies to this item: it is a weapon, and it can
 * go in the offhand. A shield or a held item in Secondary is not dual wielding
 * and the question does not arise for it.
 */
export function offhandAdvisoryApplies(item: { sl: string[]; wp?: unknown }): boolean {
  return Boolean(item.wp) && item.sl.includes('SECONDARY');
}

export function isValidClassCode(value: string): value is ClassCode {
  return CLASS_SET.has(value);
}

/** A loadout must be one to three distinct, real classes. */
export function validateClasses(classes: string[]): { ok: boolean; error?: string } {
  if (classes.length === 0) return { ok: false, error: 'Choose at least one class.' };
  if (classes.length > 3) return { ok: false, error: 'A loadout has at most three classes.' };
  if (new Set(classes).size !== classes.length) {
    return { ok: false, error: 'Classes must be distinct.' };
  }
  const bad = classes.find((c) => !isValidClassCode(c));
  if (bad) return { ok: false, error: `Unknown class "${bad}".` };
  return { ok: true };
}

/** Default name for the nth loadout, matching the client's numbered list. */
export function defaultLoadoutName(index: number): string {
  return `Loadout ${index + 1}`;
}

export interface BuildCharacterInput {
  id: string;
  name: string;
  classes: ClassCode[];
  race?: string | null;
  /** Level for the chosen classes; everything else starts at the floor. */
  level?: number;
  /** Explicit per-class levels, which win over `level`. */
  levels?: Partial<Record<string, number>>;
  loadoutId?: string;
  loadoutName?: string;
}

/**
 * A one-loadout character built from the fields the creation screen collects.
 * Shared by the store and by tests so both agree on what a new character is.
 */
export function buildCharacter(input: BuildCharacterInput): Character {
  const levels: Partial<Record<string, number>> = { ...input.levels };
  for (const code of input.classes) {
    levels[code] ??= clampLevel(input.level ?? DEFAULT_CLASS_LEVEL);
  }
  const loadout: Loadout = {
    id: input.loadoutId ?? `${input.id}_loadout_1`,
    name: input.loadoutName ?? defaultLoadoutName(0),
    classes: [...input.classes],
  };
  return {
    id: input.id,
    name: input.name,
    race: input.race ?? null,
    levels: makeLevels(levels),
    loadouts: [loadout],
    activeLoadoutId: loadout.id,
  };
}
