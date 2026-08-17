/**
 * Windowed rendering for a long list of variable-height rows.
 *
 * The picker used to build every row it could show and cap the list at 150 to
 * keep that affordable — which cost a 600ms main-thread block per open and
 * still hid ~1,690 legal candidates behind the cap. This renders only the rows
 * the viewport can actually show (plus a little overscan), so the list can be
 * uncapped and cheap at the same time.
 *
 * Rows are measured rather than assumed. A result row is one line or four
 * depending on whether it carries deltas and a source line, so a fixed row
 * height would either clip content or waste space. Every mounted row reports
 * its real height; rows never yet mounted use an estimate, and the estimate is
 * replaced the moment they scroll into view. When a correction lands *above*
 * the viewport the scroll position absorbs it, so the list never slides under
 * the cursor.
 *
 * The `pinned` row is always mounted wherever it is. The picker's combobox
 * points `aria-activedescendant` at the active option, and that attribute has
 * to name an element that exists.
 */

import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';

/**
 * Viewport assumed before the scroller has been laid out — and in jsdom, which
 * reports every height as zero. Without it a test environment would render an
 * empty window and no row would ever be measured.
 */
const FALLBACK_VIEWPORT = 600;

export interface VirtualListOptions {
  /** Total number of rows in the list, not the number rendered. */
  count: number;
  /** Height assumed for a row that has never been mounted. */
  estimate: number;
  /** Rows kept mounted beyond each edge of the viewport. */
  overscan?: number;
  /** A row that must stay mounted wherever it is, or `null` for none. */
  pinned?: number | null;
}

export interface VirtualList {
  /** Attach to the scrolling element. */
  containerRef: RefObject<HTMLDivElement | null>;
  /** Row indices to render this pass, ascending. */
  indices: number[];
  /** Scroll height of the whole list, rendered or not. */
  totalHeight: number;
  /** Distance from the top of the canvas to the top of a row. */
  offsetOf: (index: number) => number;
  /** `ref` for a mounted row, so its real height replaces the estimate. */
  rowRef: (index: number) => (element: HTMLElement | null) => void;
  /** Bring a row into view; a no-op when it already is. */
  scrollToIndex: (index: number) => void;
}

/** Last row whose top edge is at or above `y`. */
function indexAt(offsets: Float64Array, count: number, y: number): number {
  if (count <= 0) return 0;
  let low = 0;
  let high = count - 1;
  let best = 0;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if ((offsets[mid] ?? 0) <= y) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return best;
}

export function useVirtualList({
  count,
  estimate,
  overscan = 6,
  pinned = null,
}: VirtualListOptions): VirtualList {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const heights = useRef<number[]>([]);
  const elements = useRef(new Map<number, HTMLElement>());
  const refCache = useRef(new Map<number, (element: HTMLElement | null) => void>());
  /** Bumped whenever a measurement changes, since the cache itself is a ref. */
  const [revision, setRevision] = useState(0);
  const [view, setView] = useState({ top: 0, height: 0 });

  const offsets = useMemo(() => {
    const out = new Float64Array(count + 1);
    const measured = heights.current;
    let acc = 0;
    for (let i = 0; i < count; i++) {
      out[i] = acc;
      acc += measured[i] || estimate;
    }
    out[count] = acc;
    return out;
  }, [count, estimate, revision]);

  const viewport = view.height || FALLBACK_VIEWPORT;
  const firstVisible = indexAt(offsets, count, view.top);
  const start = Math.max(0, firstVisible - overscan);
  const end = Math.min(count, indexAt(offsets, count, view.top + viewport) + 1 + overscan);

  const indices = useMemo(() => {
    const out: number[] = [];
    for (let i = start; i < end; i++) out.push(i);
    if (pinned !== null && pinned >= 0 && pinned < count && (pinned < start || pinned >= end)) {
      if (pinned < start) out.unshift(pinned);
      else out.push(pinned);
    }
    return out;
  }, [start, end, pinned, count]);

  const syncView = useCallback((element: HTMLDivElement) => {
    const top = element.scrollTop;
    const height = element.clientHeight;
    setView((prev) => (prev.top === top && prev.height === height ? prev : { top, height }));
  }, []);

  // One listener for the life of the picker. `passive` because the list never
  // cancels a scroll, only follows it.
  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const onScroll = () => syncView(element);
    onScroll();
    element.addEventListener('scroll', onScroll, { passive: true });
    const observer =
      typeof ResizeObserver === 'function' ? new ResizeObserver(onScroll) : null;
    observer?.observe(element);
    return () => {
      element.removeEventListener('scroll', onScroll);
      observer?.disconnect();
    };
  }, [syncView]);

  // Runs after every commit: whatever is mounted reports its real height.
  useLayoutEffect(() => {
    let changed = false;
    let shiftAbove = 0;
    for (const [index, node] of elements.current) {
      const height = node.offsetHeight;
      if (!height) continue;
      const known = heights.current[index];
      if (known !== undefined && Math.abs(known - height) < 0.5) continue;
      if (index < firstVisible) shiftAbove += height - (known ?? estimate);
      heights.current[index] = height;
      changed = true;
    }
    const element = containerRef.current;
    if (element) {
      if (shiftAbove) element.scrollTop += shiftAbove;
      syncView(element);
    }
    if (changed) setRevision((r) => r + 1);
  });

  const rowRef = useCallback((index: number) => {
    let fn = refCache.current.get(index);
    if (!fn) {
      fn = (element: HTMLElement | null) => {
        if (element) elements.current.set(index, element);
        else elements.current.delete(index);
      };
      refCache.current.set(index, fn);
    }
    return fn;
  }, []);

  const offsetOf = useCallback((index: number) => offsets[index] ?? 0, [offsets]);

  const scrollToIndex = useCallback(
    (index: number) => {
      const element = containerRef.current;
      if (!element || index < 0 || index >= count) return;
      const height = element.clientHeight || FALLBACK_VIEWPORT;
      const top = offsets[index] ?? 0;
      const bottom = top + (heights.current[index] || estimate);
      let next = element.scrollTop;
      if (top < next) next = top;
      else if (bottom > next + height) next = bottom - height;
      if (next === element.scrollTop) return;
      element.scrollTop = next;
      syncView(element);
    },
    [offsets, count, estimate, syncView],
  );

  return {
    containerRef,
    indices,
    totalHeight: offsets[count] ?? 0,
    offsetOf,
    rowRef,
    scrollToIndex,
  };
}
