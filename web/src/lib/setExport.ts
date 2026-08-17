/**
 * Per-set JSON export and import.
 *
 * The whole-library dump answers "back up everything I have". The unit a sim, a
 * DPS calculator or a Discord bot actually wants is **one set** plus the
 * character it was planned against, which is what this emits.
 *
 * ## Schema — publish this, downstream tools may rely on it
 *
 * ```jsonc
 * {
 *   "format":     "eql-upgrades",   // required, exact; identifies the family
 *   "kind":       "set",            // "set" for this file, absent for a library dump
 *   "version":    2,                // state schema version; readers must refuse a higher one
 *   "exportedAt": "2026-08-17T09:12:04.113Z",
 *   "characters": [                 // exactly one for kind:"set" — the scoring context
 *     {
 *       "id":   "char_1a2b3c4d",
 *       "name": "Avenrae",
 *       "race": "Human" | null,
 *       "levels": { "BRD": 50, "WAR": 50, ... },        // all sixteen class codes
 *       "loadouts": [ { "id": "load_…", "name": "Main", "classes": ["BRD","WAR","BER"] } ],
 *       "activeLoadoutId": "load_…"
 *     }
 *   ],
 *   "sets": [                       // exactly one for kind:"set"
 *     {
 *       "id":          "set_9f8e7d6c",
 *       "characterId": "char_1a2b3c4d",   // must match a character above
 *       "name":        "Raid — Tank",
 *       "notes":       "optional free text",
 *       "slots": {                        // keyed by position id, see SLOT_POSITIONS
 *         "PRIMARY": {
 *           "itemName": "Earthshaker",
 *           "upgrade":  { "full": 7, "fraction": 2 },   // +7, 2 motes banked toward +8
 *           "exaltations": { "ornamentation": "Donor Item Name" }   // optional
 *         }
 *       },
 *       "weights":        { "AC": 2, "HP": 0.5, "STA": 1.2 },  // EP stat weights
 *       "defaultFilters": { "era": "any", "source": "any", "hideNoDrop": false },
 *       "createdAt": 1755400000000,
 *       "updatedAt": 1755400000000
 *     }
 *   ]
 * }
 * ```
 *
 * Position ids, weight keys and upgrade semantics are the ones in
 * `engine/constants.ts`, `engine/ep.ts` (`WEIGHTABLE_KEYS`) and
 * `engine/upgrade.ts`. Ids are file-local: an importer re-keys them, so two
 * exports of the same set never collide.
 *
 * Reading is **total and loud**: nothing here throws, and everything dropped is
 * named in `rejected` rather than disappearing. A file that is not one of ours
 * at all fails with an `error`; a file that is ours but carries junk imports the
 * good part and lists the rest.
 */

import { SLOT_POSITIONS } from '../engine/constants';
import { makeLevels, type Character } from '../engine/character';
import { MAX_TIER, normalizeState } from '../engine/upgrade';
import type { EquippedItem, GearSet } from '../engine/types';
import { STATE_VERSION, sanitizeState } from '../state/persistence';
import type { ExportEnvelope } from '../share/codec';
import { finite } from './format';
import { sanitizeFilters } from './setFilters';
import { slugify } from './download';

export const EXPORT_FORMAT = 'eql-upgrades';

/** A library dump carries no `kind`; a single-set file says so. */
export interface SetExportEnvelope extends ExportEnvelope {
  kind: 'set';
}

const POSITION_IDS = new Set(SLOT_POSITIONS.map((p) => p.id));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/* --------------------------------------------------------------- exporting */

/**
 * One set plus the character context it was planned against.
 *
 * The character travels because a set without it is unscoreable — eligibility,
 * per-class levels and the active loadout are all needed to reproduce the
 * numbers. When a set has somehow outlived its character, a placeholder is
 * synthesised so the file still imports rather than silently importing nothing.
 */
