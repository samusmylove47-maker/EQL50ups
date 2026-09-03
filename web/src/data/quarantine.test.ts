/**
 * The withheld catalog, and the promise that it stays true.
 *
 * `public/quarantine.json` is a derived file: `scripts/build-quarantine-index.mjs`
 * reduces `pipeline/quarantine.json` to name → reason. A derived file that is
 * committed rots the moment the pipeline reruns, and this one rots in the worst
 * possible direction — the app would explain an absence the pipeline has since
 * reversed, on the one screen built to earn the reader's trust. So the sync is
 * asserted here from the source of truth rather than assumed.
 */

import { existsSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { findQuarantined, parseQuarantineIndex, type QuarantineIndex } from './quarantine';

const SOURCE = '../pipeline/quarantine.json';
const SHIPPED = 'public/quarantine.json';

interface RawEntry {
  n?: unknown;
  why?: unknown;
}

const shippedRaw: unknown = JSON.parse(readFileSync(SHIPPED, 'utf8'));
const index = parseQuarantineIndex(shippedRaw) as QuarantineIndex;

describe('the shipped withheld list', () => {
  it('parses into a usable index', () => {
    expect(index).not.toBeNull();
    expect(index.names.length).toBe(index.counts.quarantined);
    expect(index.names.length).toBe(index.byName.size);
  });

  it('carries every name the pipeline withheld, under the pipeline’s own reason', () => {
    // Skipped rather than silently passing if the pipeline has not run here:
    // an absent source cannot prove a sync.
    if (!existsSync(SOURCE)) {
      throw new Error(`${SOURCE} is missing; the sync check cannot run`);
    }
    const raw = JSON.parse(readFileSync(SOURCE, 'utf8')) as { items?: RawEntry[]; counts?: Record<string, number> };
    const items = raw.items ?? [];

    expect(items.length).toBe(index.counts.quarantined);
    expect(raw.counts?.shipped).toBe(index.counts.shipped);
    expect(raw.counts?.before).toBe(index.counts.scraped);

    const missing: string[] = [];
    const mismatched: string[] = [];
    for (const entry of items) {
      if (typeof entry.n !== 'string' || typeof entry.why !== 'string') continue;
      // `?? -1`, never a truthiness test: position 0 is a real position.
      const at = index.byName.get(entry.n.toLowerCase()) ?? -1;
      if (at < 0) {
        missing.push(entry.n);
        continue;
      }
      const code = index.codes[at] as string;
      if (index.reasons[code]?.why !== entry.why) mismatched.push(`${entry.n} → ${entry.why}`);
    }
    expect(
      missing.slice(0, 5),
      `${missing.length} withheld names are not shipped; rerun web/scripts/build-quarantine-index.mjs`,
    ).toEqual([]);
    expect(
      mismatched.slice(0, 5),
      `${mismatched.length} names carry the wrong reason; rerun web/scripts/build-quarantine-index.mjs`,
    ).toEqual([]);
  });

  it('stays small enough to fetch on a dead search', () => {
    // A budget, not a measurement: the file is 174 KB / ~49 KB gzipped today,
    // it is fetched once and only after a search has already found nothing, and
    // it must not quietly grow into a second catalog download.
    const bytes = statSync(SHIPPED).size;
    expect(bytes).toBeLessThan(220 * 1024);
  });

  it('has prose for every reason, and claims absence only where the standard does', () => {
    expect(Object.keys(index.reasons).length).toBe(8);
    for (const [code, reason] of Object.entries(index.reasons)) {
      expect(reason.why, code).toBeTruthy();
      expect(reason.title, code).toBeTruthy();
      expect(reason.line.length, code).toBeGreaterThan(40);
    }

    /*
     * Rule 3 of `research/SOURCING-STANDARD.md`: "Era-less is not classic. An
     * item with no era anywhere is unconfirmed, not assumed in-era." An item
     * held out because nobody could place it is *not* an item the game lacks,
     * and the copy must not tell a player it is. This is the one reason code
     * where saying "this server does not have it" would be inventing a fact.
     */
    const unplaced = index.reasons['era-unplaced'];
    expect(unplaced?.why).toBe('no era in any source');
    expect(unplaced?.line).not.toMatch(/does not have|not in ever|absent/i);
    expect(unplaced?.line).toMatch(/unconfirmed|gap in the evidence|waits for/i);

    // The era rules do make that claim, because the standard does.
    expect(index.reasons['kunark']?.line).toMatch(/does not have/i);
    expect(index.reasons['velious']?.line).toMatch(/does not have/i);

    /*
     * There is no ninth reason any more. One existed for a few hours on
     * 2026-09-03 — "wiki marks it out of era" — and the owner removed its
     * premise the same day by confirming that `Tome of Miragul`, one of the
     * seven items it withheld, is in the game. The wiki's verdict is now a
     * disclosure carried on the shipped record (`wikiOutOfEra`) rather than a
     * reason to withhold anything, so nothing is quarantined on it.
     */
    expect(Object.values(index.reasons).map((r) => r.why))
      .not.toContain('wiki marks it out of era');
  });
});

describe('finding the item the reader actually typed', () => {
  it('answers the three names the review typed, with the pipeline’s reason', () => {
    const rage = findQuarantined(index, 'Ragebringer');
    expect(rage?.name).toBe('Ragebringer');
    expect(rage?.reason.why).toBe('era:Epic Quests');
    expect(rage?.exact).toBe(true);

    expect(findQuarantined(index, 'Jade Mace')?.reason.why).toBe('era:Kunark');
    expect(findQuarantined(index, 'Wurmslayer')?.reason.why).toBe('era:Kunark');
  });

  it('is case- and whitespace-insensitive, and returns the wiki’s spelling', () => {
    const hit = findQuarantined(index, '  rAGEBRINGER ');
    expect(hit?.name).toBe('Ragebringer');
    expect(hit?.exact).toBe(true);
  });

  it('matches the way the item search matches: every term a substring', () => {
    // `SearchIndex.search` ANDs whitespace-separated substrings. Anything
    // looser would explain an item the failed search was not looking for.
    const partial = findQuarantined(index, 'wurmslay');
    expect(partial?.name).toBe('Wurmslayer');
    expect(partial?.exact).toBe(false);

    const twoTerms = findQuarantined(index, 'mace jade');
    expect(twoTerms?.name).toBe('Jade Mace');

    expect(findQuarantined(index, 'jade zzzz')).toBeNull();
  });

  it('reports the shortest match and counts the rest, so the answer is stable', () => {
    const hit = findQuarantined(index, 'wurmslay');
    expect(hit?.others).toBeGreaterThanOrEqual(0);
    // Same query, same answer, whatever order the file happens to be in.
    expect(findQuarantined(index, 'wurmslay')?.name).toBe(hit?.name);
  });

  it('finds the very first name in the file', () => {
    // Position 0 is a real position. A truthiness test on the index lookup —
    // `if (!at)` — silently loses exactly one item, and it is the alphabetically
    // first one, which is the one a smoke test would never think to try.
    const first = index.names[0] as string;
    const hit = findQuarantined(index, first);
    expect(hit?.name).toBe(first);
    expect(hit?.exact).toBe(true);
  });

  it('prefers the name typed in full over a shorter one it contains', () => {
    // `Ragebringer` also contains `Rage`, and the tie-break prefers short
    // names, so an exact hit has to win outright or the reader gets told about
    // an item they did not ask for.
    const withRage = index.names.filter((n) => n.toLowerCase().includes('ragebringer'));
    expect(withRage.length).toBeGreaterThan(0);
    expect(findQuarantined(index, 'Ragebringer')?.name).toBe('Ragebringer');
  });

  it('says nothing when it knows nothing', () => {
    expect(findQuarantined(index, 'zzzznope')).toBeNull();
    expect(findQuarantined(index, '   ')).toBeNull();
    expect(findQuarantined(null, 'Ragebringer')).toBeNull();
  });

  it('never explains an item that actually ships', () => {
    // Dagas, Earthshaker and Cloak of Flames are in the shipped catalog. If a
    // name ever appeared on both sides the empty state would contradict the
    // table, so the pipeline's partition is asserted from this side too.
    for (const name of ['dagas', 'earthshaker', 'cloak of flames']) {
      expect(index.byName.has(name), `${name} is both shipped and withheld`).toBe(false);
    }
  });
});

describe('a malformed or missing file is silence, not a crash', () => {
  it('reads anything unusable as “no index”', () => {
    expect(parseQuarantineIndex(null)).toBeNull();
    expect(parseQuarantineIndex('<!doctype html>')).toBeNull();
    expect(parseQuarantineIndex({ reasons: {}, names: {} })).toBeNull();
    expect(parseQuarantineIndex({ reasons: { a: 1 }, names: { a: ['x'] } })).toBeNull();
  });

  it('drops names whose reason code was not published', () => {
    const partial = parseQuarantineIndex({
      counts: { scraped: 2, shipped: 1, quarantined: 1, explained: 1 },
      reasons: { good: { why: 'era:Kunark', title: 'Ruins of Kunark', line: 'x'.repeat(50) } },
      names: { good: ['Kept'], orphan: ['Dropped'] },
    });
    expect(partial?.names).toEqual(['Kept']);
    expect(findQuarantined(partial, 'Dropped')).toBeNull();
  });
});
