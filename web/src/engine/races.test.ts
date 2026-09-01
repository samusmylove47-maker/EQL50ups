/**
 * The race vocabulary, pinned to the payload that publishes it.
 *
 * Both race dropdowns used to build their own list by scanning the loaded
 * items for restriction codes and unioning a hard-coded floor of seven. It is
 * a tempting shape — nothing is invented, every code offered is one the
 * eligibility check demonstrably understands — and it is wrong in the one
 * direction that matters: **a vocabulary derived from the subset of the data
 * that happens to mention it can only ever be a lower bound.**
 *
 * Measured against the shipped payload on 2026-09-01: 7,341 items carry a race
 * restriction, and between them they name five distinct codes. With the floor,
 * the dropdown offered 7 of 15. Eight playable races could not be selected —
 * and race, left unset, narrows nothing, so a Gnome was shown Ogre-only armour
 * as an upgrade. `PlanarGear.tsx` had a comment describing that exact failure
 * ("a High Elf had no way to say so") above a floor list that does not contain
 * `HIE`.
 *
 * So the list now comes from `meta.races`, and these tests are what stop the
 * app and the pipeline drifting apart again. A comment saying "keep these in
 * sync" is satisfiable by remembering; this is not.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RACES, RACE_NAMES, RACE_SET, raceLabel } from './constants';

const DATA = 'public/data';
const meta = JSON.parse(readFileSync(`${DATA}/meta.json`, 'utf8')) as { races?: string[] };

/** Tokens that appear in a restriction list but are not races. */
const NON_RACE = new Set(['ALL', 'NONE', 'ALL_EXCEPT']);

/** Every race code the shipped corpus actually restricts on. */
function codesInCorpus(): { codes: Set<string>; itemsWithRestriction: number; filesRead: number } {
  const codes = new Set<string>();
  let itemsWithRestriction = 0;
  let filesRead = 0;
  const scan = (items: { ra?: string[] }[]) => {
    for (const item of items) {
      if (!item.ra) continue;
      itemsWithRestriction += 1;
      for (const code of item.ra) if (!NON_RACE.has(code)) codes.add(code);
    }
  };
  const index = JSON.parse(readFileSync(`${DATA}/items-index.json`, 'utf8')) as { items: [] };
  filesRead += 1;
  scan(index.items);
  for (const file of readdirSync(`${DATA}/items`).filter((f) => f.endsWith('.json'))) {
    const shard = JSON.parse(readFileSync(`${DATA}/items/${file}`, 'utf8'));
    filesRead += 1;
    scan(shard.items ?? shard);
  }
  return { codes, itemsWithRestriction, filesRead };
}

describe('the app offers the vocabulary the payload publishes', () => {
  it('is exactly meta.races, both directions', () => {
    expect(meta.races, 'meta.json publishes no races list').toBeDefined();
    expect([...RACES].sort()).toEqual([...(meta.races ?? [])].sort());
  });

  it('offers fifteen, not the seven the old derivation produced', () => {
    expect(RACES).toHaveLength(15);
    expect(RACE_SET.size).toBe(15);
  });

  /**
   * The regression itself, stated as an inequality rather than as a number.
   * If the corpus one day happens to restrict on all fifteen, this still holds
   * and still means what it says: the published vocabulary is the authority,
   * not what the items were observed to mention.
   */
  it('is a SUPERSET of what the corpus restricts on — the bug, pinned', () => {
    const { codes, itemsWithRestriction, filesRead } = codesInCorpus();
    expect(filesRead, 'named the subject searched: index + every shard').toBeGreaterThan(1);
    expect(itemsWithRestriction).toBeGreaterThan(0);
    for (const code of codes) expect(RACE_SET.has(code)).toBe(true);
    // The corpus mentions strictly fewer than the game has. That gap IS the defect.
    expect(codes.size).toBeLessThan(RACES.length);
  });

  it('can express every race a character can be, including the eight that were unreachable', () => {
    for (const code of ['HUM', 'ERU', 'HIE', 'DWF', 'HFL', 'GNM', 'KER', 'FRG']) {
      expect(RACE_SET.has(code)).toBe(true);
    }
  });
});

describe('labels say what is known and no more', () => {
  it('names the fourteen the vendored source carries', () => {
    expect(raceLabel('HIE')).toBe('High Elf (HIE)');
    expect(raceLabel('HEF')).toBe('Half Elf (HEF)');
    expect(Object.keys(RACE_NAMES)).toHaveLength(14);
  });

  /**
   * `KER` deliberately has no name. The vendored source has `VAH` (Vah Shir)
   * where this game has `KER`, and `research/` carries "Kerra"/"Kerran" only as
   * zone and mob names — a place, not a race label. Falling back to the code is
   * the honest rendering; typing a name would be inventing the one kind of fact
   * this repository exists not to invent.
   */
  it('falls back to the bare code where no name is sourced', () => {
    expect(RACE_NAMES.KER).toBeUndefined();
    expect(raceLabel('KER')).toBe('KER');
  });

  it('never renders "undefined" for any code the app offers', () => {
    for (const code of RACES) {
      expect(raceLabel(code)).not.toContain('undefined');
      expect(raceLabel(code).length).toBeGreaterThan(0);
    }
  });
});
