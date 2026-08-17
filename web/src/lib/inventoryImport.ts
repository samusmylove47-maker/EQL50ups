/**
 * Reading the game's own `/outputfile inventory` export.
 *
 * EverQuest Legends' client writes a tab-separated dump of everything the
 * character is carrying. `research/validation/tier0-inventory-Avenrae.txt` is a
 * genuine one, and `research/validation/TIER0-VALIDATION.md` is where its
 * grammar was confirmed against the running client. This module turns that text
 * into a gear set.
 *
 * ## The grammar, as the client actually emits it
 *
 * ```
 * Location            Name                                   ID       Count  Slots
 * Any Slot            Nautilus Shield +6                     9404     1      10
 * Any Slot-Slot7      Selo`s Drums of the March (Exaltation) 11626    1      10
 * Ear                 Black Sapphire Electrum Earring +4     14701    1      10
 * Ear-Slot9           Fishbone Earring (Exaltation)          10313    1      10
 * General 1           Spacious Rucksack                      177751   1      24
 * General 1-Slot20    Nightmare Hide +5                      2333     1      10
 * Bank1-Slot3         Crystalline Spear +2                   11610    1      10
 * ```
 *
 * - **Worn positions are the bare location names.** `Ear`, `Wrist`, `Fingers`
 *   and `Any Slot` each appear twice, in position order: the first `Ear` row is
 *   Ear 1 and the second is Ear 2. Empty positions are still printed, so the
 *   ordering holds whether or not anything is in them.
 * - **`+N` is a suffix on the item name.** `Earthshaker +10` is the item
 *   `Earthshaker` at upgrade tier 10.
 * - **Exaltations are child rows** `<Location>-Slot<N>` whose names end in
 *   `(Exaltation)`. The sub-slot numbers are the ones in `EXALTATION_LADDER`:
 *   Slot2 Ornamentation, Slot7 Focus, Slot8 Click, Slot9 Worn, Slot10 Proc.
 *   Ornamentation is sometimes Slot1 instead — the client is inconsistent, the
 *   player asked us not to model the inconsistency, so both are accepted and
 *   nothing is inferred from which one showed up.
 * - **`Empty` carries no item** and is skipped.
 * - **`General N`, `BankN`, `SharedBankN`, `Held` and the trailing `KeyRing`
 *   section are the player's collection, not their equipped gear.** They are
 *   counted and reported, never imported. Roughly sixty of the keyring's
 *   Equipment entries are for classes the character cannot even use; importing
 *   them would poison every class filter in the app.
 *
 * ## Two rules this module will not break
 *
 * 1. **Never invent an item.** The join is by numeric id first and by exact
 *    (whitespace-normalised, case-insensitive) name second. There is no fuzzy
 *    matching, no nearest-neighbour, no "did you mean". A planner that quietly
 *    swaps one item for another is worse than one that reports a gap.
 * 2. **Never throw.** Whatever this is fed — an empty string, a spreadsheet, a
 *    JPEG renamed to `.txt` — it returns a result and says what it made of it.
 */

import { SLOT_POSITIONS, type SlotPosition } from '../engine/constants';
import { EXALTATION_LADDER, type ExaltationKind } from '../engine/exaltation';
import type { EquippedItem, Item } from '../engine/types';
import { clampTier, type UpgradeState } from '../engine/upgrade';

/* ------------------------------------------------------------- vocabulary */

/** Location names the client prints for worn positions, lowercased. */
const WORN_LOCATIONS: Record<string, string> = {
  'any slot': 'ANY',
  ear: 'EAR',
  head: 'HEAD',
  face: 'FACE',
  neck: 'NECK',
  shoulders: 'SHOULDERS',
  arms: 'ARMS',
  back: 'BACK',
  wrist: 'WRIST',
  range: 'RANGE',
  hands: 'HANDS',
  primary: 'PRIMARY',
  secondary: 'SECONDARY',
  fingers: 'FINGERS',
  chest: 'CHEST',
  legs: 'LEGS',
  feet: 'FEET',
  waist: 'WAIST',
  ammo: 'AMMO',
};

/**
 * Where a non-worn row lives, and what to call that place in a report.
 *
 * Tested against the location with all whitespace removed, so `General 1` and
 * `General1` are one case rather than two.
 */
