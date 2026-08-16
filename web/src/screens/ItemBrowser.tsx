import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { canUse, type Character } from '../engine/character';
import { CLASSES, ERA_ORDER, SLOT_TYPES, type ClassCode } from '../engine/constants';
import { PRESET_PROFILES, scoreItem, type WeightProfile } from '../engine/ep';
import { BASE_STATE, tier, type UpgradeState } from '../engine/upgrade';
import type { Item } from '../engine/types';
import { useCatalog } from '../data/catalog';
import type { SlotCode } from '../data/normalize';
import { searchIndexFor } from '../data/searchIndex';
import { UpgradeStepper } from '../components/UpgradeStepper';
import { count, dec, signed } from '../lib/format';
import { eraLabel, flagLabel, isLive, qualityColor } from '../lib/itemStyle';
import { statVector } from '../selectors/gear';
import { useApp } from '../state/store';

type SortKey = 'ep' | 'name' | 'era' | 'slot';

const ROW_LIMIT = 250;

export function ItemBrowser() {
  const catalog = useCatalog();
  const ensureAll = useCatalog((s) => s.ensureAll);
  const characters = useApp((s) => s.characters);

  const [query, setQuery] = useState('');
  const [slot, setSlot] = useState<'any' | SlotCode>('any');
  const [era, setEra] = useState('any');
  const [classFilter, setClassFilter] = useState<'any' | ClassCode>('any');
  const [profileId, setProfileId] = useState(PRESET_PROFILES[0]?.id ?? 'balanced');
  const [upgrade, setUpgrade] = useState<UpgradeState>(BASE_STATE);
  const [liveOnly, setLiveOnly] = useState(true);
  const [sort, setSort] = useState<SortKey>('ep');

  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    void ensureAll();
  }, [ensureAll]);

  const weights: WeightProfile = useMemo(
    () => PRESET_PROFILES.find((p) => p.id === profileId)?.weights ?? {},
    [profileId],
  );

  const pseudoCharacter: Character | undefined = useMemo(() => {
    if (classFilter === 'any') return undefined;
    return { id: 'filter', name: 'filter', level: 50, classes: [classFilter], race: null };
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
      if (pseudoCharacter && !canUse({ classes: item.cl, races: item.ra }, pseudoCharacter)) continue;
      scored.push({ item, score: scoreItem(item, upgrade, weights).total });
    }
    const compare: Record<SortKey, (a: { item: Item; score: number }, b: { item: Item; score: number }) => number> = {
      ep: (a, b) => b.score - a.score || a.item.n.localeCompare(b.item.n),
      name: (a, b) => a.item.n.localeCompare(b.item.n),
      era: (a, b) =>
        ERA_ORDER.indexOf((a.item.era ?? '') as (typeof ERA_ORDER)[number]) -
          ERA_ORDER.indexOf((b.item.era ?? '') as (typeof ERA_ORDER)[number]) ||
        a.item.n.localeCompare(b.item.n),
      slot: (a, b) => (a.item.sl[0] ?? '').localeCompare(b.item.sl[0] ?? '') || a.item.n.localeCompare(b.item.n),
    };
    scored.sort(compare[sort]);
    return { rows: scored.slice(0, ROW_LIMIT), total: scored.length };
  }, [catalog.items, matches, slot, era, liveOnly, pseudoCharacter, weights, upgrade, sort]);

  const header = (key: SortKey, label: string, className?: string) => (
    <th className={className} aria-sort={sort === key ? 'descending' : 'none'}>
      <button type="button" onClick={() => setSort(key)}>
        {label}
        {sort === key ? ' ▾' : ''}
      </button>
    </th>
  );

  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">Items</h1>
        <div className="rowline">
          <span className="hint">
            {count(total)} match{total === 1 ? '' : 'es'}
            {total > rows.length ? ` · showing first ${count(rows.length)}` : ''}
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
            This browser scores against preset profiles. For scoring against your own weights and
            cap headroom, open a set and use its slot pickers.
          </p>
        ) : null}
      </div>

      {catalog.status === 'ready' && !rows.length ? (
        <div className="empty-state">
          <h2>Nothing matches</h2>
          <p>Loosen a filter, or allow content that is not yet live in the current era.</p>
        </div>
      ) : null}

      {rows.length ? (
        <div className="table-wrap">
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
              {rows.map(({ item, score }) => (
                <tr key={item.n}>
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
    </div>
  );
}
