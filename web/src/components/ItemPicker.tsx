/**
 * Slot item picker.
 *
 * Speed is the brand, so the work is split in two: an expensive pass that
 * scores and sorts every legal candidate for the slot (memoised on catalog
 * revision, class trio, weights, preview tier and cap context), and a cheap
 * pass that filters that already-sorted array through the trigram search
 * index, stopping once the render budget is full. Typing therefore never
 * rescores — it only re-filters an array that is already in EP order.
 *
 * Keyboard: ↑/↓ move, PgUp/PgDn jump, Home/End, Enter equips, Escape closes
 * (handled by the modal shell).
 */

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import type { Character } from '../engine/character';
import { ERA_ORDER, type SlotPosition } from '../engine/constants';
import { scoreItem, type WeightProfile } from '../engine/ep';
import type { StatTotals } from '../engine/stats';
import { BASE_STATE, type UpgradeState } from '../engine/upgrade';
import type { Item } from '../engine/types';
import { useCatalog } from '../data/catalog';
import type { SlotCode } from '../data/normalize';
import { searchIndexFor } from '../data/searchIndex';
import { count, dec, signed, signedDec } from '../lib/format';
import { eraLabel, flagLabel, isLive, itemInitials, qualityColor, sourceSummary } from '../lib/itemStyle';
import {
  rankSlotItems,
  scoreContextFrom,
  statDeltas,
  statVector,
  type ScoredItem,
} from '../selectors/gear';
import { Modal } from './Modal';
import { UpgradeStepper } from './UpgradeStepper';

const RENDER_LIMIT = 150;

type SourceFilter = 'any' | 'drop' | 'quest' | 'vendor' | 'crafted';

export interface ItemPickerProps {
  position: SlotPosition;
  character: Character | undefined;
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
  character,
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
  const listRef = useRef<HTMLDivElement>(null);
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
        character,
        weights,
        upgrade: preview,
        existing,
        includeUnreleased: !liveOnly,
      }),
    [catalog, position.type, character, weights, preview, existing, liveOnly],
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

  const { rows, total } = useMemo(() => {
    const out: ScoredItem[] = [];
    const zoneNeedle = deferredZone.trim().toLowerCase();
    let seen = 0;
    for (const entry of ranked) {
      const item = entry.item;
      if (matches && !matches.has(item)) continue;
      if (era !== 'any' && item.era !== era) continue;
      if (!matchesSource(item, source)) continue;
      if (hideNoDrop && item.fl.includes('NO_DROP')) continue;
      if (zoneNeedle && !zoneText(item).includes(zoneNeedle)) continue;
      seen++;
      if (out.length < RENDER_LIMIT) out.push(entry);
    }
    return { rows: out, total: seen };
  }, [ranked, matches, era, source, hideNoDrop, deferredZone]);

  useEffect(() => {
    setActive(0);
  }, [deferredQuery, deferredZone, era, source, hideNoDrop, liveOnly]);

  useEffect(() => {
    const node = listRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    // Guarded: not every environment implements scrollIntoView.
    if (typeof node?.scrollIntoView === 'function') node.scrollIntoView({ block: 'nearest' });
  }, [active, rows]);

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
          onSelect(pick.item, preview);
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
          <span className="hint">Rank at</span>
          <UpgradeStepper value={preview} label="ranking preview" onChange={setPreview} />
        </div>
      }
      footer={
        <>
          <span className="hint grow">
            {position.type === 'ANY'
              ? 'Any Slot takes any wearable item. It is a worn position, not a hand, so weapon damage and ratio score nothing here.'
              : `Ranked by EP against this set's weights, cap-aware.`}
          </span>
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
        <select value={era} onChange={(e) => setEra(e.target.value)} aria-label="Filter by era">
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
        <label className="checkline">
          <input type="checkbox" checked={liveOnly} onChange={(e) => setLiveOnly(e.target.checked)} />
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
      </div>

      <div className="picker-meta">
        <span>
          {loading
            ? 'Loading item data…'
            : `${count(total)} match${total === 1 ? '' : 'es'}${
                total > rows.length ? ` · showing top ${count(rows.length)}` : ''
              }`}
        </span>
        {currentName ? <span>Equipped: {currentName}</span> : null}
        {catalog.usingFixture ? <span className="era-label">Fixture data</span> : null}
      </div>

      <div
        className="results"
        id="picker-results"
        ref={listRef}
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

        {rows.map((entry, index) => {
          const item = entry.item;
          const deltas = statDeltas(item, preview, currentItem, currentUpgrade);
          const isEquipped = currentName?.toLowerCase() === item.n.toLowerCase();
          const era2 = eraLabel(item);
          const source2 = sourceSummary(item);
          return (
            <button
              type="button"
              key={`${item.n}-${index}`}
              id={`picker-option-${index}`}
              className={`result${index === active ? ' active' : ''}${isEquipped ? ' equipped-now' : ''}`}
              data-active={index === active}
              role="option"
              aria-selected={index === active}
              onMouseEnter={() => setActive(index)}
              onClick={() => onSelect(item, preview)}
            >
              <span>
                <span className="result-name">
                  <span className="slot-icon" style={{ width: 22, height: 22, fontSize: 9 }} aria-hidden="true">
                    {itemInitials(item.n)}
                  </span>
                  <span style={{ color: qualityColor(item) }}>{item.n}</span>
                  {era2 ? <span className="tag tag-era">{era2}</span> : null}
                  {!isLive(item) ? <span className="tag tag-locked">Not live</span> : null}
                  {item.fl.slice(0, 2).map((flag) => (
                    <span className="tag" key={flag}>
                      {flagLabel(flag)}
                    </span>
                  ))}
                  {isEquipped ? <span className="tag">Equipped</span> : null}
                </span>
                <span className="result-line">
                  {statVector(item, preview)
                    .slice(0, 8)
                    .map((s) => `${s.label} ${signed(s.value)}`)
                    .join(' · ') || 'No stats'}
                </span>
                {deltas.length ? (
                  <span className="result-deltas">
                    {deltas.slice(0, 6).map((d) => (
                      <span key={d.key} className={d.delta > 0 ? 'good' : 'bad'}>
                        {signed(d.delta)} {d.label}
                      </span>
                    ))}
                  </span>
                ) : null}
                {source2 ? <span className="result-line dim">{source2}</span> : null}
              </span>
              <span className="result-score">
                <span className="n">{dec(entry.score, 1)}</span>
                <span className="d dim"> EP</span>
                {currentItem ? (
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
    </Modal>
  );
}
