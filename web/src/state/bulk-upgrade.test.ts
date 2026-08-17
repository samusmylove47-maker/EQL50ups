/**
 * Bulk `+N` across a whole set, and the one-press way back.
 *
 * The three properties worth stating in a test, because each of them is a
 * plausible thing to get wrong:
 *
 *   1. it writes to equipped slots only — an empty slot is not a slot at +0;
 *   2. `+0` is a target like any other, not a no-op guard;
 *   3. revert restores the exact prior state, banked fractions included, which
 *      is the half no hand-edit could reproduce.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { GearSet } from '../engine/types';
import { useApp } from './store';
import { clearState, memoryStorage } from './persistence';

let setId = '';

function set(): GearSet {
  const found = useApp.getState().sets.find((s) => s.id === setId);
  expect(found, 'the set under test still exists').toBeTruthy();
  return found as GearSet;
}

/** Tier and banked fraction of every equipped slot, keyed by position. */
function tiers(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(set().slots).map(([position, equipped]) => [
      position,
      `${equipped?.upgrade.full}.${equipped?.upgrade.fraction}`,
    ]),
  );
}

beforeEach(() => {
  clearState(memoryStorage());
  useApp.getState().resetAll();
  const character = useApp.getState().createCharacter({
    name: 'Avenrae',
    level: 50,
    classes: ['WAR', 'BRD', 'BER'],
    race: null,
  });
  setId = useApp.getState().createSet(character.id, 'Main Set').id;
  useApp.getState().equip(setId, 'HEAD', 'Indicolite Helm');
  useApp.getState().equip(setId, 'CHEST', 'Indicolite Breastplate');
  useApp.getState().equip(setId, 'PRIMARY', 'Earthshaker');
});

describe('setAllUpgrades', () => {
  it('puts every equipped slot on the target tier and banks nothing', () => {
    const changed = useApp.getState().setAllUpgrades(setId, 5);
    expect(changed).toBe(3);
    expect(tiers()).toEqual({ HEAD: '5.0', CHEST: '5.0', PRIMARY: '5.0' });
  });

  it('leaves empty slots empty', () => {
    const before = Object.keys(set().slots).sort();
    useApp.getState().setAllUpgrades(setId, 7);
    expect(Object.keys(set().slots).sort()).toEqual(before);
    // 23 positions exist; only the three that carry an item were written to.
    expect(before).toEqual(['CHEST', 'HEAD', 'PRIMARY']);
    expect(set().slots.FEET).toBeUndefined();
    expect(set().slots.NECK).toBeUndefined();
  });

  it('treats +0 as a real target rather than a no-op', () => {
    useApp.getState().setAllUpgrades(setId, 6);
    expect(tiers()).toEqual({ HEAD: '6.0', CHEST: '6.0', PRIMARY: '6.0' });

    const changed = useApp.getState().setAllUpgrades(setId, 0);
    expect(changed).toBe(3);
    expect(tiers()).toEqual({ HEAD: '0.0', CHEST: '0.0', PRIMARY: '0.0' });
  });

  it('counts a slot that only loses banked experience as changed at +0', () => {
    useApp.getState().setUpgrade(setId, 'HEAD', { full: 0, fraction: 0 });
    useApp.getState().setUpgrade(setId, 'CHEST', { full: 0, fraction: 0 });
    // Tier 3 banks out of eight, so 5/8 is a legal state the client can show.
    useApp.getState().setUpgrade(setId, 'PRIMARY', { full: 3, fraction: 5 });

    expect(useApp.getState().setAllUpgrades(setId, 0)).toBe(1);
    expect(tiers()).toEqual({ HEAD: '0.0', CHEST: '0.0', PRIMARY: '0.0' });
  });

  it('reports nothing changed, and offers no revert, when the set already reads that tier', () => {
    useApp.getState().setAllUpgrades(setId, 4);
    useApp.setState({ bulkUpgrade: null });
    expect(useApp.getState().setAllUpgrades(setId, 4)).toBe(0);
    expect(useApp.getState().bulkUpgrade).toBeNull();
  });

  it('clamps out-of-range tiers rather than writing them', () => {
    useApp.getState().setAllUpgrades(setId, 99);
    expect(tiers()).toEqual({ HEAD: '10.0', CHEST: '10.0', PRIMARY: '10.0' });
    useApp.getState().setAllUpgrades(setId, -4);
    expect(tiers()).toEqual({ HEAD: '0.0', CHEST: '0.0', PRIMARY: '0.0' });
  });

  it('keeps the item and its exaltation donors', () => {
    useApp.getState().setExaltation(setId, 'HEAD', 'FOCUS', 'Some Donor');
    useApp.getState().setAllUpgrades(setId, 8);
    expect(set().slots.HEAD?.itemName).toBe('Indicolite Helm');
    expect(set().slots.HEAD?.exaltations).toEqual({ FOCUS: 'Some Donor' });
  });

  it('ignores a set id it does not have', () => {
    expect(useApp.getState().setAllUpgrades('set_nope', 5)).toBe(0);
    expect(useApp.getState().bulkUpgrade).toBeNull();
  });
});

