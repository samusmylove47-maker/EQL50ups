/**
 * Item presentation rules: the colour an item's name takes, and the labels
 * that ride alongside it.
 *
 * **There are no rarity tiers in EverQuest Legends**, so a WoW-style
 * grey/green/blue/purple ladder would be imported nonsense. The client instead
 * tints an item's name by whether *this character* can use it. On the sampled
 * Bard/Warrior/Berserker, Monk-only "Whitened Treant Fists" renders red while
 * Earthshaker, Cloak of Flames and Bone-Clasped Girdle — each qualifying
 * through one of the trio — render green.
 *
 * That is what we reproduce, driven by the active loadout: an item a class in
 * the trio qualifies for is `--item-usable`, one that none of them qualifies
 * for is `--item-blocked`, and when there is no character to judge against
 * (the item browser with no class filter, a share link's read-only view) the
 * name is simply plain. `--item-caution` maps to an unexplained third client
 * state and stays deliberately unused.
 *
 * Plain covers one more case than "no character": a character with **no race
 * set** against an item that restricts on race. The gate lets it through on
 * purpose — see `raceUnjudged` — but the tint means "checked, and you can wear
 * it", and that check did not run. Measured over the shipped 3,663 records for
 * a WAR/CLR/SHM 50 with race unset: 2,773 usable, 740 blocked, 150 withheld
 * this way. How many of those 150 the tint would have been *wrong* about
 * depends on the race the player has not told us — 11 for a Barbarian, 111 for
 * an Iksar.
 */

import { canUse, raceUnjudged, type LoadoutContext } from '../engine/character';
import type { ExistenceEvidence, Item, SourceStanding } from '../engine/types';

/**
 * `race-unknown` is a verdict withheld, not a verdict given.
 *
 * Class and level were checked and passed; the race gate was skipped, because
 * this character has no race set and the item's `ra` list turns on one. The
 * item is **still eligible** — `canUse` says yes and nothing about ranking,
 * equipping or totals changes — but the app is no longer entitled to say
 * "Usable by this loadout" about it, which it did by default for every new
 * character over all 164 race-restricted records.
 */
export type Usability = 'usable' | 'blocked' | 'unjudged' | 'race-unknown';

/** Restriction shape `canUse` wants, built from a catalog item. */
function restrictionsOf(item: Item) {
  return { classes: item.cl, races: item.ra, ...(item.rl ? { rl: item.rl } : {}) };
}

export function usabilityOf(item: Item, context: LoadoutContext | undefined): Usability {
  if (!context || !context.classes.length) return 'unjudged';
  if (!canUse(restrictionsOf(item), context)) return 'blocked';
  return raceUnjudged({ races: item.ra }, context) ? 'race-unknown' : 'usable';
}

/** The colour an item name takes on every surface. */
export function itemNameColor(item: Item, context: LoadoutContext | undefined): string {
  const state = usabilityOf(item, context);
  if (state === 'usable') return 'var(--item-usable)';
  if (state === 'blocked') return 'var(--item-blocked)';
  // Neutral, the same as having no character at all: the green in this app
  // means "checked, and you can wear it". An unchecked gate does not earn it.
  return 'var(--item-neutral)';
}

/**
 * Why an item is tinted the way it is, for a tooltip or an assistive label.
 * Silent when there is no character to judge against — but never silent when
 * there is one and a gate went unchecked, because silence there reads as
 * approval.
 */
export function usabilityNote(item: Item, context: LoadoutContext | undefined): string | null {
  const state = usabilityOf(item, context);
  if (state === 'unjudged') return null;
  if (state === 'usable') return 'Usable by this loadout';
  if (state === 'race-unknown') {
    return 'This character has no race set, so its race requirement was not checked';
  }
  return 'This loadout cannot equip it';
}

/**
 * The era badge, and only when the era is actually known.
 *
 * A missing era used to render as `ERA UNKNOWN` in an amber outlined badge —
 * the loudest treatment in the row, spent on the absence of data. Amber is
 * reserved for real era/phase labels (§A6); a null is simply absent.
 */
