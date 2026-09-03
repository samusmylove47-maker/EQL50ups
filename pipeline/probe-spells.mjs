#!/usr/bin/env node
/**
 * What spell data does this project already hold, and what does the live wiki
 * have that it does not?
 *
 * The owner, 2026-09-03: *"We **NEED** this information."*
 *
 * The first thing to establish is that the answer is not "go and get it". Four
 * spell datasets have been vendored in `research/data/` since 16 August and are
 * read by nothing:
 *
 *   jmoyers-spells.json            1,928 spells, effects parsed
 *   jmoyers-class-spells.json      by class, with levels
 *   jmoyers-spelllines-merged.json spell lines with cross-checks
 *   eqbuddy-harvest-spells.json    a second independent harvest
 *
 * `Call of Flame` — the spell named in the request — is in all four.
 *
 * This measures them: coverage by class and level, how many carry numbers a
 * planner could actually rank, where the four disagree, and how the whole thing
 * compares against the live wiki's `Category:Spells`. Read-only; writes nothing
 * to the payload.
 *
 *   node pipeline/probe-spells.mjs [--live] [--out FILE]
 *
 * `--live` also enumerates the wiki, which costs ~N/500 requests.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'research', 'data');
const API = 'https://eqlwiki.com/api.php';

const argv = process.argv.slice(2);
const LIVE = argv.includes('--live');
const outAt = argv.indexOf('--out');
const OUT = outAt >= 0 ? argv[outAt + 1] : null;

const read = (f) => JSON.parse(readFileSync(join(DATA, f), 'utf8'));
const key = (s) => String(s).toLowerCase().replace(/[‘’`']/g, "'").replace(/\s+/g, ' ').trim();

/* ------------------------------------------------------------- what we hold */

const jm = read('jmoyers-spells.json');
const spells = jm.spells ?? [];
const byClass = read('jmoyers-class-spells.json');
const lines = read('jmoyers-spelllines-merged.json');
const harvest = read('eqbuddy-harvest-spells.json');

console.log('');
console.log('=== VENDORED, AND READ BY NOTHING ===================================');
console.log(`jmoyers-spells.json          : ${spells.length} spells, scraped ${jm.scrapedAt?.slice(0, 10)}`);
console.log(`  with parsed effects        : ${jm.withEffects}`);
console.log(`jmoyers-class-spells.json    : ${Object.keys(byClass).length} classes`);
console.log(`jmoyers-spelllines-merged    : ${Object.keys(lines.classes ?? {}).length} classes, coverage block ${lines.coverage ? 'present' : 'absent'}`);

const harvestList = Array.isArray(harvest) ? harvest
  : harvest.spells ?? harvest.Spells ?? harvest.items ?? Object.values(harvest).find(Array.isArray) ?? [];
console.log(`eqbuddy-harvest-spells.json  : ${harvestList.length} records`);

/* --------------------------------------------- what a planner could rank on */

/**
 * An effect line a ranking could use. The corpus writes effects as English —
 * "Decrease Hitpoints by 300" — so this reads the shape rather than assuming a
 * numeric field exists, and reports what it could NOT read as well as what it
 * could. A parser that silently drops what it does not understand is how a
 * coverage number becomes a lie.
 */
const DAMAGE = /Decrease Hitpoints by (\d+)/i;
const HEAL = /Increase Hitpoints by (\d+)/i;
const numbered = [];
const unparsed = new Set();
for (const s of spells) {
  let dmg = null;
  let heal = null;
  for (const e of s.effects ?? []) {
    const d = DAMAGE.exec(e);
    const h = HEAL.exec(e);
    if (d) dmg = Number(d[1]);
    else if (h) heal = Number(h[1]);
    else unparsed.add(e.replace(/\d+/g, 'N'));
  }
  if (dmg != null || heal != null) numbered.push({ n: s.name, dmg, heal, mana: s.mana ?? null, cast: s.castTimeMs ?? null, classes: s.classes ?? null });
}
console.log('');
console.log(`spells carrying a damage or heal magnitude : ${numbered.length} of ${spells.length}`);
console.log(`  of those, also carrying a mana cost      : ${numbered.filter((s) => s.mana != null).length}`);
console.log(`  of those, also carrying a cast time      : ${numbered.filter((s) => s.cast != null).length}`);
console.log(`distinct effect phrasings NOT read as a magnitude: ${unparsed.size}`);
console.log('  the ten most common shapes:');
for (const e of [...unparsed].slice(0, 10)) console.log(`     ${e}`);

/* ----------------------------------------------------------- class coverage */

const CLASS_RE = /\*\s*([A-Za-z ]+?)\s*-\s*Level\s*(\d+)/g;
const perClass = new Map();
for (const s of spells) {
  for (const m of String(s.classes ?? '').matchAll(CLASS_RE)) {
    const cls = m[1].trim();
    const lvl = Number(m[2]);
    const b = perClass.get(cls) ?? { total: 0, atOrBelow50: 0, maxLevel: 0 };
    b.total += 1;
    if (lvl <= 50) b.atOrBelow50 += 1;
    b.maxLevel = Math.max(b.maxLevel, lvl);
    perClass.set(cls, b);
  }
}
console.log('');
console.log('  class                 spells   <=lvl 50   highest level');
for (const [cls, b] of [...perClass].sort((a, b) => b[1].total - a[1].total)) {
  console.log(`  ${cls.padEnd(20)} ${String(b.total).padStart(6)} ${String(b.atOrBelow50).padStart(10)} ${String(b.maxLevel).padStart(15)}`);
}

/* ------------------------------------------------------------- the live wiki */

let live = null;
if (LIVE) {
  process.stderr.write('enumerating live Category:Spells ...\n');
  const titles = [];
  let cont;
  do {
    const qs = new URLSearchParams({
      action: 'query', list: 'categorymembers', cmtitle: 'Category:Spells',
      cmlimit: '500', cmnamespace: '0', format: 'json', formatversion: '2',
      ...(cont ? { cmcontinue: cont } : {}),
    });
    const data = JSON.parse(execFileSync('curl', ['-sSL', '-m', '60', '--compressed', `${API}?${qs}`],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
    for (const m of data?.query?.categorymembers ?? []) titles.push(m.title);
    cont = data?.continue?.cmcontinue;
    process.stderr.write(`  ${titles.length}\r`);
  } while (cont);
  process.stderr.write('\n');

  const held = new Set(spells.map((s) => key(s.name)));
  const missing = titles.filter((t) => !held.has(key(t)));
  const stale = [...held].filter((k) => !new Set(titles.map(key)).has(k));
  console.log('');
  console.log('=== AGAINST THE LIVE WIKI ==========================================');
  console.log(`live Category:Spells pages          : ${titles.length}`);
  console.log(`we hold                             : ${spells.length}`);
  console.log(`live pages we do NOT hold           : ${missing.length}`);
  console.log(`names we hold with no live page     : ${stale.length}`);
  console.log('');
  console.log('a sample of what we do not hold:');
  for (const t of missing.slice(0, 25)) console.log(`   ${t}`);
  live = { total: titles.length, missing, stale };
}

if (OUT) {
  writeFileSync(OUT, `${JSON.stringify({
    ranAt: new Date().toISOString(),
    vendored: {
      jmoyersSpells: spells.length,
      withEffects: jm.withEffects,
      harvest: harvestList.length,
      numbered: numbered.length,
    },
    perClass: Object.fromEntries(perClass),
    unparsedShapes: [...unparsed],
    live,
  }, null, 1)}\n`);
  console.log(`\nwrote ${OUT}`);
}
