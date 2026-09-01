/**
 * The whole catalog, reachable.
 *
 * The previous version rendered only the first 250 of its matches and offered
 * no way to reach item 251 — no pagination, no "load more", and rows
 * that were inert `<tr>`s you could click for no effect. That kills the one
 * workflow this screen exists for: something drops mid-raid, you look it up,
 * you decide. So: fixed-size pages over the whole result set, and rows that
 * open a detail dialog and can equip straight into the set you were editing.
 *
 * Paging rather than virtualisation on purpose. The expensive half is scoring
 * every candidate, which is memoised and unchanged; a page is a `slice`, so it
 * costs one array copy and renders a bounded number of rows with no scroll
 * measurement, no row-height guessing and no jump-to-item bugs.
 *
 * **This screen answers to the set, not to itself.** It used to be an island:
 * its own hardcoded scoring preset, its own class filter opening on the whole
 * catalog, its own equip buttons that ignored the loadout, and an empty state
 * that blamed the reader for a decision the pipeline had made. Every one of
 * those produced a visible contradiction with the slot picker one screen away —
 * the same sword at 41.0 and 53.0 EP, an item the picker refuses to offer being
 * equipped from here anyway. So the defaults are all derived from whatever set
 * is open: its weights score the table, its loadout filters and colours it, and
 * its rules decide what may be equipped. A preset and the whole catalog are
 * both one dropdown away; they are lenses, not the ground state.
 */

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { activeContext, canUse, makeContext, type LoadoutContext } from '../engine/character';
import { CLASSES, ERA_ORDER, LEVEL_CAP, SLOT_TYPES, type ClassCode } from '../engine/constants';
import { PRESET_PROFILES, scoreItem, type WeightProfile } from '../engine/ep';
import { BASE_STATE, tier, type UpgradeState } from '../engine/upgrade';
import type { Item } from '../engine/types';
import { useCatalog } from '../data/catalog';
import { statsAreUnknown, type SlotCode } from '../data/normalize';
import { restrictionText } from '../lib/restrictionText';
import {
  findQuarantined,
  loadQuarantineIndex,
  type QuarantineIndex,
} from '../data/quarantine';
import { searchIndexFor } from '../data/searchIndex';
import { UpgradeStepper } from '../components/UpgradeStepper';
import { count, ep as epText } from '../lib/format';
import { eraLabel, itemNameColor, usabilityOf } from '../lib/itemStyle';
import { ItemDetail } from '../components/ItemDetail';
import { itemHoverProps } from '../components/ItemWindow';
import { SlotGlyph } from '../components/SlotGlyph';
import { statChip, statVector } from '../selectors/gear';
import { characterFor, setsForCharacter, useApp } from '../state/store';
import { href, navigate } from '../router';
import { SLOT_POSITIONS } from '../engine/constants';

type SortKey = 'ep' | 'name' | 'era' | 'slot';
type SortDir = 'asc' | 'desc';

/** Rows per page. Large enough to scan, small enough to render instantly. */
const PAGE_SIZE = 100;

/**
 * The scoring option that is not a preset.
 *
 * This screen used to hardcode `PRESET_PROFILES[0]` — *Melee DPS* — and never
 * look at the set the reader was editing, so the same sword was 41.0 EP here
 * and 53.0 EP in the slot picker one screen away. Across the five presets one
 * item spans 14.0 to 92.4; a 2.2x disagreement on the tool's only ranking
 * number is not a preference, it is two tools disagreeing in one window. The
 * set's own weights are what every picker, the auto-fill and the upgrade
 * ranking already use, so they are what this screen defaults to whenever there
 * is a set to read them from.
 */
const SET_WEIGHTS = 'set';

/**
 * The class filter that is a loadout rather than a class.
 *
 * A character in this game runs three classes at once, so "filter by WAR" is
 * not the same question as "what can Critic wear" — the second is a union of
 * three, and it is the only one a player actually asks. With a character
 * loaded this is the default, which is also what stops the table opening on a
 * page where 57 of 100 names are the red that means *not for you*.
 */
