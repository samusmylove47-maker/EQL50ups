/**
 * EverQuest Legends item upgrade (+0..+10) scaling.
 *
 * Reimplemented from the documented rule set in
 * `research/github-data-inventory.md` §2.1 and validated against live-client
 * screenshots recorded in `research/validation/TIER0-VALIDATION.md`.
 *
 * Deliberately NOT ported from any third-party source: the best available
 * reference implementation is FSL-1.1 licensed (source-available, not open
 * source), so the rules were re-derived and re-expressed here.
 *
 * Nine independent predictions from this module match the live client exactly,
 * including the synthetic SV Void line, which appears in no prose documentation.
 */

/** Highest reachable upgrade tier. */
export const MAX_TIER = 10;

/**
 * An item's upgrade state, mirroring the client's `Tier N  x / y` display.
 * `fraction` is experience banked toward the next tier, out of `2 ** full`.
 */
export interface UpgradeState {
  full: number;
  fraction: number;
}

export const BASE_STATE: UpgradeState = { full: 0, fraction: 0 };

/** Convenience constructor for a whole tier with nothing banked. */
export function tier(full: number): UpgradeState {
  return { full: clampTier(full), fraction: 0 };
}

export function clampTier(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(MAX_TIER, Math.max(0, Math.trunc(n)));
}

/** Denominator of the fraction display at a given tier. */
export function fractionDenominator(full: number): number {
  return 2 ** clampTier(full);
}

export function normalizeState(state: UpgradeState): UpgradeState {
  const full = clampTier(state.full);
  const denom = fractionDenominator(full);
  let fraction = Number.isFinite(state.fraction) ? Math.trunc(state.fraction) : 0;
  if (fraction < 0) fraction = 0;
  // At max tier nothing can be banked — the client shows "cannot be upgraded".
  if (full >= MAX_TIER) return { full: MAX_TIER, fraction: 0 };
  if (fraction >= denom) fraction = denom - 1;
  return { full, fraction };
}

/** Continuous upgrade level used by the percentage-based rules. */
export function effectiveLevel(state: UpgradeState): number {
  const { full, fraction } = normalizeState(state);
  return full + fraction / fractionDenominator(full);
}

/** The client's headline number is the effective level times ten. */
export function displayLevel(state: UpgradeState): number {
  return effectiveLevel(state) * 10;
}

/**
 * Half-away-from-zero rounding, as used by the game's stat display.
 * Distinct from `Math.round`, which is half-up and therefore wrong for
 * negative values.
 */
export function excelRound(x: number): number {
  return x >= 0 ? Math.floor(x + 0.5) : Math.ceil(x - 0.5);
}

/**
 * Ceiling to one decimal place, deaf to floating-point residue.
 *
 * The tolerance is load-bearing, not defensive tidiness. `0.09` and `Math.log2`
 * are both inexact, so a weight whose exact value sits precisely on a tenth
 * lands a few ulps above it — Earthshaker at +10 computes 1.6000000000000014 —
 * and a naive ceiling promotes it a whole step. That was wrong on 302 of the
 * 4,400 base-weight/tier combinations under 20 lb, always by 0.1, always
 * upward.
 */
function ceilToOneDecimal(x: number): number {
  return Math.ceil(x * 10 - 1e-9) / 10;
}

/**
 * Scaling for AC, the seven attributes, HP/MANA/ENDUR and every save.
 *
 * The `base <= 10` branch is what older community models misread as a flat
 * "+1 minimum" rule layered on a percentage. It is a branch, not a floor.
 * Penalties shrink toward zero rather than deepening.
 */
export function scalePrimary(base: number, state: UpgradeState): number {
  if (!Number.isFinite(base) || base === 0) return 0;
  const { full } = normalizeState(state);
  if (base < 0) return Math.min(0, base + full);
  if (base <= 10) return base + full;
  const eff = effectiveLevel(state);
  return Math.floor(base + excelRound((base * eff) / 10));
}

/**
 * Weapon damage. Reads the banked fraction, and carries no minimum guarantee.
 * Verified: base 14 -> 14/15/16/18 at +0..+3, base 37 -> 74 at +10.
 */
export function scaleDamage(base: number, state: UpgradeState): number {
  if (!Number.isFinite(base) || base <= 0) return base || 0;
  const eff = effectiveLevel(state);
  return base + Math.floor((base * eff) / 10);
}

/**
 * Flat additive stats: the three regens and worn haste.
 * Whole tiers only — banked experience does not move these.
 */
export function scaleFlat(base: number, state: UpgradeState): number {
  if (!Number.isFinite(base) || base === 0) return 0;
  const { full } = normalizeState(state);
  if (base < 0) return Math.min(0, base + full);
  return base + full;
}

/**
 * Weight decreases along a log2 curve of total accumulated progression.
 *
 * Confirmed against the client on Earthshaker: base 16 at +10 reads `Weight
 * 1.6`, which is the exact arithmetic value. An earlier version of this module
 * deliberately reproduced the IEEE754 residue instead, on the strength of a
 * third-party fixture that claimed base 3.0 at +10 displays 0.4; the client
 * contradicts that, so the residue is now tolerated rather than preserved.
 */
export function scaleWeight(base: number, state: UpgradeState): number {
  if (!Number.isFinite(base) || base <= 0.1) return base;
  const { full, fraction } = normalizeState(state);
  const totalProgression = 2 ** full + fraction;
  const scaled = base * (1 - 0.09 * Math.log2(totalProgression));
  return Math.max(0, ceilToOneDecimal(scaled));
}

/** Attack delay never scales — the whole ratio gain comes from damage alone. */
export function scaleDelay(base: number): number {
  return base;
}

/** Fields that, in sufficient number, trigger the synthetic Void save. */
const VOID_TRIGGER_KEYS: ReadonlySet<string> = new Set([
  'STR', 'STA', 'INT', 'AGI', 'DEX', 'CHA', 'WIS',
  'SV_FIRE', 'SV_COLD', 'SV_POISON', 'SV_MAGIC', 'SV_DISEASE',
]);

/**
 * An upgraded item carrying at least two distinct attribute-or-save fields
 * gains `SV Void` equal to its tier. AC, HP and MANA deliberately do not count
 * toward the trigger.
 *
 * Confirmed in-client: Earthshaker +10 (Strength and Stamina) shows SV Void 10.
 */
export function voidBonus(
  presentKeys: Iterable<string>,
  state: UpgradeState,
): number {
  const { full } = normalizeState(state);
  if (full <= 0) return 0;
  let matches = 0;
  const seen = new Set<string>();
  for (const key of presentKeys) {
    const k = key.toUpperCase();
    if (VOID_TRIGGER_KEYS.has(k) && !seen.has(k)) {
      seen.add(k);
      if (++matches >= 2) return full;
    }
  }
  return 0;
}

/** Weapon damage-to-delay ratio, as the client displays it. */
export function damageRatio(damage: number, delay: number): number {
  if (!delay) return 0;
  return damage / delay;
}

/** Total experience an item at this tier is worth when merged into another. */
export function mergeValue(full: number): number {
  return 2 ** clampTier(full);
}

/** Cumulative experience represented by reaching a given tier. */
export function experienceForTier(full: number): number {
  return 2 ** clampTier(full) - 1;
}

/** Number of distinct reachable upgrade states across all tiers. */
export function reachableStateCount(): number {
  let total = 0;
  for (let t = 0; t < MAX_TIER; t++) total += fractionDenominator(t);
  return total + 1; // plus the terminal max tier, which banks nothing
}
