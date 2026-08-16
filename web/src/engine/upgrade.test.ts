import { describe, it, expect } from 'vitest';
import {
  MAX_TIER,
  tier,
  effectiveLevel,
  displayLevel,
  excelRound,
  scalePrimary,
  scaleDamage,
  scaleFlat,
  scaleWeight,
  scaleDelay,
  voidBonus,
  damageRatio,
  normalizeState,
  fractionDenominator,
  mergeValue,
  experienceForTier,
  reachableStateCount,
} from './upgrade';

/**
 * Tier 0 fixtures — values read directly off the live client.
 * See research/validation/TIER0-VALIDATION.md. These are the highest-authority
 * assertions in the codebase; if any of them fail, the model is wrong, not the
 * fixture.
 */
describe('Tier 0: Whitened Treant Fists (base dmg 14, delay 28)', () => {
  const cases = [
    { lvl: 0, dmg: 14, ratio: 0.5 },
    { lvl: 1, dmg: 15, ratio: 0.536 },
    { lvl: 2, dmg: 16, ratio: 0.571 },
    { lvl: 3, dmg: 18, ratio: 0.643 },
  ];

  for (const { lvl, dmg, ratio } of cases) {
    it(`+${lvl} reads ${dmg} damage at ratio ${ratio}`, () => {
      expect(scaleDamage(14, tier(lvl))).toBe(dmg);
      expect(scaleDelay(28)).toBe(28);
      expect(Number(damageRatio(dmg, 28).toFixed(3))).toBeCloseTo(ratio, 3);
    });
  }

  it('produces uneven steps, which is the floor function and not a defect', () => {
    const seq = [0, 1, 2, 3].map((l) => scaleDamage(14, tier(l)));
    expect(seq).toEqual([14, 15, 16, 18]);
    const deltas = seq.slice(1).map((v, i) => v - (seq[i] ?? 0));
    expect(deltas).toEqual([1, 1, 2]);
  });
});

describe('Tier 0: Earthshaker (base dmg 37, delay 70, STR 6, STA 6) at +10', () => {
  const t10 = tier(10);

  it('doubles damage to 74', () => {
    expect(scaleDamage(37, t10)).toBe(74);
  });

  it('leaves delay untouched at 70', () => {
    expect(scaleDelay(70)).toBe(70);
  });

  it('reports a ratio of 1.057', () => {
    expect(Number(damageRatio(74, 70).toFixed(3))).toBeCloseTo(1.057, 3);
  });

  it('lifts Strength and Stamina from 6 to 16 via the base<=10 branch', () => {
    expect(scalePrimary(6, t10)).toBe(16);
  });

  it('grants SV Void equal to the tier, from two attribute fields', () => {
    expect(voidBonus(['STR', 'STA'], t10)).toBe(10);
  });
});

describe('primary stat scaling', () => {
  it('returns zero for an absent stat at any tier', () => {
    expect(scalePrimary(0, tier(7))).toBe(0);
  });

  it('adds the whole tier when the base is at or below ten', () => {
    expect(scalePrimary(10, tier(4))).toBe(14);
    expect(scalePrimary(1, tier(10))).toBe(11);
  });

  it('switches to the percentage branch above ten', () => {
    // 25 + excelRound(25 * 4 / 10) = 25 + 10 = 35
    expect(scalePrimary(25, tier(4))).toBe(35);
  });

  it('shrinks penalties toward zero rather than deepening them', () => {
    expect(scalePrimary(-5, tier(2))).toBe(-3);
    expect(scalePrimary(-5, tier(5))).toBe(0);
    expect(scalePrimary(-5, tier(9))).toBe(0);
  });

  it('ignores banked fraction on the base<=10 branch', () => {
    expect(scalePrimary(6, { full: 3, fraction: 7 })).toBe(9);
  });
});

describe('excelRound is half-away-from-zero', () => {
  it('rounds positive halves up', () => {
    expect(excelRound(2.5)).toBe(3);
    expect(excelRound(0.5)).toBe(1);
  });

  it('rounds negative halves away from zero, unlike Math.round', () => {
    expect(excelRound(-2.5)).toBe(-3);
    expect(Math.round(-2.5)).toBe(-2);
  });
});

