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
 * Filter changes are transitions and the preview tier is deferred, so a
 * re-rank never blocks the control that asked for it.
 *
 * Keyboard: ↑/↓ move, PgUp/PgDn jump, Home/End, Enter equips, Escape closes
 * (handled by the modal shell). Rows are `tabindex="-1"`, as the ARIA listbox
 * pattern requires: the widget is one tab stop, not one per candidate.
 */

import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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
import { displayFlags, eraLabel, isLive, itemNameColor, sourceSummary } from '../lib/itemStyle';
import {
  rankSlotItems,
  scoreContextFrom,
  shortStatLabel,
  statDeltas,
  statVector,
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

type SourceFilter = 'any' | 'drop' | 'quest' | 'vendor' | 'crafted';

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

function matchesSource(item: Item, filter: SourceFilter): boolean {
  if (filter === 'any') return true;
  const src = item.src;
  if (!src) return false;
  if (filter === 'drop') return Boolean(src.m?.length || src.z?.length);
  if (filter === 'quest') return Boolean(src.q?.length);
  if (filter === 'vendor') return Boolean(src.v?.length);
  return src.c === true;
}

function zoneText(item: Item): string {
  const src = item.src;
  if (!src) return '';
  return [...(src.z ?? []), ...(src.m ?? []), ...(src.q ?? []), ...(src.v ?? [])]
    .join(' ')
    .toLowerCase();
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
  const [era, setEra] = useState<string>('any');
  const [source, setSource] = useState<SourceFilter>('any');
  const [liveOnly, setLiveOnly] = useState(true);
  const [hideNoDrop, setHideNoDrop] = useState(false);
  const [preview, setPreview] = useState<UpgradeState>(currentUpgrade ?? BASE_STATE);
  const [active, setActive] = useState(0);

  const deferredQuery = useDeferredValue(query);
  const deferredZone = useDeferredValue(zoneQuery);
  /*
   * The stepper is a control, so it answers instantly; the re-rank it triggers
   * is the expensive part and rides a transition. Rows are scored, rendered
   * and equipped at `rankPreview` so the numbers on screen and the tier that
   * gets equipped are always the same tier.
   */
  const rankPreview = useDeferredValue(preview);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void ensureSlot(position.type as SlotCode);
  }, [ensureSlot, position.type]);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const existing = useMemo(() => scoreContextFrom(contextTotals), [contextTotals]);

  const ranked = useMemo(
    () =>
      rankSlotItems(catalog, {
        slot: position.type as SlotCode,
        context,
        weights,
        upgrade: rankPreview,
        existing,
        includeUnreleased: !liveOnly,
      }),
    [catalog, position.type, context, weights, rankPreview, existing, liveOnly],
  );

  const matches = useMemo(
    () => searchIndexFor(catalog.revision, catalog.items).search(deferredQuery),
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
      if (era !== 'any' && item.era !== era) continue;
      if (!matchesSource(item, source)) continue;
      if (hideNoDrop && item.fl.includes('NO_DROP')) continue;
      if (zoneNeedle && !zoneText(item).includes(zoneNeedle)) continue;
      out.push(entry);
    }
    return out;
  }, [ranked, matches, era, source, hideNoDrop, deferredZone]);

  const virtual = useVirtualList({
    count: rows.length,
    estimate: ROW_ESTIMATE,
    // The active row stays mounted wherever it is, so `aria-activedescendant`
    // always names an element that exists.
    pinned: rows.length ? Math.min(active, rows.length - 1) : null,
  });
  const { scrollToIndex } = virtual;

  useEffect(() => {
    setActive(0);
  }, [deferredQuery, deferredZone, era, source, hideNoDrop, liveOnly]);

  useEffect(() => {
    scrollToIndex(active);
  }, [active, rows, scrollToIndex]);

  const shardStatus = catalog.shards[position.type];
  const loading = catalog.status === 'loading' || shardStatus === 'loading';

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
      setActive((i) => Math.max(0, Math.min(rows.length - 1, i + delta)));
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
        setActive(0);
        break;
      case 'End':
        if (!jumpsList) return;
        event.preventDefault();
        setActive(rows.length - 1);
        break;
      case 'Enter': {
        const pick = rows[active];
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
          aria-activedescendant={rows.length ? `picker-option-${active}` : undefined}
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
        {/*
         * Every filter re-ranks or re-filters up to 1,800 candidates, so each
         * one is a transition: React keeps the old list on screen and stays
         * responsive while the new one is built, and a second change abandons
         * the first instead of queueing behind it. The controls themselves are
         * native and update on their own, so nothing here feels deferred.
         */}
        <select
          value={era}
          onChange={(e) => {
            const value = e.target.value;
            startTransition(() => setEra(value));
          }}
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
          onChange={(e) => {
            const value = e.target.value as SourceFilter;
            startTransition(() => setSource(value));
          }}
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
              onChange={(e) => {
                const value = e.target.checked;
                startTransition(() => setLiveOnly(value));
              }}
            />
            Live content only
          </label>
          <label className="checkline">
            <input
              type="checkbox"
              checked={hideNoDrop}
              onChange={(e) => {
                const value = e.target.checked;
                startTransition(() => setHideNoDrop(value));
              }}
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
                className={`result${index === active ? ' active' : ''}${isEquipped ? ' equipped-now' : ''}`}
                data-active={index === active}
                role="option"
                aria-selected={index === active}
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
                  if (pointerMoved(event)) setActive(index);
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
                      .map((s) => `${shortStatLabel(s.key)} ${signed(s.value)}`)
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
