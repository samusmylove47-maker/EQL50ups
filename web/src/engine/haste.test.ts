/**
 * Haste: the one figure in this app whose unit nobody has established.
 *
 * There are two separate defects behind this file and they must not be confused
 * with each other.
 *
 * **The unit.** Classic haste was a percentage that divided weapon delay. The
 * eqltools Haste Guide says Legends uses flat attack-speed values; eqlwiki's
 * item field is still documented as "worn haste %". This app read the wiki's
 * field and printed it with a percent sign under a Legends label, which asserted
 * one of the two readings as settled. Nobody has settled it and this project
 * exists to stop exactly that. The fix is not to pick a side and not to hide the
 * number: it is to print the figure with no unit and carry the provenance.
 *
 * **The stacking.** Worn haste does not accumulate — `computeTotals` has always
 * kept the highest and discarded the rest — but `scoreItem` added every haste
 * item at full weight, so the ranking promised a gain the stat panel below it
 * then refused to show. That is a contradiction inside our own engine rather
 * than an inheritance, and it is fixed here rather than documented.
 *
 * What is *not* fixed, and cannot be, is which unit applies. That takes one
 * screenshot. Until it arrives, these tests pin the shape of the honest answer.
 */

import { describe, expect, it } from 'vitest';
import { rankScorer, scoreItem, type ScoreContext, type WeightProfile } from './ep';
import { HASTE_PROVENANCE, HASTE_STACKING, computeTotals } from './stats';
import { tier } from './upgrade';
import type { Item } from './types';

function mk(partial: Partial<Item> & Pick<Item, 'n'>): Item {
  return {
    id: null, sl: ['WAIST'], cl: ['ALL'], ra: ['ALL'],
    st: {}, sv: {}, fl: [], av: true, ...partial,
  };
}

const WEIGHTS: WeightProfile = { HASTE: 2, AC: 1 };

describe('worn haste takes the highest, in the scorer as well as the totals', () => {
  const belt = mk({ n: 'Belt of Contention', st: { HASTE: 21 } });

  it('scores the whole figure when nothing else is hasted', () => {
    expect(scoreItem(belt, tier(0), WEIGHTS, { existing: undefined }).total).toBe(42);
  });

  it('scores only the part a character would actually feel', () => {
    // Already wearing 36. A 21 changes the total the client shows by nothing,
    // so it is worth nothing — the same arithmetic `computeTotals` performs.
    const ctx: ScoreContext = { existing: { attributes: {}, saves: {}, haste: 36 } };
    expect(scoreItem(belt, tier(0), WEIGHTS, ctx).total).toBe(0);

    const worn = [
      { position: 'WAIST', item: mk({ n: 'Cloak of Flames', st: { HASTE: 36 } }), upgrade: tier(0) },
      { position: 'WRIST_1', item: belt, upgrade: tier(0) },
    ];
    expect(computeTotals(worn).haste).toBe(36);
  });

  it('scores the difference when the candidate is the bigger one', () => {
    const better = mk({ n: 'Cloak of Flames', st: { HASTE: 36 } });
    const ctx: ScoreContext = { existing: { attributes: {}, saves: {}, haste: 21 } };
    // 36 replaces 21, so the character feels 15 more, not 36 more.
    expect(scoreItem(better, tier(0), WEIGHTS, ctx).total).toBe(30);
  });

  it('never credits a negative movement', () => {
    const ctx: ScoreContext = { existing: { attributes: {}, saves: {}, haste: 36 } };
    expect(scoreItem(mk({ n: 'Drag', st: { HASTE: -10 } }), tier(0), WEIGHTS, ctx).total).toBe(0);
  });

  it('reports the discarded part rather than dropping it from the breakdown', () => {
    const ctx: ScoreContext = { existing: { attributes: {}, saves: {}, haste: 36 } };
    const part = scoreItem(belt, tier(0), WEIGHTS, ctx).parts.find((p) => p.key === 'HASTE');
    expect(part).toBeTruthy();
    expect(part?.amount).toBe(21);
    expect(part?.points).toBe(0);
    expect(part?.capped).toBe(21);
  });

  it('leaves the raw figure alone when the caller opts out of cap awareness', () => {
    const ctx: ScoreContext = {
      capAware: false,
      existing: { attributes: {}, saves: {}, haste: 36 },
    };
    expect(scoreItem(belt, tier(0), WEIGHTS, ctx).total).toBe(42);
  });

  /*
   * The contract `ep-scorer.test.ts` enforces over the whole catalog, restated
   * for the one branch that file's contexts cannot reach: the fast path and the
   * explaining path must agree on haste too, or the picker's EP column and the
   * item window start disagreeing about the same item.
   */
  it('the ranking fast path agrees with the scorer it specialises', () => {
    for (const already of [0, 10, 21, 36, 99]) {
      const ctx: ScoreContext = { existing: { attributes: {}, saves: {}, haste: already } };
      for (const upgrade of [tier(0), tier(5), tier(10)]) {
        for (const item of [belt, mk({ n: 'Big', st: { HASTE: 36, AC: 9 } })]) {
          expect(rankScorer(WEIGHTS, ctx)(item, upgrade)).toBe(
            scoreItem(item, upgrade, WEIGHTS, ctx).total,
          );
        }
      }
    }
  });
});

describe('the totals say how many items the highest-wins rule discarded', () => {
  it('counts every worn item carrying a haste figure, not just the winner', () => {
    const totals = computeTotals([
      { position: 'WAIST', item: mk({ n: 'A', st: { HASTE: 21 } }), upgrade: tier(0) },
      { position: 'WRIST_1', item: mk({ n: 'B', st: { HASTE: 36 } }), upgrade: tier(0) },
      { position: 'HEAD', item: mk({ n: 'C', st: { AC: 10 } }), upgrade: tier(0) },
    ]);
    expect(totals.haste).toBe(36);
    expect(totals.hasteSources).toBe(2);
  });

  it('is zero on a set with no haste at all, so nothing is claimed', () => {
    const totals = computeTotals([
      { position: 'HEAD', item: mk({ n: 'C', st: { AC: 10 } }), upgrade: tier(0) },
    ]);
    expect(totals.haste).toBe(0);
    expect(totals.hasteSources).toBe(0);
  });
});

describe('the provenance the figure carries wherever it is printed', () => {
  it('states both readings and picks neither', () => {
    expect(HASTE_PROVENANCE.classic).toMatch(/percentage/i);
    expect(HASTE_PROVENANCE.legends).toMatch(/flat attack-speed/i);
    expect(HASTE_PROVENANCE.legends).toMatch(/disagree/i);
    // The point of the note is that it does not resolve the question. Any copy
    // edit that turns it into an answer is the failure this file guards.
    expect(HASTE_PROVENANCE.short).not.toMatch(/\bis a percentage\b/i);
  });

  it('names the artefact that would settle it, the way the contamination page does', () => {
    expect(HASTE_PROVENANCE.settle).toMatch(/screenshot/i);
    expect(HASTE_PROVENANCE.settle).toMatch(/tooltip/i);
    expect(HASTE_STACKING.settle).toMatch(/screenshot/i);
  });

  it('marks the highest-wins rule as assumed rather than measured', () => {
    expect(HASTE_STACKING.rule).toMatch(/highest/i);
    expect(HASTE_STACKING.standing).toMatch(/assumed, not measured/i);
    // Its corroboration is a named community guide — Tier 3 — and the note must
    // keep saying so rather than promoting itself to an observation.
    expect(HASTE_STACKING.standing).toMatch(/guide/i);
  });
});
