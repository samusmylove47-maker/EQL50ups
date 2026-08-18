/**
 * The gear set workspace — header, tab row, paper doll, stat panel, picker.
 *
 * Shared by the editable set screen and the read-only share view so the two
 * cannot drift apart. Everything it needs is passed in; it owns only the
 * transient UI state (which slot's picker is open, which tab is showing).
 */

import { useMemo, useState, type ReactNode } from 'react';
import { activeContext, describeCharacter, type Character } from '../engine/character';
import type { WeightProfile } from '../engine/ep';
import type { GearSet, Item } from '../engine/types';
import type { UpgradeState } from '../engine/upgrade';
import { BASE_STATE, normalizeState } from '../engine/upgrade';
import { useCatalog } from '../data/catalog';
import { SET_TABS, type SetTab } from '../router';
import { slotViews, totalsFor, type SlotView } from '../selectors/gear';
import { BulkUpgrade, type BulkRevertOffer } from './BulkUpgrade';
import { ExaltationsTab } from './ExaltationsTab';
import { ItemPicker } from './ItemPicker';
import { PaperDoll } from './PaperDoll';
import { WeightsEditor } from './WeightsEditor';

const TAB_LABELS: Record<SetTab, string> = {
  gear: 'Gear',
  exaltations: 'Exaltations',
  weights: 'Weights',
};

/**
 * How many slots a bulk `+N` would touch, and whether they already agree.
 *
 * "Agree" means the same whole tier *and* nothing banked, because pressing +3
 * on a set already reading +3 with experience banked against it is a real edit:
 * it throws the banked fraction away. Marking that state as the current one
 * would promise a no-op the control does not perform.
 */
function bulkStateOf(views: readonly SlotView[]): { equipped: number; current: number | null } {
  let equipped = 0;
  let first: UpgradeState | null = null;
  let uniform = true;
  for (const view of views) {
    if (!view.equipped) continue;
    const state = normalizeState(view.equipped.upgrade);
    equipped += 1;
    if (!first) first = state;
    if (state.full !== first.full || state.fraction !== 0) uniform = false;
  }
  return { equipped, current: equipped > 0 && uniform && first ? first.full : null };
}

export interface SetWorkspaceProps {
  character: Character | undefined;
  gearSet: GearSet;
  tab: SetTab;
  onTabChange: (tab: SetTab) => void;
  readOnly?: boolean;
  /** Quiet actions rendered right-aligned on the tab row. */
  actions?: ReactNode;
  /** Set switcher control rendered in the header. */
  setSwitcher?: ReactNode;
  onEquip: (positionId: string, item: Item, upgrade: UpgradeState) => void;
  onUnequip: (positionId: string) => void;
  onUpgrade: (positionId: string, next: UpgradeState) => void;
  onSetDonor: (positionId: string, kind: string, donor: string | null) => void;
  onWeights: (weights: WeightProfile) => void;
  /**
   * Put every equipped slot on one tier. Omitted by the share view, which has
   * nothing to write to — the bulk strip simply is not built there.
   */
  onBulkUpgrade?: (full: number) => void;
  onRevertBulkUpgrade?: () => void;
  /** The revert offer standing against *this* set, if any. */
  bulkRevert?: BulkRevertOffer | null;
}

