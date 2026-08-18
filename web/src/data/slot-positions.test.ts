/**
 * The payload and the app must agree about how many places a player has.
 *
 * `meta.slots.worn` is 18 slot TYPES. A reader asking how many slots a set has
 * wants POSITIONS — 23 — because Ear, Wrist and Fingers are each worn twice and
 * the two EQL-specific Any Slots sit on top. Until 2026-08-18 the payload
 * published only the 18, so 23 could be reached only by presuming, and
 * 18 + 2 = 20 is the answer presumption actually gives.
 *
 * `pipeline/build.mjs` mirrors DOUBLED_SLOTS rather than importing it — the
 * pipeline deliberately does not import from `web/src`, so that a mistake in
 * one cannot validate itself in the other. This test is the seam where the two
 * copies are forced to agree.
 */

import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DOUBLED_SLOTS, SLOT_POSITIONS, SLOT_TYPES, TOTAL_POSITIONS } from '../engine/constants';

const META = 'public/data/meta.json';
const published = existsSync(META);

describe.skipIf(!published)('published slot positions', () => {
  const meta = JSON.parse(readFileSync(META, 'utf8'));
  const positions = meta.slots?.positions;

  it('publishes the number a reader should be told', () => {
    expect(positions?.total, 'meta.slots.positions.total is missing').toBe(TOTAL_POSITIONS);
    expect(positions.total).toBe(23);
  });

  it('agrees with the app about types, doubling and Any Slots', () => {
    expect(positions.types).toBe(SLOT_TYPES.length);
    expect([...positions.doubled].sort()).toEqual([...DOUBLED_SLOTS].sort());
    expect(positions.worn).toBe(SLOT_POSITIONS.filter((p) => p.type !== 'ANY').length);
    expect(positions.any).toBe(SLOT_POSITIONS.filter((p) => p.type === 'ANY').length);
  });

  it('keeps the two questions distinguishable', () => {
    // The failure this exists to prevent: reading the type count as the slot count.
    expect(meta.slots.types.length).toBe(18);
    expect(meta.slots.types.length).not.toBe(positions.total);
    // The key was `worn` while holding types, which is the fault this whole
    // block exists to prevent. It must not come back.
    expect(meta.slots.worn, 'slots.worn was renamed to slots.types').toBeUndefined();
    expect(positions.worn + positions.any).toBe(positions.total);
  });
});
