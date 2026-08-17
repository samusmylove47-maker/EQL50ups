/**
 * One paper-doll position.
 *
 * Left column places the glyph outward-left with text inward; the right column
 * mirrors it, per UI-REFERENCE §A1. Three things changed in the visual pass:
 *
 *  - **A drawn slot glyph, not a monogram.** The two-letter tiles collided
 *    (`IH` was both Indicolite Helm and Ivandyr's Hoop) so they identified
 *    nothing; the glyph identifies the *slot*, which is what a paper doll row
 *    is for, and is the same mark used in the picker and the browser.
 *  - **The item name is tinted by usability**, green when a class in the active
 *    loadout qualifies and red when none does — what the client itself does.
 *  - **The word `Empty` is gone.** §A1: the slot name *is* the empty state.
 *    It used to be printed 23 times, louder than the slot label above it.
 *
 * The row is one fixed height whether or not it is filled, so filling a slot
 * never reflows the page: the +N stepper and the clear control moved from a
 * 40px footer strip onto the row itself.
 */

import type { LoadoutContext } from '../engine/character';
import type { WeightProfile } from '../engine/ep';
import type { UpgradeState } from '../engine/upgrade';
import { itemNameColor } from '../lib/itemStyle';
import { summarizeItem } from '../selectors/gear';
import type { SlotView } from '../selectors/gear';
import { itemHoverProps } from './ItemWindow';
import { SlotGlyph } from './SlotGlyph';
import { UpgradeStepper } from './UpgradeStepper';

export interface SlotCardProps {
  view: SlotView;
  side: 'left' | 'right';
  weights: WeightProfile;
  context?: LoadoutContext | undefined;
  readOnly?: boolean;
  onPick: (positionId: string) => void;
  onUpgrade: (positionId: string, next: UpgradeState) => void;
  onClear: (positionId: string) => void;
}

export function SlotCard({
  view,
  side,
  weights,
  context,
  readOnly = false,
  onPick,
  onUpgrade,
  onClear,
}: SlotCardProps) {
  const { position, item, equipped, unresolved } = view;
  const isAny = position.type === 'ANY';
  const state = [side, item ? 'filled' : 'empty', isAny ? 'any' : '', unresolved ? 'unresolved' : '']
    .filter(Boolean)
    .join(' ');
  const classes = `slot ${state}`;

  const summary = item && equipped ? summarizeItem(item, equipped.upgrade, weights) : null;
  const tone = item ? itemNameColor(item, context) : undefined;

  const body = (
    <span className="slot-body">
      <span className="slot-name">
        {position.label}
        {/*
          The badge used to read `EQL` — the app's own name, on the app's own
          differentiator, meaning nothing to a player — and `innerText`
          concatenated it as `ANY SLOT 1EQL`. It says what the slot does now,
          with a space in front of it.
        */}
        {isAny ? (
          <>
            {' '}
            <span className="slot-flex" title="An EQL-only position: it takes any wearable item">
              flex
            </span>
          </>
        ) : null}
      </span>
      {item ? (
        <span className="slot-item" style={{ color: tone }} title={item.n}>
          {item.n}
        </span>
      ) : unresolved ? (
        <span className="slot-item bad" title={equipped?.itemName}>
          {equipped?.itemName}
        </span>
      ) : null}
      {summary ? <span className="slot-stats">{summary}</span> : null}
      {unresolved ? <span className="slot-stats bad">Not in catalog</span> : null}
    </span>
  );

  const icon = (
    <span className="slot-icon" aria-hidden="true" style={tone ? { color: tone } : undefined}>
      <SlotGlyph slot={position.type} size={26} />
    </span>
  );

  return (
    // The wrap carries the surface so the row reads as one object: the card
    // and its +N control used to sit on separate grounds with a gap between.
    <div className={`slot-wrap ${state}`}>
      <button
        type="button"
        className={classes}
        onClick={() => onPick(position.id)}
        aria-label={
          item ? `${position.label}: ${item.n}. Change item.` : `${position.label}: empty. Choose an item.`
        }
        {...itemHoverProps(item, equipped?.upgrade ?? { full: 0, fraction: 0 }, context, position.type)}
      >
        {side === 'left' ? icon : body}
        {side === 'left' ? body : icon}
      </button>
      {equipped ? (
        <div className="slot-foot">
          {/*
           * A shared set is somebody else's plan. It used to render 23 disabled
           * steppers a viewer can never use; now the tier is simply stated, and
           * only when there is one.
           */}
          {readOnly ? (
            equipped.upgrade.full > 0 ? (
              <span className="tier-chip" title={`Upgraded to +${equipped.upgrade.full}`}>
                +{equipped.upgrade.full}
              </span>
            ) : null
          ) : (
            <>
              <UpgradeStepper
                value={equipped.upgrade}
                label={item?.n ?? equipped.itemName}
                onChange={(next) => onUpgrade(position.id, next)}
              />
              <button
                type="button"
                className="btn btn-quiet btn-icon"
                onClick={() => onClear(position.id)}
                aria-label={`Remove ${item?.n ?? equipped.itemName} from ${position.label}`}
                title="Remove from this slot"
              >
                <span aria-hidden="true">✕</span>
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
