/**
 * Screen smoke tests.
 *
 * No browser binary is installable in this environment, so these mount the
 * real app into jsdom — effects and all — and assert two things that matter
 * more than pixels: the render does not throw, and no screen ever prints
 * `NaN`, the exact defect UI-REFERENCE §A7 calls out in the tool we are
 * modelled on.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../App';
import { useCatalog } from '../data/catalog';
import { tier } from '../engine/upgrade';
import { encodePlan } from '../share/codec';
import { emptyState } from '../state/persistence';
import { useApp } from '../state/store';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function render(hash: string): string {
  window.location.hash = hash;
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: Root | null = null;
  act(() => {
    root = createRoot(container);
    root.render(<App />);
  });
  const html = container.innerHTML;
  act(() => (root as Root | null)?.unmount());
  container.remove();
  return html;
}

function seed(): { setId: string } {
  useApp.setState({ ...emptyState(), hydrated: true, storageStatus: 'ok' });
  const character = useApp.getState().createCharacter({
    name: 'Avenrae',
    level: 50,
    classes: ['BRD', 'WAR', 'BER'],
    race: null,
  });
  const gearSet = useApp.getState().createSet(character.id, 'Main Set');
  useApp.getState().equip(gearSet.id, 'PRIMARY', '[Fixture] Bronze Longsword');
  useApp.getState().setUpgrade(gearSet.id, 'PRIMARY', tier(5));
  useApp.getState().equip(gearSet.id, 'HEAD', '[Fixture] Iron Helm');
  useApp.getState().equip(gearSet.id, 'ANY_1', '[Fixture] Charm of Anywhere');
  useApp.getState().equip(gearSet.id, 'FEET', 'Item That Does Not Exist');
  return { setId: gearSet.id };
}

beforeEach(() => {
  useCatalog.getState().loadFixture();
  useApp.setState({ ...emptyState(), hydrated: true, storageStatus: 'ok' });
});

describe('screens render without throwing or printing NaN', () => {
  it('landing', () => {
    const html = render('#/');
    expect(html).toContain('EQL');
    expect(html).not.toMatch(/NaN/);
  });

  it('characters, empty and populated', () => {
    expect(render('#/characters')).toContain('No characters yet');
    seed();
    const html = render('#/characters');
    expect(html).toContain('Avenrae');
    expect(html).toContain('50 BRD/WAR/BER');
    expect(html).not.toMatch(/NaN/);
  });

  it('character creation', () => {
    const html = render('#/character/new');
    expect(html).toContain('Create character');
    expect(html).toContain('Class trio');
    expect(html).not.toMatch(/NaN/);
  });

  it('item browser', () => {
    const html = render('#/items');
    expect(html).toContain('Items');
    expect(html).not.toMatch(/NaN/);
  });

  it('gear set editor, including the zero state', () => {
    const { setId } = seed();
    const html = render(`#/set/${setId}`);
    expect(html).toContain('Avenrae');
    expect(html).toContain('50 BRD/WAR/BER');
    expect(html).toContain('Any Slot 1');
    expect(html).toContain('[Fixture] Bronze Longsword');
    // Unresolved equipment is surfaced, not silently dropped.
    expect(html).toContain('Not in catalog');
    expect(html).not.toMatch(/NaN/);
  });

  it('an empty set renders clean zeroes', () => {
    useApp.setState({ ...emptyState(), hydrated: true, storageStatus: 'ok' });
    const character = useApp.getState().createCharacter({
      name: 'Empty',
      level: 50,
      classes: ['WAR'],
      race: null,
    });
    const gearSet = useApp.getState().createSet(character.id, 'Nothing');
    const html = render(`#/set/${gearSet.id}`);
    expect(html).not.toMatch(/NaN/);
    expect(html).toContain('Hit Points');
  });

  it('exaltations and weights tabs', () => {
    const { setId } = seed();
    const exalt = render(`#/set/${setId}/exaltations`);
    expect(exalt).toContain('Focus Exaltation');
    expect(exalt).toContain('Unlocks at +');
    expect(exalt).not.toMatch(/NaN/);

    const weights = render(`#/set/${setId}/weights`);
    expect(weights).toContain('Preset profile');
    expect(weights).toContain('Weapon Ratio');
    expect(weights).not.toMatch(/NaN/);
  });

  it('a share link reconstructs read-only', () => {
    const payload = encodePlan({
      character: { name: 'Shared One', level: 50, race: null, classes: ['SHM', 'ROG'] },
      set: {
        name: 'Borrowed',
        slots: { HEAD: { itemName: '[Fixture] Iron Helm', upgrade: tier(7) } },
        weights: { AC: 2 },
      },
    });
    const html = render(`#/share/${payload}`);
    expect(html).toContain('Shared One');
    expect(html).toContain('50 SHM/ROG');
    expect(html).toContain('Save a copy');
    expect(html).not.toMatch(/NaN/);
  });

  it('a damaged share link explains itself', () => {
    const html = render('#/share/!!!not-a-payload!!!');
    expect(html).toContain('could not be read');
  });

  it('an unknown route explains itself', () => {
    expect(render('#/nowhere')).toContain('Nothing here');
  });

  it('the missing-data empty state names the files it wants', () => {
    useCatalog.setState({
      status: 'missing',
      items: [],
      usingFixture: false,
      load: async () => undefined,
    });
    const html = render('#/');
    expect(html).toContain('items-index.json');
  });

  it('warns when the browser refuses to store anything', () => {
    useApp.setState({ storageStatus: 'unavailable' });
    expect(render('#/')).toContain('not allowing local storage');
    useApp.setState({ storageStatus: 'quota' });
    expect(render('#/')).toContain('storage is full');
  });
});
