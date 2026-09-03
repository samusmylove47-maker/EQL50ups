#!/usr/bin/env node
/**
 * Vendor the live wiki's spell corpus.
 *
 * The owner, 2026-09-03: *"We **NEED** this information."*, naming
 * `Call of Flame` — a Ranger spell that materially changes their DPS.
 *
 * Four spell datasets were already vendored in `research/data/` and read by
 * nothing. `pipeline/probe-spells.mjs` measures them: 1,928 spells, effects
 * parsed on 1,927, and `Call of Flame` present in all four with the right
 * numbers. So the first answer is that we were not missing the data.
 *
 * We were missing *half of each record*. Checked against the live wiki, the
 * vendored `Call of Flame` has damage, mana, cast time, class and level — and
 * lacks **recast time, range, resist type, skill and how you obtain it**. For a
 * tool that ranks damage per second, recast time is not a nice-to-have: a
 * 300-damage nuke on a 10-second recast and a 300-damage nuke on a 2-second
 * recast are different spells, and the vendored corpus cannot tell them apart.
 *
 * The wiki carries all of it, structured, in a `Spellpagesmart` template. This
 * reads that template rather than the rendered page, so every field is taken as
 * the author entered it and nothing is inferred from prose.
 *
 * NOTHING IS WRITTEN WITHOUT `--apply`, following `refresh.mjs`.
 *
 *   node pipeline/wiki-spells.mjs               fetch, report, write nothing
 *   node pipeline/wiki-spells.mjs --apply       ... and vendor the result
 *
 * EXIT CODES
 *   0  ran
 *   2  could not fetch or parse; nothing was written
 */

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://eqlwiki.com/api.php';
const STAMP = new Date().toISOString().slice(0, 10);
const DEFAULT_OUT = join(ROOT, 'research', 'data', `eqlwiki-spells-${STAMP}.json`);

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const outAt = argv.indexOf('--out');
const OUT = outAt >= 0 ? argv[outAt + 1] : DEFAULT_OUT;

function api(params) {
  const qs = new URLSearchParams({ format: 'json', formatversion: '2', ...params });
  let body;
  try {
    body = execFileSync('curl', ['-sSL', '-m', '90', '--compressed', `${API}?${qs}`],
      { encoding: 'utf8', maxBuffer: 96 * 1024 * 1024 });
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

/* --------------------------------------------------------- the page listing */

process.stderr.write('enumerating live Category:Spells ...\n');
const titles = [];
let cont;
do {
  const data = api({
    action: 'query', list: 'categorymembers', cmtitle: 'Category:Spells',
    cmlimit: '500', cmnamespace: '0', ...(cont ? { cmcontinue: cont } : {}),
  });
  for (const m of data?.query?.categorymembers ?? []) titles.push(m.title);
  cont = data?.continue?.cmcontinue;
  process.stderr.write(`  ${titles.length}\r`);
} while (cont);
process.stderr.write(`\n  ${titles.length} pages in Category:Spells\n`);

/* ------------------------------------------------------------- the template */

/**
 * One `| name = value` parameter of the spell template.
 *
 * Values run to the next top-level `|` at the start of a line, or to the
 * closing `}}`. Matching line-anchored pipes is what keeps a `{{...|...}}`
 * inside a value — and the `slots` field is full of them — from truncating it.
 */
function field(text, name) {
  const re = new RegExp(`^\\|\\s*${name}\\s*=([\\s\\S]*?)(?=^\\|\\s*\\w|^\\}\\})`, 'im');
  const m = re.exec(text);
  if (!m) return null;
  const v = m[1].trim();
  return v === '' ? null : v;
}

const num = (v) => {
  if (v == null) return null;
  const m = /-?\d+(?:\.\d+)?/.exec(v);
  return m ? Number(m[0]) : null;
};

/** `* [[Ranger]] - Level 49` -> `{ cls: 'Ranger', level: 49 }`. */
function classesOf(v) {
  if (!v) return [];
  const out = [];
  for (const m of v.matchAll(/\[\[([^\]|]+?)(?:\|[^\]]*)?\]\]\s*-\s*Level\s*(\d+)/gi)) {
    out.push({ cls: m[1].trim(), level: Number(m[2]) });
  }
  // Some pages omit the wiki link and write the class bare.
  if (!out.length) {
    for (const m of v.matchAll(/\*\s*([A-Za-z ]+?)\s*-\s*Level\s*(\d+)/g)) {
      out.push({ cls: m[1].trim(), level: Number(m[2]) });
    }
  }
  return out;
}

/**
 * `{{SpellSlotRowSmart | 1 | Decrease Hitpoints by 300 | ... }}` — the numbered
 * effect slots. The magnitude is left inside the sentence rather than pulled
 * out: the phrasing is the wiki's and a second parser guessing at it is how two
 * readings of one field start to disagree.
 */
function slotsOf(v) {
  if (!v) return [];
  const out = [];
  for (const m of v.matchAll(/\{\{\s*SpellSlotRowSmart\s*\|\s*(\d+)\s*\|([^|}]*)/gi)) {
    const text = m[2].replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, '$2').trim();
    if (text) out.push({ slot: Number(m[1]), text });
  }
  return out;
}

