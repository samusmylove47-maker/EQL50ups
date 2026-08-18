/**
 * Why an item is not here.
 *
 * The catalog ships 3,533 of the wiki's 11,252 item records. The other 7,719
 * are content EverQuest Legends does not have — Kunark, Velious, Luclin, the
 * epics, two later revamps — or records no source can place in any era at all.
 * That decision is the most defensible thing this project does, and until now
 * the only place a player met it was an empty result that told them to
 * "loosen a filter" they had never set.
 *
 * So the pipeline's withheld list ships too, reduced to name → reason:
 * `public/quarantine.json`, 174 KB of JSON, ~49 KB over the wire gzipped,
 * fetched **once and only after a search has already returned nothing**. A
 * reader who never runs a dead search never pays for it, and the fetch is
 * fire-and-forget: a failure leaves the old empty state, which is what the app
 * did before this existed.
 *
 * Nothing here infers anything. The reason strings are the pipeline's own
 * `why` values and prose written against `research/SOURCING-STANDARD.md`;
 * `web/scripts/build-quarantine-index.mjs` generates the file and
 * `quarantine.test.ts` fails if it drifts from `pipeline/quarantine.json`.
 */

/** One of the eight rules that withheld an item, as the reader should read it. */
export interface QuarantineReason {
  /** The pipeline's own token, e.g. `era:Kunark`. Shown as provenance. */
  why: string;
  /** Short name for the rule, e.g. `Ruins of Kunark`. */
  title: string;
  /** A sentence or two explaining what that means for the player. */
  line: string;
}

export interface QuarantineIndex {
  counts: { scraped: number; shipped: number; quarantined: number; explained: number };
  /** Reason code → the reason. */
  reasons: Record<string, QuarantineReason>;
  /** Lowercased name → its position in `names`/`codes`. */
  byName: Map<string, number>;
  /** Display names in shipped order, parallel to `codes`, for substring search. */
  names: string[];
  codes: string[];
}

export interface QuarantineHit {
  /** The withheld item's name, exactly as the wiki spells it. */
  name: string;
  reason: QuarantineReason;
  /** Whether the query named this item outright or merely matched it. */
  exact: boolean;
  /** How many other withheld names the same query matched. */
  others: number;
  counts: QuarantineIndex['counts'];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Parse the shipped file. Anything malformed is "no index", never a throw. */
export function parseQuarantineIndex(raw: unknown): QuarantineIndex | null {
  if (!isRecord(raw) || !isRecord(raw.reasons) || !isRecord(raw.names)) return null;

  const reasons: Record<string, QuarantineReason> = {};
  for (const [code, value] of Object.entries(raw.reasons)) {
    if (!isRecord(value)) continue;
    const { why, title, line } = value;
    if (typeof why !== 'string' || typeof title !== 'string' || typeof line !== 'string') continue;
    reasons[code] = { why, title, line };
  }

  const byName = new Map<string, number>();
  const names: string[] = [];
  const codes: string[] = [];
  for (const [code, list] of Object.entries(raw.names)) {
    if (!reasons[code] || !Array.isArray(list)) continue;
    for (const name of list) {
      if (typeof name !== 'string' || !name) continue;
      const key = name.toLowerCase();
      // First writer wins, so a name listed under two rules keeps the first —
      // deterministic rather than dependent on key order.
      if (!byName.has(key)) byName.set(key, names.length);
      names.push(name);
      codes.push(code);
    }
  }
  if (!names.length) return null;

  const rawCounts = isRecord(raw.counts) ? raw.counts : {};
  const n = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);
  return {
    counts: {
      scraped: n(rawCounts.scraped),
      shipped: n(rawCounts.shipped),
      quarantined: n(rawCounts.quarantined),
      explained: n(rawCounts.explained),
    },
    reasons,
    byName,
    names,
    codes,
  };
}

/**
 * Does this query name something the pipeline withheld?
 *
 * Matching mirrors `SearchIndex.search` exactly — every whitespace-separated
 * term must be a substring of the lowercased name — because the whole point is
 * to answer *the query that just found nothing*. A looser rule would explain an
 * item the search was not looking for; a stricter one would miss `wurmslay`.
 *
 * Ties break on the shortest name and then alphabetically, so `jade` reports
 * `Jade Mace` rather than `Jade Mace of the Reclaimer`, and the same query
 * always reports the same item.
 */
export function findQuarantined(
  index: QuarantineIndex | null,
  query: string,
): QuarantineHit | null {
  if (!index) return null;
  const cleaned = query.toLowerCase().trim();
  const terms = cleaned.split(/\s+/).filter(Boolean);
  if (!terms.length) return null;

  // One pass over 7,719 names — the whole reason this runs only after a search
  // has already returned nothing.
  const exactAt = index.byName.get(cleaned);
  let bestAt = -1;
  let matches = 0;
  for (let i = 0; i < index.names.length; i++) {
    const name = (index.names[i] as string).toLowerCase();
    let all = true;
    for (const term of terms) {
      if (!name.includes(term)) {
        all = false;
        break;
      }
    }
    if (!all) continue;
    matches += 1;
    if (bestAt < 0) {
      bestAt = i;
      continue;
    }
    const best = (index.names[bestAt] as string).toLowerCase();
    if (name.length < best.length || (name.length === best.length && name < best)) bestAt = i;
  }

  // A name typed in full wins over a shorter one it happens to contain.
  const at = exactAt ?? bestAt;
  if (at < 0) return null;
  const reason = index.reasons[index.codes[at] as string];
  if (!reason) return null;
  return {
    name: index.names[at] as string,
    reason,
    exact: exactAt !== undefined,
    others: Math.max(0, matches - 1),
    counts: index.counts,
  };
}

/* ------------------------------------------------------------ the fetch */

function quarantineUrl(): string {
  const base = (import.meta.env?.BASE_URL ?? '/').replace(/\/+$/, '');
  return `${base}/quarantine.json`;
}

let pending: Promise<QuarantineIndex | null> | null = null;

/**
 * Fetch the withheld list once per session.
 *
 * Memoised on the promise, not on the result, so ten keystrokes that each miss
 * cause one request rather than ten. A failed fetch is remembered as `null`
 * and not retried: the empty state degrades to the wording it had before, and
 * a network that cannot reach a 174 KB file will not reach it on keystroke 11
 * either.
 */
export function loadQuarantineIndex(): Promise<QuarantineIndex | null> {
  if (pending) return pending;
  pending = (async () => {
    try {
      const response = await fetch(quarantineUrl(), { cache: 'force-cache' });
      if (!response.ok) return null;
      const text = (await response.text()).trim();
      // A dev server with SPA fallback answers 200 with index.html.
      if (!text || text.startsWith('<')) return null;
      return parseQuarantineIndex(JSON.parse(text));
    } catch {
      return null;
    }
  })();
  return pending;
}

/** Tests only: forget the memoised fetch. */
export function resetQuarantineIndex(): void {
  pending = null;
}
