/**
 * Publish 50 Upgrades' half of the BIS seam as two self-contained files.
 *
 * Session A owns the website and is offline; the Director's brief says the
 * output must be consumable without any website change. So this emits artifacts
 * a consumer loads directly, on the convention E already ships to:
 *
 *   web/public/bis/eqls-50upgrades.<sha256[:8]>.js   the enumerator, one file
 *   web/public/bis/bis-catalog.json                  the merged records
 *   web/public/bis/manifest.json                     hashes, counts, version
 *
 * ## Why the catalogue is emitted and not left to the consumer
 *
 * The shipped payload is an index plus 23 slot shards, and a record's final
 * shape is the two merged — `{...indexItem, ...shardItem}` keyed by lowercased
 * name, shard fields winning. That merge is not obvious and it is easy to get
 * wrong in a way nothing catches: on 2026-08-31 an A/B of `catalogue-audit.mjs`
 * reported three of five checks dead, and the whole result was a mutation
 * applied to shards only while the index quietly restored the field. Shipping
 * the merged records means no consumer has to rediscover that.
 *
 *   node pipeline/publish-bis.mjs
 *
 * Run `npm run build:bis` in `web/` first; this refuses rather than publishing
 * a stale bundle.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'web', 'public', 'data');
const BUNDLE = join(ROOT, 'web', 'dist-bis', 'eqls-50upgrades.js');
const OUT = join(ROOT, 'web', 'public', 'bis');

if (!existsSync(BUNDLE)) {
  console.error(`FATAL: ${BUNDLE} is missing. Run: cd web && npm run build:bis`);
  process.exit(2);
}

const sha = (buf) => createHash('sha256').update(buf).digest('hex');

/* --------------------------------------------------------- merged records */

const meta = JSON.parse(readFileSync(join(DATA, 'meta.json'), 'utf8'));
const index = JSON.parse(readFileSync(join(DATA, 'items-index.json'), 'utf8'));

/*
 * EXPECTED SHARDS — an independent restatement, the same device verify.mjs §6
 * uses, and here for a demonstrated reason rather than a stylistic one.
 *
 * Measured 2026-09-01, in a scratchpad copy of the tracked tree with all 19
 * shard files deleted:
 *
 *   published web/public/bis/
 *     bis-catalog.json  696692 bytes  3663 records (1713 with stats,
 *                                                   0 with obtainability)
 *   EXIT=0
 *
 * Half the catalogue gone — 1,440,016 bytes down to 696,692, obtainability
 * 3,456 down to 0 — published with a clean exit and a manifest that recorded
 * the truncated hash and size as though they were correct. The guard below
 * `records.length !== meta.counts.items` cannot fire on this: every record is
 * seeded from the index and the shards contribute no NEW names (3,663 either
 * way, measured), so shard loss does not move the count being compared. A
 * partial loss moves it no further.
 *
 * So the vocabulary is restated here rather than read off the directory, and
 * the coverage figures are re-derived FROM THE SHARDS rather than from the
 * merged result — a count taken from the thing being checked checks nothing.
 */
const SLOTS = ['EAR', 'HEAD', 'FACE', 'NECK', 'SHOULDERS', 'ARMS', 'BACK', 'WRIST', 'RANGE',
  'HANDS', 'PRIMARY', 'SECONDARY', 'FINGERS', 'CHEST', 'LEGS', 'FEET', 'WAIST', 'AMMO'];
const EXPECTED_SHARDS = new Set([...SLOTS, 'OTHER'].map((s) => `${s}.json`));

const shardFiles = new Set(readdirSync(join(DATA, 'items')).filter((f) => f.endsWith('.json')));
const missingShards = [...EXPECTED_SHARDS].filter((f) => !shardFiles.has(f)).sort();
const extraShards = [...shardFiles].filter((f) => !EXPECTED_SHARDS.has(f)).sort();
if (missingShards.length || extraShards.length) {
  console.error(`FATAL: shard set does not match the slot vocabulary. `
    + `missing=[${missingShards.join(',')}] extra=[${extraShards.join(',')}]. `
    + 'Refusing to publish a catalogue assembled from an incomplete payload.');
  process.exit(1);
}

const byName = new Map();
for (const item of index.items) byName.set(item.n.toLowerCase(), { ...item });

const shardCounts = new Map();
for (const file of [...shardFiles].sort()) {
  const shard = JSON.parse(readFileSync(join(DATA, 'items', file), 'utf8'));
  const shardItems = shard.items ?? shard;
  shardCounts.set(file.replace(/\.json$/, ''), shardItems.length);
  for (const item of shardItems) {
    const key = item.n.toLowerCase();
    byName.set(key, { ...(byName.get(key) ?? {}), ...item });
  }
}
const records = [...byName.values()];

/*
 * Every shard read the number of items build.mjs says it wrote.
 *
 * `meta.counts.perSlot` comes from the OTHER program. That is the whole value
 * of it: a count taken from the file being checked checks nothing. My first
 * attempt at this guard compared the merged records against a set built in the
 * merge loop itself, which was very nearly a tautology — it could not fail, and
 * an A/B that flipped the merge order published at exit 0 with the guard
 * silent. Replaced rather than kept alongside.
 */
const countMismatches = [];
for (const [slot, n] of [...shardCounts].sort()) {
  const declared = meta.counts?.perSlot?.[slot];
  if (declared !== n) countMismatches.push(`${slot}: shard has ${n}, meta.counts.perSlot says ${declared}`);
}
if (countMismatches.length) {
  console.error(`FATAL: shard contents disagree with the payload's own metadata:\n  `
    + `${countMismatches.join('\n  ')}\nRefusing to publish.`);
  process.exit(1);
}

