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
    ac: 0, hp: 0, mana: 0, endurance: 0, haste: 0,
    hpRegen: 0, manaRegen: 0, endRegen: 0, weight: 0,
    heroic: Object.fromEntries(HEROIC_MODS.map((m) => [m.key, 0])),
    spellMods: Object.fromEntries(SPELL_MODS.map((m) => [m.key, 0])),
    skillMods: Object.fromEntries(SKILL_DAMAGE_MODS.map((m) => [m.key, 0])),
    weapons: {},
  };
}

/** Maps the corpus's stat keys onto canonical ones. */
const SAVE_KEY_ALIASES: Record<string, Save> = {
  'SV MAGIC': 'MAGIC', SV_MAGIC: 'MAGIC', MAGIC: 'MAGIC',
  'SV FIRE': 'FIRE', SV_FIRE: 'FIRE', FIRE: 'FIRE',
  'SV COLD': 'COLD', SV_COLD: 'COLD', COLD: 'COLD',
  'SV DISEASE': 'DISEASE', SV_DISEASE: 'DISEASE', DISEASE: 'DISEASE',
  'SV POISON': 'POISON', SV_POISON: 'POISON', POISON: 'POISON',
  'SV VOID': 'VOID', SV_VOID: 'VOID', VOID: 'VOID',
};

const FLAT_KEYS = new Set(['HASTE', 'REGEN', 'HP_REGEN', 'MANA REGEN', 'MANA_REGEN', 'END_REGEN']);

/** Which stat keys on an item can trigger the synthetic Void save. */
function voidTriggerKeys(item: Item): string[] {
  const st = item.st ?? {};
  const sv = item.sv ?? {};
  const keys: string[] = [];
  for (const a of ATTRIBUTES) if (st[a]) keys.push(a);
  for (const [raw, canonical] of Object.entries(SAVE_KEY_ALIASES)) {
    if (canonical === 'VOID') continue;
    if (sv[raw] || st[raw]) keys.push(`SV_${canonical}`);
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
  for (const [raw, canonical] of Object.entries(SAVE_KEY_ALIASES)) {
    const base = merged[raw];
    if (base) saves[canonical] = (saves[canonical] ?? 0) + scalePrimary(base, upgrade);
  }

  const bonus = voidBonus(voidTriggerKeys(item), upgrade);
  if (bonus) saves.VOID = (saves.VOID ?? 0) + bonus;

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
    attributes, saves, ac, hp, mana, endurance, flat, weapon,
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
    totals.endRegen += r.flat.END_REGEN ?? 0;

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
