/**
 * Slot item picker.
 *
 * Speed is the brand, so the work is split in three:
 *
 *  - an expensive pass that scores and sorts every legal candidate for the
 *    slot (memoised on catalog revision, class trio, weights, preview tier and
 *    cap context);
 *  - a cheap pass that filters that already-sorted array through the trigram
 *    search index — typing therefore never rescores;
 *  - a windowed render that builds only the rows the viewport can show.
 *
 * The list is **not** truncated. It used to stop at 150 rows, which built
 * ~1,500 DOM nodes to show about nine and silently hid 1,690 legal candidates
 * on an Any Slot — and because the list is EP-ranked, changing weights changed
 * *which* 150 were reachable. Windowing makes the whole list reachable and
 * costs less than the cap did.
 *
 * Every filter and the preview tier drive the list through a deferred copy of
 * their state, so the re-rank they cause runs at transition priority and never
 * blocks the control that asked for it.
 *
 * Keyboard: ↑/↓ move, PgUp/PgDn jump, Home/End, Enter equips, Escape closes
 * (handled by the modal shell). Rows are `tabindex="-1"`, as the ARIA listbox
 * pattern requires: the widget is one tab stop, not one per candidate. The
 * highlight is held as an item identity rather than a row number, so a re-rank
 * moves it with the item instead of leaving it on whatever arrives underneath.
 */

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import type { LoadoutContext } from '../engine/character';
import { ERA_ORDER, type SlotPosition } from '../engine/constants';
import { scoreItem, type WeightProfile } from '../engine/ep';
import type { StatTotals } from '../engine/stats';
import { BASE_STATE, type UpgradeState } from '../engine/upgrade';
import type { Item } from '../engine/types';
import { useCatalog } from '../data/catalog';
import type { SlotCode } from '../data/normalize';
import { searchIndexFor } from '../data/searchIndex';
import { count, ep as epText, signed, signedDec } from '../lib/format';
import { pickerFilterDefaults } from '../lib/pickerDefaults';
// The same predicate Auto-fill applies, so the two surfaces on this screen can
// never disagree about what the set's own filters mean.
import { matchesSource, type SourceFilter } from '../lib/setFilters';
import { displayFlags, eraLabel, isLive, itemNameColor, sourceSummary } from '../lib/itemStyle';
import {
  rankSlotItems,
  scoreContextFrom,
  shortStatLabel,
  statDeltas,
  statVector,
  statChip,
  type ScoredItem,
} from '../selectors/gear';
import { useVirtualList } from '../lib/useVirtualList';
import { Modal } from './Modal';
import { itemHoverProps, pointerMoved } from './ItemWindow';
import { SlotGlyph } from './SlotGlyph';
import { UpgradeStepper } from './UpgradeStepper';

/**
 * Height assumed for a row that has not been mounted yet. Real rows are
 * measured; this only has to be close enough that the scrollbar is honest
 * before you have scrolled there.
 */
const ROW_ESTIMATE = 74;

export interface ItemPickerProps {
  position: SlotPosition;
  context: LoadoutContext | undefined;
  weights: WeightProfile;
  currentItem: Item | undefined;
  currentName: string | undefined;
  currentUpgrade: UpgradeState;
  /** Totals of the rest of the set, for cap-aware scoring. */
  contextTotals: StatTotals;
  /**
   * Equips at the tier the row was scored and previewed at, so the numbers the
   * player just read are the numbers they get.
   */
  onSelect: (item: Item, upgrade: UpgradeState) => void;
  onClear: () => void;
  onClose: () => void;
}

function zoneText(item: Item): string {
  const src = item.src;
  if (!src) return '';
  return [...(src.z ?? []), ...(src.m ?? []), ...(src.q ?? []), ...(src.v ?? [])]
    .join(' ')
    .toLowerCase();
}

/**
 * The keyboard-active row, held as an item identity as well as a row number.
 *
 * A row number alone is only stable while the list is: the preview tier
 * re-*sorts* the same candidates rather than changing which of them are
 * present, so the row under the highlight changed while the highlight did not.
 * ArrowDown onto row 1, five presses of the preview stepper, Enter — and the
 * set received the item that had since arrived at row 1, which the player had
 * never looked at. That is the only path in this app that writes an item the
 * user did not choose.
 */
interface ActiveRow {
  index: number;
  /** Item name at the moment the row was chosen; `null` before any choice. */
  name: string | null;
}

