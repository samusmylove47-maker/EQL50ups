/**
 * Upgrades — `#/set/{id}/upgrades`, and `#/upgrades` for the set you last touched.
 *
 * The question a gear planner exists to answer is "where is my biggest gain,
 * and what do I go farm?". Until now the app computed that answer twenty-three
 * times and threw it away: `autoFillSteps` ranks every slot and its only
 * exposure was one button that applied all of it at once, destructively, with
 * no statement of what any single swap was worth.
 *
 * This screen is a view over exactly that machinery. Per position it takes the
 * best candidate `rankSlotItems` will offer, subtracts what is worn, and prints
 * the difference — biggest first — with the acquisition data the catalog
 * carries, so a row is something you can act on rather than something you have
 * to go and look up.
 *
 * ## The rules it inherits, and does not route around
 *
 * - **An unmeasured item is never ranked.** `rankSlotItems` withholds anything
 *   carrying `statsUnknown`, and this screen calls it rather than reaching past
 *   it. The mirror case matters just as much and is the reason `withheld`
 *   exists: when the item you are *wearing* has no published stats — Avenrae's
 *   `Shadow Rage Helm +5` is exactly this — a "gain" against it would be
 *   arithmetic against a zero nobody measured. That slot is listed separately,
 *   with no number attached, in the one colour `SOURCING-STANDARD.md` reserves
 *   for data it says to distrust.
 * - **An item the trio cannot equip is not an upgrade.** Eligibility comes from
 *   the same `canUse` gate the picker uses, class, race and per-class level
 *   alike, so nothing unwearable can reach the list to be tinted red later.
 * - **The tier is stated, never assumed.** Every row says what `+N` both sides
 *   are scored at, and the control that chooses it is on the page. The default —
 *   score the candidate at the tier the slot already carries — is the same
 *   comparison the slot's own picker makes, so a number here and a number there
 *   are the same number.
 * - **The set's own filters apply.** Era, source and No Drop narrow the
 *   candidates exactly as they narrow that set's pickers and its auto-fill; the
 *   footer says which ones did anything.
 */

import { useEffect, useMemo, useState } from 'react';
import { activeContext, describeCharacter, type LoadoutContext } from '../engine/character';
import { SLOT_POSITIONS, weaponCountsAt, type SlotPosition } from '../engine/constants';
import { scoreItem, scoresWeapons, type WeightProfile } from '../engine/ep';
import { resolveItem } from '../engine/stats';
import { BASE_STATE, normalizeState, tier, type UpgradeState } from '../engine/upgrade';
import type { Item, MeasuredDrop, ZoneSurvey } from '../engine/types';
import { statsAreUnknown, type SlotCode } from '../data/normalize';
import { HASTE_PROVENANCE, HASTE_STACKING } from '../engine/stats';
import { useCatalog, type CatalogState } from '../data/catalog';
import { ItemDetail } from '../components/ItemDetail';
import { itemHoverProps } from '../components/ItemWindow';
import { SlotGlyph } from '../components/SlotGlyph';
import { UpgradeStepper } from '../components/UpgradeStepper';
import { count, dec, ep as epText, finite, num, pluralize, signed } from '../lib/format';
import { nextFrame } from '../lib/frames';
import { eraLabel, sourceStanding } from '../lib/itemStyle';
import {
  describeActiveFilters, filtersFor, isDefaultFilters, matchesFilters, type SetFilters,
} from '../lib/setFilters';
import {
  rankSlotItems, scoreContextFrom, shortStatLabel, slotViews, statDeltas, totalsFor,
  type ScoredItem, type SlotView, type StatDelta,
} from '../selectors/gear';
import { href, navigate } from '../router';
import { characterFor, setsForCharacter, useApp } from '../state/store';
import './Upgrades.css';

/* ------------------------------------------------------------ the ranking */

/**
 * What `+N` a candidate is judged at.
 *
 * Two honest readings of "is this an upgrade", and they answer different
 * questions, so the screen offers both rather than picking one and hiding it:
 *
 * - `worn` — score the candidate at whatever tier the slot already carries. It
 *   asks "is this item better than mine", with the grind held constant, and it
 *   is what the slot's picker and Auto-fill already do.
 * - `fixed` — score every candidate at one stated tier, `+0` by default. It asks
 *   "is the thing that just dropped better than what I am wearing", which is the
 *   question standing in a zone with a drop in your bags.
 */
export type CompareBasis =
  | { kind: 'worn' }
  | { kind: 'fixed'; upgrade: UpgradeState };

export interface UpgradeCandidate {
  item: Item;
  /** The tier this candidate was scored at. */
  upgrade: UpgradeState;
  ep: number;
}

export interface UpgradeRow {
  position: SlotPosition;
  /** The catalog record for what is worn, or undefined for an empty slot. */
  wornItem: Item | undefined;
  wornName: string | undefined;
  wornUpgrade: UpgradeState;
  wornEp: number;
  candidate: UpgradeCandidate;
  /** `candidate.ep - wornEp`, cap-aware, always positive on a listed row. */
  gain: number;
  /** Per-stat movement, restricted to the stats this set actually weights. */
  deltas: StatDelta[];
  /** What the swap gives up outside the weights, which the EP cannot say. */
  unweighted: StatDelta[];
  /** Weapon ratio either side, when the position swings a weapon. */
  ratio: { before: number; after: number } | null;
  /**
   * Other positions this same item is the best answer for.
   *
   * Only ever non-Lore items — a Lore item is handed to one position — so this
   * says "you would need more than one of these", which is a real thing to know
   * before setting out to farm it.
   */
  alsoFor: string[];
}

/** Why a position was left out of the ranking rather than ranked at zero. */
export type WithheldReason = 'worn-unstatted' | 'worn-unresolved' | 'profile-blind-to-weapons';

export interface WithheldRow {
  position: SlotPosition;
  reason: WithheldReason;
  /**
   * What is worn there, or `null` for an empty hand.
   *
   * Nullable because `profile-blind-to-weapons` withholds the slot whether or
   * not anything is in it — the defect is in the scoring, not the item — and
   * naming an empty hand would be inventing an item.
   */
  wornName: string | null;
  wornUpgrade: UpgradeState;
  /** The best candidate the slot has, offered with no gain claimed against it. */
  candidate: UpgradeCandidate | null;
  /** What the catalog knows about why a statless item is real, if anything. */
  evidence?: string | undefined;
}

export interface UpgradeReport {
  /** Every position with a better option, biggest gain first. */
  rows: UpgradeRow[];
  /** Positions that cannot be compared, and why. */
  withheld: WithheldRow[];
  /** Positions where nothing outranks what is already worn. */
  settled: number;
  /** Positions where nothing scored at all, by label. */
  nothing: string[];
  filters: SetFilters;
  basis: CompareBasis;
  /** Sum of the listed gains. See the note in the KPI: not additive. */
  totalGain: number;
}

export interface UpgradeProgress {
  done: number;
  total: number;
}

export interface UpgradeOptions {
  filters: SetFilters;
  basis: CompareBasis;
  /**
   * Positions an import found occupied but could not score, by item name —
   * `GearSet.withheld`.
   *
   * These read as empty from `views` alone, because the importer deliberately
   * refuses to equip an item with no published stats. Without this the ranking
   * measured a candidate against nothing and reported the whole item as gain:
   * Avenrae wears a `Shadow Rage Helm +5`, and Head was offered a Hammerhead
   * Helm at "+20.0 EP" as though the position were bare.
   */
  withheldSlots?: Record<string, string>;
}

