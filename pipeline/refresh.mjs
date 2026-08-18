#!/usr/bin/env node
/**
 * refresh.mjs — the patch-day path for EQL Source's published datasets.
 *
 * `https://eqlsource.com/data/` publishes four versioned, CORS-open datasets.
 * This repository vendors all four under `pipeline/sources/eqlsource/` so that a
 * build is reproducible and an upstream change shows up as a diff rather than as
 * a silent shift under the catalog. Until now those files were fetched by hand,
 * which is fine on a quiet day and useless on a patch day.
 *
 * This script does the four things a patch-day operator actually needs:
 *
 *   1. Re-fetch the four datasets (or read a directory the owner handed over).
 *   2. Record what was published: the publisher's own `hash`, its `version`,
 *      the byte length, and our own SHA-256 of the exact bytes.
 *   3. Diff the candidate against what is vendored, in the terms that matter —
 *      items added and removed, item IDs that moved, new sightings, new mobs,
 *      new zones, coverage facets that changed grade.
 *   4. Say what a rebuild would newly admit to the catalog, BEFORE the rebuild.
 *
 * Nothing is written without `--apply`. The default run is a read-only report,
 * because the first question on a patch day is "what changed", not "please
 * change it".
 *
 * USAGE
 *   node pipeline/refresh.mjs                 fetch, diff, write nothing
 *   node pipeline/refresh.mjs --apply         ... and vendor what validated
 *   node pipeline/refresh.mjs --from DIR      diff a local drop instead of fetching
 *   node pipeline/refresh.mjs --check         exit 1 if anything differs
 *   node pipeline/refresh.mjs --json          machine-readable diff on stdout
 *   node pipeline/refresh.mjs --only items,zones
 *   node pipeline/refresh.mjs --force         apply even when a guard fired
 *
 * EXIT CODES
 *   0  ran, and (under --check) nothing differs
 *   1  differences found under --check, or a guard refused an --apply
 *   2  could not fetch or could not parse; nothing was written
 */

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const VENDOR = join(ROOT, 'pipeline', 'sources', 'eqlsource');
const MANIFEST = join(VENDOR, 'manifest.json');
const INDEX = join(ROOT, 'web', 'public', 'data', 'items-index.json');

const BASE_URL = 'https://eqlsource.com/data/';

/**
 * The four datasets, and what each one is for here.
 *
 * `role` is the honest scope of what this repository takes from the file, not a
 * summary of the file. `sky.v1.json` is vendored and diffed and used by nothing
 * in the build yet; saying so is cheaper than a reader discovering it.
 */
