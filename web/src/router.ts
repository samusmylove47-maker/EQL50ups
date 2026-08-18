/**
 * Hash routing.
 *
 * Deliberately hash-based and hand-rolled: the app is deployed to GitHub Pages
 * with no server to rewrite paths, and share links have to survive being
 * pasted into Discord. No router dependency earns its bytes for six routes.
 */

import { useEffect, useState } from 'react';

export type Route =
  | { name: 'landing' }
  | { name: 'characters' }
  | { name: 'new-character' }
  | { name: 'character'; id: string }
  | { name: 'set'; id: string; tab: SetTab }
  /** A/B diff, per DESIGN.md §3: `/set/{id}/compare/{id2}`. */
  | { name: 'set-compare'; id: string; id2: string }
  /**
   * Ranked upgrades for one set: `/set/{id}/upgrades`. An empty id means
   * `#/upgrades`, which resolves to the set you were last editing and rewrites
   * itself to the explicit form so the answer can be linked.
   */
  | { name: 'upgrades'; id: string }
  | { name: 'items' }
  /**
   * Planar armour targets across all five sets a trio can draw on — the site's
   * own Planar gear targets, absorbed, and since withdrawn there, so this route
   * is now the only place it exists. A top-level route rather than a
   * tab on a gear set because it answers a question you can ask before you have
   * saved anything: "of the eighteen planar sets, which pieces are mine".
   */
  | { name: 'planar' }
  /**
   * Where every number on screen came from, and what is known to be wrong with
   * it. A route rather than a section of a README because
   * `research/SOURCING-STANDARD.md` rule 5 puts uncertainty on screen, and
   * because `meta.dataReliability` is already in the browser's memory.
   */
  | { name: 'sources' }
  /**
   * What this repository's own contamination scanner finds in this repository.
   * A sibling of `sources` rather than a section of it: Sources says where the
   * numbers came from, this says which of them carry a convention from a game
   * whose mechanics changed, counted, with our own faults first.
   */
  | { name: 'contamination' }
  | { name: 'share'; payload: string }
  | { name: 'not-found'; path: string };

export const SET_TABS = ['gear', 'exaltations', 'weights'] as const;
export type SetTab = (typeof SET_TABS)[number];

function isSetTab(value: string | undefined): value is SetTab {
  return SET_TABS.includes((value ?? '') as SetTab);
}

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, '').replace(/^\/+/, '');
  const parts = path.split('/').filter(Boolean);
  const [head, second, third, fourth] = parts;

  if (!head) return { name: 'landing' };
  if (head === 'characters') return { name: 'characters' };
  if (head === 'character' && second === 'new') return { name: 'new-character' };
  if (head === 'character' && second) return { name: 'character', id: decodeURIComponent(second) };
  if (head === 'items') return { name: 'items' };
  if (head === 'planar') return { name: 'planar' };
  if (head === 'sources') return { name: 'sources' };
  if (head === 'contamination') return { name: 'contamination' };
  if (head === 'upgrades') return { name: 'upgrades', id: '' };
  // Checked before the tab branch for the reason `compare` is: `upgrades` is
  // not a `SetTab`, so without this it would fall through and quietly render
  // the gear tab under an URL that promises something else.
  if (head === 'set' && second && third === 'upgrades') {
    return { name: 'upgrades', id: decodeURIComponent(second) };
  }
  // `compare` is checked before the tab branch: without it `#/set/a/compare/b`
  // fell through to `isSetTab('compare') === false` and quietly rendered the
  // gear tab, which is how a declared route can look implemented and not be.
  if (head === 'set' && second && third === 'compare') {
    return {
      name: 'set-compare',
      id: decodeURIComponent(second),
      // An absent second id is legal: the screen then asks which set to compare.
      id2: fourth ? decodeURIComponent(fourth) : '',
    };
  }
  if (head === 'set' && second) {
    return { name: 'set', id: decodeURIComponent(second), tab: isSetTab(third) ? third : 'gear' };
  }
  if (head === 'share' && second) return { name: 'share', payload: second };
  return { name: 'not-found', path };
}

export function currentRoute(): Route {
  if (typeof window === 'undefined') return { name: 'landing' };
  return parseHash(window.location.hash);
}

export function navigate(to: string, options: { replace?: boolean } = {}): void {
  if (typeof window === 'undefined') return;
  const hash = to.startsWith('#') ? to : `#${to.startsWith('/') ? to : `/${to}`}`;
  if (window.location.hash === hash) return;
  if (options.replace) {
    window.history.replaceState(null, '', hash);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    window.location.hash = hash;
  }
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(currentRoute);
  useEffect(() => {
    const onChange = () => {
      setRoute(currentRoute());
      if (window.scrollY > 0) window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export const href = {
  landing: '#/',
  characters: '#/characters',
  newCharacter: '#/character/new',
  character: (id: string) => `#/character/${encodeURIComponent(id)}`,
  items: '#/items',
  planar: '#/planar',
  sources: '#/sources',
  contamination: '#/contamination',
  set: (id: string, tab: SetTab = 'gear') => (tab === 'gear' ? `#/set/${id}` : `#/set/${id}/${tab}`),
  compare: (id: string, id2 = '') =>
    id2 ? `#/set/${id}/compare/${encodeURIComponent(id2)}` : `#/set/${id}/compare`,
  upgrades: (id = '') => (id ? `#/set/${encodeURIComponent(id)}/upgrades` : '#/upgrades'),
};
