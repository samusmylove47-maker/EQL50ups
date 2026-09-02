/**
 * The contamination scan, and the three promises this page makes.
 *
 * **One: every figure is measured, not remembered.** Nothing on the page is
 * transcribed, so there is no copy to keep honest — but there is a scan, and a
 * scan can be wrong. These tests re-derive the load-bearing counts straight out
 * of the shipped catalog, independently of `pipeline/contamination.mjs`, and
 * fail if the published report disagrees with the payload it claims to
 * describe. A count nobody can reproduce is a recollection.
 *
 * **Two: marked and unmarked never merge.** Every signature is asserted to
 * split cleanly and to carry the four things a reader needs before a number
 * means anything: what classic did, what Legends does, what would settle it,
 * and the rule by which a hit was counted as marked.
 *
 * **Three: the page is honest about us.** The sharpest finding in the scan is
 * against this app, and the last block asserts it reaches the screen in words —
 * the haste unit, the percent sign, the EP weight, and the file and line of our
 * own source. If somebody softens that copy, this fails.
 *
 * Nothing here asserts a frozen headline number. The catalog is rebuilt by
 * another process and `web/src` is edited by several, so a test pinning "27
 * unmarked haste hits" would fail on somebody else's correct change. What is
 * pinned is the relationship between the report and the files, which stays true
 * however the counts move.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { parseHash, href } from '../router';
import { emptyState } from '../state/persistence';
import { useApp } from '../state/store';
import { Contamination } from './Contamination';
import { scanDate, signaturesIn, type ContaminationReport, type Signature } from './contaminationData';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const REPORT = 'public/data/contamination.json';
const SHARDS = 'public/data/items';

function readReport(): ContaminationReport {
  return JSON.parse(readFileSync(REPORT, 'utf8')) as ContaminationReport;
}

/**
 * Every shipped item, once, derived here rather than imported.
 *
 * The slot shards carry a multi-slot item once per slot. The scanner keys them
 * by name and so does this, independently: if both had the same bug the test
 * would agree with the scanner and mean nothing, so the dedupe is the one piece
 * of logic deliberately written twice.
 */
interface RawItem {
  n: string;
  st?: Record<string, number>;
  sv?: Record<string, number>;
  wp?: { skill?: string; bonus?: number };
  fl?: string[];
  cl?: string[];
  sd?: string;
  vf?: string[];
  chg?: number;
  cf?: unknown[];
  fx?: Array<{ n?: string; d?: string }>;
}

function shippedItems(): RawItem[] {
  const byName = new Map<string, RawItem>();
  for (const file of readdirSync(SHARDS).filter((f) => f.endsWith('.json'))) {
    const shard = JSON.parse(readFileSync(`${SHARDS}/${file}`, 'utf8')) as { items?: RawItem[] };
    for (const item of shard.items ?? []) if (!byName.has(item.n)) byName.set(item.n, item);
  }
  return [...byName.values()];
}

const HAVE_SCAN = existsSync(REPORT) && existsSync(SHARDS);

function sigOf(report: ContaminationReport, id: string): Signature {
  const found = (report.signatures ?? []).find((s) => s.id === id);
  expect(found, `the scan publishes no signature "${id}"`).toBeTruthy();
  return found as Signature;
}

/* ------------------------------------------ the report describes the files */