/**
 * Gains below this print as `+0.0 EP`, so listing them trains the reader to
 * skip the column that carries the whole answer. They count as settled.
 */
const MIN_GAIN = 0.05;

/**
 * Stat keys `statVector` emits, against the weight keys that can score them.
 *
 * The corpus spells regeneration three ways and the weight editor offers a
 * fourth; `FLAT_KEYS` accepts all of them, so a delta labelled `REGEN` may have
 * been scored under a weight called `HP_REGEN`. Without this the row would drop
 * the one stat that earned the gain.
 */
const WEIGHT_ALIASES: Record<string, readonly string[]> = {
  REGEN: ['REGEN', 'HP_REGEN'],
  MANA_REGEN: ['MANA REGEN', 'MANA_REGEN'],
  END_REGEN: ['END_REGEN', 'ENDUR_REGEN'],
};

function weightFor(key: string, weights: WeightProfile): number {
  for (const candidate of WEIGHT_ALIASES[key] ?? [key]) {
    const value = finite(weights[candidate]);
    if (value !== 0) return value;
  }
  return 0;
}

export function hasAnyWeight(weights: WeightProfile): boolean {
  return Object.values(weights).some((value) => finite(value) !== 0);
}

/**
 * The stats worth printing on a row: the ones this set pays for.
 *
 * A swap moves a dozen numbers and the reader weighted four of them. Ordering
 * by `|delta × weight|` puts the stat that actually produced the EP first,
 * which is the only ordering that explains the number beside it.
 */
export function weightedDeltas(
  deltas: readonly StatDelta[],
  weights: WeightProfile,
  limit = 5,
): StatDelta[] {
  const kept = deltas.filter((delta) => weightFor(delta.key, weights) !== 0);
  kept.sort(
    (a, b) =>
      Math.abs(b.delta * weightFor(b.key, weights)) - Math.abs(a.delta * weightFor(a.key, weights)),
  );
  return kept.slice(0, limit);
}

/**
 * Stats that move and that these weights do not pay for — losses only.
 *
 * The chips above show what earned the EP. This shows what it cost outside the
 * scoring, which is the half a weighted number cannot say: Avenrae's neck piece
 * is three regeneration lines and the Balanced preset weights none of them, so
 * the swap that gains 42.8 EP also gives up every point of regen the character
 * has, and every number on the row would have been silent about it.
 */
export function unweightedLosses(
  deltas: readonly StatDelta[],
  weights: WeightProfile,
  limit = 4,
): StatDelta[] {
  return deltas
    .filter((delta) => delta.delta < 0 && weightFor(delta.key, weights) === 0)
    .sort((a, b) => a.delta - b.delta)
    .slice(0, limit);
}

/**
 * Lore, in either of the corpus's two spellings.
 *
 * The game allows exactly one, so recommending the same Lore item for three
 * positions — which is what Avenrae's Cloak of Scales did before this existed —
 * is a plan the client will refuse. It is offered once, in the position where it
 * gains the most, and the other positions fall through to their next best.
 */
export function isLore(item: Item): boolean {
  return item.fl.includes('LORE') || item.fl.includes('LORE_EQUIPPED');
}

/** Weapon ratio at a tier, or null when the item is not a weapon. */
function ratioAt(item: Item | undefined, upgrade: UpgradeState): number | null {
  if (!item?.wp) return null;
  return resolveItem(item, upgrade).weapon?.ratio ?? null;
}

/** One position's ranking, before anything has been allocated. */
interface SlotRanking {
  view: SlotView;
  position: SlotPosition;
  ranked: readonly ScoredItem[];
  wornUpgrade: UpgradeState;
  candidateUpgrade: UpgradeState;
  wornEp: number;
  weaponCounts: boolean;
  wornName: string | undefined;
  reason: WithheldReason | null;
  /** Best score available before Lore allocation, for ordering the hand-out. */
  provisional: number;
}

/**
 * Rank every position, one slot at a time, then hand the candidates out.
 *
 * The ranking pass yields after each slot so a caller can give the main thread
 * back between them: this is the same twenty-three rankings Auto-fill's first
 * pass performs, and it is not work that should arrive as one frame.
 *
 * The cap context per slot is `totalsFor(views, position.id)` — the set with
 * that slot taken out — which is precisely what `SetWorkspace` hands the slot's
 * picker. That is deliberate: it is what makes an EP printed here identical to
 * the EP printed there, rather than the same item wearing two different numbers
 * on two screens.
 *
 * The allocation pass exists for one reason: **Lore**. Ranked independently,
 * three of Avenrae's positions all wanted the same Cloak of Scales and two
 * wanted the same Engineer's Ring, which is a shopping list the client will not
 * let anyone complete. Positions are served in descending order of what their
 * best candidate is worth — Auto-fill's own rule — and a Lore item, once
 * claimed, drops out of every other position's list.
 */
