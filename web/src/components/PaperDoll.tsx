/**
 * The paper doll: two columns of slots flanking a centre panel.
 *
 * All 23 positions from `SLOT_POSITIONS`, laid out to echo the client's
 * inventory ordering. The centre column carries the live stat panel rather
 * than a 3D model — this is a planner, and the numbers are the product.
 */

import type { WeightProfile } from '../engine/ep';
import type { StatTotals } from '../engine/stats';
import type { UpgradeState } from '../engine/upgrade';
import type { SlotView } from '../selectors/gear';
import { SlotCard } from './SlotCard';
import { StatPanel } from './StatPanel';

const LEFT_ORDER = [
  'EAR_1', 'HEAD', 'FACE', 'EAR_2', 'NECK', 'SHOULDERS',
  'ARMS', 'BACK', 'WRIST_1', 'WRIST_2', 'RANGE', 'HANDS',
];

const RIGHT_ORDER = [
  'PRIMARY', 'SECONDARY', 'FINGERS_1', 'FINGERS_2', 'CHEST',
  'LEGS', 'FEET', 'WAIST', 'AMMO', 'ANY_1', 'ANY_2',
];

export interface PaperDollProps {
  views: readonly SlotView[];
  weights: WeightProfile;
  totals: StatTotals;
  readOnly?: boolean;
  onPick: (positionId: string) => void;
  onUpgrade: (positionId: string, next: UpgradeState) => void;
  onClear: (positionId: string) => void;
}

export function PaperDoll({
  views,
  weights,
  totals,
  readOnly = false,
  onPick,
  onUpgrade,
  onClear,
}: PaperDollProps) {
  const byId = new Map(views.map((v) => [v.position.id, v]));
  const column = (ids: readonly string[], side: 'left' | 'right') =>
    ids
      .map((id) => byId.get(id))
      .filter((v): v is SlotView => Boolean(v))
      .map((view) => (
        <SlotCard
          key={view.position.id}
          view={view}
          side={side}
          weights={weights}
          readOnly={readOnly}
          onPick={onPick}
          onUpgrade={onUpgrade}
          onClear={onClear}
        />
      ));

  // Anything not named in the two orders still gets rendered, so a future slot
  // cannot silently vanish from the doll.
  const known = new Set([...LEFT_ORDER, ...RIGHT_ORDER]);
  const extras = views.filter((v) => !known.has(v.position.id));

  return (
    <div className="doll">
      <div className="doll-col" role="group" aria-label="Left equipment column">
        {column(LEFT_ORDER, 'left')}
      </div>
      <div className="doll-center">
        <StatPanel totals={totals} />
      </div>
      <div className="doll-col" role="group" aria-label="Right equipment column">
        {column(RIGHT_ORDER, 'right')}
        {extras.map((view) => (
          <SlotCard
            key={view.position.id}
            view={view}
            side="right"
            weights={weights}
            readOnly={readOnly}
            onPick={onPick}
            onUpgrade={onUpgrade}
            onClear={onClear}
          />
        ))}
      </div>
    </div>
  );
}
