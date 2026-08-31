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

import { existsSync, readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import {
  REQUIRED_ENGINE_VERSION, UNAVAILABLE_TEXT, gapAvailability, hasMeasuredLandings,
  type GapMeasured,
} from './gapEngine';

const LINES = ['[Mon Aug 31 12:00:00 2026] You crush a rat for 10 points of damage.'];
const CTX = { character: 'T', trio: ['WAR'], level: 50 };

const goodMeasured: GapMeasured = {
  engaged_seconds: 218,
  melee_seconds: 222,
  damage_dealt: 18844,
  months_seen: 1,
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
    const r = gapAvailability({ version: '1.2.0' }, LINES, CTX);
    expect(r.available).toBe(false);
  });

  it('refuses an OLDER engine', () => {
    const r = gapAvailability(engine({ version: '1.1.0' }), LINES, CTX);
    expect(r.available).toBe(false);
    if (r.available) throw new Error('unreachable');
    expect(r.version).toBe('1.1.0');
  });

  /**
   * A newer engine is not automatically readable. 1.2.0 changed `months_seen`
   * from `["Aug"]` to `2` within an hour of shipping; a version we have not
   * read the contract for can move a field under us the same way.
   */
  it('refuses a NEWER engine too, because newer is not the same as compatible', () => {
    expect(gapAvailability(engine({ version: '1.3.0' }), LINES, CTX).available).toBe(false);
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
 * Against the bundle actually vendored in this repository.
 * ------------------------------------------------------------------------- */

const VENDORED = 'public/vendor/eqls-gap-engine.js';

describe('the vendored bundle', () => {
  const present = existsSync(VENDORED);

  it.skipIf(!present)('loads, declares the required version, and is readable', () => {
    const sandbox: Record<string, unknown> = {};
    vm.createContext(sandbox);
    vm.runInContext(readFileSync(VENDORED, 'utf8'), sandbox);
    const global = sandbox.EQLSGapEngine as never;

    const r = gapAvailability(global, [
      '[Mon Aug 31 23:59:40 2026] You crush a rat for 10 points of damage.',
      '[Mon Aug 31 23:59:48 2026] You crush a rat for 10 points of damage.',
      '[Tue Sep 01 00:00:20 2026] You crush a rat for 10 points of damage.',
      '[Tue Sep 01 00:00:58 2026] You have slain a rat!',
    ], CTX);

    expect(r.available).toBe(true);
    if (!r.available) throw new Error('unreachable');
    expect(r.version).toBe(REQUIRED_ENGINE_VERSION);
    // The int, not the list. Guards the contract-fixture defect at the seam.
    expect(typeof r.measured.months_seen).toBe('number');
  });

  it.skipIf(!present)('is pinned to a commit, not a branch', () => {
    const p = JSON.parse(readFileSync('public/vendor/eqls-gap-engine.provenance.json', 'utf8'));
    expect(p.source.commit).toMatch(/^[0-9a-f]{40}$/);
    expect(p.source.url).toContain(p.source.commit);
    expect(p.version).toBe(REQUIRED_ENGINE_VERSION);
  });
});
