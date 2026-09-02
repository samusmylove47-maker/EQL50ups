#!/usr/bin/env node
/**
 * wiki-supplement.mjs — close the gap between the vendored wiki scrape and the
 * live wiki, for items this project is demonstrably missing.
 *
 * `research/data/eqlwiki-items-2026-08-03.json` was taken by hand on 3 August
 * 2026 and there is no refresh path for it — `refresh.mjs` covers the four
 * eqlsource.com datasets, not the wiki. A month later the live wiki's
 * `Category:Items` holds 11,168 pages and is edited daily.
 * `research/WIKI-GAP-2026-09-02.md` measures the consequence.
 *
 * This fetches the pages this project has never seen, plus the pages it holds
 * back for want of an era, and writes ONE vendored file carrying:
 *
 *   - the raw `statsblock` wikitext, unparsed. `build.mjs` already owns a
 *     tested `parseStatsBlock`, and the whole point of carrying the raw block
 *     is that no second parser exists to disagree with the first one.
 *   - the era, only where the page states one via an `{{X Era}}` template.
 *   - whether the page is listed on the wiki's own `VerifiedPages` registry.
 *   - the revision id and `touched` timestamp, so a later run can tell what
 *     moved rather than re-deriving it.
 *
 * NOTHING IS WRITTEN WITHOUT `--apply`, following `refresh.mjs`: on a data day
 * the first question is "what would change", not "please change it".
 *
 * USAGE
 *   node pipeline/wiki-supplement.mjs                 fetch, report, write nothing
 *   node pipeline/wiki-supplement.mjs --apply         ... and vendor the result
 *   node pipeline/wiki-supplement.mjs --out FILE      write somewhere else
 *
 * EXIT CODES
 *   0  ran
 *   2  could not fetch or could not parse; nothing was written
 */

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const API = 'https://eqlwiki.com/api.php';
/**
 * The filename carries the date the wiki was READ, matching
 * `eqlwiki-items-2026-08-03.json`. That is not decoration:
 * `catalogue-audit.mjs` derives a scrape date from the filename and refuses
 * a source it cannot date, because rule 6 of the sourcing standard cannot be
 * applied to an input with no date at all.
 */
const STAMP = new Date().toISOString().slice(0, 10);
const DEFAULT_OUT = join(ROOT, 'research', 'data', `eqlwiki-supplement-${STAMP}.json`);

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const outAt = argv.indexOf('--out');
const OUT = outAt >= 0 ? argv[outAt + 1] : DEFAULT_OUT;

/** Eras this project ships. Kept here rather than imported so a mistake in
 *  build.mjs's constant cannot quietly validate itself — verify.mjs restates
 *  its vocabularies for the same reason. */
const IN_ERA = new Set(['Classic', 'Fear', 'Hate', 'Paineel', 'Temple', 'Sky']);

