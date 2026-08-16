/**
 * The paper doll: two item columns flanking a character, with the stat sheet
 * full-width beneath.
 *
 * The previous composition put the stat table in the centre column, made that
 * column the *widest* of the three, and left ~600px of black below it where
 * the flanking columns kept going — the app literally centred and prioritised a
 * spreadsheet, and framed a hole with it. Now the centre carries a character
 * (`CharacterFigure`) and the numbers sit under the whole doll, where a
 * full-width grid can lay them out four abreast instead of orphaning cells in
 * a fixed three-column stack.
 *
 * Rows are one fixed height filled or empty, so the doll no longer grows 45%
 * as you fill it: 23 rows fit on one screen instead of needing 1,648px.
 */

import { useMemo } from 'react';
import type { LoadoutContext } from '../engine/character';
import { scoreItem, type WeightProfile } from '../engine/ep';
import type { StatTotals } from '../engine/stats';
import type { UpgradeState } from '../engine/upgrade';
import { resolvedEntries, type SlotView } from '../selectors/gear';
import { CharacterFigure } from './CharacterFigure';
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
  context?: LoadoutContext | undefined;
  readOnly?: boolean;
  onPick: (positionId: string) => void;
  onUpgrade: (positionId: string, next: UpgradeState) => void;
  onClear: (positionId: string) => void;
}

export function PaperDoll({
  views,
  weights,
  totals,
  context,
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
          context={context}
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

  /** What the set is worth under its own weights — one number for the whole doll. */
  const setScore = useMemo(
    () =>
      resolvedEntries(views).reduce(
        (sum, entry) => sum + scoreItem(entry.item, entry.upgrade, weights).total,
        0,
      ),
    [views, weights],
  );

  return (
    <>
      <div className="doll">
        <div className="doll-col" role="group" aria-label="Left equipment column">
          {column(LEFT_ORDER, 'left')}
        </div>
        <div className="doll-center">
          <CharacterFigure
            views={views}
            totals={totals}
            setScore={setScore}
            context={context}
            onPick={onPick}
          />
        </div>
        <div className="doll-col" role="group" aria-label="Right equipment column">
          {column(RIGHT_ORDER, 'right')}
          {extras.map((view) => (
            <SlotCard
              key={view.position.id}
              view={view}
              side="right"
              weights={weights}
              context={context}
              readOnly={readOnly}
              onPick={onPick}
              onUpgrade={onUpgrade}
              onClear={onClear}
            />
          ))}
        </div>
      </div>

      <StatPanel totals={totals} vitals="hoisted" />
    </>
  );
}
