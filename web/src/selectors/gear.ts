/**
 * Derived views over a gear set.
 *
 * Everything the screens read — the resolved stat vector of one item, the
 * totals of a whole set, the EP ranking of a slot's candidates, the delta
 * between a candidate and what is worn — is computed here so the components
 * stay presentational and the logic stays testable.
 */

import {
  ATTRIBUTES, ATTRIBUTE_NAMES, SAVES, SAVE_NAMES, SKILL_DAMAGE_MODS,
  SLOT_POSITIONS, type SlotPosition,
} from '../engine/constants';
import { canUse, type LoadoutContext } from '../engine/character';
import { computeTotals, resolveItem, type StatTotals } from '../engine/stats';
import { rankScorer, type ScoreContext, type WeightProfile } from '../engine/ep';
import { BASE_STATE, normalizeState, type UpgradeState } from '../engine/upgrade';
import type { EquippedItem, GearSet, Item } from '../engine/types';
import { dec, finite, num, signed } from '../lib/format';
import {
  describeActiveFilters, isDefaultFilters, matchesFilters, type SetFilters,
} from '../lib/setFilters';
import type { CatalogState } from '../data/catalog';
import { itemsForSlot } from '../data/catalog';
import { statsAreUnknown, type SlotCode } from '../data/normalize';

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
  ATTACK: 'Attack',
  DMG: 'Damage',
  DLY: 'Delay',
  RATIO: 'Ratio',
  ...Object.fromEntries(SKILL_DAMAGE_MODS.map((m) => [m.key, `${m.label} Mod`])),
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

/** Compact labels for the one-line summaries, using EQ's own shorthand. */
export const SHORT_LABELS: Record<string, string> = {
  AC: 'AC', HP: 'HP', MANA: 'MANA', ENDUR: 'END', HASTE: 'HASTE',
  REGEN: 'REGEN', MANA_REGEN: 'MREGEN', END_REGEN: 'EREGEN',
  DMG: 'DMG', DLY: 'DLY', RATIO: 'RATIO',
  STR: 'STR', STA: 'STA', AGI: 'AGI', DEX: 'DEX', WIS: 'WIS', INT: 'INT', CHA: 'CHA',
  SV_MAGIC: 'MR', SV_FIRE: 'FR', SV_COLD: 'CR', SV_DISEASE: 'DR', SV_POISON: 'PR',
  SV_VOID: 'VR', ATTACK: 'ATK', BACKSTAB: 'BS',
  BASH: 'BASH', DRAGON_PUNCH: 'DPUNCH', EAGLE_STRIKE: 'ESTRIKE', FLYING_KICK: 'FKICK',
  FRENZY: 'FRENZY', KICK: 'KICK', ROUND_KICK: 'RKICK', TIGER_CLAW: 'TCLAW',
};

export function statLabel(key: string): string {
  return STAT_LABELS[key] ?? key.replace(/_/g, ' ');
}

/**
 * Compact label for dense surfaces.
 *
 * Unmapped keys return the key itself rather than a truncation. Slicing four
 * characters off the long name produced plausible-looking fictions — `Delay`
 * became `DELA`, `Dragon Punch Mod` became `DRAG` — which read as real game
 * vocabulary and are therefore worse than an obviously raw key. A missing
 * mapping should look missing.
 */
/**
 * One stat as it appears in a compact list.
 *
 * Delay is the exception that forces this to exist: it is not a bonus, and
 * higher is worse, so rendering it through `signed()` printed `DLY +70` and
 * made the slowest weapon on the page look like the biggest number. Anything
 * where "more" is not "better" prints bare.
 */
const UNSIGNED_KEYS: ReadonlySet<string> = new Set(['DLY', 'RATIO']);

export function statChip(key: string, value: number): string {
  const label = shortStatLabel(key);
  return UNSIGNED_KEYS.has(key) ? `${label} ${num(value)}` : `${label} ${signed(value)}`;
}

