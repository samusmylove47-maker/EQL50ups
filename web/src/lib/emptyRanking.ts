/**
 * What to say when the upgrade list comes back with no rows.
 *
 * "No rows" is not one fact. `computeUpgrades` has already separated the ways a
 * position can fail to produce one, under a comment in `Upgrades.tsx` saying so
 * — `settled` means the pool was searched and nothing in it beat what is worn;
 * `nothing` means the pool held no usable candidate at all; `withheld` means
 * what is worn could not be put on a scale. The screen consulted none of them.
 * It branched on `rows.length` alone and printed one sentence:
 *
 *   "Nothing outranks what you are wearing"
 *   "Every position this set can score is already carrying the best item the
 *    catalog offers it"
 *
 * Over an empty set under a narrowed filter, both are false. Measured on the
 * mounted app against the fixture catalog with `era: 'Kunark'` and an empty
 * set: the KPI directly above read "0/23 · 0 already best · 0 not comparable ·
 * 23 with nothing to offer" and the footnote directly below read "Nothing
 * scored for any position." — so the screen carried the true reading twice, in
 * the two places nobody reads, and the false one in the heading.
 *
 * This is the whole decision, pulled out where it can be enumerated: nothing
 * here renders, and nothing here computes a ranking. It only chooses words for
 * counts the engine already produced.
 */

export interface EmptyRankingCounts {
  /** Positions searched, where nothing in the pool beat what is worn. */
  settled: number;
  /** Positions whose candidate pool held nothing usable at all. */
  nothing: number;
  /** Positions whose worn item could not be put on a scale. */
  withheld: number;
}

export interface EmptyRankingCopy {
  heading: string;
  body: string;
}

export interface EmptyRankingContext {
  /** How candidates were scored, e.g. "every candidate at +5". */
  basisText: string;
  /** `describeActiveFilters` — the narrowing parts only, or `''` for none. */
  activeFilters: string;
}

/**
 * Choose the heading and body for a ranking that produced no rows.
 *
 * Total over every combination of counts, including the all-zero one, because
 * a screen that renders nothing is the failure this exists to prevent.
 */
export function emptyRankingCopy(
  counts: EmptyRankingCounts,
  context: EmptyRankingContext,
): EmptyRankingCopy {
  const { settled, nothing, withheld } = counts;

  /*
   * At least one position was actually searched and lost. The original sentence
   * is true of those, and it is left exactly as it was — including in the mixed
   * case, where some positions were searched and others had nothing to search.
   * "Every position this set *can score*" already excludes the second group,
   * and the footnote below names them by label.
   */
  if (settled > 0) {
    return {
      heading: 'Nothing outranks what you are wearing',
      body:
        `Every position this set can score is already carrying the best item the catalog offers ` +
        `it, ${context.basisText}. Change the comparison tier, widen this set's filters, or ` +
        `adjust its weights to ask a different question.`,
    };
  }

  /*
   * Nothing was searched anywhere. `nothing` counts positions where not one
   * candidate was even considered, so "already carrying the best" is not merely
   * unhelpful here — it asserts a comparison that never happened.
   */
  if (nothing > 0) {
    if (context.activeFilters) {
      return {
        heading: 'Nothing scored under these filters',
        body:
          `Not one position had a candidate to weigh, so nothing was compared and nothing has ` +
          `been found to be best. This set's filters apply: ${context.activeFilters}. Widen them, ` +
          `or change the comparison tier, to ask a question the catalog can answer.`,
      };
    }
    return {
      heading: 'Nothing scored in any position',
      body:
        `Not one position had a candidate to weigh, so nothing was compared and nothing has been ` +
        `found to be best. This set narrows nothing, so the catalog holds no item this loadout ` +
        `can wear — check the class trio and the per-class levels it is being scored for.`,
    };
  }

  /*
   * Every position is in "Not compared" below. Each carries its own reason
   * there, so this says only what is true of all of them at once.
   */
  if (withheld > 0) {
    return {
      heading: 'Nothing here could be put on a scale',
      body:
        `Every position is listed under "Not compared" below, each with the reason it could not ` +
        `be measured. Nothing was weighed, so nothing has been found to be best.`,
    };
  }

  return {
    heading: 'Nothing to rank',
    body: 'This set has no position for the ranking to look at.',
  };
}
