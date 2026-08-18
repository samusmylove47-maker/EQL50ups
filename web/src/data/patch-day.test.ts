/**
 * Patch day, tested before the patch.
 *
 * EverQuest Legends is an actively patched game, and the case this file pins
 * down is the one that arrives every time it patches: **an item that exists in
 * the game and in no catalog anywhere.** A revamped dungeon lands, a mob drops
 * something, a log records it, and the wiki has nothing — no slot, no class, no
 * stats, not even a page. Until now such an item could only reach the planner by
 * somebody typing it into a table in `pipeline/build.mjs`; the six Shadow Rage
 * records are what that looked like.
 *
 * The rule is now general, and these are its terms:
 *
 *   1. Tier M evidence — a measured drop, an ID table entry, a client export
 *      line — admits the item automatically, with no code change.
 *   2. It ships carrying only what was observed. No slot, no class, no era, no
 *      stats. The name of a helm makes its slot obvious; obvious is not observed.
 *   3. It is never ranked, never auto-filled, never scored against a zero
 *      nobody measured.
 *   4. It says why it is there, in a string a reader can check.
 *
 * The diff engine that feeds it — `pipeline/refresh.mjs` — is exercised in the
 * second half against a simulated Castle Mistmoore patch, because a tool nobody
 * has run against a change is a tool nobody has tested.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Item } from '../engine/types';
import { tier } from '../engine/upgrade';
import { rankSlotItems, unstattedForSlot } from '../selectors/gear';
import type { CatalogState } from './catalog';
import { normalizeCatalog, normalizeItem, statsAreUnknown, type SlotCode } from './normalize';

const INDEX_PATH = 'public/data/items-index.json';
const META_PATH = 'public/data/meta.json';
const OTHER_PATH = 'public/data/items/OTHER.json';
const published = existsSync(INDEX_PATH) && existsSync(META_PATH);

/** The raw index rows, not the normalised items: `xo` is a pipeline field. */
interface RawItem {
  n: string;
  id?: number | null;
  sl?: string[];
  cl?: string[];
  era?: string | null;
  eraUnknown?: boolean;
  statsUnknown?: boolean;
  evidence?: string;
  ex?: string;
  sd?: string;
  an?: number;
  st?: Record<string, number>;
  sv?: Record<string, number>;
  wp?: unknown;
  xo?: boolean;
}

const rawItems: RawItem[] = published
  ? (JSON.parse(readFileSync(INDEX_PATH, 'utf8')).items as RawItem[])
  : [];
const meta = published ? JSON.parse(readFileSync(META_PATH, 'utf8')) : null;
const existenceOnly = rawItems.filter((i) => i.xo === true);

function fakeCatalog(items: Item[]): CatalogState {
  const byName = new Map<string, Item>();
  const bySlot = new Map<SlotCode, Item[]>();
  for (const item of items) {
    byName.set(item.n.toLowerCase(), item);
    for (const slot of item.sl) {
      const bucket = bySlot.get(slot as SlotCode);
      if (bucket) bucket.push(item);
      else bySlot.set(slot as SlotCode, [item]);
    }
  }
  return {
    status: 'ready',
    error: null,
    meta: null,
    items,
    byName,
    bySlot,
    shards: {},
    indexNames: items.map((i) => i.n),
    effects: new Map(),
    effectsStatus: 'idle',
    ensureEffects: async () => undefined,
    usingFixture: false,
    revision: 1,
    load: async () => undefined,
    ensureSlot: async () => undefined,
    ensureAll: async () => undefined,
    loadFixture: () => undefined,
  };
}

