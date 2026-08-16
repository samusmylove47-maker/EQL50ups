/**
 * Number and text formatting.
 *
 * Every numeric path in the UI goes through here. The single rule: a
 * non-finite value never reaches the DOM. Sixtyupgrades' empty state renders
 * `Total Avoidance NaN%`; ours renders a clean zero.
 */

/** Coerce anything to a finite number, defaulting to 0. */
export function finite(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Integer display, never NaN. */
export function num(value: unknown): string {
  return String(Math.round(finite(value)));
}

/** Fixed-decimal display, never NaN, trailing zeros trimmed. */
export function dec(value: unknown, places = 1): string {
  const n = finite(value);
  const s = n.toFixed(places);
  return s.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}

/**
 * Equivalency points, always to one decimal.
 *
 * The numeric policy in one function. `dec()` trims trailing zeros, so an EP
 * column printed `57.5` next to `31` next to `41.8` and the decimal points in
 * a right-aligned comparison column did not line up — 78 of 97 picker rows had
 * no decimal and 19 had one. EP is 1dp everywhere; weapon ratio is 3dp because
 * that is what the client prints; everything else is a whole number.
 */
export function ep(value: unknown): string {
  return finite(value).toFixed(1);
}

/** Signed integer, e.g. `+12` / `-3` / `0`. */
export function signed(value: unknown): string {
  const n = Math.round(finite(value));
  return n > 0 ? `+${n}` : String(n);
}

/** Signed decimal for scores and ratios. */
export function signedDec(value: unknown, places = 1): string {
  const n = finite(value);
  const body = dec(Math.abs(n), places);
  if (n > 0) return `+${body}`;
  if (n < 0) return `-${body}`;
  return '0';
}

/** `value / cap` the way the client's Stats window prints it. */
export function capped(value: unknown, cap: unknown): string {
  return `${num(value)}/${num(cap)}`;
}

export function pluralize(n: number, one: string, many = `${one}s`): string {
  return `${num(n)} ${Math.round(finite(n)) === 1 ? one : many}`;
}

/** Compact thousands separator for large counts. */
export function count(value: unknown): string {
  return Math.round(finite(value)).toLocaleString('en-US');
}