const nameKey = (s) => String(s).toLowerCase().replace(/[‘’`']/g, "'").replace(/\s+/g, ' ').trim();

function api(params, { post = false } = {}) {
  const qs = new URLSearchParams({ format: 'json', formatversion: '2', ...params });
  const args = post
    ? ['-sSL', '-m', '60', '--compressed', '-X', 'POST', API, '--data', qs.toString()]
    : ['-sSL', '-m', '60', '--compressed', `${API}?${qs}`];
  let body;
  try {
    body = execFileSync('curl', args, { encoding: 'utf8', maxBuffer: 96 * 1024 * 1024 });
  } catch (error) {
    console.error(`fetch failed: ${error.message}`);
    process.exit(2);
  }
  try {
    return JSON.parse(body);
  } catch {
    console.error(`could not parse a response from ${API}`);
    process.exit(2);
  }
}

/* ------------------------------------------------------------ what we have */

const idx = JSON.parse(readFileSync(join(ROOT, 'web/public/data/items-index.json'), 'utf8'));
const shipped = new Set((idx.items ?? idx).map((i) => nameKey(i.n)));

const rawQ = JSON.parse(readFileSync(join(ROOT, 'pipeline/quarantine.json'), 'utf8'));
const quarantine = Array.isArray(rawQ) ? rawQ : rawQ.items ?? [];
const eraless = quarantine.filter((r) => r.why === 'no era in any source');
const eralessKeys = new Set(eraless.map((r) => nameKey(r.n)));
const knownKeys = new Set([...shipped, ...quarantine.map((r) => nameKey(r.n))]);

/* ------------------------------------------------------------- the live set */

process.stderr.write('enumerating live Category:Items ...\n');
const live = [];
let cont;
do {
  const data = api({
    action: 'query', list: 'categorymembers', cmtitle: 'Category:Items',
    cmlimit: '500', cmnamespace: '0', ...(cont ? { cmcontinue: cont } : {}),
  });
  for (const m of data?.query?.categorymembers ?? []) live.push(m.title);
  cont = data?.continue?.cmcontinue;
  process.stderr.write(`  ${live.length}\r`);
} while (cont);
process.stderr.write(`\n  ${live.length} live item pages\n`);

process.stderr.write('reading VerifiedPages ...\n');
const vp = api({ action: 'parse', page: 'VerifiedPages', prop: 'wikitext' });
const verified = new Set(
  String(vp?.parse?.wikitext ?? '').split('\n')
    .map((s) => nameKey(s.replace(/_/g, ' ')))
    .filter(Boolean),
);
process.stderr.write(`  ${verified.size} verified pages\n`);

/**
 * Which pages to fetch in full.
 *
 * Two disjoint reasons, both recorded on the record so a reader can tell why a
 * row is here: `unseen` — the live wiki has it and this project has never held
 * it in any form; `eraless` — we hold it back for want of an era, and the live
 * page may now state one.
 */
const wanted = new Map();
for (const title of live) {
  const k = nameKey(title);
  if (!knownKeys.has(k)) wanted.set(title, 'unseen');
  else if (eralessKeys.has(k)) wanted.set(title, 'eraless');
}
process.stderr.write(`fetching ${wanted.size} pages (${[...wanted.values()].filter((v) => v === 'unseen').length} unseen, ${[...wanted.values()].filter((v) => v === 'eraless').length} era-less)\n`);

/* --------------------------------------------------------------- the fetch */

/** `|statsblock =` up to the next top-level template parameter. */
function statsBlockOf(text) {
  const m = /\|\s*statsblock\s*=([\s\S]*?)(?:\n\s*\|\s*\w+\s*=|\}\}\s*<\/onlyinclude>|\n\}\})/i.exec(text);
  return m ? m[1].trim() : null;
}
function eraOf(text) {
  const m = /\{\{\s*([A-Za-z' ]+?)\s*Era\s*\}\}/.exec(text);
  return m ? m[1].trim() : null;
}
function dropsFromOf(text) {
  const m = /\|\s*dropsfrom\s*=([\s\S]*?)(?:\n\s*\|\s*\w+\s*=|\}\})/i.exec(text);
  if (!m) return [];
  return [...m[1].matchAll(/\[\[([^\]|#]+)/g)].map((x) => x[1].trim()).filter(Boolean);
}

const titles = [...wanted.keys()];
const records = [];
const absent = [];
for (let i = 0; i < titles.length; i += 50) {
  const slice = titles.slice(i, i + 50);
  const data = api({
    action: 'query', prop: 'revisions|info', rvprop: 'content|ids|timestamp',
    rvslots: 'main', titles: slice.join('|'),
  });
  const pages = data?.query?.pages ?? [];
  const byTitle = new Map(pages.map((p) => [p.title, p]));
  for (const n of data?.query?.normalized ?? []) {
    if (byTitle.has(n.to)) byTitle.set(n.from, byTitle.get(n.to));
  }
  for (const title of slice) {
    const page = byTitle.get(title);
    if (!page || page.missing) { absent.push(title); continue; }
    const text = page.revisions?.[0]?.slots?.main?.content ?? '';
    const statsBlock = statsBlockOf(text);
    const era = eraOf(text);
    records.push({
      name: page.title,
      reason: wanted.get(title),
      pageid: page.pageid ?? null,
      revid: page.revisions?.[0]?.revid ?? null,
      touched: page.touched ?? null,
      verified: verified.has(nameKey(page.title)),
      ...(era ? { era } : {}),
      ...(statsBlock ? { statsBlock } : {}),
      ...(dropsFromOf(text).length ? { dropsFrom: dropsFromOf(text) } : {}),
    });
  }
  process.stderr.write(`  ${Math.min(i + 50, titles.length)}/${titles.length}\r`);
}
process.stderr.write('\n');

/* --------------------------------------------------------------- the report */

const withStats = records.filter((r) => r.statsBlock && /^\s*Slot\s*:/im.test(r.statsBlock));
const shipworthy = withStats.filter((r) => r.era && IN_ERA.has(r.era));
const unseenShip = shipworthy.filter((r) => r.reason === 'unseen');
const eralessShip = shipworthy.filter((r) => r.reason === 'eraless');

console.log('');
console.log(`live item pages                       : ${live.length}`);
console.log(`pages fetched                         : ${records.length}  (${absent.length} absent)`);
console.log(`  carrying a Slot: and a stats block  : ${withStats.length}`);
console.log(`  ...and an in-era {{X Era}} template : ${shipworthy.length}`);
console.log(`      never seen before               : ${unseenShip.length}`);
console.log(`      currently held back, era-less   : ${eralessShip.length}`);
console.log(`on the wiki's VerifiedPages registry  : ${records.filter((r) => r.verified).length}`);
console.log('');
console.log('items this run would add to the catalogue:');
for (const r of shipworthy) {
  const slot = /^\s*Slot\s*:\s*([^\n]*)$/im.exec(r.statsBlock)?.[1]?.trim() ?? '?';
  console.log(`   ${r.era.padEnd(8)} ${r.verified ? 'verified ' : '         '}${r.name}  [${slot}]`);
}

const payload = {
  source: 'eqlwiki.com',
  note: 'Live-wiki supplement to research/data/eqlwiki-items-2026-08-03.json. '
    + 'Raw statsblock wikitext is carried unparsed on purpose: build.mjs owns the parser.',
  fetchedAt: new Date().toISOString(),
  liveCategoryCount: live.length,
  verifiedPagesCount: verified.size,
  counts: {
    fetched: records.length,
    absent: absent.length,
    withStats: withStats.length,
    inEra: shipworthy.length,
    unseen: unseenShip.length,
    eraless: eralessShip.length,
  },
  items: records.sort((a, b) => a.name.localeCompare(b.name)),
};
const bytes = `${JSON.stringify(payload, null, 1)}\n`;
console.log('');
console.log(`sha256 of the candidate               : ${createHash('sha256').update(bytes).digest('hex')}`);

if (!APPLY) {
  console.log('\nnothing written. re-run with --apply to vendor it.');
  process.exit(0);
}
writeFileSync(OUT, bytes);
console.log(`\nwrote ${OUT}`);