describe.skipIf(!published)('an item the game has and no catalog describes', () => {
  it('ships at all, which is the whole point', () => {
    expect(existenceOnly.length).toBeGreaterThan(0);
    expect(meta.dataReliability?.existenceOnly?.count).toBe(existenceOnly.length);
    expect(meta.dataReliability?.existenceOnly?.marker).toBe('xo');
  });

  it('carries only what was observed, and says so about the rest', () => {
    for (const item of existenceOnly) {
      expect(item.statsUnknown, `${item.n} statsUnknown`).toBe(true);
      expect(item.eraUnknown, `${item.n} eraUnknown`).toBe(true);
      // Nothing observed a slot, a class or an era, so nothing claims one.
      expect(item.sl ?? [], `${item.n} slots`).toEqual([]);
      expect(item.cl ?? [], `${item.n} classes`).toEqual([]);
      expect(item.era ?? null, `${item.n} era`).toBeNull();
      expect(item.an, `${item.n} any-slot eligibility`).toBeUndefined();
      // And no numbers at all — an absent stat here is missing, not zero.
      expect(Object.keys(item.st ?? {}), `${item.n} stats`).toEqual([]);
      expect(Object.keys(item.sv ?? {}), `${item.n} saves`).toEqual([]);
      expect(item.wp, `${item.n} weapon block`).toBeUndefined();
    }
  });

  it('names the evidence that proved it, file by file', () => {
    for (const item of existenceOnly) {
      const evidence = item.evidence ?? '';
      expect(evidence.length, `${item.n} evidence`).toBeGreaterThan(40);
      // The claim is checkable: it names the file the proof is in.
      expect(
        /sightings\.v1\.json|items\.v1\.json|tier0-inventory-Avenrae\.txt/.test(evidence),
        `${item.n} evidence names no source file: ${evidence}`,
      ).toBe(true);
      // Tier M existence, stated separately from any claim about numbers.
      expect(['measured-drop', 'live-export', 'eqlsource-id'], `${item.n} existence`)
        .toContain(item.ex);
      expect(item.sd, `${item.n} standing`).toBe('unattributed');
    }
  });

  it('is withheld from ranking, in the selector every surface goes through', () => {
    const items = normalizeCatalog({ items: rawItems });
    const catalog = fakeCatalog(items);
    const names = new Set(existenceOnly.map((i) => i.n));
    const SLOTS: SlotCode[] = [
      'HEAD', 'CHEST', 'ARMS', 'HANDS', 'LEGS', 'FEET', 'PRIMARY', 'SECONDARY',
      'FINGERS', 'NECK', 'BACK', 'WRIST', 'SHOULDERS', 'WAIST', 'EAR', 'FACE', 'RANGE',
    ];
    for (const slot of SLOTS) {
      const ranked = rankSlotItems(catalog, {
        slot,
        weights: { AC: 1, HP: 1, STR: 1 },
        upgrade: tier(0),
        context: undefined,
      });
      const leaked = ranked.filter((row) => names.has(row.item.n)).map((row) => row.item.n);
      expect(leaked, `${slot} ranked an item nothing has measured`).toEqual([]);
    }
  });

  it('would still be withheld if a future record did carry a slot', () => {
    /*
     * Belt and braces, and deliberately so. Today an existence-only record has
     * no slot and therefore cannot reach a slot ranking at all. If a later
     * source supplies a slot but still no stats — an entirely plausible next
     * step for a new Mistmoore drop — the refusal has to hold on the
     * `statsUnknown` marker alone, because that is the one that says "nothing
     * measured this".
     */
    const unmeasured = normalizeItem({
      n: 'Mistmoore Simulation Helm',
      sl: ['HEAD'],
      cl: ['ALL'],
      statsUnknown: true,
      evidence: 'simulated',
    })!;
    const measured = normalizeItem({
      n: 'Ordinary Helm', sl: ['HEAD'], cl: ['ALL'], st: { AC: 10 },
    })!;
    const catalog = fakeCatalog([unmeasured, measured]);
    const ranked = rankSlotItems(catalog, {
      slot: 'HEAD', weights: { AC: 1 }, upgrade: tier(0), context: undefined,
    });
    expect(ranked.map((r) => r.item.n)).toEqual(['Ordinary Helm']);
    expect(statsAreUnknown(unmeasured)).toBe(true);
    // Held back, not hidden: the surface can still say it is holding one.
    expect(unstattedForSlot(catalog, 'HEAD', undefined).map((i) => i.n))
      .toEqual(['Mistmoore Simulation Helm']);
  });

  it('reconciles with the era purge rather than contradicting it', () => {
    // These records were never in the wiki scrape, so they were never candidates
    // for the purge. Both numbers are published and they have to add up.
    const purge = meta.counts.purge;
    expect(purge.admittedOutsideScrape).toBe(existenceOnly.length);
    expect(purge.shipped + purge.admittedOutsideScrape).toBe(meta.counts.items);
  });
});

