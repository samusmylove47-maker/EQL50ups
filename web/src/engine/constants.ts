/**
 * Game vocabulary for EverQuest Legends.
 *
 * Every value here is sourced from either the live client (Tier 0 — see
 * research/validation/) or the item corpus itself. Nothing is carried over
 * from classic EverQuest on assumption; where the game's own numbers are
 * unknown, the value is absent rather than guessed.
 */

/** The sixteen playable classes: the classic fourteen plus Beastlord and Berserker. */
export const CLASSES = [
  'WAR', 'CLR', 'PAL', 'RNG', 'SHD', 'DRU', 'MNK', 'BRD',
  'ROG', 'SHM', 'NEC', 'WIZ', 'MAG', 'ENC', 'BST', 'BER',
] as const;
export type ClassCode = (typeof CLASSES)[number];

export const CLASS_NAMES: Record<ClassCode, string> = {
  WAR: 'Warrior', CLR: 'Cleric', PAL: 'Paladin', RNG: 'Ranger',
  SHD: 'Shadow Knight', DRU: 'Druid', MNK: 'Monk', BRD: 'Bard',
  ROG: 'Rogue', SHM: 'Shaman', NEC: 'Necromancer', WIZ: 'Wizard',
  MAG: 'Magician', ENC: 'Enchanter', BST: 'Beastlord', BER: 'Berserker',
};

export const CLASS_SET: ReadonlySet<string> = new Set(CLASSES);

/**
 * Armor proficiency tiers. Under multiclassing a character uses the highest
 * tier among their three classes, so a Paladin in the trio opens plate to all.
 */
export const ARMOR_TIER: Record<ClassCode, number> = {
  WAR: 4, PAL: 4, SHD: 4, CLR: 4, BER: 4,
  RNG: 3, BRD: 3, SHM: 3, ROG: 3, BST: 3,
  DRU: 2, MNK: 2,
  NEC: 1, WIZ: 1, MAG: 1, ENC: 1,
};

/**
 * Worn equipment positions, validated against a live `/outputfile inventory`.
 * Eighteen slot types occupying twenty-one positions, plus the two EQL-specific
 * "Any Slot" positions for twenty-three total.
 */
export const SLOT_TYPES = [
  'EAR', 'HEAD', 'FACE', 'NECK', 'SHOULDERS', 'ARMS', 'BACK', 'WRIST',
  'RANGE', 'HANDS', 'PRIMARY', 'SECONDARY', 'FINGERS', 'CHEST', 'LEGS',
  'FEET', 'WAIST', 'AMMO',
] as const;
export type SlotType = (typeof SLOT_TYPES)[number];

/** Slot types occupying more than one position on the character. */
export const DOUBLED_SLOTS: ReadonlySet<SlotType> = new Set(['EAR', 'WRIST', 'FINGERS']);

/** A concrete position in the paper doll, e.g. the second ear. */
export interface SlotPosition {
  id: string;
  type: SlotType | 'ANY';
  label: string;
  index: number;
}

function buildPositions(): SlotPosition[] {
  const labels: Record<SlotType, string> = {
    EAR: 'Ear', HEAD: 'Head', FACE: 'Face', NECK: 'Neck', SHOULDERS: 'Shoulders',
    ARMS: 'Arms', BACK: 'Back', WRIST: 'Wrist', RANGE: 'Range', HANDS: 'Hands',
    PRIMARY: 'Primary', SECONDARY: 'Secondary', FINGERS: 'Fingers', CHEST: 'Chest',
    LEGS: 'Legs', FEET: 'Feet', WAIST: 'Waist', AMMO: 'Ammo',
  };
  const out: SlotPosition[] = [];
  for (const type of SLOT_TYPES) {
    const count = DOUBLED_SLOTS.has(type) ? 2 : 1;
    for (let i = 0; i < count; i++) {
      out.push({
        id: count > 1 ? `${type}_${i + 1}` : type,
        type,
        label: count > 1 ? `${labels[type]} ${i + 1}` : labels[type],
        index: i,
      });
    }
  }
  for (let i = 0; i < 2; i++) {
    out.push({ id: `ANY_${i + 1}`, type: 'ANY', label: `Any Slot ${i + 1}`, index: i });
  }
  return out;
}

