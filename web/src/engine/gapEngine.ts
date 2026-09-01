/**
 * Reading the vendored gap engine, and shipping when it is not there.
 *
 * **The degradation path is the point of this module, not a fallback bolted on
 * afterwards.** It was written and tested before the happy path, because it is
 * the one that runs when something goes wrong at three in the morning: the
 * bundle failed to load, a cached copy is a version behind, the global is
 * missing because a script tag moved. In every one of those cases 50 Upgrades
 * still ships an answer and says plainly what it cannot tell.
 *
 * ## The version assertion, and why it is exact
 *
 * `EQLSGapEngine.version` must read exactly `1.3.0` before any measured key is
 * touched. Not a range, not a minimum: a major bump changes the `Report` shape
 * and a minor one changed `months_seen` from `["Aug"]` to `2` in the space of
 * an hour. An engine that is merely *newer* is not automatically readable.
 *
 * The pin was held at 1.2.0 through a re-vendor because **two different
 * byte-sets shipped as 1.2.0 in one night** — 20,337 bytes (`d6e17bec`, what we
 * had pinned) and a larger build that changed the parser. An exact-equality
 * guard cannot tell those apart, which is the one failure a pin exists to
 * prevent. The version moved to 1.3.0 at source before we re-pinned, so this is
 * the first pin here whose version actually discriminates.
 *
 * **What the vendored copy is pinned to** is recorded beside it in
 * `web/public/vendor/eqls-gap-engine.provenance.json` — the source commit, the
 * content hash, the byte count, and an A/B we ran ourselves rather than
 * accepted. Both bundles on identical input: on a zero-padded day the two are
 * a no-op apart, and on a space-padded (`ctime`) day 1.2.0 dropped every line
 * after midnight while 1.3.0 keeps them. Strictly better, inert on the form we
 * have actually seen written.
 *
 * ## Three populations, and the denominator this module exists to get right
 *
 * 1.3.0 added `measured.window`, and it is the reason this re-pin was not
 * optional. The numbers in `measured` are over **three different populations**:
 * `damage_dealt` counts only hits inside the engaged window, while
 * `spells_landed` counts every line in the log. Our own published contract
 * named `damage_dealt` as "the denominator for share-of-output" — and E
 * measured that division at 202% on the log the engine was built against, 324%
 * on another, so it is not even a constant a reader could learn to subtract.
 *
 * The correct denominator for a spell's share is `window.all_lines.damage`.
 * `window` is therefore type-checked here exactly as hard as `months_seen`: an
 * engine that cannot say which population a number is over is an engine this
 * app declines to divide by.
 *
 * ## What "unknown" means here, and why it is not silence
 *
 * When the engine is absent or the wrong version, the spell lane cannot
 * distinguish **"you never learned it"** from **"you never pressed it"**. Those
 * are different facts about a player and recommending against either without
 * knowing which is the failure this project keeps designing away from. So the
 * lane reports itself unavailable, in those words, and the rest of the plan —
 * everything B computes from the catalogue — ships unaffected.
 */

/**
 * Which population a `measured` number is over.
 *
 * The engine publishes this itself, as `measured.window.keys_by_population`,
 * rather than leaving each consumer to guess. `POPULATION_OF` records the two
 * filings this app depends on, so that if the engine ever re-files them the
 * seam test fails and someone re-reads the contract instead of quietly
 * dividing one population by another.
 */
export const POPULATION_OF = {
  damage_dealt: 'in_window',
  spells_landed: 'all_lines',
} as const;

/** The window block. `all_lines.damage` is the only sound share denominator. */
export interface GapWindow {
  basis: string;
  in_window: { hits: number; damage: number };
  /** Total outgoing damage over EVERY line — what `spells_landed` totals are over. */
  all_lines: { hits: number; damage: number };
  keys_by_population: Record<string, readonly string[]>;
}

/** The subset of E's `measured` block this app reads. See the contract fixture. */
export interface GapMeasured {
  engaged_seconds: number;
  melee_seconds: number;
  /**
   * Outgoing damage **inside the engaged window only**. Not the denominator for
   * a spell's share of output — see `shareOfOutput`, and the module header.
   */
  damage_dealt: number;
  /** A COUNT of distinct months, never the months themselves. A staleness signal. */
  months_seen: number;
  window: GapWindow;
  spells_landed: Record<string, {
    landings: number;
    normalised_key: string;
    damage_total: number;
    damage_median: number;
    damage_max: number;
  }>;
}

export const REQUIRED_ENGINE_VERSION = '1.3.0';

