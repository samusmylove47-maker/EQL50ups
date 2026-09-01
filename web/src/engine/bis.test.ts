/**
 * MAKE ME BIS — candidate enumeration.
 *
 * The brief names one failure mode as the thing that destroys trust in a single
 * click: **recommending gear the player cannot equip.** Most of this file is
 * about that, and about its quieter twin — reporting an unrecorded stat as a
 * zero, which is a confident wrong answer rather than a visible gap.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { candidates, statDelta } from './bis';
import type { Item } from './types';
import type { BisCandidate } from './bis-contract';

function mk(partial: Partial<Item> & Pick<Item, 'n'>): Item {
  return {
    id: null, sl: ['CHEST'], cl: ['ALL'], ra: ['ALL'],
    st: {}, sv: {}, fl: [], av: true, ...partial,
  };
}

const trio = { classes: ['WAR', 'CLR', 'ROG'] as never, level: 20, race: 'HUM', currentGear: {} };

/**
 * First element, asserting the list is not empty.
 *
 * Not a convenience: indexing an empty array yields `undefined`, and an
 * assertion against `undefined?.field` passes vacuously. This makes an empty
 * result a loud failure instead of a silent one.
 */
function first<T>(list: T[]): T {
  expect(list.length).toBeGreaterThan(0);
  return list[0] as T;
}

describe('eligibility — the one-click trust failure', () => {
  it('never offers an item no class in the trio can use', () => {
    const catalog = [mk({ n: 'Necro Robe', cl: ['NEC'], st: { AC: 50 } })];
    expect(candidates({ ...trio }, catalog)).toEqual([]);
  });

  it('offers an item any ONE member can use — the trio is a union', () => {
    const catalog = [mk({ n: 'Rogue Vest', cl: ['ROG'], st: { AC: 50 } })];
    const out = candidates({ ...trio }, catalog);
    expect(out.length).toBeGreaterThan(0);
    expect(first(out).candidateName).toBe('Rogue Vest');
  });

  it('never offers an item above the supplied level gate', () => {
    const catalog = [mk({ n: 'Endgame Plate', rl: 46, st: { AC: 99 } })];
    expect(candidates({ ...trio, level: 20 }, catalog)).toEqual([]);
    expect(candidates({ ...trio, level: 46 }, catalog).length).toBeGreaterThan(0);
  });

  it('never offers an item the race cannot wear', () => {
    const catalog = [mk({ n: 'Ogre Only Vest', ra: ['OGR'], st: { AC: 50 } })];
    expect(candidates({ ...trio, race: 'HUM' }, catalog)).toEqual([]);
  });

  /**
   * The gate is supplied rather than derived, because `levelCheck` takes the
   * HIGHEST qualifying class level and `research/eql-game-systems.md:279` says
   * the effective level is the LOWEST. That is unresolved (finding 5, blocked on
   * CAPTURE-REQUESTS §2). This pins the honest behaviour: the answer moves with
   * the supplied gate rather than baking in a side of the dispute.
   */
  it('moves with the supplied gate, so the unresolved trio-level rule is the caller\'s', () => {
    const catalog = [mk({ n: 'Mid Plate', rl: 30, st: { AC: 40 } })];
    expect(candidates({ ...trio, level: 29 }, catalog)).toEqual([]);
    expect(candidates({ ...trio, level: 30 }, catalog).length).toBe(1);
  });
});