/**
 * Where the held identity sits in the list as it stands now.
 *
 * The common case costs one comparison — the row number is still right, which
 * it is on every render that is not a re-rank. Only when the item has moved is
 * the list scanned, and only then is it O(n).
 */
function resolveActive(active: ActiveRow, rows: readonly ScoredItem[]): number {
  if (!rows.length) return 0;
  if (active.name !== null && rows[active.index]?.item.n !== active.name) {
    const found = rows.findIndex((entry) => entry.item.n === active.name);
    if (found >= 0) return found;
  }
  return Math.min(Math.max(0, active.index), rows.length - 1);
}

export function ItemPicker({
  position,
  context,
  weights,
  currentItem,
  currentName,
  currentUpgrade,
  contextTotals,
  onSelect,
  onClear,
  onClose,
}: ItemPickerProps) {
  const catalog = useCatalog();
  const ensureSlot = useCatalog((s) => s.ensureSlot);

  const [query, setQuery] = useState('');
  const [zoneQuery, setZoneQuery] = useState('');
  /*
   * Seeded from the set's configured default filters rather than from
   * literals. A set created with, say, "raid drops only" should open every one
   * of its slot pickers already filtered that way — that is the whole point of
   * asking for defaults at creation time (UI-REFERENCE §A4). Read once on
   * mount; changing them mid-picker would move the list under the cursor.
   */
  const defaults = pickerFilterDefaults();
  const [era, setEra] = useState<string>(defaults.era);
  const [source, setSource] = useState<SourceFilter>(defaults.source);
  const [liveOnly, setLiveOnly] = useState(true);
  const [hideNoDrop, setHideNoDrop] = useState(defaults.hideNoDrop);
  const [preview, setPreview] = useState<UpgradeState>(currentUpgrade ?? BASE_STATE);
  const [active, setActive] = useState<ActiveRow>({ index: 0, name: null });

  /*
   * Every filter change re-ranks or re-filters up to 1,800 candidates. Each
   * one therefore drives the list from a *deferred* copy of its state: the
   * control commits instantly at normal priority, and the expensive re-render
   * it causes runs at transition priority — interruptible, and abandoned
   * outright if you change your mind before it lands.
   *
   * Deferring the value rather than wrapping the setter in `startTransition`
   * is deliberate. These are all controlled inputs, and React restores a
   * controlled input's DOM state to its last rendered props after the event:
   * with the state update inside a transition there is no render to restore
   * from, so the checkbox visibly snapped back to checked before flipping
   * again a frame later. Deferring keeps the control honest and moves only the
   * list behind it.
   *
   * Rows are scored, rendered and equipped at `rankPreview` for the same
   * reason, so the numbers on screen and the tier that gets equipped always
   * agree.
   */
  const deferredQuery = useDeferredValue(query);
  const deferredZone = useDeferredValue(zoneQuery);
  const deferredEra = useDeferredValue(era);
  const deferredSource = useDeferredValue(source);
  const deferredLiveOnly = useDeferredValue(liveOnly);
  const deferredHideNoDrop = useDeferredValue(hideNoDrop);
  const rankPreview = useDeferredValue(preview);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void ensureSlot(position.type as SlotCode);
  }, [ensureSlot, position.type]);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const existing = useMemo(() => scoreContextFrom(contextTotals), [contextTotals]);

  /*
   * Ranked over *every* candidate, released or not, and never re-ranked for the
   * live-only checkbox.
   *
   * `includeUnreleased` is part of the rank cache key, so driving the checkbox
   * through it meant the first press in each direction re-scored the whole slot
   * — 194 ms on an Any Slot at 4x throttle — while the second press read a warm
   * cache and measured 0 ms. A benchmark that toggles twice sees the 0; a user
   * sees the 194. Whether an item is live changes only which of the already
   * sorted candidates are shown, so it belongs in the `rows` filter beside era,
   * source and No Drop, all three of which have always been free.
   */
  const ranked = useMemo(
    () =>
      rankSlotItems(catalog, {
        slot: position.type as SlotCode,
        context,
        weights,
        upgrade: rankPreview,
        existing,
        includeUnreleased: true,
      }),
    [catalog, position.type, context, weights, rankPreview, existing],
  );

  /*
   * Built on the first keystroke, not on open. The trigram index covers every
   * name in the catalog and is rebuilt whenever a slot shard lands, so opening
   * a picker paid for one — twice — to answer an empty query with `null`. That
   * was a third of the cost of opening the dialog, spent on a search nobody
   * had typed yet.
   */
  const matches = useMemo(
    () =>
      deferredQuery.trim()
        ? searchIndexFor(catalog.revision, catalog.items).search(deferredQuery)
        : null,
    [catalog.revision, catalog.items, deferredQuery],
  );

  /** The worn item scored under the same lens, so every row can show a delta. */
  const wornScore = useMemo(
    () => (currentItem ? scoreItem(currentItem, currentUpgrade, weights, { existing }).total : 0),
    [currentItem, currentUpgrade, weights, existing],
  );

  /**
   * Every candidate that passes the filters, in EP order. No cap: the list is
   * windowed, so length costs almost nothing and every candidate is reachable
   * by scrolling or by End.
   */
  const rows = useMemo(() => {
    const out: ScoredItem[] = [];
    const zoneNeedle = deferredZone.trim().toLowerCase();
    for (const entry of ranked) {
      const item = entry.item;
      if (matches && !matches.has(item)) continue;
      if (deferredLiveOnly && !isLive(item)) continue;
      if (deferredEra !== 'any' && item.era !== deferredEra) continue;
      if (!matchesSource(item, deferredSource)) continue;
      if (deferredHideNoDrop && item.fl.includes('NO_DROP')) continue;
      if (zoneNeedle && !zoneText(item).includes(zoneNeedle)) continue;
      out.push(entry);
    }
    return out;
  }, [
    ranked,
    matches,
    deferredLiveOnly,
    deferredEra,
    deferredSource,
    deferredHideNoDrop,
    deferredZone,
  ]);

  /*
   * Derived during render, never in an effect: `rows` and the highlight have to
   * agree in the very frame the re-rank lands, because Enter reads them both.
   * An effect would leave one commit in which the highlight names one item and
   * the row number points at another.
   */
  const activeIndex = useMemo(() => resolveActive(active, rows), [active, rows]);

  /** Move the highlight, and remember what it landed on. */
  const moveActive = (to: number | ((from: number) => number)) => {
    setActive((prev) => {
      const from = resolveActive(prev, rows);
      const wanted = typeof to === 'function' ? to(from) : to;
      const index = Math.max(0, Math.min(rows.length - 1, wanted));
      return { index, name: rows[index]?.item.n ?? null };
    });
  };

  const virtual = useVirtualList({
    count: rows.length,
    estimate: ROW_ESTIMATE,
    // The active row stays mounted wherever it is, so `aria-activedescendant`
    // always names an element that exists.
    pinned: rows.length ? activeIndex : null,
  });
  /*
   * Read through a ref rather than depending on it: `scrollToIndex` closes over
   * the measured offsets, so it is a new function every time a row reports its
   * real height. As a dependency it dragged the list back to the active row —
   * the top — every time you scrolled somewhere new and the rows there were
   * measured. Only a move of the active row should move the viewport.
   */
  const scrollToActive = useRef(virtual.scrollToIndex);
  scrollToActive.current = virtual.scrollToIndex;

  /*
   * Keyed off the deferred values, so the active row returns to the top exactly
   * when the list it indexes into changes — not one render early.
   *
   * These six change *membership*, so the item that was highlighted may not be
   * in the list any more and the top is the only honest answer. The preview
   * tier deliberately is not here: it changes only the *order*, and the
   * highlight follows the item through it.
   */
  useEffect(() => {
    setActive({ index: 0, name: null });
  }, [
    deferredQuery,
    deferredZone,
    deferredEra,
    deferredSource,
    deferredHideNoDrop,
    deferredLiveOnly,
  ]);

  useEffect(() => {
    scrollToActive.current(activeIndex);
  }, [activeIndex, rows]);

  const shardStatus = catalog.shards[position.type];
  const loading = catalog.status === 'loading' || shardStatus === 'loading';

  /*
   * ...and warmed while the thread is idle, so the first keystroke does not
   * pay for it either. Building it on open cost every open; building it purely
   * on demand moved the same cost onto the first character typed. Idle time is
   * the one moment nobody is waiting.
   */
  useEffect(() => {
    if (loading) return;
    const scope = globalThis as {
      requestIdleCallback?: (callback: () => void) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    if (typeof scope.requestIdleCallback !== 'function') return;
    const handle = scope.requestIdleCallback(() => {
      searchIndexFor(catalog.revision, catalog.items);
    });
    return () => scope.cancelIdleCallback?.(handle);
  }, [catalog.revision, catalog.items, loading]);

  /*
   * List navigation is layered over the filter controls, so it has to give the
   * controls back the keys they own: a <select> needs its arrows to change
   * value, and a text box needs Home/End for the caret. Without that scoping
   * the era and source dropdowns could not be operated from the keyboard at
   * all, and Home in the search box jumped the list instead of the cursor.
   * Ctrl/Cmd+Home/End still jumps the list from inside the text box.
   */
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!rows.length) return;
    const target = event.target as HTMLElement | null;
    if (target?.tagName === 'SELECT') return;
    const inTextField =
      target instanceof HTMLInputElement && target.type !== 'checkbox' && !event.altKey;
    const jumpsList = !inTextField || event.ctrlKey || event.metaKey;

    const move = (delta: number) => {
      event.preventDefault();
      moveActive((from) => from + delta);
    };
    switch (event.key) {
      case 'ArrowDown':
        move(1);
        break;
      case 'ArrowUp':
        move(-1);
        break;
      case 'PageDown':
        move(10);
        break;
      case 'PageUp':
        move(-10);
        break;
      case 'Home':
        if (!jumpsList) return;
        event.preventDefault();
        moveActive(0);
        break;
      case 'End':
        if (!jumpsList) return;
        event.preventDefault();
        moveActive(rows.length - 1);
        break;
      case 'Enter': {
        const pick = rows[activeIndex];
        if (pick) {
          event.preventDefault();
          onSelect(pick.item, rankPreview);
        }
        break;
      }
      default:
        break;
    }
  };

  return (
    <Modal
      title={`Choose ${position.label}`}
      onClose={onClose}
      headerExtra={
        <div className="rowline">
          <span className="hint">Preview at</span>
          <UpgradeStepper value={preview} label="ranking preview" onChange={setPreview} />
        </div>
      }
      footer={
        <>
          <span className="grow" />
          {currentName ? (
            <button type="button" className="btn btn-danger" onClick={onClear}>
              Clear slot
            </button>
          ) : null}
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
        </>
      }
    >
      <div className="picker-controls" onKeyDown={onKeyDown}>
        <input
          ref={searchRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${position.label.toLowerCase()} items…`}
          aria-label="Search items by name"
          autoComplete="off"
          role="combobox"
          aria-expanded={rows.length > 0}
          aria-controls="picker-results"
          aria-activedescendant={rows.length ? `picker-option-${activeIndex}` : undefined}
        />
        <input
          type="search"
          value={zoneQuery}
          onChange={(e) => setZoneQuery(e.target.value)}
          placeholder="Zone / mob / quest…"
          aria-label="Filter by source text"
          style={{ flex: '0 1 190px' }}
          autoComplete="off"
        />
        {/* Each of these drives the list through a deferred copy of its state;
            see the note where they are declared. */}
        <select
          value={era}
          onChange={(e) => setEra(e.target.value)}
          aria-label="Filter by era"
        >
          <option value="any">Any era</option>
          {ERA_ORDER.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <select
          value={source}
          onChange={(e) => setSource(e.target.value as SourceFilter)}
          aria-label="Filter by source"
        >
          <option value="any">Any source</option>
          <option value="drop">Drops</option>
          <option value="quest">Quest</option>
          <option value="vendor">Vendor</option>
          <option value="crafted">Crafted</option>
        </select>
        {/* One group, so the second checkbox cannot wrap away on its own and
            end up orphaned at the far left under its sibling. */}
        <span className="checkgroup">
          <label className="checkline">
            <input
              type="checkbox"
              checked={liveOnly}
              onChange={(e) => setLiveOnly(e.target.checked)}
            />
            Live content only
          </label>
          <label className="checkline">
            <input
              type="checkbox"
              checked={hideNoDrop}
              onChange={(e) => setHideNoDrop(e.target.checked)}
            />
            Hide No Drop
          </label>
        </span>
      </div>

      <div className="picker-meta">
        {/* Nothing is capped, so this count is also the number you can reach. */}
        <span>
          {loading ? 'Loading item data…' : `${count(rows.length)} match${rows.length === 1 ? '' : 'es'}`}
        </span>
        {currentName ? <span>Equipped: {currentName}</span> : null}
        {catalog.usingFixture ? <span className="era-label">Fixture data</span> : null}
        <span className="picker-note">
          {position.type === 'ANY'
            ? 'Any Slot takes any wearable item — a worn position, not a hand, so weapon damage scores nothing here.'
            : `Ranked by EP against this set's weights, cap-aware.`}
        </span>
      </div>

      <div
        className="results"
        id="picker-results"
        ref={virtual.containerRef}
        role="listbox"
        aria-label={`${position.label} candidates`}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        {!loading && !rows.length ? (
          <div className="empty-state" style={{ border: 0 }}>
            <h2>No matching items</h2>
            <p>
              {catalog.status === 'ready'
                ? 'Try clearing filters, or allow content that is not yet live.'
                : 'No catalog data is loaded yet.'}
            </p>
          </div>
        ) : null}

        {/*
         * The canvas is the full height of every candidate, so the scrollbar
         * tells the truth about how long the list is; the rows inside it are
         * only the ones near the viewport. `role="presentation"` keeps the
         * options direct children of the listbox as far as assistive tech is
         * concerned, and `overflow-anchor` off stops Chrome fighting the
         * scroll corrections the measurements make.
         */}
        <div
          className="results-canvas"
          role="presentation"
          style={{ position: 'relative', height: virtual.totalHeight, overflowAnchor: 'none' }}
        >
          {virtual.indices.map((index) => {
            const entry = rows[index];
            if (!entry) return null;
            const item = entry.item;
            const isEquipped = currentName?.toLowerCase() === item.n.toLowerCase();
            /*
             * The delta line is a *comparison*, so it only earns its place when
             * there is something to compare against. With an empty slot the
             * delta equalled the whole stat vector, and every row printed its
             * stats twice — once plain, once green, in a different word order —
             * on the first list every new user opens. And on the row that is
             * already worn, the comparison is with itself.
             */
            const deltas =
              currentItem && !isEquipped
                ? statDeltas(item, rankPreview, currentItem, currentUpgrade)
                : [];
            const era2 = eraLabel(item);
            const source2 = sourceSummary(item);
            return (
              <button
                type="button"
                key={`${item.n}-${index}`}
                id={`picker-option-${index}`}
                ref={virtual.rowRef(index)}
                className={`result${index === activeIndex ? ' active' : ''}${isEquipped ? ' equipped-now' : ''}`}
                data-active={index === activeIndex}
                role="option"
                aria-selected={index === activeIndex}
                aria-setsize={rows.length}
                aria-posinset={index + 1}
                /*
                 * The listbox is one tab stop, per the ARIA pattern it already
                 * implements. As plain tab stops these rows cost 157 Tab presses
                 * to reach Cancel, and Shift-Tab walked back up through them.
                 */
                tabIndex={-1}
                style={{ position: 'absolute', top: virtual.offsetOf(index), left: 0, right: 0 }}
                onMouseMove={(event) => {
                  // Not `onMouseEnter`: scrolling the list under a stationary
                  // cursor fires enter events, which dragged the active row away
                  // from wherever the arrow keys had just put it.
                  if (pointerMoved(event)) moveActive(index);
                }}
                onClick={() => onSelect(item, rankPreview)}
                {...itemHoverProps(item, rankPreview, context, position.type)}
              >
                <span>
                  <span className="result-name">
                    <span className="result-glyph" aria-hidden="true" style={{ color: itemNameColor(item, context) }}>
                      <SlotGlyph slot={position.type} size={22} />
                    </span>
                    <span className="iname" style={{ color: itemNameColor(item, context) }}>
                      {item.n}
                    </span>
                    {era2 ? <span className="tag tag-era">{era2}</span> : null}
                    {!isLive(item) ? <span className="tag tag-locked">Not live</span> : null}
                    {displayFlags(item.fl)
                      .slice(0, 2)
                      .map((flag) => (
                        <span className="tag" key={flag}>
                          {flag}
                        </span>
                      ))}
                    {isEquipped ? <span className="tag tag-worn">Equipped</span> : null}
                  </span>
                  <span className="result-line">
                    {statVector(item, rankPreview)
                      .slice(0, 8)
                      .map((s) => statChip(s.key, s.value))
                      .join(' · ') || 'No stats'}
                  </span>
                  {deltas.length ? (
                    <span className="result-deltas">
                      {deltas.slice(0, 6).map((d) => (
                        <span key={d.key} className={d.delta > 0 ? 'good' : 'bad'}>
                          {signed(d.delta)} {shortStatLabel(d.key)}
                        </span>
                      ))}
                    </span>
                  ) : null}
                  {source2 ? <span className="result-line dim">{source2}</span> : null}
                </span>
                <span className="result-score">
                  <span className="n">{epText(entry.score)}</span>
                  <span className="d dim"> EP</span>
                  {currentItem && !isEquipped ? (
                    <>
                      <br />
                      <span className={`d ${entry.score >= wornScore ? 'good' : 'bad'}`}>
                        {signedDec(entry.score - wornScore)} vs worn
                      </span>
                    </>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
