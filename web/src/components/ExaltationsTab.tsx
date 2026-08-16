/**
 * Exaltation planning.
 *
 * Sockets are derived from the item's upgrade level, never looked up: +0
 * Ornamentation, +1 Focus, +2 Click, +3 Worn, +4 Proc. Locked sockets are
 * still drawn, with the tier that would unlock them, so the ladder is legible
 * at a glance — that relationship is the whole system.
 *
 * A donor's own class and slot restrictions intersect onto the host, so the
 * donor list is filtered through `canSocket` rather than offering everything.
 */

import { useMemo, useState } from 'react';
import { EXALTATION_LADDER, canSocket, EFFECT_KIND_TO_SOCKET } from '../engine/exaltation';
import { normalizeState } from '../engine/upgrade';
import type { Item } from '../engine/types';
import { useCatalog } from '../data/catalog';
import { qualityColor } from '../lib/itemStyle';
import type { SlotView } from '../selectors/gear';
import { Modal } from './Modal';
import { UpgradeStepper } from './UpgradeStepper';
import type { UpgradeState } from '../engine/upgrade';

export interface ExaltationsTabProps {
  views: readonly SlotView[];
  readOnly?: boolean;
  onUpgrade: (positionId: string, next: UpgradeState) => void;
  onSetDonor: (positionId: string, kind: string, donor: string | null) => void;
}

interface DonorTarget {
  positionId: string;
  kind: string;
  label: string;
  host: Item;
}

export function ExaltationsTab({
  views,
  readOnly = false,
  onUpgrade,
  onSetDonor,
}: ExaltationsTabProps) {
  const [target, setTarget] = useState<DonorTarget | null>(null);
  const equipped = views.filter((v) => v.item && v.equipped);

  if (!equipped.length) {
    return (
      <div className="empty-state">
        <h2>Nothing equipped yet</h2>
        <p>
          Exaltation sockets are a function of an item's upgrade level, so equip something on the
          Gear tab first. Sockets unlock at +0 Ornamentation, +1 Focus, +2 Click, +3 Worn and +4
          Proc.
        </p>
      </div>
    );
  }

  return (
    <div className="stack">
      <p className="hint">
        Sockets are derived from each item's +N, not from the item itself — a socket appears the
        moment the tier that unlocks it is reached. Ornamentation is cosmetic and contributes no
        stats.
      </p>

      {equipped.map((view) => {
        const item = view.item as Item;
        const state = normalizeState(view.equipped?.upgrade ?? { full: 0, fraction: 0 });
        return (
          <section className="exalt-item" key={view.position.id}>
            <header className="exalt-head">
              <div>
                <div className="slot-name">{view.position.label}</div>
                <div style={{ color: qualityColor(item), fontWeight: 600 }}>{item.n}</div>
              </div>
              <UpgradeStepper
                value={state}
                label={item.n}
                disabled={readOnly}
                onChange={(next) => onUpgrade(view.position.id, next)}
              />
            </header>

            <div className="socket-list">
              {EXALTATION_LADDER.map((socket) => {
                const unlocked = state.full >= socket.unlockTier;
                const donor = view.equipped?.exaltations?.[socket.kind];
                return (
                  <div
                    className={`socket${unlocked ? '' : ' locked'}`}
                    key={socket.kind}
                  >
                    <span className="kind">{socket.label}</span>
                    <span className={`donor${donor ? '' : ' none'}`}>
                      {unlocked
                        ? (donor ?? (socket.kind === 'ornamentation' ? 'Cosmetic — no effect' : 'Empty'))
                        : `Unlocks at +${socket.unlockTier}`}
                    </span>
                    <span className="rowline">
                      {unlocked && socket.kind !== 'ornamentation' && !readOnly ? (
                        <>
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() =>
                              setTarget({
                                positionId: view.position.id,
                                kind: socket.kind,
                                label: socket.label,
                                host: item,
                              })
                            }
                          >
                            {donor ? 'Change' : 'Add'}
                          </button>
                          {donor ? (
                            <button
                              type="button"
                              className="btn btn-sm btn-quiet"
                              onClick={() => onSetDonor(view.position.id, socket.kind, null)}
                              aria-label={`Remove ${socket.label} from ${item.n}`}
                            >
                              ✕
                            </button>
                          ) : null}
                        </>
                      ) : null}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {target ? (
        <DonorPicker
          target={target}
          onClose={() => setTarget(null)}
          onSelect={(donor) => {
            onSetDonor(target.positionId, target.kind, donor);
            setTarget(null);
          }}
        />
      ) : null}
    </div>
  );
}

function DonorPicker({
  target,
  onSelect,
  onClose,
}: {
  target: DonorTarget;
  onSelect: (itemName: string) => void;
  onClose: () => void;
}) {
  const items = useCatalog((s) => s.items);
  const [query, setQuery] = useState('');

  const donors = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const out: Array<{ item: Item; effect: string }> = [];
    for (const item of items) {
      if (!item.fx?.length) continue;
      const effect = item.fx.find((fx) => EFFECT_KIND_TO_SOCKET[fx.k] === target.kind);
      if (!effect) continue;
      if (!canSocket({ classes: item.cl, slots: item.sl }, { classes: target.host.cl, slots: target.host.sl })) {
        continue;
      }
      if (needle && !`${item.n} ${effect.n}`.toLowerCase().includes(needle)) continue;
      out.push({ item, effect: effect.n });
      if (out.length >= 300) break;
    }
    return out;
  }, [items, query, target]);

  return (
    <Modal title={`${target.label} donor`} onClose={onClose} width={720}>
      <div className="picker-controls">
        <input
          type="search"
          value={query}
          autoFocus
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search donor items or effects…"
          aria-label="Search exaltation donors"
        />
      </div>
      <div className="results" role="listbox" aria-label="Donor items">
        {donors.length === 0 ? (
          <div className="empty-state" style={{ border: 0 }}>
            <h2>No eligible donors</h2>
            <p>
              No loaded item carries a {target.label.toLowerCase()} that may be transferred onto{' '}
              {target.host.n}. Donor restrictions intersect onto the host, so slot and class have to
              overlap.
            </p>
          </div>
        ) : null}
        {donors.map(({ item, effect }) => (
          <button
            type="button"
            key={item.n}
            className="result"
            role="option"
            aria-selected={false}
            onClick={() => onSelect(item.n)}
          >
            <span>
              <span className="result-name" style={{ color: qualityColor(item) }}>
                {item.n}
              </span>
              <span className="result-line">{effect}</span>
            </span>
            <span className="result-score dim">{item.sl.join(' / ') || '—'}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
