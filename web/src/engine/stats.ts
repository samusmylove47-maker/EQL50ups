/**
 * Stat aggregation.
 *
 * Produces the same groups the client's Stats window shows, so the planner's
 * numbers can be compared against the game line by line.
 */

import {
  ATTRIBUTES, SAVES, ATTRIBUTE_CAP, RESIST_CAP,
  HEROIC_MODS, SPELL_MODS, SKILL_DAMAGE_MODS,
  type Attribute, type Save,
} from './constants';
import { scalePrimary, scaleDamage, scaleFlat, scaleWeight, voidBonus, damageRatio } from './upgrade';
import type { Item, EquippedItem } from './types';

export interface StatTotals {
  attributes: Record<Attribute, number>;
  saves: Record<Save, number>;
  ac: number;
  hp: number;
  mana: number;
  endurance: number;
  haste: number;
  attack: number;
  hpRegen: number;
  manaRegen: number;
  endRegen: number;
  weight: number;
  heroic: Record<string, number>;
  spellMods: Record<string, number>;
  skillMods: Record<string, number>;
  weapons: { primary?: WeaponSummary; secondary?: WeaponSummary };
}

export interface WeaponSummary {
  name: string;
  damage: number;
  delay: number;
  ratio: number;
  skill?: string;
  bonus?: number;
}

function emptyTotals(): StatTotals {
  const attributes = Object.fromEntries(ATTRIBUTES.map((a) => [a, 0])) as Record<Attribute, number>;
  const saves = Object.fromEntries(SAVES.map((s) => [s, 0])) as Record<Save, number>;
  return {
    attributes, saves,
    ac: 0, hp: 0, mana: 0, endurance: 0, haste: 0, attack: 0,
    hpRegen: 0, manaRegen: 0, endRegen: 0, weight: 0,
    heroic: Object.fromEntries(HEROIC_MODS.map((m) => [m.key, 0])),
    spellMods: Object.fromEntries(SPELL_MODS.map((m) => [m.key, 0])),
    skillMods: Object.fromEntries(SKILL_DAMAGE_MODS.map((m) => [m.key, 0])),
    weapons: {},
  };
}

/**
 * Spellings the corpus uses for each save, in priority order.
 *
 * A save is read **once** per item: the first spelling present wins and the
 * rest are ignored. Summing the aliases instead — which is what an
 * alias-to-canonical map invites — silently triples a resist on any payload
 * that carries two spellings, and the normaliser deliberately accepts several
 * input shapes, so that payload is reachable.
 */
const SAVE_ALIASES: Readonly<Record<Save, readonly string[]>> = {
  MAGIC: ['SV MAGIC', 'SV_MAGIC', 'MAGIC'],
  FIRE: ['SV FIRE', 'SV_FIRE', 'FIRE'],
  COLD: ['SV COLD', 'SV_COLD', 'COLD'],
  DISEASE: ['SV DISEASE', 'SV_DISEASE', 'DISEASE'],
  POISON: ['SV POISON', 'SV_POISON', 'POISON'],
  VOID: ['SV VOID', 'SV_VOID', 'VOID'],
};

/** The one base value an item declares for a save, under any spelling. */
function baseSave(merged: Record<string, number>, save: Save): number {
  for (const alias of SAVE_ALIASES[save]) {
    const value = merged[alias];
    if (value) return value;
  }
  return 0;
}

/**
 * Flat additive stat keys, with every spelling the corpus and the pipeline use.
 * `ENDUR_REGEN` is the pipeline's vocabulary; `END_REGEN` is kept as an alias
 * so an older payload still resolves.
 */
const FLAT_KEYS = [
  'HASTE',
  'REGEN', 'HP_REGEN',
  'MANA REGEN', 'MANA_REGEN',
  'END_REGEN', 'ENDUR_REGEN',
  'ATTACK',
] as const;

/** Which stat keys on an item can trigger the synthetic Void save. */
function voidTriggerKeys(item: Item): string[] {
  const st = item.st ?? {};
  const sv = item.sv ?? {};
  const merged: Record<string, number> = { ...sv, ...st };
  const keys: string[] = [];
  for (const a of ATTRIBUTES) if (st[a]) keys.push(a);
  for (const save of SAVES) {
    if (save === 'VOID') continue;
    if (baseSave(merged, save)) keys.push(`SV_${save}`);
  }
  return [...new Set(keys)];
}

/**
 * Resolve one item's contribution at its chosen upgrade level.
 *
 * The catalog omits empty containers to keep the payload small, so every
 * optional collection is read defensively rather than assumed present.
 */
