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
  activeContext, activeLoadout, activeRace, armorTier, canUse, canUseClass, canUseRace,
  contextFor, contextForLoadout, describeCharacter, describeFor, describeLoadout, levelCheck,
  loadoutFor, makeContext, makeLevels,
  meetsLevel, primaryLevel, qualifyingClasses, validateClasses,
  type Character, type LoadoutContext,
} from './character';

const TRIO: LoadoutContext = makeContext(['BRD', 'WAR', 'BER'], null, {
  BRD: 50, WAR: 50, BER: 50,
});
const TRIO_HFL: LoadoutContext = { ...TRIO, race: 'HFL' };
const SOLO: LoadoutContext = makeContext(['WIZ'], 'ERU', { WIZ: 50 });

/** The Tier 0 sample character, per the client's Loadouts tab. */
const AVENRAE: Character = {
  id: 'a',
  name: 'Avenrae',
  race: null,
  levels: makeLevels({ BRD: 50, BER: 50, WAR: 50, MNK: 36, DRU: 36, SHD: 36, PAL: 21, MAG: 11 }),
  loadouts: [
    { id: 'l0', name: 'Loadout 1', classes: ['BRD', 'SHD', 'DRU'] },
    { id: 'l1', name: 'Loadout 2', classes: ['WAR', 'PAL', 'BER'] },
    { id: 'l2', name: 'Loadout 3', classes: ['BRD', 'WAR', 'BER'] },
  ],
  activeLoadoutId: 'l2',
};

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

describe('per-class levels and loadouts', () => {
  it('keeps a level for every one of the sixteen classes', () => {
    const levels = makeLevels({ BRD: 50 });
    expect(Object.keys(levels)).toHaveLength(16);
    expect(levels.BRD).toBe(50);
    expect(levels.WIZ).toBe(1);
  });

  it('formats the header from the primary class level, the way the client does', () => {
    expect(describeCharacter(AVENRAE)).toBe('50 BRD/WAR/BER');
    expect(primaryLevel(AVENRAE)).toBe(50);
  });

  it('reads the active loadout, and describes the inactive ones too', () => {
    expect(activeLoadout(AVENRAE)?.id).toBe('l2');
    expect(describeLoadout(AVENRAE, AVENRAE.loadouts[0] as never)).toBe('50 BRD/SHD/DRU');
    expect(describeLoadout(AVENRAE, AVENRAE.loadouts[1] as never)).toBe('50 WAR/PAL/BER');
  });

  it('switches eligibility when the active loadout changes', () => {
    const asBard = activeContext({ ...AVENRAE, activeLoadoutId: 'l0' });
    const asWarrior = activeContext({ ...AVENRAE, activeLoadoutId: 'l1' });
    expect(canUseClass({ classes: ['DRU'] }, asBard)).toBe(true);
    expect(canUseClass({ classes: ['DRU'] }, asWarrior)).toBe(false);
    expect(canUseClass({ classes: ['PAL'] }, asWarrior)).toBe(true);
    expect(armorTier(asBard)).toBe(4); // Shadow Knight
  });

  it('falls back to the first loadout when the active id is stale', () => {
    expect(activeLoadout({ ...AVENRAE, activeLoadoutId: 'gone' })?.id).toBe('l0');
  });

  it('lets a loadout override the character race, and inherits it otherwise', () => {
    const withRace: Character = {
      ...AVENRAE,
      race: 'HFL',
      loadouts: [{ id: 'l0', name: 'Ogre run', classes: ['WAR'], race: 'OGR' }],
      activeLoadoutId: 'l0',
    };
    expect(activeRace(withRace)).toBe('OGR');
    expect(activeRace({ ...withRace, loadouts: [{ id: 'l0', name: 'x', classes: ['WAR'] }] })).toBe(
      'HFL',
    );
    expect(contextForLoadout(withRace, withRace.loadouts[0] as never).race).toBe('OGR');
  });
});

