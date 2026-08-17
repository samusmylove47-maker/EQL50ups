/**
 * Correctness regressions.
 *
 * Every assertion here exists because the behaviour it pins was once wrong and
 * would have shown a player a number the game does not agree with. Where a
 * rule is confirmed by the live client the fixture cites
 * `research/validation/TIER0-VALIDATION.md`; where it is only inferred, the
 * test says so rather than dressing the inference up as ground truth.
 */

import { describe, expect, it } from 'vitest';
import { computeTotals, resolveItem } from './stats';
import { scoreItem } from './ep';
import { tier } from './upgrade';
import { isTier0Confirmed, ATTRIBUTE_CAP } from './constants';
import type { Item } from './types';

function mk(patch: Partial<Item>): Item {
  return {
    id: null, n: 'Test Item', sl: [], cl: ['ALL'], ra: ['ALL'],
    st: {}, sv: {}, fl: [], av: true, ...patch,
  };
}

/* ------------------------------------------------------------------ *
 * Tier 0 fixtures, end to end through the aggregation layer
 * ------------------------------------------------------------------ */

describe('Tier 0: Earthshaker resolves exactly as the client prints it', () => {
  const earthshaker = mk({
    n: 'Earthshaker',
    sl: ['PRIMARY'],
    cl: ['WAR', 'PAL', 'RNG', 'SHD', 'BER'],
    st: { STR: 6, STA: 6, DEX: -5 },
    wp: { dmg: 37, dly: 70, skill: '2H Slashing' },
  });

  it('at +10 reads dmg 74 / delay 70 / ratio 1.057, STR 16, STA 16, SV Void 10', () => {
    const totals = computeTotals([{ position: 'PRIMARY', item: earthshaker, upgrade: tier(10) }]);
    expect(totals.weapons.primary?.damage).toBe(74);
    expect(totals.weapons.primary?.delay).toBe(70);
    expect(Number(totals.weapons.primary?.ratio.toFixed(3))).toBeCloseTo(1.057, 3);
    expect(totals.attributes.STR).toBe(16);
    expect(totals.attributes.STA).toBe(16);
    expect(totals.saves.VOID).toBe(10);
  });

  it('prints no Dexterity line at +10, because -5 shrinks to 0', () => {
    const resolved = resolveItem(earthshaker, tier(10));
    expect(resolved.attributes.DEX).toBe(0);
    expect(computeTotals([{ position: 'PRIMARY', item: earthshaker, upgrade: tier(10) }]).attributes.DEX)
      .toBe(0);
  });

  it('still shows the penalty at the tiers where it has not yet closed', () => {
    expect(resolveItem(earthshaker, tier(0)).attributes.DEX).toBe(-5);
    expect(resolveItem(earthshaker, tier(3)).attributes.DEX).toBe(-2);
    expect(resolveItem(earthshaker, tier(5)).attributes.DEX).toBe(0);
  });
});

describe('Tier 0: Whitened Treant Fists', () => {
  const fists = mk({
    n: 'Whitened Treant Fists',
    sl: ['PRIMARY', 'SECONDARY'],
    cl: ['MNK'],
    wp: { dmg: 14, dly: 28 },
  });

  it('reads 14/15/16/18 damage at +0..+3 with delay pinned at 28', () => {
    const seen = [0, 1, 2, 3].map((t) => {
      const totals = computeTotals([{ position: 'PRIMARY', item: fists, upgrade: tier(t) }]);
      return [totals.weapons.primary?.damage, totals.weapons.primary?.delay];
    });
    expect(seen).toEqual([[14, 28], [15, 28], [16, 28], [18, 28]]);
  });

  it('gains no synthetic Void, because it carries no attribute or save at all', () => {
    for (const t of [0, 1, 5, 10]) {
      expect(computeTotals([{ position: 'PRIMARY', item: fists, upgrade: tier(t) }]).saves.VOID).toBe(0);
    }
  });
});

/* ------------------------------------------------------------------ *
 * Double counting
 * ------------------------------------------------------------------ */

