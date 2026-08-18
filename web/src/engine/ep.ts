/**
 * Equivalency Points — the scoring layer that turns a catalog into an advisor.
 *
 * Score is a linear dot product of an item's resolved stats against a weight
 * profile, matching the model players already understand from Pawn-style
 * tools. Unlike the tool this is modelled on, scoring is **cap-aware**: stat
 * points that would exceed a ceiling score nothing, so an item cannot win a
 * slot by piling on a stat the character has already maxed.
 */

import {
  ATTRIBUTES, ATTRIBUTE_CAP, RESIST_CAP, SAVES, SKILL_DAMAGE_MODS,
  type Attribute, type Save,
} from './constants';
import { FLAT_KEYS, resolveItem, resolvedSave } from './stats';
import { damageRatio, scaleDamage, scaleFlat, scalePrimary } from './upgrade';
import type { Item, EquippedItem } from './types';

export type WeightProfile = Record<string, number>;

export interface ScoreContext {
  /** Totals already contributed by the rest of the set, for cap awareness. */
  existing?: {
    attributes: Partial<Record<Attribute, number>>;
    saves: Partial<Record<Save, number>>;
    /**
     * The highest haste already worn elsewhere in the set — see `hasteCredit`.
     *
     * Optional, and absent means zero, which is the same answer as "nothing
     * else is hasted". A caller that omits it gets the old unconditional sum
     * for haste and nothing else changes.
     */
    haste?: number;
  };
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

/**
 * How much of an item's haste this character would actually feel.
 *
 * Haste does not accumulate. `computeTotals` keeps the single highest worn
 * figure and discards the rest — `HASTE_STACKING` in `engine/stats.ts` states
 * that rule, its standing (assumed from classic, corroborated by a named guide,
 * measured by nobody here) and what would settle it. **This function is the
 * same rule, in the scorer**, and it exists because the two disagreed:
 * `scoreItem` added every haste item at full weight while the stat panel below
 * it showed only the largest, so the ranking promised a gain the panel then
 * refused to show. The repository's own contamination scanner catches this as
 * signature `haste-stacking`.
 *
 * Measured, like `creditable`, as the movement of the total a character sees:
 * `max(already, amount) - already`. A 21 offered to someone already wearing a
 * 36 counts nothing, because they would feel nothing.
 *
 * Note what this deliberately does **not** do: it does not drop haste from
 * scoring. Weighting it at zero would assert that haste is worth nothing, which
 * is an answer nobody has measured either — the same failure in the other
 * direction. The figure keeps its weight and carries its provenance.
 */
function hasteCredit(amount: number, already: number): { counted: number; wasted: number } {
  const counted = Math.max(already, amount) - already;
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
  /*
   * Flat stats, in `FLAT_KEYS` order — which `rankScorer` reproduces exactly so
   * the two running sums stay float-identical. HASTE is the first of them and
   * the one that does not add: see `hasteCredit`.
   */
  for (const [key, amount] of Object.entries(resolved.flat)) {
    if (key !== 'HASTE') {
      add(key, amount);
      continue;
    }
    const weight = weights.HASTE ?? 0;
    if (!amount || !weight) continue;
    const { counted, wasted } = capAware
      ? hasteCredit(amount, ctx.existing?.haste ?? 0)
      : { counted: amount, wasted: 0 };
    const points = counted * weight;
    total += points;
    parts.push({ key: 'HASTE', amount, weight, points, capped: wasted });
  }
  for (const [key, amount] of Object.entries(resolved.skillMods)) add(key, amount);

  if (resolved.weapon && (ctx.weaponCounts ?? true)) {
    add('RATIO', resolved.weapon.ratio);
    add('DMG', resolved.weapon.damage);
  }

  parts.sort((a, b) => b.points - a.points);
  return { total, parts };
}

/* ------------------------------------------------- the ranking fast path */

type PlanEntry =
  | { kind: 'attr'; key: Attribute; weight: number; already: number }
  | { kind: 'save'; key: Save; weight: number; already: number }
  | { kind: 'scaled'; key: string; alt?: string; weight: number }
  | { kind: 'flat'; key: string; weight: number }
  /** HASTE. Its own kind because it takes the highest, never the sum. */
  | { kind: 'haste'; weight: number; already: number }
  | { kind: 'ratio'; weight: number }
  | { kind: 'dmg'; weight: number };

/** The four uncapped primaries, in the order `scoreItem` accumulates them. */
const PRIMARY_KEYS: ReadonlyArray<{ key: string; alt?: string }> = [
  { key: 'AC' }, { key: 'HP' }, { key: 'MANA' }, { key: 'ENDUR', alt: 'END' },
];

/**
 * A scorer specialised to one weight profile and one cap context.
 *
 * `scoreItem` answers "why is this item worth what it is worth" — it resolves
 * the whole item into six objects and returns a sorted breakdown. Ranking a
 * slot asks a much narrower question seven thousand times over, and never reads
 * the breakdown: what it needs is one number.
 *
 * So the profile is compiled once into a plan — the handful of stats that carry
 * a non-zero weight, in the exact order `scoreItem` accumulates them — and each
 * item is then walked against that plan with no intermediate objects at all. A
 * profile weighing five stats does five lookups per item instead of resolving
 * forty. The order is load-bearing: it makes the running sum float-identical to
 * `scoreItem`'s, which `ep.test` asserts item for item across the shipped
 * catalog so the two can never drift.
 */
export function rankScorer(
  weights: WeightProfile,
  ctx: ScoreContext = {},
): (item: Item, upgrade: EquippedItem['upgrade']) => number {
  const capAware = ctx.capAware ?? true;
  const plan: PlanEntry[] = [];
  const weightOf = (key: string) => {
    const value = weights[key] ?? 0;
    return Number.isFinite(value) ? value : 0;
  };

  for (const key of ATTRIBUTES) {
    const weight = weightOf(key);
    if (weight) plan.push({ kind: 'attr', key, weight, already: ctx.existing?.attributes?.[key] ?? 0 });
  }
  for (const key of SAVES) {
    const weight = weightOf(`SV_${key}`);
    if (weight) plan.push({ kind: 'save', key, weight, already: ctx.existing?.saves?.[key] ?? 0 });
  }
  for (const primary of PRIMARY_KEYS) {
    const weight = weightOf(primary.key);
    if (weight) plan.push({ kind: 'scaled', key: primary.key, ...(primary.alt ? { alt: primary.alt } : {}), weight });
  }
  for (const key of FLAT_KEYS) {
    const weight = weightOf(key);
    if (!weight) continue;
    // Same slot in the order, different arithmetic. `scoreItem` branches on the
    // key at exactly this point, which is what keeps the two sums identical.
    if (key === 'HASTE') {
      plan.push({ kind: 'haste', weight, already: capAware ? (ctx.existing?.haste ?? 0) : 0 });
    } else {
      plan.push({ kind: 'flat', key, weight });
    }
  }
  for (const mod of SKILL_DAMAGE_MODS) {
    const weight = weightOf(mod.key);
    if (weight) plan.push({ kind: 'flat', key: mod.key, weight });
  }
  if (ctx.weaponCounts ?? true) {
    const ratio = weightOf('RATIO');
    if (ratio) plan.push({ kind: 'ratio', weight: ratio });
    const dmg = weightOf('DMG');
    if (dmg) plan.push({ kind: 'dmg', weight: dmg });
  }

  // Nothing is weighted: every item scores zero and no item need be read.
  if (!plan.length) return () => 0;

  const credit = (amount: number, already: number, cap: number) =>
    capAware ? Math.min(already + amount, cap) - Math.min(already, cap) : amount;

  return (item, upgrade) => {
    const st: Record<string, number> = item.st ?? {};
    const sv: Record<string, number> = item.sv ?? {};
    let total = 0;

    for (const entry of plan) {
      switch (entry.kind) {
        case 'attr': {
          const base = st[entry.key];
          if (!base) break;
          const amount = scalePrimary(base, upgrade);
          if (amount) total += credit(amount, entry.already, ATTRIBUTE_CAP) * entry.weight;
          break;
        }
        case 'save': {
          const amount = resolvedSave(st, sv, entry.key, upgrade);
          if (amount) total += credit(amount, entry.already, RESIST_CAP) * entry.weight;
          break;
        }
        case 'scaled': {
          const base = st[entry.key] ?? (entry.alt ? st[entry.alt] : 0);
          if (!base) break;
          const amount = scalePrimary(base, upgrade);
          if (amount) total += amount * entry.weight;
          break;
        }
        case 'flat': {
          const base = st[entry.key];
          if (!base) break;
          const amount = scaleFlat(base, upgrade);
          if (amount) total += amount * entry.weight;
          break;
        }
        case 'haste': {
          const base = st.HASTE;
          if (!base) break;
          const amount = scaleFlat(base, upgrade);
          if (amount) total += hasteCredit(amount, entry.already).counted * entry.weight;
          break;
        }
        case 'ratio': {
          const wp = item.wp;
          if (!wp) break;
          const amount = damageRatio(scaleDamage(wp.dmg, upgrade), wp.dly);
          if (amount) total += amount * entry.weight;
          break;
        }
        case 'dmg': {
          const wp = item.wp;
          if (!wp) break;
          const amount = scaleDamage(wp.dmg, upgrade);
          if (amount) total += amount * entry.weight;
          break;
        }
      }
    }
    return total;
  };
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
    /*
     * `HASTE: 2` is kept deliberately, and it is the one weight in this file
     * that is not simply a taste.
     *
     * Two sources disagree about what the per-item haste figure even means
     * (`HASTE_PROVENANCE` in `engine/stats.ts`), so 2 points per unit cannot be
     * defended as a measured exchange rate. Nor can zero: dropping haste from
     * the profile would assert that it is worth nothing, which is the same kind
     * of invented answer in the opposite direction and costs a reader the one
     * stat a melee character most wants ranked. It stays, at the number it has
     * always been, and every surface that shows a haste figure carries the mark
     * that says what is and is not known about it.
     */
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
