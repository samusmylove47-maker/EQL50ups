/**
 * Item detail dialog.
 *
 * The item browser's rows used to be inert `<tr>`s: you could find the thing
 * you just looted and then do nothing with it, which is the exact workflow the
 * browser exists for. This is the other half — everything the catalog knows
 * about one item, at whatever +N you are previewing, plus the ability to put it
 * straight into a set.
 *
 * Deliberately not styled as an EverQuest item window; that redesign belongs to
 * whoever owns the visual pass. This reuses the existing modal, table and tag
 * vocabulary so the two do not have to be untangled later.
 */

import { CLASS_NAMES, type ClassCode } from '../engine/constants';
import { levelCheck, type LoadoutContext } from '../engine/character';
import type { Item } from '../engine/types';
import type { UpgradeState } from '../engine/upgrade';
import { dec, signed } from '../lib/format';
import { eraLabel, flagLabel, isLive, qualityColor } from '../lib/itemStyle';
import { ratioText, statVector } from '../selectors/gear';
import { Modal } from './Modal';

export interface EquipTarget {
  positionId: string;
  label: string;
}

export interface ItemDetailProps {
  item: Item;
  upgrade: UpgradeState;
  /** Positions this item may be placed in, in the currently open set. */
  equipTargets?: EquipTarget[];
  /** Where those positions live, for the button label. */
  setName?: string;
  context?: LoadoutContext | undefined;
  onEquip?: (positionId: string) => void;
  onClose: () => void;
}

export function ItemDetail({
  item,
  upgrade,
  equipTargets = [],
  setName,
  context,
  onEquip,
  onClose,
}: ItemDetailProps) {
  const stats = statVector(item, upgrade);
  const weapon = item.wp;
  const damage = stats.find((s) => s.key === 'DMG')?.value ?? weapon?.dmg ?? 0;
  const level = context ? levelCheck({ classes: item.cl, races: item.ra, ...(item.rl ? { rl: item.rl } : {}) }, context) : null;

  return (
    <Modal title={item.n} onClose={onClose} width={640}>
      <div className="modal-body stack">
        <div>
          <div style={{ color: qualityColor(item), fontWeight: 700, fontSize: 16 }}>{item.n}</div>
          <div className="chip-row" style={{ marginTop: 6 }}>
            {item.fl.map((flag) => (
              <span className="tag" key={flag}>
                {flagLabel(flag)}
              </span>
            ))}
            {eraLabel(item) ? <span className="era-label">{eraLabel(item)}</span> : null}
            {!isLive(item) ? <span className="tag tag-locked">Not live yet</span> : null}
          </div>
        </div>

        <div className="detail-grid">
          <div>
            <span>Slots</span>
            {item.sl.join(' / ') || '—'}
          </div>
          <div>
            <span>Classes</span>
            {item.cl.includes('ALL')
              ? 'All'
              : item.cl.map((c) => CLASS_NAMES[c as ClassCode] ?? c).join(', ') || '—'}
          </div>
          <div>
            <span>Races</span>
            {item.ra.includes('ALL') ? 'All' : item.ra.join(', ') || '—'}
          </div>
          <div>
            <span>Weight</span>
            {item.wt === undefined ? '—' : dec(item.wt, 1)}
          </div>
          {item.sz ? (
            <div>
              <span>Size</span>
              {item.sz}
            </div>
          ) : null}
          {item.rl ? (
            <div>
              <span>Required level</span>
              {item.rl}
              {level && !level.ok ? (
                <span className="bad"> — your {level.via ?? 'class'} is {level.best}</span>
              ) : null}
            </div>
          ) : null}
          {weapon ? (
            <div>
              <span>Damage / delay</span>
              {Math.round(damage)} / {weapon.dly} · ratio {ratioText(damage, weapon.dly)}
            </div>
          ) : null}
        </div>

        <div>
          <h3 className="section-label">Stats at +{upgrade.full}</h3>
          {stats.length ? (
            <div className="detail-grid">
              {stats
                .filter((s) => s.key !== 'DMG' && s.key !== 'DLY')
                .map((s) => (
                  <div key={s.key}>
                    <span>{s.label}</span>
                    {signed(s.value)}
                  </div>
                ))}
            </div>
          ) : (
            <p className="hint">No scored stats — this item's value is its effects or its slot.</p>
          )}
        </div>

        {item.fx?.length ? (
          <div>
            <h3 className="section-label">Effects</h3>
            <div className="effect-list">
              {item.fx.map((fx) => (
                <div className="effect-entry" key={`${fx.k}-${fx.n}`}>
                  <div className="effect-kind">{fx.k}</div>
                  <div className="effect-name">{fx.n}</div>
                  {fx.d ? <div className="effect-detail">{fx.d}</div> : null}
                </div>
              ))}
            </div>
            <p className="hint">
              Effects are named, not scored — the catalog carries no numeric values for them.
            </p>
          </div>
        ) : null}

        {item.src ? (
          <div>
            <h3 className="section-label">Source</h3>
            <div className="detail-grid">
              {item.src.z?.length ? (
                <div>
                  <span>Zones</span>
                  {item.src.z.slice(0, 6).join(', ')}
                </div>
              ) : null}
              {item.src.m?.length ? (
                <div>
                  <span>Drops from</span>
                  {item.src.m.slice(0, 6).join(', ')}
                </div>
              ) : null}
              {item.src.q?.length ? (
                <div>
                  <span>Quests</span>
                  {item.src.q.slice(0, 4).join(', ')}
                </div>
              ) : null}
              {item.src.v?.length ? (
                <div>
                  <span>Vendors</span>
                  {item.src.v.slice(0, 4).join(', ')}
                </div>
              ) : null}
              {item.src.c ? (
                <div>
                  <span>Crafted</span>
                  Yes
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {equipTargets.length && onEquip ? (
          <div>
            <h3 className="section-label">Equip in {setName ?? 'your set'}</h3>
            <div className="chip-row">
              {equipTargets.map((target) => (
                <button
                  type="button"
                  className="btn btn-sm"
                  key={target.positionId}
                  onClick={() => onEquip(target.positionId)}
                >
                  {target.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
