/**
 * The "Import from game" dialog, driven the way a player meets it.
 *
 * The contract under test is the one the whole feature rests on: **nothing is
 * written until the reader has seen what would be written.** So the preview is
 * asserted on the real Avenrae export — the right items, the right tiers, the
 * unmatched helm named out loud, the bags absent — and `onImport` is asserted
 * *not* to have fired until the button is pressed.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { existsSync, readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useCatalog } from '../data/catalog';
import { indexItems } from '../data/catalog';
import { normalizeCatalog } from '../data/normalize';
import type { Item } from '../engine/types';
import { InventoryImportDialog } from './InventoryImportDialog';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const INVENTORY = '../research/validation/tier0-inventory-Avenrae.txt';
const INDEX = 'public/data/items-index.json';
const available = existsSync(INVENTORY) && existsSync(INDEX);

let container: HTMLDivElement | undefined;
let root: Root | undefined;

function mount(node: React.ReactNode): void {
  container = document.createElement('div');
  document.body.appendChild(container);
  act(() => {
    root = createRoot(container as HTMLDivElement);
    root.render(node);
  });
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
});

function click(element: Element | null | undefined): void {
  expect(element, 'element to click exists').toBeTruthy();
  act(() => {
    (element as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

function paste(text: string): void {
  const area = document.querySelector('textarea.invimport-paste') as HTMLTextAreaElement;
  expect(area, 'the paste area is on screen').toBeTruthy();
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
  act(() => {
    setter?.call(area, text);
    area.dispatchEvent(new Event('input', { bubbles: true }));
    area.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

/**
 * The shipped catalog, narrowed to what this one export can possibly reference.
 *
 * The full index is 11,249 items and indexing it takes long enough that doing
 * it once per test in this file pushed an unrelated performance test over its
 * timeout. Every id and every name the file mentions is kept — including the
 * bag, bank and keyring entries the dialog must refuse — so nothing the
 * assertions depend on is filtered away. Built once, at module scope.
 */
function narrowedCatalog(raw: unknown, exportText: string): Item[] {
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const line of exportText.split(/\r?\n/)) {
    const columns = line.split('\t');
    if (columns.length < 2) continue;
    const name = (columns[1] ?? '').trim().replace(/\s*\(Exaltation\)$/i, '');
    names.add(name.toLowerCase());
    names.add(name.replace(/\s*\+\d{1,2}$/, '').toLowerCase());
    if (columns[2]) ids.add(columns[2].trim());
  }
  // The index ships as `{v, count, items}`; older builds shipped a bare array.
  const list = Array.isArray(raw) ? raw : ((raw as { items?: unknown })?.items ?? []);
  const entries = (Array.isArray(list) ? list : []) as Array<Record<string, unknown>>;
  return normalizeCatalog(
    entries.filter(
      (entry) =>
        (typeof entry.n === 'string' && names.has(entry.n.toLowerCase())) ||
        (typeof entry.id === 'number' && ids.has(String(entry.id))),
    ),
  );
}

/** Install a catalog that answers without touching the network. */
function installCatalog(prepared: { items: Item[]; index: ReturnType<typeof indexItems> }): void {
  useCatalog.setState({
    status: 'ready',
    error: null,
    items: prepared.items,
    indexNames: prepared.items.map((i) => i.n),
    ...prepared.index,
    // Keeps `ensureAll` a no-op: the test owns the data, not the fetcher.
    usingFixture: true,
    revision: useCatalog.getState().revision + 1,
  });
}

function buttonLabelled(text: string): HTMLButtonElement | undefined {
  return [...document.querySelectorAll('button')].find((b) =>
    (b.textContent ?? '').includes(text),
  ) as HTMLButtonElement | undefined;
}

/** jsdom does not lay text out, so `textContent` is the only honest reading. */
function bodyText(): string {
  return document.querySelector('.invimport')?.textContent ?? '';
}

