/**
 * A good share link, opened by a reader whose catalog did not load.
 *
 * The share link is the product's centrepiece: it is the whole distribution
 * mechanism, and it is what the landing page means by "the URL is the
 * product". So the one screen that reads a link has to be right about *whose*
 * fault a failure is.
 *
 * Short links intern their item names against the shipped catalog, so a reader
 * with no catalog cannot resolve them. That is a fact about the reader's
 * browser — offline, a 404, a payload not published yet — and not about the
 * link. Telling that reader the link "was made against a different build" and
 * to "ask for a fresh link" sends them to the sender for a replacement that
 * would be interned against the same catalog they still cannot fetch, and
 * would therefore fail in exactly the same way. It also contradicts the data
 * banner directly above it, which is at that moment saying the item data
 * failed to load.
 *
 * The two states are asserted apart here, because a message that is right
 * about one and wrong about the other is what shipped.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useCatalog, type CatalogStatus } from '../data/catalog';
import { resetShareDictionary } from '../data/shareDictionary';
import { buildDictionary } from '../share/dictionary';
import { encodePlan, planCharacter, type SharedPlan } from '../share/codec';
import { tier } from '../engine/upgrade';
import { SharedSet } from './SharedSet';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const NAMES = ['Earthshaker', 'Cloak of Flames', 'Jade Inlaid Coffin'];

const PLAN: SharedPlan = {
  character: planCharacter({ name: 'Avenrae', classes: ['BRD', 'WAR', 'BER'], level: 50 }),
  set: {
    name: 'Raid Set',
    slots: { PRIMARY: { itemName: 'Earthshaker', upgrade: tier(10) } },
    weights: { AC: 2 },
  },
};

/** The payload a sender's browser writes with the real catalog in hand. */
const INTERNED = encodePlan(PLAN, buildDictionary(NAMES));

function render(payload: string): string {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: Root | null = null;
  act(() => {
    root = createRoot(container);
    root.render(<SharedSet payload={payload} />);
  });
  const html = container.innerHTML;
  act(() => (root as Root | null)?.unmount());
  container.remove();
  return html;
}

/** Put the catalog in a terminal state that carries no names to intern against. */
function withoutCatalog(status: CatalogStatus): void {
  resetShareDictionary();
  useCatalog.setState({
    status,
    error: status === 'error' ? 'Failed to fetch' : null,
    items: [],
    indexNames: [],
    byName: new Map(),
    bySlot: new Map(),
    usingFixture: false,
    revision: useCatalog.getState().revision + 1,
  });
}

beforeEach(() => {
  resetShareDictionary();
});

afterEach(() => {
  resetShareDictionary();
  useCatalog.setState({ status: 'idle', error: null, items: [], indexNames: [] });
});

describe('a share link opened without a catalog', () => {
  /*
   * Both terminal no-catalog states, because the finding named only the first.
   * `missing` is a 404 or a payload not yet published and takes the identical
   * branch through the decoder — nothing in `decodeV2` can tell them apart, and
   * nothing about the advice should differ.
   */
  for (const status of ['error', 'missing'] as const) {
    it(`does not blame the link when the catalog is ${status}`, () => {
      withoutCatalog(status);
      const html = render(INTERNED);

      expect(html).not.toContain('different build of the item catalog');
      expect(html).not.toMatch(/fresh link/i);
      // The reader is told what actually happened and what would fix it.
      expect(html).toMatch(/item catalog/i);
      expect(html).toMatch(/try again/i);
    });
  }

  it('still blames the link when a catalog is loaded and disagrees', () => {
    resetShareDictionary();
    const other = ['Earthshaker', 'A Different Build Entirely'];
    useCatalog.setState({
      status: 'ready',
      error: null,
      indexNames: other,
      items: [],
      usingFixture: false,
      revision: useCatalog.getState().revision + 1,
    });
    const html = render(INTERNED);
    expect(html).toContain('different build of the item catalog');
    expect(html).toMatch(/fresh link/i);
  });

  it('waits rather than accusing anyone while the catalog is still loading', () => {
    resetShareDictionary();
    useCatalog.setState({ status: 'loading', indexNames: [], items: [] });
    const html = render(INTERNED);
    expect(html).toContain('Opening shared set');
    expect(html).not.toMatch(/fresh link/i);
  });

  it('opens a literal link with no catalog at all, which needs none', () => {
    withoutCatalog('error');
    const html = render(encodePlan(PLAN));
    expect(html).toContain('Shared set');
    expect(html).toContain('Save a copy');
  });
});
