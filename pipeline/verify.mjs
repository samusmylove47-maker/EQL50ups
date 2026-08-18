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
/** Weapon skills exactly as the live client spells them. */
const WEAPON_SKILLS = new Set(['1H Slashing', '2H Slashing', '1H Blunt', '2H Blunt', 'Piercing',
  '2H Piercing', 'Hand to Hand', 'Archery', 'Throwing']);
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
/*
 * The inverse of what this used to assert.
 *
 * It required `license.content === 'CC BY-SA 4.0'` — a check that enforced an
 * assumption. eqlwiki publishes no content licence, verified three ways on
 * 2026-08-18. What must now hold is that the payload claims no terms and says
 * how that was established, so a future edit cannot quietly reinstate a licence
 * nobody granted.
 */
assert('meta claims no content licence, and says how that was checked',
  meta.license?.content === null &&
  typeof meta.license?.note === 'string' &&
  /no content licence/i.test(meta.license.note) &&
  /^\d{4}-\d{2}-\d{2}$/.test(meta.license?.checked ?? ''),
  JSON.stringify(meta.license));
assert('no payload string asserts a licence the source has not granted',
  !/CC BY-SA/i.test(meta.attribution ?? ''),
  `meta.attribution still asserts a licence: ${meta.attribution}`);
assert('meta records source provenance with commit SHAs',
  Array.isArray(meta.provenance?.repos) && meta.provenance.repos.length >= 4 &&
  meta.provenance.repos.every((r) => /^[0-9a-f]{40}$/.test(r.sha ?? '')),
  'every provenance entry needs a 40-char commit sha');
