/** Shared shapes for the shipped item catalog and for planner state. */

import type { UpgradeState } from './upgrade';

/** Effect attached to an item, typed by the socket it can fill. */
export interface ItemEffect {
  k: string;
  n: string;
  d?: string;
}

export interface WeaponData {
  dmg: number;
  dly: number;
  skill?: string;
  bonus?: number;
  range?: number;
}

export interface ItemSource {
  z?: string[];
  m?: string[];
  q?: string[];
  v?: string[];
  c?: boolean;
}

/**
 * Where the numbers printed on an item's row came from, per
 * `research/SOURCING-STANDARD.md`. Computed once by the pipeline and shipped on
 * every record — see `meta.sourceStanding` in the payload for the contract.
 *
 *   `tier-M`        read off a live client window and in agreement with what
 *                   ships, field for field. `vf` names the fields checked.
 *   `tier-2`        structured wiki data for an item whose era places it inside
 *                   this game.
 *   `tier-5`        wiki numbers with no era that places them here. The item is
 *                   in the catalog on Tier M *existence* evidence alone, so the
 *                   stat block may describe an original-EverQuest item of the
 *                   same name. The standard says: mark on sight.
 *   `unattributed`  the row prints no sourced stat values — it never had any,
 *                   or they are withheld. Stated rather than left blank.
 *
 * Tiers 1, 3 and 4 do not occur: no patch note, community guide or aggregator
 * supplies an item stat in this project.
 */
export type SourceStanding = 'tier-M' | 'tier-2' | 'tier-5' | 'unattributed';

/**
 * Whether the game is known to hold this item, which is a **different fact**
 * from where its numbers came from and rests on different files. The live
 * `/outputfile inventory` export is a `Location / Name / ID / Count / Slots`
 * table: it proves an item exists and carries no stat values at all.
 */
/**
 * How we know the item is in the game, strongest first.
 *
 *   `measured-drop`  a mob was watched dropping it, in EQL Source's parsed
 *                    combat logs (`sightings.v1.json`). The game produced it.
 *   `live-export`    it appears in a `/outputfile inventory` dump held in this
 *                    repository. Somebody holds it.
 *   `eqlsource-id`   it appears in EQL Source's published name-to-game-ID table
 *                    (`items.v1.json`), built from inventory dumps across more
 *                    characters than this repo's single export.
 *   `player-report`  the owner said so. The weakest Tier M evidence, and the
 *                    only one with no artefact behind it.
 *
 * All four are Tier M under `research/SOURCING-STANDARD.md`, and none of them
 * says anything whatsoever about the item's stats — that is `SourceStanding`.
 */
export type ExistenceEvidence =
  | 'measured-drop'
  | 'live-export'
  | 'eqlsource-id'
  | 'player-report';

/**
 * How far the survey behind a drop zone has got, as `zones.v1.json` reports it.
 *
 * A drop row that names a zone and says nothing about how well that zone is
 * known reads as a complete answer. Only zones with a published survey record
 * carry one of these; an unsurveyed zone is simply absent, never a zero.
 */
export interface ZoneSurvey {
  /** The zone string as a combat log spells it — "Nagafen's Lair - Group". */
  zone: string;
  slug: string;
  /** The zone's own name, without the log's difficulty suffix. */
  title: string;
  /** `partial` or `full`, in the publisher's vocabulary. */
  survey: string;
  /** Facets measured from logs, out of `facets` a full survey would hold. */
  measured: number;
  facets: number;
}

/**
 * One mob measured dropping one item.
 *
 * **A COUNT, NEVER A RATE.** That is the publisher's own first rule for
 * `sightings.v1.json` and it is this project's rule independently: `seen` and
 * `sessions` are the evidence behind a row, not a published finding. Nothing
 * anywhere may divide one of these by the other, or by anything else, and no
 * percentage may be derived from them. A drop seen once is seen once.
 */
export interface MeasuredDrop {
  /** The mob, named as the log named it. */
  mob: string;
  /** How many times the drop was seen. A count. */
  seen: number;
  /** How many dated sessions those sightings came from. A count. */
  sessions: number;
  /** Zone strings the sessions ran in. */
  zones?: string[];
  /** The survey behind each of those zones, where one is published. */
  zs?: ZoneSurvey[];
  /** First and last session date, as published — "10 Aug 2026". */
  first?: string;
  last?: string;
  /**
   * The mob was named by the log rather than by a survey roster we had already
   * written. It is no less measured; it is less expected.
   */
  offRoster?: boolean;
}