export const SLOT_POSITIONS: readonly SlotPosition[] = buildPositions();
export const TOTAL_POSITIONS = SLOT_POSITIONS.length; // 23

/**
 * Attribute and resist ceilings, read directly off the client's Stats window.
 *
 * Confirmed twice now, on two different characters: `Strength 304/510` and
 * `Magic 94/1000` on the first capture, and `Strength 70/510` and
 * `SV Magic 25/1000` on Shara's Equipment tab (Director, 2026-08-18). The
 * denominators are the game's own, printed in its own window, on characters far
 * apart in progression — so these are Tier M and sourced rather than inferred.
 */
export const ATTRIBUTE_CAP = 510;
export const RESIST_CAP = 1000;

/*
 * The client's AC line carries a second figure this planner does not model —
 * Shara's sheet reads `AC 20/350 | 110`. Recorded as gap 7 in
 * research/validation/KNOWN-DATA-ISSUES.md rather than guessed at here.
 */

/** Ordered as the client's Stats window prints them. */
export const ATTRIBUTES = ['STR', 'STA', 'INT', 'WIS', 'AGI', 'DEX', 'CHA'] as const;
export type Attribute = (typeof ATTRIBUTES)[number];

export const ATTRIBUTE_NAMES: Record<Attribute, string> = {
  STR: 'Strength', STA: 'Stamina', AGI: 'Agility', DEX: 'Dexterity',
  WIS: 'Wisdom', INT: 'Intelligence', CHA: 'Charisma',
};

/** Six saves — Void is genuine, and is also what item upgrades synthesize. */
export const SAVES = ['MAGIC', 'FIRE', 'COLD', 'DISEASE', 'POISON', 'VOID'] as const;
export type Save = (typeof SAVES)[number];

export const SAVE_NAMES: Record<Save, string> = {
  MAGIC: 'Magic', FIRE: 'Fire', COLD: 'Cold',
  DISEASE: 'Disease', POISON: 'Poison', VOID: 'Void',
};

/**
 * Heroic modifiers, with the caps the client displays. Present in the game's
 * stat sheet but currently granted by no item in the corpus — they render at
 * zero, which matches what a fully-geared character sees in-game.
 */
export const HEROIC_MODS: ReadonlyArray<{ key: string; label: string; cap: number }> = [
  { key: 'ACCURACY', label: 'Accuracy', cap: 150 },
  { key: 'AVOIDANCE', label: 'Avoidance', cap: 100 },
  { key: 'COMBAT_EFFECTS', label: 'Combat Effects', cap: 100 },
  { key: 'DAMAGE_SHIELDING', label: 'Damage Shielding', cap: 35 },
  { key: 'DAMAGE_SHIELD_MITIG', label: 'Damage Shield Mitig', cap: 25 },
  { key: 'DOT_SHIELDING', label: 'DoT Shielding', cap: 35 },
  { key: 'MELEE_SHIELDING', label: 'Melee Shielding', cap: 35 },
  { key: 'SPELL_SHIELDING', label: 'Spell Shielding', cap: 35 },
  { key: 'STRIKE_THROUGH', label: 'Strike Through', cap: 35 },
  { key: 'STUN_RESIST', label: 'Stun Resist', cap: 35 },
];

export const SPELL_MODS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'HEAL_AMOUNT', label: 'Heal Amount' },
  { key: 'SPELL_DAMAGE', label: 'Spell Damage' },
  { key: 'CLAIRVOYANCE', label: 'Clairvoyance' },
  { key: 'LUCK', label: 'Luck' },
];

