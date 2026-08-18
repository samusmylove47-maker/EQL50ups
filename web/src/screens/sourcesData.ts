/**
 * What the Sources page reads, and where each part of it comes from.
 *
 * Two kinds of fact live here, and they are kept apart on purpose:
 *
 *   1. **Live.** `meta.json` already ships to every browser and carries the
 *      richest provenance artefact in the project — `dataReliability`,
 *      `sourceStanding`, `counts`, `provenance`, `era`. Nothing in `web/src`
 *      read it before this file existed: it was downloaded by every user and
 *      shown to none of them, which is precisely the burial rule 5 of
 *      `research/SOURCING-STANDARD.md` forbids. It is fetched here and rendered
 *      as it is written, not summarised.
 *
 *   2. **Transcribed.** The era purge is reported in `pipeline/quarantine.json`,
 *      which is a 1.1 MB audit file that (rightly) never ships to a browser.
 *      Its head-line counts are copied into `PURGE` below by hand, and
 *      `sources.test.tsx` reads the real file and fails if a single one of them
 *      drifts. A hand-copied number with a test behind it is a citation; one
 *      without is an invention.
 *
 * Everything the page prints is one or the other, and the page says which at
 * the point of use.
 */

import { useEffect, useState } from 'react';

/* --------------------------------------------------------------- live meta */

export interface StandingVocabularyEntry {
  code?: string;
  tier?: string | null;
  means?: string;
}

export interface FlagContradiction {
  item?: string;
  client?: string[];
  catalog?: string[];
}

export interface SkillContradiction {
  item?: string;
  client?: string;
  catalog?: string;
}

export interface WeaponSkillSuspect {
  n?: string;
  skill?: string;
}

export interface UnstattedItem {
  n?: string;
  id?: number | null;
  sl?: string[];
  cl?: string[];
}

/**
 * The shipped `meta.json`, as far as this page reads it.
 *
 * Every field is optional and every array is re-checked at the point of use:
 * the pipeline owns this file, a build may predate any given field, and a
 * provenance page that throws is worse than one that says "not published in
 * this build".
 */
export interface SourceMeta {
  builtAt?: string;
  generator?: string;
  attribution?: string;
  license?: { content?: string; contentSource?: string; note?: string };
  era?: { current?: string; order?: string[]; policy?: string };
  counts?: {
    items?: number;
    withNumericId?: number;
    withStats?: number;
    eraUnknown?: number;
    statsUnknown?: number;
    standing?: Record<string, number>;
    existence?: Record<string, number>;
  };
  sourceStanding?: {
    standard?: string;
    principle?: string;
    existence?: {
      question?: string;
      note?: string;
      absent?: string;
      vocabulary?: StandingVocabularyEntry[];
      counts?: Record<string, number>;
    };
    stats?: {
      question?: string;
      vocabulary?: StandingVocabularyEntry[];
      tiersNotPresent?: Record<string, string>;
      counts?: Record<string, number>;
      clientVerified?: string[];
    };
  };
  dataReliability?: {
    stats?: { confidence?: string; note?: string };
    flags?: {
      confidence?: string;
      doNotUseAsAuthoritativeFilter?: boolean;
      summary?: string;
      clientVerifiedContradictions?: FlagContradiction[];
      pageConventions?: {
        legacy?: Record<string, number>;
        modern?: Record<string, number>;
        bothSpellings?: number;
      };
      findings?: string[];
      openQuestion?: string;
    };
    weaponSkill?: {
      confidence?: string;
      summary?: string;
      clientVerifiedContradictions?: SkillContradiction[];
      evidence?: string[];
      suspectRule?: string;
      suspects?: WeaponSkillSuspect[];
    };
    dmgBonus?: { confidence?: string; note?: string };
    itemIds?: { confidence?: string; note?: string };
    unstattedKnownItems?: {
      confidence?: string;
      count?: number;
      policy?: string;
      items?: UnstattedItem[];
    };
  };
  provenance?: {
    repos?: Array<{ repo?: string; sha?: string; file?: string; role?: string; license?: string }>;
    inputs?: Array<{ key?: string; file?: string; bytes?: number; sha256_16?: string }>;
    itemIds?: { source?: string; note?: string; observed?: number; applied?: number };
  };
}

export type SourceMetaStatus = 'loading' | 'ready' | 'missing' | 'error';

export interface SourceMetaState {
  status: SourceMetaStatus;
  meta: SourceMeta | null;
  error: string | null;
}

function metaUrl(): string {
  const base = (import.meta.env?.BASE_URL ?? '/').replace(/\/+$/, '');
  return `${base}/data/meta.json`;
}

/**
 * Fetch `meta.json` on its own rather than through the catalog store.
 *
 * The store deliberately narrows the file to four fields it needs
 * (`normalizeMeta` in `data/catalog.ts`), and widening that shape for one
 * screen would put the whole provenance payload in every user's memory for the
 * 99% of sessions that never open this page. This is one 11 KB request, made
 * when the page is opened.
 */
