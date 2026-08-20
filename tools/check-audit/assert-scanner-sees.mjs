/**
 * Assert that the contamination scanner still sees what the shipped report says.
 *
 * `pipeline/contamination.mjs` writes a report; it does not pass or fail, so
 * `audit.py` has nothing to read an exit code from. This wraps it into a check:
 * re-scan into a temp file and compare the findings against the committed
 * `contamination.json`. Equal is exit 0.
 *
 * That makes it damageable in the way the audit needs — inject a real code site
 * and the fresh scan finds one more than the report records, so this exits 1 —
 * and it is worth having on its own, because it fails on a scanner that has
 * stopped matching as well as on a report that has gone stale.
 *
 * Note the difference from `verify.mjs`'s freshness check, which compares the
 * *corpus* (how much was scanned). This compares the *findings* (what was
 * found). A scanner whose predicates silently stopped matching would pass that
 * one and fail this one.
 *
 *   node tools/check-audit/assert-scanner-sees.mjs
 */

import { readFileSync, existsSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const COMMITTED = join(ROOT, 'web', 'public', 'data', 'contamination.json');

if (!existsSync(COMMITTED)) {
  console.error('no web/public/data/contamination.json — run node pipeline/build.mjs');
  process.exit(2);
}

const tmp = join(tmpdir(), `eql-scanner-check-${process.pid}.json`);
const run = spawnSync(process.execPath, [join(ROOT, 'pipeline', 'contamination.mjs')], {
  env: { ...process.env, CONTAMINATION_OUT: tmp },
  encoding: 'utf8',
});

if (run.status !== 0 || !existsSync(tmp)) {
  console.error(`contamination.mjs exited ${run.status}: ${(run.stderr || '').slice(0, 400)}`);
  process.exit(2);
}

const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
const committed = read(COMMITTED);
const fresh = read(tmp);
rmSync(tmp, { force: true });

/** Every finding, as a flat comparable set of `signature|file:line` strings. */
function sites(report) {
  const out = [];
  for (const signature of report.signatures ?? []) {
    for (const site of signature.codeSites ?? []) {
      out.push(`${signature.id}|${site.file}:${site.line}`);
    }
  }
  return out.sort();
}

const before = sites(committed);
const after = sites(fresh);
const added = after.filter((s) => !before.includes(s));
const gone = before.filter((s) => !after.includes(s));

if (added.length === 0 && gone.length === 0) {
  console.log(`scanner agrees with the shipped report — ${after.length} code site(s)`);
  process.exit(0);
}

console.error('the scanner no longer agrees with web/public/data/contamination.json');
for (const s of added) console.error(`  + ${s}   (found now, not in the report)`);
for (const s of gone) console.error(`  - ${s}   (in the report, not found now)`);
console.error('\nIf the source genuinely changed, re-run node pipeline/build.mjs and commit.');
process.exit(1);