describe('SV Void is never counted twice', () => {
  // pipeline/README.md §6: these two wiki pages are captures of already-upgraded
  // items, and their printed Void is exactly the synthetic value at that tier.
  const anthemion = mk({
    n: 'Anthemion Armbands', sl: ['WRIST'], cl: ['BST'],
    st: { AC: 5, DEX: 9, STA: 4, STR: 5 }, sv: { COLD: 7, VOID: 2 },
  });
  const darkspun = mk({
    n: 'Darkspun Shroud', sl: ['SHOULDERS'],
    st: { AC: 3, AGI: 7, CHA: 5 }, sv: { COLD: 3, MAGIC: 3, POISON: 3, VOID: 1 },
  });

  it('reconciles a printed Void with the synthetic one instead of adding them', () => {
    // Summing gave 22 here, overstating the resist by 12.
    expect(resolveItem(anthemion, tier(10)).saves.VOID).toBe(12);
    expect(resolveItem(darkspun, tier(10)).saves.VOID).toBe(11);
  });

  it('never lets the Void line fall as the tier rises', () => {
    let previous = -Infinity;
    for (let t = 0; t <= 10; t++) {
      const value = resolveItem(anthemion, tier(t)).saves.VOID ?? 0;
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });

  it('leaves an item with no printed Void on the pure synthetic value', () => {
    const plain = mk({ st: { STR: 5, STA: 5 } });
    expect(resolveItem(plain, tier(7)).saves.VOID).toBe(7);
  });
});

describe('a save spelled several ways resolves once', () => {
  it('does not sum aliases of the same resist', () => {
    const item = mk({ st: { 'SV FIRE': 10 }, sv: { FIRE: 10, SV_FIRE: 10 } });
    expect(resolveItem(item, tier(0)).saves.FIRE).toBe(10);
  });

  it('reads the resist whichever single spelling carries it', () => {
    for (const key of ['SV FIRE', 'SV_FIRE', 'FIRE']) {
      expect(resolveItem(mk({ sv: { [key]: 12 } }), tier(0)).saves.FIRE).toBe(12);
    }
  });

  it('counts an aliased resist once toward the Void trigger, not twice', () => {
    // FIRE under three spellings is one field, so it cannot trigger Void alone.
    const oneField = mk({ st: { 'SV FIRE': 10 }, sv: { FIRE: 10, SV_FIRE: 10 } });
    expect(resolveItem(oneField, tier(5)).saves.VOID).toBeUndefined();
  });
});

describe('worn haste takes the highest, never the sum', () => {
  it('keeps only the best of two haste items', () => {
    const a = mk({ n: 'A', st: { HASTE: 21 } });
    const b = mk({ n: 'B', st: { HASTE: 40 } });
    const totals = computeTotals([
      { position: 'WRIST_1', item: a, upgrade: tier(0) },
      { position: 'WRIST_2', item: b, upgrade: tier(0) },
    ]);
    expect(totals.haste).toBe(40);
  });

  it('compares the upgraded values, not the base ones', () => {
    const small = mk({ n: 'S', st: { HASTE: 21 } });
    const big = mk({ n: 'B', st: { HASTE: 40 } });
    const totals = computeTotals([
      { position: 'WRIST_1', item: big, upgrade: tier(5) },
      { position: 'WRIST_2', item: small, upgrade: tier(0) },
    ]);
    expect(totals.haste).toBe(45);
  });
});

describe('doubled positions contribute once each', () => {
  const ring = mk({ n: 'Ring', sl: ['FINGERS'], st: { STR: 10, AC: 5 } });

  it('counts one ring once and two rings twice', () => {
    const one = computeTotals([{ position: 'FINGERS_1', item: ring, upgrade: tier(0) }]);
    const two = computeTotals([
      { position: 'FINGERS_1', item: ring, upgrade: tier(0) },
      { position: 'FINGERS_2', item: ring, upgrade: tier(0) },
    ]);
    expect([one.attributes.STR, one.ac]).toEqual([10, 5]);
    expect([two.attributes.STR, two.ac]).toEqual([20, 10]);
  });

  it('sums weight in tenths, so the total does not depend on slot order', () => {
    // Adding one-decimal weights as floats gave 36.10000000000001 in one order
    // and 36.1 in the other, which made two identical sets compare unequal.
    const entries = [16, 7.3, 0.2, 3, 0.1, 8, 2, 1.5].map((wt, i) => ({
      position: `SLOT_${i}`,
      item: mk({ n: `W${i}`, wt }),
      upgrade: tier(i % 11),
    }));
    const forward = computeTotals(entries).weight;
    const backward = computeTotals([...entries].reverse()).weight;
    expect(backward).toBe(forward);
    expect(Number.isInteger(Math.round(forward * 10))).toBe(true);
    expect(forward).toBe(Math.round(forward * 10) / 10);
  });

  it('reads Earthshaker weight at +10 as the client prints it', () => {
    const earthshaker = mk({ n: 'Earthshaker', wt: 16, st: { STR: 6, STA: 6 } });
    expect(computeTotals([{ position: 'PRIMARY', item: earthshaker, upgrade: tier(10) }]).weight)
      .toBe(1.6);
  });

  it('treats an empty set as exactly zero everywhere', () => {
    const empty = computeTotals([]);
    expect(empty.attributes.STR).toBe(0);
    expect(empty.saves.VOID).toBe(0);
    expect(empty.ac + empty.hp + empty.mana + empty.haste + empty.attack).toBe(0);
  });
});

/* ------------------------------------------------------------------ *
 * Stats the resolver used to drop on the floor
 * ------------------------------------------------------------------ */

describe('every stat key the pipeline ships is resolved', () => {
  it('reads ENDUR_REGEN, which the shipped catalog spells that way', () => {
    // Talisman of Kejaar Kerrath — worn in the Tier 0 inventory.
    const talisman = mk({ n: 'Talisman of Kejaar Kerrath', sl: ['NECK'],
      st: { ENDUR_REGEN: 2, HP_REGEN: 2, MANA_REGEN: 2 } });
    const totals = computeTotals([{ position: 'NECK', item: talisman, upgrade: tier(0) }]);
    expect(totals.hpRegen).toBe(2);
    expect(totals.manaRegen).toBe(2);
    expect(totals.endRegen).toBe(2);
  });

  it('still accepts the older END_REGEN spelling', () => {
    const item = mk({ st: { END_REGEN: 3 } });
    expect(computeTotals([{ position: 'NECK', item, upgrade: tier(0) }]).endRegen).toBe(3);
  });

  it('reads skill damage modifiers into the panel that displays them', () => {
    const eyerazzia = mk({ n: 'Eyerazzia', sl: ['PRIMARY'], st: { BACKSTAB: 10, DEX: 5, STA: 4 } });
    const totals = computeTotals([{ position: 'PRIMARY', item: eyerazzia, upgrade: tier(0) }]);
    expect(totals.skillMods.BACKSTAB).toBe(10);
  });

  it('reads ATTACK', () => {
    const item = mk({ st: { ATTACK: 40 } });
    expect(computeTotals([{ position: 'PRIMARY', item, upgrade: tier(0) }]).attack).toBe(40);
  });

  it('sums skill modifiers across positions', () => {
    const a = mk({ n: 'A', st: { BACKSTAB: 6 } });
    const b = mk({ n: 'B', st: { BACKSTAB: 7 } });
    const totals = computeTotals([
      { position: 'PRIMARY', item: a, upgrade: tier(0) },
      { position: 'SECONDARY', item: b, upgrade: tier(0) },
    ]);
    expect(totals.skillMods.BACKSTAB).toBe(13);
  });
});

/* ------------------------------------------------------------------ *
 * Robustness: absent, zero, negative and outsized values
 * ------------------------------------------------------------------ */

describe('resolution survives whatever the catalog omits', () => {
  it('resolves an item with no stat containers at all', () => {
    const bare = { id: null, n: 'Bare', sl: [], cl: [], ra: [], fl: [], av: true } as unknown as Item;
    const resolved = resolveItem(bare, tier(6));
    expect(resolved.ac).toBe(0);
    expect(resolved.saves.VOID).toBeUndefined();
    expect(Object.keys(resolved.attributes)).toHaveLength(0);
  });

  it('omits a stat that resolves to zero rather than printing a zero line', () => {
    const zeroed = mk({ st: { STR: 0, AC: 0 } });
    expect(resolveItem(zeroed, tier(4)).attributes.STR).toBeUndefined();
  });

  it('never turns a penalty into a bonus, at any tier', () => {
    for (let t = 0; t <= 10; t++) {
      expect(resolveItem(mk({ st: { STR: -7 } }), tier(t)).attributes.STR ?? 0).toBeLessThanOrEqual(0);
    }
  });

  it('stays finite on outsized and non-numeric input', () => {
    const huge = resolveItem(mk({ st: { STR: 9_999, AC: 1e9 } }), tier(10));
    expect(Number.isFinite(huge.attributes.STR ?? 0)).toBe(true);
    expect(Number.isFinite(huge.ac)).toBe(true);
    const nonsense = resolveItem(
      mk({ st: { STR: NaN, AC: Infinity }, sv: { FIRE: NaN } }),
      tier(5),
    );
    expect(nonsense.attributes.STR ?? 0).toBe(0);
    expect(Number.isFinite(nonsense.ac)).toBe(true);
  });

  it('rises monotonically across every tier for a positive stat', () => {
    const item = mk({ st: { STR: 25, AC: 30, HP: 120 }, sv: { FIRE: 15 } });
    let last = { str: -1, ac: -1, hp: -1, fire: -1 };
    for (let t = 0; t <= 10; t++) {
      const r = resolveItem(item, tier(t));
      expect(r.attributes.STR ?? 0).toBeGreaterThanOrEqual(last.str);
      expect(r.ac).toBeGreaterThanOrEqual(last.ac);
      expect(r.hp).toBeGreaterThanOrEqual(last.hp);
      expect(r.saves.FIRE ?? 0).toBeGreaterThanOrEqual(last.fire);
      last = { str: r.attributes.STR ?? 0, ac: r.ac, hp: r.hp, fire: r.saves.FIRE ?? 0 };
    }
  });

  it('reads the banked fraction on the stats that documentation says use it', () => {
    // Half of tier 3 is banked: 4 of 2**3. Effective level 3.5.
    const banked = { full: 3, fraction: 4 };
    const item = mk({ st: { STR: 25, AC: 100 }, wp: { dmg: 37, dly: 70 } });
    const resolved = resolveItem(item, banked);
    // Truncated, not rounded. This expectation previously read 34, following
    // the third-party model's `excelRound`; Cloak of Flames settles it against
    // the client (SV Fire 15 at +7 prints 25, not 26), so the percentage
    // branch floors like weapon damage does.
    expect(resolved.attributes.STR).toBe(33); // 25 + floor(25*3.5/10)
    expect(resolved.ac).toBe(135); // 100 + floor(100*3.5/10)
    expect(resolved.weapon?.damage).toBe(49); // 37 + floor(37*3.5/10)
  });

  it('ignores the banked fraction on the base<=10 branch and on flat stats', () => {
    const item = mk({ st: { STR: 6, HASTE: 10 } });
    expect(resolveItem(item, { full: 3, fraction: 7 }).attributes.STR).toBe(9);
    expect(resolveItem(item, { full: 3, fraction: 7 }).flat.HASTE).toBe(13);
  });
});

/* ------------------------------------------------------------------ *
 * Scoring
 * ------------------------------------------------------------------ */

describe('cap-aware scoring credits only what a character can still feel', () => {
  const big = mk({ st: { STR: 100 } });

  it('credits the whole amount with room to spare', () => {
    expect(scoreItem(big, tier(0), { STR: 1 }).total).toBe(100);
  });

  it('credits only the portion below the ceiling', () => {
    const ctx = { existing: { attributes: { STR: ATTRIBUTE_CAP - 40 }, saves: {} } };
    expect(scoreItem(big, tier(0), { STR: 1 }, ctx).total).toBe(40);
  });

  it('credits nothing once the ceiling is already reached', () => {
    const ctx = { existing: { attributes: { STR: ATTRIBUTE_CAP }, saves: {} } };
    expect(scoreItem(big, tier(0), { STR: 1 }, ctx).total).toBe(0);
  });

  it('charges a penalty only where it actually moves the capped total', () => {
    const penalty = mk({ st: { STR: -20 } });
    // 600 -> 580 is still above 510, so nothing is really lost.
    const overCap = { existing: { attributes: { STR: 600 }, saves: {} } };
    expect(scoreItem(penalty, tier(0), { STR: 1 }, overCap).total).toBe(0);
    // 100 -> 80 is a real loss.
    const underCap = { existing: { attributes: { STR: 100 }, saves: {} } };
    expect(scoreItem(penalty, tier(0), { STR: 1 }, underCap).total).toBe(-20);
  });

  it('charges only the part of a penalty that crosses back under the cap', () => {
    const penalty = mk({ st: { STR: -30 } });
    const ctx = { existing: { attributes: { STR: ATTRIBUTE_CAP + 10 }, saves: {} } };
    // 520 -> 490: 10 of the 30 was wasted headroom, 20 is felt.
    expect(scoreItem(penalty, tier(0), { STR: 1 }, ctx).total).toBe(-20);
  });

  it('reports the wasted remainder so the UI can explain the loss', () => {
    const ctx = { existing: { attributes: { STR: ATTRIBUTE_CAP - 40 }, saves: {} } };
    const part = scoreItem(big, tier(0), { STR: 1 }, ctx).parts.find((p) => p.key === 'STR');
    expect(part?.capped).toBe(60);
  });

  it('is deterministic: the same inputs give byte-identical scores', () => {
    const ctx = { existing: { attributes: { STR: 120 }, saves: {} } };
    const a = scoreItem(big, tier(4), { STR: 1.5 }, ctx).total;
    const b = scoreItem(big, tier(4), { STR: 1.5 }, ctx).total;
    expect(a).toBe(b);
  });

  it('scores a weapon only where the position actually wields it', () => {
    const sword = mk({ n: 'Sword', sl: ['PRIMARY'], wp: { dmg: 40, dly: 20 } });
    expect(scoreItem(sword, tier(0), { RATIO: 40 }).total).toBe(80);
    expect(scoreItem(sword, tier(0), { RATIO: 40 }, { weaponCounts: false }).total).toBe(0);
  });

  it('agrees with the stat panel about an Any Slot weapon contributing no weapon', () => {
    const sword = mk({ n: 'Sword', sl: ['PRIMARY'], wp: { dmg: 40, dly: 20 } });
    const totals = computeTotals([{ position: 'ANY_1', item: sword, upgrade: tier(0) }]);
    expect(totals.weapons.primary).toBeUndefined();
    expect(totals.weapons.secondary).toBeUndefined();
    expect(scoreItem(sword, tier(0), { RATIO: 40, DMG: 1 }, { weaponCounts: false }).total).toBe(0);
  });

  it('scores the stats an Any Slot item does carry', () => {
    const shield = mk({ n: 'Nautilus Shield', sl: ['SECONDARY'], st: { AC: 20, STR: 5 } });
    expect(scoreItem(shield, tier(0), { AC: 1, STR: 1 }, { weaponCounts: false }).total).toBe(25);
  });
});

/* ------------------------------------------------------------------ *
 * Availability
 *
 * This list used to un-gate items the client hid. Since the purge it does more
 * than that: `pipeline/build.mjs` reads it to decide whether an out-of-era
 * record is shipped at all, so a name dropping out of it removes the item from
 * the catalog rather than merely hiding it.
 * ------------------------------------------------------------------ */

describe('items seen in a live client are never withheld', () => {
  it('recognises the names recovered from the Tier 0 inventory export', () => {
    expect(isTier0Confirmed("Hamed's Ring of Tears")).toBe(true);
    expect(isTier0Confirmed('selo`s drums of the march')).toBe(true);
    expect(isTier0Confirmed('Earthshaker')).toBe(false);
    expect(isTier0Confirmed(undefined)).toBe(false);
  });
});
