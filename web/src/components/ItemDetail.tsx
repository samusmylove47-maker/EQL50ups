/**
 * Item detail dialog.
 *
 * The item browser's rows used to be inert `<tr>`s: you could find the thing
 * you just looted and then do nothing with it, which is the exact workflow the
 * browser exists for. This is the other half — everything the catalog knows
 * about one item, at whatever +N you are previewing, plus the ability to put it
 * straight into a set.
 *
 * The body is the EverQuest item window itself (`ItemWindow`, UI-REFERENCE
 * §B5) rather than a second, differently-styled rendering of the same facts:
 * one artefact, shown small on hover and large here.
 */

import type { LoadoutContext } from '../engine/character';
import type { Item } from '../engine/types';
import type { UpgradeState } from '../engine/upgrade';
import { statsAreUnknown } from '../data/normalize';
import { sourceSummary } from '../lib/itemStyle';
import { Modal } from './Modal';
import { ItemWindow } from './ItemWindow';

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
  const source = sourceSummary(item);
  /*
   * An item with no stats has nothing to contribute to a set's totals, so
   * equipping it would fill a slot on the paper doll and add exactly zero to
   * every number beside it — a set that looks complete and totals as though the
   * slot were empty. The window above already explains the gap; the buttons
   * that would act on it are withdrawn rather than left to produce that.
   */
  const unstatted = statsAreUnknown(item);

  return (
    <Modal title={item.n} titleHidden onClose={onClose} width={640}>
      <div className="modal-body stack">
        <ItemWindow item={item} upgrade={upgrade} context={context} wide />

        {source ? (
          <div>
            <h3 className="section-label">Source</h3>
            <p className="hint">{source}</p>
          </div>
        ) : null}

        {item.fx?.length ? (
          <p className="hint">
            Effects are named, not scored — the catalog carries no numeric values for them.
          </p>
        ) : null}

        {unstatted ? (
          <p className="hint">
            No stats are known for this item, so it cannot be equipped here: a slot filled with it
            would add nothing to your totals while looking as though it had. It stays in the catalog
            because it is real — hiding it would be its own kind of wrong answer.
          </p>
        ) : null}

        {!unstatted && equipTargets.length && onEquip ? (
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
