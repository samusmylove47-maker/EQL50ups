/**
 * The compare route and screen.
 *
 * `#/set/{id}/compare/{id2}` was declared in DESIGN.md §3 and had no branch in
 * the router, so it silently rendered the gear tab — a route that looks
 * implemented and is not. These cover the parse, and every awkward pairing the
 * screen has to answer rather than blank.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../App';
import { useCatalog } from '../data/catalog';
import { tier } from '../engine/upgrade';
import { href, parseHash } from '../router';
import { emptyState } from '../state/persistence';
import { useApp } from '../state/store';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function render(hash: string): string {
  window.location.hash = hash;
  container = document.createElement('div');
  document.body.appendChild(container);
  act(() => {
    root = createRoot(container as HTMLDivElement);
    root.render(<App />);
  });
  return (container.textContent ?? '').replace(/\s+/g, ' ');
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe('route', () => {
  it('parses the declared compare URL', () => {
    expect(parseHash('#/set/abc/compare/def')).toEqual({
      name: 'set-compare',
      id: 'abc',
      id2: 'def',
    });
  });

  it('accepts a compare URL with no second set, for the chooser', () => {
    expect(parseHash('#/set/abc/compare')).toEqual({ name: 'set-compare', id: 'abc', id2: '' });
  });

  it('decodes ids and leaves the plain set route alone', () => {
    expect(parseHash('#/set/a%20b/compare/c%20d')).toEqual({
      name: 'set-compare',
      id: 'a b',
      id2: 'c d',
    });
    expect(parseHash('#/set/abc/weights')).toEqual({ name: 'set', id: 'abc', tab: 'weights' });
    expect(parseHash('#/set/abc')).toEqual({ name: 'set', id: 'abc', tab: 'gear' });
  });

  it('builds both forms of the href', () => {
    expect(href.compare('a', 'b')).toBe('#/set/a/compare/b');
    expect(href.compare('a')).toBe('#/set/a/compare');
  });
});

describe('screen', () => {
  let idA = '';
  let idB = '';
  let idOther = '';

  beforeEach(() => {
    useCatalog.getState().loadFixture();
    useApp.setState({ ...emptyState(), hydrated: true, storageStatus: 'ok' });
    const state = useApp.getState();
    const character = state.createCharacter({
      name: 'Avenrae',
      level: 50,
      classes: ['BRD', 'WAR', 'BER'],
      race: null,
    });
    const a = state.createSet(character.id, 'Current');
    const b = state.createSet(character.id, 'Planned');
    idA = a.id;
    idB = b.id;

    state.equip(a.id, 'PRIMARY', '[Fixture] Bronze Longsword');
    state.equip(a.id, 'HEAD', '[Fixture] Iron Helm');
    state.equip(b.id, 'PRIMARY', '[Fixture] Bronze Longsword');
    state.setUpgrade(b.id, 'PRIMARY', tier(6));
    state.equip(b.id, 'HEAD', '[Fixture] Silk Cowl');
    state.equip(b.id, 'ARMS', '[Fixture] Plated Vambraces');

    const other = state.createCharacter({
      name: 'Someone Else',
      level: 50,
      classes: ['CLR'],
      race: null,
    });
    idOther = state.createSet(other.id, 'Their Set').id;
  });

  const clean = (text: string) => {
    expect(text).not.toMatch(/NaN/);
    expect(text).not.toMatch(/undefined/);
    expect(text).not.toMatch(/\[object Object\]/);
    expect(text).not.toMatch(/Infinity/);
  };

  it('renders the diff with both sets, a delta column and the cap summary', () => {
    const text = render(href.compare(idA, idB));
    clean(text);
    expect(text).toContain('Compare sets');
    expect(text).toContain('Current');
    expect(text).toContain('Planned');
    expect(text).toContain('Slot by slot');
    expect(text).toContain('Equivalency points');
    expect(text).toContain('Creditable stat gain');
    expect(text).toContain('Swapped');
    expect(text).toContain('Retuned');
    expect(text).toContain('Added');
    // The client's ceilings are named where the diff spends them.
    expect(text).toMatch(/ceiling 510/);
    expect(text).toMatch(/ceiling 1,?000/);
  });

  it('says so plainly when a set is compared with itself', () => {
    const text = render(href.compare(idA, idA));
    clean(text);
    expect(text).toContain('same set on both sides');
    expect(text).toContain('identical');
  });

  it('handles an empty set on one side without pretending it is a wash', () => {
    const state = useApp.getState();
    const empty = state.createSet(state.characters[0]!.id, 'Nothing Yet');
    const text = render(href.compare(idA, empty.id));
    clean(text);
    expect(text).toContain('Removed');
    expect(text).toContain('Nothing Yet');
  });

  it('names the mismatch when the two sets belong to different characters', () => {
    const text = render(href.compare(idA, idOther));
    clean(text);
    expect(text).toContain('different characters');
    expect(text).toContain('Someone Else');
  });

  it('offers a chooser when no second set was named', () => {
    const text = render(href.compare(idA));
    clean(text);
    expect(text).toContain('Compare "Current" with…');
    expect(text).toContain('Planned');
    expect(text).toContain('Their Set');
  });

  it('says the second set is gone rather than rendering nonsense', () => {
    const text = render(href.compare(idA, 'set_deleted'));
    clean(text);
    expect(text).toContain('no longer in this library');
    expect(text).toContain('Compare "Current" with…');
  });

  it('explains a missing first set', () => {
    const text = render(href.compare('set_gone', idB));
    clean(text);
    expect(text).toContain('Set not found');
  });

  it('offers a way out when there is only one set in the library', () => {
    useApp.setState({ ...emptyState(), hydrated: true, storageStatus: 'ok' });
    const state = useApp.getState();
    const character = state.createCharacter({ name: 'Solo', level: 50, classes: ['WAR'], race: null });
    const only = state.createSet(character.id, 'Only Set');
    const text = render(href.compare(only.id));
    clean(text);
    expect(text).toContain('Nothing to compare against');
  });
});