export function* upgradeSteps(
  catalog: CatalogState,
  views: readonly SlotView[],
  context: LoadoutContext | undefined,
  weights: WeightProfile,
  options: UpgradeOptions,
): Generator<UpgradeProgress, UpgradeReport, void> {
  const { filters, basis } = options;

  const narrow = isDefaultFilters(filters)
    ? (list: readonly ScoredItem[]) => list
    : (list: readonly ScoredItem[]) => list.filter((entry) => matchesFilters(entry.item, filters));

  /*
   * What this set already wears, and where. An item worn in another position is
   * not an upgrade you can go and get — moving it would empty the slot it came
   * from — so it is passed over exactly as Auto-fill passes over a name it has
   * already consumed. The slot's own item stays eligible, because it is the
   * baseline the row is measured against.
   */
  const wornAt = new Map<string, string>();
  for (const view of views) {
    const name = view.equipped?.itemName;
    if (name) wornAt.set(name.toLowerCase(), view.position.id);
  }

  const rows: UpgradeRow[] = [];
  const withheld: WithheldRow[] = [];
  const nothing: SlotPosition[] = [];
  let settled = 0;
  let done = 0;
  const total = views.length;

  /* ---- pass one: rank every position against the set as it stands ---- */

  const rankings: SlotRanking[] = [];
  for (const view of views) {
    const position = view.position;
    const slot = position.type as SlotCode;
    // Only a hand pays for damage: `computeTotals` reads a weapon from PRIMARY
    // and SECONDARY and nowhere else, and this must score the worn item under
    // the same rule `rankSlotItems` scores the candidates under. Reading
    // `slot !== 'ANY'` here paid an Ammo slot for ratio it never contributes.
    const weaponCounts = weaponCountsAt(slot);
    const wornUpgrade = view.equipped ? normalizeState(view.equipped.upgrade) : BASE_STATE;
    const candidateUpgrade =
      basis.kind === 'worn' ? wornUpgrade : normalizeState(basis.upgrade);
    // Cap headroom comes from what the character actually wears; an item this
    // loadout cannot equip contributes none of it.
    const existing = scoreContextFrom(totalsFor(views, position.id, context));
    // The export filled this position with something we cannot score, so the
    // slot is occupied even though `view.equipped` is empty.
    const withheldName = options.withheldSlots?.[position.id];

    const ranked = narrow(
      rankSlotItems(catalog, { slot, context, weights, upgrade: candidateUpgrade, existing }),
    );

    /*
     * The worn item cannot always be put on the same scale as the candidate.
     * Both cases are a gap in what we know rather than a property of the gear,
     * and inventing a zero for either would produce a real-looking gain
     * computed against nothing.
     */
    /*
     * A hand slot under a profile with no weapon term is not rankable.
     *
     * `scoresWeapons` in `engine/ep.ts` carries the measurement: tank, caster
     * and healer weight neither RATIO nor DMG, so the weapon block scores zero
     * and the slot is ranked on its stat line alone — which recommends a
     * 1-damage baton over a 40-damage greatsword, by 18x on tank. Withheld
     * rather than defaulted: inventing a weapon weight would be a number with
     * no source.
     */
    const blindToWeapons = weaponCounts && !scoresWeapons(weights);

    const reason: WithheldReason | null = blindToWeapons
      ? 'profile-blind-to-weapons'
      : view.unresolved
        ? 'worn-unresolved'
        : view.item && statsAreUnknown(view.item)
          ? 'worn-unstatted'
          : withheldName
            ? 'worn-unstatted'
            : null;

    const wornEp =
      view.item && !reason
        ? scoreItem(view.item, wornUpgrade, weights, { existing, weaponCounts }).total
        : 0;

    rankings.push({
      view,
      position,
      ranked,
      wornUpgrade,
      candidateUpgrade,
      wornEp,
      weaponCounts,
      wornName: view.equipped?.itemName ?? withheldName,
      reason,
      provisional: (ranked[0]?.score ?? 0) - wornEp,
    });

    done += 1;
    yield { done, total };
  }

  /* ---- pass two: hand the candidates out, one Lore item to one slot ---- */

  const claimed = new Set<string>();
  const take = (entry: SlotRanking): UpgradeCandidate | null => {
    for (const scored of entry.ranked) {
      if (scored.score <= 0) break; // the list is ordered; nothing below helps
      const key = scored.item.n.toLowerCase();
      const owner = wornAt.get(key);
      if (owner !== undefined && owner !== entry.position.id) continue;
      if (claimed.has(key)) continue;
      if (isLore(scored.item)) claimed.add(key);
      return { item: scored.item, upgrade: entry.candidateUpgrade, ep: scored.score };
    }
    return null;
  };

  // Best-off slots choose first, and a position that cannot state a gain at all
  // chooses last: it is being told what exists, not offered a plan.
  const queue = [...rankings].sort((a, b) => {
    if (Boolean(a.reason) !== Boolean(b.reason)) return a.reason ? 1 : -1;
    return b.provisional - a.provisional;
  });

  for (const entry of queue) {
    const best = take(entry);

    // A blind profile withholds the slot whether or not anything is worn: the
    // defect is in the scoring, not in the item, so an empty hand still cannot
    // be ranked.
    if (entry.reason && (entry.wornName || entry.reason === 'profile-blind-to-weapons')) {
      withheld.push({
        position: entry.position,
        reason: entry.reason,
        wornName: entry.wornName ?? null,
        wornUpgrade: entry.wornUpgrade,
        candidate: best,
        evidence: entry.view.item?.evidence,
      });
      continue;
    }

    if (!best) {
      nothing.push(entry.position);
      continue;
    }

    const gain = best.ep - entry.wornEp;
    if (gain < MIN_GAIN) {
      settled += 1;
      continue;
    }

    const deltas = statDeltas(
      best.item,
      entry.candidateUpgrade,
      entry.view.item,
      entry.wornUpgrade,
    );
    const before = ratioAt(entry.view.item, entry.wornUpgrade);
    const after = entry.weaponCounts ? ratioAt(best.item, entry.candidateUpgrade) : null;

    rows.push({
      position: entry.position,
      wornItem: entry.view.item,
      wornName: entry.wornName,
      wornUpgrade: entry.wornUpgrade,
      wornEp: entry.wornEp,
      candidate: best,
      gain,
      deltas: weightedDeltas(deltas, weights),
      unweighted: unweightedLosses(deltas, weights),
      ratio:
        before !== null || after !== null ? { before: before ?? 0, after: after ?? 0 } : null,
      alsoFor: [],
    });
  }

  /*
   * The same item can legitimately be the answer for several positions — two
   * fingers, two Any Slots — and unless it is Lore you really can wear two.
   * Saying so is the difference between "farm this" and "farm three of these".
   */
  const sameItem = new Map<string, UpgradeRow[]>();
  for (const row of rows) {
    const key = row.candidate.item.n.toLowerCase();
    const bucket = sameItem.get(key);
    if (bucket) bucket.push(row);
    else sameItem.set(key, [row]);
  }
  for (const bucket of sameItem.values()) {
    if (bucket.length < 2) continue;
    for (const row of bucket) {
      row.alsoFor = bucket
        .filter((other) => other !== row)
        .map((other) => other.position.label);
    }
  }

  // Biggest gain first; ties keep doll order so the list never reshuffles under
  // the cursor for two rows that are worth the same.
  const order = new Map(SLOT_POSITIONS.map((position, index) => [position.id, index]));
  rows.sort(
    (a, b) =>
      b.gain - a.gain ||
      (order.get(a.position.id) ?? 0) - (order.get(b.position.id) ?? 0),
  );
  // Everything the allocation pass reordered goes back into doll order, which is
  // the order every other screen lists positions in.
  const byDoll = (a: { id: string }, b: { id: string }) =>
    (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0);
  withheld.sort((a, b) => byDoll(a.position, b.position));
  nothing.sort(byDoll);

  return {
    rows,
    withheld,
    settled,
    nothing: nothing.map((position) => position.label),
    filters,
    basis,
    totalGain: rows.reduce((sum, row) => sum + row.gain, 0),
  };
}

/** `upgradeSteps` run to completion in one go, for callers that do not slice. */
export function computeUpgrades(
  catalog: CatalogState,
  views: readonly SlotView[],
  context: LoadoutContext | undefined,
  weights: WeightProfile,
  options: UpgradeOptions,
): UpgradeReport {
  const work = upgradeSteps(catalog, views, context, weights, options);
  let step = work.next();
  while (!step.done) step = work.next();
  return step.value;
}

/* -------------------------------------------------------- where it comes from */

export interface AcquisitionLine {
  key: string;
  /** Mono eyebrow: ZONE, MOB, QUEST, VENDOR, CRAFTED. */
  label: string;
  text: string;
  /** How many further entries the catalog holds beyond `text`. */
  more: number;
}

function line(key: string, label: string, values: readonly string[], limit: number): AcquisitionLine | null {
  if (!values.length) return null;
  return {
    key,
    label,
    text: values.slice(0, limit).join(' · '),
    more: Math.max(0, values.length - limit),
  };
}

/* --------------------------------------------- what the game was seen doing */

/**
 * The measured drop rows for an item, strongest first.
 *
 * `item.ms` is EQL Source's own sightings, parsed out of combat logs and
 * attached by the pipeline. It is the single reason to open this tool rather
 * than a wiki: `acquisitionLines` below says where a page *claims* an item comes
 * from, and this says where the game was *watched* producing it, on dated
 * sessions, with the sample size attached.
 *
 * **A COUNT, NEVER A RATE.** The publisher's first rule for `sightings.v1.json`
 * and this project's rule independently. Nothing in this file divides `seen` by
 * `sessions`, by a kill count, or by anything else, and no percentage is
 * derived from either. A drop seen once is seen once. Sky Ledger says the same
 * thing about the mirror case and says it better: a dry streak is a ceiling,
 * not a zero — a mob that has not been seen dropping an item in these sessions
 * has not been shown not to drop it.
 *
 * Sorted defensively rather than trusting the payload's order, so a re-vendored
 * file cannot silently reorder what a reader is told to farm.
 */
