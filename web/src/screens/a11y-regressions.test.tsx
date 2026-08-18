/**
 * Regressions for four defects that survived three consecutive reviews.
 *
 * Each one had been described precisely in the previous critique and re-derived
 * from scratch in the next, so the point of this file is that the *shape* of
 * each fix is now asserted somewhere cheap and fast. The pixel-level halves —
 * where a focus ring actually lands, how wide a rendered row is — live in
 * `e2e/visual-system.spec.ts`, because jsdom has no layout.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../App';
import { useCatalog } from '../data/catalog';
import { emptyState } from '../state/persistence';
import { useApp } from '../state/store';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

function mount(hash: string): void {
  window.location.hash = hash;
  container = document.createElement('div');
  document.body.appendChild(container);
  act(() => {
    root = createRoot(container);
    root.render(<App />);
  });
}

function click(element: Element | null | undefined): void {
  expect(element, 'element to click exists').toBeTruthy();
  act(() => {
    (element as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

function change(select: HTMLSelectElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
  act(() => {
    setter?.call(select, value);
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

function key(target: EventTarget, name: string, init: KeyboardEventInit = {}): void {
  act(() => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, ...init }));
  });
}

function seedCharacter(name = 'Avenrae'): string {
  return useApp.getState().createCharacter({ name, level: 50, classes: ['WAR'], race: null }).id;
}

beforeEach(() => {
  useCatalog.getState().loadFixture();
  useApp.setState({ ...emptyState(), hydrated: true, storageStatus: 'ok' });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('the item browser is a table, not 3,533 one-word rows', () => {
  beforeEach(() => {
    mount('#/items');
  });

  it('leaves the row in the table structure and names it from the first cell', () => {
    const row = container.querySelector('table.data tbody tr');
    expect(row).toBeTruthy();

    /*
     * `role="button"` took the row out of the table, orphaning its six `<td>`s,
     * and `aria-label` on a button *replaces* its contents as the accessible
     * name — so five of the six columns were silent on the screen that exists
     * to expose them.
     */
    expect(row!.getAttribute('role')).toBeNull();
    expect(row!.getAttribute('aria-label')).toBeNull();
    expect(row!.querySelectorAll('td')).toHaveLength(6);

    // The affordance is a real control in the first cell instead.
    const open = row!.querySelector('td button');
    expect(open).toBeTruthy();
    expect(open!.textContent?.trim()).toBeTruthy();
    expect(row!.textContent).toContain(open!.textContent);
  });

  it('keeps one tab stop per row rather than two', () => {
    const rows = [...container.querySelectorAll('table.data tbody tr')];
    expect(rows.length).toBeGreaterThan(0);
    const stops = [...container.querySelectorAll<HTMLElement>('table.data tbody tr, table.data tbody tr *')]
      .filter((el) => el.tabIndex >= 0);
    expect(stops, 'the name button must not double the page\'s tab stops').toHaveLength(rows.length);
    for (const stop of stops) expect(stop.tagName).toBe('TR');
  });

  it('scopes all six headers and captions the table with the current filter state', () => {
    const scopes = [...container.querySelectorAll('table.data thead th')].map((th) =>
      th.getAttribute('scope'),
    );
    expect(scopes).toEqual(['col', 'col', 'col', 'col', 'col', 'col']);

    const caption = container.querySelector('table.data caption');
    expect(caption).toBeTruthy();
    // Visually hidden — the same facts are in the toolbar directly above it.
    expect(caption!.className).toContain('sr-only');
    expect(caption!.textContent).toMatch(/any slot/i);
    expect(caption!.textContent).toMatch(/any class/i);
    expect(caption!.textContent).toMatch(/any era/i);
    expect(caption!.textContent).toMatch(/sorted by ep, descending/i);

    // It follows the filters rather than describing the page it was written on.
    const slot = container.querySelector<HTMLSelectElement>('select[aria-label="Filter by slot"]');
    change(slot!, 'HEAD');
    expect(container.querySelector('table.data caption')!.textContent).toMatch(/slot HEAD/);
  });
});