export function buildSetEnvelope(
  gearSet: GearSet,
  character: Character | undefined,
  now: Date = new Date(),
): SetExportEnvelope {
  const owner: Character = character ?? {
    id: gearSet.characterId,
    name: 'Unknown character',
    race: null,
    levels: makeLevels({}),
    loadouts: [{ id: `${gearSet.characterId}_loadout_1`, name: 'Main', classes: [] }],
    activeLoadoutId: `${gearSet.characterId}_loadout_1`,
  };
  return {
    format: EXPORT_FORMAT,
    kind: 'set',
    version: STATE_VERSION,
    exportedAt: now.toISOString(),
    characters: [{ ...owner }],
    sets: [{ ...gearSet, characterId: owner.id }],
  };
}

export function setExportFilename(gearSet: GearSet): string {
  return `eql-set-${slugify(gearSet.name)}.json`;
}

/* --------------------------------------------------------------- importing */

export interface EnvelopeReport {
  ok: boolean;
  /** Ready for `importEnvelope`, or null when the file could not be used. */
  envelope: ExportEnvelope | null;
  /** Why the whole file was refused. Empty when `ok`. */
  errors: string[];
  /** What survived import but had parts removed. Always worth showing. */
  rejected: string[];
  counts: { characters: number; sets: number; slots: number };
  /** True when the file declares itself a single-set export. */
  singleSet: boolean;
}

function fail(error: string): EnvelopeReport {
  return {
    ok: false,
    envelope: null,
    errors: [error],
    rejected: [],
    counts: { characters: 0, sets: 0, slots: 0 },
    singleSet: false,
  };
}

/**
 * Report on one raw set, and return the slots worth keeping.
 *
 * Reporting is separate from cleaning on purpose: `sanitizeState` is the app's
 * authority on what a valid set is, and re-implementing it here would give the
 * import path a second opinion. This walks the same input only to name what
 * that authority is about to drop.
 */
function inspectSet(raw: Record<string, unknown>, index: number, rejected: string[]): void {
  const where = typeof raw.name === 'string' && raw.name.trim() ? `"${raw.name}"` : `set ${index + 1}`;

  if (isRecord(raw.slots)) {
    for (const [position, value] of Object.entries(raw.slots)) {
      if (!POSITION_IDS.has(position)) {
        rejected.push(`${where}: unknown slot ${JSON.stringify(position)}`);
        continue;
      }
      if (!isRecord(value) || typeof value.itemName !== 'string' || !value.itemName) {
        rejected.push(`${where}: ${position} had no usable item name`);
        continue;
      }
      const upgrade = isRecord(value.upgrade) ? value.upgrade : {};
      const requested = finite(upgrade.full);
      const normalized = normalizeState({ full: requested, fraction: finite(upgrade.fraction) });
      if (requested !== normalized.full) {
        rejected.push(
          `${where}: ${position} upgrade +${requested} clamped to +${normalized.full} (range 0–${MAX_TIER})`,
        );
      }
      if (value.exaltations !== undefined && !isRecord(value.exaltations)) {
        rejected.push(`${where}: ${position} exaltations were not an object`);
      } else if (isRecord(value.exaltations)) {
        for (const [kind, donor] of Object.entries(value.exaltations)) {
          if (typeof donor !== 'string' || !donor) {
            rejected.push(`${where}: ${position} exaltation "${kind}" had no donor name`);
          }
        }
      }
    }
  } else if (raw.slots !== undefined) {
    rejected.push(`${where}: slots were not an object, so no items were imported`);
  }

  if (isRecord(raw.weights)) {
    for (const [key, value] of Object.entries(raw.weights)) {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        rejected.push(`${where}: weight ${key} was not a finite number`);
      }
    }
  } else if (raw.weights !== undefined) {
    rejected.push(`${where}: weights were not an object, so the set imports unscored`);
  }

  for (const note of sanitizeFilters(raw.defaultFilters).rejected) {
    rejected.push(`${where}: ${note}`);
  }
}

/** Strip slot keys that are not real positions, so nothing dead is stored. */
function pruneSlots(gearSet: GearSet): GearSet {
  const slots: Record<string, EquippedItem | undefined> = {};
  for (const [position, equipped] of Object.entries(gearSet.slots)) {
    if (POSITION_IDS.has(position) && equipped) slots[position] = equipped;
  }
  return { ...gearSet, slots };
}

