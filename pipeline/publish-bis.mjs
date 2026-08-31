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

const byName = new Map();
for (const item of index.items) byName.set(item.n.toLowerCase(), { ...item });
for (const file of readdirSync(join(DATA, 'items')).filter((f) => f.endsWith('.json')).sort()) {
  const shard = JSON.parse(readFileSync(join(DATA, 'items', file), 'utf8'));
  for (const item of shard.items ?? shard) {
    const key = item.n.toLowerCase();
    byName.set(key, { ...(byName.get(key) ?? {}), ...item });
  }
}
const records = [...byName.values()];

if (records.length !== meta.counts?.items) {
  console.error(`FATAL: merged ${records.length} records, meta.counts.items says ${meta.counts?.items}. `
    + 'Refusing to publish a catalogue that disagrees with its own metadata.');
  process.exit(1);
}

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