describe('destructive controls keep focus in the document', () => {
  let setId = '';

  beforeEach(() => {
    const character = useApp.getState().createCharacter({
      name: 'Avenrae',
      level: 50,
      classes: ['WAR', 'BRD', 'BER'],
      race: null,
    });
    const gearSet = useApp.getState().createSet(character.id, 'Main Set');
    setId = gearSet.id;
    useApp.getState().equip(gearSet.id, 'HEAD', '[Fixture] Iron Helm');
    useApp.getState().equip(gearSet.id, 'PRIMARY', '[Fixture] Bronze Longsword');
    mount(`#/set/${setId}`);
  });

  it('returns focus to the slot the item left, not to <body>', () => {
    const remove = container.querySelector<HTMLElement>('[aria-label^="Remove [Fixture] Iron Helm"]');
    expect(remove).toBeTruthy();
    remove!.focus();
    click(remove);

    expect(useApp.getState().sets.find((s) => s.id === setId)?.slots.HEAD).toBeUndefined();
    expect(document.activeElement, 'focus fell to the document body').not.toBe(document.body);
    expect(document.activeElement?.getAttribute('aria-label')).toMatch(/^Head: empty/);
  });

  it('lands focus on the destination heading after a set is deleted', async () => {
    const confirm = window.confirm;
    window.confirm = () => true;
    try {
      const menu = container.querySelector<HTMLElement>('summary[aria-label="More set actions"]');
      click(menu);
      const remove = [...container.querySelectorAll<HTMLElement>('.menu-item')].find(
        (el) => el.textContent === 'Delete set',
      );
      remove!.focus();
      click(remove);
      // `hashchange` is a task, so the destination has not mounted yet.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      // Deleting navigates to the character list, so the control *and* its whole
      // screen are gone. Landing on `<body>` costs a full re-traversal.
      expect(window.location.hash).toBe('#/characters');
      expect(document.activeElement).not.toBe(document.body);
      expect(document.activeElement?.className).toContain('page-title');
    } finally {
      window.confirm = confirm;
    }
  });

  it('returns focus to the menu after Clear all slots', () => {
    const menu = container.querySelector<HTMLElement>('summary[aria-label="More set actions"]');
    expect(menu).toBeTruthy();
    click(menu);
    const clear = [...container.querySelectorAll<HTMLElement>('.menu-item')].find(
      (el) => el.textContent === 'Clear all slots',
    );
    clear!.focus();
    click(clear);

    expect(useApp.getState().sets.find((s) => s.id === setId)?.slots).toEqual({});
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement?.getAttribute('aria-label')).toBe('More set actions');
  });
});

describe('the equipment map reproduces the game Equipment tab', () => {
  beforeEach(() => {
    const character = useApp.getState().createCharacter({
      name: 'Avenrae',
      level: 50,
      classes: ['WAR'],
      race: null,
    });
    const gearSet = useApp.getState().createSet(character.id, 'Main Set');
    mount(`#/set/${gearSet.id}`);
  });

  /*
   * The map reproduces the game's Equipment tab, and that is the only thing it
   * is allowed to be shaped like.
   *
   * This used to assert a 5x7 anatomical silhouette that narrowed at the head
   * and widened at the shoulders — a real measurement of a layout that was
   * invented rather than observed. The capture settles it: six columns, four
   * rows, 23 positions, one gap at the left of row 1, and the three doubled
   * slots mirrored to the outside.
   */
  it('reproduces the game grid, position for position', () => {
    const cells = [...container.querySelectorAll<HTMLElement>('.figure-body button')];
    expect(cells).toHaveLength(23);

    // jsdom has no layout, but the placement is inline `gridRow`/`gridColumn`,
    // so the arrangement is readable straight off the style attribute.
    const at = new Map<string, string>();
    for (const cell of cells) {
      const row = Number(cell.style.gridRow);
      const column = Number(cell.style.gridColumn);
      expect(Number.isFinite(row) && Number.isFinite(column)).toBe(true);
      at.set(`${row},${column}`, cell.getAttribute('data-slot') ?? cell.textContent?.trim() ?? '');
    }

    const rows = new Map<number, number[]>();
    for (const cell of cells) {
      const row = Number(cell.style.gridRow);
      rows.set(row, [...(rows.get(row) ?? []), Number(cell.style.gridColumn)]);
    }
    const ordered = [...rows.keys()].sort((a, b) => a - b);

    // Four rows; 5 cells on the first and 6 on each of the rest.
    expect(ordered).toHaveLength(4);
    expect(ordered.map((r) => rows.get(r)!.length)).toEqual([5, 6, 6, 6]);

    // Row 1 is indented by one: the gap is column 1, per the capture.
    expect([...rows.get(ordered[0]!)!].sort((a, b) => a - b)).toEqual([2, 3, 4, 5, 6]);
    for (const r of ordered.slice(1)) {
      expect([...rows.get(r)!].sort((a, b) => a - b), `row ${r}`).toEqual([1, 2, 3, 4, 5, 6]);
    }

    // Six columns, never five, and never a seventh.
    const columns = cells.map((c) => Number(c.style.gridColumn));
    expect(Math.min(...columns)).toBe(1);
    expect(Math.max(...columns)).toBe(6);
  });

  /*
   * The silhouette is gone, and must stay gone.
   *
   * A decorative SVG body used to sit behind the cells, because twenty-three
   * identical tiles with holes between them read as a pegboard. The answer to
   * that turned out to be different: the panel now reproduces the game's own
   * Equipment tab, which a player recognises without needing a picture drawn
   * behind it. A body under the game's grid would be decoration competing with
   * recognition.
   *
   * This asserts the absence so nobody reinstates it while chasing the
   * pegboard complaint a second time.
   */
  it('draws no decorative figure behind the cells', () => {
    expect(container.querySelector('.figure-silhouette')).toBeNull();
    // Only the slot glyphs, which live inside the cells — nothing drawn behind them.
    const direct = [...(container.querySelector('.figure-body')?.children ?? [])];
    expect(direct.filter((el) => el.tagName.toLowerCase() === 'svg')).toEqual([]);
  });
});

