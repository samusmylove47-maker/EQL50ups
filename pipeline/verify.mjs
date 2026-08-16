#!/usr/bin/env node
/**
 * EQL gear-planner data pipeline — verification step.
 *
 * Reads ONLY the shipped payload in web/public/data/ plus the Tier 0 ground-truth
 * inventory export, and asserts the invariants the app depends on. It deliberately
 * re-declares its own vocabularies instead of importing build.mjs, so a mistake in
 * the build's constants cannot validate itself.
 *
 * Exit code 0 = all hard checks pass. Nonzero = at least one hard failure.
 *
 * Usage: node pipeline/verify.mjs [--verbose]
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const OUT = join(ROOT, 'web', 'public', 'data');
const TIER0 = join(ROOT, 'research', 'validation', 'tier0-inventory-Avenrae.txt');
const VERBOSE = process.argv.includes('--verbose');

// --- expected vocabularies (independent restatement of the contract) ---------
const SLOTS = new Set(['EAR', 'HEAD', 'FACE', 'NECK', 'SHOULDERS', 'ARMS', 'BACK', 'WRIST', 'RANGE',
  'HANDS', 'PRIMARY', 'SECONDARY', 'FINGERS', 'CHEST', 'LEGS', 'FEET', 'WAIST', 'AMMO']);
const CLASSES = new Set(['WAR', 'BRD', 'CLR', 'DRU', 'ENC', 'MAG', 'MNK', 'NEC', 'PAL', 'RNG', 'ROG', 'SHD', 'SHM', 'WIZ', 'BST', 'BER']);
const CLASS_EXTRA = new Set(['ALL', 'ALL_EXCEPT', 'NONE']);
const RACES = new Set(['HUM', 'BAR', 'ERU', 'ELF', 'HIE', 'DEF', 'HEF', 'DWF', 'TRL', 'OGR', 'HFL', 'GNM', 'IKS', 'KER', 'FRG']);
const RACE_EXTRA = new Set(['ALL', 'ALL_EXCEPT', 'NONE']);
const STAT_KEYS = new Set(['AC', 'HP', 'MANA', 'ENDUR', 'STR', 'STA', 'AGI', 'DEX', 'WIS', 'INT', 'CHA',
  'HASTE', 'HP_REGEN', 'MANA_REGEN', 'ENDUR_REGEN', 'ATTACK', 'BACKSTAB']);
const SAVE_KEYS = new Set(['FIRE', 'COLD', 'MAGIC', 'POISON', 'DISEASE', 'VOID']);
const FLAGS = new Set(['LORE', 'NO_DROP', 'MAGIC', 'NO_TRADE', 'TEMPORARY', 'EXPENDABLE', 'ATTUNEABLE',
  'ARTIFACT', 'LORE_EQUIPPED', 'QUEST', 'NO_RENT', 'PLACEABLE']);
const EFFECT_KINDS = new Set(['click', 'proc', 'focus', 'worn', 'effect']);
const SIZES = new Set(['TINY', 'SMALL', 'MEDIUM', 'LARGE', 'GIANT']);
const ERA_ORDER = ['Classic', 'Fear', 'Hate', 'Paineel', 'Temple', 'Sky', 'Kunark', 'Epic Quests',
  'Nov 2000', 'FearHateRevamp', 'Velious', 'Chardok Revamp', 'Luclin'];
const CURRENT_ERA = 'Sky';
const ERA_RANK = new Map(ERA_ORDER.map((e, i) => [e, i]));
const NO_SLOT_SHARD = 'OTHER';

/** Minimum acceptable Tier 0 name coverage before the build is considered broken. */
const TIER0_MIN_COVERAGE = 0.90;

// --- reporting --------------------------------------------------------------
const failures = [];
const warnings = [];
let checks = 0;
const MAX_EXAMPLES = 8;

function fail(check, detail, examples = []) {
  failures.push({ check, detail, examples: examples.slice(0, MAX_EXAMPLES) });
}
function warn(check, detail, examples = []) {
  warnings.push({ check, detail, examples: examples.slice(0, MAX_EXAMPLES) });
}
function assert(name, ok, detail, examples) {
  checks++;
  if (ok) { if (VERBOSE) console.log(`  ok   ${name}`); return true; }
  fail(name, detail, examples);
  return false;
}

const readJSON = (p) => JSON.parse(readFileSync(p, 'utf8'));

