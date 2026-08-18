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
import { SLOT_POSITIONS, type SlotPosition } from '../engine/constants';
import { scoreItem, type WeightProfile } from '../engine/ep';
import { resolveItem } from '../engine/stats';
import { BASE_STATE, normalizeState, tier, type UpgradeState } from '../engine/upgrade';
import type { Item } from '../engine/types';
import { statsAreUnknown, type SlotCode } from '../data/normalize';
import { useCatalog, type CatalogState } from '../data/catalog';
import { ItemDetail } from '../components/ItemDetail';
import { itemHoverProps } from '../components/ItemWindow';
import { SlotGlyph } from '../components/SlotGlyph';
import { UpgradeStepper } from '../components/UpgradeStepper';
import { count, dec, ep as epText, finite, num, signed } from '../lib/format';
import { nextFrame } from '../lib/frames';
import { eraLabel } from '../lib/itemStyle';
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
export type WithheldReason = 'worn-unstatted' | 'worn-unresolved';

export interface WithheldRow {
  position: SlotPosition;
  reason: WithheldReason;
  wornName: string;
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
    // An Any Slot is a worn position rather than a hand, so damage and ratio
    // buy nothing there — the same rule `rankSlotItems` scores under.
    const weaponCounts = slot !== 'ANY';
    const wornUpgrade = view.equipped ? normalizeState(view.equipped.upgrade) : BASE_STATE;
    const candidateUpgrade =
      basis.kind === 'worn' ? wornUpgrade : normalizeState(basis.upgrade);
    const existing = scoreContextFrom(totalsFor(views, position.id));

    const ranked = narrow(
      rankSlotItems(catalog, { slot, context, weights, upgrade: candidateUpgrade, existing }),
    );

    /*
     * The worn item cannot always be put on the same scale as the candidate.
     * Both cases are a gap in what we know rather than a property of the gear,
     * and inventing a zero for either would produce a real-looking gain
     * computed against nothing.
     */
    const reason: WithheldReason | null = view.unresolved
      ? 'worn-unresolved'
      : view.item && statsAreUnknown(view.item)
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
      wornName: view.equipped?.itemName,
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

    if (entry.reason && entry.wornName) {
      withheld.push({
        position: entry.position,
        reason: entry.reason,
        wornName: entry.wornName,
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

/**
 * Where an item comes from, as the catalog has it.
 *
 * This is the half that makes a row worth acting on: an EP number tells you
 * what to want and a zone tells you where to go. Returns an empty list rather
 * than a guess when the corpus records nothing, and the screen says so in
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

function SourceBlock({ item, alsoFor = [] }: { item: Item; alsoFor?: string[] }) {
  const lines = acquisitionLines(item);
  const noDrop = item.fl.includes('NO_DROP');
  const lore = isLore(item);

  return (
    <div className="upg-source">
      {lines.length ? (
        lines.map((entry) => (
          <p className="upg-srcline" key={entry.key}>
            <span className="upg-srclabel">{entry.label}</span>
            <span className="upg-srctext">
              {entry.text}
              {entry.more ? <span className="upg-more"> +{num(entry.more)} more</span> : null}
            </span>
          </p>
        ))
      ) : (
        <p className="upg-source-none">
          No acquisition data is recorded for this item — the catalog carries its stats and not its
          origin. That is a gap in our data, not a statement that it cannot be obtained.
        </p>
      )}
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
              </span>
            ))}
          </div>
          {/*
            What the EP number cannot say. A weighted score is silent about
            everything it does not weight, so a swap can gain 42.8 EP and cost
            every point of regeneration the character had without a single
            figure above moving.
          */}
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
        <SourceBlock item={candidate.item} alsoFor={row.alsoFor} />
      </div>
    </li>
  );
}

const WITHHELD_TEXT: Record<WithheldReason, string> = {
  'worn-unstatted':
    'No catalog carries this item’s stats, so nothing can be measured against it. A gain here would be arithmetic against a zero nobody recorded.',
  'worn-unresolved':
    'This item is not in the catalog this build shipped, so there is nothing to compare it with. It may be spelled differently on the wiki, or absent from it.',
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

  const rows = report?.rows ?? [];
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
          </div>

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
                      <span className="upg-worn">{entry.wornName}</span>
                      <TierChip value={entry.wornUpgrade} />
                    </span>
                    <span className="upg-heldmark">
                      {entry.reason === 'worn-unstatted' ? 'Unsourced · stats withheld' : 'Not in catalog'}
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
