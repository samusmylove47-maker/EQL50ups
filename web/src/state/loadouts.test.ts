/**
 * The store's loadout and per-class-level actions, and the one property that
 * matters most: switching loadout has to change what the planner offers,
 * immediately, without touching the gear set.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  activeContext, activeLoadout, describeCharacter, loadoutClasses, type Character,
} from '../engine/character';
import { canUse } from '../engine/character';
import { useApp } from './store';
import { clearState, memoryStorage } from './persistence';

function character(): Character {
  return useApp.getState().characters[0] as Character;
}

beforeEach(() => {
  clearState(memoryStorage());
  useApp.getState().resetAll();
  useApp.getState().createCharacter({
    name: 'Avenrae',
    level: 50,
    classes: ['BRD', 'WAR', 'BER'],
    race: null,
  });
});

describe('creating a character', () => {
  it('gives it one loadout holding the chosen trio, and levels only those classes', () => {
    const c = character();
    expect(c.loadouts).toHaveLength(1);
    expect(loadoutClasses(c)).toEqual(['BRD', 'WAR', 'BER']);
    expect(c.levels.BRD).toBe(50);
    expect(c.levels.WIZ).toBe(1);
    expect(describeCharacter(c)).toBe('50 BRD/WAR/BER');
  });

  it('accepts explicit per-class levels for the classes outside the trio', () => {
    useApp.getState().createCharacter({
      name: 'Sampled',
      level: 50,
      classes: ['BRD', 'WAR', 'BER'],
      race: null,
      levels: { MNK: 36, DRU: 36, SHD: 36, PAL: 21, MAG: 11 },
    });
    const c = useApp.getState().characters[1] as Character;
    expect(c.levels.MNK).toBe(36);
    expect(c.levels.PAL).toBe(21);
    expect(c.levels.BRD).toBe(50);
  });
});

describe('per-class levels', () => {
  it('sets one class without disturbing the others', () => {
    useApp.getState().setClassLevel(character().id, 'WAR', 12);
    expect(character().levels.WAR).toBe(12);
    expect(character().levels.BRD).toBe(50);
  });

  it('clamps a level that is out of range or not a number', () => {
    const id = character().id;
    useApp.getState().setClassLevel(id, 'WAR', 9999);
    expect(character().levels.WAR).toBe(255);
    useApp.getState().setClassLevel(id, 'WAR', -4);
    expect(character().levels.WAR).toBe(1);
    useApp.getState().setClassLevel(id, 'WAR', Number.NaN);
    expect(character().levels.WAR).toBe(1);
  });

  it('drives the header off the primary class of the active loadout', () => {
    useApp.getState().setClassLevel(character().id, 'BRD', 42);
    expect(describeCharacter(character())).toBe('42 BRD/WAR/BER');
  });
});

describe('loadouts', () => {
  it('adds one, seeded from the first, and can rename and re-class it', () => {
    const id = character().id;
    const created = useApp.getState().addLoadout(id);
    expect(created).not.toBeNull();
    expect(character().loadouts).toHaveLength(2);
    expect(character().loadouts[1]?.name).toBe('Loadout 2');

    useApp.getState().updateLoadout(id, created?.id as string, {
      name: 'Plate run',
      classes: ['WAR', 'PAL', 'CLR'],
    });
    expect(character().loadouts[1]?.name).toBe('Plate run');
    expect(character().loadouts[1]?.classes).toEqual(['WAR', 'PAL', 'CLR']);
    // Switching stays an explicit act — adding one does not activate it.
    expect(activeLoadout(character())?.id).toBe(character().loadouts[0]?.id);
  });

  it('switches eligibility the moment the active loadout changes', () => {
    const id = character().id;
    const second = useApp.getState().addLoadout(id, { classes: ['CLR', 'DRU', 'ENC'] });
    const asBard = activeContext(character());
    expect(canUse({ classes: ['CLR'], races: ['ALL'] }, asBard)).toBe(false);

    useApp.getState().setActiveLoadout(id, second?.id as string);
    const asCleric = activeContext(character());
    expect(canUse({ classes: ['CLR'], races: ['ALL'] }, asCleric)).toBe(true);
    expect(canUse({ classes: ['BRD'], races: ['ALL'] }, asCleric)).toBe(false);
    expect(describeCharacter(character())).toBe('1 CLR/DRU/ENC');
  });

  it('checks a level requirement against the qualifying class in the active loadout', () => {
    const id = character().id;
    useApp.getState().setClassLevel(id, 'WAR', 12);
    const ctx = activeContext(character());
    expect(canUse({ classes: ['WAR'], races: ['ALL'], rl: 40 }, ctx)).toBe(false);
    expect(canUse({ classes: ['BRD'], races: ['ALL'], rl: 40 }, ctx)).toBe(true);
  });

  it('never leaves a character without a loadout', () => {
    const id = character().id;
    useApp.getState().deleteLoadout(id, character().loadouts[0]?.id as string);
    expect(character().loadouts).toHaveLength(1);
  });

  it('moves the active flag when the active loadout is deleted', () => {
    const id = character().id;
    const second = useApp.getState().addLoadout(id, { classes: ['ROG'] });
    useApp.getState().setActiveLoadout(id, second?.id as string);
    useApp.getState().deleteLoadout(id, second?.id as string);
    expect(character().loadouts).toHaveLength(1);
    expect(activeLoadout(character())?.id).toBe(character().loadouts[0]?.id);
  });

  it('ignores a switch to a loadout that does not exist', () => {
    const before = character().activeLoadoutId;
    useApp.getState().setActiveLoadout(character().id, 'nonsense');
    expect(character().activeLoadoutId).toBe(before);
  });

  it('refuses to let an update rewrite a loadout id', () => {
    const id = character().id;
    const original = character().loadouts[0]?.id as string;
    useApp.getState().updateLoadout(id, original, { id: 'hijacked' } as never);
    expect(character().loadouts[0]?.id).toBe(original);
  });

  it('does nothing for a character that is not in the library', () => {
    expect(useApp.getState().addLoadout('ghost')).toBeNull();
  });
});
