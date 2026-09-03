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
import { spawnSync } from 'node:child_process';
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
/**
 * Slot types that occupy TWO worn positions each.
 *
 * A character wears two earrings, two bracers and two rings, so `EAR`, `WRIST`
 * and `FINGERS` are one slot type and two places to put something. This is
 * mirrored from `web/src/engine/constants.ts` DOUBLED_SLOTS and cross-checked
 * against it by a test, because the payload must not be able to disagree with
 * the app about how many places a player has.
 */
const DOUBLED_SLOTS = ['EAR', 'WRIST', 'FINGERS'];
/** The two EQL-specific Any Slots, which classic EverQuest did not have. */
const ANY_POSITIONS = 2;
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
 * A seventh piece of that same set, which the player did **not** name.
 *
 * `Shadow Rage Tunic` reached this catalog on 2 September 2026 from the live
 * wiki (`research/data/eqlwiki-supplement-2026-09-02.json`, page 60238), a month
 * after the vendored scrape that supplied the other six. It is kept apart from
 * the list above for one reason: the six are Tier M — a person who plays this
 * game named them — and this one is not. Filing it under `player-confirmed`
 * would put a claim in the ship-reason table that nobody made.
 *
 * What is actually known about it, and it is more than nothing:
 *   - the page states `Class: BER`. Berserker is not a class in the era of
 *     original EverQuest this wiki is otherwise contaminated by, so a
 *     BER-restricted page is poor evidence of an original-EQ item of the
 *     same name — which is the specific confusion the rest of this set exists
 *     to guard against;
 *   - its `dropsfrom` names the Plane of Fear and the Plane of Hate, which is
 *     where the player placed the set;
 *   - it is listed on the wiki's own `VerifiedPages` registry.
 *
 * That is corroboration, not observation. So it ships — a Berserker looking for
 * the chest piece of a set they are wearing should find it — and it is held to
 * exactly the standing of its siblings below: era cleared, stats withheld,
 * marked. Restoring its numbers needs a client capture, not a better argument.
 */
const EQL_SET_PIECE_NAMES = ['Shadow Rage Tunic'];

/**
 * The Shadow Rage stat blocks were withheld from 17 August to 2 September 2026.
 * They are not withheld any more, and this note records what changed.
 *
 * The instruction was: *"If the stat block that you have for it is from out of
 * Era, do not include it until I tell you and supply you with correct stats for
 * every item."* On 2 September the owner supplied four client item windows —
 * Wristguard +4, Sleeves +5, Helm +5, Leggings +4.
 *
 * Three of those items had a wiki `+0` block that this file was suppressing. So
 * the captures were used to TEST those blocks rather than to replace them: push
 * the wiki's +0 through `web/src/engine/upgrade.ts`, which was derived from a
 * documented rule set and never fitted to these items, and compare with the
 * client. **23 of 23 printed fields reproduce exactly**, weights included —
 * base 2.0 -> 1.3, base 4.5 -> 2.9, base 3.9 -> 2.2, on a log2 curve where a
 * 0.1 error in the base is visible. `shadow-rage-capture.test.ts` is the check
 * and it runs in CI; `research/validation/TIER0-VALIDATION.md` §9 is the record.
 *
 * The blocks were right all along. Withholding them was still correct: nothing
 * available on 17 August could show they were right, and the difference between
 * a number that is correct and a number that is *known* to be correct is the
 * whole subject of the sourcing standard.
 *
 * What has NOT changed is the era. The player places the set in the Planes of
 * Fear and Hate without saying which piece came from which, so every piece still
 * ships `eraUnknown`. Verified stats do not retroactively verify an era.
 */
const SHADOW_RAGE_STATS_VERIFIED = true;

/**
 * Per-item field corrections applied to records the sources DID produce.
 *
 * `set` overwrites, `clear` deletes. Anything not named is left exactly as the
 * sources had it.
 */
/**
 * The Shadow Rage pieces that have a wiki stat block, and the standing each one
 * ships under.
 *
 * `capture` names the client window that confirms the block, where one exists.
 * The three at +4/+5 were checked field by field against the wiki's +0 through
 * `upgrade.ts`; the Tunic was confirmed by the owner reading its +0 block back.
 */
const SHADOW_RAGE_STATTED = [
  { n: 'Shadow Rage Leggings', capture: 'Leggings +4, 2026-09-02' },
  { n: 'Shadow Rage Sleeves', capture: 'Sleeves +5, 2026-09-02' },
  { n: 'Shadow Rage Wristguard', capture: 'Wristguard +4, 2026-09-02' },
  /*
   * The Tunic has no capture, and so does not get the captures' evidence. What
   * released its block is the owner reading it back on 2026-09-02 — a player
   * report, which is Tier M for existence but is not a field-by-field check of
   * a stat block, and it was phrased as a likeness rather than a confirmation.
   * It therefore ships `tier-5` where its three captured siblings ship `tier-M`,
   * and the two are not blurred by giving them the same sentence.
   */
  {
    n: 'Shadow Rage Tunic',
    capture: null,
    evidence:
      'Believed to be the chest piece of the player-confirmed Shadow Rage set: its wiki page '
      + 'restricts the item to BER and names the Planes of Fear and Hate, both of which agree '
      + 'with the player report for the set. Its stat block was withheld until 2026-09-02, when '
      + 'the owner read it back and said it "sounds like the correct stats for Shadow Rage Tunic '
      + '+0". That is the owner\'s own report and it released the block, but it is not a client '
      + 'window checked field by field, so this row is marked tier-5 rather than tier-M. No '
      + 'capture of this piece exists.',
  },
];

const SHADOW_RAGE_VERIFIED_EVIDENCE =
  'Confirmed to exist by player report. Its wiki stat block was withheld until 2026-09-02 '
  + 'and is now shipped: the owner supplied client item windows for four pieces of this set, '
  + 'and pushing the wiki +0 blocks through the documented +N scaling model reproduces all 23 '
  + 'printed fields of the three captured items exactly, weights included. See '
  + 'research/validation/TIER0-VALIDATION.md §9. The era remains unstated — the set is placed '
  + 'in two planes without a piece-by-piece mapping, and verified stats do not verify an era.';

const SHADOW_RAGE_WITHHELD_EVIDENCE =
  'Confirmed to exist by player report; the wiki stat block for it is of unverified '
  + 'provenance and is withheld rather than shown. ' + PLAYER_REPORT_2026_08_17_ERA;

/**
 * Per-item field corrections applied to records the sources DID produce.
 *
 * `set` overwrites, `clear` deletes. Anything not named is left exactly as the
 * sources had it.
 */
