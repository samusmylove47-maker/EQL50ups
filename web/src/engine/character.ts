/**
 * Character model and item eligibility.
 *
 * The defining difference from a single-class planner: a character runs up to
 * three simultaneous classes, so eligibility is a union and proficiency caps
 * take the best of the three.
 */

import { ARMOR_TIER, CLASS_SET, type ClassCode } from './constants';

export interface Character {
  id: string;
  name: string;
  level: number;
  /** Primary first. One to three classes. */
  classes: ClassCode[];
  /** Race code as it appears in item restrictions, or null if unset. */
  race: string | null;
}

/** Formats the header the way the client does: `50 BRD/WAR/BER`. */
export function describeCharacter(c: Pick<Character, 'level' | 'classes'>): string {
  return `${c.level} ${c.classes.join('/')}`;
}

export interface ItemRestrictions {
  classes: string[];
  races: string[];
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

/** An item is usable when any one of the character's classes qualifies. */
export function canUseClass(item: Pick<ItemRestrictions, 'classes'>, character: Character): boolean {
  return matchesList(item.classes, character.classes);
}

export function canUseRace(item: Pick<ItemRestrictions, 'races'>, character: Character): boolean {
  if (isUnrestricted(item.races)) return true;
  // `NONE` excludes every race, so it refuses whether or not we know theirs.
  // Skipping that check when the race is unset made the same item appear or
  // vanish depending on a field the restriction does not depend on.
  if (item.races.includes('NONE')) return false;
  if (!character.race) return true; // race unset: don't narrow on it
  return matchesList(item.races, [character.race]);
}

export function canUse(item: ItemRestrictions, character: Character): boolean {
  return canUseClass(item, character) && canUseRace(item, character);
}

/**
 * Armor proficiency follows the highest tier among the three classes, so a
 * plate class anywhere in the trio opens plate to the whole combination.
 */
export function armorTier(character: Character): number {
  return character.classes.reduce((best, c) => Math.max(best, ARMOR_TIER[c] ?? 0), 0);
}

/** Which of the character's classes make a given item usable. */
export function qualifyingClasses(
  item: Pick<ItemRestrictions, 'classes'>,
  character: Character,
): ClassCode[] {
  if (isUnrestricted(item.classes)) return [...character.classes];
  if (item.classes.includes('ALL_EXCEPT')) {
    const excluded = item.classes.filter((v) => v !== 'ALL_EXCEPT');
    return character.classes.filter((c) => !excluded.includes(c));
  }
  return character.classes.filter((c) => item.classes.includes(c));
}

export function isValidClassCode(value: string): value is ClassCode {
  return CLASS_SET.has(value);
}

/** A trio must be one to three distinct, real classes. */
export function validateClasses(classes: string[]): { ok: boolean; error?: string } {
  if (classes.length === 0) return { ok: false, error: 'Choose at least one class.' };
  if (classes.length > 3) return { ok: false, error: 'A character has at most three classes.' };
  if (new Set(classes).size !== classes.length) {
    return { ok: false, error: 'Classes must be distinct.' };
  }
  const bad = classes.find((c) => !isValidClassCode(c));
  if (bad) return { ok: false, error: `Unknown class "${bad}".` };
  return { ok: true };
}