const LOADOUT_FILTER = 'loadout';

type ClassFilter = 'any' | typeof LOADOUT_FILTER | ClassCode;

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
  /*
   * Both of these are "what the reader chose", and `null` means they have not
   * chosen — the effective value is derived below from whatever character is
   * loaded. They are not seeded with `useState(initial)` because the persisted
   * store hydrates *after* first render: seeding would read an empty character
   * list, latch `any` / `melee-dps`, and leave the defaults permanently wrong
   * for everyone who arrives on this route directly.
   */
  const [classChoice, setClassChoice] = useState<ClassFilter | null>(null);
  const [profileChoice, setProfileChoice] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState<UpgradeState>(BASE_STATE);
  const [sort, setSort] = useState<SortKey>('ep');
  const [dir, setDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(0);
  const [detail, setDetail] = useState<Item | null>(null);
  const [quarantine, setQuarantine] = useState<QuarantineIndex | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  /*
   * The set the reader was last editing: the equip target, the source of the
   * scoring weights, and the loadout every name is judged against. Read before
   * the filters because the filters default to it.
   */
  const targetSet = setsForCharacter(app, app.activeCharacterId ?? characters[0]?.id ?? null)[0];
  const targetCharacter = characterFor(app, targetSet);
  const loadoutContext = useMemo(
    () => (targetCharacter ? activeContext(targetCharacter) : undefined),
    [targetCharacter],
  );

  const classFilter: ClassFilter = classChoice ?? (loadoutContext ? LOADOUT_FILTER : 'any');
  const profileId = profileChoice ?? (targetSet ? SET_WEIGHTS : (PRESET_PROFILES[0]?.id ?? 'balanced'));
  const usingSetWeights = profileId === SET_WEIGHTS && Boolean(targetSet);
  const presetLabel = PRESET_PROFILES.find((p) => p.id === profileId)?.label ?? 'preset';
  const weightsLabel = usingSetWeights ? `${targetSet?.name ?? 'this set'} weights` : `${presetLabel} preset`;

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

  /*
   * The same weights the pickers rank with, whenever there is a set.
   *
   * `targetSet.weights` is what `SetWorkspace` hands `ItemPicker`, what
   * `autoFillSteps` optimises against and what the upgrades screen ranks by, so
   * reading it here is what makes one item carry one number across the app. A
   * preset can still be selected; it is a lens, not the default.
   */
  const weights: WeightProfile = useMemo(() => {
    if (usingSetWeights && targetSet) return targetSet.weights;
    return PRESET_PROFILES.find((p) => p.id === profileId)?.weights ?? {};
  }, [usingSetWeights, targetSet, profileId]);

  // A filter, not a character: one class at the level cap, so the browser shows
  // everything that class can ever wear rather than what one saved character can.
  // `loadout` is the exception, and the point of it — three classes at once is
  // what this game actually gives you, and no single-class filter expresses it.
  const filterContext: LoadoutContext | undefined = useMemo(() => {
    if (classFilter === 'any') return undefined;
    if (classFilter === LOADOUT_FILTER) return loadoutContext;
    return makeContext([classFilter], null, { [classFilter]: LEVEL_CAP });
  }, [classFilter, loadoutContext]);

  const matches = useMemo(
    () => searchIndexFor(catalog.revision, catalog.items).search(deferredQuery),
    [catalog.revision, catalog.items, deferredQuery],
  );

  /*
   * Filtering and scoring are memoised apart from sorting.
   *
   * They used to share one memo keyed on `sort` and `dir`, so clicking a column
   * header re-scored every candidate to reach a comparison that never looks at
   * the weights — 255-348 ms of blocked main thread on every sort, measured on
   * the 5,861-row catalog of the day, and again on a second press of the same
   * column because nothing was cached. Sorting now reads an already-scored
   * array; the catalog is 3,533 rows since the purge, and the fix outlives the
   * size either way.
   */
  const scored = useMemo(() => {
    // `score: null` means "not scorable", which is not the same as scoring 0.
    const out: Array<{ item: Item; score: number | null; stats: string }> = [];
    for (const item of catalog.items) {
      if (matches && !matches.has(item)) continue;
      if (slot !== 'any' && !item.sl.includes(slot)) continue;
      if (era !== 'any' && item.era !== era) continue;
      if (filterContext && !canUse({ classes: item.cl, races: item.ra }, filterContext)) continue;
      /*
       * The stat line is resolved here, not in the row. Rendering it inline
       * meant every sort and every page turn re-resolved a hundred items to
       * produce a string that depends only on the item and the preview tier —
       * neither of which a sort changes.
       */
      /*
       * An item whose stats nobody recorded is listed — this screen is the
       * catalog, and leaving it out would deny an item the game has — but it is
       * not given a score. `scoreItem` would return a perfectly real-looking
       * `0.0` computed over stats that do not exist, in a column the reader is
       * sorting by. `null` prints as an em dash instead.
       */
      const unstatted = statsAreUnknown(item);
      out.push({
        item,
        score: unstatted ? null : scoreItem(item, upgrade, weights).total,
        stats: unstatted
          ? ''
          : statVector(item, upgrade).slice(0, 6).map((v) => statChip(v.key, v.value)).join(' · '),
      });
    }
    return out;
  }, [catalog.items, matches, slot, era, filterContext, weights, upgrade]);

  const { rows, total } = useMemo(() => {
    type Row = { item: Item; score: number | null; stats: string };
    const eraIndex = (row: Row) =>
      ERA_ORDER.indexOf((row.item.era ?? '') as (typeof ERA_ORDER)[number]);
    // Ascending comparators only; direction is applied once, and the name
    // tiebreaker stays ascending in both so the order is stable and readable.
    const compare: Record<SortKey, (a: Row, b: Row) => number> = {
      // An unscorable row sorts as the bottom of the EP column in either
      // direction rather than borrowing 0's position among real scores.
      ep: (a, b) => (a.score ?? -Infinity) - (b.score ?? -Infinity),
      name: (a, b) => a.item.n.localeCompare(b.item.n),
      era: (a, b) => eraIndex(a) - eraIndex(b),
      slot: (a, b) => (a.item.sl[0] ?? '').localeCompare(b.item.sl[0] ?? ''),
    };
    const sign = dir === 'asc' ? 1 : -1;
    const primary = compare[sort];
    // Copy before sorting: `scored` is another memo's value, not ours to reorder.
    const ordered = scored.slice();
    ordered.sort((a, b) => sign * primary(a, b) || a.item.n.localeCompare(b.item.n));
    return { rows: ordered, total: ordered.length };
  }, [scored, sort, dir]);

  // Narrowing the search should put you back at the top of the new results,
  // not on page 14 of a list that no longer has one.
  useEffect(() => {
    setPage(0);
  }, [deferredQuery, slot, era, classFilter, sort, dir, profileId, upgrade]);

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
   * Names are tinted against *your character*, not against the class dropdown.
   * The dropdown narrows the list, so colouring by it would paint every
   * surviving row the same green and the rule would never say anything; judged
   * against the loadout you actually play, browsing the whole catalog tells
   * you at a glance what you could wear and what you could not.
   */
  const colorContext = useMemo(
    () => loadoutContext ?? filterContext,
    [loadoutContext, filterContext],
  );

  /*
   * …and not tinted at all when the filter has already answered the question.
   *
   * With the list narrowed to what this loadout can wear, every one of the
   * hundred names on the page would take the same green — and a constant is
   * not a signal, it is a full-screen tint, which is the reasoning `SlotCard`
   * already applies to the paper doll. Colour returns the moment the reader
   * asks for a wider list than their trio, because then it is discriminating
   * again.
   */
  const tintContext = classFilter === LOADOUT_FILTER ? undefined : colorContext;

  /*
   * "Equip" targets: the positions this item can legally occupy in the set the
   * reader was last editing. Without a set there is nothing to equip into, and
   * the detail dialog quietly drops the section; if the loadout cannot wear the
   * item at all, `ItemDetail` withdraws the section itself, which is the rule
   * the slot pickers have always applied.
   */
  const equipTargets = useMemo(() => {
    if (!detail || !targetSet) return [];
    return SLOT_POSITIONS.filter(
      (position) => position.type === 'ANY' || detail.sl.includes(position.type),
    ).map((position) => ({ positionId: position.id, label: position.label }));
  }, [detail, targetSet]);

  /* ------------------------------------------------- the withheld catalog */

  const trimmedQuery = deferredQuery.trim();
  const noResults = catalog.status === 'ready' && !rows.length;

  /*
   * The withheld list is fetched only once a search has already failed.
   *
   * Most of the wiki's 11,252 item records are content this server does not
   * have, and the pipeline keeps every one of them by name with a reason. Until
   * now the reader met that decision as "NOTHING MATCHES — loosen a filter",
   * with no filter set, on the exact word they had come to look up. The list is
   * 174 KB of JSON (~49 KB gzipped) and nobody who does not run a dead search
   * ever downloads it.
   */
  useEffect(() => {
    if (!noResults || !trimmedQuery || quarantine) return;
    let live = true;
    void loadQuarantineIndex().then((index) => {
      if (live && index) setQuarantine(index);
    });
    return () => {
      live = false;
    };
  }, [noResults, trimmedQuery, quarantine]);

  const withheld = useMemo(
    () => (noResults && trimmedQuery ? findQuarantined(quarantine, trimmedQuery) : null),
    [noResults, trimmedQuery, quarantine],
  );

  const filtersNarrowing = slot !== 'any' || era !== 'any' || classFilter !== 'any';

  /** The way out of a dead end. Returns the two class/scoring choices to their defaults. */
  const clearFilters = () => {
    setQuery('');
    setSlot('any');
    setEra('any');
    setClassChoice(null);
  };

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
      <th
        scope="col"
        className={className}
        aria-sort={activeSort ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
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

  /*
   * What this table currently is, in one sentence.
   *
   * A `<caption>` is the table's accessible name, and the filters are the only
   * thing that distinguishes `3,533 items` from `94 items`; without it a screen
   * reader reaches a table called nothing, holding a number it cannot account
   * for. Visually hidden because the same facts are on screen in the toolbar
   * directly above it.
   */
  const loadoutClasses = loadoutContext?.classes.join('/') ?? '';
  const classCaption =
    classFilter === 'any'
      ? 'any class'
      : classFilter === LOADOUT_FILTER
        ? `usable by ${targetCharacter?.name ?? 'this loadout'}’s ${loadoutClasses}`
        : `usable by ${classFilter}`;

  const caption = [
    `${count(total)} item${total === 1 ? '' : 's'}`,
    slot === 'any' ? 'any slot' : `slot ${slot}`,
    classCaption,
    era === 'any' ? 'any era' : `${era} era`,
    query.trim() ? `matching “${query.trim()}”` : null,
    `scored with the ${weightsLabel} at +${upgrade.full}`,
  ]
    .filter(Boolean)
    .join(', ');

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

      <div className="panel panel-pad" style={{ marginBottom: 'var(--s4)' }}>
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
            onChange={(e) => setClassChoice(e.target.value as ClassFilter)}
            aria-label="Filter by class"
          >
            {/*
              The loadout sits first and is the default, because with a
              character loaded "Any class" is a catalog of things you mostly
              cannot wear: the top row by EP was a Monk item and five of the
              first eight rendered in the red that means *not for you*.
            */}
            {loadoutContext ? (
              <option value={LOADOUT_FILTER}>
                {targetCharacter?.name ?? 'My loadout'} · {loadoutClasses}
              </option>
            ) : null}
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
            onChange={(e) => setProfileChoice(e.target.value)}
            aria-label="Scoring profile"
          >
            {targetSet ? <option value={SET_WEIGHTS}>This set’s weights</option> : null}
            {PRESET_PROFILES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} weights
              </option>
            ))}
          </select>
          {/* Same words as the picker's own stepper: it was "Rank at" there
              and "Score at" here for one identical control. */}
          <span className="rowline">
            <span className="hint">Preview at</span>
            <UpgradeStepper value={upgrade} label="scoring preview" onChange={setUpgrade} />
            <button type="button" className="btn btn-sm" onClick={() => setUpgrade(tier(0))}>
              Reset
            </button>
          </span>
        </div>
        {characters.length ? (
          <p className="hint" style={{ marginTop: 'var(--s3)' }}>
            {usingSetWeights ? (
              <>
                Scored against <strong>{targetSet?.name}</strong>’s own weights — the same ones the
                slot pickers, auto-fill and the upgrades list rank with, so an item carries one EP
                across the app. Each row is scored on its own here; a slot picker refines that with
                the cap headroom the rest of your set leaves.
              </>
            ) : (
              <>
                Scored against the {presetLabel} preset — a lens, not your set’s weights, so these
                numbers need not match a slot picker’s.
              </>
            )}
            {classFilter === LOADOUT_FILTER ? (
              <> Showing what {loadoutClasses} can wear; choose “Any class” for the whole catalog.</>
            ) : null}
          </p>
        ) : null}
      </div>

      {/*
        The empty state carries the project's largest decision.
        ------------------------------------------------------
        A reader who types `Ragebringer` here is not making a mistake, and the
        old copy — "Loosen a filter", printed with no filter set — told them
        they were. Thousands of wiki records are withheld on purpose, by name, with a
        reason each; when the failed query names one of them, the reason is the
        answer, and it is the most trust-building sentence in the app.
      */}
      {noResults ? (
        withheld ? (
          <div className="empty-state" data-empty="quarantined">
            <h2>Not in this catalog</h2>
            <p>
              <strong>{withheld.name}</strong> is on the wiki. It is not in this catalog, and that
              is a decision rather than a gap: {withheld.reason.line}
            </p>
            <p className="hint">
              Withheld under <span className="mono">{withheld.reason.why}</span> (
              {withheld.reason.title}). {count(withheld.counts.shipped)} of{' '}
              {count(withheld.counts.scraped)} scraped wiki records ship;{' '}
              {count(withheld.counts.quarantined)} are held out by name in{' '}
              <span className="mono">pipeline/quarantine.json</span>.
              {withheld.others > 0
                ? ` ${count(withheld.others)} other withheld ${
                    withheld.others === 1 ? 'name matches' : 'names match'
                  } this search.`
                : ''}
            </p>
            {filtersNarrowing ? (
              <p className="hint">Your slot, class or era filter is narrowing the list as well.</p>
            ) : null}
            <div className="empty-actions">
              <button type="button" className="btn btn-sm" onClick={clearFilters}>
                Clear search and filters
              </button>
            </div>
          </div>
        ) : (
          <div className="empty-state" data-empty="none">
            <h2>Nothing matches</h2>
            <p>
              {trimmedQuery
                ? `Nothing among the ${count(catalog.items.length)} shipped items matches “${trimmedQuery}”${
                    quarantine ? ', and no withheld record carries that name either' : ''
                  }.`
                : 'Loosen a filter — a narrower search, slot, class or era than the catalog holds.'}
            </p>
            {trimmedQuery && filtersNarrowing ? (
              <p className="hint">Your slot, class or era filter is narrowing the list as well.</p>
            ) : null}
            <div className="empty-actions">
              <button type="button" className="btn btn-sm" onClick={clearFilters}>
                Clear search and filters
              </button>
            </div>
          </div>
        )
      ) : null}

      {pageNav('top')}

      {rows.length ? (
        <div className="table-wrap" ref={tableRef}>
          <table className="data">
            <caption className="sr-only">
              {caption}. Sorted by {sort === 'ep' ? 'EP' : sort},{' '}
              {dir === 'asc' ? 'ascending' : 'descending'}. Showing {count(start + 1)} to{' '}
              {count(Math.min(start + PAGE_SIZE, total))}.
            </caption>
            <thead>
              <tr>
                {header('name', 'Item')}
                {header('slot', 'Slot')}
                <th scope="col">Classes</th>
                <th scope="col">Stats</th>
                {header('era', 'Era')}
                {header('ep', 'EP', 'num')}
              </tr>
            </thead>
            <tbody>
              {/*
                One line per item. The flag chips used to sit on a second line
                inside the name cell and `ERA UNKNOWN` wrapped onto a third, so
                100 rows cost 6,100px; both now live in the item window that
                opens on hover and on click.
              */}
              {/*
                No `role="button"` and no `aria-label` on the `<tr>`.
                `role="button"` removed the row from the table structure and
                orphaned its six `<td>`s, and an `aria-label` on a button
                *replaces* its contents as the accessible name — so the screen
                built to expose SLOT / CLASSES / STATS / ERA / EP across 3,533
                items announced exactly one thing per row. The activation
                affordance is a real `<button>` in the first cell instead, which
                names the row without eating it.
              */}
              {/*
                Keyed by page position, not by name. An item name is not a key:
                two shards can each carry an entry for the same item (`Dagas` is
                in both `PRIMARY.json` and `SECONDARY.json`), and a duplicate key
                makes React orphan DOM instead of replacing it — a search
                narrowed to `1 match` was leaving five rows of the previous
                result on screen, which is wrong data on the page rather than
                merely untidy markup.
              */}
              {pageRows.map(({ item, score, stats }, index) => (
                <tr
                  key={`${start + index}:${item.n}`}
                  className="rowlink"
                  tabIndex={0}
                  onClick={() => setDetail(item)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    setDetail(item);
                  }}
                  {...itemHoverProps(item, upgrade, colorContext)}
                >
                  <td>
                    <span className="cell-item">
                      <span className="cell-glyph" aria-hidden="true" style={{ color: itemNameColor(item, tintContext) }}>
                        <SlotGlyph slot={item.sl[0] ?? 'ANY'} size={20} />
                      </span>
                      {/*
                        `tabIndex={-1}`: the row is already a tab stop, and a
                        second one per row would take the page from 100 stops to
                        200. Pointer, screen reader and the row's own Enter/Space
                        all reach it; only Tab skips it.
                      */}
                      <button
                        type="button"
                        className="cell-open iname"
                        tabIndex={-1}
                        style={{ color: itemNameColor(item, tintContext) }}
                        onClick={(event) => {
                          event.stopPropagation();
                          setDetail(item);
                        }}
                      >
                        {item.n}
                      </button>
                      {/*
                        The usability tint, said in words as well as in colour.
                        §12 inverts the emphasis on this table — sage marks what
                        the trio can wear, and what it cannot recedes instead of
                        painting 69 names of 100 brick red — and a signal that
                        travels only on a hue fails WCAG 1.4.1. Present only when
                        there is a loadout to judge against, which is the same
                        condition the tint itself has.
                      */}
                      {usabilityOf(item, tintContext) === 'usable' ? (
                        <span className="cell-wearable">Wearable</span>
                      ) : null}
                    </span>
                    {statsAreUnknown(item) ? (
                      <span className="tag tag-locked">No stat data</span>
                    ) : null}
                  </td>
                  <td className="dim">{item.sl.join(' / ') || '—'}</td>
                  <td className="dim">{restrictionText(item.cl)}</td>
                  <td className="cell-stats">{stats || <span className="dim">—</span>}</td>
                  <td>
                    {eraLabel(item) ? <span className="era-label">{eraLabel(item)}</span> : <span className="dim">—</span>}
                  </td>
                  <td className="num">
                    {score === null ? <span className="dim">—</span> : epText(score)}
                  </td>
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
