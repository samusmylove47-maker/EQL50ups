/**
 * What a set's exaltations actually do.
 *
 * The client (Tier 0 §7) prints the donor item and the resulting effect as two
 * separate lines:
 *
 *     Focus Exaltation: Lute of the Gypsy Princess (Exaltation)
 *     Focus Effect:     String Resonance 11
 *
 * This module reproduces that pairing for a whole gear set, and enforces the
 * three rules the engine already knows: `canSocket` decides whether a donor may
 * go in at all, `intersectRestrictions` narrows the host's classes and slots
 * once it is in, and `dedupeByFamily` collapses a family to its highest rank.
 *
 * **What it deliberately does not do: score anything.** The shipped catalog
 * carries no numeric values for effects — `focus-effects.json` is names, prose
 * and per-spell-slot text — so no stat contribution is invented from them. An
 * exaltation is named and described here, never valued.
 */

import {
  EXALTATION_LADDER, EFFECT_KIND_TO_SOCKET, canSocket, dedupeByFamily,
  intersectRestrictions, parseEffectRank, socketsFor,
  type ExaltationKind, type ExaltationSocket,
} from '../engine/exaltation';
import { canUseClass, type LoadoutContext } from '../engine/character';
import { normalizeState, type UpgradeState } from '../engine/upgrade';
import type { Item, ItemEffect } from '../engine/types';
import type { CatalogState, FocusEffectEntry } from '../data/catalog';
import type { SlotView } from './gear';

export interface SocketView {
  socket: ExaltationSocket;
  unlocked: boolean;
  donorName: string | undefined;
  /** The donor resolved against the catalog, when it is loaded. */
  donor: Item | undefined;
  /** The effect the donor contributes into this socket kind. */
  effect: ItemEffect | undefined;
  /** Published prose for that effect, where the catalog has any. */
  description: FocusEffectEntry | undefined;
  /** False when the donor and host share no slot or no class. */
  legal: boolean;
  /** Set when a higher rank of the same family is socketed elsewhere. */
  supersededBy: string | undefined;
}

export interface ExaltedItem {
  positionId: string;
  positionLabel: string;
  item: Item;
  state: UpgradeState;
  sockets: SocketView[];
  filled: SocketView[];
  /** Unlocked sockets with nothing in them, ornamentation excluded. */
  openCount: number;
  /** The tier that would open the next socket, or null at the top of the ladder. */
  nextUnlockTier: number | null;
  /** Host restrictions after every legal donor has intersected onto them. */
  restricted: { classes: string[]; slots: string[] };
  lostClasses: string[];
  lostSlots: string[];
  /** True when narrowing leaves no class the active loadout can field. */
  blocksLoadout: boolean;
}

export interface ExaltationPlan {
  items: ExaltedItem[];
  /** Every socketed effect, deduped by family, in host order. */
  active: SocketView[];
  /** Effects that a higher rank of the same family displaces. */
  superseded: SocketView[];
  /** Donors that cannot legally sit where they are. */
  illegal: SocketView[];
  counts: {
    equipped: number;
    /** Items with at least one unlocked, fillable socket. */
    withSockets: number;
    filled: number;
    open: number;
  };
}

function effectFor(donor: Item | undefined, kind: ExaltationKind): ItemEffect | undefined {
  return donor?.fx?.find((fx) => EFFECT_KIND_TO_SOCKET[fx.k] === kind);
}

export function exaltationPlan(
  views: readonly SlotView[],
  catalog: Pick<CatalogState, 'byName' | 'effects'>,
  context?: LoadoutContext,
): ExaltationPlan {
  const items: ExaltedItem[] = [];
  const everySocket: SocketView[] = [];

  for (const view of views) {
    const item = view.item;
    if (!item || !view.equipped) continue;
    const state = normalizeState(view.equipped.upgrade);
    const unlocked = socketsFor(state);
    const unlockedKinds = new Set(unlocked.map((s) => s.kind));

    const sockets: SocketView[] = EXALTATION_LADDER.map((socket) => {
      const donorName = view.equipped?.exaltations?.[socket.kind];
      const donor = donorName ? catalog.byName.get(donorName.toLowerCase()) : undefined;
      const effect = effectFor(donor, socket.kind);
      return {
        socket,
        unlocked: unlockedKinds.has(socket.kind),
        donorName,
        donor,
        effect,
        description: effect ? catalog.effects.get(effect.n.toLowerCase()) : undefined,
        legal: donor
          ? canSocket({ classes: donor.cl, slots: donor.sl }, { classes: item.cl, slots: item.sl })
          : true,
        supersededBy: undefined,
      };
    });

    const filled = sockets.filter((s) => s.donorName && s.unlocked);
    everySocket.push(...filled);

    // Only donors that may legally be there narrow the host.
    const restricted = intersectRestrictions(
      { classes: item.cl, slots: item.sl },
      filled
        .filter((s) => s.legal && s.donor)
        .map((s) => ({ classes: (s.donor as Item).cl, slots: (s.donor as Item).sl })),
    );
    const lostClasses = item.cl.filter(
      (c) => c !== 'ALL' && !restricted.classes.includes(c),
    );
    const lostSlots = item.sl.filter((s) => !restricted.slots.includes(s));
    const blocksLoadout = Boolean(
      context &&
        context.classes.length &&
        canUseClass({ classes: item.cl }, context) &&
        !canUseClass({ classes: restricted.classes }, context),
    );

    const next = EXALTATION_LADDER.find((s) => s.unlockTier > state.full);
    items.push({
      positionId: view.position.id,
      positionLabel: view.position.label,
      item,
      state,
      sockets,
      filled,
      openCount: sockets.filter(
        (s) => s.unlocked && !s.donorName && s.socket.kind !== 'ornamentation',
      ).length,
      nextUnlockTier: next ? next.unlockTier : null,
      restricted,
      lostClasses,
      lostSlots,
      blocksLoadout,
    });
  }

  // Rank families across the whole set: two items carrying Burning Affliction
  // II and III do not add up, the III simply wins.
  const named = everySocket.filter((s): s is SocketView & { effect: ItemEffect } =>
    Boolean(s.effect),
  );
  const survivors = new Set(
    dedupeByFamily(named.map((s) => ({ effectName: s.effect.n, ref: s }))).map((e) => e.ref),
  );
  const active: SocketView[] = [];
  const superseded: SocketView[] = [];
  for (const socket of named) {
    if (survivors.has(socket)) active.push(socket);
    else {
      const winner = [...survivors].find(
        (s) => s.effect && familyOf(s.effect.n) === familyOf(socket.effect.n),
      );
      socket.supersededBy = winner?.effect?.n;
      superseded.push(socket);
    }
  }

  return {
    items,
    active,
    superseded,
    illegal: everySocket.filter((s) => !s.legal),
    counts: {
      equipped: items.length,
      withSockets: items.filter((i) => i.filled.length > 0 || i.openCount > 0).length,
      filled: everySocket.length,
      open: items.reduce((sum, i) => sum + i.openCount, 0),
    },
  };
}

/** Family name, i.e. the effect without its rank suffix — the engine's own rule. */
function familyOf(name: string): string {
  return parseEffectRank(name).family;
}