const CONTAINERS: ReadonlyArray<{ test: RegExp; group: IgnoredGroupKey; label: string }> = [
  { test: /^general\d+$/, group: 'bag', label: 'Inventory bags' },
  { test: /^bank\d+$/, group: 'bank', label: 'Bank' },
  { test: /^sharedbank\d+$/, group: 'shared-bank', label: 'Shared bank' },
  { test: /^held$/, group: 'held', label: 'Held' },
  { test: /^(keyring|augmentation|activated|equipment)$/, group: 'keyring', label: 'Keyring' },
];

/** Sub-slot number to socket. Ornamentation answers to 1 and 2 alike. */
const SOCKET_BY_EXPORT_SLOT: ReadonlyMap<number, (typeof EXALTATION_LADDER)[number]> = (() => {
  const map = new Map<number, (typeof EXALTATION_LADDER)[number]>();
  for (const socket of EXALTATION_LADDER) map.set(socket.exportSlot, socket);
  const ornament = EXALTATION_LADDER.find((s) => s.kind === 'ornamentation');
  if (ornament) map.set(1, ornament);
  return map;
})();

/** Positions of one slot type, in the order the client prints them. */
const POSITIONS_BY_TYPE: ReadonlyMap<string, readonly SlotPosition[]> = (() => {
  const map = new Map<string, SlotPosition[]>();
  for (const position of SLOT_POSITIONS) {
    const bucket = map.get(position.type);
    if (bucket) bucket.push(position);
    else map.set(position.type, [position]);
  }
  return map;
})();

/**
 * How many lines are read before the parser gives up and says so.
 *
 * A real export is about a thousand rows. This exists only so that pasting a
 * hundred megabytes of something else cannot lock the tab up.
 */
export const MAX_ROWS = 50_000;

/* ------------------------------------------------------------------ shapes */

export type IgnoredGroupKey = 'bag' | 'bank' | 'shared-bank' | 'held' | 'keyring' | 'unknown';

/** A row that carried an item but is deliberately not equipped gear. */
export interface IgnoredRow {
  line: number;
  location: string;
  /** Name exactly as exported, `+N` suffix and all. */
  rawName: string;
  exportId: number | null;
  count: number;
  group: IgnoredGroupKey;
  /** Human label for the place it lives. */
  label: string;
}

export interface IgnoredGroup {
  key: IgnoredGroupKey;
  label: string;
  rows: number;
  /** Distinct item names within the group. */
  distinct: number;
  /** A few names, for a report that shows rather than asserts. */
  sample: string[];
}

/** One worn position that resolved to a catalog item. */
export interface ImportedPosition {
  positionId: string;
  positionLabel: string;
  /** Location string as exported, e.g. `Any Slot`. */
  location: string;
  line: number;
  /** Name exactly as exported, e.g. `Earthshaker +10`. */
  rawName: string;
  /** Name after the `+N` suffix is stripped — what was looked up. */
  exportName: string;
  /** The catalog's own spelling. Equal to `exportName` unless it drifted. */
  itemName: string;
  tier: number;
  exportId: number | null;
  matchedBy: 'id' | 'name';
  /** Set only when the catalog spells this item differently from the client. */
  renamedFrom?: string;
}

/** One exaltation donor that resolved, and the position it sits in. */
export interface ImportedExaltation {
  positionId: string;
  positionLabel: string;
  kind: ExaltationKind;
  socketLabel: string;
  exportSlot: number;
  line: number;
  rawName: string;
  exportName: string;
  donorName: string;
  exportId: number | null;
  matchedBy: 'id' | 'name';
  renamedFrom?: string;
}

/** Something the file named that this build cannot place. Never dropped quietly. */
export interface UnmatchedEntry {
  kind: 'item' | 'exaltation';
  positionId: string;
  positionLabel: string;
  /** Present for exaltations: which socket the donor was in. */
  socketLabel?: string;
  line: number;
  rawName: string;
  exportName: string;
  tier: number;
  exportId: number | null;
  reason: string;
}

