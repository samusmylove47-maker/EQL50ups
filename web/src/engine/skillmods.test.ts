/**
 * Skill damage modifiers do not scale with +N, and both engines must agree.
 *
 * `research/github-data-inventory.md:56` is the only rule table this tree
 * cites for +N behaviour. It has a *flat* row — HP_REGEN, MANA_REGEN,
 * END_REGEN, HASTE, all `base + full` — and an *unchanged* row that reads
 * "heroic stats, Attack, Dmg Bon, **Backstab**, Range, Size, Rec Level,
 * charges, effect magnitudes: untouched". Every `SKILL_DAMAGE_MODS` key
 * belongs to the second row, and `research/` carries no source saying
 * otherwise — grepped 2026-08-31.
 *
 * Until that date `stats.ts` ran all nine through `scaleFlat` and `ep.ts`
 * pushed them as `flat` plan entries, so a Backstab of 13 read 23 at +10 and
 * the inflation was carried into the ranking. Four distinct catalogue items
 * carry the key (eight payload records — each is `PRIMARY`/`SECONDARY` and so
 * appears in both shards): Serpent's Tooth 13, Gold Plated Koshigatana 9,
 * Rib-bone Stiletto 7, Stiletto of the Bloodclaw 6.
 *
 * These tests exist to fail if either engine starts scaling again, and — the
 * part that matters — to fail if only *one* of them does. `ep.ts` carries a
 * standing comment that its plan order mirrors `computeTotals` so the two sums
 * stay identical; a divergence there is silent, because each side is
 * self-consistent and only their disagreement is wrong.
 */

import { describe, expect, it } from 'vitest';
import { rankScorer, scoreItem, type WeightProfile } from './ep';
import { computeTotals } from './stats';
import { SKILL_DAMAGE_MODS } from './constants';
import { tier } from './upgrade';
import type { Item } from './types';

function mk(partial: Partial<Item> & Pick<Item, 'n'>): Item {
  return {
    id: null, sl: ['PRIMARY'], cl: ['ALL'], ra: ['ALL'],
    st: {}, sv: {}, fl: [], av: true, ...partial,
  };
}

/** Serpent's Tooth, the largest Backstab figure in the shipped catalogue. */
const serpentsTooth = mk({ n: "Serpent's Tooth", st: { BACKSTAB: 13 } });

describe('skill damage mods are untouched by +N in the stat totals', () => {
  it('reads the base figure at every tier, not base + full', () => {
    for (const full of [0, 1, 2, 5, 10]) {
      const totals = computeTotals([
        { position: 'PRIMARY', item: serpentsTooth, upgrade: tier(full) },
      ]);
      expect(totals.skillMods.BACKSTAB).toBe(13);
    }
  });

  it('holds for every key in the list, not only the one with catalogue items', () => {
    for (const mod of SKILL_DAMAGE_MODS) {
      const item = mk({ n: `carrier of ${mod.key}`, st: { [mod.key]: 7 } });
      const totals = computeTotals([{ position: 'PRIMARY', item, upgrade: tier(10) }]);
      expect(totals.skillMods[mod.key]).toBe(7);
    }
  });
});

describe('the ranking scores them unscaled too, which is the half that moved rows', () => {
  const weights: WeightProfile = { BACKSTAB: 1 };

  it('scores the same at +0 and +10, because the stat does not move', () => {
    const at0 = scoreItem(serpentsTooth, tier(0), weights).total;
    const at10 = scoreItem(serpentsTooth, tier(10), weights).total;
    expect(at0).toBe(13);
    expect(at10).toBe(13);
  });

  /**
   * The load-bearing one, and it must go through `rankScorer` rather than
   * `scoreItem`.
   *
   * There are two scorers. `scoreItem` reads `resolveItem`'s output directly,
   * so it inherits whatever `stats.ts` does and cannot disagree with it.
   * `rankScorer` compiles its own `PlanEntry[]` and re-implements the
   * arithmetic for speed — **that is the copy that can drift**, and it is the
   * one the `ep.ts` comment about keeping the two sums identical refers to.
   *
   * Written first against `scoreItem`, this test passed while `rankScorer` was
   * mutated to score skill mods as `flat` — a NOT_EXERCISED result caught by
   * A/B rather than by review, on the assertion whose whole purpose was to
   * catch that mutation.
   */
  it('agrees with computeTotals at every tier, through the ranking fast path', () => {
    const rank = rankScorer(weights);
    for (const full of [0, 1, 2, 3, 5, 7, 10]) {
      const upgrade = tier(full);
      const totals = computeTotals([
        { position: 'PRIMARY', item: serpentsTooth, upgrade },
      ]);
      expect(rank(serpentsTooth, upgrade)).toBe(totals.skillMods.BACKSTAB);
      // and the breakdown scorer, which must not drift from either
      expect(scoreItem(serpentsTooth, upgrade, weights).total).toBe(
        totals.skillMods.BACKSTAB,
      );
    }
  });
});

describe('ATTACK is not a flat-scaling key', () => {
  /**
   * It sat in `FLAT_KEYS` unsourced. It scaled nothing, because 0 of 4,004
   * shipped records carry the key — but `build.mjs` parses `ATTACK`, so the
   * day any source supplied one it would have begun scaling silently. This
   * test is the thing that would have caught that, and it is written to pass
   * for a measured reason rather than a vacuous one: the item below *does*
   * carry the key, so the assertion has a subject.
   */
  const carrier = mk({ n: 'hypothetical attack item', st: { ATTACK: 12 } });

  it('still REPORTS a carried ATTACK figure — removing it from FLAT_KEYS must not silence it', () => {
    // Guards the way this fix could have gone wrong. Dropping `ATTACK` from
    // `FLAT_KEYS` outright stops the scaling by stopping the reporting:
    // `totals.attack` reads `flat.ATTACK`, so it would have silently become 0
    // on every item carrying the stat. That is a different bug in the fix's
    // clothes, and this assertion fails if anyone tries it again.
    const totals = computeTotals([{ position: 'PRIMARY', item: carrier, upgrade: tier(0) }]);
    expect(totals.attack).toBe(12);
  });

  it('leaves it untouched at +10 instead of scaling it to 22', () => {
    const totals = computeTotals([{ position: 'PRIMARY', item: carrier, upgrade: tier(10) }]);
    expect(totals.attack).toBe(12);
  });

  it('scores it unscaled in the ranking fast path too', () => {
    const weights: WeightProfile = { ATTACK: 1 };
    expect(scoreItem(carrier, tier(0), weights).total).toBe(12);
    expect(scoreItem(carrier, tier(10), weights).total).toBe(12);
    const rank = rankScorer(weights);
    expect(rank(carrier, tier(0))).toBe(12);
    expect(rank(carrier, tier(10))).toBe(12);
  });
});
