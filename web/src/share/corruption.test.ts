import { describe, it, expect } from 'vitest';
import { encodePlan, decodePlanDetailed, SHARE_VERSION } from './codec';
import { SLOT_POSITIONS } from '../engine/constants';
import { makeLevels } from '../engine/character';
import type { SharedPlan } from './codec';

/**
 * A corrupted link must fail loudly, not decode into a different plan.
 *
 * Before the checksum, two of thirty single-character corruptions of a real
 * 23-item link came back as a *valid* set with a slot quietly emptied. For a
 * product whose landing page says "the URL is the product", silently handing
 * someone a plan they did not build is the worst failure available: they cannot
 * tell it happened, so they plan around it.
 */

function plan(): SharedPlan {
  const slots: SharedPlan['set']['slots'] = {};
  for (const [i, position] of SLOT_POSITIONS.entries()) {
    slots[position.id] = {
      itemName: `Test Item ${i}`,
      upgrade: { full: i % 11, fraction: 0 },
    };
  }
  return {
    character: {
      name: 'Avenrae',
      race: 'HEF',
      levels: makeLevels({ BRD: 50, WAR: 50, BER: 50 }),
      loadouts: [{ id: 'l1', name: 'Main', classes: ['BRD', 'WAR', 'BER'] }],
      activeLoadoutId: 'l1',
    },
    set: { name: 'Main Set', slots, weights: { AC: 2, STR: 1 } },
  };
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

describe('a damaged share link is refused, never reinterpreted', () => {
  const payload = encodePlan(plan());

  it('round-trips intact', () => {
    const { plan: back, failure } = decodePlanDetailed(payload);
    expect(failure).toBeUndefined();
    expect(back?.set.name).toBe('Main Set');
    expect(Object.keys(back?.set.slots ?? {})).toHaveLength(SLOT_POSITIONS.length);
  });

  it('refuses every single-character substitution rather than decoding one', () => {
    let decoded = 0;
    let checked = 0;
    for (let i = 0; i < payload.length; i += 1) {
      for (const replacement of ['A', 'z', '7', '-']) {
        if (payload[i] === replacement) continue;
        const broken = payload.slice(0, i) + replacement + payload.slice(i + 1);
        checked += 1;
        if (decodePlanDetailed(broken).plan !== null) decoded += 1;
      }
    }
    expect(checked).toBeGreaterThan(200);
    // Two bytes cannot be perfect, but the old codec let ~7% through.
    expect(decoded / checked).toBeLessThan(0.001);
  });

  it('refuses a truncated link', () => {
    for (const cut of [1, 4, 20, payload.length - 1]) {
      expect(decodePlanDetailed(payload.slice(0, cut)).plan).toBeNull();
    }
  });

  it('refuses a link with characters appended', () => {
    for (const tail of ['A', 'zz', ALPHABET]) {
      expect(decodePlanDetailed(payload + tail).plan).toBeNull();
    }
  });

  it('names the failure so the screen can explain it', () => {
    const broken = payload.slice(0, 10) + (payload[10] === 'A' ? 'B' : 'A') + payload.slice(11);
    const result = decodePlanDetailed(broken);
    expect(result.plan).toBeNull();
    expect(['corrupt', 'malformed']).toContain(result.failure);
  });

  it('still reads a v2 link, which carries no checksum', () => {
    // Old links stay shareable: only the leading version byte distinguishes them.
    expect(SHARE_VERSION).toBe(3);
    const v3 = Buffer.from(
      encodePlan(plan()).replace(/-/g, '+').replace(/_/g, '/'),
      'base64',
    );
    const v2 = Uint8Array.from(v3.subarray(0, v3.length - 2));
    v2[0] = 2;
    const asPayload = Buffer.from(v2)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    expect(decodePlanDetailed(asPayload).plan?.set.name).toBe('Main Set');
  });
});
