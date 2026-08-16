/**
 * Exaltation planning.
 *
 * Two things this screen used to get wrong, both fixed here.
 *
 * **It said nothing, at length.** A fresh set printed the same rule 115 times —
 * `Cosmetic — no effect` on 23 rows, `Unlocks at +N` on 92 more — over 7,728px.
 * Sockets are derived from `+N` and nothing else, so a locked socket carries no
 * information a one-line "first socket at +1" does not. One row per item, in
 * slot order, that grows in place when a socket opens.
 *
 * **Donors did nothing.** They are now resolved against the catalog, their
 * effect is named beside them the way the client names it, `canSocket` is
 * enforced, `intersectRestrictions` is applied and surfaced when it narrows the
 * host, and `dedupeByFamily` marks the ranks a higher rank displaces.
 *
 * What is deliberately *not* claimed: no effect contributes a number. The
 * catalog publishes names and prose for effects, not values, so nothing here
 * moves the stat panel and the UI says so rather than implying otherwise.
 */

import { useEffect, useMemo, useState } from 'react';
import { canSocket, EFFECT_KIND_TO_SOCKET } from '../engine/exaltation';
import type { LoadoutContext } from '../engine/character';
import type { Item } from '../engine/types';
import type { UpgradeState } from '../engine/upgrade';
import { useCatalog } from '../data/catalog';
import { qualityColor } from '../lib/itemStyle';
import { exaltationPlan, type ExaltedItem, type SocketView } from '../selectors/exaltations';
import type { SlotView } from '../selectors/gear';
import { Modal } from './Modal';
import { UpgradeStepper } from './UpgradeStepper';

