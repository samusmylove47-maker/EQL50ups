/**
 * The breadcrumb has to say where you are.
 *
 * It read `EQL Source / Tools / 50 Upgrades` on all ten routes, so its deepest
 * segment was a label for the tool rather than a position inside it — a trail
 * that encodes nothing, which `DESIGN.md` says a mark must not be.
 *
 * Two things are pinned here, and they fail in different ways:
 *
 *  - **every route names itself.** `tsc` already refuses a `Route` member that
 *    `screenName` does not handle, because the switch has no `default`. What
 *    `tsc` cannot see is a member handled by returning `null`, which is the
 *    landing's answer and would silently give a new route a three-segment
 *    trail. So the table below lists the union explicitly and `null` is legal
 *    for exactly one entry;
 *  - **the rendered trail agrees**, at four real routes, including that the
 *    tool's name turns into a link once it stops being where you are.
 */

import { readFileSync } from 'node:fs';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../App';
import { screenName, TOOL_NAME } from './SiteChrome';
import { useCatalog } from '../data/catalog';
import { emptyState } from '../state/persistence';
import { useApp } from '../state/store';
import type { Route } from '../router';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/**
 * One sample of every `Route` member, with the segment it must produce.
 *
 * Written out rather than generated: a generator would derive the expectation
 * from the same code under test, which pins nothing.
 */
const ROUTES: ReadonlyArray<[Route, string | null]> = [
  [{ name: 'landing' }, null],
  [{ name: 'characters' }, 'Characters'],
  [{ name: 'new-character' }, 'New character'],
  [{ name: 'character', id: 'c1' }, 'Character'],
  [{ name: 'set', id: 's1', tab: 'gear' }, 'Gear'],
  [{ name: 'set', id: 's1', tab: 'exaltations' }, 'Exaltations'],
  [{ name: 'set', id: 's1', tab: 'weights' }, 'Weights'],
  [{ name: 'set-compare', id: 's1', id2: 's2' }, 'Compare sets'],
  [{ name: 'upgrades', id: 's1' }, 'Upgrades'],
  [{ name: 'items' }, 'Items'],
  [{ name: 'planar' }, 'Planar'],
  [{ name: 'sources' }, 'Sources'],
  [{ name: 'contamination' }, 'What the scanner finds'],
  [{ name: 'share', payload: 'abc' }, 'Shared set'],
  [{ name: 'not-found', path: '/nope' }, 'Not found'],
];

/** Null until a test renders — the first test here is pure and does not. */
let container: HTMLDivElement | null = null;
let root: Root | null = null;

/** Returns the mount, so a test gets a non-null handle without re-checking. */
function render(hash: string): HTMLDivElement {
  window.location.hash = hash;
  const el = document.createElement('div');
  document.body.appendChild(el);
  container = el;
  act(() => {
    root = createRoot(el);
    root.render(<App />);
  });
  return el;
}

/** The trail's segments, in order, as a reader would read them. */
function crumb(): string[] {
  const el = container?.querySelector('.crumb');
  return [...(el?.children ?? [])]
    .filter((node) => node.getAttribute('aria-hidden') !== 'true')
    .map((node) => (node.textContent ?? '').trim());
}

beforeEach(() => {
  useCatalog.getState().loadFixture();
  useApp.setState({ ...emptyState(), hydrated: true, storageStatus: 'ok' });
});

afterEach(() => {
  const mounted = root;
  if (mounted) act(() => mounted.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe('the breadcrumb carries the current screen', () => {
  it('names every route, and only the landing declines to', () => {
    const named = ROUTES.map(([route, expected]) => [route.name, screenName(route), expected]);
    for (const [name, actual, expected] of named) {
      expect(actual, `${String(name)} names itself`).toBe(expected);
    }
    // The one null is the landing's, not a route that fell through.
    expect(
      ROUTES.filter(([route]) => screenName(route) === null).map(([route]) => route.name),
      'exactly one route has no screen segment',
    ).toEqual(['landing']);
  });

  it('stops at the tool on the tool’s own landing', () => {
    render('#/');
    expect(crumb()).toEqual(['EQL Source', 'Tools', TOOL_NAME]);
  });

  it('adds a fourth segment on a deeper screen', () => {
    render('#/items');
    expect(crumb()).toEqual(['EQL Source', 'Tools', TOOL_NAME, 'Items']);
  });

  it('turns the tool’s name into a way back once it is not where you are', () => {
    const el = render('#/planar');
    const links = [...el.querySelectorAll('.crumb a')].map((a) => [
      (a.textContent ?? '').trim(),
      a.getAttribute('href'),
    ]);
    expect(links).toEqual([
      ['EQL Source', 'https://eqlsource.com/'],
      ['Tools', 'https://eqlsource.com/tools/'],
      // This app's own front page, not the site's page about this app.
      [TOOL_NAME, '#/'],
    ]);
    expect(el.querySelector('.crumb-here')?.textContent).toBe('Planar');
  });

  it('names the failure rather than going quiet on an unknown route', () => {
    render('#/no-such-page');
    expect(crumb().at(-1)).toBe('Not found');
  });
});

/**
 * The page's own name, against the name the project uses.
 *
 * `index.html` carried `50 Upgrades` in its `<title>`, `og:title` and
 * description while every other surface — nav, breadcrumb, footer, 701 files
 * across the site — said `=Upgrades`. The owner's account of the sigil is that
 * `=` stands for E-Q-L-S, read "equals", so `=Upgrades` and "EQLS Upgrades" are
 * one name; this page was the only thing using a third.
 *
 * Pinned against `TOOL_NAME` rather than against a literal, so renaming the
 * constant renames the page and nothing has to be remembered.
 */
describe('the page title uses the name the project uses', () => {
  const html = readFileSync('index.html', 'utf8');
  const rendered = html.replace(/<!--[\s\S]*?-->/g, '');

  it('titles the document with TOOL_NAME', () => {
    expect(rendered).toContain(`<title>${TOOL_NAME} — EQL Source</title>`);
    expect(rendered).toContain(`content="${TOOL_NAME} — EQL Source"`);
  });

  it('uses no other name for the tool in anything a reader or crawler sees', () => {
    // The og: and description fields are read by people and by link unfurlers,
    // so a second name there is the same defect as one in the title.
    const head = /<head>([\s\S]*?)<\/head>/.exec(rendered)?.[1] ?? '';
    expect(head, 'the head must be found').not.toBe('');
    expect(head, 'a name the project does not use').not.toMatch(/50 Upgrades/);
  });
});
