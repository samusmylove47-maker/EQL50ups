/**
 * Effect rank parsing and family collapse.
 *
 * `parseEffectRank` and `dedupeByFamily` had no direct tests at all: the only
 * coverage was `selectors/exaltations.test.ts`, which drove them through whole
 * gear sets built from Roman-numeral fixtures, so the Roman half was exercised
 * and the arabic half — the half the client also prints — was not.
 *
 * Both notations come from one capture, four lines apart
 * (`research/validation/TIER0-VALIDATION.md:143-144`):
 *
 *     Focus Effect: String Resonance 11
 *     Click Effect: Rune IV (Must Equip)
 */

import { describe, expect, it } from 'vitest';
import { dedupeByFamily, EXALTATION_STACKING, parseEffectRank } from './exaltation';

const named = (...names: string[]) => names.map((effectName) => ({ effectName }));
const survivors = (...names: string[]) =>
  dedupeByFamily(named(...names))
    .map((e) => e.effectName)
    .sort();

describe('parseEffectRank', () => {
  it('reads Roman numerals', () => {
    expect(parseEffectRank('Improved Healing III')).toEqual({ family: 'Improved Healing', rank: 3 });
    expect(parseEffectRank('Rune IV')).toEqual({ family: 'Rune', rank: 4 });
    expect(parseEffectRank('Muscle Lock I')).toEqual({ family: 'Muscle Lock', rank: 1 });
    expect(parseEffectRank('Injected Poison V')).toEqual({ family: 'Injected Poison', rank: 5 });
  });

  /*
   * The regression this file exists for. Under the Roman-only parse each of
   * these was its own family at rank 1, so the five ranks of one bard focus all
   * survived a set while `Improved Healing I/II/III` collapsed to one.
   */
  it('reads the arabic ranks the client also prints', () => {
    expect(parseEffectRank('String Resonance 11')).toEqual({ family: 'String Resonance', rank: 11 });
    expect(parseEffectRank('Wind Resonance 0')).toEqual({ family: 'Wind Resonance', rank: 0 });
    expect(parseEffectRank('Percussion Resonance 8')).toEqual({
      family: 'Percussion Resonance',
      rank: 8,
    });
  });

  /*
   * A trailing integer preceded by `level` names a level, not a rank. Both
   * forms occur in the shipped catalog and neither is a ladder.
   */
  it('does not read a cast or requirement level as a rank', () => {
    expect(parseEffectRank('Complete Healing as Level 20')).toEqual({
      family: 'Complete Healing as Level 20',
      rank: 1,
    });
    expect(parseEffectRank('Allure of Death  req. level 20')).toEqual({
      family: 'Allure of Death  req. level 20',
      rank: 1,
    });
  });

  it('leaves an unsuffixed name alone', () => {
    expect(parseEffectRank('Feign Death')).toEqual({ family: 'Feign Death', rank: 1 });
    expect(parseEffectRank('  Stun  ')).toEqual({ family: 'Stun', rank: 1 });
  });
});

describe('dedupeByFamily', () => {
  it('collapses Roman ranks to the highest', () => {
    expect(survivors('Improved Healing I', 'Improved Healing III', 'Improved Healing II')).toEqual([
      'Improved Healing III',
    ]);
  });

  it('collapses arabic ranks to the highest', () => {
    expect(
      survivors(
        'Wind Resonance 0',
        'Wind Resonance 10',
        'Wind Resonance 11',
        'Wind Resonance 12',
        'Wind Resonance 14',
      ),
    ).toEqual(['Wind Resonance 14']);
  });

  it('keeps different families of the same instrument apart', () => {
    expect(survivors('Wind Resonance 12', 'String Resonance 11', 'Brass Resonance 15')).toEqual([
      'Brass Resonance 15',
      'String Resonance 11',
      'Wind Resonance 12',
    ]);
  });

  it('keeps two cast levels of one spell, which are not ranks of a family', () => {
    expect(survivors('Complete Healing as Level 20', 'Complete Healing as Level 30')).toEqual([
      'Complete Healing as Level 20',
      'Complete Healing as Level 30',
    ]);
  });

  it('counts a family once when the same effect is socketed twice', () => {
    expect(survivors('Burning Affliction II', 'Burning Affliction II')).toEqual([
      'Burning Affliction II',
    ]);
  });
});

describe('EXALTATION_STACKING', () => {
  /*
   * The mark is load-bearing, not decoration: it is the only thing standing
   * between a Tier 5 rule and a struck-out row that reads as a fact. Pin that
   * it names its own standing and the capture that would end it.
   */
  it('states its standing and names what would settle it', () => {
    expect(EXALTATION_STACKING.standing).toMatch(/assumed, not measured/i);
    expect(EXALTATION_STACKING.standing).toMatch(/tier 5/i);
    expect(EXALTATION_STACKING.settle).toMatch(/CAPTURE-REQUESTS\.md/);
  });
});
