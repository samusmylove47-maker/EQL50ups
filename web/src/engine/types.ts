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
  wt?: number;
  sz?: string;
  era?: string | null;
  av: boolean;
  eraUnknown?: boolean;
  src?: ItemSource;
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
  /** Position id (e.g. `EAR_1`, `ANY_2`) to equipped item. */
  slots: Record<string, EquippedItem | undefined>;
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
