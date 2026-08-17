#!/usr/bin/env node
/**
 * EQL gear-planner data pipeline — build step.
 *
 * Reads the four community item catalogs harvested into research/data/ and emits
 * the browser-facing JSON payload in web/public/data/.
 *
 * Design rules (see pipeline/README.md):
 *   - eqlwiki-items-2026-08-03.json is PRIMARY for structured stats/slots/classes/
 *     races/availability/acquisition. It is the cleanest parse of the wiki.
 *   - jmoyers-items.json is an ENRICHMENT layer: broader name coverage, iconId,
 *     typed effects, and the raw `statsBlock` wiki text used as a parse fallback.
 *   - nathan-bates and EQBuddy are tertiary gap-fillers / corroboration.
 *   - Nothing is ever invented. A field that no source carries is simply omitted.
 *
 * Deterministic: same inputs -> byte-identical outputs (except meta.builtAt, which
 * honours SOURCE_DATE_EPOCH when set).
 *
 * Usage: node pipeline/build.mjs [--quiet]
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const DATA = join(ROOT, 'research', 'data');
const VALIDATION = join(ROOT, 'research', 'validation');
const OUT = join(ROOT, 'web', 'public', 'data');
const OUT_ITEMS = join(OUT, 'items');

const SCHEMA_VERSION = 1;
const QUIET = process.argv.includes('--quiet');

// ---------------------------------------------------------------------------
// Vocabularies
// ---------------------------------------------------------------------------

/** 18 worn slot names (the 21 client positions collapse Ear/Wrist/Fingers x2). */
const SLOTS = [
  'EAR', 'HEAD', 'FACE', 'NECK', 'SHOULDERS', 'ARMS', 'BACK', 'WRIST', 'RANGE',
  'HANDS', 'PRIMARY', 'SECONDARY', 'FINGERS', 'CHEST', 'LEGS', 'FEET', 'WAIST', 'AMMO',
];
const SLOT_SET = new Set(SLOTS);
/** EQL-specific: two "Any Slot" positions exist in the client. See ANY-eligibility below. */
const ANY_SLOT = 'ANY';
/** Shard holding items with no worn slot (food, components, containers, quest items). */
const NO_SLOT_SHARD = 'OTHER';

/** Raw slot token -> canonical. Covers the typos and casings found in the wild. */
const SLOT_ALIASES = new Map([
  ['FINGER', 'FINGERS'], ['FINGERS', 'FINGERS'], ['RING', 'FINGERS'],
  ['SHOULDER', 'SHOULDERS'], ['SHOULDERS', 'SHOULDERS'],
  ['SECONDAY', 'SECONDARY'], ['SECONDARY', 'SECONDARY'],
  ['ARM', 'ARMS'], ['HAND', 'HANDS'], ['FOOT', 'FEET'],
]);

const CLASSES = ['WAR', 'BRD', 'CLR', 'DRU', 'ENC', 'MAG', 'MNK', 'NEC', 'PAL', 'RNG', 'ROG', 'SHD', 'SHM', 'WIZ', 'BST', 'BER'];
const CLASS_SET = new Set(CLASSES);
const CLASS_ALL = 'ALL';
const CLASS_ALL_EXCEPT = 'ALL_EXCEPT';
const CLASS_NONE = 'NONE';
/** nathan-bates spells out class names; map back to the 3-letter codes. */
const CLASS_LONG = new Map(Object.entries({
  warrior: 'WAR', bard: 'BRD', cleric: 'CLR', druid: 'DRU', enchanter: 'ENC',
  magician: 'MAG', monk: 'MNK', necromancer: 'NEC', paladin: 'PAL', ranger: 'RNG',
  rogue: 'ROG', shadowknight: 'SHD', 'shadow knight': 'SHD', shaman: 'SHM',
  wizard: 'WIZ', beastlord: 'BST', berserker: 'BER',
}));

const RACES = ['HUM', 'BAR', 'ERU', 'ELF', 'HIE', 'DEF', 'HEF', 'DWF', 'TRL', 'OGR', 'HFL', 'GNM', 'IKS', 'KER', 'FRG'];
const RACE_SET = new Set(RACES);

/** Canonical item flags. Anything not in this map is discarded (wiki free text). */
const FLAG_ALIASES = new Map(Object.entries({
  'magic': 'MAGIC', 'magic item': 'MAGIC',
  'lore': 'LORE', 'lore item': 'LORE',
  'no drop': 'NO_DROP', 'nodrop': 'NO_DROP', 'no_drop': 'NO_DROP',
  'no trade': 'NO_TRADE', 'notrade': 'NO_TRADE', 'no_trade': 'NO_TRADE',
  'temporary': 'TEMPORARY',
  'expendable': 'EXPENDABLE',
  'attunable': 'ATTUNEABLE', 'attuneable': 'ATTUNEABLE',
  'artifact': 'ARTIFACT',
  'lore equipped': 'LORE_EQUIPPED', 'lore_equipped': 'LORE_EQUIPPED',
  'quest': 'QUEST', 'quest item': 'QUEST',
  'no rent': 'NO_RENT', 'norent': 'NO_RENT', 'no_rent': 'NO_RENT',
  'placeable': 'PLACEABLE',
}));
const FLAGS = [...new Set(FLAG_ALIASES.values())].sort();

/** Canonical stat keys. Aliases collapse the spelling variants across sources. */
const STAT_ALIASES = new Map(Object.entries({
  AC: 'AC', STR: 'STR', STA: 'STA', AGI: 'AGI', DEX: 'DEX', WIS: 'WIS', INT: 'INT', CHA: 'CHA',
  HP: 'HP', HITPOINTS: 'HP', 'HIT POINTS': 'HP',
  MANA: 'MANA', MP: 'MANA',
  END: 'ENDUR', ENDUR: 'ENDUR', ENDURANCE: 'ENDUR',
  HASTE: 'HASTE',
  REGEN: 'HP_REGEN', 'HP REGEN': 'HP_REGEN', HP_REGEN: 'HP_REGEN',
  'MANA REGEN': 'MANA_REGEN', MANA_REGEN: 'MANA_REGEN',
  'END REGEN': 'ENDUR_REGEN', 'ENDUR REGEN': 'ENDUR_REGEN', ENDUR_REGEN: 'ENDUR_REGEN',
  ATTACK: 'ATTACK', ATK: 'ATTACK',
  BACKSTAB: 'BACKSTAB',
}));
const STAT_KEYS = [...new Set(STAT_ALIASES.values())].sort();

const SAVE_ALIASES = new Map(Object.entries({
  'SV FIRE': 'FIRE', 'SV COLD': 'COLD', 'SV MAGIC': 'MAGIC',
  'SV POISON': 'POISON', 'SV POISION': 'POISON', // wiki typo
  'SV DISEASE': 'DISEASE', 'SV VOID': 'VOID',
  FIRE: 'FIRE', COLD: 'COLD', MAGIC: 'MAGIC', POISON: 'POISON', DISEASE: 'DISEASE', VOID: 'VOID',
}));
const SAVE_KEYS = ['FIRE', 'COLD', 'MAGIC', 'POISON', 'DISEASE', 'VOID'];

const SIZES = new Set(['TINY', 'SMALL', 'MEDIUM', 'LARGE', 'GIANT']);

/** Weapon skills as the live client spells them. */
const WEAPON_SKILLS = ['1H Slashing', '2H Slashing', '1H Blunt', '2H Blunt', 'Piercing',
  '2H Piercing', 'Hand to Hand', 'Archery', 'Throwing'];
const WEAPON_SKILL_SET = new Set(WEAPON_SKILLS);
/**
 * Wiki spellings -> client vocabulary. Only spelling is normalized; no weapon is
 * ever moved between skills.
 *
 * `Throwingv1` / `Throwingv2` are in the wiki source itself (all four scrapes
 * report them identically), but they are template artifacts, not a game
 * distinction: the wiki's own category for all 37 throwing weapons is plain
 * `Throwing`, and the suffix does not track slot (v1 is 7 RANGE + 1 RANGE/AMMO,
 * plain Throwing is 6 RANGE/AMMO + 1 RANGE) or range (v1 40-210, v2 20-250,
 * plain 45-200). Collapsed to `Throwing`, with the raw string preserved in
 * `wp.skillRaw` so the distinction is recoverable if it ever proves meaningful.
 */
const SKILL_ALIASES = new Map(Object.entries({
  'throwingv1': 'Throwing', 'throwingv2': 'Throwing', 'throwing': 'Throwing',
  '1h slash': '1H Slashing', '1h slashing': '1H Slashing', '1h slashing /': '1H Slashing',
  '2h slash': '2H Slashing', '2h slashing': '2H Slashing',
  '1h blunt': '1H Blunt', '2h blunt': '2H Blunt',
  '1h piercing': 'Piercing', 'piercing': 'Piercing', '2h piercing': '2H Piercing',
  'hand to hand': 'Hand to Hand', 'h2h': 'Hand to Hand',
  'archery': 'Archery',
}));

/** Effect kinds. `effect` = the source printed an effect without qualifying its type. */
const EFFECT_KINDS = new Set(['click', 'proc', 'focus', 'worn', 'effect']);

// ---------------------------------------------------------------------------
// Era model
// ---------------------------------------------------------------------------

/**
 * Chronological era order for EverQuest Legends. Everything at or before
 * CURRENT_ERA is live on the server; later content is pre-catalogued by the wiki
 * but not obtainable in game.
 */
const ERA_ORDER = [
  'Classic', 'Fear', 'Hate', 'Paineel', 'Temple', 'Sky',
  'Kunark', 'Epic Quests', 'Nov 2000', 'FearHateRevamp', 'Velious', 'Chardok Revamp',
  'Luclin', // post-Velious; appears in a handful of nathan-bates/jmoyers tags
];
const CURRENT_ERA = 'Sky';
const ERA_RANK = new Map(ERA_ORDER.map((e, i) => [e, i]));
const CURRENT_ERA_RANK = ERA_RANK.get(CURRENT_ERA);

/** Fold the era spelling variants seen across the four scrapes onto ERA_ORDER. */
function normEra(raw) {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s) return null;
  s = s.replace(/\s+/g, ' ').replace(/\s*Era$/i, '').trim();
  const k = s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const map = {
    classic: 'Classic', fear: 'Fear', hate: 'Hate', paineel: 'Paineel', temple: 'Temple',
    sky: 'Sky', planeofsky: 'Sky', kunark: 'Kunark',
    epicquests: 'Epic Quests', epics: 'Epic Quests', epic: 'Epic Quests',
    nov2000: 'Nov 2000', november2000: 'Nov 2000',
    fearhaterevamp: 'FearHateRevamp',
    velious: 'Velious', chardokrevamp: 'Chardok Revamp', chardok: 'Chardok Revamp',
    luclin: 'Luclin',
    unknown: null, none: null, null: null,
  };
  if (k in map) return map[k];
  return undefined; // unrecognised -> caller records it
}

// ---------------------------------------------------------------------------
// Tier 0 corrections — the running game overrules the community wiki
// ---------------------------------------------------------------------------

/**
 * The project's sourcing model puts **Tier 0 — the running game and its files —
 * above every community source**. Two tables below carry the only corrections
 * this pipeline applies on that authority. Both are deliberately tiny, entirely
 * enumerated, and every entry cites the evidence that produced it, because the
 * standing rule everywhere else in this file is that nothing is invented.
 *
 * What a Tier 0 correction may carry:
 *   - a field the game demonstrates and the wiki gets wrong or omits;
 *   - never a stat, a weight, a flag or an id that was not directly observed.
 *
 * `verify.mjs` re-asserts the outcome of both tables against the shipped
 * payload, so a table that stops matching the catalog fails the build rather
 * than becoming a silent no-op.
 */