if (records.length !== meta.counts?.items) {
  console.error(`FATAL: merged ${records.length} records, meta.counts.items says ${meta.counts?.items}. `
    + 'Refusing to publish a catalogue that disagrees with its own metadata.');
  process.exit(1);
}

/*
 * The check the record count cannot make.
 *
 * `src` and `st` exist only in the shards; `meta.counts` is written by
 * build.mjs. So this compares the RESULT of the merge against a number from a
 * different program — which is what makes it capable of failing. The record
 * count above cannot: every record is seeded from the index, the shards
 * contribute no new names, and 3,663 shards or no shards is still 3,663.
 */
const coverage = [
  ['withAcquisition', records.filter((r) => r.src).length],
  ['withStats', records.filter((r) => Object.keys(r.st ?? {}).length).length],
];
const covMismatches = coverage
  .filter(([key, got]) => got !== meta.counts?.[key])
  .map(([key, got]) => `${key}: merged records have ${got}, meta.counts says ${meta.counts?.[key]}`);
if (covMismatches.length) {
  console.error(`FATAL: the merge lost or invented data:\n  ${covMismatches.join('\n  ')}\n`
    + 'Refusing to publish.');
  process.exit(1);
}

/* ------------------------------------------------------- the contract's id */

const CONTRACT_REL = 'web/src/engine/bis-contract.ts';
const contractSource = readFileSync(join(ROOT, CONTRACT_REL));
const versionMatch = /export const BIS_CONTRACT_VERSION\s*=\s*'([^']+)'/
  .exec(contractSource.toString('utf8'));
if (!versionMatch) {
  console.error(`FATAL: no BIS_CONTRACT_VERSION found in ${CONTRACT_REL}. `
    + 'Refusing to publish a manifest that cannot say which contract it implements.');
  process.exit(1);
}
const contractVersion = versionMatch[1];

/* -------------------------------------------------------------- the write */

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const bundle = readFileSync(BUNDLE);
const bundleHash = sha(bundle).slice(0, 8);
const bundleName = `eqls-50upgrades.${bundleHash}.js`;
writeFileSync(join(OUT, bundleName), bundle);

const catalogue = JSON.stringify({
  v: meta.v,
  builtAt: meta.builtAt,
  note: 'Index and shards already merged. Records are the shape engine/bis.ts expects.',
  sourceStanding: meta.sourceStanding,
  surveyedZones: (meta.zones?.surveyed ?? []).map((z) => ({ title: z.title, levels: z.levels ?? null })),
  records,
});
writeFileSync(join(OUT, 'bis-catalog.json'), catalogue);

const withStats = records.filter((r) => Object.keys(r.st ?? {}).length).length;
const withSrc = records.filter((r) => r.src).length;

const manifest = {
  contract: 'web/src/engine/bis-contract.ts',
  /*
   * WHICH contract, not just where it lives.
   *
   * `bis-contract.ts` says of its own version constant: "E asserts on this
   * before reading a payload." It shipped for a day without reaching the
   * manifest, so the assertion E was told to make was one E could not make —
   * a consumer holding these three files could name the contract's PATH and
   * nothing about which revision of it the bundle implements.
   *
   * The hash is here for the reason the gap-engine pin needed one: two
   * different byte-sets shipped upstream as `1.2.0` in a single night, and a
   * version string alone cannot separate them. A version says what changed on
   * purpose; a hash says whether anything changed at all.
   *
   * Extracted by regex because this is an .mjs script and the constant lives
   * in TypeScript. That is the weak link, and it is guarded by the strong one:
   * `bis-contract.test.ts` imports the real constant and fails if this file
   * and that one ever disagree.
   */
  contractVersion,
  contractSha256_8: sha(contractSource).slice(0, 8),
  /*
   * WHERE THE RECORDS ARE. One line, and it exists because the artifact
   * without it produced the same fault in two independent consumers ten
   * minutes apart on 2026-08-31:
   *
   *   - one grepped for key names not in this schema, found nothing, and
   *     nearly reported the shipped catalogue empty;
   *   - the other took `surveyedZones` — the FIRST list-valued key in the file
   *     — instead of `records`, reported 13 records and no source data, and
   *     was one line from reporting the seam broken.
   *
   * Neither was caught by a check; both were caught by looking twice. That is
   * not two mistakes, it is a property of a file that does not say where its
   * records live. Naming the path makes the error unrepresentable.
   */
  recordsAt: 'records',
  surveyedZonesAt: 'surveyedZones',
  bundle: { file: bundleName, sha256_8: bundleHash, bytes: bundle.length, global: 'EQLS50Upgrades' },
  catalogue: {
    file: 'bis-catalog.json',
    sha256_8: sha(catalogue).slice(0, 8),
    bytes: Buffer.byteLength(catalogue),
    records: records.length,
    withStats,
    withObtainability: withSrc,
  },
  builtAt: meta.builtAt,
  /* Stated because a consumer must not read our confidence off the record count. */
  caveat: 'Stat values are overwhelmingly wiki-derived. Every record carries `sd`; '
    + `only ${records.filter((r) => r.sd === 'tier-M').length} of ${records.length} are tier-M.`,
};
writeFileSync(join(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`published web/public/bis/`);
console.log(`  ${bundleName}  ${bundle.length} bytes  global EQLS50Upgrades`);
console.log(`  bis-catalog.json  ${manifest.catalogue.bytes} bytes  ${records.length} records `
  + `(${withStats} with stats, ${withSrc} with obtainability)`);
console.log(`  manifest.json`);
