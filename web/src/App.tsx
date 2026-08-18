import { useEffect } from 'react';
import { DataBanner } from './components/DataBanner';
import { ItemWindowLayer } from './components/ItemWindow';
import { SiteChrome, SiteFooter } from './components/SiteChrome';
import { useCatalog } from './data/catalog';
import { href, useRoute } from './router';
import { CharacterDetail } from './screens/CharacterDetail';
import { Characters } from './screens/Characters';
import { Contamination } from './screens/Contamination';
import { ItemBrowser } from './screens/ItemBrowser';
import { Landing } from './screens/Landing';
import { NewCharacter } from './screens/NewCharacter';
import { PlanarGear } from './screens/PlanarGear';
import { SetCompare } from './screens/SetCompare';
import { SetEditor } from './screens/SetEditor';
import { SharedSet } from './screens/SharedSet';
import { Sources } from './screens/Sources';
import { Upgrades } from './screens/Upgrades';
import { flushPersist, useApp } from './state/store';

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

  /*
   * Keep an open menu inside the window.
   *
   * `.menu-body` anchors to its own `<details>` — `left: 0`, or `right: 0` for
   * `.menu-body.right` — which is correct on a wide screen and wrong on a
   * phone, where the anchor can sit anywhere. Measured at 390px on the gear
   * tab: the set-actions menu rendered at x = 275…465, **75px of a 190px menu
   * past the right edge**, and a right-aligned one at −35…181, 35px past the
   * left. Neither the document nor the body scrolls horizontally, by design,
   * so those pixels were not merely ugly — they were unreachable, and half of
   * "Compare" could not be tapped.
   *
   * There is no CSS for "shift by however much room is left": the correction
   * depends on a measurement, so it is made where measurements live. A
   * translate rather than a changed `left` so the declared anchoring stays the
   * single source of truth and this only ever nudges it; the value is written
   * back to `0px` on close, so nothing accumulates.
   */
  useEffect(() => {
    const GUTTER = 8;
    const clamp = () => {
      for (const body of document.querySelectorAll<HTMLElement>('details.menu[open] .menu-body')) {
        body.style.transform = 'translateX(0px)';
        const box = body.getBoundingClientRect();
        const width = document.documentElement.clientWidth;
        let shift = 0;
        if (box.right > width - GUTTER) shift = width - GUTTER - box.right;
        // Left wins if both edges overflow: a menu wider than the window is
        // clipped at its end, never at its start, so the first item is legible.
        if (box.left + shift < GUTTER) shift = GUTTER - box.left;
        if (shift) body.style.transform = `translateX(${Math.round(shift)}px)`;
      }
    };
    document.addEventListener('toggle', clamp, true);
    window.addEventListener('resize', clamp);
    return () => {
      document.removeEventListener('toggle', clamp, true);
      window.removeEventListener('resize', clamp);
    };
  }, []);

  return (
    <div className="app">
      {/*
        The site's own frame, not a lookalike of it: wordmark, section nav,
        breadcrumb and footer are read off eqlsource.com and point back into
        it. This tool is one page of that site — see `components/SiteChrome`.
      */}
      <SiteChrome route={route} />

      <main className="page">
        <StorageWarning />
        <DataBanner />

        {route.name === 'landing' ? <Landing /> : null}
        {route.name === 'characters' ? <Characters /> : null}
        {route.name === 'new-character' ? <NewCharacter /> : null}
        {route.name === 'character' ? <CharacterDetail id={route.id} /> : null}
        {route.name === 'items' ? <ItemBrowser /> : null}
        {route.name === 'planar' ? <PlanarGear /> : null}
        {route.name === 'sources' ? <Sources /> : null}
        {route.name === 'contamination' ? <Contamination /> : null}
        {route.name === 'set' ? <SetEditor id={route.id} tab={route.tab} /> : null}
        {route.name === 'set-compare' ? <SetCompare id={route.id} id2={route.id2} /> : null}
        {route.name === 'upgrades' ? <Upgrades id={route.id} /> : null}
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

      <SiteFooter />

      {/* One floating item window for the whole app; see components/ItemWindow. */}
      <ItemWindowLayer />
    </div>
  );
}