/** The one player report these tables rest on, quoted so it can be audited. */
const PLAYER_REPORT_2026_08_17 =
  'Tier 0 player report, 2026-08-17: "Shadow rage is the berserker set from ' +
  'plane of fear and plane of hate that was added for EQ legends, to be in ' +
  'line with the other planar class gear sets."';

/**
 * Per-item field corrections applied to records the sources DID produce.
 *
 * `set` overwrites, `clear` deletes. Anything not named is left exactly as the
 * sources had it.
 */
const PLAYER_REPORT_2026_08_17_ERA =
  'Tier 0 player report, 2026-08-17: "None of those sets exist in EQ legends. The only one ' +
  'that does is shadow rage. [...] Only items from classic should be included for now. ' +
  '[...] If the stat block that you have for it is from out of Era, do not include it until ' +
  'I tell you and supply you with correct stats for every item."';

/**
 * Names the player has confirmed exist in EverQuest Legends, which ship no
 * matter what era any wiki assigns them.
 *
 * This list is deliberately tiny, and it is the *only* override of the era purge
 * below. An earlier session read the wiki's `FearHateRevamp` tag, decided its
 * five sets (Legionnaire Scale, Greenmist, of the Righteous, of the Untamed, of
 * Harmony) were planar class gear EQL had added, and reported that reading as
 * structural confirmation. It was an inference, and it was wrong: FearHateRevamp
 * is an original-EverQuest content patch and none of those sets are in this game.
 * Shadow Rage is the Berserker set, and the player is the source for it.
 *
 * No era is asserted for these. The player placed the set in the Planes of Fear
 * and Hate, but not piece by piece, so claiming `Fear` or `Hate` on any single
 * item would be another inference dressed as data.
 */
const EQL_CONFIRMED_NAMES = [
  'Shadow Rage Helm', 'Shadow Rage Sleeves', 'Shadow Rage Wristguard',
  'Shadow Rage Gloves', 'Shadow Rage Boots', 'Shadow Rage Leggings',
];

/**
 * The stat blocks the wiki carries for three Shadow Rage pieces.
 *
 * Parked, not deleted, and deliberately unused. They came from the same scrape
 * that supplied ~7,700 items from expansions this game does not have, so there
 * is no way to show they describe the Legends item rather than an original-EQ
 * one of the same name. The player's instruction is explicit: do not include an
 * out-of-era stat block until verified numbers are supplied.
 *
 * To restore: confirm against the client, then set `SHADOW_RAGE_STATS_VERIFIED`.
 */
const SHADOW_RAGE_STATS_VERIFIED = false;

/**
 * Per-item field corrections applied to records the sources DID produce.
 *
 * `set` overwrites, `clear` deletes. Anything not named is left exactly as the
 * sources had it.
 */
const TIER0_CORRECTIONS = [
  // Three Shadow Rage pieces have wiki pages, and all three carry stats of
  // unverifiable provenance. They keep shipping — the set is confirmed to exist —
  // but with the numbers withheld rather than scored, which is what
  // `statsUnknown` is for. `st`/`sv`/`wp`/`fx` are cleared so nothing downstream
  // can rank, auto-fill or total them.
  ...['Shadow Rage Leggings', 'Shadow Rage Sleeves', 'Shadow Rage Wristguard'].map((n) => ({
    n,
    set: {
      statsUnknown: true,
      eraUnknown: true,
      evidence:
        'Confirmed to exist by player report; the wiki stat block for it is of unverified ' +
        'provenance and is withheld rather than shown. ' + PLAYER_REPORT_2026_08_17_ERA,
    },
    // `era` is cleared, not corrected. The wiki calls Leggings `Classic` and has
    // nothing for the other two; the player places the whole set in the Planes
    // of Fear and Hate. Rather than pick one of those or split the difference,
    // the set ships with its era stated as unknown — which is what it is.
    clear: ['era', 'st', 'sv', 'wp', 'fx'],
    source: PLAYER_REPORT_2026_08_17 + ' ' + PLAYER_REPORT_2026_08_17_ERA,
    was: 'wiki stats, shipped as scoreable data',
  })),
];

/**
 * Items the game demonstrably has that **no wiki catalog carries at all**.
 *
 * These ship as records with `statsUnknown: true` and no `st`, `sv` or `wp`.
 * That is the whole point: the app can then say "this item is real and we have
 * no numbers for it" instead of either pretending it does not exist or filling
 * a row with zeroes that would rank and score like real data.
 *
 * Only fields with direct evidence appear here:
 *   - `n` and `id` are read off the live client export line-for-line;
 *   - `sl` is unambiguous from the item's own name (Helm/Gloves/Boots) and is
 *     the slot every sibling planar set uses for that piece;
 *   - `cl` and `era` come from the player report quoted above.
 * Weight, size, flags, icon, races and every stat are simply absent, because
 * nothing observed them. `ra` is therefore left off and the app's documented
 * default (ALL) applies, exactly as it does for the ~4,300 other records with
 * no race data.
 */
const TIER0_KNOWN_ITEMS = [
  {
    n: 'Shadow Rage Helm',
    id: 55601,
    sl: ['HEAD'],
    cl: ['BER'],
    evidence:
      'Confirmed to exist: worn in the Head position of the live client inventory export ' +
      '(research/validation/tier0-inventory-Avenrae.txt, item #55601). No wiki catalog has a ' +
      'page for it, so no stats are known. ' + PLAYER_REPORT_2026_08_17,
  },
  {
    n: 'Shadow Rage Gloves',
    id: 55605,
    sl: ['HANDS'],
    cl: ['BER'],
    evidence:
      'Confirmed to exist: held in the live client inventory export ' +
      '(research/validation/tier0-inventory-Avenrae.txt, item #55605). No wiki catalog has a ' +
      'page for it, so no stats are known. ' + PLAYER_REPORT_2026_08_17,
  },
  {
    n: 'Shadow Rage Boots',
    id: 55607,
    sl: ['FEET'],
    cl: ['BER'],
    evidence:
      'Confirmed to exist: held in the live client inventory export ' +
      '(research/validation/tier0-inventory-Avenrae.txt, item #55607). No wiki catalog has a ' +
      'page for it, so no stats are known. ' + PLAYER_REPORT_2026_08_17,
  },
];

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const readJSON = (f) => JSON.parse(readFileSync(join(DATA, f), 'utf8'));
const sha256 = (f) => createHash('sha256').update(readFileSync(join(DATA, f))).digest('hex').slice(0, 16);

/**
 * Primary join key: unicode-folded, quote-unified, case-folded item name.
 * A trailing `*` is NOT stripped — the wiki uses it to disambiguate genuinely
 * different items that share a name (`Club` and `Club*` have different classes
 * and flags), so folding them would destroy data.
 */
