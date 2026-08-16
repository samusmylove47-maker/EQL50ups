/**
 * The +0..+10 control — the EQL-native feature no WoW planner needs.
 *
 * Rendered on every equipped item. Behaves as a spinbutton: arrow keys step a
 * tier, Home/End jump to the ends, and the flanking buttons are ordinary
 * buttons with labels so screen readers announce what they do. Every change is
 * a synchronous store write, so the stat panel recomputes in the same frame.
 */

import { MAX_TIER, clampTier, fractionDenominator, normalizeState, type UpgradeState } from '../engine/upgrade';

export interface UpgradeStepperProps {
  value: UpgradeState;
  onChange: (next: UpgradeState) => void;
  /** Name of the thing being upgraded, used for accessible labels. */
  label: string;
  disabled?: boolean;
}

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
        onClick={() => step(-1)}
        disabled={disabled || state.full <= 0}
        aria-label={`Lower ${label} upgrade level`}
        tabIndex={-1}
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
        data-zero={state.full === 0}
        title={`Tier ${state.full}${banked}`}
        onKeyDown={(event) => {
          switch (event.key) {
            case 'ArrowUp':
            case 'ArrowRight':
              event.preventDefault();
              step(1);
              break;
            case 'ArrowDown':
            case 'ArrowLeft':
              event.preventDefault();
              step(-1);
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
        onClick={() => step(1)}
        disabled={disabled || state.full >= MAX_TIER}
        aria-label={`Raise ${label} upgrade level`}
        tabIndex={-1}
      >
        +
      </button>
    </div>
  );
}
