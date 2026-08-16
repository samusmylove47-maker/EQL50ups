/**
 * The whole catalog, reachable.
 *
 * The previous version scored 5,848 matches, rendered the first 250 and
 * offered no way to reach item 251 — no pagination, no "load more", and rows
 * that were inert `<tr>`s you could click for no effect. That kills the one
 * workflow this screen exists for: something drops mid-raid, you look it up,
 * you decide. So: fixed-size pages over the whole result set, and rows that
 * open a detail dialog and can equip straight into the set you were editing.
 *
 * Paging rather than virtualisation on purpose. The expensive half is scoring
 * every candidate, which is memoised and unchanged; a page is a `slice`, so it
 * costs one array copy and renders a bounded number of rows with no scroll
 * measurement, no row-height guessing and no jump-to-item bugs.
 */

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { activeContext, canUse, makeContext, type LoadoutContext } from '../engine/character';
import { CLASSES, ERA_ORDER, LEVEL_CAP, SLOT_TYPES, type ClassCode } from '../engine/constants';
import { PRESET_PROFILES, scoreItem, type WeightProfile } from '../engine/ep';
import { BASE_STATE, tier, type UpgradeState } from '../engine/upgrade';
import type { Item } from '../engine/types';
import { useCatalog } from '../data/catalog';
import type { SlotCode } from '../data/normalize';
import { searchIndexFor } from '../data/searchIndex';
import { UpgradeStepper } from '../components/UpgradeStepper';
import { count, dec, signed } from '../lib/format';
import { eraLabel, flagLabel, isLive, qualityColor } from '../lib/itemStyle';
import { ItemDetail } from '../components/ItemDetail';
import { statVector } from '../selectors/gear';
import { characterFor, setsForCharacter, useApp } from '../state/store';
import { href, navigate } from '../router';
import { SLOT_POSITIONS } from '../engine/constants';

type SortKey = 'ep' | 'name' | 'era' | 'slot';
type SortDir = 'asc' | 'desc';

/** Rows per page. Large enough to scan, small enough to render instantly. */
const PAGE_SIZE = 100;

/** How each column sorts on its first click: scores high-first, text A-first. */
const NATURAL_DIRECTION: Record<SortKey, SortDir> = {
  ep: 'desc',
  name: 'asc',
  era: 'asc',
  slot: 'asc',
};

