#!/usr/bin/env node
/**
 * How many era-less quarantined items can the LIVE wiki place in an era?
 *
 * `build.mjs` derives era from five explicit fields — `eqlwiki.available_from`,
 * `eqlwiki.era`, `eqlwiki.eras.min`, `jmoyers.eraTag`, `nathanbates.era`. The
 * zone an item drops in is never consulted, and 2,230 records (447 of them
 * wearable) are quarantined as "no era in any source" as a result.
 *
 * That is a real gap rather than a policy: five of the eight eras this project
 * ranks — Fear, Hate, Paineel, Temple, Sky — ARE zones, and the wiki records the
 * zone on the item page as `dropsfrom`.
 *
 * This measures the gap. It writes nothing to the payload. Read-only against
 * eqlwiki.com, batched 50 titles per request, which is the MediaWiki anonymous
 * limit and nine requests for the whole wearable set.
 *
 *   node pipeline/probe-eraless.mjs [--all] [--out FILE]
 *
 * `--all` covers all 2,230 rather than the 447 wearables.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const API = 'https://eqlwiki.com/api.php';
const args = process.argv.slice(2);
const ALL = args.includes('--all');
const outAt = args.indexOf('--out');
const OUT = outAt >= 0 ? args[outAt + 1] : null;

const quarantine = JSON.parse(readFileSync('pipeline/quarantine.json', 'utf8'));
const rows = (Array.isArray(quarantine) ? quarantine : quarantine.items ?? [])
  .filter((r) => r.why === 'no era in any source')
  .filter((r) => ALL || (r.sl ?? []).length > 0);

console.log(`era-less quarantined records to check: ${rows.length}${ALL ? ' (all)' : ' (wearable only)'}`);

/** One GET, through curl, because that is what reaches an external host here. */
function api(params) {
  const url = `${API}?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`;
  const body = execFileSync('curl', ['-sSL', '-m', '45', '--compressed', url], {
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
  return JSON.parse(body);
}

/** Wiki links inside a `dropsfrom` block, which is where the zone lives. */
function zonesFrom(wikitext) {
  const block = /\|\s*dropsfrom\s*=([\s\S]*?)(?:\n\s*\||\}\})/.exec(wikitext ?? '');
  if (!block) return [];
  return [...block[1].matchAll(/\[\[([^\]|#]+)/g)]
    .map((m) => m[1].trim())
    .filter(Boolean);
}

/** Every `[[Category:X]]` on the page — the wiki files items by zone too. */
function categoriesFrom(wikitext) {
  return [...(wikitext ?? '').matchAll(/\[\[Category:([^\]|]+)/g)].map((m) => m[1].trim());
}

const found = [];
const missing = [];
const BATCH = 50;
for (let i = 0; i < rows.length; i += BATCH) {
  const slice = rows.slice(i, i + BATCH);
  const data = api({
    action: 'query',
    prop: 'revisions',
    rvprop: 'content',
    rvslots: 'main',
    titles: slice.map((r) => r.n).join('|'),
  });
  const pages = data?.query?.pages ?? [];
  const byTitle = new Map(pages.map((p) => [p.title, p]));
  // The API normalises some titles; follow the mapping back.
  for (const norm of data?.query?.normalized ?? []) {
    const p = byTitle.get(norm.to);
    if (p) byTitle.set(norm.from, p);
  }
  for (const row of slice) {
    const page = byTitle.get(row.n);
    if (!page || page.missing) { missing.push(row.n); continue; }
    const text = page.revisions?.[0]?.slots?.main?.content ?? '';
    found.push({
      n: row.n,
      sl: row.sl ?? [],
      zones: zonesFrom(text),
      cats: categoriesFrom(text),
    });
  }
  process.stderr.write(`  ${Math.min(i + BATCH, rows.length)}/${rows.length}\r`);
}
process.stderr.write('\n');

console.log(`pages found on the live wiki : ${found.length}`);
console.log(`no such page                 : ${missing.length}`);

const withZone = found.filter((r) => r.zones.length);
console.log(`carrying a dropsfrom zone    : ${withZone.length}`);

const zoneCount = new Map();
for (const r of withZone) for (const z of r.zones) zoneCount.set(z, (zoneCount.get(z) ?? 0) + 1);
console.log('\nzones named, most common first:');
for (const [z, n] of [...zoneCount].sort((a, b) => b[1] - a[1]).slice(0, 40)) {
  console.log(`  ${String(n).padStart(4)}  ${z}`);
}

if (OUT) {
  writeFileSync(OUT, JSON.stringify({ found, missing }, null, 1));
  console.log(`\nwrote ${OUT}`);
}