export const SKILL_DAMAGE_MODS: ReadonlyArray<{ key: string; label: string; cap: number }> = [
  { key: 'BASH', label: 'Bash', cap: 100 },
  { key: 'BACKSTAB', label: 'Backstab', cap: 125 },
  { key: 'DRAGON_PUNCH', label: 'Dragon Punch', cap: 100 },
  { key: 'EAGLE_STRIKE', label: 'Eagle Strike', cap: 100 },
  { key: 'FLYING_KICK', label: 'Flying Kick', cap: 100 },
  { key: 'FRENZY', label: 'Frenzy', cap: 125 },
  { key: 'KICK', label: 'Kick', cap: 100 },
  { key: 'ROUND_KICK', label: 'Round Kick', cap: 100 },
  { key: 'TIGER_CLAW', label: 'Tiger Claw', cap: 100 },
];

/** Item flags observed in the corpus. */
export const ITEM_FLAGS = [
  'MAGIC', 'LORE', 'NO_DROP', 'NO_TRADE', 'TEMPORARY', 'QUEST',
  'EXPENDABLE', 'ATTUNEABLE', 'NO_RENT', 'ARTIFACT', 'LORE_EQUIPPED', 'PLACEABLE',
] as const;

/**
 * Content eras in chronological order — every era the catalog can contain.
 *
 * This is a sort key and a filter vocabulary, not a gate. The pipeline ships
 * only pre-Kunark content plus what the live client export proves, so these
 * seven names are exhaustive over the payload: `Classic` 2,907, `Sky` 382,
 * `Temple` 101, `Fear` 27, `Paineel` 22, `Kunark` 13, `Hate` 5, and 76 items
 * with no era at all (measured against `public/data/items-index.json`,
 * 2026-08-17).
 *
 * `Epic Quests`, `Nov 2000`, `FearHateRevamp`, `Velious` and `Chardok Revamp`
 * used to sit at the end of this list and were offered by both era `<select>`s.
 * Nothing in those eras survives the purge, so every one of them was an option
 * that guaranteed an empty list. `Kunark` stays because thirteen Kunark-tagged
 * items ship — the ones the player's own inventory export holds.
 */
export const ERA_ORDER = [
  'Classic', 'Fear', 'Hate', 'Paineel', 'Temple', 'Sky', 'Kunark',
] as const;

/**
 * Items whose wiki era says they are out of era and which a live client
 * demonstrably holds anyway — **the era-purge rescue list, and nothing else.**
 *
 * The pipeline ships an item only if its era is pre-Kunark or its name appears
 * here; everything else is quarantined into `pipeline/quarantine.json`. So this
 * list is not an un-gating of hidden rows any more — it is the sole reason
 * thirteen Kunark items and the Shadow Rage set are in the catalog at all.
 *
 * **It is not the set of items seen in the live game, and no screen may read it
 * as one.** It was read that way once, and the result was the worst provenance
 * bug this project has had: `ItemWindow` printed "TIER M · CONFIRMED IN THE
 * LIVE GAME" over Orb of Tishan's wiki stat block — the export carries names
 * and ids, no stat values at all — while Earthshaker, whose numbers are the one
 * stat block checked digit-for-digit against a client window, printed nothing.
 * The strongest label in the vocabulary sat on Tier 2 data and was absent from
 * the best evidence in the project.
 *
 * The two facts that list was standing in for now ship on every catalog record,
 * computed by the pipeline from the files that actually carry them:
 *
 *   `item.ex` — existence: the name resolves to a line in the live inventory
 *               export, or the player named it. Proves the item is in the game.
 *   `item.sd` — standing: where the numbers on the row came from, including
 *               `tier-M` for the five stat blocks a client window confirmed.
 *
 * Read those. This list stays because it documents *why* nineteen out-of-era
 * items are in the catalog, and `data/source-standing.test.ts` holds it to that
 * job — every name in it must be out of era and must carry `ex`.
 *
 * Nothing is inferred from an item's neighbours, its zone or its era. Every
 * name is grouped below by the evidence that put it there, so a reader can see
 * exactly what each one rests on. Extend it the same way: with evidence, never
 * with a guess.
 */

