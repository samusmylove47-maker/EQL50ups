/**
 * Per-set default filters.
 *
 * UI-REFERENCE §A4 records that the reference tool configures stat weights
 * *and* filters at set creation, so every set carries its own lens. This is the
 * filter half of that: three fields chosen once, stored on the set, and handed
 * to the per-slot pickers as their opening filter state instead of every picker
 * re-deriving one from scratch.
 *
 * The field is declared by augmenting `GearSet` rather than by editing the
 * engine's type file: filters are a planner-side preference, not part of the
 * item model, and the engine has no business knowing about them.
 */

import { ERA_ORDER } from '../engine/constants';
import type { GearSet, Item } from '../engine/types';

export const SOURCE_FILTERS = ['any', 'drop', 'quest', 'vendor', 'crafted'] as const;
export type SourceFilter = (typeof SOURCE_FILTERS)[number];

export const SOURCE_LABELS: Record<SourceFilter, string> = {
  any: 'Any source',
  drop: 'Drops',
  quest: 'Quest',
  vendor: 'Vendor',
  crafted: 'Crafted',
};

export interface SetFilters {
  /** An era name from `ERA_ORDER`, or `'any'`. */
  era: string;
  source: SourceFilter;
  hideNoDrop: boolean;
}

declare module '../engine/types' {
  interface GearSet {
    /** Opening filter state for this set's per-slot pickers. */
    defaultFilters?: SetFilters;
  }
}

export const DEFAULT_SET_FILTERS: SetFilters = {
  era: 'any',
  source: 'any',
  hideNoDrop: false,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isSourceFilter(value: unknown): value is SourceFilter {
  return typeof value === 'string' && (SOURCE_FILTERS as readonly string[]).includes(value);
}

export function isEraName(value: unknown): value is string {
  return typeof value === 'string' && (ERA_ORDER as readonly string[]).includes(value);
}

/**
 * Coerce anything into a usable filter set, reporting what it had to drop.
 *
 * Total by construction: a hand-edited import can hold an era that no longer
 * exists or a source that never did, and the answer to that is a named
 * rejection plus a working default, never a throw.
 */
export function sanitizeFilters(raw: unknown): { filters: SetFilters; rejected: string[] } {
  const rejected: string[] = [];
  if (raw === undefined || raw === null) return { filters: { ...DEFAULT_SET_FILTERS }, rejected };
  if (!isRecord(raw)) {
    return { filters: { ...DEFAULT_SET_FILTERS }, rejected: ['defaultFilters was not an object'] };
  }

  let era = DEFAULT_SET_FILTERS.era;
  if (raw.era !== undefined && raw.era !== 'any') {
    if (isEraName(raw.era)) era = raw.era;
    else rejected.push(`unknown era ${JSON.stringify(raw.era)}`);
  }

  let source = DEFAULT_SET_FILTERS.source;
  if (raw.source !== undefined && raw.source !== 'any') {
    if (isSourceFilter(raw.source)) source = raw.source;
    else rejected.push(`unknown source filter ${JSON.stringify(raw.source)}`);
  }

  let hideNoDrop = DEFAULT_SET_FILTERS.hideNoDrop;
  if (raw.hideNoDrop !== undefined) {
    if (typeof raw.hideNoDrop === 'boolean') hideNoDrop = raw.hideNoDrop;
    else rejected.push('hideNoDrop was not a boolean');
  }

  return { filters: { era, source, hideNoDrop }, rejected };
}

/** The filters a set opens its pickers with, defaults included. */
export function filtersFor(set: GearSet | undefined): SetFilters {
  return sanitizeFilters(set?.defaultFilters).filters;
}

export function isDefaultFilters(filters: SetFilters): boolean {
  return (
    filters.era === DEFAULT_SET_FILTERS.era &&
    filters.source === DEFAULT_SET_FILTERS.source &&
    filters.hideNoDrop === DEFAULT_SET_FILTERS.hideNoDrop
  );
}

export function sameFilters(a: SetFilters, b: SetFilters): boolean {
  return a.era === b.era && a.source === b.source && a.hideNoDrop === b.hideNoDrop;
}

/** One line for a menu or a summary chip. */
export function describeFilters(filters: SetFilters): string {
  const parts = [
    filters.era === 'any' ? 'Any era' : filters.era,
    SOURCE_LABELS[filters.source],
  ];
  if (filters.hideNoDrop) parts.push('No Drop hidden');
  return parts.join(' · ');
}

/**
 * Only the parts that are actually narrowing anything, for a sentence.
 *
 * `describeFilters` names all three fields because a settings chip has to show
 * what is set; a completion notice has to name what it *did*, and "Any era, Any
 * source" did nothing.
 */
export function describeActiveFilters(filters: SetFilters): string {
  const parts: string[] = [];
  if (filters.era !== 'any') parts.push(`${filters.era} era`);
  if (filters.source !== 'any') parts.push(`${SOURCE_LABELS[filters.source]} only`);
  if (filters.hideNoDrop) parts.push('No Drop hidden');
  return parts.join(', ');
}

/* ------------------------------------------------------- the predicate */

/**
 * Does an item come from the kind of place this filter asks for?
 *
 * `any` is not "has a source" — an item the corpus knows nothing about still
 * passes, because the filter is a narrowing, not a data-quality assertion.
 */
export function matchesSource(item: Item, filter: SourceFilter): boolean {
  if (filter === 'any') return true;
  const src = item.src;
  if (!src) return false;
  if (filter === 'drop') return Boolean(src.m?.length || src.z?.length);
  if (filter === 'quest') return Boolean(src.q?.length);
  if (filter === 'vendor') return Boolean(src.v?.length);
  return src.c === true;
}

/**
 * The one candidate predicate the set's default filters mean.
 *
 * Lives here rather than in the picker because the picker is no longer the only
 * surface that has to honour it: Auto-fill accepted no filters at all, so a set
 * configured for "Sky era, No Drop hidden" filled itself with No Drop items
 * from other eras — items its own pickers would refuse to offer, and that a
 * fresh alt can never obtain. Two surfaces on one screen disagreeing about the
 * set's own rules is worse than either rule being wrong, so there is now one
 * predicate and both call it.
 *
 * "Live content only" is deliberately not part of this: it is a picker-session
 * toggle, not a stored per-set filter, and Auto-fill takes it separately.
 */
export function matchesFilters(item: Item, filters: SetFilters): boolean {
  if (filters.era !== 'any' && item.era !== filters.era) return false;
  if (!matchesSource(item, filters.source)) return false;
  if (filters.hideNoDrop && item.fl.includes('NO_DROP')) return false;
  return true;
}
