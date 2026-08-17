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

beforeEach(() => {
  useCatalog.getState().loadFixture();
  useApp.setState({ ...emptyState(), hydrated: true, storageStatus: 'ok' });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('the item browser is a table, not 5,861 one-word rows', () => {
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

  it('scopes all six headers and captions the table with the live filter state', () => {
    const scopes = [...container.querySelectorAll('table.data thead th')].map((th) =>
      th.getAttribute('scope'),
    );
    expect(scopes).toEqual(['col', 'col', 'col', 'col', 'col', 'col']);

    const caption = container.querySelector('table.data caption');
    expect(caption).toBeTruthy();
    // Visually hidden — the same facts are in the toolbar directly above it.
    expect(caption!.className).toContain('sr-only');
    expect(caption!.textContent).toMatch(/any slot/i);
    expect(caption!.textContent).toMatch(/live content only/i);
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

describe('the equipment map is shaped like a body', () => {
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

  it('narrows at the feet, which two comments claimed and the layout did not', () => {
    const cells = [...container.querySelectorAll<HTMLElement>('.figure-body button')];
    expect(cells).toHaveLength(23);

    // jsdom has no layout, but the placement is inline `gridRow`/`gridColumn`,
    // so the silhouette is readable straight off the style attribute.
    const rows = new Map<number, number[]>();
    for (const cell of cells) {
      const row = Number(cell.style.gridRow);
      const column = Number(cell.style.gridColumn);
      expect(Number.isFinite(row) && Number.isFinite(column)).toBe(true);
      rows.set(row, [...(rows.get(row) ?? []), column]);
    }

    const extent = (row: number) => {
      const columns = rows.get(row)!;
      return Math.max(...columns) - Math.min(...columns) + 1;
    };
    const ordered = [...rows.keys()].sort((a, b) => a - b);
    const widest = Math.max(...ordered.map(extent));

    expect(extent(ordered[0]!), 'head').toBeLessThan(widest);
    expect(widest, 'shoulders/chest/waist').toBe(5);
    // The two Any Slots used to sit in the outer columns at ankle level, which
    // made the last row exactly as wide as the shoulders.
    expect(extent(ordered[ordered.length - 1]!), 'feet').toBeLessThan(widest);
    expect(rows.get(ordered[ordered.length - 1]!)!.sort()).toEqual([2, 3, 4]);
  });
});
