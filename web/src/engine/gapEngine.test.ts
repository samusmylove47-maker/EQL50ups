/**
 * The degradation path, tested before the happy path.
 *
 * It is the branch that by definition never runs in development — the engine is
 * always present on a developer's machine — so the only way to know it works is
 * to exercise it deliberately. Every case below is a way the seam can fail at
 * three in the morning, and in every one the app must still ship an answer and
 * say what it cannot tell.
 *
 * The last describe block runs the REAL vendored bundle, so these are not only
 * assertions about a shape I invented.
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import {
  POPULATION_OF, REQUIRED_ENGINE_VERSION, UNAVAILABLE_TEXT, gapAvailability,
  hasMeasuredLandings, shareOfOutput,
  type GapMeasured,
} from './gapEngine';

const LINES = ['[Mon Aug 31 12:00:00 2026] You crush a rat for 10 points of damage.'];
const CTX = { character: 'T', trio: ['WAR'], level: 50 };

const goodMeasured: GapMeasured = {
  engaged_seconds: 218,
  melee_seconds: 222,
  damage_dealt: 18844,
  months_seen: 1,
  window: {
    basis: 'engaged',
    in_window: { hits: 402, damage: 18844 },
    all_lines: { hits: 611, damage: 27301 },
    keys_by_population: { in_window: ['damage_dealt'], all_lines: ['spells_landed'] },
  },
  spells_landed: {
    'Cannibalization I': {
      landings: 47, normalised_key: 'Cannibalize',
      damage_total: 0, damage_median: 0, damage_max: 0,
    },
    'Never Pressed': {
      landings: 0, normalised_key: 'Never Pressed',
      damage_total: 0, damage_median: 0, damage_max: 0,
    },
  },
};

const engine = (over: Record<string, unknown> = {}) => ({
  version: REQUIRED_ENGINE_VERSION,
  gapEngine: () => ({ measured: goodMeasured }),
  ...over,
});

describe('the degradation path — every one of these must still ship', () => {
  it('reports unavailable when the bundle never loaded at all', () => {
    const r = gapAvailability(undefined, LINES, CTX);
    expect(r.available).toBe(false);
    expect(r).toMatchObject({ version: null, why: UNAVAILABLE_TEXT });
  });

  it('reports unavailable when the global is there but the function is not', () => {
    const r = gapAvailability({ version: REQUIRED_ENGINE_VERSION }, LINES, CTX);
    expect(r.available).toBe(false);
  });

  it('refuses an OLDER engine', () => {
    const r = gapAvailability(engine({ version: '1.1.0' }), LINES, CTX);
    expect(r.available).toBe(false);
    if (r.available) throw new Error('unreachable');
    expect(r.version).toBe('1.1.0');
  });

  /**
   * The pin the Director held this re-vendor for. 1.2.0 is not a hypothetical
   * old version: it is the build that was vendored in this repository until
   * 1 Sep, and it lacks `measured.window` entirely — so a consumer that read it
   * would have no sound share denominator and no way to know that.
   *
   * Two byte-sets shipped as 1.2.0 in one night, which an exact-equality guard
   * cannot separate. This case is the proof that the guard discriminates now
   * that the version has actually moved.
   */
  it('refuses the PREVIOUSLY VENDORED 1.2.0', () => {
    const r = gapAvailability(engine({ version: '1.2.0' }), LINES, CTX);
    expect(r.available).toBe(false);
    if (r.available) throw new Error('unreachable');
    expect(r.version).toBe('1.2.0');
  });

  /**
   * A newer engine is not automatically readable. 1.2.0 changed `months_seen`
   * from `["Aug"]` to `2` within an hour of shipping; a version we have not
   * read the contract for can move a field under us the same way.
   */
  it('refuses a NEWER engine too, because newer is not the same as compatible', () => {
    expect(gapAvailability(engine({ version: '1.4.0' }), LINES, CTX).available).toBe(false);
    expect(gapAvailability(engine({ version: '2.0.0' }), LINES, CTX).available).toBe(false);
  });

  it('treats a throwing engine as an absent one', () => {
    const r = gapAvailability(
      engine({ gapEngine: () => { throw new Error('boom'); } }), LINES, CTX,
    );
    expect(r.available).toBe(false);
  });

  /**
   * The defect the hand-written contract fixture actually caught. The spec said
   * "count of distinct month tokens"; the first 1.2.0 build shipped the thing
   * being counted. A generated fixture would have recorded `["Aug"]` and called
   * it correct.
   */
  it('refuses a right-versioned engine that emits months_seen as a LIST', () => {
    const wrong = { ...goodMeasured, months_seen: ['Aug'] as unknown as number };
    const r = gapAvailability(engine({ gapEngine: () => ({ measured: wrong }) }), LINES, CTX);
    expect(r.available).toBe(false);
  });

  it('refuses a report with no measured block', () => {
    expect(gapAvailability(engine({ gapEngine: () => ({}) }), LINES, CTX).available).toBe(false);
  });

  /**
   * The defect 1.3.0 exists to fix, guarded at our end rather than trusted.
   *
   * Without `window` there is no sound denominator for a share, and the obvious
   * wrong one — `damage_dealt` — does not fail: it returns a plausible
   * percentage. 202% on the log the engine was built against, 324% on a short
   * one, 34% on another. An engine that will not say which population a number
   * is over is one this app declines to divide by, so the whole lane goes to
   * the unknown band rather than shipping a number that looks fine.
   */
  it('refuses an engine that will not say which population its numbers are over', () => {
    const noWindow = { ...goodMeasured } as Partial<GapMeasured>;
    delete noWindow.window;
    expect(gapAvailability(
      engine({ gapEngine: () => ({ measured: noWindow }) }), LINES, CTX,
    ).available).toBe(false);

    for (const bad of [
      { ...goodMeasured.window, all_lines: { hits: 611 } },
      { ...goodMeasured.window, in_window: null },
      { ...goodMeasured.window, all_lines: { hits: 611, damage: '27301' } },
    ]) {
      const measured = { ...goodMeasured, window: bad as never };
      expect(gapAvailability(
        engine({ gapEngine: () => ({ measured }) }), LINES, CTX,
      ).available).toBe(false);
    }
  });

  it('always names WHY, so a quiet lane is never mistaken for an empty one', () => {
    for (const bad of [undefined, engine({ version: '0.9.0' }), engine({ gapEngine: null })]) {
      const r = gapAvailability(bad as never, LINES, CTX);
      if (r.available) throw new Error('expected unavailable');
      expect(r.why).toContain('never learned it');
      expect(r.why).toContain('never pressed it');
    }
  });
});