/** Levenshtein distance, capped: used only to describe near-misses in the report. */
function editDistance(a, b, cap = 4) {
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (cur[j] < best) best = cur[j];
    }
    if (best > cap) return cap + 1;
    prev = cur;
  }
  return prev[b.length];
}

// --- load payload -----------------------------------------------------------
if (!existsSync(OUT)) {
  console.error(`FATAL: no build output at ${OUT}. Run: node pipeline/build.mjs`);
  process.exit(2);
}
for (const f of ['items-index.json', 'meta.json']) {
  if (!existsSync(join(OUT, f))) { console.error(`FATAL: missing ${f}. Run: node pipeline/build.mjs`); process.exit(2); }
}
const index = readJSON(join(OUT, 'items-index.json'));
const meta = readJSON(join(OUT, 'meta.json'));
const shardDir = join(OUT, 'items');
const shardFiles = existsSync(shardDir) ? readdirSync(shardDir).filter((f) => f.endsWith('.json')).sort() : [];
const shards = new Map(shardFiles.map((f) => [f.replace(/\.json$/, ''), readJSON(join(shardDir, f))]));

const items = index.items ?? [];

// --- name key (must match the build's join key) ------------------------------
function nameKey(s) {
  return String(s ?? '')
    .normalize('NFKC')
    .replace(/[`´’‘ʼ]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}
function looseKey(s) {
  return nameKey(s)
    .replace(/'/g, '')
    .replace(/^(?:an?|the)\s+/, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** name key -> full detail record (shards carry the fields the index omits). */
const detailByKey = new Map();
for (const shard of shards.values()) for (const it of shard.items ?? []) detailByKey.set(nameKey(it.n), it);

console.log('=== EQL data pipeline — verification ===');
console.log(`payload: ${OUT}`);
console.log(`items:   ${items.length}   shards: ${shards.size}   schema v${index.v}`);
console.log('');

// ---------------------------------------------------------------------------
// 1. structural
// ---------------------------------------------------------------------------
assert('index is a non-empty array', Array.isArray(items) && items.length > 0, `items.length=${items.length}`);
assert('schema versions agree', index.v === meta.v, `index.v=${index.v} meta.v=${meta.v}`);
assert('meta.counts.items matches index length', meta.counts?.items === items.length,
  `meta=${meta.counts?.items} index=${items.length}`);
assert('meta carries an attribution string',
  typeof meta.attribution === 'string' && /EverQuest Legends Wiki/i.test(meta.attribution),
  'meta.attribution must name the EverQuest Legends Wiki');
assert('meta records CC BY-SA 4.0 for wiki content', meta.license?.content === 'CC BY-SA 4.0', JSON.stringify(meta.license));
assert('meta records source provenance with commit SHAs',
  Array.isArray(meta.provenance?.repos) && meta.provenance.repos.length >= 4 &&
  meta.provenance.repos.every((r) => /^[0-9a-f]{40}$/.test(r.sha ?? '')),
  'every provenance entry needs a 40-char commit sha');
assert('meta records the era config', meta.era?.current === CURRENT_ERA &&
  Array.isArray(meta.era?.order) && meta.era.order.join('|') === ERA_ORDER.join('|'),
  `meta.era=${JSON.stringify(meta.era?.current)} order=${JSON.stringify(meta.era?.order)}`);

// ---------------------------------------------------------------------------
// 2. names
// ---------------------------------------------------------------------------
{
  const unnamed = items.filter((i) => typeof i.n !== 'string' || !i.n.trim()).map((i) => JSON.stringify(i).slice(0, 80));
  assert('every item has a non-empty name', unnamed.length === 0, `${unnamed.length} unnamed items`, unnamed);

  const byKey = new Map();
  for (const it of items) {
    const k = nameKey(it.n);
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push(it);
  }
  const collisions = [...byKey.entries()].filter(([, v]) => v.length > 1);
  // A destructive collision = two catalog rows the app cannot tell apart.
  assert('no duplicate name keys in the index', collisions.length === 0,
    `${collisions.length} name keys appear more than once`,
    collisions.map(([k, v]) => `${k} x${v.length}`));

  // Near-duplicates that are legitimately distinct wiki pages (Club vs Club*).
  const starPairs = items.filter((i) => /\*$/.test(i.n) && byKey.has(nameKey(i.n.replace(/\*+$/, ''))));
  if (starPairs.length) {
    warn('distinct-but-similar names', `${starPairs.length} items differ from another item only by a trailing "*" (these are separate wiki pages; keep them separate)`,
      starPairs.map((i) => i.n));
  }
}

// ---------------------------------------------------------------------------
// 3. vocabularies
// ---------------------------------------------------------------------------
{
  const bad = [];
  for (const it of items) for (const s of it.sl ?? []) if (!SLOTS.has(s)) bad.push(`${it.n}: ${s}`);
  assert('all slot values are in the allowed vocabulary', bad.length === 0, `${bad.length} bad slot values`, bad);
}
{
  const bad = [];
  for (const it of items) {
    const cl = it.cl ?? [];
    for (const c of cl) if (!CLASSES.has(c) && !CLASS_EXTRA.has(c)) bad.push(`${it.n}: ${c}`);
    if (cl.includes('ALL_EXCEPT') && cl.length < 2) bad.push(`${it.n}: ALL_EXCEPT with no exclusion list`);
    if (cl.includes('ALL') && cl.length > 1) bad.push(`${it.n}: ALL mixed with ${cl.join(',')}`);
  }
  assert('all class codes are valid', bad.length === 0, `${bad.length} bad class codes`, bad);
}
{
  const bad = [];
  for (const it of items) for (const r of it.ra ?? []) if (!RACES.has(r) && !RACE_EXTRA.has(r)) bad.push(`${it.n}: ${r}`);
  assert('all race codes are valid', bad.length === 0, `${bad.length} bad race codes`, bad);
}
{
  const badKey = [], badVal = [];
  for (const it of items) {
    for (const [k, v] of Object.entries(it.st ?? {})) {
      if (!STAT_KEYS.has(k)) badKey.push(`${it.n}: ${k}`);
      if (typeof v !== 'number' || !Number.isFinite(v)) badVal.push(`${it.n}: ${k}=${JSON.stringify(v)}`);
    }
    for (const [k, v] of Object.entries(it.sv ?? {})) {
      if (!SAVE_KEYS.has(k)) badKey.push(`${it.n}: SV ${k}`);
      if (typeof v !== 'number' || !Number.isFinite(v)) badVal.push(`${it.n}: SV ${k}=${JSON.stringify(v)}`);
    }
  }
  assert('all stat/save keys are in the vocabulary', badKey.length === 0, `${badKey.length} unknown keys`, badKey);
  assert('all numeric stats parse as finite numbers', badVal.length === 0, `${badVal.length} non-numeric stat values`, badVal);
}
{
  const bad = [];
  for (const it of items) for (const f of it.fl ?? []) if (!FLAGS.has(f)) bad.push(`${it.n}: ${f}`);
  assert('all flags are in the vocabulary', bad.length === 0, `${bad.length} unknown flags`, bad);
}

// ---------------------------------------------------------------------------
// 4. weapons
// ---------------------------------------------------------------------------
{
  const bad = [], ammoOnly = [];
  for (const it of items) {
    const wp = it.wp;
    if (!wp) continue;
    const hasD = wp.dmg != null, hasL = wp.dly != null;
    const isAmmo = (it.sl ?? []).includes('AMMO');
    if (hasD && hasL) {
      // Delay 0 is what the wiki prints for a handful of arrows; legitimate for
      // ammunition, a parse error anywhere else.
      const delayOk = typeof wp.dly === 'number' && (wp.dly > 0 || (wp.dly === 0 && isAmmo));
      if (typeof wp.dmg !== 'number' || !delayOk) bad.push(`${it.n}: dmg=${wp.dmg} dly=${wp.dly} slots=${(it.sl ?? []).join(',')}`);
      else if (wp.dly === 0) ammoOnly.push(`${it.n} (delay 0)`);
      continue;
    }
    // Ammunition legitimately prints DMG with no Atk Delay.
    if (hasD && !hasL && isAmmo) { ammoOnly.push(it.n); continue; }
    bad.push(`${it.n}: dmg=${wp.dmg} dly=${wp.dly} slots=${(it.sl ?? []).join(',')}`);
  }
  assert('weapons carry both dmg and dly (or neither; AMMO may carry dmg alone)',
    bad.length === 0, `${bad.length} half-populated weapon blocks`, bad);
  if (ammoOnly.length) warn('ammo weapon blocks', `${ammoOnly.length} AMMO items carry dmg with no delay (correct for arrows)`, ammoOnly);
}

// ---------------------------------------------------------------------------
// 5. era / availability consistency
// ---------------------------------------------------------------------------
{
  const badEra = [], badAv = [], badUnknown = [];
  const cur = ERA_RANK.get(CURRENT_ERA);
  for (const it of items) {
    if (it.era != null && !ERA_RANK.has(it.era)) badEra.push(`${it.n}: ${it.era}`);
    if (typeof it.av !== 'boolean') badAv.push(`${it.n}: av=${JSON.stringify(it.av)}`);
    if (it.era && ERA_RANK.has(it.era) && ERA_RANK.get(it.era) > cur && it.av === true) {
      badAv.push(`${it.n}: era ${it.era} is past ${CURRENT_ERA} but av=true`);
    }
    if (it.era == null && it.eraUnknown !== true) badUnknown.push(`${it.n}: no era but eraUnknown not set`);
    // An era-less item must ship available UNLESS something other than the era
    // gate excluded it (the wiki marks a few pages as not present in Legends).
    if (it.eraUnknown === true && it.av !== true) {
      const ur = detailByKey.get(nameKey(it.n))?.ur;
      if (!ur || /^era:/.test(ur)) badUnknown.push(`${it.n}: eraUnknown, av=false, reason=${ur ?? '(none)'}`);
    }
  }
  assert('era values are in the chronology', badEra.length === 0, `${badEra.length} unknown era labels`, badEra);
  assert('availability is consistent with the era gate', badAv.length === 0, `${badAv.length} inconsistent availability flags`, badAv);
  assert('items with no era are shipped available and flagged eraUnknown',
    badUnknown.length === 0, `${badUnknown.length} mis-flagged unknown-era items`, badUnknown);
}

// ---------------------------------------------------------------------------
// 6. shards
// ---------------------------------------------------------------------------
{
  const expected = new Set([...SLOTS, NO_SLOT_SHARD]);
  const got = new Set(shards.keys());
  const missing = [...expected].filter((s) => !got.has(s));
  const extra = [...got].filter((s) => !expected.has(s));
  assert('one shard per slot plus the no-slot shard', missing.length === 0 && extra.length === 0,
    `missing=[${missing.join(',')}] extra=[${extra.join(',')}]`);

  const byKeyIndex = new Map(items.map((i) => [nameKey(i.n), i]));
  const seen = new Set();
  const wrongSlot = [], mismatched = [], orphan = [];
  for (const [slot, shard] of shards) {
    for (const it of shard.items ?? []) {
      const k = nameKey(it.n);
      seen.add(k);
      if (slot === NO_SLOT_SHARD) { if ((it.sl ?? []).length) wrongSlot.push(`${NO_SLOT_SHARD}: ${it.n} has slots`); }
      else if (!(it.sl ?? []).includes(slot)) wrongSlot.push(`${slot}: ${it.n} slots=${(it.sl ?? []).join(',')}`);
      const idx = byKeyIndex.get(k);
      if (!idx) { orphan.push(`${slot}: ${it.n}`); continue; }
      if (idx.n !== it.n || JSON.stringify(idx.st ?? {}) !== JSON.stringify(it.st ?? {}) ||
          JSON.stringify(idx.sl ?? []) !== JSON.stringify(it.sl ?? []) || idx.id !== it.id) {
        mismatched.push(`${slot}: ${it.n}`);
      }
    }
  }
  assert('every shard item actually belongs to that slot', wrongSlot.length === 0, `${wrongSlot.length} misfiled items`, wrongSlot);
  assert('no shard item is missing from the index', orphan.length === 0, `${orphan.length} orphaned shard items`, orphan);
  assert('index and shard records agree on name/id/slots/stats', mismatched.length === 0, `${mismatched.length} divergent records`, mismatched);
  const unsharded = items.filter((i) => !seen.has(nameKey(i.n))).map((i) => i.n);
  assert('every index item appears in at least one shard', unsharded.length === 0, `${unsharded.length} items reachable from no shard`, unsharded);
}

// ---------------------------------------------------------------------------
// 7. effects, icons, ids, sizes
// ---------------------------------------------------------------------------
{
  const bad = [];
  for (const [slot, shard] of shards) {
    for (const it of shard.items ?? []) {
      for (const f of it.fx ?? []) {
        if (!EFFECT_KINDS.has(f.k)) bad.push(`${it.n}: kind=${f.k}`);
        if (typeof f.n !== 'string' || !f.n.trim()) bad.push(`${it.n}: effect with no name`);
      }
      if (it.sz != null && !SIZES.has(it.sz)) bad.push(`${it.n}: size=${it.sz}`);
      if (it.wt != null && (typeof it.wt !== 'number' || !Number.isFinite(it.wt) || it.wt < 0)) bad.push(`${it.n}: wt=${it.wt}`);
    }
  }
  assert('effects, sizes and weights are well-formed', bad.length === 0, `${bad.length} malformed detail fields`, bad);
}
{
  const bad = [];
  for (const it of items) {
    if (it.ic != null && (!Number.isInteger(it.ic) || it.ic < 0)) bad.push(`${it.n}: ic=${it.ic}`);
    if (it.id != null && (!Number.isInteger(it.id) || it.id <= 0)) bad.push(`${it.n}: id=${it.id}`);
  }
  assert('icon ids and item ids are positive integers or null', bad.length === 0, `${bad.length} bad ids`, bad);

  const byId = new Map();
  for (const it of items) {
    if (it.id == null) continue;
    if (!byId.has(it.id)) byId.set(it.id, []);
    byId.get(it.id).push(it.n);
  }
  const dupes = [...byId.entries()].filter(([, v]) => v.length > 1);
  assert('no numeric item id is assigned to two items', dupes.length === 0,
    `${dupes.length} duplicated ids`, dupes.map(([id, v]) => `#${id}: ${v.join(' / ')}`));
}

// ---------------------------------------------------------------------------
// 8. Tier 0 ground truth — the coverage metric
// ---------------------------------------------------------------------------
let coverage = null;
if (!existsSync(TIER0)) {
  warn('tier0', `ground-truth inventory not found at ${TIER0}; coverage not measured`);
} else {
  const wanted = new Map();      // base display name -> numeric id
  for (const line of readFileSync(TIER0, 'utf8').split(/\r?\n/)) {
    const f = line.split('\t');
    if (f.length < 3) continue;
    const [loc, name, id] = f;
    if (!name || name === 'Empty' || name === 'Name' || loc === 'Location') continue;
    const n = Number(id);
    if (!Number.isFinite(n) || n <= 0) continue;
    const base = name
      .replace(/\s*\(Exaltation\)\s*/g, ' ')   // exaltation carries its source item's id
      .replace(/\s*\+\d+\s*/g, ' ')            // +N upgrade suffix
      .replace(/\s+/g, ' ')
      .trim();
    if (base) wanted.set(base, n);
  }

  const nearest = (name) => {
    const target = looseKey(name);
    let best = null;
    for (const it of items) {
      const d = editDistance(target, looseKey(it.n), 3);
      if (d <= 3 && (best == null || d < best.d)) best = { n: it.n, d };
      if (best?.d === 1) break;
    }
    return best;
  };
  const exactIdx = new Map(items.map((i) => [nameKey(i.n), i]));
  const looseIdx = new Map();
  for (const i of items) {
    const lk = looseKey(i.n);
    if (!looseIdx.has(lk)) looseIdx.set(lk, []);
    looseIdx.get(lk).push(i);
  }

  // Two phases, claim-aware: exact matches bind first, then a loose match may
  // only bind a catalog row nothing else claimed. Without the claim guard,
  // `Backpack*` (#32601) would loosely bind to `Backpack` (#17005) — two
  // genuinely different items that both appear in this export.
  let exact = 0, loose = 0;
  const missing = [], idOk = [], idMissing = [], idWrong = [];
  const claimed = new Map();     // catalog item -> tier0 name that bound it
  const deferred = [];
  for (const [name, id] of wanted) {
    const hit = exactIdx.get(nameKey(name));
    if (hit) { exact++; claimed.set(hit, name); } else deferred.push([name, id]);
  }
  const resolved = new Map([...wanted.keys()].filter((n) => exactIdx.has(nameKey(n))).map((n) => [n, exactIdx.get(nameKey(n))]));
  for (const [name, id] of deferred) {
    const cand = (looseIdx.get(looseKey(name)) ?? []).filter((c) => !claimed.has(c));
    if (cand.length === 1) { loose++; claimed.set(cand[0], name); resolved.set(name, cand[0]); }
  }
  for (const [name, id] of wanted) {
    const hit = resolved.get(name);
    if (!hit) { missing.push(`${name} (#${id})`); continue; }
    if (hit.id == null) idMissing.push(`${name} (#${id})`);
    else if (hit.id !== id) idWrong.push(`${name}: export #${id} vs catalog #${hit.id}`);
    else idOk.push(name);
  }
  const matched = exact + loose;
  coverage = matched / wanted.size;

  console.log('-- Tier 0 ground truth (live client inventory, character Avenrae) --');
  console.log(`  distinct base item names in export: ${wanted.size}`);
  console.log(`  found in catalog:                   ${matched}  (exact ${exact}, loose ${loose})`);
  console.log(`  MATCH RATE:                         ${(coverage * 100).toFixed(1)}%`);
  console.log(`  numeric id present and correct:     ${idOk.length}`);
  console.log(`  numeric id absent from catalog:     ${idMissing.length}`);
  console.log(`  numeric id WRONG in catalog:        ${idWrong.length}`);
  if (missing.length) {
    console.log(`  not in catalog (${missing.length}):`);
    for (const m of missing) {
      // Show the closest catalog name so a human can judge whether the gap is a
      // spelling drift or a genuinely missing page. Never auto-bound: a wrong
      // numeric id in the shipped data is worse than a missing one.
      const bare = m.replace(/\s*\(#\d+\)$/, '');
      const near = nearest(bare);
      console.log(`    - ${m}${near ? `   [closest catalog name: "${near.n}" (edit distance ${near.d})]` : ''}`);
    }
  }
  for (const m of idWrong) console.log(`    !! ${m}`);
  console.log('');

  assert(`tier0 coverage >= ${(TIER0_MIN_COVERAGE * 100).toFixed(0)}%`, coverage >= TIER0_MIN_COVERAGE,
    `match rate ${(coverage * 100).toFixed(1)}%`, missing);
  assert('no tier0 item carries a wrong numeric id', idWrong.length === 0, `${idWrong.length} mismatched ids`, idWrong);
  if (missing.length) warn('tier0 gaps', `${missing.length} live items are absent from every wiki catalog`, missing);
}

// ---------------------------------------------------------------------------
// 9. sanity spot-checks against known-good values from TIER0-VALIDATION.md
// ---------------------------------------------------------------------------
{
  const byKeyIdx = new Map(items.map((i) => [nameKey(i.n), i]));
  const spot = [
    ['Earthshaker', { id: 5667, dmg: 37, dly: 70, slot: 'PRIMARY' }],
    ['Cloak of Flames', { id: 11621, slot: 'BACK' }],
    ['Fishbone Earring', { id: 10313, slot: 'EAR' }],
  ];
  const bad = [];
  for (const [name, exp] of spot) {
    const it = byKeyIdx.get(nameKey(name));
    if (!it) { bad.push(`${name}: absent from catalog`); continue; }
    if (exp.id != null && it.id !== exp.id) bad.push(`${name}: id ${it.id} != ${exp.id}`);
    if (exp.slot && !(it.sl ?? []).includes(exp.slot)) bad.push(`${name}: slots ${(it.sl ?? []).join(',')} lack ${exp.slot}`);
    if (exp.dmg != null && it.wp?.dmg !== exp.dmg) bad.push(`${name}: dmg ${it.wp?.dmg} != ${exp.dmg}`);
    if (exp.dly != null && it.wp?.dly !== exp.dly) bad.push(`${name}: dly ${it.wp?.dly} != ${exp.dly}`);
  }
  assert('documented Tier 0 spot-checks reproduce', bad.length === 0, `${bad.length} spot-check failures`, bad);
}

// ---------------------------------------------------------------------------
// summary
// ---------------------------------------------------------------------------
console.log('-- results --');
console.log(`  checks run: ${checks}`);
console.log(`  failures:   ${failures.length}`);
console.log(`  warnings:   ${warnings.length}`);
console.log('');
for (const w of warnings) {
  console.log(`  WARN  ${w.check}: ${w.detail}`);
  for (const e of w.examples) console.log(`          ${e}`);
}
if (warnings.length) console.log('');
for (const f of failures) {
  console.log(`  FAIL  ${f.check}: ${f.detail}`);
  for (const e of f.examples) console.log(`          ${e}`);
}

if (failures.length) {
  console.log(`\nVERIFY FAILED — ${failures.length} hard failure(s).`);
  process.exit(1);
}
console.log(`VERIFY PASSED${coverage != null ? ` — Tier 0 coverage ${(coverage * 100).toFixed(1)}%` : ''}.`);