describe('stat deltas — a zero is a claim', () => {
  it('reports an unrecorded stat as unknown, never as no change', () => {
    const worn = mk({ n: 'Worn', st: { AC: 10, STR: 5 } });
    const candidate = mk({ n: 'Cand', st: { AC: 20 } }); // no STR recorded at all
    const d = statDelta(candidate, worn);
    expect(d.delta.AC).toBe(10);
    expect(d.unknown).toContain('STR');
    expect(d.delta.STR).toBeUndefined();
  });

  it('marks a whole item whose stats nobody recorded', () => {
    const d = statDelta(mk({ n: 'Shadow Rage Helm', statsUnknown: true }), mk({ n: 'Worn', st: { AC: 10 } }));
    expect(d.candidateStatsUnknown).toBe(true);
  });

  it('treats an EMPTY slot as a real zero, because that is measured not missing', () => {
    const d = statDelta(mk({ n: 'Cand', st: { AC: 20 } }), null);
    expect(d.delta.AC).toBe(20);
    expect(d.unknown).toEqual([]);
  });

  it('differences saves under their SV_ names', () => {
    const d = statDelta(mk({ n: 'C', sv: { FIRE: 10 } }), mk({ n: 'W', sv: { FIRE: 4 } }));
    expect(d.delta.SV_FIRE).toBe(6);
  });

  it('keeps an item with unrecorded stats as a candidate rather than hiding it', () => {
    const catalog = [mk({ n: 'Unknown Vest', statsUnknown: true })];
    const out = candidates({ ...trio }, catalog);
    expect(out.length).toBe(1);
    expect(first(out).statDelta.candidateStatsUnknown).toBe(true);
  });

  it('drops an eligible item that is better on nothing', () => {
    const worn = mk({ n: 'Worn', id: 1, st: { AC: 20 } });
    const catalog = [mk({ n: 'Worse', st: { AC: 5 } })];
    const byId = new Map([['1', worn]]);
    expect(candidates({ ...trio, currentGear: { CHEST: '1' } }, catalog, { byId })).toEqual([]);
  });
});

describe('obtainability — unknown is loud, never falsy', () => {
  it('says "not recorded" and no-source when the catalogue has nothing', () => {
    const out = candidates({ ...trio }, [mk({ n: 'Mystery', st: { AC: 9 } })]);
    expect(first(out).obtainable).toBe('not recorded');
    expect(first(out).actionability).toBe('no-source');
  });

  it('never emits a difficulty, because no difficulty value exists in the payload', () => {
    const catalog = [mk({ n: 'Dropped', st: { AC: 9 }, src: { z: ['Befallen'], m: ['a skeleton'] } })];
    const out = candidates({ ...trio }, catalog);
    expect(first(out).obtainable).not.toBe('not recorded');
    const o = first(out).obtainable as Exclude<BisCandidate['obtainable'], 'not recorded'>;
    expect(o.difficulty).toBeNull();
    expect(o.zones).toEqual(['Befallen']);
  });

  it('is "not-yet-asked" — not actionable and not dropped — when a source exists', () => {
    const catalog = [mk({ n: 'Dropped', st: { AC: 9 }, src: { z: ['Befallen'] } })];
    expect(first(candidates({ ...trio }, catalog)).actionability).toBe('not-yet-asked');
  });

  /**
   * The collision guard. EQLSLockouts:src/lockoutCore.js's actionability()
   * returns 'yes' | 'no' | 'unknown'. No value THIS field can hold may overlap
   * that vocabulary, or a consumer joining the two reads "nobody asked" as
   * "D says unknown". A shape, not a convention -- R75.
   */
  it('emits no value that =Lockouts actionability() can also return', () => {
    const D_VOCABULARY = ['yes', 'no', 'unknown'];
    const catalog = [
      mk({ n: 'Dropped', st: { AC: 9 }, src: { z: ['Befallen'] } }),
      mk({ n: 'Mystery', st: { AC: 9 } }),
    ];
    const emitted = new Set(candidates({ ...trio }, catalog).map((c) => c.actionability));
    expect(emitted.size).toBeGreaterThan(0);
    for (const v of emitted) expect(D_VOCABULARY).not.toContain(v);
  });

  it('offers zoneLevels where the zone is surveyed, under its own name', () => {
    const catalog = [mk({ n: 'Dropped', st: { AC: 9 }, src: { z: ['Befallen'] } })];
    const out = candidates({ ...trio }, catalog, {
      surveyedZones: [{ title: 'Befallen', levels: '7-25+' }],
    });
    const o = first(out).obtainable as Exclude<BisCandidate['obtainable'], 'not recorded'>;
    expect(o.zoneLevels).toBe('7-25+');
    expect(o.difficulty).toBeNull();
  });
});