export function measuredDrops(item: Item): MeasuredDrop[] {
  const rows = item.ms;
  if (!Array.isArray(rows) || !rows.length) return [];
  return [...rows]
    .filter((row) => row && typeof row.mob === 'string' && row.mob.length > 0)
    .sort((a, b) => b.seen - a.seen || b.sessions - a.sessions || a.mob.localeCompare(b.mob));
}

/**
 * The sightings behind a set of rows, added up.
 *
 * `seen` totals because each sighting is one drop attributed to one mob, so
 * adding them counts each event once. **`sessions` deliberately does not**: one
 * session can produce two mobs, so summing the column would count the same
 * evening twice and print a sample size larger than the sample. It is reported
 * per row, where it is true, and nowhere else.
 */
export function totalSightings(rows: readonly MeasuredDrop[]): number {
  return rows.reduce((sum, row) => sum + Math.max(0, row.seen), 0);
}

/**
 * The dates a set of rows spans, or null if any of them cannot be read.
 *
 * The published form is `10 Aug 2026`. A date this code cannot parse is not
 * guessed at and not partially rendered: the whole span is withheld and the
 * per-row dates, which are printed verbatim, carry the fact instead.
 */
export function dateSpan(rows: readonly MeasuredDrop[]): { first: string; last: string } | null {
  let low: { text: string; at: number } | null = null;
  let high: { text: string; at: number } | null = null;
  for (const row of rows) {
    for (const text of [row.first, row.last]) {
      if (!text) continue;
      const at = Date.parse(text);
      if (Number.isNaN(at)) return null;
      if (!low || at < low.at) low = { text, at };
      if (!high || at > high.at) high = { text, at };
    }
  }
  if (!low || !high) return null;
  return { first: low.text, last: high.text };
}

/** `10 Aug 2026` or `10–12 Aug 2026`, never a range that says the same day twice. */
function dateText(first?: string, last?: string): string {
  if (!first && !last) return '';
  if (!first) return last ?? '';
  if (!last || last === first) return first;
  return `${first} – ${last}`;
}

/** How far the survey behind a drop's zone has got, in words. */
function surveyText(survey: ZoneSurvey): string {
  return `${survey.survey} survey · ${num(survey.measured)} of ${num(survey.facets)} facets measured`;
}

export interface ZoneTally {
  /** The zone string as the combat log spells it. */
  zone: string;
  /** The survey's own name for it, where a survey exists. */
  title: string;
  slug: string | null;
  /** How many listed upgrades have a measured sighting in this zone. A count. */
  items: number;
  /** How many sightings, across those items. A count. */
  seen: number;
  survey: ZoneSurvey | null;
}

/**
 * Where the upgrades on this page were actually seen dropping, by zone.
 *
 * The question this whole screen exists to answer ends in "so where do I go
 * tonight", and no single row answers it: a player wants the zone that carries
 * the most of their list, not the biggest single gain. This is that, and it is
 * made of nothing but counts — rows that name the zone, and sightings inside
 * them. Nothing is divided and no zone is called better than another.
 *
 * An item counts once per zone however many of its mobs dropped it there, so
 * `items` is "upgrades on this list you could come home with", not a tally of
 * mobs.
 */
export function zoneTallies(rows: readonly UpgradeRow[]): ZoneTally[] {
  const byZone = new Map<string, ZoneTally>();
  for (const row of rows) {
    const drops = measuredDrops(row.candidate.item);
    if (!drops.length) continue;
    // Per item, not per drop row: two mobs in one zone is one place to go.
    const seenHere = new Map<string, number>();
    const surveyHere = new Map<string, ZoneSurvey>();
    for (const drop of drops) {
      for (const zone of drop.zones ?? []) {
        seenHere.set(zone, (seenHere.get(zone) ?? 0) + Math.max(0, drop.seen));
        const survey = (drop.zs ?? []).find((entry) => entry.zone === zone);
        if (survey && !surveyHere.has(zone)) surveyHere.set(zone, survey);
      }
    }
    for (const [zone, seen] of seenHere) {
      const survey = surveyHere.get(zone) ?? null;
      const tally = byZone.get(zone);
      if (tally) {
        tally.items += 1;
        tally.seen += seen;
        if (!tally.survey && survey) {
          tally.survey = survey;
          tally.title = survey.title;
          tally.slug = survey.slug || null;
        }
      } else {
        byZone.set(zone, {
          zone,
          title: survey?.title ?? zone,
          slug: survey?.slug || null,
          items: 1,
          seen,
          survey,
        });
      }
    }
  }
  return [...byZone.values()].sort(
    (a, b) => b.items - a.items || b.seen - a.seen || a.zone.localeCompare(b.zone),
  );
}

/**
 * Where an item comes from, as the catalog has it — the wiki's account.
 *
 * Half of what makes a row worth acting on: an EP number tells you what to want
 * and a zone tells you where to go. It is the *transcribed* half, and the screen
 * labels it as such wherever it prints it, because `measuredDrops` above is the
 * other half and the two are different classes of claim. Returns an empty list
 * rather than a guess when the corpus records nothing, and the screen says so in
 * words — "no acquisition data" is a fact about our data, not about the item.
 */
export function acquisitionLines(item: Item): AcquisitionLine[] {
  const src = item.src;
  if (!src) return [];
  const out: AcquisitionLine[] = [];
  const zones = line('z', 'Zone', src.z ?? [], 3);
  if (zones) out.push(zones);
  const mobs = line('m', 'Drops from', src.m ?? [], 3);
  if (mobs) out.push(mobs);
  const quests = line('q', 'Quest', src.q ?? [], 2);
  if (quests) out.push(quests);
  const vendors = line('v', 'Vendor', src.v ?? [], 2);
  if (vendors) out.push(vendors);
  if (src.c) out.push({ key: 'c', label: 'Crafted', text: 'Player-made', more: 0 });
  return out;
}

/* ------------------------------------------------------------- the screen */

/**
 * A signed gain, always to one decimal.
 *
 * `signedDec` trims trailing zeros, which printed `+74` above `+57.5` above
 * `+55` in a right-aligned column of EP — the exact misalignment `format.ts`
 * added `ep()` to stop. EP is one decimal everywhere in this app, sign or no
 * sign.
 */
function signedEp(value: number): string {
  return `${value < 0 ? '-' : '+'}${epText(Math.abs(value))}`;
}

/** Drive the ranking a slice at a time, reporting progress between slices. */
async function drive(
  work: Generator<UpgradeProgress, UpgradeReport, void>,
  onProgress: (progress: UpgradeProgress) => void,
  budget = 8,
): Promise<UpgradeReport> {
  const now = () => (typeof performance === 'object' ? performance.now() : Date.now());
  for (;;) {
    const deadline = now() + budget;
    let step = work.next();
    while (!step.done && now() < deadline) step = work.next();
    if (step.done) return step.value;
    onProgress(step.value);
    await nextFrame();
  }
}

function TierChip({ value }: { value: UpgradeState }) {
  return (
    <span className="tier-chip" data-tier={value.full} title={`Upgrade tier ${value.full}`}>
      +{num(value.full)}
    </span>
  );
}