export type GapAvailability =
  | { available: true; version: string; measured: GapMeasured }
  /**
   * Never an error and never silence. `why` is shown to the reader, because a
   * lane that has gone quiet without saying so is indistinguishable from a lane
   * that found nothing.
   */
  | { available: false; version: string | null; why: string };

interface GapEngineGlobal {
  version?: unknown;
  gapEngine?: (lines: string[], context: unknown) => { measured?: unknown };
}

/** The sentence a reader sees wherever the measured lane would have been. */
export const UNAVAILABLE_TEXT =
  'this build cannot tell “you never learned it” from “you never pressed it” — a newer engine is needed';

function versionOf(engine: GapEngineGlobal | undefined): string | null {
  return typeof engine?.version === 'string' ? engine.version : null;
}

/**
 * Is the measured lane usable, and if not, exactly why?
 *
 * Takes the global rather than reaching for `window`, so the degradation path
 * is testable without a DOM — which is the only way to be sure it works, since
 * it is the path that by definition never runs in development.
 */
export function gapAvailability(
  engine: GapEngineGlobal | undefined,
  lines: readonly string[],
  context: unknown,
): GapAvailability {
  if (!engine || typeof engine.gapEngine !== 'function') {
    return { available: false, version: versionOf(engine), why: UNAVAILABLE_TEXT };
  }
  const version = versionOf(engine);
  if (version !== REQUIRED_ENGINE_VERSION) {
    return { available: false, version, why: UNAVAILABLE_TEXT };
  }

  let report: { measured?: unknown };
  try {
    report = engine.gapEngine([...lines], context);
  } catch {
    // A throwing engine is an absent engine as far as a reader is concerned.
    return { available: false, version, why: UNAVAILABLE_TEXT };
  }

  const measured = report?.measured as Partial<GapMeasured> | undefined;
  /*
   * `months_seen` is type-checked rather than merely read, and that is not
   * defensive habit: 1.2.0's first build emitted `["Aug"]` where the spec said
   * a count, and a consumer doing arithmetic on a list gets a TypeError at best
   * and a wrong staleness claim at worst. Our contract fixture caught it, and
   * this check is what stops a future build reintroducing it silently.
   */
  if (!measured || typeof measured.months_seen !== 'number'
    || typeof measured.engaged_seconds !== 'number'
    || typeof measured.melee_seconds !== 'number'
    || typeof measured.damage_dealt !== 'number'
    || typeof measured.spells_landed !== 'object' || measured.spells_landed === null) {
    return { available: false, version, why: UNAVAILABLE_TEXT };
  }
  /*
   * `window` is checked as hard as `months_seen`, and for the same reason: the
   * failure it prevents is silent. Without it there is no sound denominator for
   * a share, and the obvious wrong one — `damage_dealt` — returns a plausible
   * percentage rather than an error. 202% on one log, 324% on another, 34% on a
   * third: wrong, and not wrong by a constant. An engine that will not say
   * which population a number is over is one this app declines to divide by.
   */
  const w = measured.window as Partial<GapWindow> | undefined;
  if (!w || typeof w.all_lines !== 'object' || w.all_lines === null
    || typeof w.all_lines.damage !== 'number'
    || typeof w.in_window !== 'object' || w.in_window === null
    || typeof w.in_window.damage !== 'number') {
    return { available: false, version, why: UNAVAILABLE_TEXT };
  }

  return { available: true, version, measured: measured as GapMeasured };
}

/**
 * A spell's share of this character's output, or `null` when it cannot be one.
 *
 * Exists so that the right denominator is the reachable one. The published
 * contract named `damage_dealt`, which is scoped to the engaged window while
 * `spells_landed` is scoped to every line; dividing across that boundary gave
 * 202% on the engine's own corpus. Returns `null` rather than `Infinity` or a
 * misleading zero when there is nothing measured to divide by.
 */
export function shareOfOutput(measured: GapMeasured, damageTotal: number): number | null {
  const denominator = measured.window.all_lines.damage;
  if (!(denominator > 0)) return null;
  return damageTotal / denominator;
}

/**
 * Should a spell row make a measured claim?
 *
 * Ruled 31 Aug: a Band A row only where `spells_landed` shows **at least one
 * landing**. A count of zero is indistinguishable from a vocabulary miss — the
 * parser not recognising the spell's log string — and treating "I did not see
 * it" as "you are not using it" is the recommendation that loses trust.
 */
export function hasMeasuredLandings(
  measured: GapMeasured,
  rawLogString: string,
): boolean {
  const entry = measured.spells_landed[rawLogString];
  return Boolean(entry && entry.landings > 0);
}