export function shortStatLabel(key: string): string {
  return SHORT_LABELS[key] ?? key;
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
  push('ATTACK', r.flat.ATTACK);
  push('REGEN', r.flat.REGEN ?? r.flat.HP_REGEN);
  push('MANA_REGEN', r.flat['MANA REGEN'] ?? r.flat.MANA_REGEN);
  push('END_REGEN', r.flat.ENDUR_REGEN ?? r.flat.END_REGEN);
  for (const mod of SKILL_DAMAGE_MODS) push(mod.key, r.skillMods[mod.key]);
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
  // "No stats" is a statement about the item; this is a statement about the
  // data, and conflating them told a reader an armour piece was worthless when
  // in fact nobody had ever written its numbers down.
  if (statsAreUnknown(item)) return 'Stats unavailable';
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
    /*
     * `29/35` and `107/510` were the same glyph pattern meaning opposite
     * things — a damage/delay pair and a value against a cap — 400px apart on
     * one screen, so `36/35` read as being over a ceiling. Weapons say which.
     */
    const damage = entries.find((e) => e.key === 'DMG')?.value ?? weapon.dmg;
    parts.push(`${Math.round(damage)}/${Math.round(weapon.dly)} dmg/dly`);
  }

  /*
   * Weights choose *which* stats are worth showing; `statVector` order chooses
   * how they are laid out. Rendering in weighted order meant the line
   * reshuffled under the cursor as the +N stepper was clicked —
   * `HP · MANA · END · AC` at +0 became `HP · AC · MANA · END` at +10.
   */
  const room = limit - (weapon ? 1 : 0);
  const chosen = new Set(
    ranked
      .filter((entry) => !(entry.key === 'DMG' && weapon))
      .slice(0, Math.max(0, room))
      .map((entry) => entry.key),
  );
  for (const entry of entries) {
    if (!chosen.has(entry.key)) continue;
    parts.push(`${shortStatLabel(entry.key)} ${signed(entry.value)}`);
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
  /** The active loadout's classes, race and per-class levels. */
  context: LoadoutContext | undefined;
  weights: WeightProfile;
  upgrade: UpgradeState;
  existing?: ScoreExisting;
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
const RANK_CACHE_LIMIT = 64;

/**
 * Score and sort every candidate for a slot.
 *
 * The expensive half of the picker. Memoised on (catalog revision, slot,
 * class trio, weights, preview tier, cap context) so that typing in the search
 * box never rescores anything — search only filters an already-sorted array.
 * Every other filter a surface applies — era, source, No Drop — narrows this
 * result rather than joining the key, so none of them can cost a re-rank.
 */
export function rankSlotItems(catalog: CatalogState, options: RankOptions): ScoredItem[] {
  const { slot, context, weights, upgrade, existing } = options;
  const key = [
    catalog.revision,
    slot,
    context?.classes.join('/') ?? '-',
    context?.race ?? '-',
    // Per-class levels gate eligibility now, so switching loadout — or levelling
    // a class — has to miss the cache rather than serve the old ranking.
    context ? context.classes.map((c) => context.levels[c] ?? 0).join('.') : '-',
    weightSignature(weights),
    `${upgrade.full}.${upgrade.fraction}`,
    contextSignature(existing),
  ].join('|');

  const cached = rankCache.get(key);
  if (cached) return cached;

  const pool = itemsForSlot(catalog, slot);
  /*
   * Only a hand pays for damage.
   *
   * `computeTotals` records a weapon when the position is PRIMARY or SECONDARY
   * and from nowhere else (see engine/stats.ts). Scoring has to use the same
   * rule or it credits a candidate for a contribution the set will never show.
   *
   * This previously read `slot !== 'ANY'`, which excluded the Any Slots for
   * exactly this reason and then let every other slot through. AMMO was the
   * visible consequence: a Throwing Boulder scored 30.9 EP on its ratio alone
   * and ranked fifth on the upgrades screen, above real armour gains, for a
   * number that could never reach the stat sheet.
   *
   * RANGE is deliberately on the excluded side. A bow does fire in the real
   * game, but this engine does not model ranged attacks anywhere, so paying for
   * ratio there would be inventing a benefit the rest of the app cannot see.
   * That gap is real and is better left visible than papered over here.
   */
  const weaponCounts = slot === 'PRIMARY' || slot === 'SECONDARY';
  // Compiled once for the whole pass rather than re-derived per item; see
  // `rankScorer`. Identical to `scoreItem(...).total`, asserted in `ep.test`.
  const score = rankScorer(weights, { weaponCounts, ...(existing ? { existing } : {}) });
  const scored: ScoredItem[] = [];
  for (const item of pool) {
    /*
     * An item nobody has measured cannot be ranked, and must not be ranked
     * anyway. Every scorer in this app reads an absent stat as zero, which is
     * right for an item that genuinely has none and a fabrication for one whose
     * numbers simply were never recorded — it would sit at the bottom of the
     * list wearing a real-looking `0.0 EP` beside items whose zero was
     * measured. Withheld here rather than filtered in the picker so that
     * Auto-fill, the browser's rankings and every future consumer of
     * `rankSlotItems` inherit the same refusal. `unstattedForSlot` below is how
     * a surface says out loud that it is holding one back.
     */
    if (statsAreUnknown(item)) continue;
    if (context && !canUse({ classes: item.cl, races: item.ra, ...(item.rl ? { rl: item.rl } : {}) }, context)) {
      continue;
    }
    scored.push({ item, score: finite(score(item, upgrade)) });
  }
  scored.sort((a, b) => b.score - a.score || a.item.n.localeCompare(b.item.n));

  if (rankCache.size >= RANK_CACHE_LIMIT) {
    const oldest = rankCache.keys().next().value;
    if (oldest !== undefined) rankCache.delete(oldest);
  }
  rankCache.set(key, scored);
  return scored;
}

/**
 * The candidates `rankSlotItems` refused to rank, for a surface that wants to
 * admit to holding them back.
 *
 * The alternative — dropping them silently — turns a player searching their
 * own helm into "No matching items", which reads as "that item does not exist"
 * about an item they are wearing. Same eligibility rules as the ranking: class,
 * race and level, and nothing else. The reader is being told about a gap in our
 * data, so no filter should be able to suppress the admission.
 */
export function unstattedForSlot(
  catalog: CatalogState,
  slot: SlotCode,
  context: LoadoutContext | undefined,
): Item[] {
  const out: Item[] = [];
  for (const item of itemsForSlot(catalog, slot)) {
    if (!statsAreUnknown(item)) continue;
    if (context && !canUse({ classes: item.cl, races: item.ra, ...(item.rl ? { rl: item.rl } : {}) }, context)) {
      continue;
    }
    out.push(item);
  }
  return out.sort((a, b) => a.n.localeCompare(b.n));
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

/**
 * Weapon ratio the way the client prints it, never NaN.
 *
 * Three decimals, trailing zeros trimmed. That reproduces all five Tier 0
 * samples exactly — Whitened Treant Fists 0.5 / 0.536 / 0.571 / 0.643 and
 * Earthshaker 1.057 — where two decimals rendered Earthshaker as 1.06 and
 * broke the line-by-line comparison against the game the panel exists for.
 */
export function ratioText(damage: number, delay: number): string {
  const d = finite(delay);
  if (d <= 0) return '—';
  return dec(finite(damage) / d, 3);
}

export interface AutoFillOptions {
  keepFilled: boolean;
  /**
   * The set's own default filters, honoured exactly as its pickers honour them.
   *
   * Required, not optional. `SetConfigDialog` promises in so many words that
   * "every item picker in this set opens with these already applied", and
   * Auto-fill used to accept no era, source or No Drop setting at all — so a
   * set configured for Sky-era, No-Drop-hidden filled itself with items its own
   * HEAD picker reported zero matches for. A default here would have let the
   * same omission ship silently a second time.
   */
  filters: SetFilters;
}

export interface AutoFillResult {
  assigned: Array<{ position: string; itemName: string }>;
  /** Every position left empty, by label. */
  skipped: string[];
  /**
   * The subset of `skipped` where the set's filters, not the scoring, emptied
   * the slot: something would have scored here, and the filter excluded it.
   * Reaching past the filter to fill those anyway is the behaviour this
   * replaces.
   */
  excludedByFilters: string[];
  /** What was applied, so the caller can say so rather than guess. */
  filters: SetFilters;
}

/**
 * What an auto-fill run did, in one sentence a notice can carry.
 *
 * Built here rather than in the screen because the interesting half is what the
 * *filters* did, and the screen has no way to tell a slot nothing scored for
 * from a slot the filters emptied.
 */
export function describeAutoFill(result: AutoFillResult): string {
  const applied = describeActiveFilters(result.filters);
  const scope = applied ? ` (${applied})` : '';
  const count = result.assigned.length;

  if (!count) {
    return result.excludedByFilters.length
      ? `Auto-fill placed nothing${scope}. Every candidate was excluded by this set's filters — widen them in Edit, or clear them for this run.`
      : `Auto-fill placed nothing${scope} — check that item data is loaded and your weights are not all zero.`;
  }

  const parts = [`Auto-fill placed ${count} item${count === 1 ? '' : 's'}${scope}`];
  if (result.skipped.length) {
    const missed = result.skipped.length;
    parts.push(`${missed} slot${missed === 1 ? '' : 's'} had no match: ${result.skipped.join(', ')}`);
  }
  return `${parts.join(' · ')}.`;
}

export interface AutoFillProgress {
  /** Slot rankings completed so far. */
  done: number;
  /** Slot rankings the whole fill will perform. */
  total: number;
}

/**
 * Cap-aware best-in-slot fill, one slot ranking at a time.
 *
 * Two passes rather than one greedy item at a time. Pass one ranks every open
 * slot against the set as it stands, then assigns in descending order of what
 * the slot's best candidate is worth, consuming item names so nothing is worn
 * twice. Pass two re-ranks against the totals pass one produced, which is
 * where cap awareness bites: a slot that would have piled onto an attribute
 * the set has now maxed loses to something that still scores.
 *
 * Re-ranking every slot after every single pick would be the exact answer and
 * costs 23x more work for a difference that rarely changes the outcome; two
 * passes keep the button under a blink.
 *
 * The set's own default filters narrow the candidates at both passes, so what
 * Auto-fill places is drawn from exactly the pool its pickers offer. A slot the
 * filters empty comes back in `excludedByFilters` and stays empty — filling it
 * from outside the filter would put an item on the doll that the picker one
 * click away refuses to show, and No Drop in particular is a hard constraint a
 * fresh alt cannot buy or trade its way around.
 *
 * It yields after every slot ranking so a caller can hand the main thread back
 * between them. Ranking 23 slots twice took 2.6 seconds of unbroken block on a
 * throttled machine with nothing on screen to say so; the work is the same
 * either way, but it no longer has to arrive as one frame. `autoFill` below
 * drains it synchronously for callers that do not care.
 */
export function* autoFillSteps(
  catalog: CatalogState,
  views: readonly SlotView[],
  context: LoadoutContext | undefined,
  weights: WeightProfile,
  options: AutoFillOptions,
): Generator<AutoFillProgress, AutoFillResult, void> {
  const kept = new Map<string, { item: Item; upgrade: UpgradeState }>();
  for (const view of views) {
    if (options.keepFilled && view.item && view.equipped) {
      kept.set(view.position.id, {
        item: view.item,
        upgrade: normalizeState(view.equipped.upgrade),
      });
    }
  }

  const pending = views.filter((v) => !kept.has(v.position.id));
  const upgradeFor = (view: SlotView) =>
    view.equipped ? normalizeState(view.equipped.upgrade) : BASE_STATE;

  const totalsOf = (picks: Map<string, { item: Item; upgrade: UpgradeState }>) =>
    computeTotals(
      [...picks.entries()].map(([position, e]) => ({ position, item: e.item, upgrade: e.upgrade })),
    );

  let chosen = new Map(kept);
  const total = pending.length * 2;
  let done = 0;

  /*
   * The ranking is shared with the picker, so the set's filters are applied to
   * its *result* rather than folded into its cache key — same answer, and
   * Auto-fill keeps warming the same cache the pickers read. The list is EP
   * ordered, so `[0]` is enough to know whether anything was left standing.
   */
  const narrow = isDefaultFilters(options.filters)
    ? (list: ScoredItem[]) => list
    : (list: ScoredItem[]) => list.filter((entry) => matchesFilters(entry.item, options.filters));

  /** Positions where the filters, not the scoring, left nothing to pick. */
  let emptiedByFilters = new Set<string>();

  for (let pass = 0; pass < 2; pass++) {
    const capContext = scoreContextFrom(totalsOf(chosen));
    const ranked: Array<{ view: SlotView; list: ScoredItem[] }> = [];
    emptiedByFilters = new Set<string>();
    for (const view of pending) {
      const all = rankSlotItems(catalog, {
        slot: view.position.type as SlotCode,
        context,
        weights,
        upgrade: upgradeFor(view),
        existing: capContext,
      });
      const list = narrow(all);
      if (!(list[0] && list[0].score > 0) && all[0] && all[0].score > 0) {
        emptiedByFilters.add(view.position.id);
      }
      ranked.push({ view, list });
      done++;
      yield { done, total };
    }

    const next = new Map(kept);
    const used = new Set([...kept.values()].map((e) => e.item.n.toLowerCase()));

    // Slots whose best candidate is worth most get first refusal on it.
    ranked.sort((a, b) => (b.list[0]?.score ?? 0) - (a.list[0]?.score ?? 0));
    for (const { view, list } of ranked) {
      const pick = list.find((entry) => entry.score > 0 && !used.has(entry.item.n.toLowerCase()));
      if (!pick) continue;
      used.add(pick.item.n.toLowerCase());
      next.set(view.position.id, { item: pick.item, upgrade: upgradeFor(view) });
    }
    chosen = next;
  }

  const assigned: AutoFillResult['assigned'] = [];
  const skipped: string[] = [];
  const excludedByFilters: string[] = [];
  for (const view of pending) {
    const pick = chosen.get(view.position.id);
    if (pick) {
      assigned.push({ position: view.position.id, itemName: pick.item.n });
      continue;
    }
    skipped.push(view.position.label);
    if (emptiedByFilters.has(view.position.id)) excludedByFilters.push(view.position.label);
  }
  return { assigned, skipped, excludedByFilters, filters: options.filters };
}

/** `autoFillSteps` run to completion in one go. */
export function autoFill(
  catalog: CatalogState,
  views: readonly SlotView[],
  context: LoadoutContext | undefined,
  weights: WeightProfile,
  options: AutoFillOptions,
): AutoFillResult {
  const work = autoFillSteps(catalog, views, context, weights, options);
  let step = work.next();
  while (!step.done) step = work.next();
  return step.value;
}
