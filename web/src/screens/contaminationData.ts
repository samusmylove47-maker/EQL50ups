/**
 * What the contamination page reads.
 *
 * Everything on that page comes from one file — `data/contamination.json`,
 * written by `pipeline/contamination.mjs` — and nothing on it is transcribed.
 * That is deliberate and it is the opposite of the choice `sourcesData.ts`
 * makes: the Sources page hand-copies a few figures out of a 1.1 MB audit file
 * and keeps a test honest about the copy, because those figures are stable.
 * These are not. A contamination count is only true of the build it was
 * measured on, so a hand-copied one would be a claim about a catalog that no
 * longer exists. The page reads the file or says the file is missing.
 *
 * Every field is optional and re-checked at the point of use. The pipeline owns
 * the file, a deployment may predate any given field, and a page whose subject
 * is honesty about data must not throw when its own data is incomplete.
 */

import { useEffect, useState } from 'react';

/** One place a signature was found, and how it split. */
export interface FoundIn {
  file?: string;
  unmarked?: number;
  marked?: number;
}

/** One line of source the scanner matched, quoted so it can be checked. */
export interface CodeSite {
  file?: string;
  line?: number;
  kind?: string;
  text?: string;
}

export interface Signature {
  id?: string;
  group?: string;
  title?: string;
  /** `catalog`, `code` or `both` — which corpus the count is over. */
  corpus?: string;
  unmarked?: number;
  marked?: number;
  total?: number;
  /** The rule by which a hit was counted as marked, printed above the table. */
  markRule?: string;
  /**
   * The files among `codeSites` that carry the badge.
   *
   * `marked` sums two different populations — catalog rows a client window
   * checked, and source sites whose surface tells the reader the figure carries
   * a classic unit — so the second is published separately rather than left to
   * be re-derived. Conflating them is how the page once reported a total that
   * was green while the prose beside it was false.
   */
  markedFiles?: string[];
  classic?: string;
  legends?: string;
  settle?: string;
  findings?: string[];
  foundIn?: FoundIn[];
  codeSites?: CodeSite[];
  examples?: string[];
}

export interface SignatureGroup {
  id?: string;
  title?: string;
  lede?: string;
}

export interface ContaminationReport {
  v?: number;
  generator?: string;
  scannedAt?: string;
  builtAt?: string | null;
  principle?: {
    hit?: string;
    hitBody?: string;
    marked?: string;
    markedBody?: string;
    ourselves?: string;
    ourselvesBody?: string;
  };
  corpus?: {
    catalogItems?: number;
    indexCount?: number;
    catalogFiles?: number;
    sourceFiles?: number;
    sourceLines?: number;
    excluded?: string;
  };
  headline?: {
    unmarkedOnChangedMechanics?: number;
    markedOnChangedMechanics?: number;
    classicFormats?: number;
    classicFormatsUnmarked?: number;
    filesScanned?: number;
    statBlocksShipped?: number;
    statBlocksCheckedAgainstTheGame?: number;
    note?: string;
  };
  groups?: SignatureGroup[];
  signatures?: Signature[];
  assumption?: { title?: string; body?: string; correction?: string };
}

export type ContaminationStatus = 'loading' | 'ready' | 'missing' | 'error';

export interface ContaminationState {
  status: ContaminationStatus;
  report: ContaminationReport | null;
  error: string | null;
}

function reportUrl(): string {
  const base = (import.meta.env?.BASE_URL ?? '/').replace(/\/+$/, '');
  return `${base}/data/contamination.json`;
}

/**
 * Fetch the scan.
 *
 * Same shape as `useSourceMeta`, and for the same reasons: a 404 or an SPA
 * fallback that answers with `index.html` means *not published in this build*,
 * which is a state to render rather than an error to throw. A scanner that has
 * not been run yet is a legitimate condition for a page whose whole subject is
 * saying plainly what is and is not known.
 */
export function useContamination(): ContaminationState {
  const [state, setState] = useState<ContaminationState>({
    status: 'loading',
    report: null,
    error: null,
  });

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const response = await fetch(reportUrl(), { cache: 'no-cache' });
        if (!live) return;
        if (response.status === 404 || response.status === 403) {
          setState({ status: 'missing', report: null, error: null });
          return;
        }
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        const text = (await response.text()).trim();
        if (!live) return;
        if (!text || text.startsWith('<')) {
          setState({ status: 'missing', report: null, error: null });
          return;
        }
        const parsed: unknown = JSON.parse(text);
        if (!live) return;
        if (typeof parsed !== 'object' || parsed === null) {
          setState({ status: 'missing', report: null, error: null });
          return;
        }
        setState({ status: 'ready', report: parsed as ContaminationReport, error: null });
      } catch (error) {
        if (!live) return;
        setState({
          status: 'error',
          report: null,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  return state;
}

/* ------------------------------------------------------------- formatting */

/** A finite integer, or null. Never renders `NaN`, per the app's own rule. */
export function asCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function asText(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

export function asList<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/**
 * The signatures in one group, worst first.
 *
 * Worst means most unmarked, because that is the only column that is a fault.
 * A signature with 126 marked hits and none unmarked is doing its job and
 * belongs at the bottom of the table, not the top.
 */
export function signaturesIn(report: ContaminationReport | null, group: string): Signature[] {
  return asList<Signature>(report?.signatures)
    .filter((s) => s.group === group)
    .sort((a, b) => (b.unmarked ?? 0) - (a.unmarked ?? 0) || (b.marked ?? 0) - (a.marked ?? 0));
}

/**
 * A date, as a reader reads dates.
 *
 * The scan timestamp is the single most load-bearing fact on the page after the
 * counts: a contamination report with no date is a claim about no particular
 * catalog. An unparseable value is returned as written rather than swallowed.
 */
export function scanDate(value: unknown): string {
  const text = asText(value);
  if (!text) return '';
  const at = new Date(text);
  if (Number.isNaN(at.getTime())) return text;
  return at.toISOString().slice(0, 10);
}