assert('meta documents field reliability for the fields the client contradicts',
  meta.dataReliability?.flags?.confidence === 'low' &&
  meta.dataReliability.flags.doNotUseAsAuthoritativeFilter === true &&
  Array.isArray(meta.dataReliability.flags.clientVerifiedContradictions) &&
  meta.dataReliability.flags.clientVerifiedContradictions.length > 0 &&
  Array.isArray(meta.dataReliability.weaponSkill?.suspects),
  'meta.dataReliability must flag the flag vocabulary as low-confidence and enumerate the suspect weapon skills');
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
{
  const badSkill = [], badRaw = [];
  for (const it of items) {
    const wp = it.wp;
    if (!wp) continue;
    if (wp.skill != null && !WEAPON_SKILLS.has(wp.skill)) badSkill.push(`${it.n}: ${JSON.stringify(wp.skill)}`);
    if (wp.skillRaw != null && (typeof wp.skillRaw !== 'string' || !wp.skillRaw.trim() || wp.skillRaw === wp.skill)) {
      badRaw.push(`${it.n}: skillRaw=${JSON.stringify(wp.skillRaw)} skill=${JSON.stringify(wp.skill)}`);
    }
  }
  assert('weapon skills use the client vocabulary', badSkill.length === 0,
    `${badSkill.length} non-canonical skill values`, badSkill);
  assert('skillRaw is only present when it differs from the normalized skill', badRaw.length === 0,
    `${badRaw.length} malformed skillRaw values`, badRaw);
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
    if (it.av !== true) badAv.push(`${it.n}: shipped with av=${JSON.stringify(it.av)}`);
    if (it.era == null && it.eraUnknown !== true) badUnknown.push(`${it.n}: no era but eraUnknown not set`);
  }
  assert('era values are in the chronology', badEra.length === 0, `${badEra.length} unknown era labels`, badEra);
  assert('everything that ships is available', badAv.length === 0, `${badAv.length} inconsistent availability flags`, badAv);
  assert('items with no era are flagged eraUnknown',
    badUnknown.length === 0, `${badUnknown.length} mis-flagged unknown-era items`, badUnknown);

  /*
   * The era purge, re-derived here rather than trusted.
   *
   * EQ Legends is classic-era only, but the wiki this catalog is built from
   * carries the whole original-EverQuest corpus — Kunark, Velious, Luclin, the
   * Fear/Hate and Chardok revamps, epic quests. Shipping any of it puts items in
   * front of a player that they can never obtain.
   *
   * An item may ship only if it is pre-Kunark, or the live client export proves
   * it exists whatever the wiki says, or the player named it directly. Anything
   * else — including an item with no era at all, which is unconfirmed rather
   * than presumed classic — must have been quarantined.
   */
  const observed = new Set();
  for (const line of readFileSync(TIER0, 'utf8').split(/\r?\n/).slice(1)) {
    const name = line.split('\t')[1];
    if (!name || name === 'Empty') continue;
    observed.add(nameKey(name.replace(/\s*\(Exaltation\)\s*/g, ' ').replace(/\s*\+\d+\s*/g, ' ').trim()));
  }
  const confirmed = new Set(['Shadow Rage Helm', 'Shadow Rage Sleeves', 'Shadow Rage Wristguard',
    'Shadow Rage Gloves', 'Shadow Rage Boots', 'Shadow Rage Leggings'].map(nameKey));

  /*
   * EQL Source's published Tier M data releases the era gate too, and re-derived
   * here from the vendored files rather than trusted from the build.
   *
   * `sightings.v1.json` records drops measured in parsed combat logs; an item
   * somebody watched drop is in the game whatever era a wiki page assigns it.
   * `items.v1.json` is the name-to-game-ID table read from `/outputfile
   * inventory` dumps — the same class of evidence as this repo's own export,
   * from a wider pool of characters.
   */
  const eqlsDir = join(ROOT, 'pipeline', 'sources', 'eqlsource');
  const readEqls = (file) => {
    const path = join(eqlsDir, file);
    return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')).data : null;
  };
  const sighted = new Set(
    Object.keys(readEqls('sightings.v1.json')?.items ?? {}).map(nameKey),
  );
  const eqlsIds = new Set(Object.keys(readEqls('items.v1.json')?.items ?? {}).map(nameKey));

  const contraband = [];
  for (const it of items) {
    const key = nameKey(it.n);
    if (confirmed.has(key) || observed.has(key) || sighted.has(key) || eqlsIds.has(key)) continue;
    if (it.era == null) { contraband.push(`${it.n}: no era, not in the live export`); continue; }
    if (ERA_RANK.get(it.era) > cur) contraband.push(`${it.n}: era ${it.era} is past ${CURRENT_ERA}`);
  }
  assert('nothing out of era reaches the shipped catalog', contraband.length === 0,
    `${contraband.length} out-of-era items still shipping`, contraband.slice(0, 25));
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
// 7b. `statsUnknown` — records that exist on Tier 0 authority with no stats
// ---------------------------------------------------------------------------
//
// The marker's whole value is that it is honest, so the payload must not be
// able to carry it and a stat at the same time: a record that says "nothing
// measured this" while shipping numbers is worse than either state alone.
//
// There are now TWO kinds of `statsUnknown` record, and the difference is how
// much is known, not how much is guessed:
//
//   without `xo`  a source describes the item — Shadow Rage Helm has a slot from
//                 its own name in a live inventory line and a class from the
//                 player's report — and only the numbers are missing. Slot and
//                 class are therefore REQUIRED, exactly as before.
//
//   with `xo`     nothing describes it at all. Tier M evidence proves the game
//                 produced it and that is the entire content of the record. Slot
//                 and class are therefore FORBIDDEN, because the only way to
//                 fill them would be to read them off the name.
//
// This assertion used to require a slot and a class of every `statsUnknown`
// record, which was true of the six hand-listed ones and is false of the class
// of record that ships automatically on patch day. It is rewritten to the new
// truth rather than relaxed: each kind is now checked against what it is
// actually entitled to carry, and `xo` is additionally re-derived below from the
// vendored datasets and the client export, so an existence-only record cannot
// appear in the payload without evidence outside build.mjs naming it.
{
  const bad = [];
  const flagged = items.filter((it) => it.statsUnknown === true);
  for (const it of flagged) {
    if (Object.keys(it.st ?? {}).length) bad.push(`${it.n}: statsUnknown but carries st`);
    if (Object.keys(it.sv ?? {}).length) bad.push(`${it.n}: statsUnknown but carries sv`);
    if (it.wp) bad.push(`${it.n}: statsUnknown but carries wp`);
    if (typeof it.evidence !== 'string' || it.evidence.trim().length < 20) {
      bad.push(`${it.n}: statsUnknown with no evidence string`);
    }
    if (it.xo === true) {
      if ((it.sl ?? []).length) bad.push(`${it.n}: existence-only but claims slots ${(it.sl ?? []).join(',')}`);
      if ((it.cl ?? []).length) bad.push(`${it.n}: existence-only but claims classes ${(it.cl ?? []).join(',')}`);
      if (it.era != null) bad.push(`${it.n}: existence-only but claims era ${it.era}`);
      if (it.eraUnknown !== true) bad.push(`${it.n}: existence-only without eraUnknown`);
      if (it.an) bad.push(`${it.n}: existence-only but marked Any-Slot eligible`);
      if (!it.ex) bad.push(`${it.n}: existence-only with no existence mark — it ships on nothing`);
    } else {
      if (!(it.sl ?? []).length) bad.push(`${it.n}: statsUnknown with no slot and not marked existence-only`);
      if (!(it.cl ?? []).length) bad.push(`${it.n}: statsUnknown with no class list and not marked existence-only`);
    }
  }
  assert('statsUnknown records carry evidence and no fabricated stats', bad.length === 0,
    `${bad.length} malformed statsUnknown records`, bad);

  /*
   * Every `xo` record is re-derived from the sources, never trusted from the
   * build. An item may ship on existence evidence alone only if EQL Source's
   * published data or this repository's own client export actually names it.
   */
  {
    const eqlsDir = join(ROOT, 'pipeline', 'sources', 'eqlsource');
    const readEqls = (file) => {
      const p = join(eqlsDir, file);
      return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')).data : null;
    };
    const vouched = new Set([
      ...Object.keys(readEqls('items.v1.json')?.items ?? {}),
      ...Object.keys(readEqls('sightings.v1.json')?.items ?? {}),
    ].map(nameKey));
    if (existsSync(TIER0)) {
      for (const line of readFileSync(TIER0, 'utf8').split(/\r?\n/)) {
        const f = line.split('\t');
        if (f.length < 3) continue;
        const [loc, name, id] = f;
        if (!name || name === 'Empty' || name === 'Name' || loc === 'Location') continue;
        if (!Number.isFinite(Number(id)) || Number(id) <= 0) continue;
        vouched.add(nameKey(name.replace(/\s*\(Exaltation\)\s*/g, ' ').replace(/\s*\+\d+\s*/g, ' ').trim()));
      }
    }
    const unvouched = items.filter((it) => it.xo === true && !vouched.has(nameKey(it.n))).map((i) => i.n);
    assert('every existence-only record is named by a Tier M source', unvouched.length === 0,
      `${unvouched.length} records ship on existence evidence nothing carries`, unvouched);
    const marked = items.filter((it) => it.xo === true);
    const unflagged = marked.filter((it) => it.statsUnknown !== true).map((i) => i.n);
    assert('every existence-only record is also statsUnknown', unflagged.length === 0,
      `${unflagged.length} records claim to describe nothing while shipping as ordinary data`, unflagged);
    assert('meta counts the existence-only records it shipped',
      meta.dataReliability?.existenceOnly?.count === marked.length,
      `meta=${meta.dataReliability?.existenceOnly?.count} payload=${marked.length}`);
  }
  assert('meta counts the statsUnknown records it shipped',
    meta.counts?.statsUnknown === flagged.length,
    `meta=${meta.counts?.statsUnknown} payload=${flagged.length}`);
  // `evidence` exists to be read by a human in the app. It has to survive into
  // the index, because the picker and the browser rank off the index alone.
  const detailOnly = flagged.filter((it) => {
    const d = detailByKey.get(nameKey(it.n));
    return d && d.statsUnknown !== true;
  });
  assert('statsUnknown survives into the detail shards', detailOnly.length === 0,
    `${detailOnly.length} records lose the marker between index and shard`,
    detailOnly.map((i) => i.n));
}