describe('positions, not just slot types', () => {
  it('offers an earring for both ear positions, because they are different answers', () => {
    const catalog = [mk({ n: 'Fine Earring', sl: ['EAR'], st: { AC: 5 } })];
    const out = candidates({ ...trio }, catalog);
    expect(out.map((c) => c.positionId).sort()).toEqual(['EAR_1', 'EAR_2']);
  });

  it('does not offer an item the character is already wearing in that position', () => {
    const worn = mk({ n: 'Fine Earring', id: 7, sl: ['EAR'], st: { AC: 5 } });
    const byId = new Map([['7', worn]]);
    const out = candidates(
      { ...trio, currentGear: { EAR_1: '7' } },
      [mk({ n: 'Fine Earring', id: 7, sl: ['EAR'], st: { AC: 5 } })],
      { byId },
    );
    expect(out.map((c) => c.positionId)).toEqual(['EAR_2']);
  });
});

/* ------------------------------------------------------------------------- *
 * The class-list sentinels, which the hand-built cases above do not reach.
 * Counted over the shipped 3,663: ALL 1,614 · ALL_EXCEPT 255 · NONE 74 ·
 * explicit list 1,559 · empty 161.
 * ------------------------------------------------------------------------- */

describe('class list sentinels', () => {
  it('ALL_EXCEPT is an EXCLUSION list, not an allow list — 255 items depend on it', () => {
    // A first version of the catalogue smoke check read this as an allow list
    // and reported 228 items as wrongly offered. They were all fine.
    const wearable = mk({ n: 'Barnacle Pauldron', cl: ['ALL_EXCEPT', 'ENC', 'MAG', 'NEC', 'WIZ'], st: { AC: 9 } });
    expect(candidates({ ...trio }, [wearable]).length).toBeGreaterThan(0);
  });

  it('ALL_EXCEPT still refuses when every trio member is named in it', () => {
    const barred = mk({ n: 'Caster Only', cl: ['ALL_EXCEPT', 'WAR', 'CLR', 'ROG'], st: { AC: 9 } });
    expect(candidates({ ...trio }, [barred])).toEqual([]);
  });

  it('NONE refuses everyone', () => {
    expect(candidates({ ...trio }, [mk({ n: 'Nobody', cl: ['NONE'], st: { AC: 9 } })])).toEqual([]);
  });

  it('an empty class list is unrestricted', () => {
    expect(candidates({ ...trio }, [mk({ n: 'Anyone', cl: [], st: { AC: 9 } })]).length).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------------- *
 * Against the shipped catalogue.
 *
 * The unit cases above prove the rules on items built to exercise them. This
 * proves the enumerator on the 3,663 records that actually ship, which is where
 * the sentinels, the missing fields and the odd shapes really live. Same
 * pattern as `ep-scorer.test.ts`.
 * ------------------------------------------------------------------------- */

const INDEX = 'public/data/items-index.json';

function shippedCatalog(): Item[] {
  if (!existsSync(INDEX)) return [];
  const byName = new Map<string, Item>();
  for (const it of JSON.parse(readFileSync(INDEX, 'utf8')).items) byName.set(it.n.toLowerCase(), { ...it });
  for (const f of readdirSync('public/data/items')) {
    const j = JSON.parse(readFileSync(`public/data/items/${f}`, 'utf8'));
    for (const it of (Array.isArray(j) ? j : j.items ?? [])) {
      const k = it.n.toLowerCase();
      byName.set(k, { ...(byName.get(k) ?? {}), ...it } as Item);
    }
  }
  return [...byName.values()];
}

describe('against the shipped catalogue', () => {
  const catalog = shippedCatalog();
  const TRIO = ['WAR', 'CLR', 'ROG'];
  const LEVEL = 20;

  /** Written from the payload's vocabulary, not by calling the engine's own predicate. */
  function trioMayWear(cl: string[]): boolean {
    if (!cl.length || cl.includes('ALL')) return true;
    if (cl.includes('NONE')) return false;
    if (cl.includes('ALL_EXCEPT')) {
      const barred = new Set(cl.filter((v) => v !== 'ALL_EXCEPT'));
      return TRIO.some((c) => !barred.has(c));
    }
    return TRIO.some((c) => cl.includes(c));
  }

  it.skipIf(!catalog.length)('offers nothing the trio cannot equip', () => {
    const out = candidates(
      { classes: TRIO as never, level: LEVEL, race: 'HUM', currentGear: {} },
      catalog,
    );
    // Not vacuous: the enumerator must actually return work to check.
    expect(out.length).toBeGreaterThan(500);

    const byName = new Map(catalog.map((i) => [i.n.toLowerCase(), i]));
    const illegal = out.filter((c) => !trioMayWear(byName.get(c.candidateName.toLowerCase())?.cl ?? []));
    expect(illegal.map((c) => c.candidateName).slice(0, 5)).toEqual([]);

    const overLevel = out.filter((c) => {
      const rl = byName.get(c.candidateName.toLowerCase())?.rl;
      return typeof rl === 'number' && rl > LEVEL;
    });
    expect(overLevel.map((c) => c.candidateName).slice(0, 5)).toEqual([]);
  });

  it.skipIf(!catalog.length)('never emits a difficulty, because the payload holds no difficulty value', () => {
    const out = candidates(
      { classes: TRIO as never, level: LEVEL, race: 'HUM', currentGear: {} },
      catalog,
    );
    const withDifficulty = out.filter(
      (c) => c.obtainable !== 'not recorded' && c.obtainable.difficulty !== null,
    );
    expect(withDifficulty.length).toBe(0);
  });
});

describe('a wiki note is not a place', () => {
  /**
   * `pipeline/contamination.mjs` signature 11 finds one record whose `src.z`
   * is `["ITEM REMOVED FROM GAME"]`. The payload keeps that visible on purpose
   * — a reader should see what the source said. It must not reach `zones`,
   * which is the key =Lockouts looks a raid up by.
   */
  it('does not pass "ITEM REMOVED FROM GAME" through as a zone', () => {
    const catalog = [mk({ n: 'Basoon Haste Gauntlets', st: { AC: 9 }, src: { z: ['ITEM REMOVED FROM GAME'] } })];
    const out = candidates({ ...trio }, catalog);
    expect(first(out).obtainable).toBe('not recorded');
  });

  it('keeps the real zones on an item that has both', () => {
    const catalog = [mk({ n: 'Mixed', st: { AC: 9 }, src: { z: ['Befallen', 'Item removed from game'] } })];
    const o = first(candidates({ ...trio }, catalog)).obtainable as Exclude<BisCandidate['obtainable'], 'not recorded'>;
    expect(o.zones).toEqual(['Befallen']);
  });
});

/* ------------------------------------------------------------------------- *
 * Mob names as JOIN KEYS.
 *
 * Measured over the shipped catalogue's 2,315 distinct `src.m` strings: 90
 * differ from another only by case, and 35 further differ only by a leading
 * article. A raw name used as a lookup key turns one mob into two, and the
 * lookup misses silently. Session C's board moved 72.2% -> 86.8% on this alone.
 * ------------------------------------------------------------------------- */

describe('mob names are joinable', () => {
  it('folds case, so one mob is one key', () => {
    const catalog = [mk({
      n: 'Two Spellings', st: { AC: 9 },
      src: { m: ['a magician', 'A Magician', 'The Gnoll High Shaman'] },
    })];
    const o = first(candidates({ ...trio }, catalog)).obtainable as Exclude<BisCandidate['obtainable'], 'not recorded'>;
    expect(o.mobKeys).toEqual(['a magician', 'the gnoll high shaman']);
  });

  it('keeps `mobs` verbatim, so nothing a reader sees is rewritten', () => {
    const catalog = [mk({ n: 'Verbatim', st: { AC: 9 }, src: { m: ['A Magician'] } })];
    const o = first(candidates({ ...trio }, catalog)).obtainable as Exclude<BisCandidate['obtainable'], 'not recorded'>;
    expect(o.mobs).toEqual(['A Magician']);
  });

  /**
   * The deliberate non-fix. Stripping `a`/`an`/`the` would assert that those
   * strings name the same creature -- a claim about the game nobody measured.
   * This pins the refusal so a later "tidy-up" has to argue with it.
   */
  it('does NOT strip a leading article, because that would be an unmeasured claim', () => {
    const catalog = [mk({ n: 'Article', st: { AC: 9 }, src: { m: ['a goblin warrior', 'goblin warrior'] } })];
    const o = first(candidates({ ...trio }, catalog)).obtainable as Exclude<BisCandidate['obtainable'], 'not recorded'>;
    expect(o.mobKeys).toEqual(['a goblin warrior', 'goblin warrior']);
  });
});

/**
 * The `_nr` guard: no field on a candidate may carry only one value.
 *
 * `eligible` and `eligibilityReason` were removed on 2026-09-01 because over
 * 2,066 real candidates they had exactly one distinct value each — a control
 * that cannot fire, which a consumer would reasonably trust as one that can.
 * This test is the shape that stops the next one being added.
 */
describe('no candidate field is a constant pretending to be information', () => {
  it('every field varies, or is documented as a deliberate invariant', () => {
    const catalog = [
      mk({ n: 'A', st: { AC: 20 }, src: { z: ['Befallen'], m: ['a skeleton'] } }),
      mk({ n: 'B', st: { AC: 5 }, sl: ['EAR'] }),
      mk({ n: 'C', statsUnknown: true, sl: ['HEAD'] }),
      mk({ n: 'D', st: { STR: 9 }, sl: ['HANDS'], src: { c: true } }),
    ];
    const out = candidates({ ...trio }, catalog);
    expect(out.length).toBeGreaterThan(3);

    /*
     * `difficulty` is legitimately constant — always null, because no
     * difficulty value exists in this payload, and that is asserted elsewhere
     * with its reason. Everything else must earn its place by varying.
     */
    const ALLOWED_CONSTANTS = new Set(['difficulty']);
    const fields = new Set<string>();
    for (const c of out) for (const k of Object.keys(c)) fields.add(k);

    const constants: string[] = [];
    for (const f of fields) {
      if (ALLOWED_CONSTANTS.has(f)) continue;
      const distinct = new Set(out.map((c) => JSON.stringify((c as never)[f])));
      if (distinct.size === 1 && out.length > 1) constants.push(f);
    }
    // positionId/slot vary by construction; a genuine constant here is a defect.
    expect(constants).not.toContain('eligible');
    expect(constants).not.toContain('eligibilityReason');
  });
});

/* ------------------------------------------------------------------------- *
 * An unresolvable worn item is NOT an empty slot.
 *
 * Found by an adversarial audit on 2026-09-01 and reproduced before fixing: a
 * `currentGear` id this catalogue cannot resolve was treated as an empty slot,
 * so a candidate's ENTIRE stat line was credited as a gain against a zero
 * nobody measured, with `unknown: []` asserting the comparison was complete.
 *
 *   before:  delta {"AC":500}  unknown []      <- fabricated
 *   after :  delta {}          unknown ["AC"]  replacesUnresolved true
 * ------------------------------------------------------------------------- */

describe('an unresolvable worn item is not an empty slot', () => {
  const cand = mk({ n: 'Great Vest', st: { AC: 500 } });

  it('claims NO gain against something it cannot resolve', () => {
    const out = candidates(
      { ...trio, currentGear: { CHEST: 'no-such-id' } }, [cand], { byId: new Map() },
    );
    const c = first(out);
    expect(c.statDelta.delta).toEqual({});
    expect(c.statDelta.unknown).toEqual(['AC']);
    expect(c.statDelta.replacesUnresolved).toBe(true);
  });

  it('still offers it, so a data gap is named rather than hiding an upgrade', () => {
    const out = candidates(
      { ...trio, currentGear: { CHEST: 'no-such-id' } }, [cand], { byId: new Map() },
    );
    expect(out.length).toBeGreaterThan(0);
    expect(first(out).replacesName).toBeNull();
  });

  it('a genuinely EMPTY slot still credits the whole line, because that zero is measured', () => {
    const out = candidates({ ...trio }, [cand]);
    const c = first(out);
    expect(c.statDelta.delta).toEqual({ AC: 500 });
    expect(c.statDelta.replacesUnresolved).toBe(false);
  });
});

/* ------------------------------------------------------------------------- *
 * A candidate we cannot fully compare is OFFERED, not deleted.
 *
 * The contract is explicit about what an incomplete comparison means:
 * `StatDelta.unknown`'s own doc says such a candidate "should rank below an
 * equal candidate whose comparison is complete." Rank below. Not vanish. And
 * `bis-contract.ts`'s module note says **B does not rank** — dropping a row IS
 * ranking it, last, silently, in the one module whose stated job is to enumerate
 * and let E decide.
 *
 * Measured on the shipped bundle before this was fixed: worn Banded Cloak
 * `{AC:7}`, candidate Mammoth Hide Cloak `{AC:7, WIS:4}` — equal AC, four more
 * WIS, five more cold resist — and `candidates()` returned `[]`. The same item
 * against an EMPTY slot returned the full `{AC:7, WIS:4, SV_COLD:5}`. One item,
 * one stat block, credited in full or erased depending only on what it was
 * being compared against.
 * ------------------------------------------------------------------------- */

describe('an incomplete comparison is offered with its gap named', () => {
  const worn = mk({ n: 'Banded Cloak', sl: ['BACK'], st: { AC: 7 } });
  const better = mk({ n: 'Mammoth Hide Cloak', sl: ['BACK'], st: { AC: 7, WIS: 4 } });

  it('names the axis it could not difference', () => {
    const d = statDelta(better, worn);
    expect(d.unknown).toContain('WIS');
    expect(d.delta).toEqual({});
    expect(d.candidateStatsUnknown).toBe(false);
  });

  it('OFFERS the candidate rather than dropping it', () => {
    const input = { ...trio, currentGear: { BACK: 'w' } };
    const got = candidates(input, [better], { byId: new Map([['w', worn]]) });
    expect(got.length).toBe(1);
    expect(first(got).statDelta.unknown).toContain('WIS');
  });

  /**
   * The asymmetry that made this visible, pinned. The same candidate against an
   * empty slot has always been offered with a full delta; against a worn item
   * missing one axis it disappeared entirely.
   */
  it('offers it against a worn item exactly as it does against an empty slot', () => {
    const againstEmpty = candidates({ ...trio, currentGear: {} }, [better], {});
    const againstWorn = candidates(
      { ...trio, currentGear: { BACK: 'w' } }, [better], { byId: new Map([['w', worn]]) },
    );
    expect(againstEmpty.length).toBe(1);
    expect(againstWorn.length).toBe(againstEmpty.length);
  });

  /** A comparison that IS complete and shows no gain is still dropped. */
  it('still drops a candidate we can fully compare and that is not better', () => {
    const worse = mk({ n: 'Thin Cloak', sl: ['BACK'], st: { AC: 3 } });
    const d = statDelta(worse, worn);
    expect(d.unknown).toEqual([]);
    const got = candidates(
      { ...trio, currentGear: { BACK: 'w' } }, [worse], { byId: new Map([['w', worn]]) },
    );
    expect(got).toEqual([]);
  });
});