export interface ExaltationsTabProps {
  views: readonly SlotView[];
  context?: LoadoutContext | undefined;
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
  context,
  readOnly = false,
  onUpgrade,
  onSetDonor,
}: ExaltationsTabProps) {
  const byName = useCatalog((s) => s.byName);
  const effects = useCatalog((s) => s.effects);
  const ensureEffects = useCatalog((s) => s.ensureEffects);
  const [target, setTarget] = useState<DonorTarget | null>(null);

  // Effect prose lives in its own published file; pull it once so a socketed
  // effect can be described rather than merely named.
  useEffect(() => {
    void ensureEffects();
  }, [ensureEffects]);

  const plan = useMemo(
    () => exaltationPlan(views, { byName, effects }, context),
    [views, byName, effects, context],
  );

  if (!plan.items.length) {
    return (
      <div className="empty-state">
        <h2>Nothing equipped yet</h2>
        <p>
          Exaltation sockets come from an item's upgrade level, not from the item, so equip
          something on the Gear tab first. Focus opens at +1, Click at +2, Worn at +3, Proc at +4.
        </p>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="exalt-summary" role="status">
        <span>
          <strong>{plan.counts.filled}</strong> socketed
        </span>
        <span>
          <strong>{plan.counts.open}</strong> open
        </span>
        <span>
          <strong>{plan.items.length - plan.counts.withSockets}</strong> waiting on +N
        </span>
        <span className="hint">
          Focus +1 · Click +2 · Worn +3 · Proc +4. Ornamentation is cosmetic; the client counts it
          inconsistently and varies the tier an exaltation can be extracted at, so the planner
          derives sockets from +N alone and claims nothing about either.
        </span>
      </div>

      {plan.active.length ? (
        <section className="panel panel-pad stack">
          <div className="spread">
            <h2 className="section-label">Effects on this set</h2>
            <span className="hint">Named, not scored — see below.</span>
          </div>
          <div className="effect-list">
            {plan.active.map((socket) => (
              <EffectLines key={`${socket.socket.kind}-${socket.donorName}`} socket={socket} />
            ))}
          </div>
          {plan.superseded.length ? (
            <div className="effect-list">
              {plan.superseded.map((socket) => (
                <p className="hint" key={`sup-${socket.socket.kind}-${socket.donorName}`}>
                  {socket.effect?.n} does not count — {socket.supersededBy} is the higher rank in
                  the same family, and a family only counts once.
                </p>
              ))}
            </div>
          ) : null}
          <p className="hint">
            The catalog publishes effect names and descriptions but no numeric values for them, so
            these are listed, not scored. None of them moves the stat panel.
          </p>
        </section>
      ) : null}

      {plan.illegal.length ? (
        <div className="notice notice-warn" role="status">
          <span>
            {plan.illegal.length} donor{plan.illegal.length === 1 ? '' : 's'} share no slot or class
            with the item holding{plan.illegal.length === 1 ? ' it' : ' them'} — the game would
            refuse the socket.
          </span>
        </div>
      ) : null}

      {/*
        One row per equipped item, in slot order, growing in place as sockets
        open. Deliberately not two sections: an item that crosses +1 used to be
        re-parented, which threw away the keyboard focus of the very stepper
        that had just been pressed.
      */}
      <section className="panel exalt-rows">
        {plan.items.map((entry) => (
          <ExaltRow
            key={entry.positionId}
            entry={entry}
            readOnly={readOnly}
            onUpgrade={onUpgrade}
            onSetDonor={onSetDonor}
            onPickDonor={setTarget}
          />
        ))}
      </section>

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

/** Donor and effect on separate lines, the way the client's item window does. */
function EffectLines({ socket }: { socket: SocketView }) {
  return (
    <div className="effect-entry">
      <div className="effect-kind">{socket.socket.label}</div>
      <div className="effect-donor">{socket.donorName} (Exaltation)</div>
      <div className="effect-name">{socket.effect?.n}</div>
      {socket.effect?.d ? <div className="effect-detail">{socket.effect.d}</div> : null}
      {socket.description?.d ? <p className="hint">{socket.description.d}</p> : null}
    </div>
  );
}

function ExaltRow({
  entry,
  readOnly,
  onUpgrade,
  onSetDonor,
  onPickDonor,
}: {
  entry: ExaltedItem;
  readOnly: boolean;
  onUpgrade: (positionId: string, next: UpgradeState) => void;
  onSetDonor: (positionId: string, kind: string, donor: string | null) => void;
  onPickDonor: (target: DonorTarget) => void;
}) {
  const usable = entry.sockets.filter((s) => s.unlocked && s.socket.kind !== 'ornamentation');

  return (
    <div className="exalt-row">
      <div className="exalt-row-head">
        <span className="slot-name">{entry.positionLabel}</span>
        <span className="exalt-row-name" style={{ color: qualityColor(entry.item) }}>
          {entry.item.n}
        </span>
        <UpgradeStepper
          value={entry.state}
          label={entry.item.n}
          disabled={readOnly}
          onChange={(next) => onUpgrade(entry.positionId, next)}
        />
        <span className="hint exalt-row-state">
          {usable.length
            ? `${entry.filled.length}/${usable.length} socketed`
            : entry.nextUnlockTier === null
              ? 'no sockets'
              : `first socket at +${entry.nextUnlockTier}`}
        </span>
      </div>

      {usable.length ? (
        <div className="socket-list">
          {usable.map((socket) => (
            <div className="socket" key={socket.socket.kind}>
              <span className="kind">{socket.socket.label}</span>
              <span className={`donor${socket.donorName ? '' : ' none'}`}>
                {socket.donorName ? (
                  <>
                    {socket.donorName}
                    {socket.effect ? (
                      <span className="effect-inline"> → {socket.effect.n}</span>
                    ) : (
                      <span className="hint"> — carries no {socket.socket.kind} effect</span>
                    )}
                    {!socket.legal ? (
                      <span className="bad"> — shares no slot or class with this item</span>
                    ) : null}
                  </>
                ) : (
                  '—'
                )}
              </span>
              <span className="rowline">
                {!readOnly ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() =>
                        onPickDonor({
                          positionId: entry.positionId,
                          kind: socket.socket.kind,
                          label: socket.socket.label,
                          host: entry.item,
                        })
                      }
                    >
                      {socket.donorName ? 'Change' : 'Add'}
                    </button>
                    {socket.donorName ? (
                      <button
                        type="button"
                        className="btn btn-sm btn-quiet"
                        onClick={() => onSetDonor(entry.positionId, socket.socket.kind, null)}
                        aria-label={`Remove ${socket.socket.label} from ${entry.item.n}`}
                      >
                        ✕
                      </button>
                    ) : null}
                  </>
                ) : null}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {entry.lostClasses.length || entry.lostSlots.length ? (
        <p className={`hint${entry.blocksLoadout ? ' bad' : ''}`}>
          Donor restrictions narrow this item
          {entry.lostClasses.length
            ? ` out of ${entry.lostClasses.join(', ')} (now ${entry.restricted.classes.join(', ') || 'no class'})`
            : ''}
          {entry.lostClasses.length && entry.lostSlots.length ? ' and' : ''}
          {entry.lostSlots.length ? ` out of slot ${entry.lostSlots.join(', ')}` : ''}.
          {entry.blocksLoadout ? ' Your active loadout can no longer use it.' : ''}
        </p>
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
  const shards = useCatalog((s) => s.shards);
  const status = useCatalog((s) => s.status);
  const ensureAll = useCatalog((s) => s.ensureAll);
  const [query, setQuery] = useState('');

  /*
   * Effects (`fx`) ride in the per-slot detail shards, not in the index, and a
   * donor may come from any slot — so without this the list was empty on any
   * fresh load or share link and only filled in if the reader happened to have
   * opened a picker first.
   */
  useEffect(() => {
    void ensureAll();
  }, [ensureAll]);

  const loading =
    status === 'loading' || Object.values(shards).some((state) => state === 'loading');

  const donors = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const out: Array<{ item: Item; effect: string; detail?: string }> = [];
    for (const item of items) {
      if (!item.fx?.length) continue;
      const effect = item.fx.find((fx) => EFFECT_KIND_TO_SOCKET[fx.k] === target.kind);
      if (!effect) continue;
      if (!canSocket({ classes: item.cl, slots: item.sl }, { classes: target.host.cl, slots: target.host.sl })) {
        continue;
      }
      if (needle && !`${item.n} ${effect.n}`.toLowerCase().includes(needle)) continue;
      out.push({ item, effect: effect.n, ...(effect.d ? { detail: effect.d } : {}) });
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
        {loading && donors.length === 0 ? (
          <div className="empty-state" style={{ border: 0 }}>
            <h2>Loading item data…</h2>
            <p>Donor effects live in the per-slot detail files, which are still arriving.</p>
          </div>
        ) : null}
        {!loading && donors.length === 0 ? (
          <div className="empty-state" style={{ border: 0 }}>
            <h2>No eligible donors</h2>
            <p>
              No loaded item carries a {target.label.toLowerCase()} that may be transferred onto{' '}
              {target.host.n}. Donor restrictions intersect onto the host, so slot and class have to
              overlap.
            </p>
          </div>
        ) : null}
        {donors.map(({ item, effect, detail }) => (
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
              {detail ? <span className="result-line dim">{detail}</span> : null}
            </span>
            <span className="result-score dim">{item.sl.join(' / ') || '—'}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