export function useSourceMeta(): SourceMetaState {
  const [state, setState] = useState<SourceMetaState>({
    status: 'loading',
    meta: null,
    error: null,
  });

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const response = await fetch(metaUrl(), { cache: 'no-cache' });
        if (!live) return;
        if (response.status === 404 || response.status === 403) {
          setState({ status: 'missing', meta: null, error: null });
          return;
        }
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        const text = (await response.text()).trim();
        if (!live) return;
        // A dev server with SPA fallback answers 200 with index.html.
        if (!text || text.startsWith('<')) {
          setState({ status: 'missing', meta: null, error: null });
          return;
        }
        const parsed: unknown = JSON.parse(text);
        if (!live) return;
        if (typeof parsed !== 'object' || parsed === null) {
          setState({ status: 'missing', meta: null, error: null });
          return;
        }
        setState({ status: 'ready', meta: parsed as SourceMeta, error: null });
      } catch (error) {
        if (!live) return;
        setState({
          status: 'error',
          meta: null,
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

/* ------------------------------------------------------- reading it safely */

export function asList<T>(value: T[] | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

/** A string only if there is one with something in it. */
export function asText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

/** A number only if it is a real one. Never a coercion, never a fallback. */
export function asCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/* ------------------------------------------------- transcribed: the purge */

export interface PurgeReason {
  reason: string;
  items: number;
}

/**
 * The era purge, transcribed from `pipeline/quarantine.json` on 2026-08-17.
 *
 * `counts.before`, `counts.shipped`, `counts.quarantined`, `counts.shipReasons`
 * and `counts.quarantineReasons`, verbatim and in the file's own order. The
 * reason strings are the pipeline's own, not a rewording: they are what an
 * auditor greps for.
 */
export const PURGE = {
  source: 'pipeline/quarantine.json',
  transcribed: '2026-08-17',
  rule: 'ships iff pre-Kunark era, or present in the live client export, or player-confirmed',
  before: 11252,
  shipped: 3533,
  quarantined: 7719,
  shipReasons: [
    { reason: 'era:Classic', items: 2772 },
    { reason: 'era:Sky', items: 324 },
    { reason: 'in-live-inventory', items: 284 },
    { reason: 'era:Temple', items: 100 },
    { reason: 'era:Fear', items: 22 },
    { reason: 'era:Paineel', items: 21 },
    { reason: 'player-confirmed', items: 6 },
    { reason: 'era:Hate', items: 4 },
  ] as PurgeReason[],
  quarantineReasons: [
    { reason: 'era:Velious', items: 2828 },
    { reason: 'no era in any source', items: 2331 },
    { reason: 'era:Kunark', items: 1457 },
    { reason: 'era:Epic Quests', items: 867 },
    { reason: 'era:Chardok Revamp', items: 145 },
    { reason: 'era:FearHateRevamp', items: 53 },
    { reason: 'wiki flags non_legends', items: 26 },
    { reason: 'era:Luclin', items: 12 },
  ] as PurgeReason[],
} as const;

/* --------------------------------------------- transcribed: the hierarchy */

export type TierBand = 'trusted' | 'corroborating' | 'distrust';

export interface TierCard {
  tier: string;
  standing: string;
  band: TierBand;
  title: string;
  body: string;
  /** What this tier is, in this repository, with the files named. */
  here: string;
}

/**
 * The hierarchy itself, condensed from `research/SOURCING-STANDARD.md`, which
 * is in turn transcribed from eqlsource.com/sources. The `body` lines follow
 * the standard's own wording; the `here` lines say what the tier amounts to in
 * this repository and name the file that backs the claim.
 *
 * Tier counts are not baked in here — the page fills them from the shipped
 * `meta.counts`, so a rebuild cannot leave a stale number on this page.
 */
export const TIERS: readonly TierCard[] = [
  {
    tier: 'Tier M',
    standing: 'Strongest',
    band: 'trusted',
    title: 'Our own client output',
    body:
      'First-hand instrument data: what happened, in the live game, on a dated session, to a named ' +
      'character, parsed rather than remembered. It outranks every read source for what it directly ' +
      'measures, and generalises to nothing beyond its stated conditions.',
    here:
      'A live /outputfile inventory export (research/validation/tier0-inventory-Avenrae.txt, ' +
      '2026-08-16), the client screenshots recorded in research/validation/TIER0-VALIDATION.md, and ' +
      "the owner's own reports. Where the game and a source disagree, the source is corrected.",
  },
  {
    tier: 'Tier 1',
    standing: 'Strongest read source',
    band: 'trusted',
    title: 'Official patch notes',
    body:
      'Dated and authoritative. They override everything below them, and anything published after a ' +
      "wiki page's last edit supersedes that page.",
    here: 'No patch note supplies an item stat in this build.',
  },
  {
    tier: 'Tier 2',
    standing: 'Structured wiki data',
    band: 'trusted',
    title: 'Infoboxes and item tables',
    body:
      'Machine-shaped fields on eqlwiki that somebody entered from the live game: infoboxes, NPC ' +
      'tables, item tables, coordinate records.',
    here:
      'The catalog. It is also contaminated — the wiki is partly a Project 1999 import, and the item ' +
      'tables inherit it, which is what the era purge below is for.',
  },
  {
    tier: 'Tier 3',
    standing: 'Named community guides',
    band: 'corroborating',
    title: 'Maintained guides',
    body:
      'eqprogression.com and maintained wiki user guides: named authors, actively updated, dated. ' +
      "Reliable, but one person's reading of the game.",
    here: 'Not used as an item-stat source in this build.',
  },
  {
    tier: 'Tier 4',
    standing: 'Aggregators',
    band: 'corroborating',
    title: 'Second pairs of eyes',
    body:
      'EQL Build Forge, EQ Legends Tools. Useful for cross-checking a number. Each carries a snapshot ' +
      'date, and anything older than the last patch is stale.',
    here: 'Not used as an item-stat source in this build.',
  },
  {
    tier: 'Tier 5',
    standing: 'Marked on sight',
    band: 'distrust',
    title: 'Wiki prose',
    body:
      'Large parts are a Project 1999 import, sometimes word for word. It describes a single-class ' +
      'game at fixed difficulty. Quoted only when marked as classic, never as Legends fact.',
    here:
      'Numbers this project cannot place in this game. Those rows ship only because a live client ' +
      'holds the item, so the stat block may describe an original-EverQuest item of the same name. ' +
      'The item window marks every one of them.',
  },
];
