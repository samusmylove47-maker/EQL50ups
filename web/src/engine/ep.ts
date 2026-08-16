/**
 * Equivalency Points — the scoring layer that turns a catalog into an advisor.
 *
 * Score is a linear dot product of an item's resolved stats against a weight
 * profile, matching the model players already understand from Pawn-style
 * tools. Unlike the tool this is modelled on, scoring is **cap-aware**: stat
 * points that would exceed a ceiling score nothing, so an item cannot win a
 * slot by piling on a stat the character has already maxed.
 */

import { ATTRIBUTE_CAP, RESIST_CAP, type Attribute, type Save } from './constants';
import { resolveItem } from './stats';
import type { Item, EquippedItem } from './types';

export type WeightProfile = Record<string, number>;

export interface ScoreContext {
  /** Totals already contributed by the rest of the set, for cap awareness. */
  existing?: { attributes: Partial<Record<Attribute, number>>; saves: Partial<Record<Save, number>> };
  capAware?: boolean;
  /**
   * Whether the position being scored actually swings the item.
   *
   * `computeTotals` reports a weapon only from Primary and Secondary, so
   * crediting damage and ratio anywhere else makes the score claim value the
   * stat panel then refuses to show. Defaults to true; the ranking selector
   * turns it off for the two "Any Slot" positions, which are worn positions
   * rather than hands.
   */
  weaponCounts?: boolean;
}

export interface ScoreBreakdown {
  total: number;
  parts: Array<{ key: string; amount: number; weight: number; points: number; capped: number }>;
}

/**
 * How much of `amount` counts once `already` is spent against `cap`.
 *
 * Measured as the movement of the *capped* total, which is the only part a
 * character actually feels: `min(already + amount, cap) - min(already, cap)`.
 * That handles the penalty case symmetrically — a −20 Strength item costs
 * nothing to someone already 90 over the ceiling — where a headroom-only rule
 * credited gains against the cap but charged losses in full.
 */
function creditable(amount: number, already: number, cap: number): { counted: number; wasted: number } {
  const counted = Math.min(already + amount, cap) - Math.min(already, cap);
  return { counted, wasted: amount - counted };
}

/** Score a single item at a given upgrade level. */
export function scoreItem(
  item: Item,
  upgrade: EquippedItem['upgrade'],
  weights: WeightProfile,
  ctx: ScoreContext = {},
): ScoreBreakdown {
  const resolved = resolveItem(item, upgrade);
  const capAware = ctx.capAware ?? true;
  const parts: ScoreBreakdown['parts'] = [];
  let total = 0;

  const add = (key: string, amount: number, cap?: number, already = 0) => {
    const weight = weights[key] ?? 0;
    if (!amount || !weight) return;
    const { counted, wasted } =
      capAware && cap !== undefined ? creditable(amount, already, cap) : { counted: amount, wasted: 0 };
    const points = counted * weight;
    total += points;
    parts.push({ key, amount, weight, points, capped: wasted });
  };

  for (const [key, amount] of Object.entries(resolved.attributes)) {
    add(key, amount ?? 0, ATTRIBUTE_CAP, ctx.existing?.attributes?.[key as Attribute] ?? 0);
  }
  for (const [key, amount] of Object.entries(resolved.saves)) {
    add(`SV_${key}`, amount ?? 0, RESIST_CAP, ctx.existing?.saves?.[key as Save] ?? 0);
  }

  add('AC', resolved.ac);
  add('HP', resolved.hp);
  add('MANA', resolved.mana);
  add('ENDUR', resolved.endurance);
  for (const [key, amount] of Object.entries(resolved.flat)) add(key, amount);
  for (const [key, amount] of Object.entries(resolved.skillMods)) add(key, amount);

  if (resolved.weapon && (ctx.weaponCounts ?? true)) {
    add('RATIO', resolved.weapon.ratio);
    add('DMG', resolved.weapon.damage);
  }

  parts.sort((a, b) => b.points - a.points);
  return { total, parts };
}

