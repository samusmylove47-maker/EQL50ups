/**
 * The Sources page, and the two promises it makes.
 *
 * Promise one: **every figure is live or transcribed, and the transcriptions
 * are checked.** `PURGE` is copied by hand out of `pipeline/quarantine.json`
 * because that file is 1.1 MB and rightly never ships to a browser. The first
 * block below reads the real file and fails if a single count, reason string or
 * row has drifted, which is what makes the page a citation rather than a
 * recollection.
 *
 * Promise two: **`meta.dataReliability` reaches a screen.** It shipped to every
 * browser and was read by nothing in `web/src`; these tests render the page
 * against the real published `meta.json` and assert the specific uncertainties
 * the sourcing review named — the low-confidence flag vocabulary, both
 * client-verified contradictions, the four Monk fist-weapon suspects, the
 * absent damage bonus and the sparse item ids — are on it, in words.
 */

import { existsSync, readFileSync } from 'node:fs';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { CatalogFootnote } from '../components/DataBanner';
import { useCatalog } from '../data/catalog';
import { parseHash, href } from '../router';
import { emptyState } from '../state/persistence';
import { useApp } from '../state/store';
import { Landing } from './Landing';
import { Sources } from './Sources';
import { PURGE } from './sourcesData';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const QUARANTINE = '../pipeline/quarantine.json';
const META = 'public/data/meta.json';

interface QuarantineReport {
  counts?: {
    before?: number;
    shipped?: number;
    quarantined?: number;
    shipReasons?: Record<string, number>;
    quarantineReasons?: Record<string, number>;
  };
}

/* -------------------------------------------------- the transcribed figures */

describe.skipIf(!existsSync(QUARANTINE))('the era purge on the page matches the pipeline report', () => {
  const report = JSON.parse(readFileSync(QUARANTINE, 'utf8')) as QuarantineReport;
  const counts = report.counts ?? {};

  it('totals are the pipeline’s own', () => {
    expect(PURGE.before).toBe(counts.before);
    expect(PURGE.shipped).toBe(counts.shipped);
    expect(PURGE.quarantined).toBe(counts.quarantined);
    // Stated on the page as a subtraction; it has to be one.
    expect(PURGE.shipped + PURGE.quarantined).toBe(PURGE.before);
  });

  it('every ship reason is transcribed, with nothing added or dropped', () => {
    expect(Object.fromEntries(PURGE.shipReasons.map((r) => [r.reason, r.items]))).toEqual(
      counts.shipReasons,
    );
    const total = PURGE.shipReasons.reduce((sum, row) => sum + row.items, 0);
    expect(total).toBe(PURGE.shipped);
  });

  it('every quarantine reason is transcribed, with nothing added or dropped', () => {
    expect(Object.fromEntries(PURGE.quarantineReasons.map((r) => [r.reason, r.items]))).toEqual(
      counts.quarantineReasons,
    );
    const total = PURGE.quarantineReasons.reduce((sum, row) => sum + row.items, 0);
    expect(total).toBe(PURGE.quarantined);
  });

  it('the reasons are ordered largest first, as the page prints them', () => {
    for (const rows of [PURGE.shipReasons, PURGE.quarantineReasons]) {
      const sorted = [...rows].sort((a, b) => b.items - a.items).map((r) => r.reason);
      expect(rows.map((r) => r.reason)).toEqual(sorted);
    }
  });
});