export function SetWorkspace({
  character,
  gearSet,
  tab,
  onTabChange,
  readOnly = false,
  actions,
  setSwitcher,
  onEquip,
  onUnequip,
  onUpgrade,
  onSetDonor,
  onWeights,
  onBulkUpgrade,
  onRevertBulkUpgrade,
  bulkRevert = null,
}: SetWorkspaceProps) {
  const catalog = useCatalog();
  const [openSlot, setOpenSlot] = useState<string | null>(null);

  // Eligibility follows the active loadout, so switching one re-ranks every
  // picker and re-filters every list without touching the set itself.
  const context = useMemo(() => (character ? activeContext(character) : undefined), [character]);
  const views = useMemo(() => slotViews(gearSet, catalog), [gearSet, catalog]);
  // `context` is passed so an item this loadout cannot equip is left out of the
  // headline numbers. Without it a Monk-only sash imported into a Warrior set
  // folded its haste into the totals while the doll tinted its name red.
  const totals = useMemo(() => totalsFor(views, undefined, context), [views, context]);
  const contextTotals = useMemo(
    () => (openSlot ? totalsFor(views, openSlot, context) : totals),
    [views, openSlot, totals, context],
  );
  const bulk = useMemo(() => bulkStateOf(views), [views]);

  const openView = openSlot ? views.find((v) => v.position.id === openSlot) : undefined;
  const initial = (character?.name ?? gearSet.name).trim().charAt(0).toUpperCase() || '?';

  return (
    <div>
      <header className="set-header">
        <div className="portrait" aria-hidden="true">
          {initial}
        </div>
        <div className="identity">
          <h1>{character?.name ?? 'Unknown character'}</h1>
          <div className="sub">
            {character ? describeCharacter(character) : 'No character attached'}
            {character?.race ? ` · ${character.race}` : ''}
          </div>
        </div>
        <div className="vrule" aria-hidden="true" />
        <div className="set-identity">
          <div className="set-glyph" aria-hidden="true">
            ◆
          </div>
          {setSwitcher ?? <span className="name">{gearSet.name}</span>}
        </div>
      </header>

      {gearSet.notes ? <p className="hint set-notes">{gearSet.notes}</p> : null}

      <div className="tabbar">
        {/*
         * A tablist owns only tabs, and it answers to arrow keys: one tab stop
         * for the whole group, then ←/→ (and Home/End) to move within it. The
         * quiet set actions sit beside it rather than inside it.
         */}
        <div className="tabrow" role="tablist" aria-label="Set sections">
          {SET_TABS.map((name, index) => (
            <button
              key={name}
              type="button"
              role="tab"
              id={`tab-${name}`}
              className="tab"
              aria-selected={tab === name}
              aria-controls={`panel-${name}`}
              tabIndex={tab === name ? 0 : -1}
              onClick={() => onTabChange(name)}
              onKeyDown={(event) => {
                const step =
                  event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
                let target: SetTab | undefined;
                if (step) target = SET_TABS[(index + step + SET_TABS.length) % SET_TABS.length];
                else if (event.key === 'Home') target = SET_TABS[0];
                else if (event.key === 'End') target = SET_TABS[SET_TABS.length - 1];
                if (!target) return;
                event.preventDefault();
                onTabChange(target);
                document.getElementById(`tab-${target}`)?.focus();
              }}
            >
              {TAB_LABELS[name]}
            </button>
          ))}
        </div>
        <div className="tab-actions">{actions}</div>
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'gear' ? (
          <>
            {/*
             * Above the doll rather than in the quiet action row beside the
             * tabs: it acts on the 23 chips underneath it, and it is only
             * meaningful on this tab.
             */}
            {!readOnly && onBulkUpgrade && onRevertBulkUpgrade ? (
              <BulkUpgrade
                equipped={bulk.equipped}
                current={bulk.current}
                revert={bulkRevert}
                onApply={onBulkUpgrade}
                onRevert={onRevertBulkUpgrade}
              />
            ) : null}
            <PaperDoll
              views={views}
              weights={gearSet.weights}
              totals={totals}
              context={context}
              readOnly={readOnly}
              onPick={(id) => setOpenSlot(id)}
              onUpgrade={onUpgrade}
              onClear={onUnequip}
            />
          </>
        ) : null}

        {tab === 'exaltations' ? (
          <ExaltationsTab
            views={views}
            context={context}
            readOnly={readOnly}
            onUpgrade={onUpgrade}
            onSetDonor={onSetDonor}
          />
        ) : null}

        {tab === 'weights' ? (
          <WeightsEditor weights={gearSet.weights} onChange={onWeights} readOnly={readOnly} />
        ) : null}
      </div>

      {openView && !readOnly ? (
        <ItemPicker
          position={openView.position}
          context={context}
          weights={gearSet.weights}
          currentItem={openView.item}
          currentName={openView.equipped?.itemName}
          currentUpgrade={openView.equipped?.upgrade ?? BASE_STATE}
          contextTotals={contextTotals}
          onSelect={(item, upgrade) => {
            onEquip(openView.position.id, item, upgrade);
            setOpenSlot(null);
          }}
          onClear={() => {
            onUnequip(openView.position.id);
            setOpenSlot(null);
          }}
          onClose={() => setOpenSlot(null)}
        />
      ) : null}
    </div>
  );
}