describe.skipIf(!published)('a drop source says how well its zone is known', () => {
  const zones = meta?.zones;

  it('publishes the surveys, derived from the coverage facets', () => {
    expect(zones?.surveyed?.length).toBeGreaterThan(0);
    for (const z of zones.surveyed) {
      const levels: string[] = Object.values(z.coverage ?? {});
      const measured = levels.filter((l) => l === 'measured').length;
      expect(z.measured, `${z.title} measured facets`).toBe(measured);
      expect(z.facets, `${z.title} facet count`).toBe(levels.length);
      const expected = !levels.length
        ? 'unstated'
        : measured === levels.length
          ? 'measured'
          : levels.every((l) => l === 'none')
            ? 'none'
            : 'partial';
      expect(z.survey, `${z.title} survey grade`).toBe(expected);
    }
  });

  it('never lets "verified" stand in for "complete"', () => {
    /*
     * The publisher's own note: "Verified means checked against source. It does
     * not mean complete." Castle Mistmoore is the case that matters tomorrow —
     * it is verify_level `full` and three of its five facets are measured, so a
     * page that printed the verify level alone would tell a reader the zone is
     * understood.
     */
    const mistmoore = zones.surveyed.find((z: { slug: string }) => z.slug === 'mistmoore');
    expect(mistmoore, 'Castle Mistmoore is not in the published surveys').toBeTruthy();
    expect(mistmoore.verify).toBe('full');
    expect(mistmoore.survey).toBe('partial');
    expect(mistmoore.measured).toBeLessThan(mistmoore.facets);
    expect(zones.principle).toMatch(/does not mean complete/i);
  });

  it('attaches the survey to the drop rows that name the zone', () => {
    const other = existsSync(OTHER_PATH)
      ? (JSON.parse(readFileSync(OTHER_PATH, 'utf8')).items as Array<{
          n: string;
          ms?: Array<{ zones?: string[]; zs?: Array<{ zone: string; slug: string; survey: string }> }>;
        }>)
      : [];
    const cauldron = other.find((i) => i.n === 'A Dark Cauldron');
    expect(cauldron?.ms?.[0]?.zones).toContain('The Castle of Mistmoore');
    const survey = cauldron?.ms?.[0]?.zs?.[0];
    expect(survey?.slug).toBe('mistmoore');
    expect(survey?.survey).toBe('partial');
  });

  it('shows a zone with no survey as nothing, never as a zero', () => {
    // The log names zones the survey has not reached. They are listed by name
    // and carry no grade at all — a blank on the source is shown as nothing.
    expect(Array.isArray(zones.unsurveyed)).toBe(true);
    const slugs = new Set(zones.surveyed.map((z: { title: string }) => z.title));
    for (const name of zones.unsurveyed) {
      expect(typeof name).toBe('string');
      expect(slugs.has(name), `${name} is both surveyed and unsurveyed`).toBe(false);
    }
  });

  it('states which upstream snapshot it was built from', () => {
    const datasets = meta.upstream?.datasets ?? [];
    expect(datasets.map((d: { file: string }) => d.file).sort()).toEqual([
      'items.v1.json', 'sightings.v1.json', 'sky.v1.json', 'zones.v1.json',
    ]);
    for (const d of datasets) {
      expect(typeof d.version, `${d.file} version`).toBe('string');
      expect(typeof d.hash, `${d.file} hash`).toBe('string');
    }
  });
});

/* ------------------------------------------------------------ refresh.mjs */

interface RefreshModule {
  diffItems: (a: unknown, b: unknown) => {
    added: Array<{ name: string; id: number }>;
    removed: Array<{ name: string; id: number }>;
    idChanged: Array<{ name: string; from: number; to: number }>;
  };
  diffSightings: (a: unknown, b: unknown) => {
    itemsAdded: string[];
    rowsAdded: Array<{ item: string; mob: string; seen: number }>;
    mobsAdded: string[];
    zonesAdded: string[];
    seenChanged: Array<{ item: string; seenFrom: number; seenTo: number }>;
  };
  diffZones: (a: unknown, b: unknown) => {
    added: Array<{ slug: string }>;
    changed: Array<{ slug: string; fields: Array<{ field: string; from: unknown; to: unknown }> }>;
  };
  projectAdmissions: (
    items: unknown, sightings: unknown, index: unknown,
  ) => { existenceOnly: Array<{ name: string; why: string[] }>; upgradedExistence: string[] } | null;
  validateDataset: (
    kind: string, doc: unknown, previous: unknown,
  ) => { problems: string[]; warnings: string[] };
  zoneTokens: (name: string) => string;
  unsurveyedZones: (sightings: unknown, zones: unknown) => string[];
  isEmptyDiff: (diff: unknown) => boolean;
  diffAll: (a: unknown, b: unknown) => unknown;
}