/** How many measured sources a row lists before it starts counting the rest. */
const MEASURED_SHOWN = 4;

/**
 * The measured half, which leads.
 *
 * Everything above this on a row is arithmetic over a wiki scrape. This is the
 * one block on the screen made of observations: a mob that was watched dropping
 * this item, in a named zone, on dated sessions, with the sample size printed
 * beside the count. It is drawn as its own card with its own standing mark
 * rather than as another line in the acquisition list, because merging it into
 * that list is exactly the laundering the sourcing standard exists to stop —
 * the reader would have no way to tell which line somebody measured.
 *
 * Every figure here is a count. There is no rate on this card, no percentage,
 * and no division anywhere in the code that builds it.
 */
function MeasuredDrops({ rows }: { rows: readonly MeasuredDrop[] }) {
  const shown = rows.slice(0, MEASURED_SHOWN);
  const sightings = totalSightings(rows);
  const span = dateSpan(rows);

  return (
    <section className="upg-measured" data-standing="trusted" aria-label="Measured drop sources">
      <header className="upg-measuredhead">
        <span className="tier tM">Tier M · seen dropping in game</span>
        <span className="upg-measuredsum">
          {pluralize(sightings, 'sighting')} across {pluralize(rows.length, 'mob')}
          {span ? ` · ${dateText(span.first, span.last)}` : ''}
        </span>
      </header>

      <ol className="upg-drops">
        {shown.map((drop) => (
          <li className="upg-drop" key={`${drop.mob}|${(drop.zones ?? []).join()}`}>
            <span className="upg-dropmob">
              {drop.mob}
              {drop.offRoster ? (
                <span
                  className="upg-dropoff"
                  title="The log named this mob; no survey roster we had written did. No less measured — less expected."
                >
                  off roster
                </span>
              ) : null}
            </span>
            <span className="upg-dropzone">
              {(drop.zones ?? []).join(' · ') || 'zone not recorded'}
            </span>
            <span className="upg-dropseen">
              <b>{count(drop.seen)}</b> seen
            </span>
            <span className="upg-dropmeta">
              over {pluralize(drop.sessions, 'session')}
              {drop.first ? ` · ${dateText(drop.first, drop.last)}` : ''}
            </span>
            {(drop.zs ?? []).map((survey) => (
              <span className="upg-dropsurvey" key={survey.zone}>
                {surveyText(survey)}
              </span>
            ))}
          </li>
        ))}
      </ol>

      {rows.length > shown.length ? (
        <p className="upg-dropmore">
          {pluralize(rows.length - shown.length, 'further measured source')}, smaller counts than
          these.
        </p>
      ) : null}

      {/*
        The sentence that keeps every figure above honest, and the reason this
        card can exist at all. Both halves matter: a count is not a rate, and an
        absence is not a zero.
      */}
      <p className="upg-dropnote">
        A count, never a rate. These are sightings in parsed combat logs over the sessions named —
        not a drop chance, which nothing here would support. And a mob absent from this list has not
        been shown not to drop it: a dry streak is a ceiling, not a zero.
      </p>
    </section>
  );
}

function SourceBlock({
  item,
  drops,
  alsoFor = [],
}: {
  item: Item;
  /** Passed in rather than recomputed: the row above it already asked. */
  drops?: readonly MeasuredDrop[];
  alsoFor?: string[];
}) {
  const lines = acquisitionLines(item);
  const measured = drops ?? measuredDrops(item);
  const noDrop = item.fl.includes('NO_DROP');
  const lore = isLore(item);

  return (
    <div className="upg-source">
      {measured.length ? <MeasuredDrops rows={measured} /> : null}

      {/*
        The wiki's account, second and labelled as an account.

        It used to be the only thing here and it carried no attribution at all,
        which read as the app's own statement of where an item comes from. Where
        a measured card sits above it the contrast does the work; where none
        does, the label is the only thing telling a reader that these lines were
        transcribed from a catalog rather than observed.
      */}
      <div className="upg-wiki">
        {lines.length ? (
          <>
            <p className="upg-srcline">
              <span className="upg-srclabel">Also said</span>
              <span className="upg-srctext">
                <span className="tier">Transcribed</span>{' '}
                <span className="upg-more">
                  {measured.length
                    ? 'from the wiki catalogs, not measured — kept because it names quests and vendors no combat log can.'
                    : 'from the wiki catalogs. Nobody has measured this item dropping.'}
                </span>
              </span>
            </p>
            {lines.map((entry) => (
              <p className="upg-srcline" key={entry.key}>
                <span className="upg-srclabel">{entry.label}</span>
                <span className="upg-srctext">
                  {entry.text}
                  {entry.more ? <span className="upg-more"> +{num(entry.more)} more</span> : null}
                </span>
              </p>
            ))}
          </>
        ) : (
          <p className="upg-source-none">
            {measured.length
              ? 'No wiki catalog records where this comes from. The sightings above are all anyone has, and they came from the game rather than from a page.'
              : 'No acquisition data is recorded for this item, and nobody has measured it dropping. That is a gap in our data, not a statement that it cannot be obtained.'}
          </p>
        )}
      </div>
      {noDrop ? (
        <p className="upg-srcline">
          <span className="upg-srclabel">No Drop</span>
          <span className="upg-srctext">
            Cannot be traded or bought — this one has to come off the mob yourself.
          </span>
        </p>
      ) : null}
      {lore ? (
        <p className="upg-srcline">
          <span className="upg-srclabel">Lore</span>
          <span className="upg-srctext">
            One only, so it is offered in the single position where it gains the most.
          </span>
        </p>
      ) : null}
      {alsoFor.length ? (
        <p className="upg-srcline">
          <span className="upg-srclabel">Also for</span>
          <span className="upg-srctext">
            {alsoFor.join(' · ')} — that is {num(alsoFor.length + 1)} of them to find.
          </span>
        </p>
      ) : null}
    </div>
  );
}

