/**
 * The front page's product shot, against the record it says it copies.
 *
 * `SAMPLE` in `Landing.tsx` is a hand-written Earthshaker used to render a real
 * item window on the landing page, and the page describes it as read off a live
 * client. It had drifted from the shipped record — and **not in its numbers**:
 * every stat matched exactly. What had drifted was the sourcing.
 *
 *   `ex: 'live-export'`  where the record holds `'measured-drop'`, so the
 *                        eyebrow read "Tier M · held in a live inventory"
 *                        against the record's "Tier M · seen dropping in game".
 *                        That UNDERSTATES evidence the payload holds: an `ms`
 *                        block recording Master Yael, 4 sightings over 4
 *                        sessions, 10-11 Aug 2026.
 *   `fx` missing         so the Effects group — proc Earthquake — was absent
 *                        from a window described as reproducing the client's.
 *
 * A reader who hovered Earthshaker anywhere else in the app saw a different
 * provenance line for the same item, on the one claim this project is judged by.
 *
 * Derived, not transcribed: the record is read from the shipped shard on every
 * run, so the shot cannot drift from it again without this failing.
 */

import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { normalizeCatalog } from '../data/normalize';
import type { Item } from '../engine/types';
import { SAMPLE_FOR_TEST } from './Landing';

const SHARD = 'public/data/items/PRIMARY.json';

describe.skipIf(!existsSync(SHARD))('the landing page product shot', () => {
  const shipped = normalizeCatalog(JSON.parse(readFileSync(SHARD, 'utf8')))
    .find((i: Item) => i.n === 'Earthshaker');

  it('finds the record it claims to copy', () => {
    expect(shipped, 'Earthshaker must be in the shipped PRIMARY shard').toBeTruthy();
  });

  it('states the same provenance the shipped record does', () => {
    // The two fields the item window renders its Tier M eyebrows from.
    expect(SAMPLE_FOR_TEST.ex, 'existence evidence').toBe(shipped?.ex);
    expect(SAMPLE_FOR_TEST.sd, 'source standing').toBe(shipped?.sd);
  });

  it('carries the same stats, weapon block and flags', () => {
    expect(SAMPLE_FOR_TEST.st).toEqual(shipped?.st);
    expect(SAMPLE_FOR_TEST.wp).toEqual(shipped?.wp);
    expect([...SAMPLE_FOR_TEST.fl].sort()).toEqual([...(shipped?.fl ?? [])].sort());
    expect(SAMPLE_FOR_TEST.cl).toEqual(shipped?.cl);
  });

  it('shows the effects the record carries, so the window is not missing a group', () => {
    const mine = (SAMPLE_FOR_TEST.fx ?? []).map((f) => `${f.k}:${f.n}`).sort();
    const theirs = (shipped?.fx ?? []).map((f) => `${f.k}:${f.n}`).sort();
    expect(mine).toEqual(theirs);
  });

  /**
   * The citation must count what it lists, and list what the record holds.
   *
   * The shipped payload's own `sd` citation enumerated SIX fields, claimed
   * NINE, and cited a table with SEVEN MATCH rows — three numbers for one
   * result, on the flagship Tier M item. Both sides now derive from the table.
   */
  it('claims exactly as many predictions as the record’s Earthshaker table holds', () => {
    const record = readFileSync('../research/validation/TIER0-VALIDATION.md', 'utf8');
    const table = record.slice(record.indexOf('### Earthshaker'));
    const rows = table.slice(0, table.indexOf('\n\n')).split('\n')
      .filter((l) => l.startsWith('|') && !l.startsWith('| Field') && !l.startsWith('|---'));
    const matches = rows.filter((l) => l.includes('MATCH')).length;
    expect(matches, 'the table must still be there').toBeGreaterThan(0);

    const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
    const word = WORDS[matches] as string;
    for (const [what, cite] of [
      ['the front page shot', SAMPLE_FOR_TEST.sdc ?? ''],
      ['the shipped record', shipped?.sdc ?? ''],
    ] as Array<[string, string]>) {
      expect(cite, `${what} must cite a count`).toContain('predictions exact');
      expect(cite, `${what} claims a different count than the table's ${matches}`)
        .toContain(`${word.charAt(0).toUpperCase()}${word.slice(1)} of ${word} predictions exact`);
      // And it must enumerate as many fields as it claims.
      const listed = (/— (.*?)\. [A-Z]/.exec(cite)?.[1] ?? '').split(', ').filter(Boolean);
      expect(listed.length, `${what} lists ${listed.length} fields but claims ${matches}`)
        .toBe(matches);
    }
  });
});
