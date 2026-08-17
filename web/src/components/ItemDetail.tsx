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