function Row({
  row,
  rank,
  scale,
  context,
  onEquip,
  onOpen,
}: {
  row: UpgradeRow;
  rank: number;
  /** The biggest gain on the page, so the bar is relative to the best row. */
  scale: number;
  context: LoadoutContext | undefined;
  onEquip: () => void;
  onOpen: () => void;
}) {
  const { position, candidate } = row;
  const width = scale > 0 ? Math.max(4, Math.round((row.gain / scale) * 100)) : 0;
  const era = eraLabel(candidate.item);
  const drops = measuredDrops(candidate.item);

  return (
    <li className="upg-row">
      <div className="upg-main">
        <div className="upg-rank">
          <span className="upg-rankno">{num(rank)}</span>
          <span className="upg-glyph" aria-hidden="true">
            <SlotGlyph slot={position.type} size={20} />
          </span>
          <span className="upg-slot">{position.label}</span>
        </div>

        <div className="upg-side">
          <span className="upg-side-label">Wearing</span>
          {row.wornName ? (
            <>
              <span className="upg-item">
                <span className="upg-worn">{row.wornName}</span>
                <TierChip value={row.wornUpgrade} />
              </span>
              <span className="upg-sub">{epText(row.wornEp)} EP</span>
            </>
          ) : (
            <>
              <span className="upg-item">
                <span className="upg-empty">Nothing</span>
              </span>
              <span className="upg-sub">0.0 EP</span>
            </>
          )}
        </div>

        <div className="upg-arrow" aria-hidden="true">
          →
        </div>

        <div className="upg-side">
          <span className="upg-side-label">Best available</span>
          <span className="upg-item">
            <button
              type="button"
              className="upg-name"
              onClick={onOpen}
              title={`Open ${candidate.item.n}`}
              {...itemHoverProps(candidate.item, candidate.upgrade, context, position.type)}
            >
              {candidate.item.n}
            </button>
            <TierChip value={candidate.upgrade} />
          </span>
          <span className="upg-sub">
            {epText(candidate.ep)} EP{era ? ` · ${era}` : ''}
            {/*
              The measured mark, at the point of decision rather than only in
              the detail below. A reader scanning twenty-three rows for what to
              farm tonight should be able to see which of them the game has
              actually been observed producing without opening any of them.
            */}
            {drops.length ? (
              <span
                className="upg-seenmark"
                title="A mob has been watched dropping this, in parsed combat logs. The sources are listed below. A count, never a rate."
              >
                {' · '}
                {pluralize(totalSightings(drops), 'sighting')}
              </span>
            ) : null}
            {/*
              Where the EP itself came from.
              
              `SOURCING-STANDARD.md` rule 5: "a player looking at a number is
              entitled to know whether it came from the game or from a wiki page
              of uncertain provenance." The EP *is* the number on this screen —
              it is the whole answer the row gives — and until now this row
              named the item's EXISTENCE evidence (the sighting count beside it)
              and said nothing at all about where its STATS came from. Those are
              two independent facts, which is the payload's own rule, and only
              one of them was on the row.
              
              Band and wording both come from `sourceStanding`, so this cannot
              say something the item window does not. The band is what carries
              colour: tier-2 and tier-M are both `trusted`, tier-5 is
              `distrust`, and the text is what tells them apart — 94% of a
              ranked list is tier-2, and a colour every row shares is a wash
              rather than a signal. That is the same argument the paper doll's
              tint already settles.
            */}
            {(() => {
              const mark = sourceStanding(candidate.item);
              return (
                <span className="upg-standing" data-band={mark.band} title={mark.label}>
                  {' · '}
                  {mark.short}
                </span>
              );
            })()}
          </span>
        </div>

        <div className="upg-gain">
          <strong className="upg-gainvalue">{signedEp(row.gain)}</strong>
          <span className="upg-gainunit">EP</span>
          <span className="upg-bar" aria-hidden="true">
            <span style={{ width: `${width}%` }} />
          </span>
        </div>

        <div className="upg-do">
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={onEquip}
            aria-label={`Equip ${candidate.item.n} at +${num(candidate.upgrade.full)} in ${position.label}`}
          >
            Equip
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={onOpen}
            aria-label={`Open ${candidate.item.n}`}
          >
            Open
          </button>
        </div>
      </div>

      <div className="upg-detail">
        <div className="upg-move">
          <div className="upg-chips">
            {row.ratio ? (
              <span className="upg-chip">
                <i>RATIO</i>
                {dec(row.ratio.before, 3)} → {dec(row.ratio.after, 3)}
              </span>
            ) : null}
            {row.deltas.map((delta) => (
              <span className={`upg-chip ${delta.delta > 0 ? 'up' : 'down'}`} key={delta.key}>
                <i>{shortStatLabel(delta.key)}</i>
                {signed(delta.delta)}
                {/*
                  This row's EP was computed with haste in it, so the caveat
                  belongs on the row and not only in the stat panel: the unit is
                  disputed, and only the highest worn haste counts at all, which
                  is why the number here can be smaller than the item's own.
                */}
                {delta.key === 'HASTE' ? (
                  <sup
                    className="upg-daggermark"
                    title={`${HASTE_PROVENANCE.short} ${HASTE_STACKING.rule} ${HASTE_STACKING.standing}`}
                  >
                    †
                  </sup>
                ) : null}
              </span>
            ))}
          </div>
          {/*
            What the EP number cannot say. A weighted score is silent about
            everything it does not weight, so a swap can gain 42.8 EP and cost
            every point of regeneration the character had without a single
            figure above moving.
          */}
          {row.deltas.some((delta) => delta.key === 'HASTE') ? (
            <p className="upg-unweighted">
              <span className="upg-srclabel">† Haste</span>
              <span>
                {HASTE_PROVENANCE.classic} {HASTE_PROVENANCE.legends} No unit is printed here
                because which one applies is unsettled. {HASTE_STACKING.rule}{' '}
                {HASTE_STACKING.standing}
              </span>
            </p>
          ) : null}
          {row.unweighted.length ? (
            <p className="upg-unweighted">
              <span className="upg-srclabel">Gives up</span>
              <span>
                {row.unweighted
                  .map((delta) => `${shortStatLabel(delta.key)} ${signed(delta.delta)}`)
                  .join(' · ')}{' '}
                — not counted by this set's weights.
              </span>
            </p>
          ) : null}
        </div>
        <SourceBlock item={candidate.item} drops={drops} alsoFor={row.alsoFor} />
      </div>
    </li>
  );
}

const WITHHELD_TEXT: Record<WithheldReason, string> = {
  'worn-unstatted':
    'No catalog carries this item’s stats, so nothing can be measured against it. A gain here would be arithmetic against a zero nobody recorded.',
  'worn-unresolved':
    'This item is not in the catalog this build shipped, so there is nothing to compare it with. It may be spelled differently on the wiki, or absent from it.',
  'profile-blind-to-weapons':
    'This profile weights no weapon term, so damage and delay would score nothing here and the slot would be ranked on its stat line alone — which puts a 1-damage baton above a 40-damage greatsword. Rather than invent a weapon weight nobody has measured, the slot is left unranked. Switch to Melee DPS or Balanced, which do weight weapon ratio.',
};