const TIER0_CORRECTIONS = [
  /*
   * The Shadow Rage pieces that have a wiki page. Every one of them keeps its
   * era cleared, because the player placed the set in two planes and named no
   * mapping; what `SHADOW_RAGE_STATS_VERIFIED` controls is only whether the
   * NUMBERS ship. It was `false` from 17 August to 2 September and is now
   * `true`, on the client captures recorded above.
   *
   * The flag used to be declared and read by nothing, so setting it did exactly
   * as much as not setting it. It is wired here now, which is the only reason
   * the note attached to it means anything.
   */
  ...SHADOW_RAGE_STATTED.map(({ n, capture, evidence }) => ({
    n,
    set: {
      ...(SHADOW_RAGE_STATS_VERIFIED ? {} : { statsUnknown: true }),
      eraUnknown: true,
      evidence: SHADOW_RAGE_STATS_VERIFIED
        ? evidence ?? SHADOW_RAGE_VERIFIED_EVIDENCE + (capture ? ` Capture: ${capture}.` : '')
        : SHADOW_RAGE_WITHHELD_EVIDENCE,
    },
    /*
     * `era` is cleared in both modes. The wiki calls Leggings and the Tunic
     * `Classic`; the player places the whole set in the Planes of Fear and Hate.
     * Rather than pick one of those or split the difference, the set ships with
     * its era stated as unknown — which is what it is.
     */
    clear: SHADOW_RAGE_STATS_VERIFIED ? ['era'] : ['era', 'st', 'sv', 'wp', 'fx'],
    source: PLAYER_REPORT_2026_08_17 + ' ' + PLAYER_REPORT_2026_08_17_ERA,
    was: SHADOW_RAGE_STATS_VERIFIED
      ? 'the era the wiki assigns this piece'
      : 'wiki stats, shipped as scoreable data',
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
 *   - `cl` comes from the player report quoted above.
 * No `era` appears here, deliberately: the player placed the set in two planes,
 * so naming one for any single piece would be an inference. Weight, size, flags,
 * icon, races and every stat are simply absent, because nothing observed them.
 * `ra` is therefore left off and the app's documented default (ALL) applies,
 * exactly as it does for every other record whose sources carry no race data.
 */
const TIER0_KNOWN_ITEMS = [
  /*
   * The one entry in this table that carries numbers, and the only place in this
   * pipeline where a stat block is DERIVED rather than read.
   *
   * No wiki page for the Helm exists in any of the five sources, so its 2026-09-02
   * client capture at +5 is the only description of it there is. Inverting that
   * capture through `upgrade.ts` — searching every base that maps to the observed
   * value — resolves each field to exactly one candidate and no field is
   * ambiguous:
   *
   *   AC         21 at +5  ->  14        SV Disease  18 at +5  ->  12
   *   STR        12 at +5  ->   7        Weight     2.3 at +5  ->  4.1
   *   AGI        10 at +5  ->   5
   *
   * `SV Void 5` on the capture is deliberately absent below: it is the synthetic
   * save `voidBonus` generates from the tier, not part of any base block.
   *
   * This is arithmetic on a Tier M observation, through a model that reproduced
   * 23 of 23 fields on this same set. It is still a derivation, and the evidence
   * string says so rather than claiming the client was seen printing these.
   */
  {
    n: 'Shadow Rage Helm',
    id: 55601,
    sl: ['HEAD'],
    cl: ['BER'],
    ra: ['ALL'],
    fl: ['LORE_EQUIPPED', 'NO_TRADE', 'QUEST'],
    sz: 'SMALL',
    wt: 4.1,
    st: { AC: 14, STR: 7, AGI: 5 },
    // `DISEASE`, not `SV_DISEASE` — `SAVE_KEYS` is the vocabulary, and the `SV_`
    // prefix belongs to the client's display, not to the field name.
    sv: { DISEASE: 12 },
    evidence:
      'Confirmed to exist: worn in the Head position of the live client inventory export ' +
      '(research/validation/tier0-inventory-Avenrae.txt, item #55601). No wiki catalog has a ' +
      'page for it. The stat block below is DERIVED, not read: it is the unique +0 that the ' +
      'documented +N model maps onto the client item window captured at +5 on 2026-09-02. ' +
      'See research/validation/TIER0-VALIDATION.md §10. ' + PLAYER_REPORT_2026_08_17,
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
// Source standing — two independent facts, recorded for every shipped record
// ---------------------------------------------------------------------------

/**
 * `research/SOURCING-STANDARD.md` rule 5: *"A player looking at a number is
 * entitled to know whether it came from the game or from a wiki page of
 * uncertain provenance."* Two fields carry that, and they are deliberately
 * **independent of each other**, because they answer different questions and
 * rest on different files.
 *
 *   `ex`  EXISTENCE  — is this item in the game?
 *   `sd`  STANDING   — where did the numbers printed on this row come from?
 *
 * Conflating the two is the defect this section exists to remove. The live
 * inventory export is a `Location / Name / ID / Count / Slots` table: it is
 * Tier M proof that an item **exists**, and it carries **no stat values at
 * all**. Marking a wiki stat block "Tier M — confirmed in the live game"
 * because the item's *name* appeared in that export prints the strongest label
 * in the vocabulary over Tier 2 data. Meanwhile Earthshaker — the one stat
 * block in this project checked digit-for-digit against a client window — is
 * an ordinary in-era wiki page and carries no export-name rescue, so it read as
 * unremarkable.
 *
 * So: existence comes from the export and the player reports. Standing comes
 * from `TIER0-VALIDATION.md`, the scrape, and the era that places (or fails to
 * place) that scrape in this game.
 */

/**
 * EXISTENCE, fact one. Values of `ex`:
 *
 *   `live-export`    the name resolves to a line in
 *                    `research/validation/tier0-inventory-Avenrae.txt`. The
 *                    character possesses it in the running game.
 *   `player-report`  the owner named it directly (`EQL_CONFIRMED_NAMES`).
 *   absent           no Tier M evidence. The item ships on its era, which is a
 *                    Tier 2 statement about content, not a sighting.
 *
 * Both values are Tier M under the standard, and neither says anything
 * whatsoever about the item's stats. The set is computed below from `idByKey`,
 * the same export resolution that supplies numeric item ids — one parse of one
 * file, used for both, so the two can never drift apart.
 */
const EXISTENCE_EXPORT = 'live-export';
const EXISTENCE_REPORT = 'player-report';
/**
 * Seen dropping in the game, in EQL Source's own parsed combat logs.
 *
 * `data/sightings.v1.json` records which mobs have been measured dropping which
 * items, with a sighting count and the sessions behind it. A drop that was
 * *observed* is the strongest existence evidence there is — stronger than an
 * inventory line, which only proves somebody holds the item, and far stronger
 * than a wiki era tag.
 *
 * Their own first note on that file is the rule this pipeline already follows,
 * arrived at separately: **"A COUNT, NEVER A RATE. A drop seen once is seen
 * once. Nothing here supports a drop-rate claim and none is made."** Nothing
 * downstream of this turns `seen` into a percentage.
 */
const EXISTENCE_SIGHTED = 'measured-drop';
/**
 * Named in `data/items.v1.json` — the item-name-to-game-ID table EQL Source
 * built from `/outputfile inventory` dumps. Same class of evidence as this
 * repository's own export, from a wider pool of characters.
 */
const EXISTENCE_EQLS_ID = 'eqlsource-id';

/**
 * STANDING, fact two. Values of `sd`, mapped onto the tiers in
 * `research/SOURCING-STANDARD.md`:
 *
 *   `tier-M`        the stat block was read off a live client window and agrees
 *                   with what ships, field for field. Enumerated in
 *                   `TIER0_STATS_VERIFIED` below and re-checked against the
 *                   record at build time — never asserted, always proven.
 *   `tier-2`        structured wiki data for an item whose era places it inside
 *                   this game's content. The standard's Tier 2: "machine-shaped
 *                   fields that somebody entered from the live game."
 *   `tier-5`        wiki numbers this project cannot place in this game. The
 *                   item ships on Tier M *existence* evidence alone: its era is
 *                   missing everywhere, or it is past the current era. Tier 5's
 *                   rule is that the wiki is "a Project 1999 import, sometimes
 *                   word for word... quoted only when marked as classic, never
 *                   as Legends fact" — and an era-unplaced page is exactly a
 *                   page that cannot be quoted as Legends fact. Marked on
 *                   sight. This is the same reasoning that withholds the Shadow
 *                   Rage stat blocks, applied to the rest of the catalog rather
 *                   than to one set.
 *   `unattributed`  the row prints no sourced stat values at all — either it
 *                   never had any (food, containers, quest turn-ins) or they
 *                   are deliberately withheld (`statsUnknown`). There is
 *                   nothing here to attribute, and saying so is a fact rather
 *                   than a guess. **This is what the standard's "where you
 *                   cannot tell" case looks like, and it is stated, not left
 *                   blank.**
 *
 * Tiers 1, 3 and 4 never appear. No patch note, named community guide or
 * aggregator supplies an item stat in this repository; inventing an occupant
 * for those rows would be the inference the standard forbids. `meta` says so
 * explicitly rather than leaving the reader to wonder.
 */
const STANDING_TIER_M = 'tier-M';
const STANDING_TIER_2 = 'tier-2';
const STANDING_TIER_5 = 'tier-5';
const STANDING_UNATTRIBUTED = 'unattributed';
const STANDINGS = [STANDING_TIER_M, STANDING_TIER_2, STANDING_TIER_5, STANDING_UNATTRIBUTED];

/**
 * The stat blocks a live client window has confirmed, transcribed from
 * `research/validation/TIER0-VALIDATION.md`.
 *
 * Every entry lists the **base** values the client's own numbers imply, and the
 * build compares them to what the record actually ships. A mismatch does not
 * downgrade quietly: the item loses the Tier M mark, and the discrepancy is
 * reported. The mark therefore certifies agreement between this catalog and the
 * game, not merely that somebody once looked at the item.
 *
 * `vf` — the fields that were checked — ships with the record too, because
 * "Earthshaker's stats are client-verified" is not true of Earthshaker's `DEX`,
 * which appears in no client capture. A per-field list is the honest width of
 * the claim, and it is what a stat row needs in order to mark itself.
 */
const TIER0_STATS_VERIFIED = [
  {
    n: 'Earthshaker',
    wp: { dmg: 37, dly: 70 },
    st: { STR: 6, STA: 6 },
    /*
     * The count and the list must both match the record's Earthshaker table.
     *
     * This shipped as "Base Dmg 74, Delay 70, Ratio 1.057, Strength 16,
     * Stamina 16, SV Void 10. Nine of nine predictions exact." — SIX fields
     * enumerated, NINE claimed, against a table holding SEVEN MATCH rows. Three
     * different numbers for one result, in `sd`'s citation on the flagship
     * Tier M item, in the published payload.
     *
     * `Dmg Bon 50` was the field left out. The record's §1 heading says "9 of 9"
     * and its two tables — Whitened Treant Fists 4, Earthshaker 7 — hold 11
     * MATCH verdicts between them, so that heading reconciles with neither; it
     * is flagged in HANDOFF.md rather than edited here, because it is the
     * source other sessions cite.
     */
    cite:
      'TIER0-VALIDATION.md §1: observed in a live client window at +10 — Base Dmg 74, Delay 70, ' +
      'Ratio 1.057, Dmg Bon 50, Strength 16, Stamina 16, SV Void 10. ' +
      'Seven of seven predictions exact.',
  },
  {
    n: 'Whitened Treant Fists',
    wp: { dmg: 14, dly: 28 },
    cite:
      'TIER0-VALIDATION.md §1: observed in live client windows at +0, +1, +2 and +3 — ' +
      'DMG 14/15/16/18 against a base of 14, Delay 28 at every tier.',
  },
  {
    n: 'Cloak of Flames',
    st: { AC: 10, HP: 50, AGI: 9, DEX: 9, HASTE: 36 },
    sv: { FIRE: 15 },
    cite:
      'TIER0-VALIDATION.md §5: observed in a live client window at +7 — AC 17, HP 85, AGI 16, ' +
      'DEX 16, Haste 43, SV Fire 25. The SV Fire reading is the sample that corrected the ' +
      "project's rounding rule to truncation.",
  },
  {
    n: 'Bone-Clasped Girdle',
    st: { AC: 4, HP: 75, MANA: 75, STR: 7, STA: 7, DEX: 7 },
    cite:
      'TIER0-VALIDATION.md §5: observed in a live client window at +4 — AC 8, HP 105, Mana 105, ' +
      'STR/STA/DEX 11.',
  },
  {
    n: 'Bladestopper',
    st: { AC: 25, HP: 50, STA: 15 },
    cite:
      'TIER0-VALIDATION.md §5: observed in a live client window at +6 — AC 40, HP 80, STA 24.',
  },
  /*
   * The Shadow Rage captures of 2 September 2026 (TIER0-VALIDATION.md §9).
   *
   * These three differ from the five above in one way worth stating: the client
   * was not read at +0, so the check is not a direct field comparison but a
   * prediction. The wiki's +0 block is pushed through the +N model and matched
   * against the capture. That is a stronger test rather than a weaker one — it
   * has to get the scaling right as well as the base — and every field of all
   * three reproduces, including the three weights on a log2 curve where 0.1 in
   * the base is visible.
   */
  {
    n: 'Shadow Rage Wristguard',
    st: { AC: 6, STR: 4, AGI: 4, DEX: 4 },
    sv: { FIRE: 5, COLD: 5 },
    cite:
      'TIER0-VALIDATION.md §9: observed in a live client window at +4 — AC 10, STR/AGI/DEX 8, '
      + 'SV Fire 9, SV Cold 9, SV Void 4, Weight 1.3. Eight of eight predictions exact from the '
      + 'wiki +0 block through the documented +N model.',
  },
  {
    n: 'Shadow Rage Sleeves',
    st: { AC: 10, ENDUR: 15, STR: 3, STA: 5, DEX: 5 },
    cite:
      'TIER0-VALIDATION.md §9: observed in a live client window at +5 — AC 15, End 22, STR 8, '
      + 'STA/DEX 10, SV Void 5, Weight 2.2. Seven of seven predictions exact. The End reading is '
      + 'the sample that confirms the percentage branch applies above 10 regardless of field: '
      + '15 gains 7 at +5 where its neighbours gain 5.',
  },
  {
    n: 'Shadow Rage Leggings',
    st: { AC: 12, WIS: 6, AGI: 6, ENDUR: 10 },
    sv: { FIRE: 2, DISEASE: 8 },
    cite:
      'TIER0-VALIDATION.md §9: observed in a live client window at +4 — AC 16, WIS/AGI 10, '
      + 'End 14, SV Fire 6, SV Disease 12, SV Void 4, Weight 2.9. Eight of eight predictions exact.',
  },
  /*
   * The Helm is the one entry whose numbers were DERIVED from the capture rather
   * than checked against it, because no wiki page for it exists to check. Its
   * agreement with the client is therefore circular by construction, and the
   * citation says so outright rather than letting the tier-M mark imply a
   * comparison that never happened.
   *
   * It is still marked tier-M, because the alternative is tier-5, and tier-5
   * asserts "these numbers came from a wiki page that may describe an
   * original-EverQuest item of the same name". For this record that is not a
   * cautious reading, it is a false one: the numbers came from the game.
   */
  {
    n: 'Shadow Rage Helm',
    st: { AC: 14, STR: 7, AGI: 5 },
    sv: { DISEASE: 12 },
    cite:
      'TIER0-VALIDATION.md §10: DERIVED, not compared. No wiki page for this item exists in any '
      + 'source, so its +0 block was recovered by inverting a live client window captured at +5 '
      + '— AC 21, STR 12, AGI 10, SV Disease 18, Weight 2.3 — through the documented +N model. '
      + 'Every field inverts to exactly one candidate base, so the recovery is unambiguous; it '
      + 'is arithmetic on an observation rather than a second observation of it.',
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
  /*
   * De-wikilink, then turn <br> into a real line break.
   *
   * The stats block is line-oriented — every scalar below is matched with an
   * anchored `^…$` — and the wiki ends each row with an explicit <br> as well
   * as a newline. Leaving it in place meant the captured value carried the
   * markup, and the field was then thrown away as unrecognised: the build
   * report listed AMMO<BR>, CHEST<BR>, FINGER<BR> among its unknown slot
   * tokens, ALL<br> and BRD<br> among class tokens, and ALLBR / NONEBR among
   * race tokens. A newline rather than an empty string, because deleting it
   * would join two rows and let one row's trailing text leak into the next
   * row's scan.
   */
  const block = String(text)
    .replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, '$2')
    .replace(/<\s*br\s*\/?\s*>/gi, '\n');

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
  // Live-wiki supplement; see pipeline/wiki-supplement.mjs. Optional: a clone
  // without it builds exactly the catalogue it built before.
  wikiSupplement: 'eqlwiki-supplement-2026-09-02.json',
  // The wiki's own out-of-era verdicts; see pipeline/wiki-era-verdicts.mjs.
  // Optional in the same way: absent, the purge behaves exactly as before.
  wikiEraVerdicts: 'eqlwiki-era-verdicts-2026-09-03.json',
};

const rawJ = readJSON(FILES.jmoyers);
const rawW = readJSON(FILES.eqlwiki);
const rawN = readJSON(FILES.nathanbates);
const rawE = readJSON(FILES.eqbuddy);
const rawF = readJSON(FILES.focusEffects);
const rawS = existsSync(join(DATA, FILES.wikiSupplement)) ? readJSON(FILES.wikiSupplement) : null;
const rawV = existsSync(join(DATA, FILES.wikiEraVerdicts)) ? readJSON(FILES.wikiEraVerdicts) : null;

/**
 * Titles the wiki POSITIVELY marks as out of era for EverQuest Legends.
 *
 * Read from `action=eqlmetadata`, the wiki's own extension, at the
 * `eraRevision` recorded in the vendored file. This is the wiki making a
 * statement about *this game*, which is a stronger thing than the era text
 * fields this pipeline otherwise transcribes — those describe original
 * EverQuest content, and the owner's correction of 2026-09-02 is precisely
 * that the two are not the same question:
 *
 *   "EQ Legends is built in the classic era, but they have brought certain
 *    things from future expansions into classic, so this cannot be a rule,
 *    rather a starting point. Start with EQ classic era, then verify."
 *
 * Only the `true` verdicts are vendored, and only they are used. `outOfEra`
 * comes back `false` for any page the wiki has not tagged at all — measured on
 * `10 Dose Ant's Potion`, a crafted item with no era template, no drop zone and
 * no era signal, which the API still calls `false`. So a `false` is the absence
 * of a mark and never evidence that an item is in the game. Treating it as
 * evidence would admit ~7,100 titles on the strength of nobody having said
 * anything about them, which is the inference-as-confirmation mistake this
 * pipeline has already made once.
 *
 * **This is a disclosure, not a gate, and it was a gate for one day.**
 *
 * On 3 September 2026 it was wired to quarantine the seven items our own era
 * ladder would otherwise ship. The owner corrected it the same day:
 *
 *   *"Can confirm that Miragul is in the game, and people are pre-questing many
 *    of the Epic Weapons that release in Kunark. The final turn-in steps aren't
 *    in the game yet, so the Epic Weapons won't arrive until Kunark, but many of
 *    the early steps exist and people are actively completing them."*
 *
 * `Tome of Miragul` was one of the seven. So `outOfEra: true` does not mean the
 * item is unobtainable either — it means the wiki has filed the page under an
 * expansion, and this server has been seeded with content from expansions it
 * has not formally reached. A Tier M report outranks a wiki tag, and this one
 * did.
 *
 * What the verdict is still good for is saying so on the item. A reader looking
 * at `Tome of Miragul` is better served by "the wiki files this under Kunark"
 * than by either hiding it or pretending the disagreement does not exist.
 */
const WIKI_OUT_OF_ERA = new Set((rawV?.outOfEra ?? []).map((n) => nameKey(n)));

const J_ITEMS = rawJ.items ?? rawJ;                       // dict keyed by lowercased name
const W_ITEMS = rawW.items ?? rawW;                       // array
const N_ITEMS = Array.isArray(rawN) ? rawN : (rawN.items ?? []);
const E_ITEMS = rawE.Items ?? rawE.items ?? [];
const F_ITEMS = Array.isArray(rawF) ? rawF : (rawF.items ?? rawF.focus_effects ?? []);
const S_ITEMS = rawS?.items ?? [];

/** name-key -> source record, for each source. */
const byJ = new Map(), byW = new Map(), byN = new Map(), byE = new Map(), byS = new Map();
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
/*
 * The live-wiki supplement is indexed like any other source and consulted LAST
 * in every `pick` list below, so it can only fill a gap the other four left and
 * can never overrule them. It carries raw statsblock wikitext rather than parsed
 * fields precisely so that `parseStatsBlock` stays the only parser.
 */
indexBy(byS, S_ITEMS, (r) => r.name, 'eqlwiki-live');

/** loose-key -> [name-keys], used only when the loose key is unambiguous. */
const looseIndex = new Map();
for (const k of new Set([...byW.keys(), ...byJ.keys(), ...byN.keys(), ...byE.keys(), ...byS.keys()])) {
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

// ---------------------------------------------------------------------------
// EQL Source's own published datasets
// ---------------------------------------------------------------------------

/**
 * `https://eqlsource.com/data/` — four versioned, CORS-open datasets that the
 * site publishes for exactly this purpose: "Nobody in this community publishes
 * machine-readable data, so every tool re-transcribes the same wiki pages and
 * inherits the same 1999 errors doing it."
 *
 * This planner is an EQL Source tool, so it reads them rather than re-deriving
 * what the surveys already measured. Two are used here:
 *
 *   `items.v1.json`      item name to the game's own numeric ID, read from
 *                        `/outputfile inventory` dumps.
 *   `sightings.v1.json`  which mobs have been measured dropping which items,
 *                        parsed from combat logs, with the sighting count and
 *                        the dated sessions behind each row.
 *
 * Both are Tier M: they record what the game did, not what a page says. They
 * are vendored under `pipeline/sources/eqlsource/` and pinned by the `hash`
 * the publisher ships, so a build is reproducible and a change in the upstream
 * data is visible as a diff rather than as a silent shift.
 */
function loadEqlSource(file) {
  const path = join(ROOT, 'pipeline', 'sources', 'eqlsource', file);
  if (!existsSync(path)) return { data: null, hash: null, version: null };
  const doc = JSON.parse(readFileSync(path, 'utf8'));
  return { data: doc.data, hash: doc.hash ?? null, version: doc.version ?? null };
}

const EQLS_ITEMS = loadEqlSource('items.v1.json');
const EQLS_SIGHTINGS = loadEqlSource('sightings.v1.json');
const EQLS_ZONES = loadEqlSource('zones.v1.json');

/** Display name -> numeric game id, from the published table. */
const EQLS_ID_BY_NAME = new Map(Object.entries(EQLS_ITEMS.data?.items ?? {}));
/** Display name -> [{ mob, seen, sessions }], measured rather than transcribed. */
const EQLS_SIGHT_BY_NAME = new Map(Object.entries(EQLS_SIGHTINGS.data?.items ?? {}));

const EQLS_SKY = loadEqlSource('sky.v1.json');

// --- BEGIN zone survey (fed by pipeline/refresh.mjs) ------------------------
/**
 * How far the survey behind a drop source has got.
 *
 * `zones.v1.json` carries, per zone, five coverage facets — bosses, loot,
 * difficulty, inherited claims, farming — each graded `measured` (from their own
 * logs), `sourced` (from a document) or `none`, plus a `verify_level` which is a
 * *sourcing hygiene* check and not a measure of usefulness. The publisher's own
 * notes are emphatic about the difference, and about the consequence:
 *
 *   "Verified means checked against source. It does not mean complete."
 *
 * That sentence is the whole reason this block exists. A planner that prints
 * "drops from Castle Mistmoore" and stops has implied the zone is understood.
 * Three of Mistmoore's five facets are measured; the app is now able to say
 * which, and to say nothing at all for a zone with no survey record rather than
 * printing a zero nobody measured.
 *
 * The two files spell zone names differently — a session line says "The Castle
 * of Mistmoore", sometimes with a " - Group" difficulty suffix; the survey title
 * says "Castle Mistmoore". Folding the difficulty suffix, the articles and the
 * joining prepositions matches those without asserting anything about the game.
 * Anything that still does not match is reported as unsurveyed. Attaching a
 * survey to the nearest-looking zone would be an inference, and a wrong survey
 * badge is worse than an absent one.
 */
const ZONE_STOPWORDS = new Set(['the', 'of', 'a', 'an']);
function zoneTokens(name) {
  return nameKey(name)
    .replace(/\s*-\s*(group|raid|solo)\s*$/i, '')
    .replace(/[^a-z0-9' ]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t && !ZONE_STOPWORDS.has(t))
    .join(' ');
}

/** Derive the survey state of one published zone record. Never hand-set. */
function zoneSurveyOf(z) {
  const facets = Object.entries(z.coverage ?? {}).map(([facet, v]) => ({ facet, level: v?.level ?? 'none' }));
  const measured = facets.filter((f) => f.level === 'measured').length;
  const sourced = facets.filter((f) => f.level === 'sourced').length;
  const survey = !facets.length
    ? 'unstated'
    : measured === facets.length
      ? 'measured'
      : facets.every((f) => f.level === 'none')
        ? 'none'
        : 'partial';
  return {
    slug: z.slug ?? null,
    title: String(z.title ?? '').trim(),
    survey,
    measured,
    sourced,
    facets: facets.length,
    // Carried through as published; graded above, never re-graded.
    coverage: Object.fromEntries(facets.map((f) => [f.facet, f.level])),
    verify: z.verify_level ?? null,
    score: z.coverage_score ?? null,
    ...(z.levels ? { levels: z.levels } : {}),
    ...(z.url ? { url: z.url } : {}),
  };
}

const EQLS_ZONE_SURVEYS = (EQLS_ZONES.data?.zones ?? []).map(zoneSurveyOf);
const EQLS_ZONE_BY_TOKENS = new Map(EQLS_ZONE_SURVEYS.map((z) => [zoneTokens(z.title), z]));
/** Zone names a session mentions that no survey covers. Reported, not guessed at. */
const unsurveyedZoneNames = new Set();

/**
 * The survey behind one zone string as a log spells it.
 *
 * Returns the compact form that rides on a drop row: enough for the app to say
 * "partial survey, 3 of 5 facets measured" and link the zone, and no more.
 */
function surveyForZoneName(name) {
  const clean = String(name ?? '').trim();
  if (!clean || clean === 'null') return null;
  const z = EQLS_ZONE_BY_TOKENS.get(zoneTokens(clean));
  if (!z) { unsurveyedZoneNames.add(clean); return null; }
  return { zone: clean, slug: z.slug, title: z.title, survey: z.survey, measured: z.measured, facets: z.facets };
}
// --- END zone survey --------------------------------------------------------

const eqlsIdByKey = new Map();
const eqlsSightByKey = new Map();
for (const [name, id] of EQLS_ID_BY_NAME) eqlsIdByKey.set(nameKey(name), { name, id });
for (const [name, rows] of EQLS_SIGHT_BY_NAME) eqlsSightByKey.set(nameKey(name), { name, rows });


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
const known = (k) => byW.has(k) || byJ.has(k) || byN.has(k) || byE.has(k) || byS.has(k) || KNOWN_ITEM_KEYS.has(k);
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

const allKeys = [...new Set([...byW.keys(), ...byJ.keys(), ...byN.keys(), ...byE.keys(), ...byS.keys()])].sort();

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
  const sup = byS.get(key);
  const js = j?.stats ?? {};
  const blk = j?.statsBlock ? parseStatsBlock(j.statsBlock) : null;
  // Parsed by the same function as `blk`, kept apart from it so provenance says
  // which scrape a field came from rather than only that it came from a block.
  const sblk = sup?.statsBlock ? parseStatsBlock(sup.statsBlock) : null;

  const name = w?.name ?? j?.page ?? j?.name ?? n?.name ?? e?.Name ?? sup?.name;
  if (!name || !String(name).trim()) { report.dropped.push({ key, reason: 'no name in any source' }); continue; }

  // ---- slots
  const [slots, slotSrc] = pick('sl', [
    ['eqlwiki', () => normSlots(w?.slots, droppedSlotTokens)],
    ['jmoyers', () => normSlots(js.slot, droppedSlotTokens)],
    ['statsBlock', () => normSlots(blk?.slotRaw, droppedSlotTokens)],
    ['nathanbates', () => normSlots(n?.slot_raw ?? n?.slots, droppedSlotTokens)],
    ['eqbuddy', () => normSlots(e?.Slots, droppedSlotTokens)],
    ['wikiLive', () => normSlots(sblk?.slotRaw, droppedSlotTokens)],
  ]);
  const sl = slots ?? [];

  // ---- classes / races
  let [classes, classSrc] = pick('cl', [
    ['eqlwiki', () => normClasses(w?.classes, droppedClassTokens)],
    ['statsBlock', () => normClasses(blk?.classRaw, droppedClassTokens)],
    ['eqbuddy', () => normClasses(e?.Classes, droppedClassTokens)],
    ['nathanbates', () => normClasses(n?.classes_raw, droppedClassTokens)],
    ['jmoyers', () => normClasses(js.classes, droppedClassTokens)],
    ['wikiLive', () => normClasses(sblk?.classRaw, droppedClassTokens)],
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
    ['wikiLive', () => normRaces(sblk?.raceRaw, droppedRaceTokens)],
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
    ['wikiLive', () => (sblk ? { ...sblk.stats } : null)],
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
    ['wikiLive', () => (sblk ? { ...sblk.saves } : null)],
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
    ['wikiLive', () => {
      if (!sblk || (sblk.dmg == null && sblk.atkDelay == null)) return null;
      const o = {};
      if (sblk.dmg != null) o.dmg = sblk.dmg;
      if (sblk.atkDelay != null) o.dly = sblk.atkDelay;
      if (sblk.skill) o.skill = sblk.skill;
      if (sblk.dmgBonus != null) o.bonus = sblk.dmgBonus;
      if (sblk.range != null) o.range = sblk.range;
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
  if (sblk) for (const ef of sblk.effects) pushFx(ef.k, ef.n, ef.d);
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
    ...(sblk?.flags ?? []),
  ];
  const fl = normFlags(flagPool, droppedFlagTokens);

  // ---- weight / size / icon
  const [wt] = pick('wt', [
    ['eqlwiki', () => num(w?.wt)],
    ['jmoyers', () => num(js.weight)],
    ['statsBlock', () => blk?.weight ?? null],
    ['nathanbates', () => num(n?.weight)],
    ['wikiLive', () => sblk?.weight ?? null],
  ]);
  const [sz] = pick('sz', [
    ['eqlwiki', () => normSize(w?.size)],
    ['jmoyers', () => normSize(js.size)],
    ['statsBlock', () => blk?.size ?? null],
    ['nathanbates', () => normSize(n?.size)],
    ['wikiLive', () => sblk?.size ?? null],
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
    // The live page's own {{X Era}} template. Last, so it only speaks where
    // every vendored source was silent — which for 2,230 records it was.
    ['eqlwiki-live.eraTemplate', sup?.era],
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
    /*
     * The wiki files this page under an expansion this server has not formally
     * reached. Recorded, never acted on: the owner confirmed on 2026-09-03 that
     * `Tome of Miragul` is in the game and that early Epic Quest steps are being
     * completed, so the tag marks a disagreement worth showing rather than a
     * reason to withhold anything. See `WIKI_OUT_OF_ERA`.
     */
    ...(WIKI_OUT_OF_ERA.has(key) ? { wikiOutOfEra: true } : {}),
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

/**
 * Recompute the wiki's availability reading after an era override, by the same
 * rule as the loop. The `ur` half is what matters downstream — `shipDecision`
 * reads `ur === 'non_legends'`. The `av` half is provisional: every survivor of
 * the purge is forced to `av: true` further down, because by then being in the
 * payload at all is the statement that the item is obtainable.
 */
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
  /*
   * Almost every row here has no numbers, and `statsUnknown` is the positive
   * assertion that the record is incomplete on purpose — the stats side of what
   * `eraUnknown` says about era. A zero is not a measurement, so nothing is
   * invented to fill the gap.
   *
   * One row does carry numbers: `Shadow Rage Helm`, whose block was derived from
   * a client capture at +5 (see its own note above). This used to hardcode
   * `statsUnknown: true` and silently drop any `st`/`sv` on the spec, so adding
   * that block had no effect at all — the stats went in and vanished. The
   * condition is on the spec rather than on the name, so a second derived or
   * captured block needs no further change here.
   */
  const hasStats = Boolean(spec.st || spec.sv || spec.wp);
  const rec = {
    key,
    // The export is the source of the id; the table's value is a cross-check.
    id: id ?? spec.id ?? null,
    n: spec.n,
    sl: spec.sl,
    cl: spec.cl,
    ...(spec.ra ? { ra: spec.ra } : {}),
    ...(spec.fl ? { fl: spec.fl } : {}),
    ...(spec.sz ? { sz: spec.sz } : {}),
    ...(spec.wt != null ? { wt: spec.wt } : {}),
    ...(spec.era ? { era: spec.era } : { eraUnknown: true }),
    av,
    ...(spec.st ? { st: spec.st } : {}),
    ...(spec.sv ? { sv: spec.sv } : {}),
    ...(spec.wp ? { wp: spec.wp } : {}),
    ...(hasStats ? {} : { statsUnknown: true }),
    evidence: spec.evidence,
    an: 1,
    es: 'tier0.player-report',
    ...(ur ? { ur } : {}),
  };
  records.push(rec);
  recordByKey.set(key, rec);
  report.eras.add(`${spec.era} (tier0 known item)`);
  tier0Applied.push(
    hasStats
      ? `${spec.n}: added as a known item with a DERIVED stat block (id ${rec.id ?? 'none'})`
      : `${spec.n}: added as a known item with no stat data (id ${rec.id ?? 'none'})`,
  );
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
 * Those items used to ship with `av: false` and be hidden behind a "Live
 * content only" checkbox. That was not good enough. A planner that will happily
 * rank an item the player can never obtain is worse than one with a smaller
 * catalog, because the player cannot tell which is which. So they are removed
 * from what ships — and the checkbox went with them, having nothing left to
 * hide.
 *
 * An item survives if any of:
 *   1. its era is pre-Kunark — rank at or before CURRENT_ERA;
 *   2. it appears in the live client inventory export, which is Tier 0 proof it
 *      exists in this game whatever the wiki claims about its era;
 *   3. the player has named it directly (EQL_CONFIRMED_NAMES);
 *   4. it is a piece of a set from (3) that the wiki attributes to that set,
 *      and whose era this build has just cleared (EQL_SET_PIECE_NAMES).
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
const EQL_SET_PIECE_KEYS = new Set(EQL_SET_PIECE_NAMES.map((n) => nameKey(n)));

function shipDecision(rec) {
  if (EQL_CONFIRMED_KEYS.has(rec.key)) return { ship: true, why: 'player-confirmed' };
  // Reason 4, and deliberately worded apart from reason 3: a piece of a set the
  // player confirmed, attributed to that set by the wiki rather than by them.
  // Its era has just been cleared by TIER0_CORRECTIONS, so without this it would
  // fall to "no era in any source" and the set would ship with a hole in it.
  if (EQL_SET_PIECE_KEYS.has(rec.key)) return { ship: true, why: 'piece of a confirmed set' };
  // The wiki's own "this page is not in Legends" flag. It outranks the live
  // export only because nothing flagged this way appears in the export anyway;
  // if that ever changes, the player wins and this line needs revisiting.
  if (rec.ur === 'non_legends') return { ship: false, why: 'wiki flags non_legends' };
  if (idByKey.has(rec.key)) return { ship: true, why: 'in-live-inventory' };
  /*
   * Measured dropping in game, in EQL Source's parsed logs. This is the
   * strongest existence evidence in the project and it ends the era argument:
   * 74 items quarantined here as "no era in any source" and 7 tagged Kunark
   * have been *seen dropping*. The conservative rule was right to hold them —
   * unconfirmed is not the same as absent — and Tier M is what releases them.
   */
  if (eqlsSightByKey.has(rec.key)) return { ship: true, why: 'measured dropping in game' };
  if (eqlsIdByKey.has(rec.key)) return { ship: true, why: 'in eqlsource id table' };
  if (rec.era == null) return { ship: false, why: 'no era in any source' };
  const rank = ERA_RANK.get(rec.era);
  if (rank == null) return { ship: false, why: `unrecognised era: ${rec.era}` };
  if (rank > CURRENT_ERA_RANK) return { ship: false, why: `era:${rec.era}` };
  return { ship: true, why: `era:${rec.era}` };
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
    /*
     * `cl` and `ra` ride the quarantine record because without them a row
     * cannot be judged, and this file's whole promise is that "restoring any of
     * them is a table entry rather than a re-scrape".
     *
     * They are load-bearing as of 2 September 2026. The owner's correction that
     * day: EQ Legends starts from classic and then *adds* things — Beastlord and
     * Berserker as classes, Froglok, Kerran and Iksar as races, plus items and
     * gear sets built for them. So an item restricted to a class or race that
     * exists only in this game is EQL content by construction, whatever era a
     * wiki assigns it, and that is a fact about the row rather than an inference
     * about it. Deciding that from the quarantine needs the fields to be there.
     */
    else {
      quarantined.push({
        key: rec.key,
        n: rec.n,
        era: rec.era ?? null,
        sl: rec.sl ?? [],
        cl: rec.cl ?? [],
        ra: rec.ra ?? [],
        why,
      });
    }
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

// --- BEGIN patch-day ingestion (fed by pipeline/refresh.mjs) ----------------
/**
 * The general case of what `TIER0_KNOWN_ITEMS` does by hand.
 *
 * Shadow Rage Helm shipped because somebody typed it into a table above. That
 * worked for one set on one afternoon, and it is useless on a patch day: when a
 * revamped dungeon lands, the items that drop out of it are exactly the items no
 * wiki has a page for yet, and requiring a code change per item means they are
 * simply absent from the planner for as long as the change takes.
 *
 * So the rule is generalised rather than the list extended. **Any** item with
 * Tier M existence evidence and no catalog record anywhere ships automatically:
 *
 *   - it appears in `data/sightings.v1.json` — a mob was measured dropping it in
 *     parsed combat logs, which is the strongest existence evidence there is; or
 *   - it appears in `data/items.v1.json` — the name-to-game-ID table read out of
 *     `/outputfile inventory` dumps; or
 *   - it appears in this repository's own client export,
 *     `research/validation/tier0-inventory-Avenrae.txt`, and resolved to no
 *     catalog record. That case was already known and already reported — the
 *     README calls it out as "eight items in a sampled inventory exist in no
 *     wiki catalog at all" — and it was reported and then dropped. It is the
 *     same fact as the other two and it now takes the same path.
 *
 * What ships is deliberately almost empty:
 *
 *   `n`   the published name, spelled exactly as the source spells it
 *   `id`  the observed numeric game ID, where one was observed
 *   `ms`  the measured drop rows, attached below like any other item's
 *   `statsUnknown: true` and an `evidence` string naming what proved it
 *
 * No slot. No class. No era. No stats. The name of a piece of armour makes its
 * slot *obvious* and obvious is not observed — the pipeline has been wrong about
 * exactly this before, when a wiki era tag was read as structural confirmation
 * that five armour sets were EQL content. An item with no slot cannot be
 * equipped, ranked or auto-filled here, which is the correct behaviour for an
 * item nothing has described: the planner can say "this exists and we have
 * nothing on it" instead of either hiding it or inventing a row.
 *
 * `xo` marks the class of record so a consumer can tell it apart from a
 * `statsUnknown` record that *does* carry a slot and a class from a source.
 * Both are honest; they are honest about different amounts.
 */
const EXISTENCE_ONLY_ADMITTED = [];
const existenceAliases = [];
{
  const stamp = (src) => `${src.version ? `v${src.version}` : 'unversioned'}${src.hash ? `, hash ${src.hash}` : ''}`;
  const usedIds = new Set(records.map((r) => r.id).filter((v) => v != null));
  const candidates = new Map();
  for (const [key, { name, id }] of eqlsIdByKey) {
    if (!candidates.has(key)) candidates.set(key, { key, name, id: null, why: [] });
    const c = candidates.get(key);
    c.id = id ?? c.id;
    c.why.push(
      `named in EQL Source's published item-name-to-game-ID table (data/items.v1.json ${stamp(EQLS_ITEMS)}), ` +
      `built from /outputfile inventory dumps, as item #${id}`,
    );
  }
  for (const [key, { name, rows }] of eqlsSightByKey) {
    if (!candidates.has(key)) candidates.set(key, { key, name, id: null, why: [] });
    const total = rows.reduce((n, r) => n + (int(r.seen) ?? 0), 0);
    const mobs = [...new Set(rows.map((r) => String(r.mob ?? '').trim()).filter(Boolean))];
    candidates.get(key).why.unshift(
      `measured dropping from ${mobs.slice(0, 3).join(', ')}${mobs.length > 3 ? ` and ${mobs.length - 3} more` : ''} ` +
      `in EQL Source's parsed combat logs (data/sightings.v1.json ${stamp(EQLS_SIGHTINGS)}), seen ${total} time(s)`,
    );
  }
  /*
   * And this repository's own export. `idByKey` holds only the names that
   * resolved onto a catalog record; anything left in `idStats.unmatched` is a
   * line the client printed for an item nothing else has ever described.
   */
  for (const [name, id] of TIER0_IDS) {
    const key = nameKey(name);
    if (!candidates.has(key)) candidates.set(key, { key, name, id: null, why: [] });
    const c = candidates.get(key);
    c.name = name;                                     // the client's own spelling wins
    c.id = id;
    c.localExport = true;
    c.why.unshift(
      'held in a live client inventory export (research/validation/tier0-inventory-Avenrae.txt) ' +
      `as item #${id}`,
    );
  }

  /*
   * The same name, spelled differently, is not a new item.
   *
   * `Executioner's Axe` in the ID table is `An Executioners Axe` in the catalog,
   * and both are item #5407. Admitting the first as a brand-new record would put
   * two rows in the planner for one item — the exact failure this whole path is
   * meant to prevent, arriving from the other direction. So a candidate is
   * resolved against the catalog on the loose key first, and only a candidate
   * that matches nothing at all is admitted.
   *
   * A trailing `*` is kept significant. The catalog already ships
   * `Shimmering Pearl*` and `Short Sword*` as separate items from their unstarred
   * namesakes, and the client prints `Backpack*` (#32601) beside `Backpack`
   * (#17005): two items, two IDs, one asterisk between them.
   */
  const aliasKey = (s) => looseKey(s) + (/\*\s*$/.test(String(s ?? '').trim()) ? '*' : '');
  const aliasIndex = new Map();
  for (const rec of records) {
    const ak = aliasKey(rec.n);
    if (!aliasIndex.has(ak)) aliasIndex.set(ak, []);
    aliasIndex.get(ak).push(rec);
  }

  /*
   * Shipped records, not all records. This runs after the era purge on purpose:
   * these items were never in the wiki scrape, so counting them among the 11,252
   * records the purge sorted through would misreport what the scrape held. It
   * also closes a real hole — a record the wiki flags `non_legends` is
   * quarantined ahead of every other test, so an item EQL Source has *measured
   * dropping* could be held out by a wiki flag and then skipped here for having
   * a record. Judged against what actually ships, it is admitted instead.
   */
  const shippedKeys = new Set(records.map((r) => r.key));
  for (const c of [...candidates.values()].sort((a, b) => a.key.localeCompare(b.key))) {
    if (shippedKeys.has(c.key)) continue;              // a source describes it; nothing to admit
    if (KNOWN_ITEM_KEYS.has(c.key)) continue;          // hand-listed above, with slot and class evidence
    const aliases = aliasIndex.get(aliasKey(c.name)) ?? [];
    if (aliases.length) {
      const idMismatch = c.id != null && aliases.every((a) => a.id != null && a.id !== c.id);
      /*
       * And the evidence follows the item to its catalog spelling.
       *
       * `Dark Cauldron` was measured dropping; the catalog calls it `A Dark
       * Cauldron`; the sighting was keyed by the published name and therefore
       * reached nothing. The row existed, the item existed, and the two never
       * met. Registering the alias under the catalog's key is what makes the
       * drop rows, the existence mark and the ship decision all see the same
       * item. Only a 1:1 resolution does this — an ambiguous one is reported and
       * left alone, because guessing which of two records earned a Tier M mark
       * is exactly the kind of inference this pipeline refuses.
       */
      if (aliases.length === 1 && !idMismatch) {
        const target = aliases[0];
        const sighted = eqlsSightByKey.get(c.key);
        if (sighted && !eqlsSightByKey.has(target.key)) eqlsSightByKey.set(target.key, sighted);
        const named = eqlsIdByKey.get(c.key);
        if (named && !eqlsIdByKey.has(target.key)) eqlsIdByKey.set(target.key, named);
      }
      existenceAliases.push(
        `"${c.name}"${c.id != null ? ` (#${c.id})` : ''} is the catalog's ` +
        `${aliases.map((a) => `"${a.n}"${a.id != null ? ` (#${a.id})` : ''}`).join(' / ')}` +
        `${aliases.length > 1 ? ' — AMBIGUOUS, resolved to none of them' : ''}` +
        `${idMismatch ? ' — !! the IDs disagree' : ''}`,
      );
      continue;
    }
    const observedId = idByKey.get(c.key) ?? c.id ?? null;
    // A numeric ID is a join key. Two records claiming one is worse than one
    // record claiming none, so a collision drops the ID rather than the record.
    const id = observedId != null && !usedIds.has(observedId) ? observedId : null;
    if (observedId != null && id == null) {
      tier0Missed.push(`existence-only "${c.name}" declares id ${observedId}, already claimed by another record — shipped without an id`);
    }
    if (id != null) usedIds.add(id);
    // The export is the source of the id, so a record admitted from it joins the
    // export's own index and is marked `live-export` below like any other line
    // in that file. Same file, same evidence, same mark.
    if (c.localExport && id != null) idByKey.set(c.key, id);
    const rec = {
      key: c.key,
      id,
      n: c.name,
      eraUnknown: true,
      av: true,
      statsUnknown: true,
      xo: true,
      evidence:
        `Confirmed to exist: ${c.why.join('; also ')}. No catalog record exists for it in any wiki source, ` +
        'so its stats, slot, class and era are all unknown — stated as unknown rather than guessed from the name.',
      es: 'eqlsource.tier-M-existence',
    };
    records.push(rec);
    recordByKey.set(c.key, rec);
    EXISTENCE_ONLY_ADMITTED.push(rec);
  }
}
// --- END patch-day ingestion ------------------------------------------------

records.sort((a, b) => a.key.localeCompare(b.key));

// ---------------------------------------------------------------------------
// Stamp the two source facts onto every surviving record
// ---------------------------------------------------------------------------

/**
 * Runs after the purge so that `era` is final and every record here is one the
 * app will actually show. Both facts are derived from data this file already
 * computed — the export resolution, the validation table, the era gate — so
 * nothing downstream has to re-derive them from a name list, which is how they
 * got conflated in the first place.
 */
let measuredDropCount = 0;
let measuredRowCount = 0;
const standingCounts = new Counter();
const existenceCounts = new Counter();
const statsVerifiedApplied = [];
const statsVerifiedRejected = [];

/** Does this row print any sourced number at all? */
function hasSourcedNumbers(rec) {
  if (rec.statsUnknown) return false;
  if (rec.st && Object.keys(rec.st).length) return true;
  if (rec.sv && Object.keys(rec.sv).length) return true;
  return Boolean(rec.wp);
}

/**
 * Compare a validation entry against the record and return the fields that
 * agree, or `null` if any declared field disagrees.
 *
 * Disagreement is not smoothed over. If the client says a base of 37 and the
 * catalog ships 36, this catalog's number is not the client's number and must
 * not wear the client's label.
 */
function verifiedFields(rec, entry) {
  const fields = [];
  const bad = [];
  for (const [k, want] of Object.entries(entry.wp ?? {})) {
    const got = rec.wp?.[k];
    if (got === want) fields.push(k === 'dmg' ? 'DMG' : k === 'dly' ? 'DLY' : k.toUpperCase());
    else bad.push(`wp.${k} ${JSON.stringify(got)} != ${want}`);
  }
  for (const [k, want] of Object.entries(entry.st ?? {})) {
    const got = rec.st?.[k];
    if (got === want) fields.push(k);
    else bad.push(`st.${k} ${JSON.stringify(got)} != ${want}`);
  }
  for (const [k, want] of Object.entries(entry.sv ?? {})) {
    const got = rec.sv?.[k];
    if (got === want) fields.push(`SV_${k}`);
    else bad.push(`sv.${k} ${JSON.stringify(got)} != ${want}`);
  }
  return bad.length ? { fields: null, bad } : { fields: uniqSorted(fields), bad };
}

const statsVerifiedByKey = new Map();
const shippedByKey = new Map(records.map((r) => [r.key, r]));
for (const entry of TIER0_STATS_VERIFIED) {
  const key = nameKey(entry.n);
  const rec = shippedByKey.get(key);
  if (!rec) {
    statsVerifiedRejected.push(`${entry.n}: client-verified stats declared, but the item is not in the shipped catalog`);
    continue;
  }
  const { fields, bad } = verifiedFields(rec, entry);
  if (!fields) {
    statsVerifiedRejected.push(`${entry.n}: catalog disagrees with the client window — ${bad.join('; ')}`);
    continue;
  }
  statsVerifiedByKey.set(key, { fields, cite: entry.cite });
  statsVerifiedApplied.push(`${entry.n}: ${fields.join(' ')} agree with the client window`);
}

for (const rec of records) {
  // --- fact one: existence
  // Strongest first: a drop somebody watched happen beats an inventory line,
  // which beats a report.
  if (eqlsSightByKey.has(rec.key)) rec.ex = EXISTENCE_SIGHTED;
  else if (idByKey.has(rec.key)) rec.ex = EXISTENCE_EXPORT;
  else if (eqlsIdByKey.has(rec.key)) rec.ex = EXISTENCE_EQLS_ID;
  else if (EQL_CONFIRMED_KEYS.has(rec.key)) rec.ex = EXISTENCE_REPORT;
  if (rec.ex) existenceCounts.add(rec.ex);

  /*
   * --- where it actually drops, measured rather than transcribed.
   *
   * `ms` carries EQL Source's own sightings: the mob, how many times the drop
   * was seen, and the dated sessions behind it. It is deliberately kept
   * separate from `src`, which holds the wiki's account, because the two are
   * different classes of claim and merging them would launder one into the
   * other.
   *
   * `seen` is a COUNT and never a rate, which is the publisher's own first
   * rule for this file and this project's rule independently. Nothing
   * downstream divides it by anything.
   */
  const sighted = eqlsSightByKey.get(rec.key);
  if (sighted) {
    rec.ms = sighted.rows
      .map((row) => {
        const zones = [...new Set((row.sessions ?? []).map((s) => String(s.zone ?? '').trim()))]
          .filter(Boolean);
        const dates = (row.sessions ?? []).map((s) => s.date).filter(Boolean);
        /*
         * `zs` — the survey behind each of those zones. A drop row that names a
         * zone and says nothing about how well that zone is known reads as a
         * complete answer. Only zones with a published survey record appear
         * here: an unsurveyed one is simply absent, never a zero.
         */
        const surveys = zones.map(surveyForZoneName).filter(Boolean);
        return {
          mob: String(row.mob ?? '').trim(),
          seen: int(row.seen) ?? 0,
          sessions: (row.sessions ?? []).length,
          ...(zones.length ? { zones } : {}),
          ...(surveys.length ? { zs: surveys } : {}),
          ...(dates.length ? { first: dates[0], last: dates[dates.length - 1] } : {}),
          ...(row.off_roster ? { offRoster: true } : {}),
        };
      })
      .sort((a, b) => b.seen - a.seen);
    measuredDropCount += 1;
    measuredRowCount += rec.ms.length;
  }

  // --- fact two: standing of the numbers
  const verified = statsVerifiedByKey.get(rec.key);
  if (verified) {
    rec.sd = STANDING_TIER_M;
    rec.vf = verified.fields;
    rec.sdc = verified.cite;
  } else if (!hasSourcedNumbers(rec)) {
    rec.sd = STANDING_UNATTRIBUTED;
  } else {
    const rank = rec.era == null ? null : ERA_RANK.get(rec.era);
    rec.sd = rank == null || rank > CURRENT_ERA_RANK ? STANDING_TIER_5 : STANDING_TIER_2;
  }
  standingCounts.add(rec.sd);
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
  // `xo` rides the index for the same reason `statsUnknown` does: the picker
  // ranks off the index alone, and a record that only reveals it has no slot,
  // no class and no stats once its shard lands is one the picker has already
  // scored by then.
  'xo',
  // The two source facts ride the index, not just the detail shards: the item
  // browser lists from the index, and a provenance mark that only exists on a
  // hover window is a mark 3,500 rows never get.
  'ex', 'sd', 'sdc', 'vf',
  // `rl` is the third leg of the eligibility gate — `canUse` is
  // `canUseClass && canUseRace && meetsLevel` — and `cl` and `ra` have ridden
  // the index for exactly the reason stated above this list. This one did not,
  // and the rule applies to it identically: until its shard landed, the level
  // check had nothing to check against, so a level-10 character was offered a
  // level-15 Refugee Shroud and its item window showed no Level row at all.
  // Three of 3,663 records carry it (Baton of the Sky 49, Refugee Shroud 15,
  // Azarack Skin Wristwraps 46), so this costs the index about thirty bytes.
  // `verify.mjs` now asserts the rule itself rather than this field, so the
  // next gate field is covered without anyone remembering to come back here.
  'rl',
  // Same rule again, for the same reason. `wikiOutOfEra` says the wiki files
  // this item under an expansion the server has not formally reached — a
  // disagreement the reader should see beside the item's name in a list, not
  // one that appears only after they open it and its shard arrives. Seven
  // records carry it.
  'wikiOutOfEra',
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

/*
 * No licence is asserted, because eqlwiki does not publish one.
 *
 * This read "used under CC BY-SA 4.0. Derived data is shared alike." for the
 * whole life of the project, and it was never checked — it was assumed, the way
 * a wiki usually is CC BY-SA. eqlsource.com verified it three ways on
 * 2026-08-18 and withdrew the claim: `siteinfo` `rightsinfo` returns an empty
 * url and empty text, `/wiki/Project:Copyrights` 404s, and the API normalises
 * to `EQLWiki:Copyrights` and reports it missing.
 *
 * Asserting a licence a source has not granted is the same fault as asserting a
 * stat a source has not published, and this project spent two days removing the
 * second kind. The credit stays — the data is theirs and saying so costs
 * nothing. The trademark disclaimer stays. The terms go, and their absence is
 * stated rather than left blank, which is the same rule rule 7 applies to an
 * item with no slot.
 */
const LICENCE_CHECKED = '2026-08-18';
const ATTRIBUTION =
  'Item data derived from the EverQuest Legends Wiki (eqlwiki.com), with attribution. ' +
  `eqlwiki publishes no content licence — checked ${LICENCE_CHECKED}; siteinfo rightsinfo ` +
  'empty, Project:Copyrights absent — so the terms of reuse are not stated by the source. ' +
  'EverQuest is a trademark of Daybreak Game Company LLC; ' +
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
      rule: 'ships iff pre-Kunark era, or Tier M evidence places it in the game',
      counts: report.purge,
      items: quarantined,
    },
    null,
    1,
  ) + '\n',
);

// ---------------------------------------------------------------------------
// The reader-facing withheld list
// ---------------------------------------------------------------------------

/**
 * One paragraph per quarantine reason, in the words a player meets when a
 * search finds nothing.
 *
 * The prose is written here; the names and counts under it are computed. This
 * file used to be assembled by hand into `web/public/quarantine.json`, and it
 * went stale the first time the catalog moved — the browser told readers 7,719
 * items were withheld while the pipeline had withheld 7,599. Emitting it from
 * the same run that computes the purge makes that impossible.
 *
 * A reason with no entry here is a build failure rather than a silent omission:
 * an unexplained withholding is exactly what this screen exists to prevent.
 */
const WITHHELD_COPY = {
  "era-unplaced": {
    why: "no era in any source",
    title: "Era unplaced",
    line:
      "No source places it in any era. An item nobody can place is treated as unconfirmed rather than assumed classic, so it waits for a patch note or a first-hand sighting to place it. That is a gap in the evidence, not proof the game lacks it \u2014 if you are holding one, it belongs in the catalog and the export importer will say so.",
  },
  "velious": {
    why: "era:Velious",
    title: "Scars of Velious",
    line:
      "It is Scars of Velious content. EverQuest Legends does not have that expansion, so the item is held out of the catalog rather than offered as something you could go and get.",
  },
  "kunark": {
    why: "era:Kunark",
    title: "Ruins of Kunark",
    line:
      "It is Ruins of Kunark content. EverQuest Legends does not have that expansion, so the item is held out of the catalog rather than offered as something you could go and get.",
  },
  "epic": {
    why: "era:Epic Quests",
    title: "Epic quests",
    line:
      "It is Epic Quest content, and this server does not have the epic quests. The wiki carries the page because large parts of it are a Project 1999 import describing original EverQuest, not this game.",
  },
  "chardok": {
    why: "era:Chardok Revamp",
    title: "Chardok revamp",
    line:
      "It comes from the Chardok revamp, a later original-EverQuest content patch this server does not have.",
  },
  "fear-hate-revamp": {
    why: "era:FearHateRevamp",
    title: "Fear/Hate revamp",
    line:
      "It comes from the Fear/Hate revamp, a later original-EverQuest content patch this server does not have. Its five armour sets were once mistaken here for EQL planar gear; the only planar set a player has actually confirmed is Shadow Rage, which does ship.",
  },
  "luclin": {
    why: "era:Luclin",
    title: "Shadows of Luclin",
    line:
      "It is Shadows of Luclin content. EverQuest Legends does not have that expansion, so the item is held out of the catalog rather than offered as something you could go and get.",
  },
  "flagged-not-legends": {
    why: "wiki flags non_legends",
    title: "Flagged not-in-Legends",
    line:
      "The wiki page for it is itself flagged as not present in EverQuest Legends.",
  },
};

{
  const bySlug = new Map(Object.entries(WITHHELD_COPY).map(([slug, v]) => [v.why, slug]));
  const names = Object.fromEntries(Object.keys(WITHHELD_COPY).map((slug) => [slug, []]));
  const unexplained = new Set();
  for (const row of quarantined) {
    const slug = bySlug.get(row.why);
    if (slug) names[slug].push(row.n);
    else unexplained.add(row.why);
  }
  if (unexplained.size) {
    throw new Error(
      `quarantine reasons with no reader-facing copy in WITHHELD_COPY: ${[...unexplained].join(', ')}`,
    );
  }
  for (const list of Object.values(names)) list.sort((a, b) => a.localeCompare(b));
  const explained = Object.values(names).reduce((n, list) => n + list.length, 0);
  writeFileSync(
    join(ROOT, 'web', 'public', 'quarantine.json'),
    JSON.stringify({
      source: 'pipeline/quarantine.json',
      rule: 'ships iff pre-Kunark era, or Tier M evidence places it in the game',
      counts: {
        scraped: report.purge.before,
        shipped: report.purge.shipped,
        quarantined: report.purge.quarantined,
        explained,
      },
      reasons: WITHHELD_COPY,
      names,
    }),
  );
}

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
    content: null,
    contentSource: 'EverQuest Legends Wiki (eqlwiki.com)',
    checked: LICENCE_CHECKED,
    note:
      'eqlwiki publishes no content licence. Verified three ways: siteinfo rightsinfo returns ' +
      'an empty url and empty text, /wiki/Project:Copyrights 404s, and the API normalises to ' +
      'EQLWiki:Copyrights and reports it missing. Item data is derived from it with ' +
      'attribution; the terms of reuse are not stated by the source. This field previously ' +
      'named a specific licence, which was assumed rather than checked; the withdrawal is ' +
      'recorded in pipeline/build.mjs where ATTRIBUTION is declared.',
  },
  era: {
    current: CURRENT_ERA,
    order: ERA_ORDER,
    policy: 'ships iff era rank <= CURRENT_ERA rank, or the item is in the live client export, or the player named it; everything else is quarantined to pipeline/quarantine.json and never reaches the payload. Era-less is unconfirmed, not presumed classic: the few era-less items that do ship are the ones Tier 0 vouches for, and they carry eraUnknown:true. Everything shipped is available (av:true) — there is no client-side era gate.',
  },
  slots: {
    /*
     * The eighteen slot TYPES, named for what they are.
     *
     * This key was `worn`, and a character wears 21 — the field name described a
     * different quantity from its contents, which is the same fault as reading
     * `counts.purge.shipped` where `counts.items` was meant, in the same file.
     * `positions.worn` is the 21. This is the list of type codes and nothing else.
     *
     * BREAKING: consumers reading `slots.worn` must read `slots.types`.
     */
    types: SLOTS,
    any: ANY_SLOT,
    otherShard: NO_SLOT_SHARD,
    anyPolicy: 'items with an:1 may be placed in either "Any Slot" position; no ANY shard is emitted (it would duplicate every worn item)',
    /**
     * How many places a character has to put something — which is NOT
     * `slots.types.length`.
     *
     * `worn` is a list of slot TYPES and there are 18 of them. A reader being
     * told "how many slots does this plan" wants POSITIONS, and there are 23:
     * three of those types are worn twice (two earrings, two bracers, two
     * rings) for 21 worn positions, plus the two EQL-specific Any Slots.
     *
     * 18 + 2 = 20 is the arithmetic somebody does when the doubling is not
     * published, and it is wrong. It was published nowhere until 2026-08-18,
     * so the figure could only be reached by presuming — which is precisely
     * what produced the counts.items / counts.purge.shipped confusion. A number
     * that is right in one field and wrong in another is indistinguishable from
     * a correct one until the two diverge.
     *
     * **`positions.total` is the field to print.**
     */
    positions: {
      total: SLOTS.length + DOUBLED_SLOTS.length + ANY_POSITIONS,
      worn: SLOTS.length + DOUBLED_SLOTS.length,
      any: ANY_POSITIONS,
      types: SLOTS.length,
      doubled: DOUBLED_SLOTS,
      note:
        'total = worn + any. worn = one position per slot type, plus a second for each of ' +
        'doubled. `slots.types.length` is the count of slot TYPES (18) and answers a different ' +
        'question; print `positions.total` when a reader is told how many slots a set has.',
    },
  },

  /**
   * The per-item provenance contract, published so a consumer can render the
   * marks without re-deriving them and without inventing labels of its own.
   * See research/SOURCING-STANDARD.md, whose rule 5 this implements.
   */
  sourceStanding: {
    standard: 'research/SOURCING-STANDARD.md',
    principle:
      'Existence and stat provenance are two facts, not one. The live inventory export proves an ' +
      'item is in the game and carries no stat values at all; the validation captures prove ' +
      'particular numbers. Every shipped record states both, and states them separately.',
    existence: {
      field: 'ex',
      question: 'Is this item in the game?',
      vocabulary: [
        { code: EXISTENCE_SIGHTED, tier: 'M', means: 'a mob was measured dropping it, in EQL Source\'s parsed combat logs (data/sightings.v1.json). The strongest existence evidence here: the game produced the item.' },
        { code: EXISTENCE_EXPORT, tier: 'M', means: 'resolves to a line in research/validation/tier0-inventory-Avenrae.txt, a live /outputfile inventory export' },
        { code: EXISTENCE_EQLS_ID, tier: 'M', means: 'named in EQL Source\'s published item-name-to-game-ID table (data/items.v1.json), built from /outputfile inventory dumps' },
        { code: EXISTENCE_REPORT, tier: 'M', means: 'named directly by the player who plays the game' },
      ],
      absent: 'no Tier M sighting; the item ships because its era places it in this game, which is a Tier 2 statement about content rather than an observation',
      note: 'The export is a Location/Name/ID/Count/Slots table. It proves existence and nothing about stats.',
      counts: Object.fromEntries(existenceCounts.entries({ sort: 'value' })),
    },
    stats: {
      field: 'sd',
      question: 'Where did the numbers printed on this row come from?',
      vocabulary: [
        { code: STANDING_TIER_M, tier: 'M', means: 'the stat block was read off a live client window and agrees with what ships, field for field; `vf` lists the fields actually checked and `sdc` cites the capture' },
        { code: STANDING_TIER_2, tier: '2', means: 'structured wiki data for an item whose era places it inside this game' },
        { code: STANDING_TIER_5, tier: '5', means: 'wiki numbers with no era that places them in this game — the item ships on Tier M existence evidence alone, so its stat block may describe an original-EverQuest item of the same name. Marked on sight.' },
        { code: STANDING_UNATTRIBUTED, tier: null, means: 'the row prints no sourced stat values: it never had any, or they are withheld (statsUnknown). Nothing to attribute, stated rather than left blank.' },
      ],
      tiersNotPresent: {
        '1': 'no patch note supplies an item stat in this repository',
        '3': 'no named community guide is used as an item-stat source',
        '4': 'no aggregator is used as an item-stat source',
      },
      counts: Object.fromEntries(standingCounts.entries({ sort: 'value' })),
      clientVerified: statsVerifiedApplied,
      clientVerifiedRejected: statsVerifiedRejected,
    },
  },
  // --- BEGIN patch-day ingestion (fed by pipeline/refresh.mjs) --------------
  /**
   * The upstream snapshot this payload was built from.
   *
   * Published so that "which version of the data is the site showing?" is a
   * question the site can answer about itself. `hash` and `version` are the
   * publisher's own; `pipeline/sources/eqlsource/manifest.json` additionally
   * records our SHA-256 of the exact bytes, which is what proves the file on
   * disk is the file that was fetched.
   */
  upstream: {
    source: 'https://eqlsource.com/data/',
    refreshedBy: 'pipeline/refresh.mjs',
    manifest: 'pipeline/sources/eqlsource/manifest.json',
    datasets: [
      { file: 'items.v1.json', version: EQLS_ITEMS.version, hash: EQLS_ITEMS.hash, rows: EQLS_ID_BY_NAME.size },
      { file: 'sightings.v1.json', version: EQLS_SIGHTINGS.version, hash: EQLS_SIGHTINGS.hash, rows: EQLS_SIGHT_BY_NAME.size },
      { file: 'zones.v1.json', version: EQLS_ZONES.version, hash: EQLS_ZONES.hash, rows: EQLS_ZONE_SURVEYS.length },
      { file: 'sky.v1.json', version: EQLS_SKY.version, hash: EQLS_SKY.hash, rows: Object.keys(EQLS_SKY.data?.classes ?? {}).length },
    ],
  },

  /**
   * The surveys behind the zones a drop can name.
   *
   * `survey` is derived from the coverage facets and never typed: `measured`
   * only when every facet is measured, `partial` when some are, `none` when
   * none are. The publisher's own note is the rule this implements — *"Verified
   * means checked against source. It does not mean complete."* — so `verify` is
   * carried separately and must not be presented as completeness.
   *
   * `unsurveyed` names the zones a session mentions that no survey covers. They
   * are listed rather than scored: a blank on the source is shown as nothing
   * here, never as a zero.
   */
  zones: {
    source: 'https://eqlsource.com/data/zones.v1.json',
    version: EQLS_ZONES.version,
    hash: EQLS_ZONES.hash,
    field: 'ms[].zs',
    principle:
      'A drop row that names a zone and says nothing about how well that zone is known reads as a ' +
      'complete answer. Verified means checked against source; it does not mean complete.',
    surveyLevels: [
      { code: 'measured', means: 'every coverage facet is measured from EQL Source\'s own logs' },
      { code: 'partial', means: 'some facets are measured or sourced and some are not — the survey is under way, not finished' },
      { code: 'none', means: 'the zone has a record and nothing in it is measured or sourced' },
      { code: 'unstated', means: 'the zone record carries no coverage facets at all' },
    ],
    facets: ['bosses', 'loot', 'difficulty', 'inherited', 'farming'],
    surveyed: EQLS_ZONE_SURVEYS.sort((a, b) => a.title.localeCompare(b.title)),
    unsurveyed: [...unsurveyedZoneNames].sort((a, b) => a.localeCompare(b)),
  },
  // --- END patch-day ingestion ----------------------------------------------

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
    /*
     * Counted, not typed. This note asserted "no source carries it per item;
     * jmoyers has it on 1 item only" until 2 September 2026, by which point
     * both halves were wrong: jmoyers carries a `dmgBonus` field on 0 of its
     * 11,375 records, and four of its stats blocks print a `Dmg Bon` line the
     * old figure did not count. The live wiki prints one on four pages too.
     * A hand-typed census of a field is exactly the defect this file keeps
     * finding in itself, so the number is now read off the payload it describes.
     */
    dmgBonus: (() => {
      const withBonus = records.filter((r) => r.wp?.bonus != null);
      return {
        confidence: withBonus.length ? 'sparse' : 'absent',
        note: `The client shows a Dmg Bon line (13 on Whitened Treant Fists, 50 on Earthshaker), so `
          + `the concept exists. ${withBonus.length} of ${records.length} shipped items carry one`
          + `${withBonus.length ? `: ${withBonus.map((r) => r.n).sort().join(', ')}` : ''}. `
          + `A weapon block is taken whole from the first source that supplies damage or delay, `
          + `rather than assembled field by field across sources, so a bonus printed by a later `
          + `source for an item an earlier one already described does not reach the payload. `
          + `Whether this game stores the bonus per item or derives it from level and weapon type `
          + `is still unsettled; \`wp.bonus\` is emitted only where a source actually printed one, `
          + `and is never reconstructed from a classic formula that may not be this game's.`,
        items: withBonus.map((r) => ({ n: r.n, bonus: r.wp.bonus, dmg: r.wp.dmg ?? null, dly: r.wp.dly ?? null })),
      };
    })(),
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
    // --- BEGIN patch-day ingestion (fed by pipeline/refresh.mjs) ------------
    /**
     * The strictest case: an item Tier M evidence proves exists, that no source
     * describes at all. Admitted automatically, so a drop that lands on patch
     * day appears in the planner without a code change, and admitted with
     * nothing attached, because nothing has been observed but the name.
     */
    existenceOnly: {
      confidence: 'existence-certain-everything-else-absent',
      marker: 'xo',
      count: records.filter((r) => r.xo).length,
      rule:
        'ships iff EQL Source names it — measured dropping in data/sightings.v1.json, or listed in the ' +
        'name-to-game-ID table data/items.v1.json — and no wiki source carries a record for it',
      withheld: ['sl', 'cl', 'era', 'st', 'sv', 'wp', 'ra', 'fl', 'wt'],
      policy:
        'no slot, no class, no era, no stats. It cannot be equipped, ranked, scored or auto-filled, ' +
        'because nothing about it has been measured except that the game produced it. The name of a ' +
        'piece of armour makes its slot obvious; obvious is not observed.',
      items: records.filter((r) => r.xo).map((r) => ({ n: r.n, id: r.id, ex: r.ex ?? null })),
    },
    // --- END patch-day ingestion --------------------------------------------
  },
  counts: {
    items: records.length,
    withNumericId: withId,
    withSlot: records.filter((r) => (r.sl ?? []).length).length,
    withStats: records.filter((r) => r.st).length,
    withEffects: records.filter((r) => r.fx).length,
    withAcquisition: records.filter((r) => r.src).length,
    /*
     * There is no `eraGatedOut` count any more, and its absence is the point.
     * It reported how many shipped records carried `av: false` for the client to
     * hide behind a "Live content only" toggle. Since the purge, out-of-era
     * records are not shipped at all — the number was structurally zero, and
     * publishing it implied a gate that no longer exists. What replaced it is
     * `pipeline/quarantine.json`, which counts and names what was withheld from
     * the build instead of what the client was expected to hide.
     */
    eraUnknown: eraUnknownCount,
    statsUnknown: statsUnknownCount,
    flagged: eraUnknownCount,
    standing: Object.fromEntries(STANDINGS.map((s) => [s, standingCounts.get(s) ?? 0])),
    // Reported from the counter rather than from a hand-written list, so a new
    // evidence class can never be added to the pipeline and silently omitted
    // from the payload that documents it.
    /*
     * The era purge, published so the app can render it instead of a human
     * retyping it. `web/src/screens/sourcesData.ts` used to hold a
     * hand-transcribed copy of these figures, and it drifted the first time the
     * catalog moved — which is what hand-transcribed figures do. EQL Source's
     * own zones dataset states the rule this follows: "Computed, never typed."
     */
    purge: {
      source: 'pipeline/quarantine.json',
      rule: 'ships iff pre-Kunark era, or Tier M evidence places it in the game',
      before: report.purge.before,
      shipped: report.purge.shipped,
      quarantined: report.purge.quarantined,
      /*
       * `shipped` counts what survived the purge, and the catalog is larger than
       * that. The difference is the existence-only records, which were never in
       * the wiki scrape and so were never candidates for the purge: they are
       * admitted afterwards on Tier M evidence alone. Published so the two
       * numbers reconcile on the page rather than looking like a discrepancy.
       */
      admittedOutsideScrape: records.filter((r) => r.xo).length,
      catalog: records.length,
      shipReasons: Object.entries(report.purge.shipReasons).map(([reason, items]) => ({ reason, items })),
      quarantineReasons: Object.entries(report.purge.quarantineReasons).map(([reason, items]) => ({ reason, items })),
    },
    existence: Object.fromEntries(
      [EXISTENCE_SIGHTED, EXISTENCE_EXPORT, EXISTENCE_EQLS_ID, EXISTENCE_REPORT]
        .map((e) => [e, existenceCounts.get(e) ?? 0])
        .filter(([, n]) => n > 0),
    ),
    perSlot: Object.fromEntries(shardCounts.entries({ sort: 'key' })),
    perEffectKind: Object.fromEntries(report.effectKinds.entries({ sort: 'key' })),
  },
  provenance: {
    repos: [
      { repo: 'jmoyers/everquest-companion', sha: 'd25455ee0f251a063e7899e0e544146f4492454d', file: 'src/main/data/items.json', role: 'enrichment: iconId, typed effects, statsBlock, broad name coverage', license: 'FSL-1.1 (code); data derived from eqlwiki' },
      { repo: 'Thiole/EQLGearPlanner', sha: '0213a63b8ee7242dedc34fb1223423a970a56ff2', file: 'items.json', role: 'PRIMARY: stats, slots, classes, races, era/availability, acquisition', license: 'no license file; upstream content from eqlwiki, which states no licence' },
      { repo: 'nathan-bates/eql', sha: '3caccd09710758581030d0070b03863e15f8d421', file: 'data/items.json, data/focus_effects.json', role: 'gap-fill: endurance, required level, focus effects', license: 'no license file; upstream content from eqlwiki, which states no licence' },
      { repo: 'DranakCorps-bot/EQBuddy', sha: '03c624cd2955c58028648ae9dbead813518b4121', file: 'src/EQBuddy.Core/Data/ItemCatalog.json.gz', role: 'gap-fill: quests, recipes, drop zones', license: 'MIT' },
    ],
    inputs: Object.entries(FILES).map(([k, f]) => ({
      key: k, file: `research/data/${f}`, bytes: statSync(join(DATA, f)).size, sha256_16: sha256(f),
    })),
    itemIds: {
      source: 'research/validation/tier0-inventory-Avenrae.txt (live client /outputfile inventory, 2026-08-16)',
      /*
       * Derived, not typed. This sentence used to hard-code "298" beside a
       * computed `observed: 297` and a computed `applied: 289` — three numbers
       * for one fact, one of them a stale literal, and all three are printed
       * on `/sources` where a reader can see them disagree. `SOURCING-STANDARD`
       * rule "never invent a number" applies to the prose about the data as
       * much as to the data.
       *
       * There are two observed sources now, not one, and the second is larger
       * than the first: EQL Source publishes its own name-to-ID table read from
       * `/outputfile inventory` dumps across many characters. `applied` counts
       * records carrying an ID from either, which is why it can exceed the
       * export's own row count — and why the export is named separately rather
       * than left to imply it is the only source.
       */
      note:
        `No wiki scrape carries numeric game item IDs. Two observed sources carry them: this ` +
        `repository's client export (${TIER0_IDS.size} name->id pairs) and EQL Source's published ` +
        `table data/items.v1.json (${EQLS_ID_BY_NAME.size} pairs). ${withId} catalog records carry ` +
        `an ID from one of them.`,
      observed: TIER0_IDS.size,
      observedEqlSource: EQLS_ID_BY_NAME.size,
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
    // These are pre-purge tallies over every scraped record, so they include
    // eras that no longer reach the payload at all. `-- purge --` below is the
    // record of what actually shipped.
    const state = rank == null ? 'no era -> quarantined unless Tier 0 vouches' : (rank <= CURRENT_ERA_RANK ? 'in era' : 'QUARANTINED unless Tier 0 vouches');
    L(`  ${k.padEnd(16)} ${String(v).padStart(6)}   ${state}`);
  }
  L(`  era resolved from: ${report.eraSources.entries({ sort: 'value' }).map(([k, v]) => `${k}=${v}`).join(', ')}`);
  L('  wiki availability flags seen while scraping (superseded by the purge):');
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
  // --- BEGIN patch-day ingestion (fed by pipeline/refresh.mjs) --------------
  L('-- Tier M existence with no catalog record (admitted automatically) --');
  L(`  upstream: ${meta.upstream.datasets.map((d) => `${d.file} v${d.version ?? '?'} ${d.hash ?? '(no hash)'}`).join('   ')}`);
  L(`  admitted: ${EXISTENCE_ONLY_ADMITTED.length} existence-only records — statsUnknown, no slot, no class, no era, never ranked`);
  for (const r of EXISTENCE_ONLY_ADMITTED) L(`    ${r.n}${r.id != null ? ` (#${r.id})` : ''}  ex=${r.ex ?? '(none)'}`);
  L(`  resolved to an existing record instead of admitted (same item, different spelling): ${existenceAliases.length}`);
  for (const line of existenceAliases) L(`    ${line}`);
  L('');
  L('-- zone surveys behind measured drops --');
  for (const z of meta.zones.surveyed) {
    L(`  ${z.title.padEnd(22)} ${String(z.survey).padEnd(9)} ${z.measured}/${z.facets} facets measured   verify=${z.verify ?? 'none'}   score=${z.score ?? '-'}`);
  }
  L(`  zones a session names with no survey record: ${meta.zones.unsurveyed.length ? meta.zones.unsurveyed.join(', ') : '(none)'}`);
  L('');
  // --- END patch-day ingestion ----------------------------------------------
  L('-- source standing: two facts, stamped on every shipped record --');
  L('  existence (`ex`) — is this item in the game? (the export carries no stat values)');
  for (const code of [EXISTENCE_EXPORT, EXISTENCE_REPORT]) {
    L(`    ${code.padEnd(16)} ${String(existenceCounts.get(code)).padStart(6)}`);
  }
  L(`    ${'(none)'.padEnd(16)} ${String(records.length - existenceCounts.get(EXISTENCE_EXPORT) - existenceCounts.get(EXISTENCE_REPORT)).padStart(6)}   ships on its era, not on a sighting`);
  L('  standing (`sd`) — where did the numbers on this row come from?');
  for (const code of STANDINGS) {
    const n = standingCounts.get(code);
    L(`    ${code.padEnd(16)} ${String(n).padStart(6)}   ${((n / records.length) * 100).toFixed(1).padStart(5)}%`);
  }
  L('  stat blocks checked against a live client window (TIER0-VALIDATION.md):');
  for (const line of statsVerifiedApplied) L(`    ${line}`);
  for (const line of statsVerifiedRejected) L(`    !! ${line}`);
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

// ---------------------------------------------------------------------------
// The self-audit is part of the payload, not a thing you remember to run
// ---------------------------------------------------------------------------

/*
 * `contamination.mjs` was a separate script nobody had to run, and the payload
 * was green without it. That is how the self-audit page came to publish quotes
 * from source that had changed twenty minutes earlier: the badge shipped at
 * 04:02, the scan was from 03:42, and every gate passed in between.
 *
 * CI does not run this pipeline at all — it builds the committed
 * `web/public/data/`. So the only moment the scan can be made to agree with the
 * tree is here, when the rest of the payload is written. `verify.mjs` then
 * treats a missing or stale report as a hard failure rather than a warning.
 */
const scan = spawnSync(process.execPath, [join(HERE, 'contamination.mjs')], {
  stdio: 'inherit',
  env: process.env,
});
if (scan.status !== 0) {
  console.error(`\nFATAL: pipeline/contamination.mjs exited ${scan.status}. The payload is incomplete.`);
  process.exit(scan.status ?? 1);
}