/**
 * Seen in `research/validation/tier0-inventory-Avenrae.txt`, a live
 * `/outputfile inventory` export: the character possesses these in the running
 * game. `Hamed's Ring of Tears` is worn on a finger; `Tobrin's Mystical
 * Eyepatch` and `Selo`s Drums of the March` are socketed into worn gear;
 * `Shadow Rage Helm` is worn on the head and the other three Shadow Rage pieces
 * are banked.
 */
const TIER0_OBSERVED_IN_EXPORT = [
  'Batskull Earring',
  'Crystalline Spear',
  'Dragon Bone Bracelet',
  'Gauntlets of Fiery Might',
  'Gold Plated Koshigatana',
  "Hamed's Ring of Tears",
  'Hierophant`s Crook',
  'McVaxius` Horn of War',
  'Orb of Tishan',
  'Selo`s Drums of the March',
  'Shadow Rage Boots',
  'Shadow Rage Gloves',
  'Shadow Rage Helm',
  'Shadow Rage Sleeves',
  'Shadow Rage Wristguard',
  "Tobrin's Mystical Eyepatch",
  'Warhammer of Divine Grace',
  'White Satin Gloves',
];

/**
 * Named by the player who plays the game, which is the same Tier 0 authority as
 * a client screenshot and outranks any wiki page.
 *
 * > "Shadow rage is the berserker set from plane of fear and plane of hate that
 * > was added for EQ legends, to be in line with the other planar class gear
 * > sets."   — player report, 2026-08-17
 *
 * That places the whole set in the live game, so the one piece of it the export
 * does not happen to contain ships on the report rather than being quarantined
 * as the only absent member of a set whose other five are in the catalog. This
 * is the weakest evidence in this file and it is deliberately kept apart here
 * rather than blended into the list above. It does **not** extend to the other
 * 53 `FearHateRevamp` items, which were quarantined:
 * see research/validation/TIER0-PLAYER-REPORTS.md.
 */
const TIER0_REPORTED_BY_PLAYER = ['Shadow Rage Leggings'];

export const TIER0_ERA_RESCUE_ITEMS: ReadonlySet<string> = new Set(
  [...TIER0_OBSERVED_IN_EXPORT, ...TIER0_REPORTED_BY_PLAYER].map((name) => name.toLowerCase()),
);

/**
 * Did this item survive the era purge on Tier 0 evidence rather than on its era?
 *
 * Named for what it answers. It is **not** "was this seen in the live game" —
 * that question is answered by `item.ex`, on every record, from the export
 * itself; and it is not "are these numbers trustworthy" — that is `item.sd`.
 * See `lib/itemStyle.ts` for both.
 */
export function isEraRescued(name: string | undefined): boolean {
  return name !== undefined && TIER0_ERA_RESCUE_ITEMS.has(name.toLowerCase());
}

/**
 * Level ceiling. INFERRED, not confirmed: a level-50 character in the sample
 * client capture shows "Next Level 100%" while accruing AA experience, which is
 * how a capped character behaves, and 50 was the pre-Kunark cap historically.
 * Treated as a soft UI bound only — nothing in the stat engine depends on it.
 */
export const LEVEL_CAP = 50;

/*
 * The fallback shown before `meta.json` loads, and on every screen.
 *
 * This said "licensed CC BY-SA 4.0" and it was never true — eqlwiki publishes
 * no content licence, verified three ways on 2026-08-18 (siteinfo rightsinfo
 * empty, Project:Copyrights 404, API reports EQLWiki:Copyrights missing). It
 * was assumed, the way a wiki usually is CC BY-SA.
 *
 * Kept short because it renders in the footer of every screen; the full finding
 * and how it was checked live in `meta.license.note`, which the Sources page
 * prints in full.
 */
export const ATTRIBUTION =
  'Item data derived from the EverQuest Legends Wiki, which publishes no content licence.';