function nameKey(s) {
  return String(s ?? '')
    .normalize('NFKC')
    .replace(/[`´’‘ʼ]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Secondary key: drops apostrophes, other punctuation, a leading article, and `*`. */
function looseKey(s) {
  return nameKey(s)
    .replace(/'/g, '')
    .replace(/^(?:an?|the)\s+/, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Parse a leading signed number out of "+36%", "16.0", "20" etc. null if none. */
function num(v) {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const m = /^[^0-9+-]*([+-]?\d+(?:\.\d+)?)/.exec(String(v));
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

const int = (v) => { const n = num(v); return n == null ? null : Math.trunc(n); };

function uniqSorted(arr) {
  return [...new Set(arr.filter((x) => x != null && String(x).trim() !== ''))].sort();
}

/** Stable key order so re-runs are byte-identical. */
function sortObj(o) {
  const out = {};
  for (const k of Object.keys(o).sort()) out[k] = o[k];
  return out;
}

class Counter {
  constructor() { this.m = new Map(); }
  add(k, n = 1) { this.m.set(k, (this.m.get(k) || 0) + n); return this; }
  get(k) { return this.m.get(k) || 0; }
  get size() { return this.m.size; }
  entries({ sort = 'value', limit = Infinity } = {}) {
    const e = [...this.m.entries()];
    e.sort(sort === 'value' ? (a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]))
      : (a, b) => String(a[0]).localeCompare(String(b[0])));
    return e.slice(0, limit);
  }
}

// ---------------------------------------------------------------------------
// Field normalizers
// ---------------------------------------------------------------------------

function normSlots(raw, dropped) {
  if (raw == null) return [];
  const tokens = (Array.isArray(raw) ? raw : String(raw).split(/[\s,/]+/))
    .flatMap((t) => String(t).split(/[\s,/]+/))
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean);
  const out = [];
  for (const t of tokens) {
    const c = SLOT_ALIASES.get(t) ?? t;
    if (SLOT_SET.has(c)) { if (!out.includes(c)) out.push(c); }
    else if (dropped) dropped.add(t);
  }
  return out.sort((a, b) => SLOTS.indexOf(a) - SLOTS.indexOf(b));
}

/**
 * Class list -> ['ALL'] | ['NONE'] | ['ALL_EXCEPT', ...excluded] | [codes...].
 * Accepts wiki raw text ("ALL except CLR PAL"), 3-letter code arrays, and
 * nathan-bates' long names.
 */
function normClasses(raw, dropped) {
  if (raw == null) return [];
  let tokens;
  if (Array.isArray(raw)) {
    tokens = raw.flatMap((t) => {
      const s = String(t).trim();
      const long = CLASS_LONG.get(s.toLowerCase());
      return long ? [long] : s.split(/[\s,/]+/);
    });
  } else {
    tokens = String(raw).split(/[\s,/]+/);
  }
  tokens = tokens.map((t) => t.trim()).filter(Boolean);

  let except = false;
  const codes = [];
  let all = false, none = false;
  for (const t of tokens) {
    const u = t.toUpperCase();
    if (u === 'EXCEPT' || u === 'ALL_EXCEPT') { except = true; if (u === 'ALL_EXCEPT') all = true; continue; }
    if (u === 'ALL') { all = true; continue; }
    if (u === 'NONE') { none = true; continue; }
    const long = CLASS_LONG.get(t.toLowerCase());
    const code = long ?? u;
    if (CLASS_SET.has(code)) { if (!codes.includes(code)) codes.push(code); }
    else if (dropped) dropped.add(t);
  }
  const ordered = codes.sort((a, b) => CLASSES.indexOf(a) - CLASSES.indexOf(b));
  if (except) {
    // "ALL except X Y" with no list survived the scrape -> unusable, treat as ALL.
    return ordered.length ? [CLASS_ALL_EXCEPT, ...ordered] : (all ? [CLASS_ALL] : []);
  }
  if (all && !ordered.length) return [CLASS_ALL];
  if (none && !ordered.length) return [CLASS_NONE];
  return ordered;
}

function normRaces(raw, dropped) {
  if (raw == null) return [];
  const tokens = (Array.isArray(raw) ? raw : String(raw).split(/[\s,/]+/))
    .flatMap((t) => String(t).split(/[\s,/]+/))
    .map((t) => t.replace(/[^A-Za-z_]/g, '').trim().toUpperCase())
    .filter(Boolean);
  let except = false, all = false, none = false;
  const codes = [];
  for (const t of tokens) {
    if (t === 'EXCEPT' || t === 'ALL_EXCEPT') { except = true; if (t === 'ALL_EXCEPT') all = true; continue; }
    if (t === 'ALL') { all = true; continue; }
    if (t === 'NONE') { none = true; continue; }
    if (RACE_SET.has(t)) { if (!codes.includes(t)) codes.push(t); }
    else if (dropped) dropped.add(t);
  }
  const ordered = codes.sort((a, b) => RACES.indexOf(a) - RACES.indexOf(b));
  if (except) return ordered.length ? ['ALL_EXCEPT', ...ordered] : (all ? ['ALL'] : []);
  if (all && !ordered.length) return ['ALL'];
  if (none && !ordered.length) return ['NONE'];
  return ordered;
}

function normFlags(list, dropped) {
  const out = new Set();
  for (const raw of list ?? []) {
    const s = String(raw).trim();
    if (!s) continue;
    const key = s.toLowerCase().replace(/\s+/g, ' ');
    const mapped = FLAG_ALIASES.get(key);
    if (mapped) { out.add(mapped); continue; }
    // Compound tokens like "NODROP NORENT" or "MAGIC ITEM LORE ITEM".
    const parts = key.split(/\s+/);
    let matchedAny = false;
    for (let i = 0; i < parts.length; i++) {
      for (const len of [2, 1]) {
        const cand = parts.slice(i, i + len).join(' ');
        const m = FLAG_ALIASES.get(cand);
        if (m) { out.add(m); matchedAny = true; i += len - 1; break; }
      }
    }
    if (!matchedAny && dropped) dropped.add(s.slice(0, 60));
  }
  return [...out].sort();
}

function normSize(raw) {
  if (raw == null) return null;
  const s = String(raw).trim().toUpperCase();
  return SIZES.has(s) ? s : null;
}

/**
 * Normalize a weapon skill to the client vocabulary.
 * Returns { skill, raw } — `skill` is null when the value is not a weapon skill
 * at all (SHIELD, spell-research skills), so it never reaches `wp.skill`.
 */
function normSkill(raw, unknown) {
  if (raw == null) return { skill: null, raw: null };
  const s = String(raw).replace(/\s+/g, ' ').trim();
  if (!s) return { skill: null, raw: null };
  const mapped = SKILL_ALIASES.get(s.toLowerCase().replace(/\s*\/\s*$/, ' /').trim())
    ?? SKILL_ALIASES.get(s.toLowerCase());
  if (mapped) return { skill: mapped, raw: mapped === s ? null : s };
  if (WEAPON_SKILL_SET.has(s)) return { skill: s, raw: null };
  if (unknown) unknown.add(s);
  return { skill: null, raw: s };
}

function normStatKey(k) {
  const s = String(k ?? '').trim().toUpperCase().replace(/\s+/g, ' ');
  return STAT_ALIASES.get(s) ?? null;
}

function normSaveKey(k) {
  const s = String(k ?? '').trim().toUpperCase().replace(/\s+/g, ' ');
  return SAVE_ALIASES.get(s) ?? null;
}

// ---------------------------------------------------------------------------
// statsBlock parser (fallback for items the structured sources missed)
// ---------------------------------------------------------------------------

const EFFECT_LINE_RE = /^\s*(?:Effect|Focus Effect|Worn Effect|Combat Effect)\s*:.*$/gim;

/**
 * Parse the raw wiki item block that jmoyers preserves verbatim.
 * Returns only what it can actually read; never guesses.
 */
function parseStatsBlock(text) {
  const out = { stats: {}, saves: {}, flags: [], effects: [] };
  if (!text) return out;
  const block = String(text).replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, '$2'); // de-wikilink

  // --- effects first, then strip those lines so their parentheticals can't
  //     pollute the numeric stat scan.
  const effectLines = block.match(EFFECT_LINE_RE) ?? [];
  for (const line of effectLines) {
    const m = /^\s*(Effect|Focus Effect|Worn Effect|Combat Effect)\s*:\s*(.+)$/i.exec(line);
    if (!m) continue;
    const label = m[1].toLowerCase();
    let rest = m[2].trim();
    let detail = null;
    const paren = /^(.*?)\s*\(([^)]*)\)\s*(.*)$/.exec(rest);
    let name = rest;
    if (paren) {
      name = paren[1].trim();
      detail = [paren[2].trim(), paren[3].trim()].filter(Boolean).join(' ').trim() || null;
    }
    name = name.replace(/\s+at\s+Level\s+\d+\s*$/i, '').trim();
    if (!name) continue;
    let kind = 'effect';
    if (label === 'focus effect') kind = 'focus';
    else if (label === 'worn effect') kind = 'worn';
    else if (label === 'combat effect') kind = 'proc';
    else if (detail) {
      if (/combat/i.test(detail)) kind = 'proc';
      else if (/\bworn\b/i.test(detail)) kind = 'worn';
      else if (/casting time/i.test(detail)) kind = 'click';
    }
    out.effects.push({ k: kind, n: name, ...(detail ? { d: detail } : {}) });
  }
  const body = block.replace(EFFECT_LINE_RE, '\n');

  // --- scalar rows
  const slotM = /^\s*Slot\s*:\s*([^\n]*)$/im.exec(body);
  if (slotM) out.slotRaw = slotM[1].trim();
  const classM = /^\s*Class(?:es)?\s*:\s*([^\n]*)$/im.exec(body);
  if (classM) out.classRaw = classM[1].trim();
  const raceM = /^\s*Race(?:s)?\s*:\s*([^\n]*)$/im.exec(body);
  if (raceM) out.raceRaw = raceM[1].trim();
  const skillM = /\bSkill\s*:\s*([A-Za-z0-9''/ ]+?)(?=\s{2,}|\s*Atk\s*Delay|\s*$|\n)/im.exec(body);
  if (skillM) out.skill = skillM[1].trim();
  const wtM = /\bWT\s*:\s*(\d+(?:\.\d+)?)/i.exec(body);
  if (wtM) out.weight = Number(wtM[1]);
  const szM = /\bSize\s*:\s*([A-Za-z]+)/i.exec(body);
  if (szM) out.size = normSize(szM[1]);
  const dlyM = /\bAtk\s*Delay\s*:\s*(\d+)/i.exec(body);
  if (dlyM) out.atkDelay = Number(dlyM[1]);
  const dmgM = /\bDMG\s*:\s*(\d+)/i.exec(body);
  if (dmgM) out.dmg = Number(dmgM[1]);
  const bonM = /\bDmg\s*Bon(?:us)?\s*:\s*(\d+)/i.exec(body);
  if (bonM) out.dmgBonus = Number(bonM[1]);
  const rngM = /\bRange\s*:\s*(\d+)/i.exec(body);
  if (rngM) out.range = Number(rngM[1]);

  // --- saves (before generic stats so "SV FIRE" is not read as "FIRE")
  const saveRe = /\bSV\s+(FIRE|COLD|MAGIC|POISON|POISION|DISEASE|VOID)\s*:?\s*([+-]?\d+)/gi;
  let sm;
  while ((sm = saveRe.exec(body)) !== null) {
    const k = normSaveKey('SV ' + sm[1].toUpperCase());
    if (k) out.saves[k] = Number(sm[2]);
  }
  const noSaves = body.replace(saveRe, ' ');

  // --- numeric stats
  const statRe = /\b(AC|STR|STA|AGI|DEX|WIS|INT|CHA|HP|MANA|MP|END|ENDUR|ENDURANCE|ATTACK|ATK|BACKSTAB|HP REGEN|MANA REGEN|END REGEN|REGEN)\s*:\s*([+-]?\d+)/gi;
  let m2;
  while ((m2 = statRe.exec(noSaves)) !== null) {
    const k = normStatKey(m2[1]);
    if (k && !(k in out.stats)) out.stats[k] = Number(m2[2]);
  }
  const hasteM = /\bHaste\s*:\s*([+-]?\d+)\s*%/i.exec(noSaves);
  if (hasteM) out.stats.HASTE = Number(hasteM[1]);
  const chargesM = /\bCharges\s*:\s*(\d+)/i.exec(noSaves);
  if (chargesM) out.charges = Number(chargesM[1]);

  // --- flags: leading all-caps run before the first "Key:" row
  const firstLine = body.split('\n').map((l) => l.trim()).find((l) => l.length > 0) ?? '';
  if (firstLine && !/:/.test(firstLine)) {
    out.flags = firstLine.split(/\s{2,}|\s(?=[A-Z]{2,})/).map((s) => s.trim()).filter(Boolean);
    if (!out.flags.length) out.flags = [firstLine];
  }
  return out;
}

// ---------------------------------------------------------------------------
// Load sources
// ---------------------------------------------------------------------------

const t0 = Date.now();
const FILES = {
  jmoyers: 'jmoyers-items.json',
  eqlwiki: 'eqlwiki-items-2026-08-03.json',
  nathanbates: 'nathanbates-items.json',
  eqbuddy: 'eqbuddy-ItemCatalog-2026.json',
  focusEffects: 'nathanbates-focus_effects.json',
};

const rawJ = readJSON(FILES.jmoyers);
const rawW = readJSON(FILES.eqlwiki);
const rawN = readJSON(FILES.nathanbates);
const rawE = readJSON(FILES.eqbuddy);
const rawF = readJSON(FILES.focusEffects);

const J_ITEMS = rawJ.items ?? rawJ;                       // dict keyed by lowercased name
const W_ITEMS = rawW.items ?? rawW;                       // array
const N_ITEMS = Array.isArray(rawN) ? rawN : (rawN.items ?? []);
const E_ITEMS = rawE.Items ?? rawE.items ?? [];
const F_ITEMS = Array.isArray(rawF) ? rawF : (rawF.items ?? rawF.focus_effects ?? []);

/** name-key -> source record, for each source. */
const byJ = new Map(), byW = new Map(), byN = new Map(), byE = new Map();
const dupNames = new Counter();          // collisions where the two records differ
const dupIdentical = new Counter();      // collisions that are byte-identical (harmless)

/** Rough "how much does this record say" score, for deterministic collision wins. */
function richness(rec) {
  let score = 0;
  const walk = (v, d) => {
    if (d > 4 || v == null) return;
    if (Array.isArray(v)) { score += v.length; v.forEach((x) => walk(x, d + 1)); return; }
    if (typeof v === 'object') { for (const x of Object.values(v)) { score += 1; walk(x, d + 1); } return; }
    if (v !== '' && v !== false) score += 1;
  };
  walk(rec, 0);
  return score;
}

/**
 * Index a source by name key. Collisions are real (case-only and backtick-vs-
 * apostrophe variants of the same wiki page); keep the richer record so nothing
 * is silently lost, and count the collisions for the build report.
 */
function indexBy(map, list, nameOf, label) {
  for (const rec of list) {
    const nm = nameOf(rec);
    if (!nm) continue;
    const k = nameKey(nm);
    const prev = map.get(k);
    if (!prev) { map.set(k, rec); continue; }
    if (JSON.stringify(prev) === JSON.stringify(rec)) { dupIdentical.add(label); continue; }
    dupNames.add(`${label}:${k}`);
    const a = richness(prev), b = richness(rec);
    if (b > a || (b === a && String(nameOf(rec)) < String(nameOf(prev)))) map.set(k, rec);
  }
}
indexBy(byJ, Object.values(J_ITEMS), (r) => r.page ?? r.name, 'jmoyers');
indexBy(byW, W_ITEMS, (r) => r.name, 'eqlwiki');
indexBy(byN, N_ITEMS, (r) => r.name, 'nathanbates');
indexBy(byE, E_ITEMS, (r) => r.Name, 'eqbuddy');

/** loose-key -> [name-keys], used only when the loose key is unambiguous. */
const looseIndex = new Map();
for (const k of new Set([...byW.keys(), ...byJ.keys(), ...byN.keys(), ...byE.keys()])) {
  const lk = looseKey(k);
  if (!looseIndex.has(lk)) looseIndex.set(lk, new Set());
  looseIndex.get(lk).add(k);
}

// --- Tier 0: numeric item IDs observed in a live client inventory export.
// This is the ONLY source of numeric item IDs anywhere in the corpus; the four
// wiki scrapes carry page slugs, not game IDs.
function loadTier0Ids() {
  const path = join(VALIDATION, 'tier0-inventory-Avenrae.txt');
  const ids = new Map();     // base display name -> numeric id
  if (!existsSync(path)) return ids;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const f = line.split('\t');
    if (f.length < 3) continue;
    const [loc, name, id] = f;
    if (!name || name === 'Empty' || name === 'Name' || loc === 'Location') continue;
    const n = Number(id);
    if (!Number.isFinite(n) || n <= 0) continue;
    // Strip only the two suffixes the client adds to a base item name. A trailing
    // `*` is NOT stripped: `Backpack` (#17005) and `Backpack*` (#32601) are two
    // different items and both appear in this very inventory.
    const base = name
      .replace(/\s*\(Exaltation\)\s*/g, ' ')  // exaltations report their SOURCE item's id
      .replace(/\s*\+\d+\s*/g, ' ')           // +N upgrade suffix does not change the id
      .replace(/\s+/g, ' ')
      .trim();
    if (!base) continue;
    const prev = ids.get(base);
    if (prev != null && prev !== n) idConflicts.push(`${base}: #${prev} vs #${n}`);
    ids.set(base, n);
  }
  return ids;
}
const idConflicts = [];
const TIER0_IDS = loadTier0Ids();

/**
 * Resolve tier0 names onto catalog name-keys.
 * Exact match first; then an unambiguous loose match for names the wiki spells
 * differently (dropped apostrophe, leading article). A loose key that resolves
 * to more than one catalog item, or to a catalog item another tier0 name already
 * claimed, is left unmatched rather than guessed at: a wrong numeric id shipped
 * to a player is worse than a missing one.
 */
const idByKey = new Map();
const idStats = { exact: 0, loose: 0, unmatched: [] };
/**
 * `TIER0_KNOWN_ITEMS` names count as catalog names here even though no source
 * carries them: the build creates a record for each below, and that record is
 * the right home for the id the export printed beside it. Leaving them out
 * would report them as "unmatched id" while simultaneously shipping the item.
 */
const KNOWN_ITEM_KEYS = new Set(TIER0_KNOWN_ITEMS.map((s) => nameKey(s.n)));
const known = (k) => byW.has(k) || byJ.has(k) || byN.has(k) || byE.has(k) || KNOWN_ITEM_KEYS.has(k);
const pendingLoose = [];
for (const [name, id] of TIER0_IDS) {
  const k = nameKey(name);
  if (known(k)) { idByKey.set(k, id); idStats.exact++; continue; }
  pendingLoose.push([name, id]);
}
for (const [name, id] of pendingLoose) {
  const cand = looseIndex.get(looseKey(name));
  const free = cand ? [...cand].filter((c) => !idByKey.has(c)) : [];
  if (free.length === 1) { idByKey.set(free[0], id); idStats.loose++; continue; }
  idStats.unmatched.push(
    `${name} (#${id})${cand && cand.size > 1 ? ` [ambiguous: ${[...cand].join(' | ')}]` : ''}` +
    `${cand && cand.size && !free.length ? ' [candidate already claimed]' : ''}`,
  );
}

// ---------------------------------------------------------------------------
// Assemble
// ---------------------------------------------------------------------------

const droppedSlotTokens = new Set();
const droppedClassTokens = new Set();
const droppedRaceTokens = new Set();
const droppedFlagTokens = new Set();

const report = {
  sources: new Counter(),          // which source supplied each field
  effectKinds: new Counter(),
  eras: new Counter(),
  eraSources: new Counter(),
  unavailReasons: new Counter(),
  parsedFrom: new Counter(),
  unknownEraTags: new Counter(),
  classRecovered: new Counter(),
  skillNormalized: new Counter(),
  unknownSkills: new Set(),
  skills: new Counter(),
  dropped: [],
  notes: [],
};

const allKeys = [...new Set([...byW.keys(), ...byJ.keys(), ...byN.keys(), ...byE.keys()])].sort();

/** Pick the first source that yields a non-empty value; records provenance. */
function pick(field, candidates) {
  for (const [src, valFn] of candidates) {
    let v;
    try { v = valFn(); } catch { v = null; }
    if (v == null) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0) continue;
    report.sources.add(`${field}<-${src}`);
    return [v, src];
  }
  return [null, null];
}

