/**
 * Derived views over a gear set.
 *
 * Everything the screens read — the resolved stat vector of one item, the
 * totals of a whole set, the EP ranking of a slot's candidates, the delta
 * between a candidate and what is worn — is computed here so the components
 * stay presentational and the logic stays testable.
 */

import { ATTRIBUTES, ATTRIBUTE_NAMES, SAVES, SAVE_NAMES, SLOT_POSITIONS, type SlotPosition } from '../engine/constants';
import { canUse, type Character } from '../engine/character';
import { computeTotals, resolveItem, type StatTotals } from '../engine/stats';
import { scoreItem, type ScoreContext, type WeightProfile } from '../engine/ep';
import { BASE_STATE, normalizeState, type UpgradeState } from '../engine/upgrade';
import type { EquippedItem, GearSet, Item } from '../engine/types';
import { dec, finite, signed } from '../lib/format';
import { isLive } from '../lib/itemStyle';
import type { CatalogState } from '../data/catalog';
import { itemsForSlot } from '../data/catalog';
import type { SlotCode } from '../data/normalize';

export interface StatEntry {
  key: string;
  label: string;
  value: number;
}

export const STAT_LABELS: Record<string, string> = {
  AC: 'AC',
  HP: 'HP',
  MANA: 'Mana',
  ENDUR: 'Endurance',
  HASTE: 'Haste',
  REGEN: 'HP Regen',
  MANA_REGEN: 'Mana Regen',
  END_REGEN: 'End Regen',
  DMG: 'Damage',
  DLY: 'Delay',
  RATIO: 'Ratio',
  ...Object.fromEntries(ATTRIBUTES.map((a) => [a, ATTRIBUTE_NAMES[a]])),
  ...Object.fromEntries(SAVES.map((s) => [`SV_${s}`, `${SAVE_NAMES[s]} Resist`])),
};

/** Rough importance used only for choosing what to show when no weights exist. */
const DEFAULT_IMPORTANCE: Record<string, number> = {
  RATIO: 30, AC: 2, HP: 0.2, MANA: 0.2, ENDUR: 0.1, HASTE: 2,
  STR: 1, STA: 1, AGI: 1, DEX: 1, WIS: 1, INT: 1, CHA: 0.5,
  SV_MAGIC: 0.4, SV_FIRE: 0.3, SV_COLD: 0.3, SV_DISEASE: 0.3, SV_POISON: 0.3, SV_VOID: 0.3,
  REGEN: 5, MANA_REGEN: 5, END_REGEN: 3, DMG: 0.5,
};

export function statLabel(key: string): string {
  return STAT_LABELS[key] ?? key.replace(/_/g, ' ');
}

/** One item's resolved contribution, flattened into ordered stat entries. */
export function statVector(item: Item, upgrade: UpgradeState): StatEntry[] {
  const r = resolveItem(item, upgrade);
  const out: StatEntry[] = [];
  const push = (key: string, value: number | undefined) => {
    const v = finite(value);
    if (v !== 0) out.push({ key, label: statLabel(key), value: v });
  };

  push('AC', r.ac);
  push('HP', r.hp);
  push('MANA', r.mana);
  push('ENDUR', r.endurance);
  for (const attr of ATTRIBUTES) push(attr, r.attributes[attr]);
  for (const save of SAVES) push(`SV_${save}`, r.saves[save]);
  push('HASTE', r.flat.HASTE);
  push('REGEN', r.flat.REGEN ?? r.flat.HP_REGEN);
  push('MANA_REGEN', r.flat['MANA REGEN'] ?? r.flat.MANA_REGEN);
  push('END_REGEN', r.flat.END_REGEN);
  if (r.weapon) {
    push('DMG', r.weapon.damage);
    push('DLY', r.weapon.delay);
  }
  return out;
}

