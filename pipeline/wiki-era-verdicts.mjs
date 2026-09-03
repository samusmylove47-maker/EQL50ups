#!/usr/bin/env node
/**
 * Vendor the wiki's own out-of-era verdicts.
 *
 * `action=eqlmetadata` (POST-only, from the wiki's `EQLClientData` extension)
 * returns `outOfEra` per page, computed from the wiki's own era config at
 * `eraRevision`. That is the wiki stating something about **EverQuest Legends**
 * rather than about original EverQuest content we then reason over, which makes
 * it a better answer to "is this in the game" than our transcribed era ladder.
 *
 * **Only `outOfEra: true` is recorded, and that is the whole point.**
 *
 * `false` is the default for a page the wiki has not tagged. Measured, not
 * assumed: `10 Dose Ant's Potion` is a player-crafted alchemy item with no era
 * template, no drop zone and no era signal of any kind, and it comes back
 * `false`. So `false` means "not marked out", never "confirmed in", and a file
 * of `false` verdicts would be a file of absences dressed as evidence — the
 * exact mistake `research/SOURCING-STANDARD.md` exists to prevent.
 *
 * `true`, by contrast, is a positive statement somebody made. `Tome of Miragul`
 * carries `{{Kunark Era}}` and comes back `true`. That is worth acting on.
 *
 * USAGE
 *   node pipeline/wiki-era-verdicts.mjs            fetch, report, write nothing
 *   node pipeline/wiki-era-verdicts.mjs --apply    ... and vendor the result
 *
 * EXIT CODES
 *   0  ran
 *   2  could not fetch or parse; nothing was written
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://eqlwiki.com/api.php';
const STAMP = new Date().toISOString().slice(0, 10);
const DEFAULT_OUT = join(ROOT, 'research', 'data', `eqlwiki-era-verdicts-${STAMP}.json`);

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const outAt = argv.indexOf('--out');
const OUT = outAt >= 0 ? argv[outAt + 1] : DEFAULT_OUT;

/** 60 titles per POST, measured: the API returned 60 of 60. */
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

/* Every name this project knows about, shipped or withheld. */
const idx = JSON.parse(readFileSync(join(ROOT, 'web/public/data/items-index.json'), 'utf8'));
const rawQ = JSON.parse(readFileSync(join(ROOT, 'pipeline/quarantine.json'), 'utf8'));
const held = Array.isArray(rawQ) ? rawQ : rawQ.items ?? [];
const names = [...new Set([...(idx.items ?? idx).map((i) => i.n), ...held.map((r) => r.n)])];

process.stderr.write(`asking the wiki about ${names.length} titles ...\n`);
const outOfEra = [];
let missing = 0;
let notMarked = 0;
let eraRevision = null;
for (let i = 0; i < names.length; i += BATCH) {
  const data = eqlmetadata(names.slice(i, i + BATCH));
  eraRevision = data?.eqlmetadata?.eraRevision ?? eraRevision;
  for (const page of data?.eqlmetadata?.pages ?? []) {
    if (page.missing) { missing += 1; continue; }
    // `requested` echoes what was asked, so a title the API normalised is still
    // recorded under the spelling this project holds.
    const asked = (page.requested ?? [page.title]).map((t) => String(t).replace(/_/g, ' '));
    if (page.outOfEra === true) outOfEra.push(...asked);
    else notMarked += 1;
  }
  process.stderr.write(`  ${Math.min(i + BATCH, names.length)}/${names.length}\r`);
}
process.stderr.write('\n');

const unique = [...new Set(outOfEra)].sort();
console.log('');
console.log(`era config revision          : ${eraRevision}`);
console.log(`titles asked about           : ${names.length}`);
console.log(`  the wiki has no such page  : ${missing}`);
console.log(`  NOT marked out of era      : ${notMarked}  (absence of a tag, not evidence of presence)`);
console.log(`  MARKED OUT OF ERA          : ${unique.length}`);

const shipped = new Set((idx.items ?? idx).map((i) => i.n));
const shippedAndOut = unique.filter((n) => shipped.has(n));
console.log('');
console.log(`items we ship that the wiki marks out of era: ${shippedAndOut.length}`);
for (const n of shippedAndOut) console.log(`   ${n}`);

const payload = {
  source: 'eqlwiki.com',
  api: 'action=eqlmetadata (EQLClientData extension, POST-only)',
  note: 'Titles the wiki POSITIVELY marks as out of era for EverQuest Legends. '
    + 'Pages it does not mark are deliberately absent from this file: outOfEra=false is '
    + 'the default for an untagged page and is not a statement that the item is in the game.',
  fetchedAt: new Date().toISOString(),
  eraRevision,
  counts: { asked: names.length, missing, notMarked, outOfEra: unique.length },
  outOfEra: unique,
};
const bytes = `${JSON.stringify(payload, null, 1)}\n`;

if (!APPLY) {
  console.log('\nnothing written. re-run with --apply to vendor it.');
  process.exit(0);
}
writeFileSync(OUT, bytes);
console.log(`\nwrote ${OUT}`);
