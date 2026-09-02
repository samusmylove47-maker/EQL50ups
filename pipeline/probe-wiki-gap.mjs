#!/usr/bin/env node
/**
 * What does the LIVE wiki carry that this project has never seen?
 *
 * The vendored scrape is `research/data/eqlwiki-items-2026-08-03.json`, taken on
 * 3 August 2026 and holding 6,903 item records. On 2 September the live wiki's
 * `Category:Items` reports 11,170 pages, and pages are still being edited today.
 *
 * This enumerates the live category and diffs it against everything this project
 * knows about — the shipped payload AND the quarantine, since a name we
 * deliberately hold back is not a name we are missing.
 *
 * Read-only. ~23 requests at the anonymous 500-per-page limit. Writes nothing
 * to the payload.
 *
 *   node pipeline/probe-wiki-gap.mjs [--out FILE]
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const API = 'https://eqlwiki.com/api.php';
const outAt = process.argv.indexOf('--out');
const OUT = outAt >= 0 ? process.argv[outAt + 1] : null;

function api(params) {
  const url = `${API}?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`;
  return JSON.parse(execFileSync('curl', ['-sSL', '-m', '60', '--compressed', url], {
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  }));
}

/* ---- what the live wiki has ---- */
const live = [];
let cont;
do {
  const data = api({
    action: 'query', list: 'categorymembers', cmtitle: 'Category:Items',
    cmlimit: '500', cmnamespace: '0', ...(cont ? { cmcontinue: cont } : {}),
  });
  for (const m of data?.query?.categorymembers ?? []) live.push(m.title);
  cont = data?.continue?.cmcontinue;
  process.stderr.write(`  live titles: ${live.length}\r`);
} while (cont);
process.stderr.write('\n');

/* ---- what we know about ---- */
const idx = JSON.parse(readFileSync('web/public/data/items-index.json', 'utf8'));
const shipped = (idx.items ?? idx).map((i) => i.n);

const rawQ = JSON.parse(readFileSync('pipeline/quarantine.json', 'utf8'));
const quarantined = (Array.isArray(rawQ) ? rawQ : rawQ.items ?? []);

const snap = JSON.parse(readFileSync('research/data/eqlwiki-items-2026-08-03.json', 'utf8'));
const snapItems = snap.items ?? snap;
const snapNames = (Array.isArray(snapItems) ? snapItems : Object.values(snapItems)).map((i) => i.name);

const key = (s) => String(s).toLowerCase().replace(/\s+/g, ' ').trim();
const known = new Set([...shipped, ...quarantined.map((r) => r.n)].map(key));
const inSnapshot = new Set(snapNames.map(key));

const unknown = live.filter((t) => !known.has(key(t)));
const notInSnapshot = live.filter((t) => !inSnapshot.has(key(t)));

console.log('');
console.log(`live wiki Category:Items pages        : ${live.length}`);
console.log(`our 2026-08-03 wiki snapshot          : ${snapNames.length}`);
console.log(`shipped payload                       : ${shipped.length}`);
console.log(`quarantined                           : ${quarantined.length}`);
console.log('');
console.log(`live titles ABSENT from the snapshot  : ${notInSnapshot.length}`);
console.log(`live titles this project has NEVER    : ${unknown.length}`);
console.log('  seen in any form (not shipped, not quarantined)');
console.log('');
console.log('a sample of what we have never seen:');
for (const t of unknown.slice(0, 30)) console.log(`   ${t}`);

if (OUT) {
  writeFileSync(OUT, JSON.stringify({ live, unknown, notInSnapshot }, null, 1));
  console.log(`\nwrote ${OUT}`);
}
