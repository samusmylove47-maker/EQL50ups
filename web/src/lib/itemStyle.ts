/**
 * Item presentation rules: the colour an item's name takes, and the labels
 * that ride alongside it.
 *
 * EQ has no WoW-style quality tiers, so the closest honest analogue is the
 * content era an item comes from — later era, richer colour — with anything
 * not yet live in the pre-Kunark game shown in amber, matching the reference
 * spec's use of amber for era/phase labels.
 */

import { ERA_ORDER, isEraLive } from '../engine/constants';
import type { Item } from '../engine/types';

export type Quality = 'common' | 'uncommon' | 'rare' | 'epic' | 'locked';

export function isLive(item: Item): boolean {
  return item.av !== false && isEraLive(item.era);
}

export function qualityOf(item: Item): Quality {
  if (!isLive(item)) return 'locked';
  const index = item.era ? ERA_ORDER.indexOf(item.era as (typeof ERA_ORDER)[number]) : -1;
  if (index < 0) return 'common';
  if (index >= 5) return 'epic';
  if (index >= 3) return 'rare';
  if (index >= 1) return 'uncommon';
  return 'common';
}

export function qualityColor(item: Item): string {
  return `var(--q-${qualityOf(item)})`;
}

export function eraLabel(item: Item): string | null {
  if (item.era) return item.era;
  if (item.eraUnknown) return 'Era unknown';
  return null;
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
  LORE_EQUIPPED: 'Lore Equipped',
  PLACEABLE: 'Placeable',
  FIXTURE: 'Fixture',
};

export function flagLabel(flag: string): string {
  return FLAG_LABELS[flag] ?? flag.replace(/_/g, ' ').toLowerCase();
}

/** Short, stable initials for the icon tile when no artwork is available. */
export function itemInitials(name: string): string {
  const words = name.replace(/^\[[^\]]*\]\s*/, '').split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] ?? '?';
  const second = words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : (words[0]?.[1] ?? '');
  return (first + second).toUpperCase();
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
