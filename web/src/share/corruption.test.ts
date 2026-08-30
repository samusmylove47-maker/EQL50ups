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

  /*
   * REVERSED 2026-08-30, on the Director's ruling: refuse, and fail loudly.
   *
   * This test used to assert that a v2 frame still decoded, under "old links
   * stay shareable". The steps it performs — set the version byte to 2, drop
   * the two trailing checksum bytes — are exactly a downgrade attack on the
   * checksum guarded four tests above it, and the two assertions sat in one
   * file contradicting each other without anyone noticing. Accepting v2 does
   * not skip the check, it removes it: measured on this fixture, 71 of 89
   * single-bit corruptions of a downgraded frame decoded as a valid plan,
   * against 0 of 89 on the intact link.
   *
   * Nothing is lost. `SHARE_VERSION` was already 3 in the first commit that
   * could deploy at all (`486cf5f`; the checksum landed twenty minutes earlier
   * in `39a89b8`), so no published build of this app has ever written a v2
   * link and "old links" in that shape do not exist.
   */
  const downgraded = () => {
    const v3 = Buffer.from(encodePlan(plan()).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    const v2 = Uint8Array.from(v3.subarray(0, v3.length - 2));
    v2[0] = 2;
    return Buffer.from(v2).toString('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };

  it('refuses a v2 link, because nothing about it can be verified', () => {
    expect(SHARE_VERSION).toBe(3);
    const result = decodePlanDetailed(downgraded());
    expect(result.plan, 'a frame with no checksum must not yield a plan').toBeNull();
    expect(result.failure).toBe('unverifiable');
  });

  it('names that refusal distinctly from a damaged link', () => {
    // Not 'corrupt': the bytes are intact. Not 'malformed': it parses. The
    // reader is owed the difference, because the remedy is different.
    const f = decodePlanDetailed(downgraded()).failure;
    expect(f).not.toBe('corrupt');
    expect(f).not.toBe('malformed');
  });

  it('refuses every corruption of a downgraded frame as well', () => {
    const bytes = Uint8Array.from(
      Buffer.from(downgraded().replace(/-/g, '+').replace(/_/g, '/'), 'base64'),
    );
    let decoded = 0;
    let tried = 0;
    for (let i = 1; i < bytes.length; i++) {
      const c = Uint8Array.from(bytes);
      c[i] = ((c[i] as number) ^ 0x01) & 0xff;
      tried += 1;
      const payload = Buffer.from(c).toString('base64')
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      if (decodePlanDetailed(payload).plan) decoded += 1;
    }
    expect(tried, 'the sweep must actually run').toBeGreaterThan(50);
    expect(decoded, `${decoded} of ${tried} corrupted v2 frames still decoded`).toBe(0);
  });
});