export function eraLabel(item: Item): string | null {
  return item.era ? item.era : null;
}

const FLAG_LABELS: Record<string, string> = {
  MAGIC: 'Magic',
  LORE: 'Lore',
  LORE_ITEM: 'Lore',
  NO_DROP: 'No Drop',
  NO_TRADE: 'No Trade',
  TEMPORARY: 'Temporary',
  QUEST: 'Quest',
  EXPENDABLE: 'Expendable',
  ATTUNEABLE: 'Attuneable',
  NO_RENT: 'No Rent',
  ARTIFACT: 'Artifact',
  LORE_EQUIPPED: 'Lore',
  PLACEABLE: 'Placeable',
  FIXTURE: 'Fixture',
};

export function flagLabel(flag: string): string {
  return FLAG_LABELS[flag] ?? flag.replace(/_/g, ' ').toLowerCase();
}

/**
 * Flags as they should be shown: de-duplicated by label.
 *
 * `LORE` and `LORE_EQUIPPED` are both "Lore" to a reader and used to render as
 * two adjacent identical-looking tags on the same row.
 */
export function displayFlags(flags: readonly string[]): string[] {
  const out: string[] = [];
  for (const flag of flags) {
    const label = flagLabel(flag);
    if (!out.includes(label)) out.push(label);
  }
  return out;
}

/* ------------------------------------------------------- source provenance */

/**
 * The two provenance marks, as any surface should render them.
 *
 * `research/DESIGN-EQLSOURCE.md` describes the device: a 2px accent rule on a
 * card's top edge, colour-coded by tier standing, plus a mono eyebrow naming
 * that tier — `TIER M · STRONGEST`. `styles.css` §23 implements it as
 * `[data-standing]`. What it lacked was data: the standing was derived in one
 * component from an 18-name list, so the device could reach 15 of 3,533 items
 * and only inside a hover window.
 *
 * The pipeline now records a standing for **every** record, so these two
 * functions are pure lookups over shipped facts. Neither infers anything. Put
 * `band` on `data-standing` and `label` in the eyebrow, on any surface.
 *
 * The band names are the ones the stylesheet already knows, and the mapping to
 * them is the design doc's own table: tiers M/1/2 read as trusted sage, 3/4 as
 * corroborating steel, 5 as the single brick red the doc says to spend exactly
 * once. `unattributed` is not in that table because it is not a tier — it takes
 * the stylesheet's neutral rule, which is the correct amount of colour for "no
 * claim is being made here".
 */
export type StandingBand = 'trusted' | 'corroborating' | 'distrust' | 'unattributed';

export interface StandingMark {
  standing: SourceStanding;
  band: StandingBand;
  /** Eyebrow text. Rendered uppercase by the stylesheet. */
  label: string;
  /**
   * The tier alone, for a surface with no room for the eyebrow — a table cell,
   * a chip beside an item name. Still a statement: `Unattributed` is a word,
   * not a dash, because a dash is the silence this field exists to end.
   */
  short: string;
  /** The capture that confirmed it, on a `tier-M` row. */
  citation?: string;
  /** Stat keys a client window actually checked, on a `tier-M` row. */
  verifiedFields?: string[];
}

const STANDING_BANDS: Record<SourceStanding, StandingBand> = {
  'tier-M': 'trusted',
  'tier-2': 'trusted',
  'tier-5': 'distrust',
  unattributed: 'unattributed',
};

