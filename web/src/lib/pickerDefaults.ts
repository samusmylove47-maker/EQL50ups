/**
 * The seam that carries a set's default filters into its per-slot pickers.
 *
 * The picker owns its own filter state — four `useState` calls seeded with
 * literals — and it is opened by the workspace, not by the set screen, so there
 * is no prop path from the set to the picker. Rather than thread four new props
 * through two components for a preference, the active set publishes its
 * defaults here when it mounts, and the picker reads them once, as the initial
 * value of the state it already has:
 *
 * ```ts
 * import { pickerFilterDefaults } from '../lib/pickerDefaults';
 * const defaults = pickerFilterDefaults();
 * const [era, setEra] = useState<string>(defaults.era);
 * const [source, setSource] = useState<SourceFilter>(defaults.source);
 * const [hideNoDrop, setHideNoDrop] = useState(defaults.hideNoDrop);
 * ```
 *
 * Read once at mount, deliberately: these are *starting* filters. Re-syncing
 * them on change would yank the list out from under someone who had just
 * narrowed it by hand.
 *
 * `useSyncExternalStore` is offered for a component that wants to render the
 * current defaults (the set screen's summary chip does), not for the picker.
 */

import { useSyncExternalStore } from 'react';
import { DEFAULT_SET_FILTERS, sameFilters, type SetFilters } from './setFilters';

let current: SetFilters = { ...DEFAULT_SET_FILTERS };
const listeners = new Set<() => void>();

/** The filters a picker opening right now should start with. */
export function pickerFilterDefaults(): SetFilters {
  return current;
}

/**
 * Declare the filters that pickers opened from here should inherit.
 *
 * Idempotent: publishing an equal value keeps the same object identity, so a
 * subscriber never re-renders because a parent re-rendered.
 */
export function publishPickerDefaults(filters: SetFilters): void {
  if (sameFilters(current, filters)) return;
  current = { ...filters };
  for (const listener of listeners) listener();
}

/** Drop back to the app-wide defaults — for leaving a set, and for tests. */
export function resetPickerDefaults(): void {
  publishPickerDefaults(DEFAULT_SET_FILTERS);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

export function usePickerFilterDefaults(): SetFilters {
  return useSyncExternalStore(subscribe, pickerFilterDefaults, pickerFilterDefaults);
}
