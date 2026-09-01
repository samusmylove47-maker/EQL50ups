/**
 * The refusal sentence, checked against what a reader actually sees.
 *
 * `blockReasons` had no test at all until this file. It is one of two places
 * (with `ItemWindow`'s Requirements block) where the catalog's raw restriction
 * list reaches a reader as prose, and prose is where a sentinel token stops
 * being an encoding and starts being a claim.
 *
 * **Every assertion below is a literal string.** Nothing here calls
 * `readRestriction`, `canUseClass` or any other function the code under test
 * calls — a guard built from the function it guards agrees by construction and
 * would have passed on the defect this file was written to catch.
 *
 * Counted over the shipped 3,663 records on 1 Sep 2026 with
 * `node -e` over `web/public/data/items-index.json`:
 *
 * ```
 *   cl contains ALL_EXCEPT   255      ra contains ALL_EXCEPT    59
 *   cl contains NONE          74      ra contains NONE          84
 *   cl contains ALL        1,614      ra contains ALL        3,252
 *   cl empty                 161      ra empty                 163
 *   ALL_EXCEPT anywhere but first: 0     ALL_EXCEPT with nothing after it: 0
 *   ALL mixed with other codes:    0     NONE mixed with other codes:    0
 * ```
 */

import { describe, expect, it } from 'vitest';
import { blockReasons, blockSentence } from './blockReason';
import { makeContext } from '../engine/character';
import type { Item } from '../engine/types';

function mk(partial: Partial<Item> & Pick<Item, 'n'>): Item {
  return {
    id: null, sl: ['CHEST'], cl: ['ALL'], ra: ['ALL'],
    st: {}, sv: {}, fl: [], av: true, ...partial,
  };
}

/** A caster trio, so an ALL_EXCEPT-casters item refuses it and the clause fires. */
const CASTERS = makeContext(['ENC', 'MAG', 'WIZ'], 'HUM', { ENC: 50, MAG: 50, WIZ: 50 });
const TROLL_WARRIOR = makeContext(['WAR'], 'TRL', { WAR: 50 });

describe('ALL_EXCEPT is an exclusion list, and the sentence must say so', () => {
  /*
   * The defect: `it is restricted to ${item.cl.join(', ')}` rendered
   * `['ALL_EXCEPT','ENC','MAG','WIZ']` as "it is restricted to ALL_EXCEPT, ENC,
   * MAG, WIZ" — which names a class that does not exist and states the exact
   * opposite of who may wear the item. 255 records reach this branch.
   */
  it('never prints the ALL_EXCEPT sentinel as though it were a class', () => {
    const item = mk({ n: 'Bear-hide Jerkin', cl: ['ALL_EXCEPT', 'ENC', 'MAG', 'WIZ'] });
    const reasons = blockReasons(item, CASTERS);
    expect(reasons.length).toBe(1);
    expect(reasons[0]).not.toContain('ALL_EXCEPT');
  });

  it('reads an excluded class list as an exclusion, word for word', () => {
    const item = mk({ n: 'Bear-hide Jerkin', cl: ['ALL_EXCEPT', 'ENC', 'MAG', 'WIZ'] });
    expect(blockReasons(item, CASTERS)).toEqual([
      'it is open to every class except ENC, MAG, WIZ, and this loadout is ENC, MAG, WIZ',
    ]);
  });

  it('reads an excluded race list as an exclusion, word for word', () => {
    const item = mk({ n: 'Aegis of Life', ra: ['ALL_EXCEPT', 'TRL', 'OGR', 'IKS'] });
    expect(blockReasons(item, TROLL_WARRIOR)).toEqual([
      'it is open to every race except TRL, OGR, IKS, and this character is TRL',
    ]);
  });

  it('says NONE plainly instead of "restricted to NONE", which reads as unrestricted', () => {
    const item = mk({ n: 'A Locked Chest', cl: ['NONE'], ra: ['NONE'] });
    expect(blockReasons(item, TROLL_WARRIOR)).toEqual([
      'no class can use it',
      'no race can use it',
    ]);
  });
});

describe('what the fix must not change', () => {
  it('still names an inclusion list as an inclusion', () => {
    const item = mk({ n: 'Basalt Carapace', cl: ['WAR', 'BRD', 'CLR'] });
    expect(blockReasons(item, CASTERS)).toEqual([
      'it is restricted to WAR, BRD, CLR, and this loadout is ENC, MAG, WIZ',
    ]);
  });

  it('says nothing about an item the loadout can wear', () => {
    expect(blockReasons(mk({ n: 'Cloth Cap' }), CASTERS)).toEqual([]);
    expect(blockSentence(mk({ n: 'Cloth Cap' }), CASTERS)).toBe(null);
  });

  it('has no opinion when there is no loadout to have one about', () => {
    const item = mk({ n: 'Bear-hide Jerkin', cl: ['ALL_EXCEPT', 'ENC'] });
    expect(blockReasons(item, undefined)).toEqual([]);
    expect(blockSentence(item, undefined)).toBe(null);
  });

  /*
   * An empty list is unrestricted — `isUnrestricted` returns true on length 0 —
   * so the gate never closes and the "other classes"/"other races" fallbacks in
   * the old sentence were unreachable. This pins that, so removing them is a
   * checked deletion rather than a hopeful one.
   */
  it('never blocks on an empty restriction list, so no fallback wording is reachable', () => {
    expect(blockReasons(mk({ n: 'Rusty Dagger', cl: [], ra: [] }), CASTERS)).toEqual([]);
  });

  it('joins several closed gates into one sentence', () => {
    const item = mk({ n: 'Iksar Mask', cl: ['ALL_EXCEPT', 'ENC', 'MAG', 'WIZ'], ra: ['IKS'] });
    expect(blockSentence(item, CASTERS)).toBe(
      'it is open to every class except ENC, MAG, WIZ, and this loadout is ENC, MAG, WIZ;'
      + ' and it is restricted to IKS, and this character is HUM',
    );
  });
});