// ---------------------------------------------------------------------------
// QA pre-pass: how trustworthy is the statsBlock fallback, and where do the two
// best sources disagree? Disagreements are attached to the affected records as
// `cf` so nothing is silently arbitrated away.
// ---------------------------------------------------------------------------

const qa = {
  parser: { ac: [0, 0], dmg: [0, 0], dly: [0, 0], slots: [0, 0] },   // [agree, disagree]
  conflicts: { AC: [], dmg: [], dly: [], slots: [] },
};
const conflictMap = new Map();
function noteConflict(key, field, a, b, name) {
  if (!conflictMap.has(key)) conflictMap.set(key, []);
  conflictMap.get(key).push({ f: field, a, b, sa: 'eqlwiki', sb: 'jmoyers' });
  qa.conflicts[field].push(`${name}: eqlwiki ${JSON.stringify(a)} vs jmoyers ${JSON.stringify(b)}`);
}
function tally(field, a, b) {
  if (a == null || b == null) return;
  const same = Array.isArray(a) ? a.join(',') === b.join(',') : a === b;
  qa.parser[field][same ? 0 : 1]++;
}
for (const [key, w] of byW) {
  const j = byJ.get(key);
  if (!j?.statsBlock) continue;
  const blk = parseStatsBlock(j.statsBlock);
  const js = j.stats ?? {};
  const wAc = num(w.stats?.AC);
  tally('ac', wAc, blk.stats.AC ?? null);
  tally('dmg', int(w.dmg), blk.dmg ?? null);
  tally('dly', int(w.delay), blk.atkDelay ?? null);
  tally('slots', normSlots(w.slots), normSlots(blk.slotRaw));
  if (wAc != null && num(js.ac) != null && wAc !== num(js.ac)) noteConflict(key, 'AC', wAc, num(js.ac), w.name);
  if (int(w.dmg) != null && int(js.dmg) != null && int(w.dmg) !== int(js.dmg)) noteConflict(key, 'dmg', int(w.dmg), int(js.dmg), w.name);
  if (int(w.delay) != null && int(js.atkDelay) != null && int(w.delay) !== int(js.atkDelay)) noteConflict(key, 'dly', int(w.delay), int(js.atkDelay), w.name);
  const wSl = normSlots(w.slots), jSl = normSlots(js.slot);
  if (wSl.length && jSl.length && wSl.join(',') !== jSl.join(',')) noteConflict(key, 'slots', wSl, jSl, w.name);
}

const records = [];

