/**
 * The +0..+10 control — the EQL-native feature no WoW planner needs.
 *
 * It used to be the *smallest* control on the page: 22×20px buttons in dim
 * grey, sitting 8px from a 65×30px CLEAR, so the destructive action was bigger
 * than the marquee feature and 23 identical grey `+0` chips were the most
 * repeated element on the screen. Now:
 *
 *  - 28×28 hit targets with high-contrast glyphs;
 *  - the value chip is coloured at every tier, so the feature is visible at
 *    rest and a set's upgrade state reads at a glance down the column;
 *  - **shift-click steps by five** and shift+arrow does the same, so reaching
 *    +10 costs two clicks rather than ten (230 for a full set);
 *  - Home/End still jump to the ends.
 *
 * Behaves as a spinbutton: the value is the single tab stop and owns the
 * keyboard contract. The flanking buttons are pointer affordances for that
 * spinbutton — `aria-hidden`, so assistive tech is told about one control that
 * works rather than two it cannot reach.
 */

import { MAX_TIER, clampTier, fractionDenominator, normalizeState, type UpgradeState } from '../engine/upgrade';

export interface UpgradeStepperProps {
  value: UpgradeState;
  onChange: (next: UpgradeState) => void;
  /** Name of the thing being upgraded, used for accessible labels. */
  label: string;
  disabled?: boolean;
}

/** Shift multiplies the step, the way a scrub control usually does. */
const BIG_STEP = 5;

export function UpgradeStepper({ value, onChange, label, disabled = false }: UpgradeStepperProps) {
  const state = normalizeState(value);
  const denom = fractionDenominator(state.full);
  const step = (delta: number) => {
    if (disabled) return;
    const next = clampTier(state.full + delta);
    if (next !== state.full) onChange({ full: next, fraction: 0 });
  };

  const banked = state.fraction > 0 ? ` (${state.fraction}/${denom} banked)` : '';

  return (
    <div className="stepper" role="group" aria-label={`${label} upgrade controls`}>
      <button
        type="button"
        onClick={(event) => step(event.shiftKey ? -BIG_STEP : -1)}
        disabled={disabled || state.full <= 0}
        aria-label={`Lower ${label} upgrade level`}
        aria-hidden="true"
        tabIndex={-1}
        title="Lower a tier — hold Shift for five"
      >
        −
      </button>
      <div
        className="value"
        role="spinbutton"
        tabIndex={disabled ? -1 : 0}
        aria-valuenow={state.full}
        aria-valuemin={0}
        aria-valuemax={MAX_TIER}
        aria-valuetext={`plus ${state.full}${banked}`}
        aria-label={`${label} upgrade level`}
        aria-disabled={disabled || undefined}
        data-zero={state.full === 0}
        data-tier={state.full}
        title={`Tier ${state.full}${banked} — arrow keys to step, Shift for five, End for +${MAX_TIER}`}
        onKeyDown={(event) => {
          const size = event.shiftKey ? BIG_STEP : 1;
          switch (event.key) {
            case 'ArrowUp':
            case 'ArrowRight':
              event.preventDefault();
              step(size);
              break;
            case 'ArrowDown':
            case 'ArrowLeft':
              event.preventDefault();
              step(-size);
              break;
            case 'Home':
              event.preventDefault();
              onChange({ full: 0, fraction: 0 });
              break;
            case 'End':
              event.preventDefault();
              onChange({ full: MAX_TIER, fraction: 0 });
              break;
            default:
              break;
          }
        }}
      >
        +{state.full}
      </div>
      <button
        type="button"
        onClick={(event) => step(event.shiftKey ? BIG_STEP : 1)}
        disabled={disabled || state.full >= MAX_TIER}
        aria-label={`Raise ${label} upgrade level`}
        aria-hidden="true"
        tabIndex={-1}
        title="Raise a tier — hold Shift for five"
      >
        +
      </button>
    </div>
  );
}