describe('weight', () => {
  it('is unchanged at base tier', () => {
    expect(scaleWeight(3.0, tier(0))).toBeCloseTo(3.0, 5);
  });

  it('reproduces the float artifact at max tier rather than correcting it', () => {
    // 3.0 * (1 - 0.9) === 0.30000000000000027, whose 1dp ceiling is 0.4.
    expect(scaleWeight(3.0, tier(10))).toBe(0.4);
  });

  it('treats very light items as an entry guard, leaving them alone', () => {
    expect(scaleWeight(0.1, tier(10))).toBe(0.1);
  });

  it('decreases monotonically as tier rises', () => {
    const weights = [0, 2, 4, 6, 8, 10].map((t) => scaleWeight(5.0, tier(t)));
    for (let i = 1; i < weights.length; i++) {
      expect(weights[i] ?? 0).toBeLessThanOrEqual(weights[i - 1] ?? 0);
    }
  });
});

describe('flat stats', () => {
  it('adds the whole tier and ignores fraction', () => {
    expect(scaleFlat(12, tier(3))).toBe(15);
    expect(scaleFlat(12, { full: 3, fraction: 5 })).toBe(15);
  });
});

describe('void bonus trigger', () => {
  it('requires at least two distinct trigger fields', () => {
    expect(voidBonus(['STR'], tier(5))).toBe(0);
    expect(voidBonus(['STR', 'DEX'], tier(5))).toBe(5);
  });

  it('does not count a repeated field twice', () => {
    expect(voidBonus(['STR', 'STR'], tier(5))).toBe(0);
  });

  it('excludes AC, HP and MANA from the trigger', () => {
    expect(voidBonus(['AC', 'HP', 'MANA'], tier(6))).toBe(0);
  });

  it('mixes attributes and saves', () => {
    expect(voidBonus(['STR', 'SV_FIRE'], tier(8))).toBe(8);
  });

  it('grants nothing at base tier', () => {
    expect(voidBonus(['STR', 'STA'], tier(0))).toBe(0);
  });
});

describe('upgrade state', () => {
  it('denominates the fraction as a power of two', () => {
    expect(fractionDenominator(0)).toBe(1);
    expect(fractionDenominator(3)).toBe(8);
    expect(fractionDenominator(10)).toBe(1024);
  });

  it('computes a continuous effective level', () => {
    expect(effectiveLevel({ full: 2, fraction: 2 })).toBeCloseTo(2.5, 6);
    expect(displayLevel({ full: 2, fraction: 2 })).toBeCloseTo(25, 6);
  });

  it('clamps out-of-range tiers', () => {
    expect(normalizeState({ full: 99, fraction: 0 }).full).toBe(MAX_TIER);
    expect(normalizeState({ full: -4, fraction: 0 }).full).toBe(0);
  });

  it('banks nothing at max tier, matching "cannot be upgraded"', () => {
    expect(normalizeState({ full: 10, fraction: 500 })).toEqual({ full: 10, fraction: 0 });
  });

  it('caps fraction below its denominator', () => {
    expect(normalizeState({ full: 2, fraction: 99 })).toEqual({ full: 2, fraction: 3 });
  });

  it('rejects negative fractions', () => {
    expect(normalizeState({ full: 2, fraction: -5 }).fraction).toBe(0);
  });

  it('survives non-finite input', () => {
    expect(normalizeState({ full: NaN, fraction: NaN })).toEqual({ full: 0, fraction: 0 });
    expect(scalePrimary(NaN, tier(3))).toBe(0);
    expect(scaleDamage(NaN, tier(3))).toBe(0);
  });
});

describe('merge economy', () => {
  it('values a merged item at two to the power of its tier', () => {
    expect(mergeValue(0)).toBe(1);
    expect(mergeValue(4)).toBe(16);
  });

  it('totals experience for a tier as one less than its merge value', () => {
    expect(experienceForTier(3)).toBe(7);
  });

  it('exposes exactly 1024 reachable states', () => {
    expect(reachableStateCount()).toBe(1024);
  });
});
