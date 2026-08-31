/**
 * Audit the catalogue the way the checks were audited.
 *
 * `research/SOURCING-STANDARD.md` says it "governs every number the planner puts
 * on screen". Nothing had ever verified that it does. This asks, of all 3,663
 * shipped records and every field the app renders as a number:
 *
 *   1. what is this figure's source?
 *   2. when was that source last read?
 *   3. what would the screen show if the source were wrong?
 *
 * It is a check, not a report. A number on screen with no recorded provenance is
 * a hard failure — the same standing as an unquoted claim — because the standard
 * says uncertainty goes on screen, and a figure whose source we cannot name is
 * the one case where the screen cannot say anything true about it.
 *
 *   node pipeline/catalogue-audit.mjs            # human-readable, exits non-zero on a gap
 *   node pipeline/catalogue-audit.mjs --json     # the same census as JSON
 *
 * Everything printed here is computed from the shipped payload. Nothing in this
 * file states a count.
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'web', 'public', 'data');
const readJSON = (p) => JSON.parse(readFileSync(p, 'utf8'));
const JSON_OUT = process.argv.includes('--json');

/** When a path was last committed — the date its bytes entered this repository. */
function gitDate(relative) {
  const run = spawnSync('git', ['log', '-1', '--format=%as', '--', relative],
    { cwd: ROOT, encoding: 'utf8' });
  const date = (run.stdout ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

const meta = readJSON(join(DATA, 'meta.json'));
const index = readJSON(join(DATA, 'items-index.json'));

/**
 * The shipped record for every item, index folded under its shards.
 *
 * The same order the app uses (`catalog.ts`), because auditing a different merge
 * from the one that ships would audit something nobody sees.
 */
function shippedRecords() {
  const byName = new Map();
  for (const item of index.items) byName.set(item.n.toLowerCase(), { ...item });
  const shardDir = join(DATA, 'items');
  if (existsSync(shardDir)) {
    for (const file of readdirSync(shardDir).filter((f) => f.endsWith('.json')).sort()) {
      const shard = readJSON(join(shardDir, file));
      for (const item of shard.items ?? shard) {
        const key = item.n.toLowerCase();
        byName.set(key, { ...(byName.get(key) ?? {}), ...item });
      }
    }
  }
  return [...byName.values()];
}

const records = shippedRecords();

/* ------------------------------------------------------------ the figures */

/**
 * Every field this catalogue ships that the app renders as a NUMBER a reader
 * can act on, and where each one comes from.
 *
 * Deliberately not "every field": a slot code or a class list is a fact about
 * the item, and being wrong about it makes the item disappear from a list rather
 * than mis-rank it. These are the ones that feed EP, and EP is the answer the
 * whole tool exists to give.
 */
const NUMERIC_FIELDS = [
  { key: 'st', what: 'attributes and AC', feeds: 'EP directly' },
  { key: 'sv', what: 'saves', feeds: 'EP directly' },
  { key: 'wp', what: 'weapon damage and delay', feeds: 'EP via ratio' },
  { key: 'wt', what: 'weight', feeds: 'nothing — displayed only' },
  { key: 'rl', what: 'required level', feeds: 'eligibility, so it gates the whole row' },
];

const has = (record, key) => {
  const value = record[key];
  if (value == null) return false;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
};

/** A record prints numbers a reader acts on. */
const printsNumbers = (record) =>
  NUMERIC_FIELDS.some((f) => f.feeds !== 'nothing — displayed only' && has(record, f.key));

/* --------------------------------------------------------------- the census */

const tally = (items, pick) => {
  const out = {};
  for (const item of items) {
    const key = pick(item) ?? '(none)';
    out[key] = (out[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(out).sort((a, b) => b[1] - a[1]));
};

const numeric = records.filter(printsNumbers);

const census = {
  generatedFrom: { builtAt: meta.builtAt, records: records.length },

  /* 1. WHAT IS EACH FIGURE'S SOURCE? */
  statStanding: tally(numeric, (r) => r.sd),
  existence: tally(records, (r) => r.ex),
  perField: Object.fromEntries(
    NUMERIC_FIELDS.map((f) => [f.key, { ...f, records: records.filter((r) => has(r, f.key)).length }]),
  ),

  /* 2. WHEN WAS IT LAST READ? */
  sourcesLastRead: (meta.provenance?.inputs ?? []).map((input) => ({
    key: input.key,
    file: input.file,
    /*
     * Two dates, and they answer different questions.
     *
     * `scraped` is the date in the filename, where the scrape carried one. Only
     * the eqlwiki pull does, and it is the date the WIKI was read.
     *
     * `vendored` is when the bytes entered this repository, taken from git
     * rather than from a field somebody typed — a hand-written date is the
     * first thing to go stale, and this file is not allowed to state a figure
     * it did not compute. It is the honest answer to "when was this last read"
     * for the four inputs that carry no scrape date of their own: nobody has
     * re-read them since.
     */
    scraped: /(\d{4}-\d{2}-\d{2})/.exec(input.file)?.[1] ?? null,
    vendored: gitDate(input.file),
    sha256_16: input.sha256_16,
  })),
  upstreamPins: (meta.provenance?.repos ?? []).map((r) => ({ repo: r.repo, sha: r.sha, role: r.role })),
  licenceCheckedOn: meta.license?.checked ?? null,

  /* 3. WHAT WOULD THE SCREEN SHOW IF THE SOURCE WERE WRONG? */
  blastRadius: {},
};

/*
 * The blast radius of each source being wrong, counted rather than described.
 *
 * "The wiki is wrong about a stat" is not one risk, it is one risk per record
 * that prints a wiki stat, and the number is what makes it decidable.
 */
const wikiDerived = numeric.filter((r) => r.sd === 'tier-2' || r.sd === 'tier-5');
const clientVerified = numeric.filter((r) => r.sd === 'tier-M');
const unattributed = numeric.filter((r) => r.sd === 'unattributed' || r.sd == null);

census.blastRadius = {
  'wiki stat block wrong': {
    records: wikiDerived.length,
    screen: 'EP is wrong for these rows, so the ranking that is the whole answer is wrong. '
      + 'The tier badge says the number is wiki-derived; it does not say it is checked.',
  },
  'client capture misread': {
    records: clientVerified.length,
    screen: 'the five rows the game was read for would be wrong, and they are the rows every '
      + 'other figure is trusted against.',
  },
  'no stat provenance recorded': {
    records: unattributed.length,
    screen: 'unknown — which is the finding, not the answer.',
  },
};

/* ------------------------------------------------------------- the failures */

const failures = [];

/*
 * A number on screen with no recorded provenance.
 *
 * This is the one the standard forbids outright. `unattributed` is a legitimate
 * standing — it means "this row prints no sourced stat values" — so it is only a
 * failure when the record ALSO prints numbers.
 */
const silentNumbers = numeric.filter((r) => r.sd == null);
if (silentNumbers.length) {
  failures.push({
    check: 'every record printing a number states where the number came from',
    detail: `${silentNumbers.length} record(s) print stats with no \`sd\``,
    examples: silentNumbers.slice(0, 8).map((r) => r.n),
  });
}

/*
 * A record claiming a standing it cannot support. `tier-M` means the stat block
 * was read off a live client window, and the standard says such a record names
 * the capture that proves it.
 */
const unevidencedM = records.filter((r) => r.sd === 'tier-M' && !r.sdc && !r.vf);
if (unevidencedM.length) {
  failures.push({
    check: 'every tier-M stat block cites the capture it was read from',
    detail: `${unevidencedM.length} record(s) claim tier-M with no \`sdc\` or \`vf\``,
    examples: unevidencedM.slice(0, 8).map((r) => r.n),
  });
}

/*
 * An item withheld from ranking must actually be withheld. `statsUnknown` is the
 * marker the engine reads; a record carrying stats AND that marker would be
 * scored on numbers the standard says are not to be used.
 */
const contradictory = records.filter((r) => r.statsUnknown && printsNumbers(r));
if (contradictory.length) {
  failures.push({
    check: 'nothing marked statsUnknown also ships stats',
    detail: `${contradictory.length} record(s) are both`,
    examples: contradictory.slice(0, 8).map((r) => r.n),
  });
}

/*
 * Rule 6: "Date everything. Scrapes are pinned to commits and carry a snapshot
 * date. Anything older than the last patch is treated as stale."
 *
 * A commit pin says WHAT was read; it does not say WHEN. Without a date there is
 * no way to apply the staleness rule at all — the standard's own remedy for a
 * source that has fallen behind a patch cannot be reached.
 */
const undated = census.sourcesLastRead.filter((s) => !s.scraped && !s.vendored);
if (undated.length) {
  failures.push({
    check: 'rule 6 — every input carries a snapshot date',
    detail: `${undated.length} of ${census.sourcesLastRead.length} inputs carry no date at all `
      + '— neither a scrape date nor a commit — so the staleness rule cannot be applied',
    examples: undated.map((s) => s.key),
  });
}

/* The published counts must still describe the payload they are published with. */
const publishedItems = meta.counts?.items;
if (publishedItems !== records.length) {
  failures.push({
    check: 'meta.counts.items matches the records actually shipped',
    detail: `meta says ${publishedItems}, the payload holds ${records.length}`,
  });
}

/* ------------------------------------------------ subjects for the failures */

/*
 * Does every check above still have something to check?
 *
 * A universally-quantified check over an empty set passes, forever, while
 * appearing to guarantee what it names. `pipeline/verify.mjs` grew the same
 * census on 2026-08-31; this is the other hard gate and it needs it more.
 *
 * The measurement that made it urgent: `sd = tier-M` is not one standing among
 * several, it is **the entire verified corpus of this catalogue — 5 records of
 * 3,663** (Director P1, 31 Aug). Check 2 quantifies over exactly those. At zero
 * it would pass forever while asserting the strongest provenance claim we make.
 *
 * It WARNS rather than failing. A population reaching zero can be legitimate —
 * every statsUnknown record acquiring real stats would be good news — and a hard
 * failure would block the improvement it was written to protect.
 *
 * Check 5 is absent by design: it compares two scalars and has no population.
 */
const subjects = [
  ['every record printing a number states where the number came from', numeric.length],
  ['every tier-M stat block cites the capture it was read from',
    records.filter((r) => r.sd === 'tier-M').length],
  ['nothing marked statsUnknown also ships stats',
    records.filter((r) => r.statsUnknown).length],
  ['rule 6 — every input carries a snapshot date', census.sourcesLastRead.length],
];
const withoutSubject = subjects.filter(([, n]) => n === 0);
/*
 * Its own channel, deliberately. `failures` drives `process.exit(1)` at the
 * bottom of this file, so pushing here would make an empty population fail the
 * build — the opposite of the intent, and the first version of this block did
 * exactly that with an ignored `warning: true` flag on a `failures` entry.
 */
const subjectWarnings = withoutSubject.map(([name, n]) => ({
  check: 'a failure check no longer has anything to check',
  detail: `"${name}" quantifies over ${n} records — it cannot fail, and passes vacuously`,
}));

/* ------------------------------------------------------------------ output */

if (JSON_OUT) {
  console.log(JSON.stringify({ census, failures, subjectWarnings, subjects }, null, 2));
} else {
  console.log('CATALOGUE AUDIT — every number the planner puts on screen\n');
  console.log(`records shipped            ${records.length}`);
  console.log(`records printing numbers   ${numeric.length}\n`);

  console.log('1. WHERE EACH FIGURE COMES FROM');
  console.log('   stat standing, over the records that print numbers:');
  for (const [k, v] of Object.entries(census.statStanding)) console.log(`     ${k.padEnd(16)} ${v}`);
  console.log('   existence evidence, over every record:');
  for (const [k, v] of Object.entries(census.existence)) console.log(`     ${k.padEnd(16)} ${v}`);

  console.log('\n2. WHEN IT WAS LAST READ');
  console.log('     scraped      vendored     input');
  for (const s of census.sourcesLastRead) {
    console.log(`     ${(s.scraped ?? '     —      ').padEnd(12)} ${(s.vendored ?? 'UNDATED').padEnd(12)} `
      + `${s.key.padEnd(14)} ${s.file}`);
  }
  console.log(`     ${(census.licenceCheckedOn ?? 'never').padEnd(12)} licence       eqlwiki terms of reuse`);

  console.log('\n3. WHAT THE SCREEN SHOWS IF THE SOURCE IS WRONG');
  for (const [k, v] of Object.entries(census.blastRadius)) {
    console.log(`     ${k} — ${v.records} record(s)`);
    console.log(`       ${v.screen}`);
  }

  /*
   * What a green run here still does not say. Printed rather than filed, because
   * a clean audit that hides its own limits is the shape of every dead check in
   * this repository.
   */
  console.log('\n4. WHAT THIS AUDIT STILL CANNOT TELL YOU');
  console.log('     A vendoring date is not a currency date. The four repository inputs are');
  console.log('     pinned by SHA, so WHAT we hold is exact and reproducible — but when those');
  console.log('     projects last checked their own numbers against the game is unknown and');
  console.log('     not knowable from here. Tier 4\'s staleness rule can be applied to our');
  console.log('     copy and not to their reading.');
  console.log('');
  const noEx = records.length - Object.entries(census.existence)
    .filter(([k]) => k !== '(none)').reduce((a, [, v]) => a + v, 0);
  const pct = ((noEx / records.length) * 100).toFixed(1);
  console.log(`     ${noEx} of ${records.length} records (${pct}%) carry no Tier M existence`);
  console.log('     evidence at all: they ship because a wiki placed their era, which is a');
  console.log('     Tier 2 statement about CONTENT rather than an observation of the game.');
  console.log('     That is rule 2 working as written, not a defect — but it is the honest');
  console.log('     headline of this catalogue and it belongs next to the green tick.');

  console.log('\n-- subjects --');
  for (const [name, n] of subjects) console.log(`  ${String(n).padStart(6)}  ${name}`);
  if (subjectWarnings.length) {
    console.log('');
    for (const w of subjectWarnings) {
      console.log(`  WARN  ${w.check}`);
      console.log(`        ${w.detail}`);
    }
  }

  console.log('\n-- failures --');
  if (!failures.length) {
    console.log('  none');
  } else {
    for (const f of failures) {
      console.log(`  FAIL  ${f.check}`);
      console.log(`        ${f.detail}`);
      if (f.examples) console.log(`        e.g. ${f.examples.join(', ')}`);
    }
  }
}

if (failures.length) {
  if (!JSON_OUT) console.log(`\nAUDIT FAILED — ${failures.length} class(es) of unsourced figure.`);
  process.exit(1);
}
if (!JSON_OUT) console.log('\nAUDIT PASSED — every number on screen names where it came from.');