/*
 * Loaded by path rather than by specifier: this is a pipeline script, not app
 * code, and the app must not be able to import it by accident. Vitest runs with
 * `web/` as the working directory — the same assumption the payload paths above
 * make.
 */
const refresh = (await import(
  pathToFileURL(resolve(process.cwd(), '..', 'pipeline', 'refresh.mjs')).href
)) as unknown as RefreshModule;

/**
 * Tomorrow, in miniature.
 *
 * Castle Mistmoore is revamped; a boss nobody has logged before drops an item
 * nobody has a page for; the zone survey moves. Every number below is invented
 * *as a fixture* — none of it is asserted about the real game, and none of it
 * touches the vendored files.
 */
const BEFORE_ITEMS = { items: { 'Cloak of Flames': 11621, 'Bladestopper': 11632 } };
const AFTER_ITEMS = {
  items: { 'Cloak of Flames': 11621, 'Bladestopper': 11632, 'Mistmoore Simulation Blade': 90001 },
};
const BEFORE_SIGHT = {
  items: {
    'Cloak of Flames': [
      { mob: 'a gargoyle', seen: 2, sessions: [{ date: '01 Aug 2026', zone: 'The Castle of Mistmoore' }] },
    ],
  },
};
const AFTER_SIGHT = {
  items: {
    'Cloak of Flames': [
      { mob: 'a gargoyle', seen: 5, sessions: [{ date: '01 Aug 2026', zone: 'The Castle of Mistmoore' }] },
    ],
    'Mistmoore Simulation Blade': [
      {
        mob: 'Mayong Mistmoore',
        seen: 1,
        off_roster: true,
        sessions: [{ date: '19 Aug 2026', zone: 'The Castle of Mistmoore - Group', difficulty: 2 }],
      },
    ],
  },
};
const BEFORE_ZONES = {
  zones: [{
    slug: 'mistmoore', title: 'Castle Mistmoore', verify_level: 'full', coverage_score: 8,
    coverage: { bosses: { level: 'sourced' }, loot: { level: 'measured' } },
  }],
};
const AFTER_ZONES = {
  zones: [
    {
      slug: 'mistmoore', title: 'Castle Mistmoore', verify_level: 'full', coverage_score: 9,
      coverage: { bosses: { level: 'measured' }, loot: { level: 'measured' } },
    },
    {
      slug: 'mistmoore-revamp', title: 'Castle Mistmoore (Revamped)', verify_level: 'none',
      coverage_score: 2, coverage: { bosses: { level: 'none' }, loot: { level: 'sourced' } },
    },
  ],
};

