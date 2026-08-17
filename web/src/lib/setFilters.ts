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
import type { GearSet } from '../engine/types';

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
