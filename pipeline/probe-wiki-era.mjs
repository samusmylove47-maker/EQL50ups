#!/usr/bin/env node
/**
 * What does the wiki itself say is in EverQuest Legends?
 *
 * This project decides what ships with its own era ladder, transcribed from
 * wiki era fields into `ERA_ORDER`. On 2 September 2026 the owner corrected the
 * premise that ladder rests on:
 *
 *   *"EQ Legends is built in the classic era, but they have brought certain
 *    things from future expansions into classic, so this cannot be a rule,
 *    rather a starting point. Start with EQ classic era, then verify."*
 *
 * Froglok, Kerran and Iksar were added as races; Beastlord and Berserker as
 * classes; and items and gear sets were added for them. So "the wiki calls it
 * Velious" does not mean "this game does not have it", and our purge produces
 * false negatives by construction.
 *
 * The wiki turns out to answer the question directly. Its `EQLClientData`
 * extension publishes a POST-only `action=eqlmetadata` that returns, per page:
 *
 *   outOfEra   the wiki's OWN determination for EverQuest Legends
 *   missing    whether the page exists
 *   touched    last edit
 *
 * That is a Tier 2 statement about *this game*, which is a different and
 * stronger thing than a Tier 2 statement about original EverQuest content that
 * we then reason about. `eraRevision` identifies the config it was computed
 * from, so a later run can tell whether the wiki changed its mind or we did.
 *
 * Read-only. Writes nothing to the payload.
 *
 *   node pipeline/probe-wiki-era.mjs            both corpora
 *   node pipeline/probe-wiki-era.mjs --shipped  only what we ship
 *   node pipeline/probe-wiki-era.mjs --held     only what we withhold
 *   node pipeline/probe-wiki-era.mjs --out FILE record the per-title verdicts
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://eqlwiki.com/api.php';

const argv = process.argv.slice(2);
const outAt = argv.indexOf('--out');
const OUT = outAt >= 0 ? argv[outAt + 1] : null;
const ONLY_SHIPPED = argv.includes('--shipped');
const ONLY_HELD = argv.includes('--held');

/** 60 titles per POST is measured, not guessed: the API returned 60 of 60. */
const BATCH = 60;

function eqlmetadata(titles) {
  const body = `action=eqlmetadata&format=json&formatversion=2&titles=${encodeURIComponent(titles.join('|'))}`;
  let raw;
  try {
    raw = execFileSync('curl', ['-sS', '-m', '90', '--compressed', '-X', 'POST', API, '--data', body],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch (error) {
    console.error(`fetch failed: ${error.message}`);
    process.exit(2);
  }
  try {
    return JSON.parse(raw);
  } catch {
    console.error(`could not parse a response from ${API}`);
    process.exit(2);
  }
}

/**
 * `eqlmetadata` normalises titles (spaces to underscores, first letter cased),
 * and echoes what it was asked for in `requested`. Matching on that rather than
 * on `title` is what keeps a name with an apostrophe or a lowercase first
 * letter from silently dropping out of the tally.
 */
function ask(names) {
  const verdicts = new Map();
  let eraRevision = null;
  for (let i = 0; i < names.length; i += BATCH) {
    const slice = names.slice(i, i + BATCH);
    const data = eqlmetadata(slice);
    eraRevision = data?.eqlmetadata?.eraRevision ?? eraRevision;
    for (const page of data?.eqlmetadata?.pages ?? []) {
      for (const requested of page.requested ?? [page.title]) {
        verdicts.set(String(requested).replace(/_/g, ' '), page);
      }
    }
    process.stderr.write(`  ${Math.min(i + BATCH, names.length)}/${names.length}\r`);
  }
  process.stderr.write('\n');
  return { verdicts, eraRevision };
}

const idx = JSON.parse(readFileSync(join(ROOT, 'web/public/data/items-index.json'), 'utf8'));
const shipped = (idx.items ?? idx).map((i) => i.n);

const rawQ = JSON.parse(readFileSync(join(ROOT, 'pipeline/quarantine.json'), 'utf8'));
const held = Array.isArray(rawQ) ? rawQ : rawQ.items ?? [];

const record = { api: API, ranAt: new Date().toISOString(), shipped: null, held: null };

/* ------------------------------------------------------ what we already ship */

if (!ONLY_HELD) {
  process.stderr.write(`asking the wiki about ${shipped.length} shipped items ...\n`);
  const { verdicts, eraRevision } = ask(shipped);
  const seen = shipped.map((n) => ({ n, page: verdicts.get(n) })).filter((r) => r.page);
  const contradicted = seen.filter((r) => r.page.outOfEra === true);
  const absent = shipped.filter((n) => verdicts.get(n)?.missing === true);
  console.log('');
  console.log('=== ITEMS WE SHIP ===================================================');
  console.log(`era config revision                     : ${eraRevision}`);
  console.log(`shipped items                           : ${shipped.length}`);
  console.log(`  the wiki has a page for               : ${seen.filter((r) => !r.page.missing).length}`);
  console.log(`  no such page on the wiki              : ${absent.length}`);
  console.log(`  wiki agrees they are in this game     : ${seen.filter((r) => r.page.outOfEra === false).length}`);
  console.log(`  WIKI SAYS OUT OF ERA                  : ${contradicted.length}`);
  if (contradicted.length) {
    console.log('');
    console.log('  items we show that the wiki says are not in this game:');
    for (const r of contradicted.slice(0, 40)) console.log(`     ${r.n}`);
    if (contradicted.length > 40) console.log(`     ... and ${contradicted.length - 40} more`);
  }
  record.shipped = {
    eraRevision,
    total: shipped.length,
    contradicted: contradicted.map((r) => r.n),
    absent,
  };
}

/* --------------------------------------------------------- what we withhold */

if (!ONLY_SHIPPED) {
  process.stderr.write(`asking the wiki about ${held.length} withheld items ...\n`);
  const { verdicts, eraRevision } = ask(held.map((r) => r.n));
  const byReason = new Map();
  for (const row of held) {
    const page = verdicts.get(row.n);
    const bucket = byReason.get(row.why) ?? { total: 0, inEra: 0, outEra: 0, missing: 0, names: [] };
    bucket.total += 1;
    if (!page || page.missing) bucket.missing += 1;
    else if (page.outOfEra === false) { bucket.inEra += 1; if (bucket.names.length < 400) bucket.names.push(row.n); }
    else bucket.outEra += 1;
    byReason.set(row.why, bucket);
  }
  console.log('');
  console.log('=== ITEMS WE WITHHOLD ===============================================');
  console.log(`era config revision                     : ${eraRevision}`);
  console.log('');
  console.log('  reason we withhold it            total   wiki:IN   wiki:OUT   no page');
  let rescuable = 0;
  for (const [why, b] of [...byReason].sort((a, b) => b[1].inEra - a[1].inEra)) {
    rescuable += b.inEra;
    console.log(`  ${why.padEnd(30)} ${String(b.total).padStart(6)} ${String(b.inEra).padStart(9)} ${String(b.outEra).padStart(10)} ${String(b.missing).padStart(9)}`);
  }
  console.log('');
  console.log(`  TOTAL the wiki says are in this game  : ${rescuable}`);
  record.held = {
    eraRevision,
    byReason: Object.fromEntries([...byReason].map(([k, v]) => [k, {
      total: v.total, inEra: v.inEra, outEra: v.outEra, missing: v.missing, names: v.names,
    }])),
    rescuable,
  };
}

if (OUT) {
  writeFileSync(OUT, `${JSON.stringify(record, null, 1)}\n`);
  console.log(`\nwrote ${OUT}`);
}
