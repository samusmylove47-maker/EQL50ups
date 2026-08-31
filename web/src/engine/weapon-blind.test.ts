/**
 * A weight profile with no weapon term cannot rank a hand slot.
 *
 * `add()` returns immediately on a falsy weight, so a profile carrying neither
 * `RATIO` nor `DMG` scores the weapon block at exactly zero and ranks Primary
 * on its stat line alone. Three of the five presets are in that state and it
 * puts a 1-damage baton above a 40-damage greatsword — by 18x on tank.
 *
 * Measured 2026-08-31, and these numbers are the ones the fix is judged against:
 *
 * | profile | RATIO | baton (dmg 1, AC 30, STA 10) | greatsword (dmg 40, AC 2) |
 * |---|---|---|---|
 * | melee-dps | 40 | 16 | 80.6 |
 * | tank | — | **72** | 4 |
 * | caster | — | **11** | 0.4 |
 * | healer | — | **13.5** | 0.5 |
 * | balanced | 20 | 35.5 | 42 |
 *
 * The remedy is to withhold the slot, never to supply a default weapon weight:
 * what a tank's damage is worth against its armour class is a question nobody
 * has measured, and inventing it would be a number with no source.
 */

import { describe, expect, it } from 'vitest';
import { PRESET_PROFILES, scoreItem, scoresWeapons } from './ep';
import { tier } from './upgrade';
import type { Item } from './types';

const mk = (n: string, p: Partial<Item> = {}): Item => ({
  id: null, n, sl: ['PRIMARY'], cl: ['ALL'], ra: ['ALL'],
  st: {}, sv: {}, fl: [], av: true, ...p,
});

const baton = mk('1-damage baton', { st: { AC: 30, STA: 10 }, wp: { dmg: 1, dly: 40 } });
const greatsword = mk('real greatsword', { st: { AC: 2 }, wp: { dmg: 40, dly: 20 } });

describe('scoresWeapons identifies the profiles that cannot rank a hand slot', () => {
  it('is false exactly for tank, caster and healer', () => {
    const blind = PRESET_PROFILES.filter((p) => !scoresWeapons(p.weights)).map((p) => p.id);
    expect(blind.sort()).toEqual(['caster', 'healer', 'tank']);
  });

  it('is true exactly for the profiles carrying a weapon term', () => {
    const sighted = PRESET_PROFILES.filter((p) => scoresWeapons(p.weights)).map((p) => p.id);
    expect(sighted.sort()).toEqual(['balanced', 'melee-dps']);
  });

  /**
   * The load-bearing one. `scoresWeapons` reads the profile; this reads the
   * SCORER, so the predicate cannot drift away from the behaviour it describes.
   * A profile it calls blind must genuinely score a weapon block at zero.
   */
  it('agrees with the scorer: a blind profile scores a weapon block at exactly zero', () => {
    const stick = mk('stat stick', { st: { AC: 10 } });
    const armed = mk('same, armed', { st: { AC: 10 }, wp: { dmg: 40, dly: 20 } });
    for (const p of PRESET_PROFILES) {
      const withoutWeapon = scoreItem(stick, tier(0), p.weights).total;
      const withWeapon = scoreItem(armed, tier(0), p.weights).total;
      if (scoresWeapons(p.weights)) {
        expect(withWeapon).toBeGreaterThan(withoutWeapon);
      } else {
        expect(withWeapon).toBe(withoutWeapon);
      }
    }
  });
});

describe('the failure the withholding prevents', () => {
  it('a blind profile really does rank the baton over the greatsword', () => {
    // Not a hypothetical: this is why the slot is withheld rather than shown.
    for (const id of ['tank', 'caster', 'healer']) {
      const weights = PRESET_PROFILES.find((p) => p.id === id)!.weights;
      expect(scoreItem(baton, tier(0), weights).total)
        .toBeGreaterThan(scoreItem(greatsword, tier(0), weights).total);
    }
  });

  it('a sighted profile ranks them correctly, so the defect is the weights and not the scorer', () => {
    for (const id of ['melee-dps', 'balanced']) {
      const weights = PRESET_PROFILES.find((p) => p.id === id)!.weights;
      expect(scoreItem(greatsword, tier(0), weights).total)
        .toBeGreaterThan(scoreItem(baton, tier(0), weights).total);
    }
  });

  it('no preset was quietly given a default weapon weight to paper over this', () => {
    // Guards the fix that was explicitly ruled out. If someone adds RATIO to
    // tank to make the slot rankable, this fails and says why.
    for (const id of ['tank', 'caster', 'healer']) {
      const weights = PRESET_PROFILES.find((p) => p.id === id)!.weights;
      expect(weights.RATIO).toBeUndefined();
      expect(weights.DMG).toBeUndefined();
    }
  });
});