describe.skipIf(!available)('InventoryImportDialog', () => {
  const text = readFileSync(INVENTORY, 'utf8');
  const items = narrowedCatalog(JSON.parse(readFileSync(INDEX, 'utf8')), text);
  const prepared = { items, index: indexItems(items) };

  function open(props: Partial<React.ComponentProps<typeof InventoryImportDialog>> = {}) {
    installCatalog(prepared);
    const onImport = vi.fn();
    const onCancel = vi.fn();
    mount(
      <InventoryImportDialog
        characterName="Avenrae"
        newSetName="In-game gear"
        onCancel={onCancel}
        onImport={onImport}
        {...props}
      />,
    );
    return { onImport, onCancel };
  }

  it('offers nothing to import until something is pasted', () => {
    open();
    expect(buttonLabelled('Import')?.disabled).toBe(true);
    expect(document.querySelector('.invimport-table')).toBeNull();
  });

  it('previews the real export without writing anything', () => {
    const { onImport } = open();
    paste(text);
    const rows = [...document.querySelectorAll('.invimport-table tbody tr')];
    expect(rows).toHaveLength(21);
    const primary = rows.find((r) => r.querySelector('th')?.textContent === 'Primary');
    expect(primary?.textContent).toContain('Earthshaker');
    expect(primary?.textContent).toContain('+10');
    expect(onImport).not.toHaveBeenCalled();
  });

  it('names the item it could not match instead of dropping it', () => {
    open();
    paste(text);
    const bad = document.querySelector('.invimport-list-bad');
    expect(bad?.textContent).toContain('Shadow Rage Helm +5');
    expect(bad?.textContent).toContain('Head');
    // And it is nowhere in the "will be equipped" table.
    expect(document.querySelector('.invimport-table')?.textContent).not.toContain('Shadow Rage');
  });

  it('shows the exaltation donors that will be socketed', () => {
    open();
    paste(text);
    const table = document.querySelector('.invimport-table')?.textContent ?? '';
    expect(table).toContain('White Dragonscale Cloak');
    expect(table).toContain('Lute of the Gypsy Princess');
  });

  it('says which name the catalog spells differently, and why it still matched', () => {
    open();
    paste(text);
    expect(bodyText()).toContain('Matched by item id');
    expect(document.body.textContent).toContain("Djarn's Amethyst Ring");
  });

  it('keeps bags, bank and keyring out of the gear table and reports them', () => {
    open();
    paste(text);
    const table = document.querySelector('.invimport-table')?.textContent ?? '';
    for (const name of ['Spacious Rucksack', 'Bone Chips', 'Mithril Breastplate']) {
      expect(table).not.toContain(name);
    }
    expect(document.body.textContent).toContain('Inventory bags');
    expect(document.body.textContent).toContain('Keyring');
  });

  it('commits into a new set by default, and only when the button is pressed', () => {
    const { onImport } = open();
    paste(text);
    const button = buttonLabelled('Import 21 items');
    expect(button?.disabled).toBe(false);
    click(button);
    expect(onImport).toHaveBeenCalledTimes(1);
    const [result, target] = onImport.mock.calls[0] as [
      { positions: unknown[] },
      string,
    ];
    expect(target).toBe('new');
    expect(result.positions).toHaveLength(21);
  });

  it('offers to replace the set the reader came from, and passes that choice on', () => {
    const { onImport } = open({ currentSetName: 'Raid — Tank' });
    paste(text);
    const radios = [...document.querySelectorAll('.invimport-target input')] as HTMLInputElement[];
    expect(radios).toHaveLength(2);
    expect(radios[0]?.checked).toBe(true);
    click(radios[1]);
    expect(document.querySelector('.invimport-foot')?.textContent).toContain('Raid — Tank');
    click(buttonLabelled('Import 21 items'));
    expect(onImport.mock.calls[0]?.[1]).toBe('current');
  });

  it('does not offer a replace target when there is no set to replace', () => {
    open();
    paste(text);
    expect(document.querySelector('.invimport-target')).toBeNull();
    expect(document.querySelector('.invimport-foot')?.textContent).toContain('In-game gear');
  });

  it('refuses text that is not an inventory export, and says so', () => {
    const { onImport } = open();
    paste('dear diary, today I killed a rat');
    expect(document.querySelector('.invimport-table')).toBeNull();
    expect(document.body.textContent).toContain('/outputfile inventory');
    expect(buttonLabelled('Import')?.disabled).toBe(true);
    expect(onImport).not.toHaveBeenCalled();
  });

  it('clears back to an empty state', () => {
    open();
    paste(text);
    click(buttonLabelled('Clear'));
    expect(document.querySelector('.invimport-table')).toBeNull();
    expect(buttonLabelled('Import')?.disabled).toBe(true);
  });

  it('renders no NaN, undefined or [object Object] anywhere', () => {
    open({ currentSetName: 'Raid — Tank' });
    paste(text);
    const printed = document.body.textContent ?? '';
    expect(printed).not.toContain('NaN');
    expect(printed).not.toContain('undefined');
    expect(printed).not.toContain('[object Object]');
  });
});
