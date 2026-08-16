/**
 * Share-link codec.
 *
 * A set has to survive as a link with no server behind it, so the whole plan —
 * character trio, every equipped item name, every +N, every exaltation donor
 * and the full weight profile — is packed into the URL fragment.
 *
 * Wire format: a positional JSON tuple (keys cost bytes; positions do not),
 * UTF-8 encoded, then base64url. Item *names* are the item identity rather
 * than numeric ids, because the catalog is a community scrape whose ids can be
 * renumbered between builds while names are the thing players actually type.
 *
 *   [1, charName, level, race, "BRD/WAR/BER", setName,
 *    [[positionId, itemName, full, fraction, [[socketKind, donorName], ...]], ...],
 *    [[weightKey, weight], ...],
 *    notes]
 *
 * Decoding is total: any malformed payload yields `null` rather than throwing,
 * because the input is a URL a stranger pasted.
 */

import { SLOT_POSITIONS } from '../engine/constants';
import { normalizeState } from '../engine/upgrade';
import type { Character } from '../engine/character';
import type { EquippedItem, GearSet } from '../engine/types';
import { decodeText, encodeText } from '../lib/base64url';
import { finite } from '../lib/format';

export const SHARE_VERSION = 1;

export interface SharedPlan {
  character: Omit<Character, 'id'>;
  set: Pick<GearSet, 'name' | 'slots' | 'weights' | 'notes'>;
}

const POSITION_IDS: ReadonlySet<string> = new Set(SLOT_POSITIONS.map((p) => p.id));

type SocketTuple = [string, string];
type SlotTuple = [string, string, number, number] | [string, string, number, number, SocketTuple[]];
type WeightTuple = [string, number];
type PlanTuple = [
  number,
  string,
  number,
  string | null,
  string,
  string,
  SlotTuple[],
  WeightTuple[],
  string,
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Pack a plan into the compact positional tuple. */
export function toTuple(plan: SharedPlan): PlanTuple {
  const slots: SlotTuple[] = [];
  for (const position of SLOT_POSITIONS) {
    const equipped = plan.set.slots[position.id];
    if (!equipped?.itemName) continue;
    const state = normalizeState(equipped.upgrade);
    const sockets: SocketTuple[] = Object.entries(equipped.exaltations ?? {})
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1] !== '')
      .sort((a, b) => a[0].localeCompare(b[0]));
    slots.push(
      sockets.length
        ? [position.id, equipped.itemName, state.full, state.fraction, sockets]
        : [position.id, equipped.itemName, state.full, state.fraction],
    );
  }

  const weights: WeightTuple[] = Object.entries(plan.set.weights)
    .filter(([, v]) => Number.isFinite(v) && v !== 0)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => [k, v]);

  return [
    SHARE_VERSION,
    plan.character.name,
    plan.character.level,
    plan.character.race,
    plan.character.classes.join('/'),
    plan.set.name,
    slots,
    weights,
    plan.set.notes ?? '',
  ];
}

/** Unpack a tuple, sanitising every field. Returns null if unusable. */
export function fromTuple(raw: unknown): SharedPlan | null {
  if (!Array.isArray(raw) || raw.length < 7) return null;
  const [version, name, level, race, classes, setName, slotList, weightList, notes] = raw as [
    unknown, unknown, unknown, unknown, unknown, unknown, unknown, unknown, unknown,
  ];
  if (finite(version) !== SHARE_VERSION) return null;

  const slots: Record<string, EquippedItem | undefined> = {};
  if (Array.isArray(slotList)) {
    for (const entry of slotList) {
      if (!Array.isArray(entry)) continue;
      const [positionId, itemName, full, fraction, sockets] = entry as [
        unknown, unknown, unknown, unknown, unknown,
      ];
      if (typeof positionId !== 'string' || !POSITION_IDS.has(positionId)) continue;
      if (typeof itemName !== 'string' || itemName === '') continue;
      const equipped: EquippedItem = {
        itemName,
        upgrade: normalizeState({ full: finite(full), fraction: finite(fraction) }),
      };
      if (Array.isArray(sockets)) {
        const exaltations: Record<string, string> = {};
        for (const socket of sockets) {
          if (!Array.isArray(socket)) continue;
          const [kind, donor] = socket as [unknown, unknown];
          if (typeof kind === 'string' && typeof donor === 'string' && donor !== '') {
            exaltations[kind] = donor;
          }
        }
        if (Object.keys(exaltations).length) equipped.exaltations = exaltations;
      }
      slots[positionId] = equipped;
    }
  }

  const weights: Record<string, number> = {};
  if (Array.isArray(weightList)) {
    for (const entry of weightList) {
      if (!Array.isArray(entry)) continue;
      const [key, value] = entry as [unknown, unknown];
      if (typeof key !== 'string' || key === '') continue;
      if (typeof value !== 'number' || !Number.isFinite(value)) continue;
      weights[key] = value;
    }
  }

  const classList =
    typeof classes === 'string'
      ? classes.split('/').map((c) => c.trim().toUpperCase()).filter(Boolean).slice(0, 3)
      : [];

  const plan: SharedPlan = {
    character: {
      name: typeof name === 'string' && name.trim() ? name : 'Shared Character',
      level: Math.max(1, Math.min(255, Math.round(finite(level, 50)))),
      race: typeof race === 'string' && race !== '' ? race : null,
      classes: classList as Character['classes'],
    },
    set: {
      name: typeof setName === 'string' && setName.trim() ? setName : 'Shared Set',
      slots,
      weights,
    },
  };
  if (typeof notes === 'string' && notes !== '') plan.set.notes = notes;
  return plan;
}

/** Plan -> opaque URL-safe payload. */
export function encodePlan(plan: SharedPlan): string {
  return encodeText(JSON.stringify(toTuple(plan)));
}

/** Payload -> plan, or null for anything malformed. */
export function decodePlan(payload: string): SharedPlan | null {
  if (!payload) return null;
  try {
    const json = decodeText(payload);
    const parsed: unknown = JSON.parse(json);
    return fromTuple(parsed);
  } catch {
    return null;
  }
}

/** The hash a share link uses, e.g. `#/share/eyJ...`. */
export function shareHash(plan: SharedPlan): string {
  return `#/share/${encodePlan(plan)}`;
}

/** Absolute share URL for the current document, if there is one. */
export function shareUrl(plan: SharedPlan, origin?: string): string {
  const base =
    origin ??
    (typeof window === 'undefined'
      ? ''
      : `${window.location.origin}${window.location.pathname}${window.location.search}`);
  return `${base}${shareHash(plan)}`;
}

/** Build a shareable plan from live app state. */
export function planFrom(character: Character, set: GearSet): SharedPlan {
  const plan: SharedPlan = {
    character: {
      name: character.name,
      level: character.level,
      race: character.race,
      classes: [...character.classes],
    },
    set: { name: set.name, slots: { ...set.slots }, weights: { ...set.weights } },
  };
  if (set.notes) plan.set.notes = set.notes;
  return plan;
}

/**
 * Versioned export envelope, shared by the JSON download and the file import.
 * Kept structurally separate from the URL codec: exports favour readability,
 * links favour bytes.
 */
export interface ExportEnvelope {
  format: 'eql-upgrades';
  version: number;
  exportedAt: string;
  characters: Character[];
  sets: GearSet[];
}

export function isExportEnvelope(value: unknown): value is ExportEnvelope {
  return (
    isRecord(value) &&
    value.format === 'eql-upgrades' &&
    Array.isArray(value.characters) &&
    Array.isArray(value.sets)
  );
}