for (const key of allKeys) {
  const w = byW.get(key);
  const j = byJ.get(key);
  const n = byN.get(key);
  const e = byE.get(key);
  const js = j?.stats ?? {};
  const blk = j?.statsBlock ? parseStatsBlock(j.statsBlock) : null;

  const name = w?.name ?? j?.page ?? j?.name ?? n?.name ?? e?.Name;
  if (!name || !String(name).trim()) { report.dropped.push({ key, reason: 'no name in any source' }); continue; }

  // ---- slots
  const [slots, slotSrc] = pick('sl', [
    ['eqlwiki', () => normSlots(w?.slots, droppedSlotTokens)],
    ['jmoyers', () => normSlots(js.slot, droppedSlotTokens)],
    ['statsBlock', () => normSlots(blk?.slotRaw, droppedSlotTokens)],
    ['nathanbates', () => normSlots(n?.slot_raw ?? n?.slots, droppedSlotTokens)],
    ['eqbuddy', () => normSlots(e?.Slots, droppedSlotTokens)],
  ]);
  const sl = slots ?? [];

  // ---- classes / races
  let [classes, classSrc] = pick('cl', [
    ['eqlwiki', () => normClasses(w?.classes, droppedClassTokens)],
    ['statsBlock', () => normClasses(blk?.classRaw, droppedClassTokens)],
    ['eqbuddy', () => normClasses(e?.Classes, droppedClassTokens)],
    ['nathanbates', () => normClasses(n?.classes_raw, droppedClassTokens)],
    ['jmoyers', () => normClasses(js.classes, droppedClassTokens)],
  ]);
  // eqlwiki's class parser occasionally drops BER/BST from an explicit list that
  // the raw wiki text does carry (measured: 10 items, and it never contradicts
  // the raw text). Union the two when both are plain code lists.
  if (classSrc === 'eqlwiki' && blk?.classRaw && classes?.length) {
    const fromBlock = normClasses(blk.classRaw, null);
    const plain = (l) => l.length && l.every((c) => CLASS_SET.has(c));
    if (plain(classes) && plain(fromBlock)) {
      const added = fromBlock.filter((c) => !classes.includes(c));
      if (added.length) {
        classes = [...classes, ...added].sort((a, b) => CLASSES.indexOf(a) - CLASSES.indexOf(b));
        for (const c of added) report.classRecovered.add(c);
      }
    } else if (/except/i.test(blk.classRaw) && classes.includes(CLASS_ALL)) {
      // Raw text says "ALL except <list>" but no source kept the list.
      report.classRecovered.add('(lost ALL_EXCEPT list)');
    }
  }
  const [races] = pick('ra', [
    ['eqlwiki', () => normRaces(w?.races, droppedRaceTokens)],
    ['statsBlock', () => normRaces(blk?.raceRaw, droppedRaceTokens)],
    ['nathanbates', () => normRaces(n?.races_raw, droppedRaceTokens)],
    ['jmoyers', () => normRaces(js.races, droppedRaceTokens)],
  ]);

  // ---- stats: take the best whole object, then gap-fill keys it lacks entirely.
  const statCandidates = [
    ['eqlwiki', () => {
      if (!w?.stats) return null;
      const o = {};
      for (const [k, v] of Object.entries(w.stats)) {
        const sk = normStatKey(k);
        const vn = num(v);
        if (sk && vn != null) o[sk] = vn;
      }
      return o;
    }],
    ['statsBlock', () => (blk ? { ...blk.stats } : null)],
    ['jmoyers', () => {
      const o = {};
      if (js.ac != null && num(js.ac) != null) o.AC = num(js.ac);
      for (const s of js.stats ?? []) {
        const sk = normStatKey(s.key);
        const vn = num(s.value);
        if (sk && vn != null) o[sk] = vn;
      }
      return o;
    }],
    ['nathanbates', () => {
      const o = {};
      if (num(n?.ac) != null) o.AC = num(n.ac);
      if (num(n?.hp) != null) o.HP = num(n.hp);
      if (num(n?.mana) != null) o.MANA = num(n.mana);
      if (num(n?.endurance) != null) o.ENDUR = num(n.endurance);
      for (const [k, v] of Object.entries(n?.stats ?? {})) {
        const sk = normStatKey(k); const vn = num(v);
        if (sk && vn != null) o[sk] = vn;
      }
      return o;
    }],
    ['eqbuddy', () => {
      const o = {};
      if (num(e?.Ac) != null) o.AC = num(e.Ac);
      if (num(e?.Hp) != null) o.HP = num(e.Hp);
      if (num(e?.Mana) != null) o.MANA = num(e.Mana);
      for (const [k, v] of Object.entries(e?.Attributes ?? {})) {
        const sk = normStatKey(k); const vn = num(v);
        if (sk && vn != null) o[sk] = vn;
      }
      return o;
    }],
  ];
  const [stBase, stSrc] = pick('st', statCandidates);
  const st = { ...(stBase ?? {}) };
  if (stSrc) {
    for (const [src, fn] of statCandidates) {
      if (src === stSrc) continue;
      let o; try { o = fn(); } catch { o = null; }
      if (!o) continue;
      for (const [k, v] of Object.entries(o)) {
        if (!(k in st)) { st[k] = v; report.sources.add(`st.fill<-${src}`); }
      }
    }
  }

  // ---- saves
  const saveCandidates = [
    ['eqlwiki', () => {
      if (!w?.stats) return null;
      const o = {};
      for (const [k, v] of Object.entries(w.stats)) {
        const sk = /^SV /i.test(k) ? normSaveKey(k) : null;
        const vn = num(v);
        if (sk && vn != null) o[sk] = vn;
      }
      return o;
    }],
    ['statsBlock', () => (blk ? { ...blk.saves } : null)],
    ['jmoyers', () => {
      const o = {};
      for (const s of js.saves ?? []) {
        const sk = normSaveKey(s.key); const vn = num(s.value);
        if (sk && vn != null) o[sk] = vn;
      }
      return o;
    }],
    ['nathanbates', () => {
      const o = {};
      for (const [k, v] of Object.entries(n?.saves ?? {})) {
        const sk = normSaveKey(k); const vn = num(v);
        if (sk && vn != null) o[sk] = vn;
      }
      return o;
    }],
  ];
  const [svBase, svSrc] = pick('sv', saveCandidates);
  const sv = { ...(svBase ?? {}) };
  if (svSrc) {
    for (const [src, fn] of saveCandidates) {
      if (src === svSrc) continue;
      let o; try { o = fn(); } catch { o = null; }
      if (!o) continue;
      for (const [k, v] of Object.entries(o)) if (!(k in sv)) { sv[k] = v; report.sources.add(`sv.fill<-${src}`); }
    }
  }

  // ---- weapon
  const [wpBase] = pick('wp', [
    ['eqlwiki', () => {
      if (w?.dmg == null && w?.delay == null) return null;
      const o = {};
      if (int(w.dmg) != null) o.dmg = int(w.dmg);
      if (int(w.delay) != null) o.dly = int(w.delay);
      if (w.skill) o.skill = String(w.skill).trim();
      if (int(w.range) != null) o.range = int(w.range);
      return o;
    }],
    ['jmoyers', () => {
      if (js.dmg == null && js.atkDelay == null) return null;
      const o = {};
      if (int(js.dmg) != null) o.dmg = int(js.dmg);
      if (int(js.atkDelay) != null) o.dly = int(js.atkDelay);
      if (js.skill) o.skill = String(js.skill).trim();
      if (int(js.dmgBonus) != null) o.bonus = int(js.dmgBonus);
      if (int(js.range) != null) o.range = int(js.range);
      return o;
    }],
    ['statsBlock', () => {
      if (!blk || (blk.dmg == null && blk.atkDelay == null)) return null;
      const o = {};
      if (blk.dmg != null) o.dmg = blk.dmg;
      if (blk.atkDelay != null) o.dly = blk.atkDelay;
      if (blk.skill) o.skill = blk.skill;
      if (blk.dmgBonus != null) o.bonus = blk.dmgBonus;
      if (blk.range != null) o.range = blk.range;
      return o;
    }],
    ['nathanbates', () => {
      if (n?.damage == null && n?.attack_delay == null) return null;
      const o = {};
      if (int(n.damage) != null) o.dmg = int(n.damage);
      if (int(n.attack_delay) != null) o.dly = int(n.attack_delay);
      if (n.skill) o.skill = String(n.skill).trim();
      if (int(n.range) != null) o.range = int(n.range);
      return o;
    }],
    ['eqbuddy', () => {
      if (e?.Dmg == null && e?.Delay == null) return null;
      const o = {};
      if (int(e.Dmg) != null) o.dmg = int(e.Dmg);
      if (int(e.Delay) != null) o.dly = int(e.Delay);
      if (e.Skill) o.skill = String(e.Skill).trim();
      return o;
    }],
  ]);
  let wp = wpBase ? { ...wpBase } : null;
  if (wp) {
    // A weapon needs both halves to be usable. Fill the missing half from any
    // source that has it; if none does, drop the partial weapon block.
    if (wp.dmg == null || wp.dly == null) {
      for (const alt of [
        { dmg: int(w?.dmg), dly: int(w?.delay) },
        { dmg: int(js.dmg), dly: int(js.atkDelay) },
        { dmg: blk?.dmg ?? null, dly: blk?.atkDelay ?? null },
        { dmg: int(n?.damage), dly: int(n?.attack_delay) },
        { dmg: int(e?.Dmg), dly: int(e?.Delay) },
      ]) {
        if (wp.dmg == null && alt.dmg != null) wp.dmg = alt.dmg;
        if (wp.dly == null && alt.dly != null) wp.dly = alt.dly;
      }
    }
    if (wp.dmg == null || wp.dly == null) {
      // Ammunition legitimately prints DMG with no Atk Delay — keep it.
      // Anything else with only half a weapon block is a bad parse; drop it.
      if (wp.dmg != null && wp.dly == null && sl.includes('AMMO')) {
        report.parsedFrom.add('weapon:ammo-dmg-no-delay (kept)');
      } else {
        report.parsedFrom.add(wp.dmg != null ? 'weapon:dmg-without-delay (dropped)' : 'weapon:delay-without-dmg (dropped)');
        wp = null;
      }
    }
    if (wp && !wp.skill && js.skill) wp.skill = String(js.skill).trim();
  }
  if (wp?.skill) {
    const { skill, raw } = normSkill(wp.skill, report.unknownSkills);
    if (skill) {
      if (raw) { wp.skillRaw = raw; report.skillNormalized.add(`${raw} -> ${skill}`); }
      wp.skill = skill;
    } else {
      // Not a weapon skill (SHIELD, spell research) — keep the source string but
      // do not present it as one.
      if (raw) wp.skillRaw = raw;
      delete wp.skill;
      report.skillNormalized.add(`${raw} -> (not a weapon skill)`);
    }
  }

  // ---- effects (union across typed sources, deduped on kind+name)
  const fx = [];
  const seenFx = new Set();
  const pushFx = (kind, nm, detail, extra) => {
    let k = String(kind ?? '').toLowerCase();
    if (k === 'combat') k = 'proc';
    if (!EFFECT_KINDS.has(k)) k = 'effect';
    const nn = String(nm ?? '').trim();
    if (!nn) return;
    const sig = `${k}|${nn.toLowerCase()}`;
    if (seenFx.has(sig)) return;
    seenFx.add(sig);
    const o = { k, n: nn };
    if (detail) o.d = String(detail).trim();
    if (extra != null && Number.isFinite(extra)) o.lv = extra;
    fx.push(o);
  };
  for (const [kind, ef] of Object.entries(w?.effects ?? {})) pushFx(kind, ef?.name, ef?.detail, int(ef?.level));
  for (const ef of js.effects ?? []) pushFx(ef.kind, ef.name, ef.detail, int(ef.reqLevel));
  if (blk) for (const ef of blk.effects) pushFx(ef.k, ef.n, ef.d);
  if (n?.focus_effect) pushFx('focus', n.focus_effect, null);
  fx.sort((a, b) => a.k.localeCompare(b.k) || a.n.localeCompare(b.n));
  for (const f of fx) report.effectKinds.add(f.k);

  // ---- flags
  const flagPool = [
    ...(w?.tags ?? []),
    ...(js.flags ?? []),
    ...(js.extras ?? []),
    ...(n?.flags ?? []),
    ...(blk?.flags ?? []),
  ];
  const fl = normFlags(flagPool, droppedFlagTokens);

  // ---- weight / size / icon
  const [wt] = pick('wt', [
    ['eqlwiki', () => num(w?.wt)],
    ['jmoyers', () => num(js.weight)],
    ['statsBlock', () => blk?.weight ?? null],
    ['nathanbates', () => num(n?.weight)],
  ]);
  const [sz] = pick('sz', [
    ['eqlwiki', () => normSize(w?.size)],
    ['jmoyers', () => normSize(js.size)],
    ['statsBlock', () => blk?.size ?? null],
    ['nathanbates', () => normSize(n?.size)],
  ]);
  const [ic] = pick('ic', [['jmoyers', () => int(j?.iconId)]]);

  // ---- era + availability
  let era = null, eraSrc = null;
  const eraCandidates = [
    ['eqlwiki.available_from', w?.available_from],
    ['eqlwiki.era', w?.era],
    ['eqlwiki.eras.min', (w?.eras ?? []).map(normEra).filter((x) => ERA_RANK.has(x))
      .sort((a, b) => ERA_RANK.get(a) - ERA_RANK.get(b))[0]],
    ['jmoyers.eraTag', j?.eraTag],
    ['nathanbates.era', n?.era],
  ];
  for (const [src, raw] of eraCandidates) {
    if (raw == null) continue;
    const norm = ERA_RANK.has(raw) ? raw : normEra(raw);
    if (norm === undefined) { report.unknownEraTags.add(String(raw)); continue; }
    if (norm == null) continue;
    era = norm; eraSrc = src; break;
  }

  // `eraUnknown` reports the absence of era information and is independent of
  // availability: an item can be both era-less and explicitly excluded (the wiki
  // flags a handful of pages as not present in Legends at all).
  let av = true, unavailReason = null;
  const eraUnknown = era == null;
  if (w?.non_legends === true) { av = false; unavailReason = 'non_legends'; }
  else if (w?.out_of_era === true) { av = false; unavailReason = 'out_of_era'; }
  else if (era != null && ERA_RANK.get(era) > CURRENT_ERA_RANK) { av = false; unavailReason = `era:${era}`; }

  report.eras.add(era ?? '(unknown)');
  if (eraSrc) report.eraSources.add(eraSrc);
  if (!av) report.unavailReasons.add(unavailReason);

  // ---- acquisition sources
  const zones = new Set(), mobs = new Set(), quests = new Set(), vendors = new Set();
  for (const z of w?.zones ?? []) zones.add(String(z).trim());
  for (const d of w?.drops ?? []) {
    if (d?.zone) zones.add(String(d.zone).trim());
    for (const m of d?.mobs ?? []) mobs.add(String(m).trim());
  }
  for (const d of j?.dropsFrom ?? []) {
    if (d?.zone) zones.add(String(d.zone).trim());
    if (d?.mob) mobs.add(String(d.mob).trim());
  }
  for (const z of e?.DropZones ?? []) zones.add(String(z).trim());
  for (const q of w?.quests ?? []) quests.add(String(q).trim());
  for (const q of e?.Quests ?? []) quests.add(String(q).trim());
  for (const q of j?.questUses ?? []) if (q?.quest) quests.add(String(q.quest).trim());
  for (const v of w?.vendors ?? []) vendors.add(String(v).trim());
  const crafted = Boolean(
    j?.playerCrafted || n?.player_crafted ||
    (w?.crafted_by ?? []).length || (w?.crafted ?? []).length || (w?.recipes ?? []).length ||
    (e?.Recipes ?? []).length,
  );
  const src = {};
  // Acquisition text arrives as raw wiki markup; see cleanSourceList.
  const zoneList = cleanSourceList([...zones]);
  const mobList = cleanSourceList([...mobs]);
  const questList = cleanSourceList([...quests]);
  const vendorList = cleanSourceList([...vendors]);
  if (zoneList.length) src.z = zoneList;
  if (mobList.length) src.m = mobList;
  if (questList.length) src.q = questList;
  if (vendorList.length) src.v = vendorList;
  if (crafted) src.c = 1;

  // ---- provenance of the structured parse
  const parsed = stSrc === 'statsBlock' || slotSrc === 'statsBlock' ? 'statsBlock' : (w ? 'eqlwiki' : (stSrc ?? 'none'));
  report.parsedFrom.add(parsed);

  const id = idByKey.get(key) ?? null;

  const rec = {
    key,
    id,
    n: String(name).trim(),
    ...(ic != null ? { ic } : {}),
    ...(sl.length ? { sl } : {}),
    ...(classes?.length ? { cl: classes } : {}),
    ...(races?.length ? { ra: races } : {}),
    ...(Object.keys(st).length ? { st: sortObj(st) } : {}),
    ...(Object.keys(sv).length ? { sv: sortObj(sv) } : {}),
    ...(wp ? { wp: sortObj(wp) } : {}),
    ...(fx.length ? { fx } : {}),
    ...(fl.length ? { fl } : {}),
    ...(wt != null ? { wt } : {}),
    ...(sz ? { sz } : {}),
    ...(era ? { era } : {}),
    av,
    ...(eraUnknown ? { eraUnknown: true } : {}),
    ...(sl.length ? { an: 1 } : {}),       // ANY-eligible: any worn item may go in an "Any Slot" position
    ...(Object.keys(src).length ? { src } : {}),
    ...(eraSrc ? { es: eraSrc } : {}),
    ...(unavailReason ? { ur: unavailReason } : {}),
    ...(w?.gated_by ? { gb: Object.keys(w.gated_by).sort().join(',') } : {}),
    ...(blk?.charges != null ? { chg: blk.charges } : {}),
    ...(int(n?.required_level) != null ? { rl: int(n.required_level) } : {}),
    ...(parsed === 'statsBlock' ? { parsed: 'statsBlock' } : {}),
    ...(conflictMap.has(key) ? { cf: conflictMap.get(key) } : {}),
  };
  if (wp?.skill) report.skills.add(wp.skill);
  records.push(rec);
}