export const DATASETS = [
  {
    file: 'items.v1.json',
    kind: 'items',
    title: 'Item name to game ID',
    role: 'Tier M existence evidence, and the join key. An item named here is in the game.',
  },
  {
    file: 'sightings.v1.json',
    kind: 'sightings',
    title: 'Measured drop sources',
    role: 'Tier M existence evidence and the drop rows shown on an item. A COUNT, never a rate.',
  },
  {
    file: 'zones.v1.json',
    kind: 'zones',
    title: 'Surveyed dungeons',
    role: 'How far the survey behind a drop source has got, so a partial one cannot read as complete.',
  },
  {
    file: 'sky.v1.json',
    kind: 'sky',
    title: 'Plane of Sky class unlocks',
    role: 'Vendored and diffed; not read by the build yet. Kept in step so it is here when it is wanted.',
  },
];

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const nameKey = (s) =>
  String(s ?? '')
    .normalize('NFKC')
    .replace(/[`´’‘ʼ]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

/** Sort helper that keeps reports stable between runs. */
const alpha = (a, b) => String(a).localeCompare(String(b));

function readJsonFile(path) {
  const text = readFileSync(path, 'utf8');
  // `text` is returned, not just the parsed document: `--apply` vendors the
  // exact bytes it validated. Re-serialising the parse would put a file on disk
  // that no `sha256` in the manifest describes.
  return { text, doc: JSON.parse(text), bytes: Buffer.byteLength(text), sha256: sha256(text) };
}

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

/**
 * Node's built-in `fetch` ignores `HTTPS_PROXY` unless `NODE_USE_ENV_PROXY` was
 * set before the process started, and the flag cannot be turned on from inside
 * the process. Where a proxy is configured and the flag is not, re-exec once
 * with it set. On an ordinary machine — no proxy — nothing happens here at all.
 */
function reexecForProxy(argv) {
  const proxied = process.env.HTTPS_PROXY || process.env.https_proxy;
  if (!proxied || process.env.NODE_USE_ENV_PROXY) return false;
  const res = spawnSync(process.execPath, ['--no-warnings', fileURLToPath(import.meta.url), ...argv], {
    stdio: 'inherit',
    env: { ...process.env, NODE_USE_ENV_PROXY: '1' },
  });
  process.exit(res.status ?? 2);
}

/**
 * Fetch one dataset.
 *
 * A failure is returned, never thrown: on a patch day one dataset being
 * unreachable must not stop the operator seeing the other three.
 */
async function fetchDataset(file, { timeoutMs = 20000 } = {}) {
  const url = BASE_URL + file;
  const control = new AbortController();
  const timer = setTimeout(() => control.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: control.signal, redirect: 'follow' });
    if (!res.ok) return { ok: false, url, error: `HTTP ${res.status} ${res.statusText}` };
    const text = await res.text();
    let doc;
    try {
      doc = JSON.parse(text);
    } catch (err) {
      return { ok: false, url, error: `not JSON: ${err.message}` };
    }
    return {
      ok: true,
      url,
      text,
      doc,
      bytes: Buffer.byteLength(text),
      sha256: sha256(text),
      etag: res.headers.get('etag'),
      lastModified: res.headers.get('last-modified'),
    };
  } catch (err) {
    return { ok: false, url, error: err.name === 'AbortError' ? `timed out after ${timeoutMs}ms` : err.message };
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Validation — a candidate has to look like the thing it claims to be
// ---------------------------------------------------------------------------

/**
 * Refuse to vendor a file that would quietly empty the catalog.
 *
 * Every check here is a shape check, not a content check: this script is not
 * entitled to an opinion about whether a number upstream is right. It is
 * entitled to refuse a file that is not the dataset it says it is, and to refuse
 * one that has lost most of its rows, because both of those break a build in a
 * way that is very hard to see afterwards.
 */
export function validateDataset(kind, doc, previous) {
  const problems = [];
  const warnings = [];
  if (!doc || typeof doc !== 'object') return { problems: ['not an object'], warnings };
  if (typeof doc.version !== 'string') problems.push('no `version` string');
  if (typeof doc.hash !== 'string' || !doc.hash) problems.push('no `hash` string');
  const data = doc.data;
  if (!data || typeof data !== 'object') problems.push('no `data` object');

  const countOf = (d) => {
    if (!d || typeof d !== 'object') return 0;
    if (kind === 'items' || kind === 'sightings') return Object.keys(d.items ?? {}).length;
    if (kind === 'zones') return (d.zones ?? []).length;
    return Object.keys(d.classes ?? {}).length;
  };

  if (kind === 'items') {
    const items = data?.items;
    if (!items || typeof items !== 'object' || Array.isArray(items)) problems.push('`data.items` is not a name->id map');
    else {
      const bad = Object.entries(items).filter(([n, id]) => !n.trim() || !Number.isInteger(id) || id <= 0);
      if (bad.length) problems.push(`${bad.length} entries are not name->positive integer (e.g. ${bad[0][0]})`);
    }
  } else if (kind === 'sightings') {
    const items = data?.items;
    if (!items || typeof items !== 'object' || Array.isArray(items)) problems.push('`data.items` is not a name->rows map');
    else {
      const bad = Object.entries(items).filter(([, rows]) => !Array.isArray(rows));
      if (bad.length) problems.push(`${bad.length} entries do not carry an array of rows (e.g. ${bad[0][0]})`);
    }
  } else if (kind === 'zones') {
    const zones = data?.zones;
    if (!Array.isArray(zones)) problems.push('`data.zones` is not an array');
    else {
      const bad = zones.filter((z) => !z || typeof z.slug !== 'string' || typeof z.title !== 'string');
      if (bad.length) problems.push(`${bad.length} zones have no slug/title`);
    }
  } else if (kind === 'sky') {
    if (!data?.classes || typeof data.classes !== 'object') problems.push('`data.classes` is missing');
  }

  /*
   * The shrink guard. Upstream is a live fan project and a bad publish is a
   * real possibility; losing 60% of the rows on the morning of a patch, into a
   * build nobody has time to read, is the specific accident worth a guard.
   * It warns rather than blocks, and `--apply` refuses on a warning unless
   * `--force` is given, so the operator makes the call with the number in front
   * of them.
   */
  const before = countOf(previous);
  const after = countOf(data);
  if (before > 0 && after < before * 0.6) {
    warnings.push(`row count fell from ${before} to ${after} (${Math.round((after / before) * 100)}% of the vendored file)`);
  }
  return { problems, warnings, count: after };
}

// ---------------------------------------------------------------------------
// The diffs
// ---------------------------------------------------------------------------

export function diffItems(before, after) {
  const b = before?.items ?? {};
  const a = after?.items ?? {};
  const added = Object.keys(a).filter((n) => !(n in b)).sort(alpha).map((n) => ({ name: n, id: a[n] }));
  const removed = Object.keys(b).filter((n) => !(n in a)).sort(alpha).map((n) => ({ name: n, id: b[n] }));
  const idChanged = Object.keys(a)
    .filter((n) => n in b && b[n] !== a[n])
    .sort(alpha)
    .map((n) => ({ name: n, from: b[n], to: a[n] }));
  return { added, removed, idChanged, before: Object.keys(b).length, after: Object.keys(a).length };
}

/** Every mob named anywhere in a sightings payload. */
function mobsOf(data) {
  const out = new Set();
  for (const rows of Object.values(data?.items ?? {})) {
    for (const row of rows ?? []) if (row?.mob) out.add(String(row.mob).trim());
  }
  return out;
}

/** Every zone string named by any session in a sightings payload. */
function sessionZonesOf(data) {
  const out = new Set();
  for (const rows of Object.values(data?.items ?? {})) {
    for (const row of rows ?? []) {
      for (const s of row?.sessions ?? []) if (s?.zone) out.add(String(s.zone).trim());
    }
  }
  return out;
}

export function diffSightings(before, after) {
  const b = before?.items ?? {};
  const a = after?.items ?? {};
  const rowKey = (item, mob) => `${nameKey(item)}\u0000${nameKey(mob)}`;
  const rowsOf = (payload) => {
    const map = new Map();
    for (const [item, rows] of Object.entries(payload)) {
      for (const row of rows ?? []) {
        map.set(rowKey(item, row?.mob), {
          item,
          mob: String(row?.mob ?? '').trim(),
          seen: Number(row?.seen ?? 0),
          sessions: (row?.sessions ?? []).length,
          offRoster: Boolean(row?.off_roster),
          zones: [...new Set((row?.sessions ?? []).map((s) => String(s?.zone ?? '').trim()).filter(Boolean))],
          dates: (row?.sessions ?? []).map((s) => s?.date).filter(Boolean),
        });
      }
    }
    return map;
  };
  const rb = rowsOf(b);
  const ra = rowsOf(a);

  const itemsAdded = Object.keys(a).filter((n) => !(n in b)).sort(alpha);
  const itemsRemoved = Object.keys(b).filter((n) => !(n in a)).sort(alpha);

  const rowsAdded = [];
  const seenChanged = [];
  for (const [k, row] of ra) {
    const old = rb.get(k);
    if (!old) rowsAdded.push(row);
    else if (old.seen !== row.seen || old.sessions !== row.sessions) {
      seenChanged.push({
        item: row.item, mob: row.mob,
        seenFrom: old.seen, seenTo: row.seen,
        sessionsFrom: old.sessions, sessionsTo: row.sessions,
      });
    }
  }
  const rowsRemoved = [...rb].filter(([k]) => !ra.has(k)).map(([, row]) => row);

  const mobsBefore = mobsOf(before);
  const mobsAfter = mobsOf(after);
  const zonesBefore = sessionZonesOf(before);
  const zonesAfter = sessionZonesOf(after);

  const total = (map) => [...map.values()].reduce((n, r) => n + r.seen, 0);
  return {
    itemsAdded, itemsRemoved,
    rowsAdded: rowsAdded.sort((x, y) => alpha(x.item, y.item) || alpha(x.mob, y.mob)),
    rowsRemoved: rowsRemoved.sort((x, y) => alpha(x.item, y.item) || alpha(x.mob, y.mob)),
    seenChanged: seenChanged.sort((x, y) => (y.seenTo - y.seenFrom) - (x.seenTo - x.seenFrom)),
    mobsAdded: [...mobsAfter].filter((m) => !mobsBefore.has(m)).sort(alpha),
    mobsRemoved: [...mobsBefore].filter((m) => !mobsAfter.has(m)).sort(alpha),
    zonesAdded: [...zonesAfter].filter((z) => !zonesBefore.has(z)).sort(alpha),
    before: { items: Object.keys(b).length, rows: rb.size, seen: total(rb), mobs: mobsBefore.size },
    after: { items: Object.keys(a).length, rows: ra.size, seen: total(ra), mobs: mobsAfter.size },
  };
}

/** The zone fields worth naming individually when they move. */
const ZONE_SCALARS = ['title', 'levels', 'zem', 'plate', 'verify_level', 'coverage_score', 'url'];

export function diffZones(before, after) {
  const b = new Map((before?.zones ?? []).map((z) => [z.slug, z]));
  const a = new Map((after?.zones ?? []).map((z) => [z.slug, z]));
  const added = [...a.keys()].filter((s) => !b.has(s)).sort(alpha).map((s) => a.get(s));
  const removed = [...b.keys()].filter((s) => !a.has(s)).sort(alpha).map((s) => b.get(s));
  const changed = [];
  for (const [slug, zone] of a) {
    const old = b.get(slug);
    if (!old) continue;
    const fields = [];
    for (const f of ZONE_SCALARS) {
      if (JSON.stringify(old[f] ?? null) !== JSON.stringify(zone[f] ?? null)) {
        fields.push({ field: f, from: old[f] ?? null, to: zone[f] ?? null });
      }
    }
    for (const facet of new Set([...Object.keys(old.coverage ?? {}), ...Object.keys(zone.coverage ?? {})])) {
      const from = old.coverage?.[facet]?.level ?? null;
      const to = zone.coverage?.[facet]?.level ?? null;
      if (from !== to) fields.push({ field: `coverage.${facet}`, from, to });
    }
    if (fields.length) changed.push({ slug, title: zone.title, fields });
  }
  return {
    added, removed,
    changed: changed.sort((x, y) => alpha(x.slug, y.slug)),
    before: b.size, after: a.size,
  };
}

export function diffSky(before, after) {
  const keys = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])].sort(alpha);
  const changedKeys = keys.filter(
    (k) => JSON.stringify(before?.[k] ?? null) !== JSON.stringify(after?.[k] ?? null),
  );
  const bc = before?.classes ?? {};
  const ac = after?.classes ?? {};
  const classesAdded = Object.keys(ac).filter((c) => !(c in bc)).sort(alpha);
  const classesRemoved = Object.keys(bc).filter((c) => !(c in ac)).sort(alpha);
  const classesChanged = Object.keys(ac)
    .filter((c) => c in bc && JSON.stringify(bc[c]) !== JSON.stringify(ac[c]))
    .sort(alpha);
  return { changedKeys, classesAdded, classesRemoved, classesChanged, before: Object.keys(bc).length, after: Object.keys(ac).length };
}

/**
 * What a rebuild would newly admit, computed before the rebuild.
 *
 * An item that EQL Source can name — because a log saw it drop, or because an
 * `/outputfile inventory` dump printed its ID — is in the game, whatever any
 * wiki does or does not carry. Where no catalog record exists for it, the build
 * admits it as an existence-only record: `statsUnknown`, no slot, no class, an
 * evidence string, and withheld from ranking and auto-fill. That is exactly what
 * a brand-new drop from a revamped dungeon looks like on the morning it lands,
 * and this projection is the operator's advance warning of how many there are.
 */
export function projectAdmissions(items, sightings, indexItems) {
  if (!indexItems) return null;
  const have = new Set(indexItems.map((i) => nameKey(i.n)));
  const known = new Map(indexItems.map((i) => [nameKey(i.n), i]));
  const idNames = Object.keys(items?.items ?? {});
  const sightNames = Object.keys(sightings?.items ?? {});

  /*
   * The same alias rule the build applies, so this projection reports what will
   * actually happen rather than a larger number.
   *
   * `Executioner's Axe` in the ID table is `An Executioners Axe` in the catalog
   * and both are #5407: one item, two spellings, and admitting the first would
   * put two rows in the planner. A trailing `*` stays significant — `Backpack*`
   * (#32601) and `Backpack` (#17005) really are two items.
   */
  const alias = (s) =>
    nameKey(s)
      .replace(/'/g, '')
      .replace(/^(?:an?|the)\s+/, '')
      .replace(/[^a-z0-9 *]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\s*\*$/, '*');
  const catalogAliases = new Map();
  for (const i of indexItems) {
    const a = alias(i.n);
    if (!catalogAliases.has(a)) catalogAliases.set(a, []);
    catalogAliases.get(a).push(i.n);
  }

  const seen = new Map();
  const aliased = new Map();
  const note = (name, why) => {
    const k = nameKey(name);
    if (have.has(k)) return;
    const match = catalogAliases.get(alias(name));
    if (match) { aliased.set(k, { name, catalog: match }); return; }
    if (!seen.has(k)) seen.set(k, { name, why: [] });
    seen.get(k).why.push(why);
  };
  for (const n of idNames) note(n, 'named in the ID table');
  for (const n of sightNames) note(n, 'measured dropping');

  /*
   * The other half of the same question: an item the catalog already holds, but
   * which is only now backed by a measured drop. Nothing new ships for it — its
   * existence mark gets stronger, which is worth seeing and is not an admission.
   */
  const upgraded = sightNames
    .filter((n) => have.has(nameKey(n)))
    .filter((n) => known.get(nameKey(n))?.ex !== 'measured-drop')
    .sort(alpha);

  return {
    existenceOnly: [...seen.values()].sort((x, y) => alpha(x.name, y.name)),
    resolvedToExisting: [...aliased.values()].sort((x, y) => alpha(x.name, y.name)),
    upgradedExistence: upgraded,
    catalogSize: indexItems.length,
  };
}

// ---------------------------------------------------------------------------
// Zones referenced by sightings but not surveyed
// ---------------------------------------------------------------------------

/**
 * Fold a zone name to the tokens that identify it.
 *
 * The two files spell the same zone differently — `sightings` carries the
 * client's zone line ("The Castle of Mistmoore", sometimes with a " - Group"
 * difficulty suffix), `zones` carries the survey's title ("Castle Mistmoore").
 * Dropping the difficulty suffix, the articles and the joining prepositions
 * matches those two without asserting anything about the game. Anything that
 * still does not match is reported as unsurveyed rather than attached to the
 * nearest-looking zone: a wrong survey badge is worse than an absent one.
 */
export function zoneTokens(name) {
  const STOP = new Set(['the', 'of', 'a', 'an']);
  return nameKey(name)
    .replace(/\s*-\s*(group|raid|solo)\s*$/i, '')
    .replace(/[^a-z0-9' ]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t && !STOP.has(t))
    .join(' ');
}

export function unsurveyedZones(sightings, zones) {
  const surveyed = new Set((zones?.zones ?? []).map((z) => zoneTokens(z.title)));
  return [...sessionZonesOf(sightings)]
    .filter((z) => z && z !== 'null' && !surveyed.has(zoneTokens(z)))
    .sort(alpha);
}

// ---------------------------------------------------------------------------
// Assemble one report
// ---------------------------------------------------------------------------

export function diffAll(vendored, candidate) {
  const pick = (kind, side) => side?.[kind]?.data ?? null;
  return {
    items: diffItems(pick('items', vendored), pick('items', candidate)),
    sightings: diffSightings(pick('sightings', vendored), pick('sightings', candidate)),
    zones: diffZones(pick('zones', vendored), pick('zones', candidate)),
    sky: diffSky(pick('sky', vendored), pick('sky', candidate)),
  };
}

export function isEmptyDiff(diff) {
  const d = diff;
  return (
    !d.items.added.length && !d.items.removed.length && !d.items.idChanged.length &&
    !d.sightings.itemsAdded.length && !d.sightings.itemsRemoved.length &&
    !d.sightings.rowsAdded.length && !d.sightings.rowsRemoved.length && !d.sightings.seenChanged.length &&
    !d.zones.added.length && !d.zones.removed.length && !d.zones.changed.length &&
    !d.sky.changedKeys.length
  );
}

// ---------------------------------------------------------------------------
// Report rendering — numbered sections, in the house voice
// ---------------------------------------------------------------------------

const CAP = 25;
function list(lines, cap = CAP) {
  const out = lines.slice(0, cap).map((l) => `     ${l}`);
  if (lines.length > cap) out.push(`     … and ${lines.length - cap} more`);
  return out;
}

export function renderReport({ state, diff, admissions, unsurveyed, mode }) {
  const L = [];
  L.push('');
  L.push('=== EQL Source datasets — refresh report ===');
  L.push(`source: ${mode.from ? mode.from : BASE_URL}    ${new Date().toISOString()}`);
  L.push(mode.apply ? 'MODE: --apply — validated files will be vendored' : 'MODE: read-only — nothing will be written');
  L.push('');

  L.push('01  What was fetched');
  for (const s of state) {
    const tag = s.status.padEnd(11);
    if (!s.ok) { L.push(`  ${s.file.padEnd(20)} ${tag} ${s.error}`); continue; }
    const same = s.vendored && s.vendored.sha256 === s.sha256;
    L.push(
      `  ${s.file.padEnd(20)} ${tag} v${s.doc.version}  hash ${s.doc.hash}  ${String(s.bytes).padStart(7)} B` +
      (same ? '   (byte-identical to vendored)' : ''),
    );
    if (s.vendored && s.vendored.doc.hash !== s.doc.hash) {
      L.push(`     published hash moved: ${s.vendored.doc.hash} -> ${s.doc.hash}`);
    }
    if (s.vendored && s.vendored.doc.hash === s.doc.hash && !same) {
      L.push('     !! same published hash, different bytes. Upstream changed a file without changing its hash,');
      L.push('        or something between here and there rewrote it. Do not apply this without looking.');
    }
    if (s.vendored && s.vendored.doc.version !== s.doc.version) {
      L.push(`     !! version moved ${s.vendored.doc.version} -> ${s.doc.version}. A vN bump is a new URL upstream; read the file before trusting the diff.`);
    }
    for (const w of s.warnings ?? []) L.push(`     !! ${w}`);
    for (const p of s.problems ?? []) L.push(`     REFUSED: ${p}`);
  }
  L.push('');

  L.push('02  Items — the name-to-game-ID table');
  const di = diff.items;
  L.push(`  ${di.before} -> ${di.after} names   (+${di.added.length} / -${di.removed.length})`);
  if (di.added.length) {
    L.push('  added:');
    L.push(...list(di.added.map((x) => `${x.name}  #${x.id}`)));
  }
  if (di.removed.length) {
    L.push('  removed — an ID table does not normally lose names; check before applying:');
    L.push(...list(di.removed.map((x) => `${x.name}  #${x.id}`)));
  }
  if (di.idChanged.length) {
    L.push('  !! ID CHANGED. The ID is the join key across the +N tiers and the augment form.');
    L.push('     A moved ID means either a re-issued item or a bad read upstream. Neither is routine.');
    L.push(...list(di.idChanged.map((x) => `${x.name}  #${x.from} -> #${x.to}`)));
  }
  if (!di.added.length && !di.removed.length && !di.idChanged.length) L.push('  no change');
  L.push('');

  L.push('03  Sightings — what was measured dropping');
  const ds = diff.sightings;
  L.push(`  ${ds.before.items} -> ${ds.after.items} items   ${ds.before.rows} -> ${ds.after.rows} item/mob rows   ` +
    `${ds.before.seen} -> ${ds.after.seen} sightings   ${ds.before.mobs} -> ${ds.after.mobs} mobs`);
  if (ds.itemsAdded.length) {
    L.push('  items newly measured dropping:');
    L.push(...list(ds.itemsAdded));
  }
  if (ds.rowsAdded.length) {
    L.push('  new item/mob rows:');
    L.push(...list(ds.rowsAdded.map((r) =>
      `${r.item}  <-  ${r.mob}  seen ${r.seen} over ${r.sessions} session(s)` +
      (r.zones.length ? `  [${r.zones.join(', ')}]` : '') + (r.offRoster ? '  (off-roster mob)' : ''))));
  }
  if (ds.mobsAdded.length) {
    L.push('  mobs named for the first time:');
    L.push(...list(ds.mobsAdded));
  }
  if (ds.zonesAdded.length) {
    L.push('  zones named by a session for the first time:');
    L.push(...list(ds.zonesAdded));
  }
  if (ds.seenChanged.length) {
    L.push(`  ${ds.seenChanged.length} existing rows changed count (a count, never a rate):`);
    L.push(...list(ds.seenChanged.map((r) =>
      `${r.item} <- ${r.mob}  seen ${r.seenFrom} -> ${r.seenTo}  sessions ${r.sessionsFrom} -> ${r.sessionsTo}`), 12));
  }
  if (ds.itemsRemoved.length || ds.rowsRemoved.length) {
    L.push(`  !! ${ds.itemsRemoved.length} items and ${ds.rowsRemoved.length} rows DISAPPEARED. Measured evidence does not`);
    L.push('     normally get withdrawn; read the upstream note before applying.');
    L.push(...list(ds.rowsRemoved.map((r) => `${r.item} <- ${r.mob} (was seen ${r.seen})`), 12));
  }
  if (!ds.itemsAdded.length && !ds.rowsAdded.length && !ds.seenChanged.length &&
      !ds.itemsRemoved.length && !ds.rowsRemoved.length) L.push('  no change');
  L.push('');

  L.push('04  Zones — the surveys behind a drop source');
  const dz = diff.zones;
  L.push(`  ${dz.before} -> ${dz.after} zones   (+${dz.added.length} / -${dz.removed.length})`);
  for (const z of dz.added) {
    const facets = Object.entries(z.coverage ?? {}).map(([k, v]) => `${k}=${v.level}`).join(' ');
    L.push(`  NEW ZONE  ${z.title} (${z.slug})  verify=${z.verify_level ?? 'none'}  score=${z.coverage_score ?? '-'}`);
    L.push(`            ${facets || '(no coverage facets)'}`);
  }
  for (const z of dz.removed) L.push(`  REMOVED   ${z.title} (${z.slug})`);
  for (const z of dz.changed) {
    L.push(`  changed   ${z.title} (${z.slug})`);
    for (const f of z.fields) L.push(`              ${f.field}: ${JSON.stringify(f.from)} -> ${JSON.stringify(f.to)}`);
  }
  if (!dz.added.length && !dz.removed.length && !dz.changed.length) L.push('  no change');
  if (unsurveyed?.length) {
    L.push('  zones a session names that no survey covers — the app must say "no survey", never imply one:');
    L.push(...list(unsurveyed));
  }
  L.push('');

  L.push('05  Sky — class unlock quests');
  const dk = diff.sky;
  L.push(`  ${dk.before} -> ${dk.after} classes` +
    (dk.changedKeys.length ? `   sections changed: ${dk.changedKeys.join(', ')}` : '   no change'));
  if (dk.classesAdded.length) L.push(`  classes added: ${dk.classesAdded.join(', ')}`);
  if (dk.classesRemoved.length) L.push(`  classes removed: ${dk.classesRemoved.join(', ')}`);
  if (dk.classesChanged.length) L.push(`  classes changed: ${dk.classesChanged.join(', ')}`);
  L.push('  (vendored and diffed; the build does not read this file yet)');
  L.push('');

  L.push('06  What a rebuild would newly admit');
  if (!admissions) {
    L.push('  no built catalog at web/public/data/items-index.json — run `node pipeline/build.mjs` first');
    L.push('  to see this section. It is the one that answers "what does the patch actually add".');
  } else {
    L.push(`  catalog now: ${admissions.catalogSize} items`);
    L.push(`  items with Tier M existence evidence and NO catalog record: ${admissions.existenceOnly.length}`);
    L.push('  each ships as an existence-only record: statsUnknown, no slot, no class, an evidence string,');
    L.push('  never ranked, never auto-filled, never shown as a row of zeroes.');
    L.push(...list(admissions.existenceOnly.map((x) => `${x.name}  (${[...new Set(x.why)].join(' + ')})`)));
    if (admissions.resolvedToExisting?.length) {
      L.push(`  named upstream, already in the catalog under another spelling — no new record: ${admissions.resolvedToExisting.length}`);
      L.push(...list(admissions.resolvedToExisting.map((x) => `${x.name}  ->  ${x.catalog.join(' / ')}`), 12));
    }
    if (admissions.upgradedExistence.length) {
      L.push(`  items already in the catalog whose evidence gets stronger (now measured dropping): ${admissions.upgradedExistence.length}`);
      L.push(...list(admissions.upgradedExistence, 12));
    }
  }
  L.push('');

  L.push('07  Next');
  if (isEmptyDiff(diff)) {
    L.push('  Nothing changed upstream. Nothing to do.');
  } else if (mode.apply) {
    L.push('  Files vendored. Now:');
    L.push('    node pipeline/build.mjs && node pipeline/verify.mjs');
    L.push('    cd web && npx tsc --noEmit && npx vitest run && npm run build');
    L.push('  research/PATCH-DAY.md has the checks and what to do when a number looks wrong.');
  } else {
    L.push('  Read section 06, then re-run with --apply to vendor these files.');
    L.push('  research/PATCH-DAY.md has the full sequence.');
  }
  L.push('');
  return L.join('\n');
}

// ---------------------------------------------------------------------------
// The manifest — what is vendored, and what upstream called it
// ---------------------------------------------------------------------------

export function readManifest() {
  if (!existsSync(MANIFEST)) return null;
  try {
    return JSON.parse(readFileSync(MANIFEST, 'utf8'));
  } catch {
    return null;
  }
}

function writeManifest(state) {
  const datasets = {};
  for (const s of DATASETS) {
    const row = state.find((x) => x.file === s.file);
    const use = row?.applied ? row : null;
    const vendored = use ?? row?.vendored ?? null;
    if (!vendored) continue;
    datasets[s.file] = {
      kind: s.kind,
      title: s.title,
      role: s.role,
      url: BASE_URL + s.file,
      version: vendored.doc.version ?? null,
      publishedHash: vendored.doc.hash ?? null,
      bytes: vendored.bytes,
      sha256: vendored.sha256,
      vendoredAt: use ? new Date().toISOString() : (readManifest()?.datasets?.[s.file]?.vendoredAt ?? null),
    };
  }
  const doc = {
    note:
      'Written by pipeline/refresh.mjs. `publishedHash` is upstream\'s own `hash` field, recorded not ' +
      'recomputed — the algorithm behind it is not published, so it is a label to compare, not a checksum ' +
      'to verify. `sha256` is ours, over the exact bytes vendored, and it is what proves the file on disk ' +
      'is the file that was fetched.',
    source: BASE_URL,
    terms: 'EQL Source, https://eqlsource.com — use with attribution; read the provenance before trusting a value.',
    datasets,
  };
  mkdirSync(dirname(MANIFEST), { recursive: true });
  writeFileSync(MANIFEST, JSON.stringify(doc, null, 1) + '\n');
  return doc;
}

/**
 * Has a vendored file been edited since the manifest recorded it?
 *
 * A hand-edited vendored dataset is not a crime — simulating a patch is exactly
 * how this path gets tested — but it must not be invisible, because it means the
 * catalog is built from something upstream never published.
 */
export function vendorDrift(manifest, state) {
  const out = [];
  for (const s of state) {
    const rec = manifest?.datasets?.[s.file];
    if (!rec || !s.vendored) continue;
    if (rec.sha256 && rec.sha256 !== s.vendored.sha256) {
      out.push(`${s.file}: on disk sha256 ${s.vendored.sha256.slice(0, 16)}… but the manifest recorded ${String(rec.sha256).slice(0, 16)}…`);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const has = (f) => argv.includes(f);
  const valueOf = (f) => {
    const i = argv.indexOf(f);
    return i >= 0 ? argv[i + 1] : null;
  };
  const only = valueOf('--only');
  return {
    apply: has('--apply'),
    check: has('--check'),
    json: has('--json'),
    force: has('--force'),
    from: valueOf('--from'),
    only: only ? new Set(only.split(',').map((s) => s.trim()).filter(Boolean)) : null,
  };
}

async function main(argv) {
  const mode = parseArgs(argv);
  if (!mode.from) reexecForProxy(argv);

  const wanted = DATASETS.filter((d) => !mode.only || mode.only.has(d.kind) || mode.only.has(d.file));
  const state = [];
  let fatal = false;

  for (const d of DATASETS) {
    const vendorPath = join(VENDOR, d.file);
    const vendored = existsSync(vendorPath) ? readJsonFile(vendorPath) : null;
    const row = { file: d.file, kind: d.kind, vendored, ok: false, status: 'skipped' };

    if (!wanted.includes(d)) {
      // Not asked for: carry the vendored copy forward so the diff for it is empty.
      Object.assign(row, vendored ? { ok: true, status: 'vendored', ...vendored } : { status: 'absent' });
      state.push(row);
      continue;
    }

    let got;
    if (mode.from) {
      const p = join(resolve(mode.from), d.file);
      if (!existsSync(p)) {
        // Fatal, not a shrug. A directory that is missing the file falls back to
        // the vendored copy for the diff, which would otherwise print "no
        // change" — the most reassuring possible way to report that the operator
        // pointed at the wrong folder.
        Object.assign(row, { ok: false, status: 'MISSING', error: `not in ${mode.from}` });
        fatal = true;
        state.push(row);
        continue;
      }
      const read = readJsonFile(p);
      got = { ok: true, url: p, ...read };
    } else {
      got = await fetchDataset(d.file);
    }

    if (!got.ok) {
      Object.assign(row, { ok: false, status: 'UNREACHABLE', error: got.error });
      fatal = true;
      state.push(row);
      continue;
    }

    const { problems, warnings } = validateDataset(d.kind, got.doc, vendored?.doc?.data ?? null);
    Object.assign(row, {
      ok: problems.length === 0,
      status: problems.length ? 'REFUSED' : 'fetched',
      doc: got.doc, text: got.text, bytes: got.bytes, sha256: got.sha256,
      problems, warnings,
    });
    if (problems.length) fatal = true;
    state.push(row);
  }

  const side = (rows, useCandidate) => {
    const out = {};
    for (const r of rows) {
      const doc = useCandidate ? (r.ok ? r.doc : r.vendored?.doc) : r.vendored?.doc;
      if (doc) out[r.kind] = doc;
    }
    return out;
  };
  const diff = diffAll(side(state, false), side(state, true));

  const candidateItems = side(state, true).items?.data ?? null;
  const candidateSight = side(state, true).sightings?.data ?? null;
  const candidateZones = side(state, true).zones?.data ?? null;
  const indexItems = existsSync(INDEX) ? JSON.parse(readFileSync(INDEX, 'utf8')).items ?? null : null;
  const admissions = projectAdmissions(candidateItems, candidateSight, indexItems);
  const unsurveyed = unsurveyedZones(candidateSight, candidateZones);

  const manifest = readManifest();
  const drift = vendorDrift(manifest, state);

  if (mode.json) {
    process.stdout.write(JSON.stringify({
      source: mode.from ?? BASE_URL,
      datasets: state.map((s) => ({
        file: s.file, status: s.status, error: s.error ?? null,
        version: s.doc?.version ?? null, publishedHash: s.doc?.hash ?? null,
        bytes: s.bytes ?? null, sha256: s.sha256 ?? null,
        vendoredVersion: s.vendored?.doc?.version ?? null,
        vendoredHash: s.vendored?.doc?.hash ?? null,
        problems: s.problems ?? [], warnings: s.warnings ?? [],
      })),
      diff, admissions, unsurveyedZones: unsurveyed, vendorDrift: drift,
      unchanged: isEmptyDiff(diff),
    }, null, 1) + '\n');
  } else {
    process.stdout.write(renderReport({ state, diff, admissions, unsurveyed, mode }));
    if (drift.length) {
      process.stdout.write('\n  !! VENDORED FILES DIFFER FROM THE MANIFEST:\n');
      for (const line of drift) process.stdout.write(`     ${line}\n`);
      process.stdout.write('     Either somebody edited a vendored file by hand (a simulation, perhaps),\n');
      process.stdout.write('     or a refresh was applied without updating the manifest. Resolve before shipping.\n\n');
    }
  }

  if (mode.apply) {
    const blocked = state.filter((s) => s.problems?.length);
    const warned = state.filter((s) => s.warnings?.length);
    if (blocked.length) {
      process.stderr.write(`refusing to apply: ${blocked.map((s) => s.file).join(', ')} failed validation\n`);
      return 1;
    }
    if (warned.length && !mode.force) {
      process.stderr.write(
        `refusing to apply: ${warned.map((s) => s.file).join(', ')} raised a guard ` +
        `(${warned.flatMap((s) => s.warnings).join('; ')}). Re-run with --force if that is expected.\n`,
      );
      return 1;
    }
    let wrote = 0;
    for (const s of state) {
      if (s.status !== 'fetched' || !s.text) continue;
      if (s.vendored && s.vendored.sha256 === s.sha256) { s.applied = null; continue; }
      writeFileSync(join(VENDOR, s.file), s.text);
      s.applied = { doc: s.doc, bytes: s.bytes, sha256: s.sha256 };
      wrote += 1;
    }
    // Keep the manifest truthful even when nothing moved: it also records the
    // fact that the vendored bytes were checked against upstream today.
    for (const s of state) {
      if (!s.applied && s.status === 'fetched') s.applied = { doc: s.doc, bytes: s.bytes, sha256: s.sha256 };
    }
    writeManifest(state);
    process.stdout.write(`\n  applied: ${wrote} file(s) rewritten, manifest updated at pipeline/sources/eqlsource/manifest.json\n\n`);
  }

  if (fatal) return 2;
  if (mode.check && !isEmptyDiff(diff)) return 1;
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main(process.argv.slice(2)).then((code) => process.exit(code)).catch((err) => {
    process.stderr.write(`refresh failed: ${err.stack ?? err.message}\n`);
    process.exit(2);
  });
}
