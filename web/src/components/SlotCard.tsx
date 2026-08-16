/**
 * One paper-doll position.
 *
 * Left column places the icon outward-left with text inward; the right column
 * mirrors it, per UI-REFERENCE §A1. Filled slots show the item name in its era
 * colour plus a key-stat line; empty slots show a dim placeholder and the slot
 * name only. The two EQL "Any Slot" positions are drawn differently — dashed
 * amber — because they exist in no other planner.
 */

import type { WeightProfile } from '../engine/ep';
import type { UpgradeState } from '../engine/upgrade';
import { itemInitials, qualityColor } from '../lib/itemStyle';
import { summarizeItem } from '../selectors/gear';
import type { SlotView } from '../selectors/gear';
import { UpgradeStepper } from './UpgradeStepper';

export interface SlotCardProps {
  view: SlotView;
  side: 'left' | 'right';
  weights: WeightProfile;
  readOnly?: boolean;
  onPick: (positionId: string) => void;
  onUpgrade: (positionId: string, next: UpgradeState) => void;
  onClear: (positionId: string) => void;
}

export function SlotCard({
  view,
  side,
  weights,
  readOnly = false,
  onPick,
  onUpgrade,
  onClear,
}: SlotCardProps) {
  const { position, item, equipped, unresolved } = view;
  const isAny = position.type === 'ANY';
  const classes = [
    'slot',
    side,
    item ? 'filled' : 'empty',
    isAny ? 'any' : '',
    unresolved ? 'unresolved' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const summary = item && equipped ? summarizeItem(item, equipped.upgrade, weights) : null;

  const body = (
    <div className="slot-body">
      <div className="slot-name">
        {position.label}
        {isAny ? <span className="tag tag-any" style={{ marginLeft: 6 }}>EQL</span> : null}
      </div>
      {item ? (
        <div className="slot-item" style={{ color: qualityColor(item) }} title={item.n}>
          {item.n}
        </div>
      ) : unresolved ? (
        <div className="slot-item bad" title={equipped?.itemName}>
          {equipped?.itemName}
        </div>
      ) : (
        <div className="slot-item dim">Empty</div>
      )}
      {summary ? <div className="slot-stats">{summary}</div> : null}
      {unresolved ? <div className="slot-stats bad">Not in catalog</div> : null}
    </div>
  );

  const icon = (
    <div className="slot-icon" aria-hidden="true">
      {item ? itemInitials(item.n) : isAny ? '✦' : '·'}
    </div>
  );

  return (
    <div className={`slot-wrap ${side}`}>
      <button
        type="button"
        className={classes}
        onClick={() => onPick(position.id)}
        aria-label={
          item ? `${position.label}: ${item.n}. Change item.` : `${position.label}: empty. Choose an item.`
        }
      >
        {side === 'left' ? icon : body}
        {side === 'left' ? body : icon}
      </button>
      {equipped ? (
        <div className="slot-foot">
          <UpgradeStepper
            value={equipped.upgrade}
            label={item?.n ?? equipped.itemName}
            disabled={readOnly}
            onChange={(next) => onUpgrade(position.id, next)}
          />
          {readOnly ? null : (
            <button
              type="button"
              className="btn btn-quiet btn-sm"
              onClick={() => onClear(position.id)}
              aria-label={`Remove ${item?.n ?? equipped.itemName} from ${position.label}`}
            >
              Clear
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