/** The one-line stat summary rendered beneath an item name on the paper doll. */
export function summarizeItem(
  item: Item,
  upgrade: UpgradeState,
  weights: WeightProfile,
  limit = 4,
): string {
  const entries = statVector(item, upgrade).filter((e) => e.key !== 'DLY');
  if (!entries.length) return 'No stats';

  const weightOf = (key: string) => {
    const w = finite(weights[key]);
    return w !== 0 ? Math.abs(w) : (DEFAULT_IMPORTANCE[key] ?? 0.25);
  };
  const ranked = [...entries].sort(
    (a, b) => Math.abs(b.value) * weightOf(b.key) - Math.abs(a.value) * weightOf(a.key),
  );

  const parts: string[] = [];
  const weapon = item.wp;
  if (weapon) {
    const damage = entries.find((e) => e.key === 'DMG')?.value ?? weapon.dmg;
    parts.push(`${Math.round(damage)}/${Math.round(weapon.dly)}`);
  }
  for (const entry of ranked) {
    if (parts.length >= limit) break;
    if (entry.key === 'DMG' && weapon) continue;
    parts.push(`${entry.label === 'AC' ? 'AC' : entry.label.slice(0, 3).toUpperCase()} ${signed(entry.value)}`);
  }
  return parts.join(' · ');
}

export interface SlotView {
  position: SlotPosition;
  equipped: EquippedItem | undefined;
  item: Item | undefined;
  /** Equipped by name but absent from the catalog (data not loaded, or renamed). */
  unresolved: boolean;
}

export function slotViews(set: GearSet | undefined, catalog: CatalogState): SlotView[] {
  return SLOT_POSITIONS.map((position) => {
    const equipped = set?.slots[position.id];
    const item = equipped ? catalog.byName.get(equipped.itemName.toLowerCase()) : undefined;
    return { position, equipped, item, unresolved: Boolean(equipped) && !item };
  });
}

export interface ResolvedEntry {
  position: string;
  item: Item;
  upgrade: UpgradeState;
}

export function resolvedEntries(views: readonly SlotView[]): ResolvedEntry[] {
  const out: ResolvedEntry[] = [];
  for (const view of views) {
    if (view.item && view.equipped) {
      out.push({
        position: view.position.id,
        item: view.item,
        upgrade: normalizeState(view.equipped.upgrade),
      });
    }
  }
  return out;
}

export function totalsFor(views: readonly SlotView[], excludePosition?: string): StatTotals {
  const entries = resolvedEntries(views).filter((e) => e.position !== excludePosition);
  return computeTotals(entries);
}

/** Cap-aware scoring context: what the rest of the set already contributes. */
export type ScoreExisting = NonNullable<ScoreContext['existing']>;

export function scoreContextFrom(totals: StatTotals): ScoreExisting {
  return {
    attributes: { ...totals.attributes },
    saves: { ...totals.saves },
  };
}

export interface ScoredItem {
  item: Item;
  score: number;
}

export interface RankOptions {
  slot: SlotCode;
  character: Character | undefined;
  weights: WeightProfile;
  upgrade: UpgradeState;
  existing?: ScoreExisting;
  includeUnreleased: boolean;
}

function weightSignature(weights: WeightProfile): string {
  return Object.entries(weights)
    .filter(([, v]) => finite(v) !== 0)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => `${k}:${v}`)
    .join(',');
}

function contextSignature(existing: ScoreExisting | undefined): string {
  if (!existing) return '-';
  const attrs = Object.entries(existing.attributes).map(([k, v]) => `${k}${Math.round(finite(v))}`);
  const saves = Object.entries(existing.saves).map(([k, v]) => `${k}${Math.round(finite(v))}`);
  return [...attrs, ...saves].join('');
}

const rankCache = new Map<string, ScoredItem[]>();
const RANK_CACHE_LIMIT = 24;

/**
 * Score and sort every candidate for a slot.
 *
 * The expensive half of the picker. Memoised on (catalog revision, slot,
 * class trio, weights, preview tier, cap context, era filter) so that typing
 * in the search box never rescores anything — search only filters an
 * already-sorted array.
 */
export function rankSlotItems(catalog: CatalogState, options: RankOptions): ScoredItem[] {
  const { slot, character, weights, upgrade, existing, includeUnreleased } = options;
  const key = [
    catalog.revision,
    slot,
    character?.classes.join('/') ?? '-',
    character?.race ?? '-',
    weightSignature(weights),
    `${upgrade.full}.${upgrade.fraction}`,
    contextSignature(existing),
    includeUnreleased ? 'all' : 'live',
  ].join('|');

  const cached = rankCache.get(key);
  if (cached) return cached;

  const pool = itemsForSlot(catalog, slot);
  const scored: ScoredItem[] = [];
  for (const item of pool) {
    if (!includeUnreleased && !isLive(item)) continue;
    if (character && !canUse({ classes: item.cl, races: item.ra }, character)) continue;
    const breakdown = scoreItem(item, upgrade, weights, existing ? { existing } : {});
    scored.push({ item, score: finite(breakdown.total) });
  }
  scored.sort((a, b) => b.score - a.score || a.item.n.localeCompare(b.item.n));

  if (rankCache.size >= RANK_CACHE_LIMIT) {
    const oldest = rankCache.keys().next().value;
    if (oldest !== undefined) rankCache.delete(oldest);
  }
  rankCache.set(key, scored);
  return scored;
}