describe('the happy path', () => {
  it('reads the measured block at the exact required version', () => {
    const r = gapAvailability(engine(), LINES, CTX);
    expect(r.available).toBe(true);
    if (!r.available) throw new Error('unreachable');
    expect(r.measured.months_seen).toBe(1);
    expect(typeof r.measured.months_seen).toBe('number');
  });
});

describe('a landing count of zero is not evidence of disuse', () => {
  it('is true only where a spell actually landed', () => {
    expect(hasMeasuredLandings(goodMeasured, 'Cannibalization I')).toBe(true);
  });

  it('is false at zero landings — indistinguishable from a vocabulary miss', () => {
    expect(hasMeasuredLandings(goodMeasured, 'Never Pressed')).toBe(false);
  });

  it('is false for a spell the engine never mentioned', () => {
    expect(hasMeasuredLandings(goodMeasured, 'Not In The Report')).toBe(false);
  });
});

/* ------------------------------------------------------------------------- *
 * The denominator. This is the defect, not a rounding preference.
 * ------------------------------------------------------------------------- */

describe('a share is only a share against its own population', () => {
  /**
   * The exact division our own published contract named, with the numbers the
   * engine reports. `damage_dealt` is window-scoped and `spells_landed` is
   * whole-log, so the wrong denominator inflates rather than errors.
   */
  it('divides by all_lines.damage, never by damage_dealt', () => {
    expect(shareOfOutput(goodMeasured, 12000)).toBeCloseTo(12000 / 27301, 12);
    expect(shareOfOutput(goodMeasured, 12000)).not.toBeCloseTo(12000 / 18844, 6);
  });

  it('is bounded at 1 where the wrong denominator would exceed it', () => {
    // Whole-log damage attributed to spells, divided the two ways.
    const attributed = goodMeasured.window.all_lines.damage;
    expect(shareOfOutput(goodMeasured, attributed)).toBe(1);
    expect(attributed / goodMeasured.damage_dealt).toBeGreaterThan(1);
  });

  it('returns null rather than Infinity when nothing was measured', () => {
    const empty = {
      ...goodMeasured,
      window: { ...goodMeasured.window, all_lines: { hits: 0, damage: 0 } },
    };
    expect(shareOfOutput(empty, 500)).toBeNull();
  });
});

