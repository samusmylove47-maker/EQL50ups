/**
 * Sentences that cite a record, checked against the record.
 *
 * This repository has now found the same defect at least seven times: prose
 * that was true when written, cites a source, and was never re-derived from it.
 * A comment naming a command is not evidence the command was re-run. These are
 * the claims where the record is machine-readable, so the check is cheap.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(p, 'utf8');

/**
 * Source with block and line comments stripped — what a READER can actually see.
 *
 * These checks forbid phrases that were once rendered, and the comment
 * explaining each fix quotes the phrase it replaced. That is the comment doing
 * its job, and searching the raw file would make a good comment fail the test
 * for its own accuracy. Twice now a check of mine has done exactly that, so the
 * search is over rendered source rather than over the whole file.
 */
const rendered = (p: string) => read(p)
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

describe('the Landing page on what the client windows settled', () => {
  /**
   * The card said the client windows "corrected two of them — including the
   * synthetic SV Void an upgraded item grants."
   *
   * `research/validation/TIER0-VALIDATION.md` says the opposite about that
   * rule: `| SV Void (synthetic, = full, ≥2 attrs) | 10 | 10 | MATCH |`, and in
   * prose, "appears exactly as predicted. That is strong evidence the whole
   * model is correct, not coincidence." `UI-REFERENCE.md` calls the same window
   * "confirming the synthetic SV Void".
   *
   * So the front page described this project's single strongest validation
   * result — a rule recovered from a calculator's source, documented nowhere,
   * predicted, and then matched exactly — as a correction of an error.
   */
  it('does not describe the SV Void rule as corrected, because the record says MATCH', () => {
    const record = read('../research/validation/TIER0-VALIDATION.md');
    // The record's own verdict on that row, quoted from the table.
    const row = record.split('\n').find((l) => l.includes('SV Void (synthetic'));
    expect(row, 'the validation row must still exist').toBeTruthy();
    expect(row).toContain('MATCH');

    /*
     * Searched over the WHOLE rendered file, not a window around the phrase.
     *
     * The first draft sliced +/-400 characters around `indexOf('SV Void')` — and
     * the first occurrence in this file is a data constant hundreds of lines
     * above the card, so the slice never contained the sentence under test. The
     * guard passed on the restored defect. A window is a way to miss; there is
     * no reason to narrow a search that is already cheap.
     */
    const landing = rendered('src/screens/Landing.tsx');
    expect(landing).toContain('SV Void');
    expect(landing, 'the page must not call a MATCH a correction')
      .not.toMatch(/corrected two of them\s*—\s*including the synthetic SV Void/);
  });
});

describe('the Landing page on how many predictions the client confirmed', () => {
  /**
   * The showcase said "nine of nine predictions exact" in two places, citing
   * `TIER0-VALIDATION.md §1`. That table has SEVEN rows, all MATCH — and the
   * page's own enumeration beside the claim named SIX things. Three different
   * numbers for one result, on the front page, as the headline evidence, with a
   * citation to the record that contradicts it.
   *
   * The count is now DERIVED here from the record's table rather than compared
   * to a second typed number, so the page and the record cannot drift apart
   * again without this failing.
   */
  it('claims exactly the number of MATCH rows the record holds', () => {
    const record = read('../research/validation/TIER0-VALIDATION.md');
    const table = record.slice(record.indexOf('### Earthshaker'));
    const rows = table.slice(0, table.indexOf('\n\n')).split('\n')
      .filter((l) => l.startsWith('|') && !l.startsWith('| Field') && !l.startsWith('|---'));
    expect(rows.length, 'the validation table must still be there').toBeGreaterThan(0);
    const matches = rows.filter((l) => l.includes('MATCH')).length;
    expect(matches, 'every row in this table is a MATCH').toBe(rows.length);

    const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
    const word = WORDS[matches];
    const landing = rendered('src/screens/Landing.tsx');
    expect(landing, `the record holds ${matches} matching predictions`)
      .toContain(`${word} of ${word} predictions exact`);
    // And no other count is claimed anywhere on the page.
    for (const other of WORDS.filter((w) => w !== word)) {
      expect(landing, `stale count "${other} of ${other}" still on the page`)
        .not.toContain(`${other} of ${other} predictions`);
    }
  });
});

describe('the Sources page on how many items a client window was read for', () => {
  /**
   * Section 04 had "two out of two" typed into its prose. The denominator was
   * written when two items were client-verified; three more were added and it
   * did not move — while section 03, in the same file, derives the count and
   * correctly says five. One page, one set, two different sample sizes, and the
   * argument rested on the stale one: two of two reads as every sample.
   */
  it('states no sample size that the payload does not', () => {
    const sources = rendered('src/screens/Sources.tsx');
    expect(sources, 'the hardcoded denominator is gone').not.toContain('two out of two');
    expect(sources, 'and the count is derived').toContain('clientVerifiedCount');

    // Both figures come from the payload, so they cannot disagree with it.
    const meta = JSON.parse(read('public/data/meta.json'));
    const verified = meta.sourceStanding?.stats?.clientVerified ?? [];
    const contradictions = meta.dataReliability?.flags?.clientVerifiedContradictions ?? [];
    expect(verified.length, 'the payload still publishes the list').toBeGreaterThan(0);
    expect(contradictions.length).toBeLessThanOrEqual(verified.length);
  });
});

describe('the Share dialog on what actually travels in the link', () => {
  /**
   * The dialog said **"The whole plan travels in the link — every item, every
   * +N, exaltation donors, your per-class levels and every loadout."**
   *
   * Two of `GearSet`'s fields do not travel, and it is not the codec that drops
   * them — `planFrom` builds the plan as `{name, slots, weights, notes}` before
   * a byte is written. Verified by round-trip through the real codec rather
   * than by reading the type:
   *
   * ```
   *   planFrom set keys : ["name","slots","weights","notes"]
   *   withheld on plan  : undefined
   *   decoded withheld  : undefined
   * ```
   *
   * `withheld` is the one that matters. It records a position an import found
   * OCCUPIED by an item this build cannot score — `types.ts` keeps it precisely
   * so that "wearing something we cannot measure" stays distinguishable from
   * "wearing nothing", because otherwise "the upgrades ranking measured a
   * candidate against nothing and reported the whole item as gain". Dropped
   * from a link, the receiver sees that position as EMPTY and is shown an
   * inflated gain for it — the same defect `sanitizeSet` was fixed for on
   * reload, on the one surface where the sender cannot see what the receiver
   * gets.
   *
   * Whether `withheld` should be ADDED to the wire is not settled here: the
   * codec is a published format ("append only, never reorder, or every link
   * already in a Discord scrollback starts decoding to other items") and that
   * is the Director's call. What is settled is that the page must not promise
   * something it does not do.
   */
  it('does not claim the whole plan travels, when two fields do not', () => {
    const share = rendered('src/screens/SetEditor.tsx');
    expect(share, 'the dialog claimed the WHOLE plan travels')
      .not.toContain('The whole plan travels in the link');
    expect(share, 'an unqualified "every item" is the same promise reworded')
      .not.toMatch(/travels in the link — every item,/);
  });

  it('names what stays behind, in the words the rest of the app uses for it', () => {
    const share = rendered('src/screens/SetEditor.tsx');
    expect(share).toMatch(/cannot score/);
    expect(share, 'the reader is told the receiver sees it as empty')
      .toMatch(/empty/i);
  });
});