const stripLinks = (v) => (v == null ? null
  : v.replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, '$2').replace(/\s+/g, ' ').trim() || null);

const eraOf = (text) => {
  const m = /\{\{\s*([A-Za-z' ]+?)\s*Era\s*\}\}/.exec(text);
  return m ? m[1].trim() : null;
};

/* --------------------------------------------------------------- the fetch */

const records = [];
const absent = [];
const noTemplate = [];
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
    if (!/\{\{\s*Spellpage/i.test(text)) { noTemplate.push(title); continue; }

    const classes = classesOf(field(text, 'classes'));
    records.push({
      name: field(text, 'spellname') ?? page.title,
      page: page.title,
      pageid: page.pageid ?? null,
      revid: page.revisions?.[0]?.revid ?? null,
      touched: page.touched ?? null,
      era: eraOf(text),
      description: stripLinks(field(text, 'description')),
      classes,
      minLevel: classes.length ? Math.min(...classes.map((c) => c.level)) : null,
      slots: slotsOf(field(text, 'slots')),
      skill: stripLinks(field(text, 'skill')),
      mana: num(field(text, 'mana')),
      range: num(field(text, 'range')),
      castTime: num(field(text, 'casting_time')),
      fizzleTime: num(field(text, 'fizzle_time')),
      // The field a DPS ranking cannot work without, and the reason this file
      // exists alongside the vendored jmoyers corpus, which has no such field.
      recastTime: num(field(text, 'recast_time')),
      duration: stripLinks(field(text, 'duration')),
      targetType: stripLinks(field(text, 'target_type')),
      spellType: stripLinks(field(text, 'spell_type')),
      resist: stripLinks(field(text, 'resist')),
      whereToObtain: stripLinks(field(text, 'where_to_obtain')),
    });
  }
  process.stderr.write(`  ${Math.min(i + 50, titles.length)}/${titles.length}\r`);
}
process.stderr.write('\n');

/* --------------------------------------------------------------- the report */

const withRecast = records.filter((r) => r.recastTime != null);
const withMana = records.filter((r) => r.mana != null);
const withClass = records.filter((r) => r.classes.length);
const inCap = records.filter((r) => r.minLevel != null && r.minLevel <= 50);
const eraCount = new Map();
for (const r of records) eraCount.set(r.era ?? '(none)', (eraCount.get(r.era ?? '(none)') ?? 0) + 1);

console.log('');
console.log(`pages in Category:Spells        : ${titles.length}`);
console.log(`  carrying a spell template     : ${records.length}`);
console.log(`  no spell template (NPC, misc) : ${noTemplate.length}`);
console.log(`  page absent                   : ${absent.length}`);
console.log('');
console.log(`  naming a class and a level    : ${withClass.length}`);
console.log(`  ...castable at level 50 or below: ${inCap.length}`);
console.log(`  carrying a mana cost          : ${withMana.length}`);
console.log(`  CARRYING A RECAST TIME        : ${withRecast.length}`);
console.log('');
console.log('  era stated on the page:');
for (const [era, n] of [...eraCount].sort((a, b) => b[1] - a[1])) {
  console.log(`    ${String(n).padStart(5)}  ${era}`);
}

const perClass = new Map();
for (const r of records) {
  for (const c of r.classes) {
    const b = perClass.get(c.cls) ?? { total: 0, inCap: 0 };
    b.total += 1;
    if (c.level <= 50) b.inCap += 1;
    perClass.set(c.cls, b);
  }
}
console.log('');
console.log('  class                 spells   <= level 50');
for (const [cls, b] of [...perClass].sort((a, b) => b[1].total - a[1].total)) {
  console.log(`  ${cls.padEnd(20)} ${String(b.total).padStart(6)} ${String(b.inCap).padStart(12)}`);
}

const cof = records.find((r) => /^call of flame$/i.test(r.name));
if (cof) {
  console.log('');
  console.log('  the spell the request named:');
  console.log(`    ${JSON.stringify(cof)}`);
}

const payload = {
  source: 'eqlwiki.com',
  note: 'Live-wiki spell corpus, read from the Spellpagesmart template rather than the '
    + 'rendered page. Carries recast time, range, resist, skill and acquisition, none of '
    + 'which the vendored jmoyers spell datasets have.',
  fetchedAt: new Date().toISOString(),
  categoryCount: titles.length,
  counts: {
    withTemplate: records.length,
    noTemplate: noTemplate.length,
    absent: absent.length,
    withClass: withClass.length,
    inCap: inCap.length,
    withMana: withMana.length,
    withRecast: withRecast.length,
  },
  spells: records.sort((a, b) => a.name.localeCompare(b.name)),
};
const bytes = `${JSON.stringify(payload, null, 1)}\n`;
console.log('');
console.log(`sha256 of the candidate         : ${createHash('sha256').update(bytes).digest('hex')}`);

if (!APPLY) {
  console.log('\nnothing written. re-run with --apply to vendor it.');
  process.exit(0);
}
writeFileSync(OUT, bytes);
console.log(`\nwrote ${OUT}`);