/** Validate a parsed JSON value as an export envelope. Never throws. */
export function readEnvelope(raw: unknown): EnvelopeReport {
  // Arrays are objects, so the array case has to be taken first or a v1-style
  // positional tuple would be reported as "no format field".
  if (Array.isArray(raw)) {
    return fail('That file is a JSON array, not an EQL Upgrades export.');
  }
  if (!isRecord(raw)) {
    return fail('That file is not a JSON object, so it cannot be an EQL Upgrades export.');
  }
  if (raw.format !== EXPORT_FORMAT) {
    return fail(
      typeof raw.format === 'string'
        ? `That file declares format "${raw.format}"; this planner reads "${EXPORT_FORMAT}".`
        : 'That file is not an EQL Upgrades export — it carries no "format" field.',
    );
  }

  const version = typeof raw.version === 'number' ? raw.version : 0;
  if (version > STATE_VERSION) {
    return fail(
      `That file was written by a newer version of the planner (schema ${version}; this build reads ${STATE_VERSION}). Nothing was imported.`,
    );
  }

  if (!Array.isArray(raw.characters)) return fail('That export has no "characters" array.');
  if (!Array.isArray(raw.sets)) return fail('That export has no "sets" array.');

  const rejected: string[] = [];
  const characterIds = new Set<string>();
  raw.characters.forEach((entry, index) => {
    if (!isRecord(entry) || typeof entry.id !== 'string' || !entry.id) {
      rejected.push(`character ${index + 1} had no id and was dropped`);
      return;
    }
    characterIds.add(entry.id);
  });

  raw.sets.forEach((entry, index) => {
    if (!isRecord(entry)) {
      rejected.push(`set ${index + 1} was not an object and was dropped`);
      return;
    }
    if (typeof entry.id !== 'string' || !entry.id) {
      rejected.push(`set ${index + 1} had no id and was dropped`);
      return;
    }
    if (typeof entry.characterId !== 'string' || !characterIds.has(entry.characterId)) {
      rejected.push(
        `${typeof entry.name === 'string' && entry.name ? `"${entry.name}"` : `set ${index + 1}`}: no matching character in this file, so it was dropped`,
      );
      return;
    }
    inspectSet(entry, index, rejected);
  });

  const clean = sanitizeState({
    characters: raw.characters,
    sets: raw.sets,
    activeCharacterId: null,
  });
  if (!clean || (!clean.characters.length && !clean.sets.length)) {
    return {
      ...fail('Nothing in that file could be read as a character or a set.'),
      rejected,
    };
  }

  const sets = clean.sets.map(pruneSlots);
  const envelope: ExportEnvelope = {
    format: EXPORT_FORMAT,
    version: STATE_VERSION,
    exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : new Date().toISOString(),
    characters: clean.characters,
    sets,
  };

  return {
    ok: true,
    envelope,
    errors: [],
    rejected,
    counts: {
      characters: clean.characters.length,
      sets: sets.length,
      slots: sets.reduce((sum, s) => sum + Object.keys(s.slots).length, 0),
    },
    singleSet: raw.kind === 'set',
  };
}

/** Read the text of an uploaded file. Never throws; bad JSON is an error. */
export function readEnvelopeText(text: string): EnvelopeReport {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return fail('That file could not be read as JSON.');
  }
  return readEnvelope(parsed);
}

/** One sentence for a notice line, covering both the good and the dropped. */
export function summarizeReport(report: EnvelopeReport): string {
  if (!report.ok) return report.errors.join(' ');
  const { characters, sets, slots } = report.counts;
  const head =
    `Imported ${sets} set${sets === 1 ? '' : 's'} (${slots} equipped item${slots === 1 ? '' : 's'}) ` +
    `and ${characters} character${characters === 1 ? '' : 's'}.`;
  if (!report.rejected.length) return head;
  return `${head} ${report.rejected.length} thing${report.rejected.length === 1 ? '' : 's'} in the file could not be used.`;
}
