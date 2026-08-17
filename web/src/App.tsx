import { useEffect } from 'react';
import { CatalogFootnote, DataBanner } from './components/DataBanner';
import { ItemWindowLayer } from './components/ItemWindow';
import { useCatalog } from './data/catalog';
import { href, useRoute } from './router';
import { CharacterDetail } from './screens/CharacterDetail';
import { Characters } from './screens/Characters';
import { ItemBrowser } from './screens/ItemBrowser';
import { Landing } from './screens/Landing';
import { NewCharacter } from './screens/NewCharacter';
import { SetCompare } from './screens/SetCompare';
import { SetEditor } from './screens/SetEditor';
import { SharedSet } from './screens/SharedSet';
import { flushPersist, useApp } from './state/store';

const NAV = [
  { href: href.landing, label: 'Home', match: ['landing'] },
  {
    href: href.characters,
    label: 'Characters',
    match: ['characters', 'new-character', 'character', 'set', 'set-compare'],
  },
  { href: href.items, label: 'Items', match: ['items'] },
];

function StorageWarning() {
  const status = useApp((s) => s.storageStatus);
  if (status === 'ok' || status === 'empty') return null;

  const text =
    status === 'quota'
      ? 'Your browser storage is full, so recent changes were not saved. Export your sets to JSON, then remove some saved data.'
      : status === 'corrupt'
        ? 'The saved library could not be read and has been set aside; the planner started fresh.'
        : 'This browser is not allowing local storage, so nothing will be remembered after you close the tab. Share links and JSON export still work.';

  return (
    <div className="notice notice-warn" role="status">
      <span>{text}</span>
    </div>
  );
}

export function App() {
  const route = useRoute();
  const hydrate = useApp((s) => s.hydrate);
  const loadCatalog = useCatalog((s) => s.load);

  useEffect(() => {
    hydrate();
    void loadCatalog();
  }, [hydrate, loadCatalog]);

  // Saves are debounced, so a reload or a closed tab within that window would
  // otherwise drop the last edit. Flush whenever the page is going away.
  useEffect(() => {
    const flush = () => flushPersist();
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flushPersist();
    };
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', flush);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  // Native <details> menus stay open until told otherwise; close them when the
  // user clicks away, chooses an entry, or presses Escape.
  useEffect(() => {
    const menus = () => document.querySelectorAll<HTMLDetailsElement>('details.menu[open]');
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      for (const menu of menus()) {
        if (!menu.contains(target) || target.closest('.menu-item')) menu.open = false;
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      for (const menu of menus()) menu.open = false;
    };
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href={href.landing}>
          EQL <em>Upgrades</em>
        </a>
        <nav aria-label="Primary">
          {NAV.map((entry) => (
            <a
              key={entry.href}
              href={entry.href}
              aria-current={entry.match.includes(route.name) ? 'page' : undefined}
            >
              {entry.label}
            </a>
          ))}
        </nav>
      </header>

      <main className="page">
        <StorageWarning />
        <DataBanner />

        {route.name === 'landing' ? <Landing /> : null}
        {route.name === 'characters' ? <Characters /> : null}
        {route.name === 'new-character' ? <NewCharacter /> : null}
        {route.name === 'character' ? <CharacterDetail id={route.id} /> : null}
        {route.name === 'items' ? <ItemBrowser /> : null}
        {route.name === 'set' ? <SetEditor id={route.id} tab={route.tab} /> : null}
        {route.name === 'set-compare' ? <SetCompare id={route.id} id2={route.id2} /> : null}
        {route.name === 'share' ? <SharedSet payload={route.payload} /> : null}
        {route.name === 'not-found' ? (
          <div className="empty-state">
            <h2>Nothing here</h2>
            <p>
              <code>#/{route.path}</code> is not a page in this planner.
            </p>
            <div className="empty-actions">
              <a className="btn btn-primary" href={href.landing}>
                Back to the planner
              </a>
            </div>
          </div>
        ) : null}
      </main>

      <footer className="footer">
        <CatalogFootnote />
        <span>Sets are stored in this browser only.</span>
      </footer>

      {/* One floating item window for the whole app; see components/ItemWindow. */}
      <ItemWindowLayer />
    </div>
  );
}
