/**
 * Eligibility.
 *
 * A character runs up to three classes at once, so an item is usable when
 * **any one** of them qualifies — a union, not an intersection. Getting that
 * backwards would hide most of a multiclass character's gear, so every
 * restriction shape the catalog actually ships is pinned here:
 * `ALL` (4,945 rows), an explicit list (5,803), `ALL_EXCEPT` (944),
 * an empty list (439) and `NONE` (245).
 */

import { describe, expect, it } from 'vitest';
import {
  armorTier, canUse, canUseClass, canUseRace, describeCharacter,
  qualifyingClasses, validateClasses, type Character,
} from './character';

const TRIO: Character = {
  id: 'a', name: 'Avenrae', level: 50, classes: ['BRD', 'WAR', 'BER'], race: null,
};
const TRIO_HFL: Character = { ...TRIO, race: 'HFL' };
const SOLO: Character = { id: 'b', name: 'Solo', level: 50, classes: ['WIZ'], race: 'ERU' };

const classes = (list: string[]) => ({ classes: list });
const races = (list: string[]) => ({ races: list });

describe('class eligibility is a union over the trio', () => {
  it('accepts an item any one class can use', () => {
    expect(canUseClass(classes(['BER']), TRIO)).toBe(true);
    expect(canUseClass(classes(['WAR', 'PAL', 'SHD']), TRIO)).toBe(true);
  });

  it('refuses an item none of the three can use', () => {
    expect(canUseClass(classes(['CLR', 'DRU', 'MNK']), TRIO)).toBe(false);
    expect(canUseClass(classes(['WIZ']), TRIO)).toBe(false);
  });

  it('treats ALL and an empty list as unrestricted', () => {
    expect(canUseClass(classes(['ALL']), TRIO)).toBe(true);
    expect(canUseClass(classes([]), TRIO)).toBe(true);
    expect(canUseClass(classes([]), SOLO)).toBe(true);
  });

  it('treats NONE as usable by nobody', () => {
    expect(canUseClass(classes(['NONE']), TRIO)).toBe(false);
    expect(canUseClass(classes(['NONE']), SOLO)).toBe(false);
  });

  it('reads ALL_EXCEPT as an exclusion list, still unioned over the trio', () => {
    // Excludes Bard, but Warrior and Berserker still qualify.
    expect(canUseClass(classes(['ALL_EXCEPT', 'BRD']), TRIO)).toBe(true);
    // Excludes all three.
    expect(canUseClass(classes(['ALL_EXCEPT', 'BRD', 'WAR', 'BER']), TRIO)).toBe(false);
    expect(canUseClass(classes(['ALL_EXCEPT', 'WIZ']), SOLO)).toBe(false);
    expect(canUseClass(classes(['ALL_EXCEPT', 'CLR']), SOLO)).toBe(true);
  });

  it('reads a bare ALL_EXCEPT with nothing excluded as unrestricted', () => {
    expect(canUseClass(classes(['ALL_EXCEPT']), TRIO)).toBe(true);
  });

  it('names which of the three classes made an item usable', () => {
    expect(qualifyingClasses(classes(['WAR', 'PAL']), TRIO)).toEqual(['WAR']);
    expect(qualifyingClasses(classes(['ALL']), TRIO)).toEqual(['BRD', 'WAR', 'BER']);
    expect(qualifyingClasses(classes(['ALL_EXCEPT', 'WAR']), TRIO)).toEqual(['BRD', 'BER']);
    expect(qualifyingClasses(classes(['CLR']), TRIO)).toEqual([]);
  });
});

describe('race eligibility', () => {
  it('treats ALL and an empty list as unrestricted', () => {
    expect(canUseRace(races(['ALL']), TRIO_HFL)).toBe(true);
    expect(canUseRace(races([]), TRIO_HFL)).toBe(true);
  });

  it('matches the character race against an explicit list', () => {
    expect(canUseRace(races(['HFL', 'GNM']), TRIO_HFL)).toBe(true);
    expect(canUseRace(races(['OGR', 'TRL']), TRIO_HFL)).toBe(false);
  });

  it('reads ALL_EXCEPT as an exclusion list', () => {
    expect(canUseRace(races(['ALL_EXCEPT', 'TRL']), TRIO_HFL)).toBe(true);
    expect(canUseRace(races(['ALL_EXCEPT', 'HFL']), TRIO_HFL)).toBe(false);
  });

  it('does not narrow on race when the character has not set one', () => {
    expect(canUseRace(races(['HFL']), TRIO)).toBe(true);
    expect(canUseRace(races(['ALL_EXCEPT', 'HFL']), TRIO)).toBe(true);
  });

  it('refuses a NONE race list whether or not the race is known', () => {
    // 19 worn catalog rows carry `["NONE"]`. Letting them through on an unset
    // race made the same item appear and vanish with a field the restriction
    // does not depend on.
    expect(canUseRace(races(['NONE']), TRIO)).toBe(false);
    expect(canUseRace(races(['NONE']), TRIO_HFL)).toBe(false);
  });
});

describe('canUse combines both restrictions', () => {
  it('needs class and race to pass together', () => {
    expect(canUse({ classes: ['WAR'], races: ['HFL'] }, TRIO_HFL)).toBe(true);
    expect(canUse({ classes: ['WAR'], races: ['OGR'] }, TRIO_HFL)).toBe(false);
    expect(canUse({ classes: ['CLR'], races: ['HFL'] }, TRIO_HFL)).toBe(false);
    expect(canUse({ classes: ['ALL'], races: ['ALL'] }, TRIO_HFL)).toBe(true);
  });
});

describe('armour proficiency takes the best of the three', () => {
  it('opens plate to the trio when any member is a plate class', () => {
    expect(armorTier(TRIO)).toBe(4); // Warrior
    expect(armorTier({ ...TRIO, classes: ['BRD'] })).toBe(3);
    expect(armorTier(SOLO)).toBe(1);
  });
});

describe('class validation', () => {
  it('accepts one to three distinct real classes', () => {
    expect(validateClasses(['WAR'])).toEqual({ ok: true });
    expect(validateClasses(['BRD', 'WAR', 'BER'])).toEqual({ ok: true });
  });

  it('rejects empty, oversized, duplicated and unknown trios', () => {
    expect(validateClasses([]).ok).toBe(false);
    expect(validateClasses(['WAR', 'BRD', 'BER', 'ROG']).ok).toBe(false);
    expect(validateClasses(['WAR', 'WAR']).ok).toBe(false);
    expect(validateClasses(['WAR', 'DRAGOON']).ok).toBe(false);
  });
});

describe('character header', () => {
  it('formats the way the client does', () => {
    expect(describeCharacter(TRIO)).toBe('50 BRD/WAR/BER');
  });
});
