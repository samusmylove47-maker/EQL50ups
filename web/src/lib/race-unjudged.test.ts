/**
 * "Usable by this loadout", printed over a race gate nobody checked.
 *
 * `canUseRace` returns `true` when the character's race is unset. That is the
 * right answer for the *gate* — race is optional, and the creation screen says
 * so — but it is the wrong answer for the *claim*. The gate was skipped, not
 * passed, and `usabilityOf` collapsed the two into `'usable'`: a green name, a
 * "Wearable" badge in the browser, and the verdict "Usable by this loadout"
 * printed directly under a Requirements block reading "Race BAR TRL OGR".
 *
 * Race is unset by default at character creation, so this is the default state.
 *
 * The distinction these pin is narrow and deliberate. **Eligibility does not
 * change.** `canUse` still says yes, the item still ranks, still equips, still
 * counts in the totals — because narrowing on a field the player declined to
 * fill in would hide gear they can very likely wear. Only the sentence changes,
 * from a claim to an admission.
 */

import { describe, expect, it } from 'vitest';
import { canUse, makeContext } from '../engine/character';
import type { Item } from '../engine/types';
import { itemNameColor, usabilityNote, usabilityOf } from './itemStyle';

function item(overrides: Partial<Item> & { n: string }): Item {
  return {
    id: null, sl: ['WAIST'], cl: ['ALL'], ra: ['ALL'],
    st: {}, sv: {}, fl: [], av: true,
    ...overrides,
  };
}

/** The record's own example: `cl: WAR ROG SHD SHM`, `ra: BAR TRL OGR`. */
const CRUSHBONE_BELT = item({
  n: 'Crushbone Belt',
  cl: ['WAR', 'ROG', 'SHD', 'SHM'],
  ra: ['BAR', 'TRL', 'OGR'],
});
const OPEN = item({ n: 'Bone-Clasped Girdle' });
const BARRED = item({ n: 'Everyone Else’s Belt', ra: ['ALL_EXCEPT', 'BAR'] });

const TRIO = ['WAR', 'ROG', 'SHM'] as const;
const levels = { WAR: 50, ROG: 50, SHM: 50 };

const unset = makeContext([...TRIO], null, levels);
const barbarian = makeContext([...TRIO], 'BAR', levels);
const human = makeContext([...TRIO], 'HUM', levels);

describe('a race gate that was skipped is not a race gate that was passed', () => {
  it('does not call an unjudged item usable', () => {
    expect(usabilityOf(CRUSHBONE_BELT, unset)).not.toBe('usable');
    expect(usabilityNote(CRUSHBONE_BELT, unset)).not.toBe('Usable by this loadout');
  });

  it('says what it did not check, rather than saying nothing', () => {
    const note = usabilityNote(CRUSHBONE_BELT, unset);
    expect(note).toBeTruthy();
    expect(note).toMatch(/race/i);
  });

  it('leaves eligibility exactly where it was — the item still ranks', () => {
    // The whole point of not narrowing: a player who declined to pick a race
    // keeps seeing gear they can very probably wear.
    expect(canUse({ classes: CRUSHBONE_BELT.cl, races: CRUSHBONE_BELT.ra }, unset)).toBe(true);
    expect(usabilityOf(CRUSHBONE_BELT, unset)).not.toBe('blocked');
  });

  it('judges normally the moment a race is set', () => {
    expect(usabilityOf(CRUSHBONE_BELT, barbarian)).toBe('usable');
    expect(usabilityNote(CRUSHBONE_BELT, barbarian)).toBe('Usable by this loadout');
    expect(usabilityOf(CRUSHBONE_BELT, human)).toBe('blocked');
    expect(usabilityNote(CRUSHBONE_BELT, human)).toBe('This loadout cannot equip it');
  });

  it('does not hedge on an item no race restriction applies to', () => {
    // 3,415 of the 3,663 shipped records carry `ALL`. Hedging on those would
    // turn a real answer into a shrug on 93% of the catalog.
    expect(usabilityOf(OPEN, unset)).toBe('usable');
    expect(usabilityNote(OPEN, unset)).toBe('Usable by this loadout');
  });

  it('hedges on an ALL_EXCEPT list too, where the answer still turns on race', () => {
    expect(usabilityOf(BARRED, unset)).not.toBe('usable');
    expect(usabilityOf(BARRED, barbarian)).toBe('blocked');
    expect(usabilityOf(BARRED, human)).toBe('usable');
  });

  it('still refuses NONE, which no race satisfies', () => {
    const nobody = item({ n: 'Nobody’s Belt', ra: ['NONE'] });
    expect(usabilityOf(nobody, unset)).toBe('blocked');
  });

  /*
   * The tint carries the claim wherever the note does not — the picker, the
   * paper doll, the browser row, the exaltation list all colour a name and
   * print no sentence. Green in this app means "checked, and you can wear it".
   */
  it('does not paint an unchecked item with the colour that means checked', () => {
    expect(itemNameColor(CRUSHBONE_BELT, unset)).toBe('var(--item-neutral)');
    expect(itemNameColor(CRUSHBONE_BELT, barbarian)).toBe('var(--item-usable)');
    expect(itemNameColor(CRUSHBONE_BELT, human)).toBe('var(--item-blocked)');
    expect(itemNameColor(OPEN, unset)).toBe('var(--item-usable)');
  });

  it('says nothing at all when there is no loadout to judge against', () => {
    expect(usabilityOf(CRUSHBONE_BELT, undefined)).toBe('unjudged');
    expect(usabilityNote(CRUSHBONE_BELT, undefined)).toBeNull();
  });
});