describe('level requirements are checked against the qualifying class', () => {
  const ctx = makeContext(['BRD', 'WAR', 'BER'], null, { BRD: 50, WAR: 12, BER: 50 });

  it('uses the level of the class that makes the item usable, not the best level', () => {
    const warriorOnly = { classes: ['WAR'], races: ['ALL'], rl: 40 };
    expect(levelCheck(warriorOnly, ctx)).toEqual({ required: 40, best: 12, via: 'WAR', ok: false });
    expect(meetsLevel(warriorOnly, ctx)).toBe(false);
    expect(canUse(warriorOnly, ctx)).toBe(false);
  });

  it('passes when the qualifying class is high enough', () => {
    expect(meetsLevel({ classes: ['BRD'], races: ['ALL'], rl: 46 }, ctx)).toBe(true);
  });

  it('takes the best of several qualifying classes', () => {
    // Bard qualifies at 50, Warrior at 12: the Bard carries it.
    expect(levelCheck({ classes: ['WAR', 'BRD'], races: ['ALL'], rl: 46 }, ctx).via).toBe('BRD');
  });

  it('treats an item with no requirement as always level-legal', () => {
    expect(meetsLevel({ classes: ['WAR'], races: ['ALL'] }, ctx)).toBe(true);
    expect(levelCheck({ classes: ['WAR'], races: ['ALL'] }, ctx).required).toBe(0);
  });

  it('judges an unrestricted item against the best class in the loadout', () => {
    expect(meetsLevel({ classes: ['ALL'], races: ['ALL'], rl: 50 }, ctx)).toBe(true);
    expect(meetsLevel({ classes: ['ALL'], races: ['ALL'], rl: 51 }, ctx)).toBe(false);
  });
});

/**
 * A saved plan belongs to a loadout, not to a character in the abstract.
 *
 * Resolving eligibility against whichever loadout happened to be *active* meant
 * switching loadouts silently re-judged every saved set, and a compare of two
 * plans built for two different trios named the same trio on both sides.
 */
describe('a plan resolves against its own loadout', () => {
  it('finds the named loadout rather than the active one', () => {
    expect(loadoutFor(AVENRAE, 'l0')?.classes).toEqual(['BRD', 'SHD', 'DRU']);
    expect(loadoutFor(AVENRAE, 'l1')?.classes).toEqual(['WAR', 'PAL', 'BER']);
    // The active loadout is l2; naming another must not return it.
    expect(activeLoadout(AVENRAE)?.id).toBe('l2');
  });

  it('judges eligibility by the plan\'s loadout, not the active one', () => {
    const asBard = contextFor(AVENRAE, 'l0');
    const asWarrior = contextFor(AVENRAE, 'l1');
    expect(canUseClass({ classes: ['DRU'] }, asBard)).toBe(true);
    expect(canUseClass({ classes: ['DRU'] }, asWarrior)).toBe(false);
    expect(canUseClass({ classes: ['PAL'] }, asWarrior)).toBe(true);
  });

  it('names each plan\'s own trio, so two can be compared side by side', () => {
    expect(describeFor(AVENRAE, 'l0')).toBe('50 BRD/SHD/DRU');
    expect(describeFor(AVENRAE, 'l1')).toBe('50 WAR/PAL/BER');
    expect(describeFor(AVENRAE, 'l0')).not.toBe(describeFor(AVENRAE, 'l1'));
  });

  it('falls back to the active loadout for a plan that names none', () => {
    // Sets saved before loadouts were tracked. The fallback is the behaviour
    // those sets already had, so nothing is re-judged by upgrading.
    expect(loadoutFor(AVENRAE, undefined)?.id).toBe('l2');
    expect(describeFor(AVENRAE, undefined)).toBe(describeCharacter(AVENRAE));
    expect(contextFor(AVENRAE, undefined)).toEqual(activeContext(AVENRAE));
  });

  it('falls back rather than throwing when the plan\'s loadout was deleted', () => {
    expect(loadoutFor(AVENRAE, 'deleted')?.id).toBe('l2');
    expect(describeFor(AVENRAE, 'deleted')).toBe('50 BRD/WAR/BER');
    expect(contextFor(AVENRAE, 'deleted')).toEqual(activeContext(AVENRAE));
  });

  it('carries a loadout race override into the plan context', () => {
    const withRace: Character = {
      ...AVENRAE,
      race: 'HFL',
      loadouts: [
        { id: 'p0', name: 'Ogre run', classes: ['WAR'], race: 'OGR' },
        { id: 'p1', name: 'Home', classes: ['BRD'] },
      ],
      activeLoadoutId: 'p1',
    };
    expect(contextFor(withRace, 'p0').race).toBe('OGR');
    expect(contextFor(withRace, 'p1').race).toBe('HFL');
  });
});