export interface StatDelta {
  key: string;
  label: string;
  before: number;
  after: number;
  delta: number;
}

/** Per-stat difference between a candidate and what is currently worn. */
export function statDeltas(
  candidate: Item,
  candidateUpgrade: UpgradeState,
  current: Item | undefined,
  currentUpgrade: UpgradeState = BASE_STATE,
): StatDelta[] {
  const after = new Map(statVector(candidate, candidateUpgrade).map((e) => [e.key, e.value]));
  const before = new Map(
    current ? statVector(current, currentUpgrade).map((e) => [e.key, e.value]) : [],
  );
  const keys = new Set([...before.keys(), ...after.keys()]);
  const out: StatDelta[] = [];
  for (const key of keys) {
    if (key === 'DLY') continue;
    const b = finite(before.get(key));
    const a = finite(after.get(key));
    if (a === b) continue;
    out.push({ key, label: statLabel(key), before: b, after: a, delta: a - b });
  }
  out.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
  return out;
}

/** Weapon ratio line for the header summary, never NaN. */
export function ratioText(damage: number, delay: number): string {
  const d = finite(delay);
  if (d <= 0) return '—';
  return dec(finite(damage) / d, 2);
}

export interface AutoFillResult {
  assigned: Array<{ position: string; itemName: string }>;
  skipped: string[];
}

/**
 * Greedy, cap-aware best-in-slot fill.
 *
 * Slots are filled in descending order of how much the best candidate is
 * worth, and each choice updates the cap context for the ones after it, so a
 * slot cannot win by stacking a stat the set has already maxed. Item names are
 * consumed once — no wearing the same ring twice.
 */
export function autoFill(
  catalog: CatalogState,
  views: readonly SlotView[],
  character: Character | undefined,
  weights: WeightProfile,
  options: { includeUnreleased: boolean; keepFilled: boolean },
): AutoFillResult {
  const assigned: AutoFillResult['assigned'] = [];
  const skipped: string[] = [];
  const used = new Set<string>();
  const chosen = new Map<string, { item: Item; upgrade: UpgradeState }>();

  for (const view of views) {
    if (options.keepFilled && view.item && view.equipped) {
      used.add(view.item.n.toLowerCase());
      chosen.set(view.position.id, {
        item: view.item,
        upgrade: normalizeState(view.equipped.upgrade),
      });
    }
  }

  const pending = views.filter((v) => !chosen.has(v.position.id));

  for (let round = 0; round < pending.length; round++) {
    const totals = computeTotals(
      [...chosen.entries()].map(([position, e]) => ({ position, item: e.item, upgrade: e.upgrade })),
    );
    const context = scoreContextFrom(totals);

    let best: { view: SlotView; item: Item; score: number } | null = null;
    for (const view of pending) {
      if (chosen.has(view.position.id)) continue;
      const upgrade = view.equipped ? normalizeState(view.equipped.upgrade) : BASE_STATE;
      const ranked = rankSlotItems(catalog, {
        slot: view.position.type as SlotCode,
        character,
        weights,
        upgrade,
        existing: context,
        includeUnreleased: options.includeUnreleased,
      });
      const pick = ranked.find((entry) => !used.has(entry.item.n.toLowerCase()));
      if (!pick || pick.score <= 0) continue;
      if (!best || pick.score > best.score) best = { view, item: pick.item, score: pick.score };
    }

    if (!best) break;
    used.add(best.item.n.toLowerCase());
    const upgrade = best.view.equipped ? normalizeState(best.view.equipped.upgrade) : BASE_STATE;
    chosen.set(best.view.position.id, { item: best.item, upgrade });
    assigned.push({ position: best.view.position.id, itemName: best.item.n });
  }

  for (const view of pending) {
    if (!chosen.has(view.position.id)) skipped.push(view.position.label);
  }
  return { assigned, skipped };
}
