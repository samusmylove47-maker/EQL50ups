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
 * Attribute and resist ceilings, read directly off the client's Stats window
 * (`Strength 304/510`, `Magic 94/1000`).
 */
export const ATTRIBUTE_CAP = 510;
export const RESIST_CAP = 1000;

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
 * Content eras in chronological order. The game is pre-Kunark, so everything
 * from Sky backward is live and everything after it is pre-catalogued wiki
 * content that cannot yet drop.
 */
export const ERA_ORDER = [
  'Classic', 'Fear', 'Hate', 'Paineel', 'Temple', 'Sky',
  'Kunark', 'Epic Quests', 'Nov 2000', 'FearHateRevamp', 'Velious', 'Chardok Revamp',
] as const;

export const CURRENT_ERA = 'Sky';
export const CURRENT_ERA_INDEX = ERA_ORDER.indexOf(CURRENT_ERA);

export function isEraLive(era: string | null | undefined): boolean {
  if (!era) return true; // unknown era stays visible; hiding is the worse failure
  const idx = ERA_ORDER.indexOf(era as (typeof ERA_ORDER)[number]);
  if (idx === -1) return true;
  return idx <= CURRENT_ERA_INDEX;
}

/**
 * Items the era gate hides that a live client demonstrably holds.
 *
 * `pipeline/README.md` records that EQL's `ERA_OVERRIDE` list — the Kunark and
 * Velious items released early — was never recovered, so items tagged after
 * Sky are gated out wholesale and some of them are wrong. This is that list,
 * as far as it can be *observed* rather than guessed: every name below appears
 * in `research/validation/tier0-inventory-Avenrae.txt`, a live
 * `/outputfile inventory` export, so the character possesses it in the running
 * game. `Hamed's Ring of Tears` is worn on a finger; `Tobrin's Mystical
 * Eyepatch` and `Selo`s Drums of the March` are socketed into worn gear.
 *
 * Nothing is inferred from an item's neighbours, its zone or its era — only
 * from having been seen in a client export. Extend it the same way: with
 * evidence, never with a guess.
 */
export const TIER0_LIVE_ITEMS: ReadonlySet<string> = new Set(
  [
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
    "Tobrin's Mystical Eyepatch",
    'Warhammer of Divine Grace',
    'White Satin Gloves',
  ].map((name) => name.toLowerCase()),
);

/** Was this exact item seen in a live client inventory export? */
export function isTier0Confirmed(name: string | undefined): boolean {
  return name !== undefined && TIER0_LIVE_ITEMS.has(name.toLowerCase());
}

/**
 * Level ceiling. INFERRED, not confirmed: a level-50 character in the sample
 * client capture shows "Next Level 100%" while accruing AA experience, which is
 * how a capped character behaves, and 50 was the pre-Kunark cap historically.
 * Treated as a soft UI bound only — nothing in the stat engine depends on it.
 */
export const LEVEL_CAP = 50;

export const ATTRIBUTION =
  'Item data derived from the EverQuest Legends Wiki, licensed CC BY-SA 4.0.';
