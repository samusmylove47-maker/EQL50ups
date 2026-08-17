/**
 * One press to put the whole set on a tier.
 *
 * A set is 23 slots and the per-slot stepper moves one of them. Taking a full
 * set from +0 to +5 therefore cost 115 presses — on the app's headline feature,
 * to answer the question players actually arrive with ("what does my set look
 * like at +5?"). Eleven targets, one press each, and the answer is on screen.
 *
 * Three things it is deliberately not:
 *
 *  - **not a dropdown.** The strip *is* the tier ramp — the same grey-to-gold
 *    eleven steps the 23 chips below it use — so the mapping the doll relies on
 *    is stated once at the top of it rather than only ever inferred. Folded
 *    into a menu it would cost two presses and say nothing at rest.
 *  - **not eleven tab stops.** A toolbar: one stop, arrows to move, Home/End to
 *    the ends. The page already pays 23 stops for the steppers.
 *  - **not destructive.** The last apply leaves a revert beside it that names
 *    what it would restore, because the one thing this control can do that no
 *    hand-edit can is flatten 23 individually-banked tiers in a single press.
 */

import { useRef, useState, type KeyboardEvent } from 'react';
import { MAX_TIER } from '../engine/upgrade';

const TIERS: readonly number[] = Array.from({ length: MAX_TIER + 1 }, (_, n) => n);

/** What reverting the last bulk apply would put back. */
export interface BulkRevertOffer {
  /** How many equipped slots the apply wrote to. */
  items: number;
  /** The tier they all shared beforehand, or null if they were mixed. */
  from: number | null;
  /** The tier that was applied. */
  to: number;
}

export interface BulkUpgradeProps {
  /** Slots carrying an item — the number a bulk apply will touch. */
  equipped: number;
  /** The tier every equipped slot already sits on, or null when they differ. */
  current: number | null;
  revert: BulkRevertOffer | null;
  onApply: (full: number) => void;
  onRevert: () => void;
}

function plural(n: number): string {
  return n === 1 ? 'item' : 'items';
}

export function BulkUpgrade({ equipped, current, revert, onApply, onRevert }: BulkUpgradeProps) {
  const bar = useRef<HTMLDivElement>(null);
  /*
   * Roving tabindex. `null` means "wherever the set already is", so the stop
   * lands on the tier the reader is looking at rather than always on +0.
   */
  const [focused, setFocused] = useState<number | null>(null);
  const active = focused ?? current ?? 0;
  const disabled = equipped === 0;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    let target: number | undefined;
    // A scale, not a carousel: the ends are the ends.
    if (step) target = Math.min(MAX_TIER, Math.max(0, active + step));
    else if (event.key === 'Home') target = 0;
    else if (event.key === 'End') target = MAX_TIER;
    if (target === undefined || target === active) return;
    event.preventDefault();
    setFocused(target);
    bar.current?.querySelector<HTMLButtonElement>(`[data-bulk-tier="${target}"]`)?.focus();
  };

  return (
    <div className="bulk">
      <span className="section-label">Set all to</span>
      <div
        className="bulk-tiers"
        role="toolbar"
        aria-orientation="horizontal"
        aria-label="Set every equipped slot to one upgrade tier"
        ref={bar}
        onKeyDown={onKeyDown}
      >
        {TIERS.map((n) => (
          <button
            key={n}
            type="button"
            data-bulk-tier={n}
            data-tier={n}
            tabIndex={n === active ? 0 : -1}
            disabled={disabled}
            // Not `aria-pressed`: this is where the set already is, not a toggle
            // that stays down. The same word the set switcher and the loadout
            // menu use for "the one you are on".
            aria-current={n === current ? true : undefined}
            aria-label={`Set all ${equipped} equipped ${plural(equipped)} to plus ${n}`}
            title={
              disabled
                ? 'Nothing is equipped yet'
                : `${equipped} ${plural(equipped)} to +${n}`
            }
            onClick={() => onApply(n)}
          >
            +{n}
          </button>
        ))}
      </div>

      {/*
        Announced when it appears, because the press that produced it changed 23
        rows at once and the reader may have been looking at any one of them.
      */}
      {revert ? (
        <div className="bulk-undo" role="status">
          <span>
            {revert.items} {plural(revert.items)} → +{revert.to}
          </span>
          <button
            type="button"
            className="btn btn-quiet btn-sm"
            onClick={onRevert}
            aria-label={
              revert.from === null
                ? `Revert those ${revert.items} ${plural(revert.items)} to their previous tiers`
                : `Revert those ${revert.items} ${plural(revert.items)} to plus ${revert.from}`
            }
            title={
              revert.from === null
                ? 'Put every tier back the way it was, banked experience included'
                : `Put every tier back to +${revert.from}`
            }
          >
            <span aria-hidden="true">↺</span> Revert
          </button>
        </div>
      ) : null}
    </div>
  );
}
