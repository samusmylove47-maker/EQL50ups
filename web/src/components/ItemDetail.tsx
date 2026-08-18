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
 *
 * **What it will not do is contradict itself.** The window prints THIS LOADOUT
 * CANNOT EQUIP IT from `usabilityNote`; this dialog then used to print EQUIP IN
 * MAIN SET four lines below it, and clicking it wrote the item into the set.
 * The equip section is now gated on the same predicate the window reads and the
 * same one `rankSlotItems` filters every picker with, so all three surfaces
 * answer one question the same way.
 */

import type { LoadoutContext } from '../engine/character';
import { blockSentence } from '../lib/blockReason';
import type { Item } from '../engine/types';
import type { UpgradeState } from '../engine/upgrade';
import { statsAreUnknown } from '../data/normalize';
import { sourceSummary, usabilityOf } from '../lib/itemStyle';
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

  /*
   * The second reason to withdraw them, and the one that was shipping wrong.
   *
   * The window above this already prints **THIS LOADOUT CANNOT EQUIP IT** — and
   * four lines below it, this dialog used to offer EQUIP IN MAIN SET anyway,
   * with no confirm and no warning. Clicking it put a Monk-only sash on a
   * WAR/BRD/BER paper doll and folded its 41% haste into the headline stat
   * totals, so the set reported speed the trio can never have. Meanwhile every
   * slot picker in the app refuses to *list* such an item: `rankSlotItems`
   * filters on the same loadout context. Two surfaces, two rules, and the one
   * that was wrong is the one that writes to your set.
   *
   * So this surface adopts the picker's rule. Blocked means blocked, in the
   * same words the window uses, with the class list that decides it. It is not
   * a confirm dialog: there is no correct outcome behind the confirm, because
   * the game will not let the character wear it either.
   */
  const blocked = usabilityOf(item, context) === 'blocked';
  /*
   * Which gate actually closed — class, race or level. Shared with `SlotCard`,
   * because the two surfaces refusing the same item for different stated
   * reasons would be the same disagreement this whole change is about.
   */
  const why = blockSentence(item, context) ?? 'this loadout cannot equip it';

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

        {blocked && equipTargets.length && onEquip ? (
          <p className="hint" data-blocked="equip">
            Not offered for {setName ?? 'your set'}: {why}. The slot pickers leave it out of their
            lists for the same reason — equipping it would add stats to your totals that the
            character can never actually wear.
          </p>
        ) : null}

        {!blocked && !unstatted && equipTargets.length && onEquip ? (
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