describe.skipIf(!HAVE_SCAN)('the scan agrees with the catalog it claims to describe', () => {
  const report = readReport();
  const items = shippedItems();

  it('counts the same catalog the payload ships', () => {
    expect(report.corpus?.catalogItems).toBe(items.length);
  });

  it('carries a scan date that parses', () => {
    expect(scanDate(report.scannedAt)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  /*
   * Marked now counts two populations, and that is the point.
   *
   * A catalog row is marked when a client window checked its HASTE. A source
   * site is marked when the surface printing the figure reaches for the shared
   * HASTE_PROVENANCE / HASTE_STACKING constants — that is what "this screen
   * tells the reader the number carries a classic unit" means here.
   *
   * The scanner used to hardcode every source site as unmarked and publish
   * prose saying "nothing counts as marked", both written before the badge
   * shipped and neither updated when it did. The page went on accusing our own
   * code of a fault we had fixed. So marked-ness is detected now, and this test
   * checks the two populations separately rather than asserting a single total
   * that could only ever be right by accident.
   */
  it('haste: catalog rows are marked by the client, source sites by the badge', () => {
    const haste = items.filter((i) => i.st?.HASTE != null);
    const verified = haste.filter((i) => i.sd === 'tier-M' && (i.vf ?? []).includes('HASTE'));
    const sig = sigOf(report, 'haste-pct');

    const markedFiles = sig.markedFiles ?? [];
    const badged = (sig.codeSites ?? []).filter(
      (site) => site.file !== undefined && markedFiles.includes(site.file),
    );

    // Every client-checked catalog row is marked, and every marked source site
    // is one this scan actually found; the total is the sum of both.
    expect(sig.marked).toBeGreaterThanOrEqual(verified.length);
    expect(sig.marked).toBe(verified.length + badged.length);
    expect(sig.unmarked).toBeGreaterThanOrEqual(haste.length - verified.length);
    expect((sig.unmarked ?? 0) + (sig.marked ?? 0)).toBe(sig.total);

    // And the badge really is on a surface a reader meets, not only in a test.
    expect(badged.map((s) => s.file)).toEqual(
      expect.arrayContaining([expect.stringMatching(/StatPanel|ItemWindow|Upgrades/)]),
    );
  });

  it('resists: every SV field ships counted, marked only where a client window checked it', () => {
    const fields = items.reduce((n, i) => n + Object.keys(i.sv ?? {}).length, 0);
    const checked = items.reduce(
      (n, i) =>
        n +
        Object.keys(i.sv ?? {}).filter(
          (save) => i.sd === 'tier-M' && (i.vf ?? []).includes(`SV_${save}`),
        ).length,
      0,
    );
    const sig = sigOf(report, 'sv-resist');
    expect(sig.total).toBe(fields);
    expect(sig.marked).toBe(checked);
  });

  it('charges: the count is the number of shipped items carrying one', () => {
    expect(sigOf(report, 'charges').total).toBe(items.filter((i) => i.chg != null).length);
  });

  it('era-unplaced: every tier-5 row is counted, and every one of them is marked', () => {
    const tier5 = items.filter((i) => i.sd === 'tier-5');
    const sig = sigOf(report, 'era-unplaced');
    expect(sig.total).toBe(tier5.length);
    /*
     * The one signature that is allowed to be entirely marked, and the reason
     * the page can claim the scanner is doing its job at all. The item window
     * prints "Tier 5 · wiki stats, era unplaced" on every one of these rows, so
     * an unmarked tier-5 hit would mean that badge had been removed.
     */
    expect(sig.unmarked).toBe(0);
    expect(sig.marked).toBe(tier5.length);
  });

  it('damage bonus: counted off the catalog, and explained whether or not any are found', () => {
    /*
     * This asserted `toHaveLength(0)` until 2 September 2026, when the live-wiki
     * supplement brought in three weapons whose pages actually print a DMG Bonus
     * line. The assertion was true when written and it was still the wrong
     * assertion: it pinned a *count* that the catalog was free to change, so the
     * first genuine one to arrive read as a regression.
     *
     * What must hold is not that the number is zero. It is that the scanner's
     * number is the catalog's number — the scan describes the payload it claims
     * to describe — and that the standard's rule 4 is obeyed either way: an
     * absent bonus is stated as absent, never printed as a 0.
     */
    const carried = items.filter((i) => i.wp?.bonus != null);
    const sig = sigOf(report, 'dmg-bonus');
    expect(sig.total).toBe(carried.length);
    expect(sig.findings?.join(' ')).toMatch(/ceiling, not a zero/i);
    // Nothing here is markable, so a hit must never be filed as marked.
    expect(sig.marked).toBe(0);
  });

  it('flags: the legacy vocabulary is counted per flag, not per item', () => {
    const legacy = items.reduce(
      (n, i) => n + (i.fl ?? []).filter((f) => f === 'NO_DROP' || f === 'MAGIC').length,
      0,
    );
    expect(sigOf(report, 'flag-vocab').total).toBe(legacy);
  });

  it('source conflicts: every recorded disagreement is counted and none is marked', () => {
    const disputed = items.reduce((n, i) => n + (i.cf?.length ?? 0), 0);
    const sig = sigOf(report, 'source-conflict');
    expect(sig.total).toBe(disputed);
    expect(sig.marked).toBe(0);
  });
});

/* --------------------------------------------- every signature is complete */

describe.skipIf(!HAVE_SCAN)('every signature is answerable', () => {
  const report = readReport();

  it('publishes at least one signature in each group', () => {
    expect(signaturesIn(report, 'changed').length).toBeGreaterThan(0);
    expect(signaturesIn(report, 'format').length).toBeGreaterThan(0);
  });

  it.each((readReport().signatures ?? []).map((s) => [s.id ?? '(unnamed)', s] as const))(
    '%s says what classic did, what Legends does, what would settle it and how it counted a mark',
    (_id, sig) => {
      for (const field of ['classic', 'legends', 'settle', 'markRule'] as const) {
        expect(sig[field], `${sig.id} has no ${field}`).toBeTruthy();
        expect((sig[field] ?? '').length).toBeGreaterThan(20);
      }
      expect((sig.unmarked ?? 0) + (sig.marked ?? 0)).toBe(sig.total);
      expect(sig.unmarked).toBeGreaterThanOrEqual(0);
      expect(sig.marked).toBeGreaterThanOrEqual(0);
    },
  );

  it('the headline totals are the sum of the signatures beneath them', () => {
    const changed = signaturesIn(report, 'changed');
    const format = signaturesIn(report, 'format');
    const sum = (list: Signature[], key: 'unmarked' | 'marked') =>
      list.reduce((n, s) => n + (s[key] ?? 0), 0);
    expect(report.headline?.unmarkedOnChangedMechanics).toBe(sum(changed, 'unmarked'));
    expect(report.headline?.markedOnChangedMechanics).toBe(sum(changed, 'marked'));
    expect(report.headline?.classicFormats).toBe(sum(format, 'unmarked') + sum(format, 'marked'));
  });
});

/* --------------------------------------------------------------- rendering */

let container: HTMLDivElement;
let root: Root | null = null;

function fileResponse(url: string): Response {
  const path = `public${url.startsWith('/') ? url : `/${url}`}`;
  if (!existsSync(path)) return new Response('not found', { status: 404 });
  return new Response(readFileSync(path, 'utf8'), { status: 200 });
}

async function render(node: React.ReactElement): Promise<string> {
  container = document.createElement('div');
  document.body.appendChild(container);
  await act(async () => {
    root = createRoot(container);
    root.render(node);
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  return container.textContent ?? '';
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => fileResponse(String(input))));
  useApp.setState({ ...emptyState(), hydrated: true, storageStatus: 'ok' });
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  container?.remove();
  vi.unstubAllGlobals();
});

describe('the route exists and resolves', () => {
  it('#/contamination is a route, not a 404', () => {
    expect(parseHash('#/contamination')).toEqual({ name: 'contamination' });
    expect(href.contamination).toBe('#/contamination');
  });

  it('the app renders the page on that route rather than the not-found screen', async () => {
    window.location.hash = '#/contamination';
    const text = await render(<App />);
    expect(text).toContain('What the scanner');
    expect(text).not.toContain('is not a page in this planner');
  });
});

describe.skipIf(!HAVE_SCAN)('the page is honest about us', () => {
  it('opens on the framing, not on a score', async () => {
    const text = await render(<Contamination />);
    expect(text).toContain('A hit is a question, not a verdict.');
    expect(text).toContain('A classic figure carrying a badge is doing its job.');
    expect(text).not.toMatch(/NaN|undefined|\[object Object\]/);
  });

  /*
   * The load-bearing test on this file.
   *
   * The scanner's sharpest finding is against this app: it prints the wiki's
   * HASTE field under "Atk Speed %" and weights it in the ranking, and no
   * surface tells the reader that the unit is disputed. If that finding stops
   * reaching the screen — because the copy was softened, because the signature
   * was dropped, or because the render quietly failed — the page has become the
   * thing it exists to prevent, and this fails.
   *
   * The day the app stops printing a bare classic haste figure, this assertion
   * is rewritten to the new truth rather than deleted.
   */
  it('names its own worst finding, with the label, the weight and the file', async () => {
    const text = await render(<Contamination />);
    expect(text).toContain('haste-pct');
    expect(text).toContain('Atk Speed %');
    expect(text).toContain('weights it in the upgrade ranking');
    expect(text).toContain('web/src/components/StatPanel.tsx');
    expect(text).toContain('web/src/engine/ep.ts');
  });

  it('prints the mark rule beside every count, so the rule can be argued with', async () => {
    const text = await render(<Contamination />);
    expect(text).toContain('Counted as marked when:');
    expect(text).toContain('Unmarked');
    expect(text).toContain('Marked');
  });

  it('states the assumption and invites correction rather than claiming completeness', async () => {
    const text = await render(<Contamination />);
    expect(text).toContain('One assumption, stated.');
    expect(text).toMatch(/credited/i);
  });

  it('refuses to publish a league table of anybody else', async () => {
    const text = await render(<Contamination />);
    expect(text).toMatch(/attack ad/i);
    expect(text).toContain('not on anybody else');
  });

  it('says the shape of its own headline instead of letting one signature stand for all of them', async () => {
    const text = await render(<Contamination />);
    const note = readReport().headline?.note ?? '';
    expect(note.length).toBeGreaterThan(20);
    expect(text).toContain(note);
  });
});

describe('the page says so when there is no scan', () => {
  it('renders an absence rather than blanks or zeroes', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('not found', { status: 404 })));
    const text = await render(<Contamination />);
    expect(text).toContain('No scan was published with this build');
    expect(text).not.toMatch(/NaN|\bundefined\b/);
    // A missing scan must never render as a clean bill of health.
    expect(text).not.toContain('unmarked, on mechanics we know changed');
  });
});
