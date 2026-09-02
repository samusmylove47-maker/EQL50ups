/**
 * One mob, spelled two ways, counted twice.
 *
 * `MeasuredDrops`' header printed `pluralize(rows.length, 'mob')` — the raw
 * length of the item's `ms` array, with no de-duplication of any kind. The
 * payload supplies two rows for one mob whenever the combat log capitalised its
 * name differently in different lines, which it does for 14 mobs. Measured over
 * the shipped payload: 309 items carry measured drops, **17 of them repeat a
 * mob case-insensitively, 0 repeat one with identical spelling**, and the worst
 * is Drop of Mercury, whose header reads "across 13 mobs" for 10.
 *
 * The list showed it twice over: "A fetid fiend" and "a fetid fiend" as two
 * rows, which reads as two different mobs rather than one mob written two ways.
 *
 * ## What is folded, and what deliberately is not
 *
 * `seen` sums exactly — each sighting is one drop attributed to one mob, which
 * is the same reasoning `totalSightings` already relies on to add the column
 * across rows. The item's total sighting count therefore does not move.
 *
 * `sessions` **cannot** be summed. One session can produce two log lines with
 * different capitalisation, so the two rows may share an evening; the true
 * count is somewhere between the larger of the two and their sum. Nothing in
 * the payload says which — the shipped `sessions` is already a bare count, and
 * upstream the session objects carry only `{date, zone, difficulty}`, which
 * cannot distinguish two evenings from one recorded twice. So a folded row
 * reports the larger, marked as a floor, and the screen says "or more".
 * (Measured: all 19 folds on the shipped payload are an *n* to *n+1* range.)
 *
 * Rows for one mob in **different zones are not folded**, because each is a
 * true statement about where those sightings happened, and unioning the zones
 * would push the count out of `zoneTallies`' "placed" bucket into
 * "unattributed" — trading a real attribution for a vaguer one. Three groups on
 * the shipped payload are of this kind. They still get one spelling.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { normalizeCatalog } from '../data/normalize';
import type { Item, MeasuredDrop } from '../engine/types';
import { measuredDrops, totalSightings } from './Upgrades';

function drop(partial: Partial<MeasuredDrop> & Pick<MeasuredDrop, 'mob'>): MeasuredDrop {
  return { seen: 1, sessions: 1, ...partial };
}

function item(ms: MeasuredDrop[]): Item {
  return {
    id: null, n: '[Test] Wristbands', sl: ['WRIST'], cl: ['ALL'], ra: ['ALL'],
    st: {}, sv: {}, fl: [], av: true, ms,
  };
}

/** The shipped Midnight Clad Wristbands case, reduced to its two rows. */
const FIEND_A = drop({
  mob: 'A fetid fiend', seen: 4, sessions: 4,
  zones: ['The Plane of Fear'], first: '12 Aug 2026', last: '13 Aug 2026',
});
const FIEND_B = drop({
  mob: 'a fetid fiend', seen: 1, sessions: 1,
  zones: ['The Plane of Fear'], first: '13 Aug 2026', last: '13 Aug 2026',
});
const OTHER = drop({ mob: 'A dracoliche', seen: 6, sessions: 2, zones: ['The Plane of Fear'] });

describe('one mob written two ways is one mob', () => {
  it('folds the two spellings into a single row', () => {
    const rows = measuredDrops(item([FIEND_A, FIEND_B, OTHER]));
    expect(rows).toHaveLength(2);
    const fiend = rows.find((r) => /fetid fiend/i.test(r.mob));
    expect(fiend).toBeTruthy();
    expect(fiend?.seen).toBe(5);
  });

  it('does not move the item’s sighting total, which was already right', () => {
    const before = totalSightings([FIEND_A, FIEND_B, OTHER]);
    const after = totalSightings(measuredDrops(item([FIEND_A, FIEND_B, OTHER])));
    expect(before).toBe(11);
    expect(after).toBe(before);
  });

  it('reports sessions as a floor rather than inventing a total', () => {
    const fiend = measuredDrops(item([FIEND_A, FIEND_B])).find((r) => /fiend/i.test(r.mob));
    // Not 5: the two spellings may share an evening and nothing says whether
    // they do. Not 4 stated flatly either — the row says so.
    expect(fiend?.sessions).toBe(4);
    expect(fiend?.sessionsAtLeast).toBe(true);
  });

  it('leaves an unfolded row’s sessions exactly as published', () => {
    const other = measuredDrops(item([FIEND_A, FIEND_B, OTHER])).find((r) => /dracoliche/i.test(r.mob));
    expect(other?.sessions).toBe(2);
    expect(other?.sessionsAtLeast).toBeUndefined();
  });

  it('spans the dates of everything it folded', () => {
    const fiend = measuredDrops(item([FIEND_A, FIEND_B])).find((r) => /fiend/i.test(r.mob));
    expect(fiend?.first).toBe('12 Aug 2026');
    expect(fiend?.last).toBe('13 Aug 2026');
  });

  it('keeps the better-evidenced spelling', () => {
    // 4 seen against 1: the capitalised form is the one the log wrote most.
    expect(measuredDrops(item([FIEND_A, FIEND_B]))[0]?.mob).toBe('A fetid fiend');
    // And the choice follows the evidence, not the array order.
    const flipped = measuredDrops(item([
      drop({ mob: 'A scareling', seen: 1, sessions: 1, zones: ['Z'] }),
      drop({ mob: 'a scareling', seen: 9, sessions: 2, zones: ['Z'] }),
    ]));
    expect(flipped[0]?.mob).toBe('a scareling');
  });

  it('does NOT fold rows that name different zones', () => {
    // Each row is a true statement about where those sightings happened, and
    // unioning the zones would push the count out of zoneTallies' "placed"
    // bucket. They are still shown under one spelling.
    const rows = measuredDrops(item([
      drop({ mob: 'An elemental deceiver', seen: 3, sessions: 2, zones: ['The Ruins of Old Paineel'] }),
      drop({ mob: 'an elemental deceiver', seen: 1, sessions: 1, zones: ['Northern Felwithe'] }),
    ]));
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((r) => r.mob)).size).toBe(1);
    expect(rows.map((r) => r.zones?.[0]).sort())
      .toEqual(['Northern Felwithe', 'The Ruins of Old Paineel']);
  });

  it('carries offRoster if either spelling was off the roster', () => {
    const rows = measuredDrops(item([
      drop({ mob: 'A scareling', seen: 2, sessions: 1, zones: ['Z'] }),
      drop({ mob: 'a scareling', seen: 1, sessions: 1, zones: ['Z'], offRoster: true }),
    ]));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.offRoster).toBe(true);
  });

  it('leaves an item with no repeated mob completely alone', () => {
    const clean = [OTHER, drop({ mob: 'A ghoul', seen: 2, sessions: 1, zones: ['Lower Guk'] })];
    expect(measuredDrops(item(clean)).map((r) => r.mob)).toEqual(['A dracoliche', 'A ghoul']);
    expect(measuredDrops(item(clean)).map((r) => r.sessions)).toEqual([2, 1]);
  });
});