describe('the refresh script reports a patch before anything is rebuilt', () => {
  it('names the new item, and does not confuse it with a moved ID', () => {
    const d = refresh.diffItems(BEFORE_ITEMS, AFTER_ITEMS);
    expect(d.added).toEqual([{ name: 'Mistmoore Simulation Blade', id: 90001 }]);
    expect(d.removed).toEqual([]);
    expect(d.idChanged).toEqual([]);

    // A moved ID is a different fact and gets its own line: the ID is the join
    // key across the +N tiers, so one moving is never routine.
    const moved = refresh.diffItems(BEFORE_ITEMS, {
      items: { ...BEFORE_ITEMS.items, Bladestopper: 99999 },
    });
    expect(moved.idChanged).toEqual([{ name: 'Bladestopper', from: 11632, to: 99999 }]);
    expect(moved.added).toEqual([]);
  });

  it('names the new drop, the new mob and the changed count', () => {
    const d = refresh.diffSightings(BEFORE_SIGHT, AFTER_SIGHT);
    expect(d.itemsAdded).toEqual(['Mistmoore Simulation Blade']);
    expect(d.rowsAdded).toHaveLength(1);
    expect(d.rowsAdded[0]).toMatchObject({
      item: 'Mistmoore Simulation Blade', mob: 'Mayong Mistmoore', seen: 1,
    });
    expect(d.mobsAdded).toEqual(['Mayong Mistmoore']);
    expect(d.zonesAdded).toEqual(['The Castle of Mistmoore - Group']);
    // A count that moved is reported as a count, never as a rate.
    expect(d.seenChanged).toEqual([
      expect.objectContaining({ item: 'Cloak of Flames', seenFrom: 2, seenTo: 5 }),
    ]);
  });

  it('names a new zone and a coverage facet that changed grade', () => {
    const d = refresh.diffZones(BEFORE_ZONES, AFTER_ZONES);
    expect(d.added.map((z) => z.slug)).toEqual(['mistmoore-revamp']);
    expect(d.changed).toHaveLength(1);
    expect(d.changed[0]!.fields).toEqual(
      expect.arrayContaining([
        { field: 'coverage_score', from: 8, to: 9 },
        { field: 'coverage.bosses', from: 'sourced', to: 'measured' },
      ]),
    );
  });

  it('says what a rebuild would admit, before the rebuild', () => {
    const index = [{ n: 'Cloak of Flames', ex: 'live-export' }, { n: 'Bladestopper', ex: 'live-export' }];
    const projection = refresh.projectAdmissions(AFTER_ITEMS, AFTER_SIGHT, index)!;
    expect(projection.existenceOnly.map((x) => x.name)).toEqual(['Mistmoore Simulation Blade']);
    expect(projection.existenceOnly[0]!.why.join(' ')).toMatch(/measured dropping/);
    // And an item already in the catalog whose evidence just got stronger is
    // reported separately, because nothing new ships for it.
    expect(projection.upgradedExistence).toEqual(['Cloak of Flames']);
  });

  it('matches a session zone to its survey without guessing at one', () => {
    // The two files spell the same zone differently, and the difficulty suffix
    // is not part of the name.
    expect(refresh.zoneTokens('The Castle of Mistmoore - Group')).toBe(
      refresh.zoneTokens('Castle Mistmoore'),
    );
    expect(refresh.zoneTokens('The Ruins of Old Guk')).not.toBe(refresh.zoneTokens('Lower Guk'));
    // A zone nothing surveyed is named, not attached to the nearest match.
    expect(refresh.unsurveyedZones(
      { items: { X: [{ mob: 'm', sessions: [{ zone: 'The Ruins of Old Guk' }] }] } },
      AFTER_ZONES,
    )).toEqual(['The Ruins of Old Guk']);
  });

  it('refuses a file that is not the dataset it claims to be', () => {
    const bad = refresh.validateDataset('items', { version: '1.0.0', hash: 'x', data: { items: [] } }, null);
    expect(bad.problems.length).toBeGreaterThan(0);

    const noHash = refresh.validateDataset('items', { version: '1.0.0', data: { items: {} } }, null);
    expect(noHash.problems.join(' ')).toMatch(/hash/);

    const negative = refresh.validateDataset(
      'items', { version: '1.0.0', hash: 'x', data: { items: { Thing: -3 } } }, null,
    );
    expect(negative.problems.join(' ')).toMatch(/positive integer/);
  });

  it('warns rather than silently accepting a collapse in row count', () => {
    const shrunk = refresh.validateDataset(
      'items',
      { version: '1.0.0', hash: 'x', data: { items: { 'Cloak of Flames': 11621 } } },
      { items: { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, h: 8, i: 9, j: 10 } },
    );
    expect(shrunk.problems).toEqual([]);
    expect(shrunk.warnings.join(' ')).toMatch(/row count fell from 10 to 1/);
  });

  it('reports no change as no change, so a quiet day is quiet', () => {
    const same = refresh.diffAll(
      { items: { data: BEFORE_ITEMS }, sightings: { data: BEFORE_SIGHT }, zones: { data: BEFORE_ZONES } },
      { items: { data: BEFORE_ITEMS }, sightings: { data: BEFORE_SIGHT }, zones: { data: BEFORE_ZONES } },
    );
    expect(refresh.isEmptyDiff(same)).toBe(true);
    const moved = refresh.diffAll(
      { items: { data: BEFORE_ITEMS }, sightings: { data: BEFORE_SIGHT }, zones: { data: BEFORE_ZONES } },
      { items: { data: AFTER_ITEMS }, sightings: { data: AFTER_SIGHT }, zones: { data: AFTER_ZONES } },
    );
    expect(refresh.isEmptyDiff(moved)).toBe(false);
  });
});
