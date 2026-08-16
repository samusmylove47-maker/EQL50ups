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
  | { name: 'set'; id: string; tab: SetTab }
  | { name: 'items' }
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
  const [head, second, third] = parts;

  if (!head) return { name: 'landing' };
  if (head === 'characters') return { name: 'characters' };
  if (head === 'character' && second === 'new') return { name: 'new-character' };
  if (head === 'items') return { name: 'items' };
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
  items: '#/items',
  set: (id: string, tab: SetTab = 'gear') => (tab === 'gear' ? `#/set/${id}` : `#/set/${id}/${tab}`),
};
