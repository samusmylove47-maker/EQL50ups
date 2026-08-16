/**
 * End-to-end against the real published catalog.
 *
 * `fetch` is pointed at `public/data` on disk, so this exercises the actual
 * loading path — index fetch, lazy slot shard fetch, normalisation, indexing,
 * ranking and rendering — against the 11k-item corpus rather than fixtures.
 * Skipped when the pipeline has not published anything.
 */

import { existsSync, readFileSync } from 'node:fs';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { useCatalog } from './catalog';
import { emptyState } from '../state/persistence';
import { useApp } from '../state/store';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const published = existsSync('public/data/items-index.json');

let container: HTMLDivElement;
let root: Root;
let setId = '';

function fileResponse(url: string): Response {
  const path = `public${url.startsWith('/') ? url : `/${url}`}`;
  if (!existsSync(path)) {
    return new Response('not found', { status: 404 });
  }
  return new Response(readFileSync(path, 'utf8'), { status: 200 });
}

describe.skipIf(!published)('the real catalog through the real screens', () => {
  beforeEach(async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => fileResponse(String(input))));
    useCatalog.setState({
      status: 'idle',
      items: [],
      byName: new Map(),
      bySlot: new Map(),
      shards: {},
      usingFixture: false,
      meta: null,
      error: null,
    });
    useApp.setState({ ...emptyState(), hydrated: true, storageStatus: 'ok' });
    const character = useApp.getState().createCharacter({
      name: 'Avenrae',
      level: 50,
      classes: ['WAR', 'BRD', 'BER'],
      race: null,
    });
    setId = useApp.getState().createSet(character.id, 'Main Set').id;

    window.location.hash = `#/set/${setId}`;
    container = document.createElement('div');
    document.body.appendChild(container);
    await act(async () => {
      root = createRoot(container);
      root.render(<App />);
    });
    // Let the catalog fetch settle.
    await act(async () => {
      await Promise.resolve();
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it('loads the published index at startup', () => {
    expect(useCatalog.getState().status).toBe('ready');
    expect(useCatalog.getState().items.length).toBeGreaterThan(1000);
    expect(container.textContent).toContain('items loaded');
  });

  it('lazily loads a slot shard when its picker opens, then ranks real items', async () => {
    const slot = container.querySelector<HTMLElement>('[aria-label^="Primary:"]');
    expect(slot).toBeTruthy();
    await act(async () => {
      slot?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(useCatalog.getState().shards.PRIMARY).toBe('ready');
    const options = container.querySelectorAll('[role="option"]');
    expect(options.length).toBeGreaterThan(10);

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog?.textContent).not.toMatch(/NaN/);

    // Search narrows the ranked list to real matches.
    const search = container.querySelector<HTMLInputElement>('[aria-label="Search items by name"]');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    await act(async () => {
      setter?.call(search as HTMLInputElement, 'earthshaker');
      search?.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const narrowed = container.querySelectorAll('[role="option"]');
    expect(narrowed.length).toBeGreaterThan(0);
    expect(narrowed.length).toBeLessThan(options.length);
    expect(container.textContent).toContain('Earthshaker');

    // Equipping a real item updates the doll and the stat panel without NaN.
    await act(async () => {
      narrowed[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    const equipped = useApp.getState().sets.find((s) => s.id === setId)?.slots.PRIMARY;
    expect(equipped?.itemName).toBe('Earthshaker');
    expect(container.textContent).not.toMatch(/NaN/);
  });

  it('reproduces the client-verified Earthshaker numbers at +10 in the stat panel', async () => {
    await act(async () => {
      await useCatalog.getState().ensureSlot('PRIMARY');
    });
    act(() => {
      useApp.getState().equip(setId, 'PRIMARY', 'Earthshaker', { full: 10, fraction: 0 });
    });

    const text = container.textContent ?? '';
    // 37 base damage at +10 is 74, delay never scales, and STR/STA reach 16.
    expect(text).toContain('74/70');
    expect(text).not.toMatch(/NaN/);
  });
});