/**
 * One catalog entry. Short keys keep the shipped payload small; the accessors
 * below are the only place that shortness leaks into application code.
 */
export interface Item {
  id: number | null;
  n: string;
  ic?: number;
  sl: string[];
  cl: string[];
  ra: string[];
  st: Record<string, number>;
  sv: Record<string, number>;
  wp?: WeaponData;
  fx?: ItemEffect[];
  fl: string[];
  /** Required level, where the corpus carries one. Absent means unrestricted. */
  rl?: number;
  wt?: number;
  sz?: string;
  era?: string | null;
  av: boolean;
  eraUnknown?: boolean;
  /**
   * The item is confirmed to exist in the game and **no source carries its
   * stats**. Set only by the pipeline's Tier 0 table, never inferred.
   *
   * This is the stats-side twin of `eraUnknown`: a positive statement that the
   * record is incomplete, as opposed to an item that simply has no stats to
   * carry (food, a container, a quest turn-in), which ships with an empty `st`
   * and no marker. Nothing may score, rank, recommend or auto-fill one of
   * these — its absent stats are unknown, not zero, and scoring it as zero
   * would put a fabricated comparison next to real ones.
   */
  statsUnknown?: boolean;
  /** Why we know a `statsUnknown` item exists, in the reader's own words. */
  evidence?: string;
  /**
   * Tier M evidence that the game holds this item. Absent means no sighting —
   * the item ships because its era places it in this game, which is a Tier 2
   * statement about content rather than an observation of the item.
   */
  ex?: ExistenceEvidence;
  /** Standing of the numbers on this row. Absent is read as `unattributed`. */
  sd?: SourceStanding;
  /** Citation for a `tier-M` row: the client capture that confirmed it. */
  sdc?: string;
  /**
   * The stat keys a client window actually confirmed, on a `tier-M` row.
   *
   * A narrower claim than "this item's stats are verified": the Earthshaker
   * captures cover DMG, DLY, STR and STA, and say nothing about its DEX. A stat
   * row can mark itself from this; a whole-item mark cannot.
   */
  vf?: string[];
  src?: ItemSource;
  /**
   * Measured drop sources — EQL Source's parsed combat logs, attached by the
   * pipeline from `sightings.v1.json`, sorted by `seen` descending.
   *
   * Deliberately **not** merged into `src`. `src` is the wiki's account of
   * where an item comes from; this is a record of the game producing it, on
   * dated sessions, parsed rather than remembered. Merging them would launder
   * one into the other, and the whole point of Tier M is that it is a
   * different class of claim.
   */
  ms?: MeasuredDrop[];
  /** Set when stats were recovered by text-parsing rather than structured data. */
  parsed?: string;
}

/** An item as placed in a gear set, at a chosen upgrade level. */
export interface EquippedItem {
  itemName: string;
  upgrade: UpgradeState;
  /** Exaltation donors by socket kind. */
  exaltations?: Partial<Record<string, string>>;
}

export interface GearSet {
  id: string;
  name: string;
  characterId: string;
  /**
   * The loadout this plan is for. Optional: sets saved before loadouts were
   * tracked carry none and fall back to the character's active one.
   */
  loadoutId?: string;
  /** Position id (e.g. `EAR_1`, `ANY_2`) to equipped item. */
  slots: Record<string, EquippedItem | undefined>;
  /**
   * Positions an import found occupied but could not score, by item name.
   *
   * The importer refuses to equip an item with no published stats, because a
   * slot contributing zero to every total would show a complete-looking set
   * with the numbers of a naked head. That is right, but it leaves the position
   * indistinguishable from genuinely empty — and the upgrades ranking then
   * measured a candidate against nothing and reported the whole item as gain.
   * Recording the name keeps "wearing something we cannot measure" separate
   * from "wearing nothing".
   *
   * Optional: sets saved before this existed carry none, and read as empty
   * exactly as they did.
   */
  withheld?: Record<string, string>;
  /** Equivalency point weights, by stat key. */
  weights: Record<string, number>;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface CatalogMeta {
  version: number;
  generated: string;
  counts: Record<string, number>;
  attribution: string;
  sources?: unknown;
}