/** Default weight profiles, offered as starting points rather than gospel. */
export const PRESET_PROFILES: ReadonlyArray<{
  id: string;
  label: string;
  description: string;
  weights: WeightProfile;
}> = [
  {
    id: 'melee-dps',
    label: 'Melee DPS',
    description: 'Favours weapon ratio, Strength, Dexterity and Agility.',
    weights: { RATIO: 40, STR: 1, DEX: 0.8, AGI: 0.5, STA: 0.6, HP: 0.1, AC: 0.3, HASTE: 2 },
  },
  {
    id: 'tank',
    label: 'Tank',
    description: 'Favours mitigation and health over offence.',
    weights: { AC: 2, HP: 0.5, STA: 1.2, STR: 0.4, AGI: 0.6, SV_MAGIC: 0.3, SV_FIRE: 0.2, SV_COLD: 0.2 },
  },
  {
    id: 'caster',
    label: 'Caster',
    description: 'Favours mana pool and the casting attributes.',
    weights: { MANA: 0.5, INT: 1, WIS: 1, STA: 0.5, HP: 0.1, AC: 0.2, MANA_REGEN: 8 },
  },
  {
    id: 'healer',
    label: 'Healer',
    description: 'Favours Wisdom, mana and survivability.',
    weights: { WIS: 1.2, MANA: 0.5, STA: 0.6, HP: 0.15, AC: 0.25, MANA_REGEN: 8 },
  },
  {
    id: 'balanced',
    label: 'Balanced',
    description: 'A neutral profile that rewards raw stat density.',
    weights: {
      AC: 1, HP: 0.2, MANA: 0.2, STR: 0.5, STA: 0.5, AGI: 0.5,
      DEX: 0.5, WIS: 0.5, INT: 0.5, CHA: 0.2, RATIO: 20,
    },
  },
];

export function profileById(id: string): WeightProfile {
  return PRESET_PROFILES.find((p) => p.id === id)?.weights ?? {};
}

/** All stat keys a weight profile may address, for building the editor UI. */
export const WEIGHTABLE_KEYS: ReadonlyArray<{ key: string; label: string; group: string }> = [
  { key: 'AC', label: 'AC', group: 'Defense' },
  { key: 'HP', label: 'Hit Points', group: 'Defense' },
  { key: 'MANA', label: 'Mana', group: 'Casting' },
  { key: 'ENDUR', label: 'Endurance', group: 'Defense' },
  { key: 'STR', label: 'Strength', group: 'Attributes' },
  { key: 'STA', label: 'Stamina', group: 'Attributes' },
  { key: 'AGI', label: 'Agility', group: 'Attributes' },
  { key: 'DEX', label: 'Dexterity', group: 'Attributes' },
  { key: 'WIS', label: 'Wisdom', group: 'Attributes' },
  { key: 'INT', label: 'Intelligence', group: 'Attributes' },
  { key: 'CHA', label: 'Charisma', group: 'Attributes' },
  { key: 'SV_MAGIC', label: 'Magic Resist', group: 'Resists' },
  { key: 'SV_FIRE', label: 'Fire Resist', group: 'Resists' },
  { key: 'SV_COLD', label: 'Cold Resist', group: 'Resists' },
  { key: 'SV_DISEASE', label: 'Disease Resist', group: 'Resists' },
  { key: 'SV_POISON', label: 'Poison Resist', group: 'Resists' },
  { key: 'SV_VOID', label: 'Void Resist', group: 'Resists' },
  { key: 'HASTE', label: 'Haste', group: 'Combat' },
  { key: 'ATTACK', label: 'Attack', group: 'Combat' },
  { key: 'BACKSTAB', label: 'Backstab Mod', group: 'Combat' },
  { key: 'RATIO', label: 'Weapon Ratio', group: 'Combat' },
  { key: 'DMG', label: 'Weapon Damage', group: 'Combat' },
  { key: 'HP_REGEN', label: 'HP Regen', group: 'Regen' },
  { key: 'MANA_REGEN', label: 'Mana Regen', group: 'Regen' },
  { key: 'ENDUR_REGEN', label: 'End Regen', group: 'Regen' },
];
