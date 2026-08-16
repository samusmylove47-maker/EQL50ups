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

import { ARMOR_TIER, CLASSES, CLASS_SET, type ClassCode } from './constants';

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

function isUnrestricted(list: string[]): boolean {
  return list.length === 0 || list.includes('ALL');
}

/**
 * `ALL_EXCEPT` marks a list whose remaining entries are exclusions rather than
 * inclusions, mirroring the wiki's "ALL except X" phrasing.
 */
function matchesList(list: string[], candidates: readonly string[]): boolean {
  if (isUnrestricted(list)) return true;
  if (list.includes('NONE')) return false;

  if (list.includes('ALL_EXCEPT')) {
    const excluded = list.filter((v) => v !== 'ALL_EXCEPT');
    return candidates.some((c) => !excluded.includes(c));
  }
  return candidates.some((c) => list.includes(c));
}

/** An item is usable when any one of the loadout's classes qualifies. */
export function canUseClass(
  item: Pick<ItemRestrictions, 'classes'>,
  ctx: LoadoutContext,
): boolean {
  return matchesList(item.classes, ctx.classes);
}

export function canUseRace(item: Pick<ItemRestrictions, 'races'>, ctx: LoadoutContext): boolean {
  if (isUnrestricted(item.races)) return true;
  // `NONE` excludes every race, so it refuses whether or not we know theirs.
  // Skipping that check when the race is unset made the same item appear or
  // vanish depending on a field the restriction does not depend on.
  if (item.races.includes('NONE')) return false;
  if (!ctx.race) return true; // race unset: don't narrow on it
  return matchesList(item.races, [ctx.race]);
}

/** Which of the loadout's classes make a given item usable. */
export function qualifyingClasses(
  item: Pick<ItemRestrictions, 'classes'>,
  ctx: LoadoutContext,
): ClassCode[] {
  if (isUnrestricted(item.classes)) return [...ctx.classes];
  if (item.classes.includes('ALL_EXCEPT')) {
    const excluded = item.classes.filter((v) => v !== 'ALL_EXCEPT');
    return ctx.classes.filter((c) => !excluded.includes(c));
  }
  return ctx.classes.filter((c) => item.classes.includes(c));
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
 * qualifying class wins, which is the same "best of the trio" rule armour
 * proficiency already follows.
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
 * Armor proficiency follows the highest tier among the loadout's classes, so a
 * plate class anywhere in the trio opens plate to the whole combination.
 */
export function armorTier(ctx: LoadoutContext): number {
  return ctx.classes.reduce((best, c) => Math.max(best, ARMOR_TIER[c] ?? 0), 0);
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