export function Upgrades({ id }: { id: string }) {
  const state = useApp();
  const catalog = useCatalog();
  const ensureAll = useCatalog((s) => s.ensureAll);

  /*
   * `#/upgrades` with no set names the one you were last editing, which is the
   * same set every other screen defaults to. The URL is then rewritten so the
   * page can be linked, bookmarked and reloaded onto the same answer.
   */
  const fallback = setsForCharacter(state, state.activeCharacterId ?? state.characters[0]?.id ?? null)[0];
  const gearSet = id ? state.sets.find((s) => s.id === id) : fallback;
  const character = characterFor(state, gearSet);

  const [basisKind, setBasisKind] = useState<'worn' | 'fixed'>('worn');
  const [fixedTier, setFixedTier] = useState<UpgradeState>(tier(0));
  const [report, setReport] = useState<UpgradeReport | null>(null);
  const [progress, setProgress] = useState<UpgradeProgress | null>(null);
  const [detail, setDetail] = useState<{ item: Item; upgrade: UpgradeState; position: SlotPosition } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const setId = gearSet?.id ?? '';
  useEffect(() => {
    if (!id && setId) navigate(href.upgrades(setId), { replace: true });
  }, [id, setId]);

  // A ranking that spans all twenty-three positions needs every shard, not the
  // one the last picker happened to open — and the acquisition data this screen
  // exists to show ships in the shards rather than in the index.
  useEffect(() => {
    void ensureAll();
  }, [ensureAll]);

  const weights: WeightProfile = useMemo(() => gearSet?.weights ?? {}, [gearSet]);
  const filters = useMemo(() => filtersFor(gearSet), [gearSet]);
  const { era: filterEra, source: filterSource, hideNoDrop: filterHideNoDrop } = filters;
  const context = useMemo(
    () => (character ? activeContext(character) : undefined),
    [character],
  );
  const views = useMemo(
    () => (gearSet ? slotViews(gearSet, catalog) : []),
    [gearSet, catalog],
  );
  const basis: CompareBasis = useMemo(
    () => (basisKind === 'worn' ? { kind: 'worn' } : { kind: 'fixed', upgrade: fixedTier }),
    [basisKind, fixedTier],
  );

  const weighted = hasAnyWeight(weights);
  const ready = catalog.status === 'ready';

  useEffect(() => {
    if (!gearSet || !ready || !weighted) {
      setReport(null);
      setProgress(null);
      return;
    }
    let cancelled = false;
    setProgress({ done: 0, total: views.length });
    void (async () => {
      // Let the busy state paint before the ranking blocks the thread.
      await nextFrame();
      if (cancelled) return;
      const result = await drive(
        upgradeSteps(catalog, views, context, weights, {
          filters: { era: filterEra, source: filterSource, hideNoDrop: filterHideNoDrop },
          basis,
          withheldSlots: gearSet.withheld,
        }),
        (value) => {
          if (!cancelled) setProgress(value);
        },
      );
      if (cancelled) return;
      setReport(result);
      setProgress(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [
    gearSet, ready, weighted, catalog, views, context, weights,
    filterEra, filterSource, filterHideNoDrop, basis,
  ]);

  /*
   * These three sit above the `!gearSet` early return, and must stay above it.
   *
   * They were below it, and that is a rules-of-hooks violation: the empty-state
   * return runs fewer hooks than the ranked return, so any render that crosses
   * that boundary changes this component's hook count and React aborts the
   * tree. `App.tsx:41-47` calls `hydrate()` from an effect and `store.ts` opens
   * at `hydrated: false`, so a real page load onto this route crosses it every
   * time: first paint has no set, the paint after hydration has one.
   *
   * Proved rather than argued. `upgrades-screen.test.tsx`'s last test mounts
   * that crossing, and against the arrangement this replaces it fails at the
   * `measuredRows` line below:
   *
   *   npx vitest run src/screens/upgrades-screen.test.tsx
   *   # before: 1 failed — Rendered more hooks than during the previous render
   *   # after:  20 passed
   *
   * `rows` moves up with them because they take it as their dependency; it
   * reads `report`, not `gearSet`, so it is well defined on the empty path too.
   */
  const rows = report?.rows ?? [];
  /*
   * The measured half of the page, rolled up once for the header rather than
   * recomputed inside three renders. Both figures are counts: rows whose
   * candidate has been watched dropping, and the zones those sightings were in.
   */
  const measuredRows = useMemo(
    () => rows.filter((row) => measuredDrops(row.candidate.item).length > 0),
    [rows],
  );
  const tallies = useMemo(() => zoneTallies(rows), [rows]);

  if (!gearSet) {
    return (
      <div className="empty-state">
        <h2>No set to rank</h2>
        <p>
          Upgrades are ranked against a character's gear set: what you are wearing, the weights that
          set scores by, and the classes in its loadout. Make one and this page fills itself in.
        </p>
        <div className="empty-actions">
          <a className="btn btn-primary" href={href.newCharacter}>
            Create a character
          </a>
          <a className="btn" href={href.characters}>
            Your characters
          </a>
        </div>
      </div>
    );
  }

  /*
   * One slot, one write — and the notice names what was displaced.
   *
   * There is no undo in this app by design (`state/store.ts`), so the only way
   * back is to re-equip the old item by hand, and that is only possible if the
   * reader is told what it was. The row that stated it has re-ranked itself out
   * of existence by the time they read this.
   */
  const equip = (row: UpgradeRow) => {
    state.equip(gearSet.id, row.position.id, row.candidate.item.n, row.candidate.upgrade);
    const replaced = row.wornName
      ? `, replacing ${row.wornName} at +${num(row.wornUpgrade.full)}`
      : ' into an empty slot';
    setNotice(
      `${row.candidate.item.n} equipped in ${row.position.label} at +${num(row.candidate.upgrade.full)}${replaced} — ${signedEp(row.gain)} EP. The list is being re-ranked against the set as it now stands.`,
    );
  };

  const best = rows[0]?.gain ?? 0;
  const applied = describeActiveFilters(filters);
  const basisText =
    basis.kind === 'worn'
      ? 'each candidate at the tier its slot already carries'
      : `every candidate at +${num(fixedTier.full)}`;

  return (
    <div className="upg">
      <header className="upg-head">
        <div className="upg-titles">
          <span className="upg-eyebrow">
            {character ? `${character.name} · ${describeCharacter(character)}` : 'No character'} ·{' '}
            {gearSet.name}
          </span>
          <h1 className="page-title">Upgrades</h1>
          <p className="upg-lede">
            The best item this loadout can wear in every position, ranked by what it adds to this
            set — scored under {gearSet.name}'s own weights, cap-aware against the rest of the set,
            and eligible by class, race and per-class level. These are the same numbers each slot's
            picker shows.
          </p>
        </div>
        <div className="upg-headactions">
          <a className="btn btn-sm" href={href.set(gearSet.id)}>
            Back to gear
          </a>
          <a className="btn btn-sm" href={href.set(gearSet.id, 'weights')}>
            Weights
          </a>
        </div>
      </header>

      {notice ? (
        <div className="notice" role="status">
          <span className="grow">{notice}</span>
          <button
            type="button"
            className="btn btn-quiet btn-icon"
            aria-label="Dismiss this message"
            onClick={() => setNotice(null)}
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>
      ) : null}

      <div className="upg-controls">
        <label className="upg-control">
          <span className="section-label">Score candidates at</span>
          <select
            value={basisKind}
            onChange={(event) => setBasisKind(event.target.value === 'fixed' ? 'fixed' : 'worn')}
          >
            <option value="worn">The tier the slot already carries</option>
            <option value="fixed">One fixed tier</option>
          </select>
        </label>
        {basisKind === 'fixed' ? (
          <span className="upg-control rowline">
            <UpgradeStepper value={fixedTier} label="comparison tier" onChange={setFixedTier} />
            <button type="button" className="btn btn-sm" onClick={() => setFixedTier(tier(0))}>
              Reset
            </button>
          </span>
        ) : null}
        <p className="hint upg-basisnote">
          {basis.kind === 'worn'
            ? 'What you are wearing keeps its own +N and the candidate is scored at the same tier, so the comparison is about the item rather than the grind. An empty slot compares at +0.'
            : `Every candidate is scored at +${num(fixedTier.full)} against what you are wearing at its own tier — the question you ask with a fresh drop in your bags.`}
        </p>
      </div>

      {!weighted ? (
        <div className="empty-state">
          <h2>This set weights nothing</h2>
          <p>
            Every stat in {gearSet.name} is weighted zero, so every item scores zero and no ranking
            can be made. Pick a preset or set a few weights, and this page has something to sort by.
          </p>
          <div className="empty-actions">
            <a className="btn btn-primary" href={href.set(gearSet.id, 'weights')}>
              Open Weights
            </a>
          </div>
        </div>
      ) : null}

      {weighted && !ready ? (
        <p className="hint" role="status">
          {catalog.status === 'missing' || catalog.status === 'error'
            ? 'Item data has not loaded, so there is nothing to rank yet.'
            : 'Loading item data — every slot is ranked once the shards arrive.'}
        </p>
      ) : null}

      {weighted && ready && progress ? (
        <p className="hint" role="status" aria-busy="true">
          Ranking {count(progress.total)} positions — {count(progress.done)} done.
        </p>
      ) : null}

      {report ? (
        <>
          <div className="upg-kpis">
            <div className="upg-kpi">
              <span className="section-label">Slots with a better option</span>
              <strong className="upg-kpivalue">
                {num(report.rows.length)}
                <span className="upg-kpiof">/{num(views.length)}</span>
              </strong>
              <span className="hint">
                {num(report.settled)} already best · {num(report.withheld.length)} not comparable ·{' '}
                {num(report.nothing.length)} with nothing to offer
              </span>
            </div>
            <div className="upg-kpi">
              <span className="section-label">Biggest single gain</span>
              {/* Green is for a gain. A page with nothing to gain prints a
                  neutral zero rather than a cheerful one. */}
              <strong className={`upg-kpivalue${best > 0 ? ' up' : ''}`}>{signedEp(best)}</strong>
              <span className="hint">
                {rows[0] ? `${rows[0].position.label} · ${rows[0].candidate.item.n}` : 'Nothing to gain'}
              </span>
            </div>
            <div className="upg-kpi">
              <span className="section-label">Listed gain, added up</span>
              <strong className={`upg-kpivalue${report.totalGain > 0 ? ' up' : ''}`}>
                {signedEp(report.totalGain)}
              </strong>
              {/* Not a promise about the finished set: each row is measured
                  against the set as it stands, and applying one changes the cap
                  context every other row was measured in. */}
              <span className="hint">
                Not additive — each row is measured against the set as it stands now, so taking one
                re-ranks the rest.
              </span>
            </div>
            {/*
              The figure this tool exists for, given the same weight as the EP.
              A gain tells a player what to want; this tells them the want is
              answerable, and the section below tells them where. Zero is a real
              answer and is printed as one.
            */}
            <div className="upg-kpi" data-standing={measuredRows.length ? 'trusted' : undefined}>
              <span className="section-label">Measured dropping in game</span>
              <strong className="upg-kpivalue">
                {num(measuredRows.length)}
                <span className="upg-kpiof">/{num(rows.length)}</span>
              </strong>
              <span className="hint">
                {measuredRows.length
                  ? 'Listed upgrades a mob has been watched dropping, in parsed combat logs. The rest are the wiki’s word.'
                  : 'Nothing on this list has been watched dropping yet. That is a gap in the logs, not a statement about the items.'}
              </span>
            </div>
          </div>

          {tallies.length ? (
            <section className="upg-zones" aria-label="Where these upgrades were measured dropping">
              <header className="upg-sectionhead">
                <h2 className="section-label">Where to go</h2>
                <span className="tier tM">Tier M · measured</span>
                <span className="hint">
                  Zones these listed upgrades were seen dropping in — counts of items and
                  sightings, never a rate, and never a ranking of one zone over another.
                </span>
              </header>
              <ol className="upg-zonelist">
                {tallies.map((tally) => (
                  <li className="upg-zone" key={tally.zone}>
                    <span className="upg-zonename">{tally.zone}</span>
                    <span className="upg-zonecount">
                      <b>{num(tally.items)}</b> of {num(rows.length)} listed
                    </span>
                    <span className="upg-zoneseen">{pluralize(tally.seen, 'sighting')}</span>
                    <span className="upg-zonesurvey">
                      {tally.survey
                        ? surveyText(tally.survey)
                        : 'no published survey for this zone'}
                    </span>
                  </li>
                ))}
              </ol>
              <p className="upg-dropnote">
                A partial survey is a partial survey: what is measured here is what the logs cover,
                and a zone with fewer facets measured is less known, not worse. Items with no
                sighting at all are absent from this list rather than shown at zero.
              </p>
            </section>
          ) : null}

          {rows.length ? (
            <ol className="upg-list">
              {rows.map((row, index) => (
                <Row
                  key={row.position.id}
                  row={row}
                  rank={index + 1}
                  scale={best}
                  context={context}
                  onEquip={() => equip(row)}
                  onOpen={() =>
                    setDetail({
                      item: row.candidate.item,
                      upgrade: row.candidate.upgrade,
                      position: row.position,
                    })
                  }
                />
              ))}
            </ol>
          ) : (
            <div className="empty-state">
              <h2>Nothing outranks what you are wearing</h2>
              <p>
                Every position this set can score is already carrying the best item the catalog
                offers it, {basisText}. Change the comparison tier, widen this set's filters, or
                adjust its weights to ask a different question.
              </p>
            </div>
          )}

          {report.withheld.length ? (
            <section className="upg-withheld" aria-label="Positions that cannot be compared">
              <header className="upg-sectionhead">
                <h2 className="section-label">Not compared</h2>
                <span className="hint">
                  {num(report.withheld.length)} position
                  {report.withheld.length === 1 ? '' : 's'} where what you are wearing cannot be put
                  on a scale
                </span>
              </header>
              {report.withheld.map((entry) => (
                <article className="upg-held" key={entry.position.id} data-standing="distrust">
                  <div className="upg-heldhead">
                    <span className="upg-slot">{entry.position.label}</span>
                    <span className="upg-item">
                      <span className="upg-worn">{entry.wornName ?? 'nothing equipped'}</span>
                      <TierChip value={entry.wornUpgrade} />
                    </span>
                    <span className="upg-heldmark">
                      {entry.reason === 'worn-unstatted' ? 'Unsourced · stats withheld'
                        : entry.reason === 'profile-blind-to-weapons' ? 'Profile scores no weapon term'
                          : 'Not in catalog'}
                    </span>
                  </div>
                  <p className="upg-heldtext">{WITHHELD_TEXT[entry.reason]}</p>
                  {entry.evidence ? <p className="upg-heldtext dim">{entry.evidence}</p> : null}
                  {entry.candidate ? (
                    <p className="upg-heldtext">
                      The best scoring item this position can take is{' '}
                      <strong>{entry.candidate.item.n}</strong> at {epText(entry.candidate.ep)} EP.
                      Whether that beats what you have is a question only your own client can answer.
                    </p>
                  ) : null}
                </article>
              ))}
            </section>
          ) : null}

          <p className="hint upg-foot">
            Ranked {basisText}, against {gearSet.name}'s weights.
            {applied ? ` This set's filters apply: ${applied}.` : ' This set applies no filters.'}{' '}
            Items already worn elsewhere in this set are not offered again, a Lore item is offered
            for one position only, and an item with no published stats is never ranked
            {report.withheld.length ? ' — see Not compared above' : ''}.
            {report.nothing.length
              ? ` Nothing scored for ${report.nothing.length === views.length ? 'any position' : report.nothing.join(', ')}.`
              : ''}
          </p>
        </>
      ) : null}

      {detail ? (
        <ItemDetail
          item={detail.item}
          upgrade={detail.upgrade}
          equipTargets={[{ positionId: detail.position.id, label: detail.position.label }]}
          setName={gearSet.name}
          context={context}
          onEquip={(positionId) => {
            state.equip(gearSet.id, positionId, detail.item.n, detail.upgrade);
            setNotice(
              `${detail.item.n} equipped in ${detail.position.label} at +${num(detail.upgrade.full)}.`,
            );
            setDetail(null);
          }}
          onClose={() => setDetail(null)}
        />
      ) : null}
    </div>
  );
}