export interface InventoryImport {
  /** Worn positions that resolved, ready to equip at their exported tier. */
  positions: ImportedPosition[];
  /** Exaltation donors that resolved, keyed to their host position. */
  exaltations: ImportedExaltation[];
  /** Everything the file named that could not be placed, with the reason. */
  unmatched: UnmatchedEntry[];
  /** Bag, bank and keyring rows — the collection, not the equipped set. */
  ignored: IgnoredRow[];
  /** Worn positions the export printed as empty. */
  empty: string[];
  /** Complaints about the file itself, rather than about one row. */
  notes: string[];
  /** False when the text does not look like an inventory export at all. */
  recognized: boolean;
  stats: {
    /** Non-blank, non-header rows seen. */
    rows: number;
    /** Rows addressed to a worn position, filled or empty, sub-slots included. */
    wornRows: number;
    /** Worn positions the export said were occupied. */
    filledPositions: number;
    /** Of those, how many resolved to a catalog item. */
    matchedPositions: number;
    /** Exaltation donor rows the export carried, in worn positions. */
    donorRows: number;
    matchedExaltations: number;
    /** Matches where the catalog's spelling differs from the client's. */
    renamed: number;
  };
}

/** The lookups the resolver needs. Both keys are exact — nothing is fuzzy. */
export interface InventoryCatalog {
  /** Lowercased item name to item. This is the catalog store's own index. */
  byName: ReadonlyMap<string, Item>;
  /** Numeric item id to item. Build one with `itemIdIndex`. */
  byId: ReadonlyMap<number, Item>;
}

/* ---------------------------------------------------------------- helpers */

/**
 * Index the catalog by the client's numeric item id.
 *
 * Only a few hundred of the corpus's items carry one — they were bound from
 * this very export — but an id is the only join key that survives a spelling
 * difference, so it is tried first.
 */
export function itemIdIndex(items: readonly Item[]): Map<number, Item> {
  const map = new Map<number, Item>();
  for (const item of items) {
    if (typeof item.id === 'number' && Number.isFinite(item.id) && !map.has(item.id)) {
      map.set(item.id, item);
    }
  }
  return map;
}