// ---------------------------------------------------------------------------
// Apply the Tier 0 corrections declared at the top of this file
// ---------------------------------------------------------------------------

/** Recompute availability after an era override, by the same rule as the loop. */
function gateFor(era, rec) {
  if (rec.ur === 'non_legends' || rec.ur === 'out_of_era') return { av: false, ur: rec.ur };
  if (era != null && ERA_RANK.get(era) > CURRENT_ERA_RANK) return { av: false, ur: `era:${era}` };
  return { av: true, ur: null };
}

const recordByKey = new Map(records.map((r) => [r.key, r]));
const tier0Applied = [];
const tier0Missed = [];

for (const fix of TIER0_CORRECTIONS) {
  const key = nameKey(fix.n);
  const rec = recordByKey.get(key);
  if (!rec) { tier0Missed.push(`correction targets "${fix.n}", which is in no source`); continue; }
  for (const field of fix.clear ?? []) delete rec[field];
  for (const [field, value] of Object.entries(fix.set)) rec[field] = value;
  if ('era' in fix.set) {
    const { av, ur } = gateFor(rec.era, rec);
    rec.av = av;
    if (ur) rec.ur = ur; else delete rec.ur;
    rec.es = 'tier0.player-report';
    report.eras.add(`${rec.era} (tier0 correction)`);
  }
  tier0Applied.push(`${fix.n}: ${fix.was} -> ${JSON.stringify(fix.set)}`);
}

for (const spec of TIER0_KNOWN_ITEMS) {
  const key = nameKey(spec.n);
  if (recordByKey.has(key)) {
    // A wiki page appeared for it upstream. That is good news, not a conflict:
    // drop the placeholder rather than shadowing real data with a stub.
    tier0Missed.push(`known-item stub for "${spec.n}" is now redundant — a source carries it`);
    continue;
  }
  const id = idByKey.get(key) ?? null;
  if (spec.id != null && id != null && id !== spec.id) {
    tier0Missed.push(`known-item "${spec.n}" declares id ${spec.id} but the export says ${id}`);
  }
  const { av, ur } = gateFor(spec.era, {});
  const rec = {
    key,
    // The export is the source of the id; the table's value is a cross-check.
    id: id ?? spec.id ?? null,
    n: spec.n,
    sl: spec.sl,
    cl: spec.cl,
    ...(spec.era ? { era: spec.era } : { eraUnknown: true }),
    av,
    // No `st`, `sv` or `wp`: nothing observed them, and a zero is not a
    // measurement. `statsUnknown` is the positive assertion that this record is
    // incomplete on purpose — the stats side of what `eraUnknown` says about era.
    statsUnknown: true,
    evidence: spec.evidence,
    an: 1,
    es: 'tier0.player-report',
    ...(ur ? { ur } : {}),
  };
  records.push(rec);
  recordByKey.set(key, rec);
  report.eras.add(`${spec.era} (tier0 known item)`);
  tier0Applied.push(`${spec.n}: added as a known item with no stat data (id ${rec.id ?? 'none'})`);
}

records.sort((a, b) => a.key.localeCompare(b.key));

// ---------------------------------------------------------------------------
// The era purge
// ---------------------------------------------------------------------------

/**
 * Drop everything that is not confirmed to be in the game.
 *
 * EverQuest Legends reimplements **classic-era EverQuest only** — pre-Kunark.
 * The wiki this catalog is built from does not: its item tables are, in the
 * words of the project's own sourcing standard, "a Project 1999 import,
 * sometimes word for word", and they carry the full original-EverQuest corpus.
 * Ruins of Kunark, Scars of Velious, Shadows of Luclin, the Fear/Hate revamp,
 * the Chardok revamp and the epic quests are all in there, and none of it is in
 * this game.
 *
 * Until now those items shipped with `av: false` and were hidden behind a UI
 * toggle. That is not good enough. A planner that will happily rank an item the
 * player can never obtain is worse than one with a smaller catalog, because the
 * player cannot tell which is which. So they are removed from what ships.
 *
 * An item survives if any of:
 *   1. its era is pre-Kunark — rank at or before CURRENT_ERA;
 *   2. it appears in the live client inventory export, which is Tier 0 proof it
 *      exists in this game whatever the wiki claims about its era;
 *   3. the player has named it directly (EQL_CONFIRMED_NAMES).
 *
 * Note what is *not* on that list: an item with no era at all. Era-less is
 * unconfirmed, not presumed classic. Roughly 2,400 records have no era in any
 * source, and shipping them on the assumption they are in-era is the same class
 * of mistake as the one that put the Velious corpus in front of a player.
 *
 * Nothing is deleted from disk. The quarantine is written out in full so that
 * any of it can be restored by name once a Tier 0 or Tier 1 source places it.
 */
const EQL_CONFIRMED_KEYS = new Set(EQL_CONFIRMED_NAMES.map((n) => nameKey(n)));

function shipDecision(rec) {
  if (EQL_CONFIRMED_KEYS.has(rec.key)) return { ship: true, why: 'player-confirmed' };
  // The wiki's own "this page is not in Legends" flag. It outranks the live
  // export only because nothing flagged this way appears in the export anyway;
  // if that ever changes, the player wins and this line needs revisiting.
  if (rec.ur === 'non_legends') return { ship: false, why: 'wiki flags non_legends' };
  if (idByKey.has(rec.key)) return { ship: true, why: 'in-live-inventory' };
  if (rec.era == null) return { ship: false, why: 'no era in any source' };
  const rank = ERA_RANK.get(rec.era);
  if (rank == null) return { ship: false, why: `unrecognised era: ${rec.era}` };
  if (rank <= CURRENT_ERA_RANK) return { ship: true, why: `era:${rec.era}` };
  return { ship: false, why: `era:${rec.era}` };
}

const quarantined = [];
const shipReasons = new Map();
const quarantineReasons = new Map();
{
  const keep = [];
  for (const rec of records) {
    const { ship, why } = shipDecision(rec);
    const tally = ship ? shipReasons : quarantineReasons;
    tally.set(why, (tally.get(why) ?? 0) + 1);
    if (ship) keep.push(rec);
    else quarantined.push({ key: rec.key, n: rec.n, era: rec.era ?? null, sl: rec.sl ?? [], why });
  }
  const before = records.length;
  records.splice(0, records.length, ...keep);
  report.purge = {
    before,
    shipped: records.length,
    quarantined: quarantined.length,
    shipReasons: Object.fromEntries([...shipReasons].sort((a, b) => b[1] - a[1])),
    quarantineReasons: Object.fromEntries([...quarantineReasons].sort((a, b) => b[1] - a[1])),
  };
}

/*
 * Every surviving record is in era by construction, so the old `av: false`
 * gating has nothing left to express. Leaving a stale `av: false` behind would
 * hide an item the purge just decided to keep — which is exactly how a Tier 0
 * item that the wiki mis-tagged would disappear.
 */
for (const rec of records) {
  rec.av = true;
  delete rec.ur;
}

// ---------------------------------------------------------------------------
// Weapon-skill reliability: the wiki contradicts the live client on fist weapons
// ---------------------------------------------------------------------------

/**
 * Tier 0 screenshot: Whitened Treant Fists reads `Hand to Hand` in the client,
 * but every source's raw wiki text says `1H Blunt`. The wiki is also internally
 * inconsistent across the same item family (Bronze/Rusty/Steel Knuckles are
 * `Hand to Hand`; Brass Knuckles, Knuckle Dusters and all Velium Knuckledusters
 * are `1H Blunt`). Nothing is corrected here — the affected set is enumerated so
 * the UI can hedge. The rule is stated so it can be audited.
 */
const FIST_NAME_RE = /\b(fist|fists|knuckle|knuckles|knuckledusters|claw|claws|cestus|ulak|ulaks|fistwrap|fistwraps|fist wraps)\b/i;
const SUSPECT_SKILL_RULE =
  'weapon usable by MNK (explicit class list, not ALL/ALL_EXCEPT) whose name matches ' +
  '/fist|knuckle|claw|cestus|ulak|fistwrap/i and whose wiki skill is not "Hand to Hand"';
// ---------------------------------------------------------------------------
// Flag reliability: measure the wiki's two page conventions
// ---------------------------------------------------------------------------

/**
 * The client shows `Lore Equipped, No Trade, Placeable` where the catalog says
 * `LORE, MAGIC`. Measuring the raw flag line across every jmoyers page explains
 * why: the wiki carries two authoring conventions, and the flag vocabulary
 * partitions almost perfectly between them.
 *
 *   legacy  — space-separated ALL CAPS: "MAGIC ITEM LORE ITEM NO DROP"
 *   modern  — comma-separated title case: "Lore Equipped, No Trade, Placeable"
 *
 * Nothing is remapped on the strength of this; it is measured and published so
 * the UI can hedge. See meta.dataReliability.flags.
 */
function measureFlagConventions() {
  const t = {
    legacy: { pages: 0, NO_DROP: 0, NO_TRADE: 0, PLACEABLE: 0, LORE_EQUIPPED: 0, LORE: 0, MAGIC: 0 },
    modern: { pages: 0, NO_DROP: 0, NO_TRADE: 0, PLACEABLE: 0, LORE_EQUIPPED: 0, LORE: 0, MAGIC: 0 },
    bothSpellings: 0,
  };
  for (const j of byJ.values()) {
    const first = String(j.statsBlock ?? '').split('\n').map((s) => s.trim()).find(Boolean);
    if (!first || first.includes(':')) continue;          // no flag line on this page
    if (!normFlags([first], null).length) continue;       // prose ("This is a meal!"), not flags
    // Legacy pages write flags in ALL CAPS separated by spaces; the newer
    // convention writes them in Title Case separated by commas.
    const style = /,/.test(first) || /[a-z]/.test(first) ? 'modern' : 'legacy';
    const b = t[style];
    b.pages++;
    const u = first.toUpperCase().replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ');
    const nd = /\bNO ?DROP\b/.test(u), nt = /\bNO ?TRADE\b/.test(u);
    if (nd) b.NO_DROP++;
    if (nt) b.NO_TRADE++;
    if (nd && nt) t.bothSpellings++;
    if (/\bPLACEABLE\b/.test(u)) b.PLACEABLE++;
    if (/\bLORE EQUIPPED\b/.test(u)) b.LORE_EQUIPPED++;
    else if (/\bLORE\b/.test(u)) b.LORE++;
    if (/\bMAGIC\b/.test(u)) b.MAGIC++;
  }
  return t;
}
const flagConventions = measureFlagConventions();

const skillSuspects = records
  .filter((r) => r.wp?.skill && (r.cl ?? []).includes('MNK') && !(r.cl ?? []).includes('ALL_EXCEPT')
    && FIST_NAME_RE.test(r.n) && r.wp.skill !== 'Hand to Hand')
  .map((r) => ({ n: r.n, skill: r.wp.skill }));