export function resolveItem(item: Item, upgrade: EquippedItem['upgrade']) {
  const st: Record<string, number> = item.st ?? {};
  const sv: Record<string, number> = item.sv ?? {};

  const attributes: Partial<Record<Attribute, number>> = {};
  for (const a of ATTRIBUTES) {
    const base = st[a];
    if (base) attributes[a] = scalePrimary(base, upgrade);
  }

  const saves: Partial<Record<Save, number>> = {};
  const merged: Record<string, number> = { ...sv, ...st };
  for (const save of SAVES) {
    const base = baseSave(merged, save);
    if (base) saves[save] = scalePrimary(base, upgrade);
  }

  /*
   * SV Void is synthesised from the tier, and two catalog rows (Anthemion
   * Armbands, Darkspun Shroud) also *print* a Void line — pipeline/README.md
   * §6 reads those two wiki pages as captures of already-upgraded items, and
   * their printed values are exactly what the synthetic rule yields at the
   * tier named in that note (+2 and +1). The two therefore describe one line,
   * not two, so they are reconciled with `max` and never added together.
   * Summing them overstated Anthemion's Void by 12 at +10.
   */
  const bonus = voidBonus(voidTriggerKeys(item), upgrade);
  if (bonus) saves.VOID = Math.max(saves.VOID ?? 0, bonus);

  const ac = st.AC ? scalePrimary(st.AC, upgrade) : 0;
  const hp = st.HP ? scalePrimary(st.HP, upgrade) : 0;
  const mana = st.MANA ? scalePrimary(st.MANA, upgrade) : 0;
  const enduranceBase = st.ENDUR ?? st.END ?? 0;
  const endurance = enduranceBase ? scalePrimary(enduranceBase, upgrade) : 0;

  const flat: Record<string, number> = {};
  for (const key of FLAT_KEYS) {
    const base = st[key];
    if (base) flat[key] = scaleFlat(base, upgrade);
  }

  // Skill damage modifiers (Backstab, Kick, …) ride in the same stat map.
  const skillMods: Record<string, number> = {};
  for (const mod of SKILL_DAMAGE_MODS) {
    const base = st[mod.key];
    if (base) skillMods[mod.key] = scaleFlat(base, upgrade);
  }

  const weapon = item.wp
    ? {
        name: item.n,
        damage: scaleDamage(item.wp.dmg, upgrade),
        delay: item.wp.dly,
        ratio: damageRatio(scaleDamage(item.wp.dmg, upgrade), item.wp.dly),
        skill: item.wp.skill,
        bonus: item.wp.bonus,
      }
    : undefined;

  return {
    attributes, saves, ac, hp, mana, endurance, flat, skillMods, weapon,
    weight: item.wt ? scaleWeight(item.wt, upgrade) : 0,
  };
}

/** Aggregate a full gear set. */
export function computeTotals(
  equipped: ReadonlyArray<{ position: string; item: Item; upgrade: EquippedItem['upgrade'] }>,
): StatTotals {
  const totals = emptyTotals();

  for (const { position, item, upgrade } of equipped) {
    const r = resolveItem(item, upgrade);

    for (const [k, v] of Object.entries(r.attributes)) {
      totals.attributes[k as Attribute] += v ?? 0;
    }
    for (const [k, v] of Object.entries(r.saves)) {
      totals.saves[k as Save] += v ?? 0;
    }
    totals.ac += r.ac;
    totals.hp += r.hp;
    totals.mana += r.mana;
    totals.endurance += r.endurance;
    totals.weight += r.weight;

    totals.hpRegen += r.flat.REGEN ?? r.flat.HP_REGEN ?? 0;
    totals.manaRegen += r.flat['MANA REGEN'] ?? r.flat.MANA_REGEN ?? 0;
    totals.endRegen += r.flat.ENDUR_REGEN ?? r.flat.END_REGEN ?? 0;
    totals.attack += r.flat.ATTACK ?? 0;

    for (const [k, v] of Object.entries(r.skillMods)) {
      totals.skillMods[k] = (totals.skillMods[k] ?? 0) + v;
    }

    // Only the single highest worn haste applies; they do not sum.
    const haste = r.flat.HASTE ?? 0;
    if (haste > totals.haste) totals.haste = haste;

    if (r.weapon) {
      if (position === 'PRIMARY') totals.weapons.primary = r.weapon;
      else if (position === 'SECONDARY') totals.weapons.secondary = r.weapon;
    }
  }

  return totals;
}

export interface CappedValue {
  value: number;
  cap: number;
  overCap: number;
  atCap: boolean;
}

/** Present a value against its ceiling, the way the client does. */
export function withCap(value: number, cap: number): CappedValue {
  const clamped = Math.min(value, cap);
  return {
    value: clamped,
    cap,
    overCap: Math.max(0, value - cap),
    atCap: value >= cap,
  };
}

export function attributeWithCap(totals: StatTotals, attr: Attribute): CappedValue {
  return withCap(totals.attributes[attr], ATTRIBUTE_CAP);
}

export function saveWithCap(totals: StatTotals, save: Save): CappedValue {
  return withCap(totals.saves[save], RESIST_CAP);
}