/** Collapse runs of whitespace. Not a fuzzy match — the same characters, tidied. */
function tidy(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/** Split `Earthshaker +10` into its catalog name and its upgrade tier. */
export function splitUpgradeSuffix(rawName: string): { name: string; tier: number } {
  const match = /^(.*\S)\s*\+(\d{1,2})$/.exec(tidy(rawName));
  if (!match?.[1]) return { name: tidy(rawName), tier: 0 };
  return { name: tidy(match[1]), tier: clampTier(Number(match[2])) };
}

/** Strip the client's `(Exaltation)` marker off a donor row's name. */
export function stripExaltationSuffix(rawName: string): { name: string; marked: boolean } {
  const tidied = tidy(rawName);
  const match = /^(.*\S)\s*\(Exaltation\)$/i.exec(tidied);
  if (!match?.[1]) return { name: tidied, marked: false };
  return { name: tidy(match[1]), marked: true };
}

function parseId(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const n = Number(raw.trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
}

function parseCount(raw: string | undefined): number {
  const n = Number((raw ?? '').trim());
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 1;
}

/** An `Empty` row, or one with no name at all. */
function isEmptyName(name: string): boolean {
  const t = name.trim();
  return t === '' || t.toLowerCase() === 'empty';
}

/**
 * The container a non-worn row lives in, with every level of nesting removed.
 *
 * Bags nest: an exaltation socketed into a sword sitting in bag six is
 * `General 6-Slot5-Slot10`, and a bank slot's sockets read `Bank16-Slot1-Slot7`.
 * Only the outermost name says where the thing is, so all the `-SlotN` groups
 * come off before the container is identified. Thirty-six rows of the real
 * Avenrae export are nested two deep; calling them "unrecognised" would have
 * been a lie about a format the client is perfectly consistent about.
 */
function containerBase(location: string): string {
  return location.replace(/(?:-Slot\d+)+$/i, '');
}

function containerFor(location: string): { group: IgnoredGroupKey; label: string } | undefined {
  const key = containerBase(location).toLowerCase().replace(/\s+/g, '');
  for (const entry of CONTAINERS) {
    if (entry.test.test(key)) return { group: entry.group, label: entry.label };
  }
  return undefined;
}

/* ----------------------------------------------------------------- parsing */

interface OpenPosition {
  position: SlotPosition;
  location: string;
  line: number;
  /** Null when the client printed the position as empty. */
  entry: ImportedPosition | null;
  /** Set when the row named an item this build could not resolve. */
  unresolved: UnmatchedEntry | null;
}

/**
 * Read an `/outputfile inventory` export and resolve it against the catalog.
 *
 * Total by construction: every branch produces a result, and the whole body is
 * guarded so that even a defect in here degrades to "nothing was read" rather
 * than a blank screen.
 */
export function readInventory(text: unknown, catalog: InventoryCatalog): InventoryImport {
  const result = emptyImport();
  try {
    parseInto(typeof text === 'string' ? text : String(text ?? ''), catalog, result);
  } catch (error) {
    result.notes.push(
      `The importer could not finish reading this file (${
        error instanceof Error ? error.message : String(error)
      }). Nothing was imported.`,
    );
    result.recognized = false;
    return emptyImport(result.notes);
  }
  return result;
}

function emptyImport(notes: string[] = []): InventoryImport {
  return {
    positions: [],
    exaltations: [],
    unmatched: [],
    ignored: [],
    empty: [],
    notes,
    recognized: false,
    stats: {
      rows: 0,
      wornRows: 0,
      filledPositions: 0,
      matchedPositions: 0,
      donorRows: 0,
      matchedExaltations: 0,
      renamed: 0,
    },
  };
}

function parseInto(text: string, catalog: InventoryCatalog, out: InventoryImport): void {
  // Strip a BOM; accept CRLF, LF and lone CR alike. The client writes CRLF and
  // chat clients love to rewrite it.
  const lines = text.replace(/^﻿/, '').split(/\r\n|\n|\r/);
  if (lines.length > MAX_ROWS) {
    out.notes.push(
      `That text is ${lines.length.toLocaleString()} lines long; only the first ${MAX_ROWS.toLocaleString()} were read.`,
    );
    lines.length = MAX_ROWS;
  }

  /** How many rows of each worn location have been seen, empty ones included. */
  const seen = new Map<string, number>();
  /** The most recent bare row per location, so its `-SlotN` children find it. */
  const open = new Map<string, OpenPosition>();
  const claimed = new Map<string, OpenPosition>();
  let sawHeader = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (!line.trim()) continue;

    const columns = line.split('\t');
    const location = tidy(columns[0] ?? '');
    const rawName = (columns[1] ?? '').trim();
    if (!location) continue;

    // Header rows: the first one, and the second that introduces the keyring.
    if (rawName === 'Name' && (location === 'Location' || containerFor(location))) {
      sawHeader = true;
      continue;
    }

    out.stats.rows++;

    const sub = /^(.*)-Slot(\d+)$/.exec(location);
    const base = sub?.[1] ? tidy(sub[1]) : location;
    const subSlot = sub ? Number(sub[2]) : null;
    const wornType = WORN_LOCATIONS[base.toLowerCase()];

    if (!wornType) {
      const container = containerFor(base);
      if (isEmptyName(rawName)) continue;
      out.ignored.push({
        line: i + 1,
        location,
        rawName,
        exportId: parseId(columns[2]),
        count: parseCount(columns[3]),
        group: container?.group ?? 'unknown',
        label: container?.label ?? 'Unrecognised location',
      });
      continue;
    }

    out.stats.wornRows++;
    const exportId = parseId(columns[2]);

    if (subSlot === null) {
      // A bare worn row opens a position. The counter advances whether or not
      // anything is in it, because that is what keeps "the second Ear row is
      // Ear 2" true for a character with one earring.
      const index = seen.get(wornType) ?? 0;
      seen.set(wornType, index + 1);
      const position = POSITIONS_BY_TYPE.get(wornType)?.[index];
      if (!position) {
        if (!isEmptyName(rawName)) {
          out.ignored.push({
            line: i + 1,
            location,
            rawName,
            exportId,
            count: parseCount(columns[3]),
            group: 'unknown',
            label: `More "${base}" rows than this game has ${base} positions`,
          });
        }
        open.delete(base.toLowerCase());
        continue;
      }

      const slot: OpenPosition = {
        position,
        location,
        line: i + 1,
        entry: null,
        unresolved: null,
      };
      open.set(base.toLowerCase(), slot);
      claimed.set(position.id, slot);

      if (isEmptyName(rawName)) {
        out.empty.push(position.id);
        continue;
      }

      out.stats.filledPositions++;
      const { name, tier } = splitUpgradeSuffix(rawName);
      const match = resolve(name, exportId, catalog);
      if (!match) {
        const entry: UnmatchedEntry = {
          kind: 'item',
          positionId: position.id,
          positionLabel: position.label,
          line: i + 1,
          rawName,
          exportName: name,
          tier,
          exportId,
          reason: reasonFor(exportId),
        };
        slot.unresolved = entry;
        out.unmatched.push(entry);
        continue;
      }

      const entry: ImportedPosition = {
        positionId: position.id,
        positionLabel: position.label,
        location,
        line: i + 1,
        rawName,
        exportName: name,
        itemName: match.item.n,
        tier,
        exportId,
        matchedBy: match.by,
      };
      if (match.item.n.toLowerCase() !== name.toLowerCase()) {
        entry.renamedFrom = name;
        out.stats.renamed++;
      }
      slot.entry = entry;
      out.positions.push(entry);
      out.stats.matchedPositions++;
      continue;
    }

    /* ------ a `-SlotN` child row: an exaltation on the position above it ---- */

    if (isEmptyName(rawName)) continue;
    out.stats.donorRows++;

    const host = open.get(base.toLowerCase());
    const socket = SOCKET_BY_EXPORT_SLOT.get(subSlot);
    const { name: donorName } = stripExaltationSuffix(rawName);
    const { name: bareName } = splitUpgradeSuffix(donorName);

    if (!host) {
      out.unmatched.push({
        kind: 'exaltation',
        positionId: '',
        positionLabel: base,
        socketLabel: `Slot ${subSlot}`,
        line: i + 1,
        rawName,
        exportName: bareName,
        tier: 0,
        exportId,
        reason: `no ${base} row came before it, so there is nothing to socket it into`,
      });
      continue;
    }

    if (!socket) {
      out.unmatched.push({
        kind: 'exaltation',
        positionId: host.position.id,
        positionLabel: host.position.label,
        socketLabel: `Slot ${subSlot}`,
        line: i + 1,
        rawName,
        exportName: bareName,
        tier: 0,
        exportId,
        reason: `sub-slot ${subSlot} is not one of this game's exaltation sockets`,
      });
      continue;
    }

    if (!host.entry) {
      out.unmatched.push({
        kind: 'exaltation',
        positionId: host.position.id,
        positionLabel: host.position.label,
        socketLabel: socket.label,
        line: i + 1,
        rawName,
        exportName: bareName,
        tier: 0,
        exportId,
        reason: host.unresolved
          ? `its host item, ${host.unresolved.exportName}, is not in the catalog`
          : `the ${host.position.label} position is empty in this export`,
      });
      continue;
    }

    const match = resolve(bareName, exportId, catalog);
    if (!match) {
      out.unmatched.push({
        kind: 'exaltation',
        positionId: host.position.id,
        positionLabel: host.position.label,
        socketLabel: socket.label,
        line: i + 1,
        rawName,
        exportName: bareName,
        tier: 0,
        exportId,
        reason: reasonFor(exportId),
      });
      continue;
    }

    const donor: ImportedExaltation = {
      positionId: host.position.id,
      positionLabel: host.position.label,
      kind: socket.kind,
      socketLabel: socket.label,
      exportSlot: subSlot,
      line: i + 1,
      rawName,
      exportName: bareName,
      donorName: match.item.n,
      exportId,
      matchedBy: match.by,
    };
    if (match.item.n.toLowerCase() !== bareName.toLowerCase()) {
      donor.renamedFrom = bareName;
      out.stats.renamed++;
    }
    out.exaltations.push(donor);
    out.stats.matchedExaltations++;
  }

  out.recognized = sawHeader || out.stats.wornRows > 0;
  if (!out.recognized) {
    out.notes.push(
      'This does not look like an `/outputfile inventory` export — no header row and no worn positions were found.',
    );
    return;
  }

  // Positions the export never mentioned. A real export prints all 23, so this
  // is worth saying out loud rather than letting the reader count.
  const missing = SLOT_POSITIONS.filter((p) => !claimed.has(p.id));
  if (missing.length && missing.length < SLOT_POSITIONS.length) {
    out.notes.push(
      `The export did not list ${missing.length} worn position${missing.length === 1 ? '' : 's'} (${missing
        .map((p) => p.label)
        .join(', ')}); ${missing.length === 1 ? 'it is' : 'they are'} left untouched.`,
    );
  }
}

interface Match {
  item: Item;
  by: 'id' | 'name';
}

/**
 * Join one exported row to the catalog: id first, exact name second, nothing
 * third. There is deliberately no fallback beyond these two.
 */
function resolve(name: string, exportId: number | null, catalog: InventoryCatalog): Match | null {
  if (exportId !== null) {
    const byId = catalog.byId.get(exportId);
    if (byId) return { item: byId, by: 'id' };
  }
  const byName = catalog.byName.get(name.toLowerCase());
  if (byName) return { item: byName, by: 'name' };
  return null;
}

function reasonFor(exportId: number | null): string {
  return exportId === null
    ? 'no item of that name is in the catalog, and the export carried no item id to join on'
    : `no item of that name or id (${exportId}) is in the catalog`;
}

/* --------------------------------------------------------------- reporting */

/** Group the ignored rows for a report that names places rather than rows. */
export function summarizeIgnored(ignored: readonly IgnoredRow[]): IgnoredGroup[] {
  const order: IgnoredGroupKey[] = ['bag', 'bank', 'shared-bank', 'keyring', 'held', 'unknown'];
  const groups = new Map<IgnoredGroupKey, { label: string; rows: number; names: Set<string> }>();
  for (const row of ignored) {
    const bucket = groups.get(row.group) ?? { label: row.label, rows: 0, names: new Set<string>() };
    bucket.rows++;
    bucket.names.add(row.rawName);
    groups.set(row.group, bucket);
  }
  return order
    .filter((key) => groups.has(key))
    .map((key) => {
      const bucket = groups.get(key) as { label: string; rows: number; names: Set<string> };
      return {
        key,
        label: bucket.label,
        rows: bucket.rows,
        distinct: bucket.names.size,
        sample: [...bucket.names].slice(0, 4),
      };
    });
}

/** One sentence covering both what came in and what did not. */
export function summarizeImport(result: InventoryImport): string {
  if (!result.recognized) {
    return (
      result.notes[0] ??
      'This does not look like an `/outputfile inventory` export, so nothing was read.'
    );
  }
  const { matchedPositions, filledPositions, matchedExaltations } = result.stats;
  const head =
    `${matchedPositions} of ${filledPositions} worn item${filledPositions === 1 ? '' : 's'}` +
    (matchedExaltations
      ? ` and ${matchedExaltations} exaltation donor${matchedExaltations === 1 ? '' : 's'}`
      : '') +
    ' matched the catalog.';
  const tail: string[] = [];
  if (result.unmatched.length) {
    tail.push(
      `${result.unmatched.length} entr${result.unmatched.length === 1 ? 'y' : 'ies'} could not be matched and ${
        result.unmatched.length === 1 ? 'is' : 'are'
      } listed below.`,
    );
  }
  if (result.ignored.length) {
    tail.push(
      `${result.ignored.length} bag, bank and keyring row${result.ignored.length === 1 ? '' : 's'} were skipped — they are your collection, not your equipped gear.`,
    );
  }
  return [head, ...tail].join(' ');
}

/* ---------------------------------------------------------------- applying */

/** The slot map this import would write, keyed by paper-doll position id. */
export function toSlotMap(result: InventoryImport): Record<string, EquippedItem> {
  const slots: Record<string, EquippedItem> = {};
  for (const entry of result.positions) {
    const upgrade: UpgradeState = { full: clampTier(entry.tier), fraction: 0 };
    slots[entry.positionId] = { itemName: entry.itemName, upgrade };
  }
  for (const donor of result.exaltations) {
    const host = slots[donor.positionId];
    if (!host) continue;
    const exaltations = { ...(host.exaltations ?? {}) };
    exaltations[donor.kind] = donor.donorName;
    slots[donor.positionId] = { ...host, exaltations };
  }
  return slots;
}

/** Name for the set an import creates, kept distinct from its siblings. */
export function importedSetName(existing: readonly string[]): string {
  const base = 'In-game gear';
  const taken = new Set(existing.map((n) => n.trim().toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;
  for (let n = 2; n < 1000; n++) {
    const candidate = `${base} ${n}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  return base;
}

/** Donors landing on one position, for the preview table. */
export function exaltationsByPosition(
  result: InventoryImport,
): Map<string, ImportedExaltation[]> {
  const map = new Map<string, ImportedExaltation[]>();
  for (const donor of result.exaltations) {
    const bucket = map.get(donor.positionId);
    if (bucket) bucket.push(donor);
    else map.set(donor.positionId, [donor]);
  }
  return map;
}

/** Positions in paper-doll order rather than export order, for the preview. */
export function positionsInDollOrder(result: InventoryImport): ImportedPosition[] {
  const rank = new Map(SLOT_POSITIONS.map((p, i) => [p.id, i]));
  return [...result.positions].sort(
    (a, b) => (rank.get(a.positionId) ?? 0) - (rank.get(b.positionId) ?? 0),
  );
}