describe.skipIf(!existsSync(META))('the transcribed ship count agrees with the published catalog', () => {
  it('matches meta.counts.items', () => {
    const meta = JSON.parse(readFileSync(META, 'utf8')) as { counts?: { items?: number } };
    expect(PURGE.shipped).toBe(meta.counts?.items);
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
  // Let the metadata fetch land.
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

describe.skipIf(!existsSync(META))('the page renders the shipped provenance metadata', () => {
  it('names the hierarchy it is held to, tier by tier', async () => {
    const text = await render(<Sources />);
    for (const tier of ['Tier M', 'Tier 1', 'Tier 2', 'Tier 3', 'Tier 4', 'Tier 5']) {
      expect(text).toContain(tier);
    }
    expect(text).toContain('Our own client output');
    expect(text).toContain('Marked on sight');
    expect(text).not.toMatch(/NaN|undefined|\[object Object\]/);
  });

  it('prints the era purge with its per-reason breakdown', async () => {
    const text = await render(<Sources />);
    expect(text).toContain('11,252');
    expect(text).toContain('3,533');
    expect(text).toContain('7,719');
    // The three biggest quarantine reasons, by name and by number.
    expect(text).toContain('era:Velious');
    expect(text).toContain('2,828');
    expect(text).toContain('no era in any source');
    expect(text).toContain('2,331');
    expect(text).toContain('era:Kunark');
    expect(text).toContain('1,457');
    expect(text).toContain('pipeline/quarantine.json');
  });

  it('renders the standing vocabulary and its counts from meta', async () => {
    const text = await render(<Sources />);
    expect(text).toContain('tier-M');
    expect(text).toContain('tier-2');
    expect(text).toContain('tier-5');
    expect(text).toContain('unattributed');
    expect(text).toContain('live-export');
    // Existence and stat provenance are two facts; the page has to say so.
    expect(text).toMatch(/two facts, not one/i);
  });

  it('surfaces the low-confidence flag vocabulary, which nothing in the app showed before', async () => {
    const text = await render(<Sources />);
    expect(text).toMatch(/do not use as an authoritative filter/i);
    // The page-convention split that makes the vocabulary untrustworthy.
    expect(text).toContain('NO_DROP');
    expect(text).toContain('3,355');
    // Both client-verified contradictions, with what the client actually shows.
    expect(text).toContain('Earthshaker');
    expect(text).toContain('Lore Equipped');
    expect(text).toContain('Whitened Treant Fists');
  });

  it('says what the Hide No Drop checkbox really filters on', async () => {
    const text = await render(<Sources />);
    expect(text).toContain('Hide No Drop');
    expect(text).toMatch(/filters by which convention wrote the page/i);
  });

  it('names the Monk fist-weapon suspects rather than silently correcting them', async () => {
    const text = await render(<Sources />);
    expect(text).toContain("Wu's Fist of Mastery");
    expect(text).toContain('Brass Knuckles');
    expect(text).toMatch(/Hand to Hand/);
    expect(text).toMatch(/every weapon ships with the skill its source gives it/i);
  });

  it('states the absent damage bonus, the sparse ids and the withheld stat blocks', async () => {
    const text = await render(<Sources />);
    expect(text).toMatch(/Dmg Bon/);
    expect(text).toContain('Shadow Rage Helm');
    expect(text).toMatch(/289 of 3533|289 of 3,533/);
  });

  it('credits the upstream repositories, pinned, and the licence', async () => {
    const text = await render(<Sources />);
    expect(text).toContain('Thiole/EQLGearPlanner');
    expect(text).toContain('jmoyers/everquest-companion');
    expect(text).toContain('CC BY-SA 4.0');
  });
});

describe('the page degrades honestly when the catalog publishes nothing', () => {
  it('says the live figures are absent and still prints what is transcribed', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('not found', { status: 404 })));
    const text = await render(<Sources />);
    expect(text).toMatch(/published no/i);
    expect(text).toContain('11,252');
    expect(text).toContain('Tier M');
    expect(text).not.toMatch(/NaN|undefined|\[object Object\]/);
  });

  it('reports a failed fetch rather than rendering an empty page', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      }),
    );
    const text = await render(<Sources />);
    expect(text).toContain('offline');
    expect(text).toContain('Tier M');
  });
});

/* ------------------------------------------------------------ reaching it */

describe('the route exists and the app reaches it', () => {
  it('parses #/sources', () => {
    expect(parseHash('#/sources')).toEqual({ name: 'sources' });
    expect(href.sources).toBe('#/sources');
  });

  it('renders at that hash inside the app shell', async () => {
    window.location.hash = '#/sources';
    const text = await render(<App />);
    expect(text).toContain('Sources');
    expect(text).toMatch(/Data provenance/i);
  });

  it('the catalog footnote links to it from every screen', async () => {
    useCatalog.getState().loadFixture();
    await render(<CatalogFootnote />);
    const link = container.querySelector('a');
    expect(link?.getAttribute('href')).toBe('#/sources');
    expect(link?.textContent).toMatch(/sources/i);
  });
});

/* --------------------------------------------- the landing page's own claim */

describe('the landing page cites the evidence it actually has', () => {
  it('no longer calls the client-verified sample wiki-verified', async () => {
    useCatalog.getState().loadFixture();
    const text = await render(<Landing />);
    expect(text).not.toMatch(/wiki-verified/i);
  });

  it('states the Tier M receipt beside the hero item window', async () => {
    useCatalog.getState().loadFixture();
    const text = await render(<Landing />);
    expect(text).toMatch(/nine of nine predictions exact/i);
    expect(text).toMatch(/read\s+off a live client/i);
  });

  it('marks the one field on that window a live client contradicts', async () => {
    useCatalog.getState().loadFixture();
    const text = await render(<Landing />);
    expect(text).toMatch(/flag line is the one part a client contradicts/i);
  });

  it('offers a way to the sources page', async () => {
    useCatalog.getState().loadFixture();
    await render(<Landing />);
    const links = [...container.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(links).toContain('#/sources');
  });
});