const STANDING_LABELS: Record<SourceStanding, string> = {
  // Scoped to what the captures cover. "Stats read off the client" is a claim
  // about this row's numbers; it is not a claim about the item's flags, which
  // the client contradicts on this very item.
  'tier-M': 'Tier M · stats read off the client',
  'tier-2': 'Tier 2 · structured wiki data',
  // Not "Kunark" and not "unknown era": the reader needs to know the *numbers*
  // are the thing that cannot be placed, because they are what is on screen.
  'tier-5': 'Tier 5 · wiki stats, era unplaced',
  /*
   * NOT "Unattributed", and the word is the whole defect.
   *
   * The wire value stays `unattributed` — `bis-contract.ts` names it as a
   * confidence input E reads, so changing it is a contract break — but no
   * reader ever sees the wire value. They see this, and "Unattributed" means
   * "unsourced" to anyone outside this pipeline.
   *
   * It misled a reader for real, which is why this changed. On 3 September the
   * Director put "42% of the catalogue carries no source standing" in front of
   * the owner as a sourcing failure, four days from a launch. The field was
   * right and the reading was wrong, and the word is why: the bucket holds rows
   * that print no SCOREABLE numbers — reagents, potions, spell scrolls, food —
   * and every row that does print one states its source, in this build and the
   * one before it, 100.00% both times.
   *
   * The test the new wording has to pass: a reader who sees only this label
   * must not be able to conclude the catalogue is 42% unsourced.
   */
  unattributed: 'No scoreable stats · nothing to attribute',
};

const STANDING_SHORT: Record<SourceStanding, string> = {
  'tier-M': 'Tier M',
  'tier-2': 'Tier 2',
  'tier-5': 'Tier 5',
  // Still a word rather than a dash — a dash is the silence this field exists
  // to end — but a word that says what is absent rather than what failed.
  unattributed: 'No stats',
};

/**
 * Where this item's numbers stand. Never null: an item with no recorded
 * standing is `unattributed`, which is a statement rather than a silence, and
 * silence is what the standard's rule 5 exists to remove.
 */
export function sourceStanding(item: Item): StandingMark {
  const standing: SourceStanding = item.sd ?? 'unattributed';
  const mark: StandingMark = {
    standing,
    band: STANDING_BANDS[standing],
    // A record that withholds numbers it knows exist is saying something
    // sharper than "we have none", and the browser's own `NO STAT DATA` tag is
    // the same fact. Say the sharper thing where it is true.
    label: standing === 'unattributed' && item.statsUnknown
      ? 'Stats withheld · known item, numbers not published'
      : STANDING_LABELS[standing],
    short: STANDING_SHORT[standing],
  };
  if (item.sdc) mark.citation = item.sdc;
  if (item.vf?.length) mark.verifiedFields = item.vf;
  return mark;
}

export interface ExistenceMark {
  evidence: ExistenceEvidence;
  label: string;
}

const EXISTENCE_LABELS: Record<ExistenceEvidence, string> = {
  // Every one of these is about the item EXISTING, never about its numbers. The
  // strongest is a drop somebody watched happen; the export only proves a
  // character holds the thing; the report has no artefact behind it at all.
  'measured-drop': 'Tier M · seen dropping in game',
  'live-export': 'Tier M · held in a live inventory',
  'eqlsource-id': 'Tier M · in the EQL Source ID table',
  'player-report': 'Tier M · named in a player report',
};

/**
 * Whether the game is known to hold this item — the second, independent fact.
 * Null where there is no sighting: the item ships on its era, and saying so
 * would be a claim about content, not about this item.
 */
export function existenceMark(item: Item): ExistenceMark | null {
  if (!item.ex) return null;
  return { evidence: item.ex, label: EXISTENCE_LABELS[item.ex] };
}

/** Did a live client window confirm this particular stat key on this item? */
export function isStatClientVerified(item: Item, statKey: string): boolean {
  return item.sd === 'tier-M' && (item.vf ?? []).includes(statKey);
}

export function sourceSummary(item: Item): string | null {
  const src = item.src;
  if (!src) return null;
  const parts: string[] = [];
  if (src.z?.length) parts.push(src.z.slice(0, 2).join(', '));
  if (src.m?.length) parts.push(src.m.slice(0, 2).join(', '));
  if (src.q?.length) parts.push(`Quest: ${src.q[0]}`);
  if (src.v?.length) parts.push(`Vendor: ${src.v[0]}`);
  if (src.c) parts.push('Crafted');
  return parts.length ? parts.join(' · ') : null;
}