// ---------------------------------------------------------------------------
// Emit
// ---------------------------------------------------------------------------

// `wt` and `ra` belong in the index even though they cost payload: the app
// restores saved sets from the index alone, so omitting weight made Equipped
// Weight read 0 after every reload, and omitting races made race-restricted
// items pass an eligibility check that had nothing to check against.
//
// `statsUnknown` and `evidence` are in the index for the same reason `wt` is:
// the picker ranks straight off the index before any shard has loaded, and a
// record whose incompleteness only arrives with the shard would be scored as a
// real zero-stat item for as long as that fetch takes.
const INDEX_FIELDS = [
  'id', 'n', 'ic', 'sl', 'cl', 'ra', 'st', 'sv', 'wp', 'wt', 'fl',
  'era', 'av', 'eraUnknown', 'statsUnknown', 'evidence', 'an',
];
const DETAIL_OMIT = new Set(['key']);

/**
 * Strip wiki markup out of an acquisition string.
 *
 * The upstream pages are hand-written MediaWiki, and their zone/mob/quest lists
 * carry raw `<br>`, `<ul>`/`<li>`, `<u>` and `<strike>` tags plus `{{template}}`
 * and `[[link]]` syntax. Splitting those lists on the markup left fragments that
 * shipped as data: `"</li></ul>"` was published as a **zone name**, so the
 * planner offered a player a zone that does not exist. Cosmetic leakage in a
 * label is untidy; a fabricated zone is wrong data.
 *
 * Returns `null` for anything that is only markup, so the caller can drop it
 * rather than ship an empty string.
 */
function cleanSourceText(value) {
  if (typeof value !== 'string') return null;
  let out = value
    // HTML comments first: they can carry anything, including newlines, and a
    // length-bounded tag pattern walks straight past a long one.
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<!--[\s\S]*$/g, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/?(?:ul|ol|li|u|b|i|em|strong|strike|s|small|span|div|p)\b[^>]*>/gi, ' ')
    // Unbounded: an 80-character ceiling left a 129-character tag on the page.
    .replace(/<[^>]*>/g, ' ')
    // Wiki bold/italic markers, and external links in [url label] form.
    .replace(/'''''|'''|''/g, '')
    .replace(/\[(?:https?|ftp):\/\/\S+?(?:\s+([^\]]*))?\]/gi, '$1')
    // Bare table-row and table-open syntax leaking out of an infobox.
    .replace(/^\s*[|!]-?\s*/g, '')
    .replace(/\{\||\|\}/g, ' ')
    .replace(/\{\{[^{}]*\}\}/g, ' ')
    // Templates nest, so one pass leaves the outer braces behind.
    .replace(/\{\{[^{}]*\}\}/g, ' ')
    .replace(/\{\{|\}\}/g, ' ')
    .replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, '$2')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[-*:;,.\s]+|[-*:;,\s]+$/g, '')
    .trim();
  if (!out) return null;
  // A fragment that is only punctuation or a bare colon-label carries nothing.
  if (!/[a-z0-9]/i.test(out)) return null;
  return out;
}

/** Clean every entry of an acquisition list, dropping what cleans to nothing. */
function cleanSourceList(values) {
  const seen = new Set();
  const out = [];
  for (const raw of values) {
    const cleaned = cleanSourceText(raw);
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
  }
  return out.sort((a, b) => a.localeCompare(b));
}

function indexRecord(r) {
  const o = {};
  for (const f of INDEX_FIELDS) if (r[f] !== undefined) o[f] = r[f];
  return o;
}
function detailRecord(r) {
  const o = {};
  for (const [k, v] of Object.entries(r)) if (!DETAIL_OMIT.has(k)) o[k] = v;
  return o;
}

if (existsSync(OUT_ITEMS)) rmSync(OUT_ITEMS, { recursive: true, force: true });
mkdirSync(OUT_ITEMS, { recursive: true });

const written = [];
function writeOut(relPath, obj) {
  const full = join(OUT, relPath);
  mkdirSync(dirname(full), { recursive: true });
  const json = JSON.stringify(obj);
  writeFileSync(full, json);
  const raw = Buffer.byteLength(json);
  const gz = gzipSync(json, { level: 9 }).length;
  written.push({ path: relPath, raw, gz });
  return { raw, gz };
}

const ATTRIBUTION =
  'Item data derived from the EverQuest Legends Wiki (eqlwiki.com), used under CC BY-SA 4.0. ' +
  'Derived data is shared alike. EverQuest is a trademark of Daybreak Game Company LLC; ' +
  'this project is unaffiliated with Daybreak or Game Jawn.';

writeOut('items-index.json', { v: SCHEMA_VERSION, count: records.length, items: records.map(indexRecord) });

/*
 * The quarantine, written in full to the repository rather than to the shipped
 * bundle. Nothing here reaches a player, but every dropped item stays named and
 * attributed so that restoring one is a table entry rather than a re-scrape.
 */
writeFileSync(
  join(ROOT, 'pipeline', 'quarantine.json'),
  JSON.stringify(
    {
      generated: 'pipeline/build.mjs',
      rule: 'ships iff pre-Kunark era, or present in the live client export, or player-confirmed',
      counts: report.purge,
      items: quarantined,
    },
    null,
    1,
  ) + '\n',
);

const shardCounts = new Counter();
for (const slot of SLOTS) {
  const rows = records.filter((r) => (r.sl ?? []).includes(slot));
  shardCounts.add(slot, rows.length);
  writeOut(`items/${slot}.json`, { v: SCHEMA_VERSION, slot, count: rows.length, items: rows.map(detailRecord) });
}
const otherRows = records.filter((r) => !(r.sl ?? []).length);
shardCounts.add(NO_SLOT_SHARD, otherRows.length);
writeOut(`items/${NO_SLOT_SHARD}.json`, { v: SCHEMA_VERSION, slot: NO_SLOT_SHARD, count: otherRows.length, items: otherRows.map(detailRecord) });

// Focus-effect reference (the 66 wiki focus effects with per-spell-slot detail).
const focus = F_ITEMS.map((f) => ({
  n: f.name,
  ...(f.description ? { d: f.description } : {}),
  ...(Array.isArray(f.effects) && f.effects.length
    ? { sl: f.effects.map((x) => ({ s: x.slot, e: x.effect })) } : {}),
})).sort((a, b) => a.n.localeCompare(b.n));
writeOut('focus-effects.json', { v: SCHEMA_VERSION, count: focus.length, effects: focus });

const eraGatedOut = records.filter((r) => !r.av).length;
const eraUnknownCount = records.filter((r) => r.eraUnknown).length;
const statsUnknownCount = records.filter((r) => r.statsUnknown).length;
const withId = records.filter((r) => r.id != null).length;

const meta = {
  v: SCHEMA_VERSION,
  // SOURCE_DATE_EPOCH (unix seconds) makes the whole payload reproducible.
  builtAt: new Date(process.env.SOURCE_DATE_EPOCH ? Number(process.env.SOURCE_DATE_EPOCH) * 1000 : Date.now()).toISOString(),
  generator: 'pipeline/build.mjs',
  attribution: ATTRIBUTION,
  license: {
    content: 'CC BY-SA 4.0',
    contentSource: 'EverQuest Legends Wiki (eqlwiki.com)',
    note: 'Derived data must remain share-alike and must credit the EverQuest Legends Wiki.',
  },
  era: {
    current: CURRENT_ERA,
    order: ERA_ORDER,
    policy: 'available = era rank <= CURRENT_ERA rank; items with no era anywhere are shipped available with eraUnknown:true',
  },
  slots: { worn: SLOTS, any: ANY_SLOT, otherShard: NO_SLOT_SHARD, anyPolicy: 'items with an:1 may be placed in either "Any Slot" position; no ANY shard is emitted (it would duplicate every worn item)' },
  classes: CLASSES,
  races: RACES,
  statKeys: STAT_KEYS,
  saveKeys: SAVE_KEYS,
  flags: FLAGS,
  weaponSkills: WEAPON_SKILLS,
  effectKinds: [...EFFECT_KINDS].sort(),

  /**
   * Fields where the wiki is known to diverge from the live client. Measured,
   * not assumed. Nothing listed here has been "corrected" — the UI should
   * present these fields with hedging, and must not offer them as authoritative
   * filters. Evidence: research/validation/KNOWN-DATA-ISSUES.md.
   */
  dataReliability: {
    stats: { confidence: 'high', note: 'AC/attributes/saves/dmg/delay reproduce the client exactly on every Tier 0 sample.' },
    flags: {
      confidence: 'low',
      doNotUseAsAuthoritativeFilter: true,
      summary: 'The wiki carries two authoring conventions and the flag vocabulary partitions between them. The client disagrees with the catalog on both Tier 0 items sampled.',
      clientVerifiedContradictions: [
        { item: 'Earthshaker', client: ['Lore Equipped', 'No Trade', 'Placeable'], catalog: ['LORE', 'MAGIC'] },
        { item: 'Whitened Treant Fists', client: ['No Trade', 'Placeable'], catalog: ['MAGIC', 'NO_DROP'] },
      ],
      pageConventions: flagConventions,
      findings: [
        'NO_DROP and NO_TRADE never co-occur: 0 of 7,813 pages carrying a flag line have both.',
        `NO_DROP appears on ${flagConventions.legacy.NO_DROP} legacy-style pages and ${flagConventions.modern.NO_DROP} modern-style pages.`,
        `MAGIC appears on ${flagConventions.legacy.MAGIC} legacy-style pages and ${flagConventions.modern.MAGIC} modern-style pages.`,
        `PLACEABLE appears on ${flagConventions.modern.PLACEABLE} modern-style pages and ${flagConventions.legacy.PLACEABLE} legacy-style pages, so it is recorded only by the newer convention.`,
        'The client renders "No Trade" for Whitened Treant Fists, whose legacy-style page says NO DROP. Combined with the zero co-occurrence and the clean partition by page style, NO_DROP is most likely the same restriction the client calls No Trade, under the older spelling. This is NOT asserted in the data: both flags ship exactly as the wiki spells them.',
        'MAGIC is absent from every modern-style page and from both client screenshots, so it may be a classic-EverQuest concept EQL no longer surfaces. Unresolved.',
      ],
      openQuestion: 'Are NO_DROP and NO_TRADE one restriction or two? Resolving it needs more client samples, ideally an item whose page uses the modern convention.',
    },
    weaponSkill: {
      confidence: 'low-for-monk-fist-weapons',
      summary: 'Spelling is normalized to the client vocabulary; no weapon has been moved between skills. The wiki itself appears wrong for fist-type Monk weapons.',
      clientVerifiedContradictions: [
        { item: 'Whitened Treant Fists', client: 'Hand to Hand', catalog: '1H Blunt' },
      ],
      evidence: [
        'Our parse is faithful: all four independent scrapes report 1H Blunt for this item, and the wiki page category is 1H Blunt too.',
        'The wiki is internally inconsistent within one item family: Bronze, Rusty and Steel Knuckles are Hand to Hand, while Brass Knuckles, Knuckle Dusters and every Velium Knuckledusters variant are 1H Blunt.',
        'Only 11 items in the whole catalog carry Hand to Hand, and all are low damage (3-12); the high-end Monk fist gear is all skilled 1H Blunt.',
        'Scope of possible error: 130 MNK-usable weapons carry a skill; 38 are MNK-only (1H Blunt 17, 2H Blunt 13, Hand to Hand 7, Throwing 1).',
      ],
      suspectRule: SUSPECT_SKILL_RULE,
      suspectCount: skillSuspects.length,
      suspects: skillSuspects,
    },
    dmgBonus: {
      confidence: 'absent',
      note: 'The client shows a Dmg Bon line (13 on Whitened Treant Fists, 50 on Earthshaker). No source carries it per item; jmoyers has it on 1 item only. It is probably derived from character level and weapon type. `wp.bonus` is emitted only where a source actually printed it.',
    },
    itemIds: {
      confidence: 'high-but-sparse',
      note: `Only ${withId} of ${records.length} items have a numeric id; they come from a live client export, not from any wiki source.`,
    },
    /**
     * Records that exist on Tier 0 authority but carry no stats at all.
     *
     * `statsUnknown: true` says "this item is real and nothing measured it".
     * It is NOT the same as an item that genuinely has no stats (food, a
     * container, a quest turn-in), which simply ships with no `st` key and no
     * marker. A consumer must not score, rank or recommend a `statsUnknown`
     * record: there is nothing to compare, and treating its absent stats as
     * zero would present a fabricated comparison as a real one.
     */
    unstattedKnownItems: {
      confidence: 'existence-certain-stats-absent',
      count: statsUnknownCount,
      marker: 'statsUnknown',
      policy:
        'exists in the game, no source carries stats; never scored, ranked or auto-filled. ' +
        'Each record carries an `evidence` string naming what proves it exists.',
      items: records
        .filter((r) => r.statsUnknown)
        .map((r) => ({ n: r.n, id: r.id, sl: r.sl, cl: r.cl, era: r.era ?? null })),
    },
  },
  counts: {
    items: records.length,
    withNumericId: withId,
    withSlot: records.filter((r) => (r.sl ?? []).length).length,
    withStats: records.filter((r) => r.st).length,
    withEffects: records.filter((r) => r.fx).length,
    withAcquisition: records.filter((r) => r.src).length,
    eraGatedOut,
    eraUnknown: eraUnknownCount,
    statsUnknown: statsUnknownCount,
    flagged: eraUnknownCount,
    perSlot: Object.fromEntries(shardCounts.entries({ sort: 'key' })),
    perEffectKind: Object.fromEntries(report.effectKinds.entries({ sort: 'key' })),
  },
  provenance: {
    repos: [
      { repo: 'jmoyers/everquest-companion', sha: 'd25455ee0f251a063e7899e0e544146f4492454d', file: 'src/main/data/items.json', role: 'enrichment: iconId, typed effects, statsBlock, broad name coverage', license: 'FSL-1.1 (code); data derived from eqlwiki' },
      { repo: 'Thiole/EQLGearPlanner', sha: '0213a63b8ee7242dedc34fb1223423a970a56ff2', file: 'items.json', role: 'PRIMARY: stats, slots, classes, races, era/availability, acquisition', license: 'no license file; upstream content eqlwiki CC BY-SA 4.0' },
      { repo: 'nathan-bates/eql', sha: '3caccd09710758581030d0070b03863e15f8d421', file: 'data/items.json, data/focus_effects.json', role: 'gap-fill: endurance, required level, focus effects', license: 'no license file; upstream content eqlwiki CC BY-SA 4.0' },
      { repo: 'DranakCorps-bot/EQBuddy', sha: '03c624cd2955c58028648ae9dbead813518b4121', file: 'src/EQBuddy.Core/Data/ItemCatalog.json.gz', role: 'gap-fill: quests, recipes, drop zones', license: 'MIT' },
    ],
    inputs: Object.entries(FILES).map(([k, f]) => ({
      key: k, file: `research/data/${f}`, bytes: statSync(join(DATA, f)).size, sha256_16: sha256(f),
    })),
    itemIds: {
      source: 'research/validation/tier0-inventory-Avenrae.txt (live client /outputfile inventory, 2026-08-16)',
      note: 'No wiki scrape carries numeric game item IDs. These 298 name->id pairs are the only observed IDs.',
      observed: TIER0_IDS.size,
      applied: withId,
    },
  },
};
writeOut('meta.json', meta);

