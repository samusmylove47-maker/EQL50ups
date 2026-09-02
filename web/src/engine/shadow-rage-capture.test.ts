/**
 * Four client captures of the Shadow Rage set, 2 September 2026 — and what they
 * settle.
 *
 * The owner supplied item-window screenshots of Wristguard +4, Sleeves +5,
 * Helm +5 and Leggings +4. Three of those items have a wiki stat block that
 * this project has been *withholding* since 17 August, on the owner's
 * instruction not to ship an out-of-era block for this set until verified
 * numbers arrived. These are the verified numbers.
 *
 * The test is not "do the captures look right". It is:
 *
 *   take the wiki's +0 block, push it through `upgrade.ts` — which was derived
 *   independently, from a documented rule set, and never from these items — and
 *   see whether it reproduces the client exactly.
 *
 * If it does, two things are true at once: the wiki's +0 numbers are correct,
 * and the scaling model is correct at tiers 4 and 5. Neither could be concluded
 * from the other alone, and neither was assumed here.
 *
 * Source: research/validation/TIER0-VALIDATION.md § Shadow Rage captures.
 */

import { describe, expect, it } from 'vitest';
import { scalePrimary, scaleWeight, tier, voidBonus } from './upgrade';

/** A stat block exactly as the wiki prints it at +0. */
interface Block {
  ac: number;
  weight: number;
  stats: Record<string, number>;
}

/** A stat block exactly as the client printed it, at the tier named. */
interface Capture {
  item: string;
  at: number;
  wiki: Block;
  client: { ac: number; weight: number; stats: Record<string, number>; svVoid: number };
}

/*
 * `AC` and `END` go through `scalePrimary` like any other magnitude: the rule
 * branches on the VALUE, not on which field it is. That is what makes the
 * Sleeves the interesting row — its END is 15, above the `<= 10` threshold, so
 * it takes the percentage branch and gains 7 at +5 rather than 5. Read off the
 * screenshot that looks like an anomaly; run through the model it is the rule.
 */
const CAPTURES: Capture[] = [
  {
    item: 'Shadow Rage Wristguard',
    at: 4,
    wiki: { ac: 6, weight: 2.0, stats: { STR: 4, AGI: 4, DEX: 4, SV_FIRE: 5, SV_COLD: 5 } },
    client: {
      ac: 10,
      weight: 1.3,
      stats: { STR: 8, AGI: 8, DEX: 8, SV_FIRE: 9, SV_COLD: 9 },
      svVoid: 4,
    },
  },
  {
    item: 'Shadow Rage Sleeves',
    at: 5,
    wiki: { ac: 10, weight: 3.9, stats: { END: 15, STR: 3, STA: 5, DEX: 5 } },
    client: {
      ac: 15,
      weight: 2.2,
      stats: { END: 22, STR: 8, STA: 10, DEX: 10 },
      svVoid: 5,
    },
  },
  {
    item: 'Shadow Rage Leggings',
    at: 4,
    wiki: { ac: 12, weight: 4.5, stats: { WIS: 6, AGI: 6, END: 10, SV_FIRE: 2, SV_DISEASE: 8 } },
    client: {
      ac: 16,
      weight: 2.9,
      stats: { WIS: 10, AGI: 10, END: 14, SV_FIRE: 6, SV_DISEASE: 12 },
      svVoid: 4,
    },
  },
];

describe('the Shadow Rage client captures of 2026-09-02', () => {
  it.each(CAPTURES)('reproduces $item at +$at from the wiki block alone', (capture) => {
    const state = tier(capture.at);

    expect(scalePrimary(capture.wiki.ac, state), 'AC').toBe(capture.client.ac);

    for (const [field, base] of Object.entries(capture.wiki.stats)) {
      expect(scalePrimary(base, state), field).toBe(capture.client.stats[field]);
    }

    // Weight is the strongest single check here: it is a log2 curve with a
    // ceil-to-one-decimal, so a wrong base or a wrong curve misses by a tenth.
    expect(scaleWeight(capture.wiki.weight, state), 'weight').toBe(capture.client.weight);

    // The synthetic save the client invents and no wiki page carries.
    expect(voidBonus(Object.keys(capture.wiki.stats), state), 'SV Void')
      .toBe(capture.client.svVoid);
  });

  /*
   * The count matters. Three items, and every printed field on each of them —
   * not a sampled field per item — is 23 independent predictions, none of which
   * the model was fitted to. The set's stat blocks are shipped on the strength
   * of this block, so it states its own size.
   *
   * It said 24 when first written, because the number was typed rather than
   * counted, and the assertion below caught it on the first run. Leaving the
   * note here because this file is the evidence for restoring a withheld stat
   * block, and it should be visible that its own arithmetic was checked.
   */
  it('checks every printed field, and there are 23 of them', () => {
    const fields = CAPTURES.reduce(
      (n, c) => n + 2 + Object.keys(c.wiki.stats).length + 1,
      0,
    );
    expect(fields).toBe(23);
  });
});