/* ------------------------------------------------------------------------- *
 * The hand-written contract, actually loaded.
 *
 * Between 31 Aug and 1 Sep nothing in this repository read this file — a
 * document claiming to be a check. The version in its FILENAME went stale the
 * moment the pin moved, which is why the version now lives in a field these
 * tests compare.
 * ------------------------------------------------------------------------- */

const CONTRACT = JSON.parse(
  readFileSync('src/engine/__fixtures__/gap-contract.json', 'utf8'),
) as { assertedEngineVersion: string; measured: GapMeasured };

describe('the published contract fixture', () => {
  it('asserts the version this module actually requires', () => {
    expect(CONTRACT.assertedEngineVersion).toBe(REQUIRED_ENGINE_VERSION);
  });

  it('is a block this consumer accepts — the fixture IS the acceptance test', () => {
    const r = gapAvailability(
      { version: REQUIRED_ENGINE_VERSION, gapEngine: () => ({ measured: CONTRACT.measured }) },
      LINES, CTX,
    );
    expect(r.available).toBe(true);
    if (!r.available) throw new Error('unreachable');
    expect(typeof r.measured.months_seen).toBe('number');
    expect(shareOfOutput(r.measured, 4104)).toBeCloseTo(4104 / 27301, 12);
  });

  it('names the raw log string as the key, with the normalised name as a value', () => {
    const entry = CONTRACT.measured.spells_landed['Cannibalization I'];
    expect(entry?.normalised_key).toBe('Cannibalize');
    expect(CONTRACT.measured.spells_landed.Cannibalize).toBeUndefined();
  });
});

/* ------------------------------------------------------------------------- *
 * Against the bundle actually vendored in this repository.
 * ------------------------------------------------------------------------- */

const VENDORED = 'public/vendor/eqls-gap-engine.js';

/**
 * One continuous fight across the 31 Aug / 1 Sep boundary, dense enough to
 * register as an engagement rather than as scattered hits.
 *
 * Generated rather than typed: forty lines written by hand is forty chances to
 * fat-finger a timestamp, and the engagement window is exactly what is under
 * test.
 */
const MONTH_BOUNDARY_FIGHT: string[] = [
  ...Array.from({ length: 10 }, (_, i) =>
    `[Mon Aug 31 23:59:${String(40 + i * 2).padStart(2, '0')} 2026] You crush a rat for 10 points of damage.`),
  ...Array.from({ length: 30 }, (_, i) =>
    `[Tue Sep 01 00:00:${String(i * 2).padStart(2, '0')} 2026] You crush a rat for 10 points of damage.`),
  '[Tue Sep 01 00:00:58 2026] You have slain a rat!',
];