/*
 * `Modal` used to read `document.activeElement` from an effect. React applies a
 * child's `autoFocus` during commit and runs a child's effects before its
 * parent's, so what it stored was never the opener — it was the dialog looking
 * at itself, and closing left the reader on `<body>` with the whole document to
 * re-traverse. Two dialogs are checked here because the two ways focus gets
 * pulled inside, `autoFocus` and a child effect, both beat a parent effect.
 */
describe('a dialog hands focus back to the control that opened it', () => {
  it('returns to New set after the set dialog is dismissed', () => {
    seedCharacter();
    mount('#/characters');

    const opener = [...container.querySelectorAll<HTMLButtonElement>('.card-foot button')].find(
      (button) => button.textContent === 'New set',
    );
    expect(opener).toBeTruthy();
    opener!.focus();
    click(opener);

    // The name field claims focus with `autoFocus`, which is the commit-phase
    // move that used to overwrite the opener before it could be recorded.
    const name = container.querySelector<HTMLInputElement>('[role="dialog"] input[type="text"]');
    expect(document.activeElement).toBe(name);

    key(document, 'Escape');
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('returns to the socket button after the donor picker is dismissed', () => {
    const characterId = seedCharacter();
    const gearSet = useApp.getState().createSet(characterId, 'Main Set');
    // +1 opens the Focus socket, which is what puts an Add button on the row.
    useApp.getState().equip(gearSet.id, 'HEAD', '[Fixture] Iron Helm', { full: 1, fraction: 0 });
    mount(`#/set/${gearSet.id}/exaltations`);

    const opener = [...container.querySelectorAll<HTMLButtonElement>('.socket button')].find(
      (button) => button.textContent === 'Add',
    );
    expect(opener).toBeTruthy();
    opener!.focus();
    click(opener);

    // This one pulls focus in from a child effect rather than from `autoFocus`;
    // both run before the parent's, so both used to erase the opener.
    const search = container.querySelector<HTMLInputElement>(
      '[aria-label="Search exaltation donors"]',
    );
    expect(document.activeElement).toBe(search);

    key(document, 'Escape');
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('still traps Tab inside the dialog', () => {
    seedCharacter();
    mount('#/characters');
    const opener = [...container.querySelectorAll<HTMLButtonElement>('.card-foot button')].find(
      (button) => button.textContent === 'New set',
    );
    opener!.focus();
    click(opener);

    const dialog = container.querySelector<HTMLElement>('[role="dialog"]');
    expect(dialog).toBeTruthy();
    /*
     * jsdom reports every element as zero-sized, so the trap's visibility
     * filter finds no stops and parks focus on the dialog itself. What can be
     * asserted here is the part that matters for the restore fix: Tab, in
     * either direction, never leaves the dialog. Where it lands among the real
     * stops is covered by the browser suite.
     */
    key(document, 'Tab');
    expect(dialog!.contains(document.activeElement)).toBe(true);
    key(document, 'Tab', { shiftKey: true });
    expect(dialog!.contains(document.activeElement)).toBe(true);
  });
});

/*
 * Deleting a set destroys the row the reader is standing on. The page title is
 * the right landing place when a whole card goes, but for one row of one card
 * it is a thrown-away position; the list itself carries on.
 */
describe('deleting a set keeps the reader in the list', () => {
  let confirmed: typeof window.confirm;

  const rows = () => [...container.querySelectorAll<HTMLLIElement>('li.set-line')];
  const deleteIn = (row: Element) => row.querySelector<HTMLButtonElement>('.btn-danger')!;
  const newSet = () => container.querySelector<HTMLButtonElement>('.card-foot .btn-primary')!;

  beforeEach(() => {
    confirmed = window.confirm;
    window.confirm = () => true;
    const characterId = seedCharacter();
    for (const name of ['Alpha', 'Beta', 'Gamma']) useApp.getState().createSet(characterId, name);
    mount('#/characters');
    expect(rows()).toHaveLength(3);
  });

  afterEach(() => {
    window.confirm = confirmed;
  });

  it('moves to the row below the one that was deleted', () => {
    const [first, second] = rows();
    const gone = first!.querySelector('a')!.textContent;
    const below = deleteIn(second!);

    deleteIn(first!).focus();
    click(deleteIn(first!));

    expect(useApp.getState().sets.map((s) => s.name)).not.toContain(gone);
    expect(rows()).toHaveLength(2);
    expect(document.activeElement).toBe(below);
  });

  it('moves to the row above when the last one is deleted', () => {
    const list = rows();
    const above = deleteIn(list[1]!);
    const last = list[2]!;

    deleteIn(last).focus();
    click(deleteIn(last));

    expect(rows()).toHaveLength(2);
    expect(document.activeElement).toBe(above);
  });

  it('lands on New set once the card has no sets left', () => {
    const create = newSet();
    for (let remaining = 3; remaining > 0; remaining -= 1) {
      const row = rows()[0]!;
      deleteIn(row).focus();
      click(deleteIn(row));
    }

    expect(rows()).toHaveLength(0);
    expect(container.textContent).toContain('No sets yet');
    expect(document.activeElement).toBe(create);
  });
});