export function ItemBrowser() {
  const catalog = useCatalog();
  const ensureAll = useCatalog((s) => s.ensureAll);
  const app = useApp();
  const characters = app.characters;

  const [query, setQuery] = useState('');
  const [slot, setSlot] = useState<'any' | SlotCode>('any');
  const [era, setEra] = useState('any');
  const [classFilter, setClassFilter] = useState<'any' | ClassCode>('any');
  const [profileId, setProfileId] = useState(PRESET_PROFILES[0]?.id ?? 'balanced');
  const [upgrade, setUpgrade] = useState<UpgradeState>(BASE_STATE);
  const [liveOnly, setLiveOnly] = useState(true);
  const [sort, setSort] = useState<SortKey>('ep');
  const [dir, setDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(0);
  const [detail, setDetail] = useState<Item | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  // Clicking the column you are already sorted by reverses it; clicking another
  // starts it in whichever direction that column reads best.
  const sortBy = (key: SortKey) => {
    if (key === sort) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSort(key);
      setDir(NATURAL_DIRECTION[key]);
    }
  };

  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    void ensureAll();
  }, [ensureAll]);

  const weights: WeightProfile = useMemo(
    () => PRESET_PROFILES.find((p) => p.id === profileId)?.weights ?? {},
    [profileId],
  );

  // A filter, not a character: one class at the level cap, so the browser shows
  // everything that class can ever wear rather than what one saved character can.
  const filterContext: LoadoutContext | undefined = useMemo(() => {
    if (classFilter === 'any') return undefined;
    return makeContext([classFilter], null, { [classFilter]: LEVEL_CAP });
  }, [classFilter]);

  const matches = useMemo(
    () => searchIndexFor(catalog.revision, catalog.items).search(deferredQuery),
    [catalog.revision, catalog.items, deferredQuery],
  );

  const { rows, total } = useMemo(() => {
    const scored: Array<{ item: Item; score: number }> = [];
    for (const item of catalog.items) {
      if (matches && !matches.has(item)) continue;
      if (slot !== 'any' && !item.sl.includes(slot)) continue;
      if (era !== 'any' && item.era !== era) continue;
      if (liveOnly && !isLive(item)) continue;
      if (filterContext && !canUse({ classes: item.cl, races: item.ra }, filterContext)) continue;
      scored.push({ item, score: scoreItem(item, upgrade, weights).total });
    }
    type Row = { item: Item; score: number };
    const eraIndex = (row: Row) =>
      ERA_ORDER.indexOf((row.item.era ?? '') as (typeof ERA_ORDER)[number]);
    // Ascending comparators only; direction is applied once, and the name
    // tiebreaker stays ascending in both so the order is stable and readable.
    const compare: Record<SortKey, (a: Row, b: Row) => number> = {
      ep: (a, b) => a.score - b.score,
      name: (a, b) => a.item.n.localeCompare(b.item.n),
      era: (a, b) => eraIndex(a) - eraIndex(b),
      slot: (a, b) => (a.item.sl[0] ?? '').localeCompare(b.item.sl[0] ?? ''),
    };
    const sign = dir === 'asc' ? 1 : -1;
    const primary = compare[sort];
    scored.sort((a, b) => sign * primary(a, b) || a.item.n.localeCompare(b.item.n));
    return { rows: scored, total: scored.length };
  }, [catalog.items, matches, slot, era, liveOnly, filterContext, weights, upgrade, sort, dir]);

  // Narrowing the search should put you back at the top of the new results,
  // not on page 14 of a list that no longer has one.
  useEffect(() => {
    setPage(0);
  }, [deferredQuery, slot, era, classFilter, liveOnly, sort, dir, profileId, upgrade]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  // Any change to the filters can shrink the result set under the current page.
  const safePage = Math.min(page, pageCount - 1);
  const start = safePage * PAGE_SIZE;
  const pageRows = useMemo(() => rows.slice(start, start + PAGE_SIZE), [rows, start]);

  const goTo = (next: number) => {
    setPage(Math.max(0, Math.min(pageCount - 1, next)));
    tableRef.current?.scrollIntoView({ block: 'start' });
  };

  /*
   * "Equip" targets: the set the reader was last editing, and the positions
   * this item can legally occupy in it. Without a set there is nothing to
   * equip into, and the detail dialog quietly drops the section.
   */
  const targetSet = setsForCharacter(app, app.activeCharacterId ?? characters[0]?.id ?? null)[0];
  const targetCharacter = characterFor(app, targetSet);
  const equipTargets = useMemo(() => {
    if (!detail || !targetSet) return [];
    return SLOT_POSITIONS.filter(
      (position) => position.type === 'ANY' || detail.sl.includes(position.type),
    ).map((position) => ({ positionId: position.id, label: position.label }));
  }, [detail, targetSet]);

  const pageNav = (position: 'top' | 'bottom') =>
    pageCount > 1 ? (
      <nav className="page-nav" aria-label={`Item pages (${position})`}>
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => goTo(safePage - 1)}
          disabled={safePage === 0}
        >
          ← Previous
        </button>
        <span>
          Page {safePage + 1} of {count(pageCount)}
        </span>
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => goTo(safePage + 1)}
          disabled={safePage >= pageCount - 1}
        >
          Next →
        </button>
        <label className="pagejump">
          Jump to page
          <input
            type="number"
            min={1}
            max={pageCount}
            value={safePage + 1}
            aria-label={`Jump to page (${position})`}
            style={{ width: 76 }}
            onChange={(e) => goTo(Number(e.target.value) - 1)}
          />
        </label>
      </nav>
    ) : null;

  const header = (key: SortKey, label: string, className?: string) => {
    const activeSort = sort === key;
    return (
      <th className={className} aria-sort={activeSort ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
        <button
          type="button"
          onClick={() => sortBy(key)}
          title={activeSort ? 'Reverse this column' : `Sort by ${label}`}
        >
          {label}
          {activeSort ? (dir === 'asc' ? ' ▴' : ' ▾') : ''}
        </button>
      </th>
    );
  };

  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">Items</h1>
        <div className="rowline">
          <span className="hint">
            {count(total)} match{total === 1 ? '' : 'es'}
            {total ? ` · ${count(start + 1)}–${count(Math.min(start + PAGE_SIZE, total))}` : ''}
          </span>
        </div>
      </div>

      <div className="panel panel-pad" style={{ marginBottom: 14 }}>
        <div className="rowline">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search all items…"
            aria-label="Search items"
            style={{ flex: '1 1 260px' }}
            autoComplete="off"
          />
          <select
            value={slot}
            onChange={(e) => setSlot(e.target.value as 'any' | SlotCode)}
            aria-label="Filter by slot"
          >
            <option value="any">Any slot</option>
            {SLOT_TYPES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
            <option value="ANY">ANY SLOT</option>
          </select>
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value as 'any' | ClassCode)}
            aria-label="Filter by class"
          >
            <option value="any">Any class</option>
            {CLASSES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select value={era} onChange={(e) => setEra(e.target.value)} aria-label="Filter by era">
            <option value="any">Any era</option>
            {ERA_ORDER.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <select
            value={profileId}
            onChange={(e) => setProfileId(e.target.value)}
            aria-label="Scoring profile"
          >
            {PRESET_PROFILES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} weights
              </option>
            ))}
          </select>
          <span className="rowline">
            <span className="hint">Score at</span>
            <UpgradeStepper value={upgrade} label="scoring preview" onChange={setUpgrade} />
            <button type="button" className="btn btn-sm btn-quiet" onClick={() => setUpgrade(tier(0))}>
              Reset
            </button>
          </span>
          <label className="checkline">
            <input type="checkbox" checked={liveOnly} onChange={(e) => setLiveOnly(e.target.checked)} />
            Live content only
          </label>
        </div>
        {characters.length ? (
          <p className="hint" style={{ marginTop: 10 }}>
            Scored against the {PRESET_PROFILES.find((p) => p.id === profileId)?.label ?? 'preset'}{' '}
            preset. Open any row for the full item, or your own set for cap-aware scoring.
          </p>
        ) : null}
      </div>

      {catalog.status === 'ready' && !rows.length ? (
        <div className="empty-state">
          <h2>Nothing matches</h2>
          <p>Loosen a filter, or allow content that is not yet live in the current era.</p>
        </div>
      ) : null}

      {pageNav('top')}

      {rows.length ? (
        <div className="table-wrap" ref={tableRef}>
          <table className="data">
            <thead>
              <tr>
                {header('name', 'Item')}
                {header('slot', 'Slot')}
                <th>Classes</th>
                <th>Stats</th>
                {header('era', 'Era')}
                {header('ep', 'EP', 'num')}
              </tr>
            </thead>
            <tbody>
              {pageRows.map(({ item, score }) => (
                <tr
                  key={item.n}
                  className="rowlink"
                  tabIndex={0}
                  role="button"
                  aria-label={`Open ${item.n}`}
                  onClick={() => setDetail(item)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    setDetail(item);
                  }}
                >
                  <td>
                    <span style={{ color: qualityColor(item), fontWeight: 600 }}>{item.n}</span>
                    <div className="chip-row" style={{ marginTop: 3 }}>
                      {item.fl.slice(0, 3).map((flag) => (
                        <span className="tag" key={flag}>
                          {flagLabel(flag)}
                        </span>
                      ))}
                      {!isLive(item) ? <span className="tag tag-locked">Not live</span> : null}
                    </div>
                  </td>
                  <td className="dim">{item.sl.join(' / ') || '—'}</td>
                  <td className="dim">{item.cl.join(' ') || 'ALL'}</td>
                  <td>
                    {statVector(item, upgrade)
                      .slice(0, 6)
                      .map((s) => `${s.label} ${signed(s.value)}`)
                      .join(' · ') || <span className="dim">—</span>}
                  </td>
                  <td>
                    {eraLabel(item) ? <span className="era-label">{eraLabel(item)}</span> : <span className="dim">—</span>}
                  </td>
                  <td className="num">{dec(score, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {pageNav('bottom')}

      {detail ? (
        <ItemDetail
          item={detail}
          upgrade={upgrade}
          equipTargets={equipTargets}
          {...(targetSet ? { setName: targetSet.name } : {})}
          context={targetCharacter ? activeContext(targetCharacter) : undefined}
          onEquip={(positionId) => {
            if (!targetSet) return;
            app.equip(targetSet.id, positionId, detail.n, upgrade);
            setDetail(null);
            navigate(href.set(targetSet.id));
          }}
          onClose={() => setDetail(null)}
        />
      ) : null}
    </div>
  );
}
