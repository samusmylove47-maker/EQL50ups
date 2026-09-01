/**
 * The words an empty upgrade list gets, enumerated.
 *
 * The defect this pins is a screen that branched on `rows.length` alone and so
 * had exactly one sentence for every way a ranking can come back empty. The
 * cases below are the ways, and the point of testing the chooser rather than
 * only the screen is that all of them can be reached here — the screen can
 * reach some of them only through a filter state and a catalog.
 */

import { describe, expect, it } from 'vitest';
import { emptyRankingCopy, type EmptyRankingCounts } from './emptyRanking';

const CONTEXT = { basisText: 'every candidate at +5', activeFilters: 'Kunark era, Drops only' };
const NO_FILTERS = { basisText: 'every candidate at +5', activeFilters: '' };

function copy(counts: Partial<EmptyRankingCounts>, context = CONTEXT) {
  return emptyRankingCopy({ settled: 0, nothing: 0, withheld: 0, ...counts }, context);
}

describe('the empty-ranking sentence names which empty it is', () => {
  it('keeps the original copy when positions really were searched and lost', () => {
    const { heading, body } = copy({ settled: 23 });
    expect(heading).toBe('Nothing outranks what you are wearing');
    expect(body).toContain('already carrying the best item the catalog offers it');
    expect(body).toContain('every candidate at +5');
  });

  /*
   * The mixed case is deliberately unchanged. "Every position this set *can
   * score*" excludes the ones that had nothing to score, and the footnote under
   * the list names those by label, so the sentence is true as written.
   */
  it('keeps it in the mixed case too, where it is still true', () => {
    expect(copy({ settled: 5, nothing: 18 }).heading).toBe(
      'Nothing outranks what you are wearing',
    );
  });

  /*
   * The measured defect. Nothing was searched, so nothing can have been found
   * to be best, and nothing is "already carrying" anything.
   */
  it('does not claim a comparison that never happened', () => {
    const { heading, body } = copy({ nothing: 23 });
    expect(heading).not.toBe('Nothing outranks what you are wearing');
    expect(body).not.toContain('already carrying the best item');
    expect(heading).toBe('Nothing scored under these filters');
    // And it names the filters it is blaming, rather than blaming them vaguely.
    expect(body).toContain('Kunark era, Drops only');
  });

  it('does not blame filters that are not narrowing anything', () => {
    const { heading, body } = copy({ nothing: 23 }, NO_FILTERS);
    expect(heading).toBe('Nothing scored in any position');
    expect(body).not.toMatch(/filters apply/);
    expect(body).toContain('narrows nothing');
  });

  it('says so when every position is unmeasurable rather than unbeaten', () => {
    const { heading, body } = copy({ withheld: 23 });
    expect(heading).toBe('Nothing here could be put on a scale');
    expect(body).toContain('Not compared');
  });

  /* Unreachable with 23 fixed positions, but a chooser that can return nothing
   * is a blank screen waiting to happen. */
  it('is total: all-zero counts still get words', () => {
    const { heading, body } = copy({});
    expect(heading).toBeTruthy();
    expect(body).toBeTruthy();
  });

  it('never promises a comparison in any branch where none was made', () => {
    const unsearched: Array<Partial<EmptyRankingCounts>> = [
      { nothing: 23 },
      { nothing: 1 },
      { withheld: 23 },
      { nothing: 11, withheld: 12 },
      {},
    ];
    for (const counts of [...unsearched]) {
      for (const context of [CONTEXT, NO_FILTERS]) {
        const { heading, body } = copy(counts, context);
        expect(heading, JSON.stringify(counts)).not.toMatch(/outranks/);
        expect(body, JSON.stringify(counts)).not.toMatch(/already carrying|already best/);
      }
    }
  });
});