/* ------------------------------------------------------------------------- *
 * The same rule, asserted over everything that actually ships.
 *
 * The fixture cases above pin the behaviour; this pins that nothing in the
 * shipped payload still slips past it. It is the guard that would have caught
 * the defect in the first place — the fixtures were written after the fact,
 * from what the payload turned out to contain.
 * ------------------------------------------------------------------------- */

const SHARDS = 'public/data/items';

describe.skipIf(!existsSync(SHARDS))('over the shipped payload', () => {
  const shipped: Item[] = [];
  for (const file of readdirSync(SHARDS).filter((f) => f.endsWith('.json'))) {
    for (const row of normalizeCatalog(JSON.parse(readFileSync(`${SHARDS}/${file}`, 'utf8')))) {
      if (row.ms?.length) shipped.push(row);
    }
  }

  it('has measured drops to check, or this proves nothing', () => {
    expect(shipped.length).toBeGreaterThan(100);
    // And some of them really do carry the defect's raw material.
    const repeats = shipped.filter((row) => {
      const keys = (row.ms ?? []).map((r) => r.mob.toLowerCase());
      return new Set(keys).size < keys.length;
    });
    expect(repeats.length, 'items whose payload repeats a mob case-insensitively')
      .toBeGreaterThan(0);
  });

  it('never shows one mob under two spellings', () => {
    const offenders: string[] = [];
    for (const row of shipped) {
      const mobs = measuredDrops(row).map((drop) => drop.mob);
      const folded = new Set(mobs.map((m) => m.toLowerCase()));
      if (folded.size !== new Set(mobs).size) offenders.push(`${row.n}: ${mobs.join(' / ')}`);
    }
    expect(offenders).toEqual([]);
  });

  it('keeps every item’s sighting total exactly where it was', () => {
    for (const row of shipped) {
      const raw = (row.ms ?? []).reduce((sum, r) => sum + Math.max(0, r.seen), 0);
      expect(totalSightings(measuredDrops(row)), row.n).toBe(raw);
    }
  });

  it('flags a folded row’s sessions as a floor, and never inflates one', () => {
    for (const row of shipped) {
      const bySpelling = new Map<string, number[]>();
      for (const r of row.ms ?? []) {
        const key = `${r.mob.toLowerCase()}|${[...(r.zones ?? [])].sort().join()}`;
        bySpelling.set(key, [...(bySpelling.get(key) ?? []), r.sessions]);
      }
      for (const drop of measuredDrops(row)) {
        const key = `${drop.mob.toLowerCase()}|${[...(drop.zones ?? [])].sort().join()}`;
        const parts = bySpelling.get(key) ?? [];
        // Never more than the sum, never less than the largest part.
        expect(drop.sessions, `${row.n} / ${drop.mob}`).toBe(Math.max(...parts));
        expect(Boolean(drop.sessionsAtLeast), `${row.n} / ${drop.mob}`).toBe(parts.length > 1);
      }
    }
  });

  it('does not fold away a zone, which would move a count out of its tally', () => {
    for (const row of shipped) {
      const rawZones = new Set((row.ms ?? []).flatMap((r) => r.zones ?? []));
      const foldedZones = new Set(measuredDrops(row).flatMap((d) => d.zones ?? []));
      expect([...foldedZones].sort(), row.n).toEqual([...rawZones].sort());
      // And no row gained a zone it did not have, which is what would push a
      // placed count into `zoneTallies`' unattributed bucket.
      for (const drop of measuredDrops(row)) {
        const match = (row.ms ?? []).some(
          (r) => r.mob.toLowerCase() === drop.mob.toLowerCase()
            && [...(r.zones ?? [])].sort().join() === [...(drop.zones ?? [])].sort().join(),
        );
        expect(match, `${row.n} / ${drop.mob} zones`).toBe(true);
      }
    }
  });
});