// ---------------------------------------------------------------------------
// 7c. Zone surveys — a partial survey must not read as a complete one
// ---------------------------------------------------------------------------
//
// A drop row that names a zone and says nothing about how well that zone is
// known reads as a finished answer. EQL Source's own note on the file is the
// rule: "Verified means checked against source. It does not mean complete."
//
// Everything below is re-derived from the vendored `zones.v1.json` rather than
// trusted from meta: the grade is computed from the coverage facets, so a
// hand-set one would be caught here.
{
  const zonesPath = join(ROOT, 'pipeline', 'sources', 'eqlsource', 'zones.v1.json');
  const published = existsSync(zonesPath)
    ? JSON.parse(readFileSync(zonesPath, 'utf8')).data?.zones ?? []
    : [];
  const emitted = meta.zones?.surveyed ?? [];
  if (!published.length) {
    warn('zones', 'no vendored zones.v1.json; zone surveys not checked');
  } else {
    assert('every published zone reaches the payload', emitted.length === published.length,
      `payload ${emitted.length} vs source ${published.length}`);

    const bad = [];
    const bySlug = new Map(published.map((z) => [z.slug, z]));
    for (const z of emitted) {
      const src = bySlug.get(z.slug);
      if (!src) { bad.push(`${z.title}: no zone with slug ${z.slug} in the source`); continue; }
      const levels = Object.values(src.coverage ?? {}).map((f) => f?.level ?? 'none');
      const measured = levels.filter((l) => l === 'measured').length;
      const want = !levels.length
        ? 'unstated'
        : measured === levels.length ? 'measured'
          : levels.every((l) => l === 'none') ? 'none' : 'partial';
      if (z.survey !== want) bad.push(`${z.title}: survey=${z.survey}, facets say ${want}`);
      if (z.measured !== measured) bad.push(`${z.title}: measured=${z.measured}, facets say ${measured}`);
      if (z.facets !== levels.length) bad.push(`${z.title}: facets=${z.facets}, source has ${levels.length}`);
      // The two grades are separate facts and must stay separate: a zone can be
      // verified in full and only partly surveyed. Castle Mistmoore is one.
      if (z.verify !== (src.verify_level ?? null)) {
        bad.push(`${z.title}: verify=${z.verify}, source says ${src.verify_level}`);
      }
    }
    assert('every zone survey grade follows from its coverage facets', bad.length === 0,
      `${bad.length} zones carry a grade their facets do not support`, bad);

    // And a drop row may only cite a survey that was actually published.
    const slugs = new Set(emitted.map((z) => z.slug));
    const cited = [];
    for (const [, shard] of shards) {
      for (const it of shard.items ?? []) {
        for (const row of it.ms ?? []) {
          for (const s of row.zs ?? []) {
            if (!slugs.has(s.slug)) cited.push(`${it.n} <- ${row.mob}: cites zone ${s.slug}`);
            if (!(row.zones ?? []).includes(s.zone)) {
              cited.push(`${it.n} <- ${row.mob}: survey for ${s.zone}, which the row does not name`);
            }
          }
        }
      }
    }
    assert('every survey cited on a drop row is one that was published', cited.length === 0,
      `${cited.length} drop rows cite an unpublished survey`, cited);
  }
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
// 9b. The Shadow Rage set — the Tier 0 player correction, re-asserted here
// ---------------------------------------------------------------------------
//
// Restated independently of `build.mjs`'s own correction table, so a table that
// silently stops matching the catalog fails the build instead of becoming a
// no-op. See research/validation/TIER0-PLAYER-REPORTS.md.
{
  const byKeyIdx = new Map(items.map((i) => [nameKey(i.n), i]));
  /*
   * All six pieces ship, all six carry no stats.
   *
   * Three of them do have wiki pages, and those pages have stat blocks. They are
   * withheld anyway: they come from the same scrape that supplied ~7,700 items
   * from expansions this game does not have, so there is no way to show they
   * describe the Legends item rather than an original-EverQuest one of the same
   * name. The player's instruction was explicit — no out-of-era stat block ships
   * until verified numbers are supplied.
   *
   * No era is asserted either. The player placed the set in the Planes of Fear
   * and Hate, but not piece by piece, so naming an era for any one item would be
   * an inference dressed as data — which is the mistake this whole correction
   * exists to undo.
   */
  const expected = [
    ['Shadow Rage Helm', 'HEAD', 55601],
    ['Shadow Rage Sleeves', 'ARMS', 55603],
    ['Shadow Rage Wristguard', 'WRIST', 55604],
    ['Shadow Rage Gloves', 'HANDS', 55605],
    ['Shadow Rage Boots', 'FEET', 55607],
    ['Shadow Rage Leggings', 'LEGS', null],
  ];
  const bad = [];
  for (const [name, slot, id] of expected) {
    const it = byKeyIdx.get(nameKey(name));
    if (!it) { bad.push(`${name}: absent from catalog`); continue; }
    if (it.av !== true) bad.push(`${name}: not shipping (av=${JSON.stringify(it.av)})`);
    if (!(it.cl ?? []).includes('BER')) bad.push(`${name}: classes ${(it.cl ?? []).join(',')} lack BER`);
    if (!(it.sl ?? []).includes(slot)) bad.push(`${name}: slots ${(it.sl ?? []).join(',')} lack ${slot}`);
    if (id != null && it.id !== id) bad.push(`${name}: id ${it.id} != ${id}`);
    if (it.statsUnknown !== true) bad.push(`${name}: statsUnknown is not set`);
    if (Object.keys(it.st ?? {}).length > 0) bad.push(`${name}: ships stats of unverified provenance`);
    if (!it.evidence) bad.push(`${name}: no evidence string`);
  }
  /*
   * And the sets a previous session wrongly inferred were EQL content.
   *
   * Checked by era, not by name. The five sets are Legionnaire Scale, Greenmist,
   * of the Righteous, of the Untamed and of Harmony, but three of those names
   * are ordinary English: `Spear of Harmony` is a legitimate Sky-era Bard weapon
   * and matching on the substring flags it. The era tag is the exact signal, and
   * it is what the purge actually acts on.
   */
  const revamp = items.filter((i) => i.era === 'FearHateRevamp');
  if (revamp.length) {
    bad.push(`${revamp.length} FearHateRevamp item(s) still ship: ${revamp.slice(0, 5).map((i) => i.n).join(', ')}`);
  }
  assert('Shadow Rage ships unstatted, and the sets that do not exist are gone', bad.length === 0,
    `${bad.length} Shadow Rage discrepancies`, bad);
}

// ---------------------------------------------------------------------------
// 10. Source standing — existence and stat provenance, restated independently
// ---------------------------------------------------------------------------
//
// `research/SOURCING-STANDARD.md` rule 5 requires the payload to state where
// every number came from. Two fields carry it and they answer different
// questions: `ex` says whether the game is known to hold the item, `sd` says
// where the numbers on the row came from. They are checked separately here
// because conflating them is the defect this section was written to catch — a
// name appearing in a `Location / Name / ID / Count / Slots` export proves
// existence and says nothing whatsoever about a stat block.
//
// Everything below is re-derived from the shipped payload and the raw export,
// never from build.mjs's tables, so a table that stops matching the catalog
// fails the build instead of validating itself.
{
  const STANDINGS = new Set(['tier-M', 'tier-2', 'tier-5', 'unattributed']);
  const EXISTENCE = new Set(['measured-drop', 'live-export', 'eqlsource-id', 'player-report']);
  const byKeyIdx = new Map(items.map((i) => [nameKey(i.n), i]));

  // --- vocabulary and coverage: every row states a standing, none invents one
  {
    const missing = items.filter((i) => i.sd === undefined).map((i) => i.n);
    assert('every shipped item carries a source standing', missing.length === 0,
      `${missing.length} of ${items.length} items have no \`sd\``, missing);
    const badVocab = items.filter((i) => i.sd !== undefined && !STANDINGS.has(i.sd))
      .map((i) => `${i.n}: ${JSON.stringify(i.sd)}`);
    assert('every source standing is in the published vocabulary', badVocab.length === 0,
      `${badVocab.length} items carry an unknown standing`, badVocab);
    const badEx = items.filter((i) => i.ex !== undefined && !EXISTENCE.has(i.ex))
      .map((i) => `${i.n}: ${JSON.stringify(i.ex)}`);
    assert('every existence mark is in the published vocabulary', badEx.length === 0,
      `${badEx.length} items carry an unknown existence mark`, badEx);
  }

  // --- fact one: existence is the export, and only the export
  if (existsSync(TIER0)) {
    const exportIds = new Set();
    const exportNames = new Set();
    for (const line of readFileSync(TIER0, 'utf8').split(/\r?\n/)) {
      const f = line.split('\t');
      if (f.length < 3) continue;
      const [loc, name, id] = f;
      if (!name || name === 'Empty' || name === 'Name' || loc === 'Location') continue;
      const n = Number(id);
      if (!Number.isFinite(n) || n <= 0) continue;
      exportIds.add(n);
      exportNames.add(nameKey(name.replace(/\s*\(Exaltation\)\s*/g, ' ').replace(/\s*\+\d+\s*/g, ' ').trim()));
    }
    const bad = [];
    for (const it of items) {
      if (it.ex !== 'live-export') continue;
      // The export is the only place a numeric id can come from, so an item
      // claiming a live sighting must carry one of the ids that file printed.
      if (it.id == null) bad.push(`${it.n}: claims live-export but carries no numeric id`);
      else if (!exportIds.has(it.id)) bad.push(`${it.n}: id #${it.id} is not in the export`);
    }
    /*
     * And the converse — an export name the catalog holds must say so, UNLESS
     * it carries stronger evidence.
     *
     * `measured-drop` outranks `live-export`: an inventory line proves somebody
     * holds the item, while a sighting proves the game produced it, and the
     * mark records the strongest fact rather than the first one found. So the
     * check is that an export name is marked with *at least* export-grade
     * evidence, not that it is marked with exactly that.
     */
    const AT_LEAST_EXPORT = new Set(['measured-drop', 'live-export']);
    for (const key of exportNames) {
      const it = byKeyIdx.get(key);
      if (it && !AT_LEAST_EXPORT.has(it.ex)) {
        bad.push(`${it.n}: in the export, marked ${JSON.stringify(it.ex)}`);
      }
    }
    assert('live-export existence marks match the client inventory export', bad.length === 0,
      `${bad.length} existence discrepancies`, bad);

    // `player-report` is the weakest Tier M evidence in the project and is kept
    // to the one set the player named. Anything else wearing it is a leak.
    const reported = items.filter((i) => i.ex === 'player-report');
    const leaks = reported.filter((i) => !/^shadow rage /i.test(i.n) || exportNames.has(nameKey(i.n)))
      .map((i) => `${i.n}: player-report is reserved for names the export does not hold`);
    assert('player-report existence is confined to the one set the player named',
      leaks.length === 0, `${leaks.length} unexpected player-report marks`, leaks);
  }

  // --- fact two, the Tier M half: transcribed from TIER0-VALIDATION.md
  //
  // Base values the client's own windows imply. If the catalog and the client
  // disagree, the row must NOT wear the client's label — so both the numbers
  // and the mark are asserted together.
  {
    const verified = [
      ['Earthshaker', { wp: { dmg: 37, dly: 70 }, st: { STR: 6, STA: 6 } }, ['DMG', 'DLY', 'STR', 'STA']],
      ['Whitened Treant Fists', { wp: { dmg: 14, dly: 28 } }, ['DMG', 'DLY']],
      ['Cloak of Flames', { st: { AC: 10, HP: 50, AGI: 9, DEX: 9, HASTE: 36 }, sv: { FIRE: 15 } }, ['AC', 'HP', 'AGI', 'DEX', 'HASTE', 'SV_FIRE']],
      ['Bone-Clasped Girdle', { st: { AC: 4, HP: 75, MANA: 75, STR: 7, STA: 7, DEX: 7 } }, ['AC', 'HP', 'MANA', 'STR', 'STA', 'DEX']],
      ['Bladestopper', { st: { AC: 25, HP: 50, STA: 15 } }, ['AC', 'HP', 'STA']],
    ];
    const bad = [];
    for (const [name, expect, fields] of verified) {
      const it = byKeyIdx.get(nameKey(name));
      if (!it) { bad.push(`${name}: absent from catalog`); continue; }
      for (const [k, v] of Object.entries(expect.wp ?? {})) {
        if (it.wp?.[k] !== v) bad.push(`${name}: wp.${k} ${JSON.stringify(it.wp?.[k])} != client ${v}`);
      }
      for (const [k, v] of Object.entries(expect.st ?? {})) {
        if (it.st?.[k] !== v) bad.push(`${name}: st.${k} ${JSON.stringify(it.st?.[k])} != client ${v}`);
      }
      for (const [k, v] of Object.entries(expect.sv ?? {})) {
        if (it.sv?.[k] !== v) bad.push(`${name}: sv.${k} ${JSON.stringify(it.sv?.[k])} != client ${v}`);
      }
      if (it.sd !== 'tier-M') bad.push(`${name}: stats are client-verified but sd is ${JSON.stringify(it.sd)}`);
      if (!it.sdc) bad.push(`${name}: tier-M with no citation`);
      for (const f of fields) {
        if (!(it.vf ?? []).includes(f)) bad.push(`${name}: vf omits the client-checked field ${f}`);
      }
    }
    // The claim must not spread beyond the captures that support it.
    const overclaim = items.filter((i) => i.sd === 'tier-M' &&
      !verified.some(([n]) => nameKey(n) === nameKey(i.n))).map((i) => `${i.n}: tier-M with no client capture`);
    bad.push(...overclaim);
    assert('tier-M marks exactly the stat blocks a client window confirmed', bad.length === 0,
      `${bad.length} tier-M discrepancies`, bad);
  }

  // --- fact two, the rest: re-derived from the payload's own era and stats
  {
    const cur = ERA_RANK.get(CURRENT_ERA);
    const bad = [];
    const tally = { 'tier-M': 0, 'tier-2': 0, 'tier-5': 0, unattributed: 0 };
    for (const it of items) {
      tally[it.sd] = (tally[it.sd] ?? 0) + 1;
      if (it.sd === 'tier-M') continue;
      const numbers = !it.statsUnknown && (
        Object.keys(it.st ?? {}).length > 0 || Object.keys(it.sv ?? {}).length > 0 || Boolean(it.wp));
      const rank = it.era == null ? null : ERA_RANK.get(it.era);
      const want = !numbers ? 'unattributed' : (rank == null || rank > cur ? 'tier-5' : 'tier-2');
      if (it.sd !== want) bad.push(`${it.n}: sd ${JSON.stringify(it.sd)}, derived ${want} (era ${it.era ?? 'none'}, numbers ${numbers})`);
    }
    assert('every non-tier-M standing follows from the era and the stats on the row',
      bad.length === 0, `${bad.length} standings do not re-derive`, bad);

    // A row that withholds its numbers cannot attribute them.
    const withheld = items.filter((i) => i.statsUnknown === true && i.sd !== 'unattributed')
      .map((i) => `${i.n}: statsUnknown but sd=${JSON.stringify(i.sd)}`);
    assert('withheld stats are unattributed, never tiered', withheld.length === 0,
      `${withheld.length} statsUnknown rows claim a tier`, withheld);

    const metaCounts = meta.counts?.standing ?? {};
    const mismatched = Object.entries(tally)
      .filter(([k, v]) => metaCounts[k] !== v)
      .map(([k, v]) => `${k}: meta ${metaCounts[k]} vs payload ${v}`);
    assert('meta.counts.standing matches the shipped payload', mismatched.length === 0,
      `${mismatched.length} standing counts disagree`, mismatched);

    assert('meta publishes the source-standing contract',
      meta.sourceStanding?.existence?.field === 'ex' && meta.sourceStanding?.stats?.field === 'sd' &&
      Array.isArray(meta.sourceStanding.stats.vocabulary) &&
      meta.sourceStanding.stats.vocabulary.length === STANDINGS.size,
      'meta.sourceStanding must document both fields and the whole standing vocabulary');

    console.log('-- source standing (rule 5: where every number came from) --');
    for (const [k, v] of Object.entries(tally)) {
      console.log(`  ${k.padEnd(14)} ${String(v).padStart(6)}   ${((v / items.length) * 100).toFixed(1).padStart(5)}%`);
    }
    console.log(`  existence: live-export ${items.filter((i) => i.ex === 'live-export').length}, player-report ${items.filter((i) => i.ex === 'player-report').length}, none ${items.filter((i) => !i.ex).length}`);
    console.log('');
  }

  // --- the two items the inverted mark was measured on, named explicitly
  //
  // Orb of Tishan used to print "TIER M — confirmed in the live game" directly
  // above a wiki stat block, because its name is in the export. Earthshaker,
  // the one stat block checked digit-for-digit against a client window, printed
  // nothing. Both are asserted here so neither can silently revert.
  {
    const AT_LEAST_EXPORT_MARK = new Set(['measured-drop', 'live-export']);
    const bad = [];
    const orb = byKeyIdx.get(nameKey('Orb of Tishan'));
    if (!orb) bad.push('Orb of Tishan: absent from catalog');
    else {
      if (!AT_LEAST_EXPORT_MARK.has(orb.ex)) {
        bad.push(`Orb of Tishan: ex ${JSON.stringify(orb.ex)} — it is held in the export`);
      }
      if (orb.sd !== 'tier-5') bad.push(`Orb of Tishan: sd ${JSON.stringify(orb.sd)} — its stats are an era-unplaced wiki scrape (era ${orb.era})`);
      if (orb.vf) bad.push('Orb of Tishan: claims client-verified fields');
    }
    const es = byKeyIdx.get(nameKey('Earthshaker'));
    if (!es) bad.push('Earthshaker: absent from catalog');
    else {
      if (es.sd !== 'tier-M') bad.push(`Earthshaker: sd ${JSON.stringify(es.sd)} — its stat block is the project's best evidence`);
      /*
       * Earthshaker is `measured-drop` rather than `live-export` now, and that
       * is the mark getting *stronger*, not drifting: EQL Source's sightings
       * record the game producing it, where the export only records somebody
       * holding it. What must never happen is the mark getting weaker, so this
       * asserts the floor rather than an exact value.
       */
      if (!AT_LEAST_EXPORT_MARK.has(es.ex)) {
        bad.push(`Earthshaker: ex ${JSON.stringify(es.ex)} — it is held in the export`);
      }
    }
    assert('the provenance mark is the right way round on the two items it was measured on',
      bad.length === 0, `${bad.length} inverted marks`, bad);
  }
}

// ---------------------------------------------------------------------------
// The contamination page may not quote source that no longer says that
// ---------------------------------------------------------------------------

/*
 * The self-audit page reads `data/contamination.json`, and every code finding
 * on it carries an `example` of the form `path:line — text`, rendered under the
 * heading "OUR OWN SOURCE, QUOTED".
 *
 * That file is produced by `pipeline/contamination.mjs`, which is NOT part of
 * `build.mjs`. It went stale the first time it mattered: the haste badge shipped
 * at 04:02 and the scan was from 03:42, so the page spent the evening accusing
 * `StatPanel.tsx` of printing a percent sign it no longer printed, and quoting a
 * line of source that had become a comment. A page whose whole purpose is honest
 * self-audit publishing a false accusation about its own repository is the worst
 * failure available here, and it is invisible to every other check.
 *
 * So the quotes are re-read against the working tree. A quote that no longer
 * matches its line is a hard failure with one fix: re-run the scanner.
 */
{
  const path = join(OUT, 'contamination.json');
  if (existsSync(path)) {
    const report = readJSON(path);
    const cache = new Map();
    const readLines = (file) => {
      if (!cache.has(file)) {
        const full = join(ROOT, file);
        cache.set(file, existsSync(full) ? readFileSync(full, 'utf8').split(/\r?\n/) : null);
      }
      return cache.get(file);
    };

    const stale = [];
    let checked = 0;
    for (const sig of report.signatures ?? []) {
      for (const site of sig.codeSites ?? []) {
        if (!site?.file || !site?.line || !site?.text) continue;
        checked += 1;
        const lines = readLines(site.file);
        if (!lines) { stale.push(`${site.file}: quoted but the file is gone`); continue; }
        const actual = (lines[site.line - 1] ?? '').trim();
        /*
         * Exact, except for the scanner's own truncation.
         *
         * This compared with `startsWith` on the trimmed line, so a quoted line
         * that GAINED a suffix still passed — the report could show half a
         * statement as if it were the whole one. A truncated quote (ellipsis)
         * must prefix the real line; an untruncated quote must equal it.
         */
        const truncated = String(site.text).endsWith('…');
        const quoted = String(site.text).replace(/…$/, '');
        const agrees = truncated ? actual.startsWith(quoted) : actual === quoted;
        if (!agrees) {
          stale.push(`${site.file}:${site.line} quotes ${JSON.stringify(quoted.slice(0, 60))} but the line reads ${JSON.stringify(actual.slice(0, 60))}`);
        }
      }
    }
    assert('every line the contamination page quotes still reads that way',
      stale.length === 0,
      `${stale.length} of ${checked} quoted source lines are stale — re-run node pipeline/contamination.mjs`,
      stale);

    /*
     * The counts and the marked-file list have to survive the same standard as
     * the quotes. `marked` is a claim about our own code and the page prints it
     * as a headline figure, so it is re-derived here rather than trusted:
     * a file listed as marked must actually import the constant that marks it.
     *
     * The previous rule was a text search over the whole file, which counted
     * `ep.ts` as marked because two of its COMMENTS name `HASTE_PROVENANCE`,
     * while `gear.ts` — carrying the identical `HASTE: 2` claim — counted as
     * unmarked because none of its comments do. Naming a badge is not wearing
     * one.
     */
    const badMarks = [];
    let tallies = 0;
    for (const sig of report.signatures ?? []) {
      const marked = sig.marked ?? 0;
      const unmarked = sig.unmarked ?? 0;
      if (sig.total != null && marked + unmarked !== sig.total) {
        badMarks.push(`${sig.id}: ${unmarked} + ${marked} != total ${sig.total}`);
      }
      tallies += 1;
      for (const file of sig.markedFiles ?? []) {
        const lines = readLines(file);
        if (!lines) { badMarks.push(`${sig.id}: markedFiles names ${file}, which is gone`); continue; }
        const imports = lines.join('\n').match(/import\s+[\s\S]*?\s+from\s+['"][^'"]+['"]/g) ?? [];
        if (!imports.some((stmt) => /HASTE_PROVENANCE|HASTE_STACKING/.test(stmt))) {
          badMarks.push(`${sig.id}: ${file} is counted as marked but imports no provenance constant`);
        }
      }
    }
    assert('the self-audit\'s own tallies add up, and every marked file earned it',
      badMarks.length === 0,
      `${badMarks.length} inconsistencies across ${tallies} signatures`,
      badMarks);
  } else {
    /*
     * Hard, not a warning. A missing report ships an empty self-audit page with
     * a green verify — the page whose entire purpose is to say what this build
     * cannot vouch for, silently saying nothing. `build.mjs` now produces it, so
     * its absence means the build did not finish.
     */
    assert('the payload carries a self-audit report', false,
      'no data/contamination.json — run node pipeline/build.mjs, which now produces it');
  }
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