describe('revertAllUpgrades', () => {
  it('restores the exact prior tiers, banked fractions and all', () => {
    useApp.getState().setUpgrade(setId, 'HEAD', { full: 2, fraction: 3 });
    useApp.getState().setUpgrade(setId, 'CHEST', { full: 7, fraction: 0 });
    useApp.getState().setUpgrade(setId, 'PRIMARY', { full: 0, fraction: 0 });
    const before = tiers();
    expect(before).toEqual({ HEAD: '2.3', CHEST: '7.0', PRIMARY: '0.0' });

    useApp.getState().setAllUpgrades(setId, 10);
    expect(tiers()).toEqual({ HEAD: '10.0', CHEST: '10.0', PRIMARY: '10.0' });

    expect(useApp.getState().revertAllUpgrades()).toBe(true);
    expect(tiers()).toEqual(before);
  });

  it('restores a mixed set that a +0 apply had flattened', () => {
    useApp.getState().setUpgrade(setId, 'HEAD', { full: 4, fraction: 9 });
    useApp.getState().setUpgrade(setId, 'CHEST', { full: 1, fraction: 1 });
    const before = tiers();

    useApp.getState().setAllUpgrades(setId, 0);
    expect(tiers()).toEqual({ HEAD: '0.0', CHEST: '0.0', PRIMARY: '0.0' });
    useApp.getState().revertAllUpgrades();
    expect(tiers()).toEqual(before);
  });

  it('is single use — the offer is spent once it has been taken', () => {
    useApp.getState().setAllUpgrades(setId, 5);
    expect(useApp.getState().revertAllUpgrades()).toBe(true);
    expect(useApp.getState().bulkUpgrade).toBeNull();
    expect(useApp.getState().revertAllUpgrades()).toBe(false);
  });

  it('does nothing at all when no bulk apply is outstanding', () => {
    const before = tiers();
    expect(useApp.getState().revertAllUpgrades()).toBe(false);
    expect(tiers()).toEqual(before);
  });

  it('records what it would restore, so the offer can name it', () => {
    useApp.getState().setAllUpgrades(setId, 3);
    expect(useApp.getState().bulkUpgrade).toMatchObject({
      setId,
      applied: 3,
      // Every slot was at +0, so the offer can say "back to +0" rather than
      // "back to whatever it was".
      previousTier: 0,
    });

    useApp.getState().setUpgrade(setId, 'HEAD', { full: 6, fraction: 0 });
    useApp.getState().setAllUpgrades(setId, 9);
    expect(useApp.getState().bulkUpgrade?.previousTier).toBeNull();
  });

  it('goes back one step, not to the beginning, after a second apply', () => {
    useApp.getState().setAllUpgrades(setId, 4);
    useApp.getState().setAllUpgrades(setId, 9);
    useApp.getState().revertAllUpgrades();
    expect(tiers()).toEqual({ HEAD: '4.0', CHEST: '4.0', PRIMARY: '4.0' });
  });
});

describe('the revert offer', () => {
  it('is retired by a per-slot step, which the revert could no longer honour', () => {
    useApp.getState().setAllUpgrades(setId, 5);
    expect(useApp.getState().bulkUpgrade).not.toBeNull();
    useApp.getState().setUpgrade(setId, 'HEAD', { full: 6, fraction: 0 });
    expect(useApp.getState().bulkUpgrade).toBeNull();
  });

  it('is retired by equipping or clearing a slot', () => {
    useApp.getState().setAllUpgrades(setId, 5);
    useApp.getState().unequip(setId, 'CHEST');
    expect(useApp.getState().bulkUpgrade).toBeNull();

    useApp.getState().setAllUpgrades(setId, 6);
    useApp.getState().equip(setId, 'FEET', 'Leatherfoot Sandals');
    expect(useApp.getState().bulkUpgrade).toBeNull();
  });

  it('survives the apply that created it', () => {
    useApp.getState().setAllUpgrades(setId, 2);
    expect(useApp.getState().bulkUpgrade?.applied).toBe(2);
  });

  it('never reaches storage', () => {
    useApp.getState().setAllUpgrades(setId, 5);
    expect(Object.keys(useApp.getState().buildEnvelope())).not.toContain('bulkUpgrade');
    expect(JSON.stringify(useApp.getState().buildEnvelope())).not.toContain('previousTier');
  });
});