describe('the vendored bundle', () => {
  const present = existsSync(VENDORED);

  it.skipIf(!present)('loads, declares the required version, and is readable', () => {
    const sandbox: Record<string, unknown> = {};
    vm.createContext(sandbox);
    vm.runInContext(readFileSync(VENDORED, 'utf8'), sandbox);
    const global = sandbox.EQLSGapEngine as never;

    const r = gapAvailability(global, MONTH_BOUNDARY_FIGHT, CTX);

    expect(r.available).toBe(true);
    if (!r.available) throw new Error('unreachable');
    expect(r.version).toBe(REQUIRED_ENGINE_VERSION);
    // The int, not the list. Guards the contract-fixture defect at the seam.
    expect(typeof r.measured.months_seen).toBe('number');
    expect(r.measured.months_seen).toBe(2);
  });

  /**
   * The behaviour the pin exists for, actually exercised.
   *
   * **This test used to feed four log lines and assert nothing they could
   * move.** Measured 2026-09-01, those four lines through the pinned bundle:
   * `engagements 0, engaged_seconds 0, damage_dealt 0`. The assertions above —
   * available, right version, `months_seen` is a number — are all true of a
   * measurement of nothing, so the fixture proved the engine loaded and
   * nothing else. The month-boundary defect the provenance file describes could
   * have been reintroduced and this suite would not have moved.
   *
   * The fixture is now dense enough to BE an engagement, and the numbers below
   * are the ones `eqls-gap-engine.provenance.json` claims: one continuous fight
   * spanning 31 Aug 23:59 into 1 Sep 00:00 as **one** engagement of **78
   * seconds**. A build whose day index runs backwards across a month boundary
   * splits it and both figures move.
   */
  it.skipIf(!present)('measures the month-boundary fight as ONE engagement of 78 seconds', () => {
    const sandbox: Record<string, unknown> = {};
    vm.createContext(sandbox);
    vm.runInContext(readFileSync(VENDORED, 'utf8'), sandbox);
    const global = sandbox.EQLSGapEngine as never;

    const r = gapAvailability(global, MONTH_BOUNDARY_FIGHT, CTX);
    expect(r.available).toBe(true);
    if (!r.available) throw new Error('unreachable');

    expect(r.measured.engaged_seconds).toBe(78);
    expect(r.measured.damage_dealt).toBe(400);
    // Not a measurement of nothing — the failure mode this fixture replaced.
    expect(r.measured.engaged_seconds).toBeGreaterThan(0);
    expect(r.measured.damage_dealt).toBeGreaterThan(0);
  });

  /**
   * The two filings this app depends on, asserted against the REAL bundle
   * rather than against a stub of my own making. If E ever re-files
   * `damage_dealt` or `spells_landed` under a different population, the sound
   * denominator changes and this fails — instead of a share quietly becoming
   * wrong by a factor nobody can see.
   */
  it.skipIf(!present)('files damage_dealt and spells_landed where we depend on them', () => {
    const sandbox: Record<string, unknown> = {};
    vm.createContext(sandbox);
    vm.runInContext(readFileSync(VENDORED, 'utf8'), sandbox);
    const global = sandbox.EQLSGapEngine as never;

    const r = gapAvailability(global, LINES, CTX);
    expect(r.available).toBe(true);
    if (!r.available) throw new Error('unreachable');

    const filed = r.measured.window.keys_by_population;
    for (const [key, population] of Object.entries(POPULATION_OF)) {
      expect(filed[population]).toContain(key);
    }
    // And they are genuinely different populations, or the distinction is moot.
    expect(POPULATION_OF.damage_dealt).not.toBe(POPULATION_OF.spells_landed);
  });

  it.skipIf(!present)('is pinned to a commit, not a branch', () => {
    const p = JSON.parse(readFileSync('public/vendor/eqls-gap-engine.provenance.json', 'utf8'));
    expect(p.source.commit).toMatch(/^[0-9a-f]{40}$/);
    expect(p.source.url).toContain(p.source.commit);
    expect(p.version).toBe(REQUIRED_ENGINE_VERSION);
  });

  /**
   * Two byte-sets shipped upstream as `1.2.0` in one night, 20,337 and 25,443
   * bytes. A version string alone could not tell them apart, so the provenance
   * records the hash and the byte count — and a recorded hash that nothing
   * compares is decoration. This is the comparison.
   */
  it.skipIf(!present)('records the hash and size of the bytes actually vendored', () => {
    const bytes = readFileSync(VENDORED);
    const p = JSON.parse(readFileSync('public/vendor/eqls-gap-engine.provenance.json', 'utf8'));
    expect(bytes.length).toBe(p.bytes);
    expect(createHash('sha256').update(bytes).digest('hex').slice(0, 8)).toBe(p.sha256_8);
    // The upstream filename is content-addressed; it must address THIS content.
    expect(p.source.path).toContain(p.sha256_8);
  });
});
