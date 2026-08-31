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
 * `EQLSGapEngine.version` must read exactly `1.2.0` before any measured key is
 * touched. Not a range, not a minimum: a major bump changes the `Report` shape
 * and a minor one changed `months_seen` from `["Aug"]` to `2` in the space of
 * an hour. An engine that is merely *newer* is not automatically readable.
 *
 * **What the vendored copy is pinned to** is recorded beside it in
 * `web/public/vendor/eqls-gap-engine.provenance.json` — the source commit, the
 * content hash, and a verification we ran ourselves rather than accepted:
 * one continuous fight spanning 31 Aug 23:59 into 1 Sep 00:00 segments as
 * **one** engagement of 78 seconds. The previous build split it in two, because
 * its day index ran backwards across a month boundary.
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

/** The subset of E's `measured` block this app reads. See the contract fixture. */
export interface GapMeasured {
  engaged_seconds: number;
  melee_seconds: number;
  damage_dealt: number;
  /** A COUNT of distinct months, never the months themselves. A staleness signal. */
  months_seen: number;
  spells_landed: Record<string, {
    landings: number;
    normalised_key: string;
    damage_total: number;
    damage_median: number;
    damage_max: number;
  }>;
}

export const REQUIRED_ENGINE_VERSION = '1.2.0';

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

  return { available: true, version, measured: measured as GapMeasured };
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