// ---------------------------------------------------------------------------
// Build report
// ---------------------------------------------------------------------------

const totalRaw = written.reduce((a, w) => a + w.raw, 0);
const totalGz = written.reduce((a, w) => a + w.gz, 0);
const kb = (b) => `${(b / 1024).toFixed(1)} KiB`;

if (!QUIET) {
  const L = console.log;
  L('');
  L('=== EQL data pipeline — build report ===');
  L(`schema v${SCHEMA_VERSION}   built in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  L('');
  L('-- corpus --');
  L(`  source catalogs: eqlwiki ${byW.size}, jmoyers ${byJ.size}, nathan-bates ${byN.size}, eqbuddy ${byE.size}`);
  L(`  union of names:  ${allKeys.length}`);
  L(`  items shipped:   ${records.length}`);
  L(`  with worn slot:  ${meta.counts.withSlot}   (ANY-eligible: ${records.filter((r) => r.an).length})`);
  L(`  with stats:      ${meta.counts.withStats}`);
  L(`  with effects:    ${meta.counts.withEffects}`);
  L(`  with acquisition:${meta.counts.withAcquisition}`);
  L(`  numeric item ids:${withId} of ${TIER0_IDS.size} observed  (exact ${idStats.exact}, loose ${idStats.loose}, unmatched ${idStats.unmatched.length})`);
  for (const u of idStats.unmatched) L(`    unmatched id: ${u}`);
  if (idConflicts.length) L(`    !! same name, two ids in the export: ${idConflicts.join('; ')}`);
  L('');
  L('-- per-slot counts --');
  for (const [k, v] of shardCounts.entries({ sort: 'value' })) L(`  ${k.padEnd(12)} ${String(v).padStart(6)}`);
  L('');
  L('-- field resolution by source (field <- source : hits; `.fill` counts individual keys) --');
  for (const [k, v] of report.sources.entries({ sort: 'key' })) L(`  ${k.padEnd(26)} ${String(v).padStart(6)}`);
  L('');
  L('-- structured parse provenance --');
  for (const [k, v] of report.parsedFrom.entries({ sort: 'value' })) L(`  ${k.padEnd(30)} ${String(v).padStart(6)}`);
  L('');
  L('-- era --');
  for (const [k, v] of report.eras.entries({ sort: 'value' })) {
    const rank = ERA_RANK.has(k) ? ERA_RANK.get(k) : null;
    const state = rank == null ? 'unknown -> shipped, flagged' : (rank <= CURRENT_ERA_RANK ? 'live' : 'GATED OUT');
    L(`  ${k.padEnd(16)} ${String(v).padStart(6)}   ${state}`);
  }
  L(`  era resolved from: ${report.eraSources.entries({ sort: 'value' }).map(([k, v]) => `${k}=${v}`).join(', ')}`);
  L(`  gated out total:   ${eraGatedOut}`);
  for (const [k, v] of report.unavailReasons.entries({ sort: 'value' })) L(`    ${k.padEnd(22)} ${String(v).padStart(6)}`);
  L(`  unknown era (flagged, still shipped): ${eraUnknownCount}`);
  if (report.unknownEraTags.size) L(`  unrecognised era tags: ${report.unknownEraTags.entries({ limit: 10 }).map(([k, v]) => `${k}=${v}`).join(', ')}`);
  L('');
  L('-- Tier 0 corrections (the running game overrules the wiki) --');
  for (const line of tier0Applied) L(`  ${line}`);
  if (!tier0Applied.length) L('  (none)');
  L(`  records shipped with statsUnknown (real item, no stats anywhere): ${statsUnknownCount}`);
  for (const line of tier0Missed) L(`  !! ${line}`);
  L('');
  L('-- effects --');
  for (const [k, v] of report.effectKinds.entries({ sort: 'value' })) L(`  ${k.padEnd(10)} ${String(v).padStart(6)}`);
  L('');
  L('-- weapon skills (normalized to the client vocabulary) --');
  for (const [k, v] of report.skills.entries({ sort: 'value' })) L(`  ${k.padEnd(14)} ${String(v).padStart(6)}`);
  L(`  spellings folded: ${report.skillNormalized.entries({ sort: 'value' }).map(([k, v]) => `${k} (${v})`).join(', ') || '(none)'}`);
  L(`  values that are not weapon skills: ${[...report.unknownSkills].sort().join(', ') || '(none)'}`);
  L(`  !! wiki-vs-client skill risk: ${skillSuspects.length} MNK fist-type weapons are skilled something other than Hand to Hand`);
  L(`     (client confirms Whitened Treant Fists is Hand to Hand; the wiki says 1H Blunt. NOT corrected — see meta.dataReliability.weaponSkill)`);
  L('');
  L('-- flag reliability (raw wiki flag-line conventions) --');
  for (const style of ['legacy', 'modern']) {
    const b = flagConventions[style];
    L(`  ${style.padEnd(7)} pages ${String(b.pages).padStart(5)}   NO_DROP ${String(b.NO_DROP).padStart(5)}  NO_TRADE ${String(b.NO_TRADE).padStart(4)}  MAGIC ${String(b.MAGIC).padStart(5)}  PLACEABLE ${String(b.PLACEABLE).padStart(3)}  LORE_EQUIPPED ${String(b.LORE_EQUIPPED).padStart(3)}  LORE ${String(b.LORE).padStart(5)}`);
  }
  L(`  pages carrying BOTH "No Drop" and "No Trade": ${flagConventions.bothSpellings}`);
  L('     flags ship exactly as the wiki spells them; see meta.dataReliability.flags');
  L('');
  L('-- QA: statsBlock parser vs eqlwiki structured (overlap) --');
  for (const [f, [ok, bad]] of Object.entries(qa.parser)) {
    const tot = ok + bad;
    L(`  ${f.padEnd(6)} ${String(ok).padStart(5)} agree / ${String(bad).padStart(4)} disagree of ${String(tot).padStart(5)}  (${tot ? ((ok / tot) * 100).toFixed(2) : '--'}%)`);
  }
  L('');
  L(`-- QA: cross-source conflicts (eqlwiki value kept, both recorded on the item as \`cf\`) --`);
  for (const [f, list] of Object.entries(qa.conflicts)) {
    L(`  ${f.padEnd(6)} ${String(list.length).padStart(4)} conflicts`);
    for (const x of list.slice(0, 6)) L(`      ${x}`);
  }
  L(`  items carrying a conflict annotation: ${conflictMap.size}`);
  L(`  class codes recovered from raw wiki text (eqlwiki dropped them): ${report.classRecovered.entries({ sort: 'value' }).map(([k, v]) => `${k}=${v}`).join(', ') || '(none)'}`);
  L('');
  L('-- dropped / discarded --');
  L(`  items dropped:        ${report.dropped.length}`);
  for (const d of report.dropped.slice(0, 20)) L(`    ${d.key}: ${d.reason}`);
  L(`  name collisions merged (differing records, richer kept): ${dupNames.size}`);
  for (const [k, v] of dupNames.entries({ limit: 8 })) L(`    ${k} x${v + 1}`);
  L(`  name collisions that were byte-identical: ${dupIdentical.entries({ sort: 'key' }).map(([k, v]) => `${k}=${v}`).join(', ') || '(none)'}`);
  L(`  unrecognised slot tokens:  ${[...droppedSlotTokens].sort().join(', ') || '(none)'}`);
  L(`  unrecognised class tokens: ${[...droppedClassTokens].sort().slice(0, 20).join(', ') || '(none)'}`);
  L(`  unrecognised race tokens:  ${[...droppedRaceTokens].sort().slice(0, 20).join(', ') || '(none)'}`);
  L(`  discarded flag texts:      ${droppedFlagTokens.size} distinct (wiki free text: deity lines, container capacity, food prose)`);
  L('');
  L('-- payload --');
  for (const w of written.sort((a, b) => b.raw - a.raw).slice(0, 8)) L(`  ${w.path.padEnd(26)} ${kb(w.raw).padStart(11)} raw  ${kb(w.gz).padStart(11)} gz`);
  L(`  ... ${written.length} files total`);
  L(`  TOTAL ${kb(totalRaw)} raw / ${kb(totalGz)} gzip`);
  L('');
}
