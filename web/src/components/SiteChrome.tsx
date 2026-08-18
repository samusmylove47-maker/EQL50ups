/**
 * Site chrome — the frame that makes this a page *of* eqlsource.com.
 *
 * This planner is not a standalone site. It is one of three flagship tools on
 * eqlsource.com, alongside Sky Ledger and the overlay, and it replaces three
 * pages that site has since withdrawn: the Character sheet, the Planar gear
 * targets and the Inventory reader. All three now 301 to `/tools/50-upgrades`
 * — `curl -o /dev/null -w '%{http_code} %{redirect_url}'`, 2026-08-18. The
 * Index is *not* among them; it is still served, and it is still in the nav
 * below. A reader who arrives here from `/tools/` should not feel the floor
 * change, and — more importantly — should be able to walk back out.
 *
 * Everything below is read off the live site rather than inferred:
 * `https://eqlsource.com/assets/site.css` and `/tools/index.html`, fetched
 * 2026-08-18. The wordmark is `EQL Source` in Cinzel beside `SURVEY` in mono;
 * the nav is seven items; the breadcrumb is `EQL Source / Tools / <tool>`; the
 * footer is a five-column link grid, a finding-report block and a legal line.
 * Class names are theirs too — `.site-bar`, `.shell`, `.mark`, `.site-nav`,
 * `.crumb`, `.site-foot`, `.foot-grid`, `.foot-contact`, `.foot-legal` — so
 * that anyone holding both stylesheets can diff them.
 *
 * **Every link that leaves this tool is an absolute `https://eqlsource.com/…`
 * URL**, because this app is served from its own origin during development and
 * a relative `../dungeons/index.html` would resolve to nothing. The sections
 * this app does not own are the site's; the sections it does own are hashes.
 *
 * What is *not* copied: the site's own tool pages have no second bar, because
 * each of them is a single document. This one has ten routes, so the
 * breadcrumb shares a rail with the tool's own navigation. The rail says where
 * you are on the site; the links beside it say where you can go inside the
 * tool.
 */

import { useEffect, useState } from 'react';
import { href, type Route } from '../router';
import { CatalogFootnote } from './DataBanner';
import './SiteChrome.css';

const SITE = 'https://eqlsource.com';

/*
 * The three outbound links the chrome writes outside a list: the wordmark, the
 * first breadcrumb step, and the second. Named rather than inlined so that
 * `CHROME_LINKS` below is genuinely *every* eqlsource.com href this component
 * can emit — an offline pin that only covered the links that happen to live in
 * arrays would pass while a hand-typed one carried the `.html` form.
 */
const SITE_HOME = `${SITE}/`;
const SITE_TOOLS_INDEX = `${SITE}/tools/`;
/** Also the last entry of the Learn column; one constant, so they cannot part. */
const SITE_STILL_TRUE = `${SITE}/learn/still-true`;

/**
 * The masthead nav, verbatim from `/tools/index.html`. `Tools` is marked as the
 * current section because that is the section this tool lives in — the site
 * marks it the same way, with `a[aria-current]`.
 */
export const SITE_NAV: ReadonlyArray<{ href: string; label: string; here?: boolean; find?: boolean }> = [
  { href: `${SITE}/dungeons/`, label: 'Dungeons' },
  { href: `${SITE}/raids/`, label: 'Raids' },
  { href: SITE_TOOLS_INDEX, label: 'Tools', here: true },
  { href: `${SITE}/tools/index-search`, label: 'The Index' },
  { href: `${SITE}/learn/`, label: 'Learn' },
  { href: `${SITE}/sources`, label: 'Accuracy' },
  { href: `${SITE}/search`, label: 'Search', find: true },
];

/**
 * This tool's own pages. Moved here from `App.tsx` with the rest of the
 * chrome: the shell should be one component, not a header in one file and a
 * footer in another.
 */
const TOOL_NAV: ReadonlyArray<{ href: string; label: string; match: string[] }> = [
  { href: href.landing, label: 'Home', match: ['landing'] },
  {
    href: href.characters,
    label: 'Characters',
    match: ['characters', 'new-character', 'character', 'set', 'set-compare'],
  },
  /*
   * The ranked upgrade list, for the set you were last editing. It is a
   * top-level destination rather than a fourth tab on the set because it is the
   * question people arrive with — "where is my biggest gain" — and a screen you
   * can only reach from inside the thing it ranks is a screen most readers
   * never find.
   */
  { href: href.upgrades(), label: 'Upgrades', match: ['upgrades'] },
  /*
   * The site's own Planar gear targets, absorbed. That page has since been
   * withdrawn — `/tools/planar-gear` 301s here — so this rail entry is now the
   * only place it exists. It sits in the rail rather than under a set because
   * the question it answers — which planar pieces are open to my trio — is one
   * a reader arrives with, before they have saved a character.
   */
  { href: href.planar, label: 'Planar', match: ['planar'] },
  { href: href.items, label: 'Items', match: ['items'] },
];

/** The name this tool is published under on the site's `/tools/` index. */
export const TOOL_NAME = '50 Upgrades';

/**
 * The site's tool set — the footer's `Tools` column, and a hand-copy of the
 * `Tools` column in the footer `https://eqlsource.com/tools/` serves. Label,
 * URL and order are that column's, read 2026-08-18; `site-foot-drift.test.ts`
 * checks the copy against the original and skips loudly when it cannot reach
 * it.
 *
 * It held eight entries. Three of them — `/tools/character`,
 * `/tools/planar-gear`, `/tools/inventory` — were withdrawn and now 301 to
 * `/tools/50-upgrades.html`, which 307s to `/tools/50-upgrades`: two hops to a
 * page about *this* tool. They did not break, which is exactly why they
 * survived a pass. A footer that offers a reader three pages the site has
 * taken down is stale whether or not the redirect rule is still there to
 * catch them.
 *
 * And it did not list this tool at all — checked before it was fixed:
 * `grep -n '50-upgrades' SiteChrome.tsx` returned nothing. The one page in the
 * site's tool index that this tool is in a position to know about first-hand
 * was the one page it left out of the index it publishes.
 *
 * **How this tool lists itself.** As a link, to the site's own page for it, and
 * marked `aria-current`. Three things decided that, in order:
 *
 *  - `/tools/50-upgrades` is a real document and a real destination — 200, and
 *    the site's own account of this planner rather than the planner itself, so
 *    the link goes somewhere a reader cannot already be. It is not a link to
 *    nowhere and it is not a link to here.
 *  - the site's own `/tools/50-upgrades` page links itself from this same
 *    column, so a plain link is that column's convention, not a lapse in it.
 *  - but a reader standing inside the tool should be told which of the six they
 *    are in, and the masthead already has a device for exactly that. This is
 *    `aria-current="true"` — "the current item of a set" — not `"page"`, which
 *    would claim the link's target is the document you are reading. It is not.
 *
 * Every href is extensionless. The `.html` form 307s, and all 32 of this
 * chrome's outbound links were moved off it deliberately; `CHROME_LINKS` pins
 * that.
 */
export const SITE_TOOLS: ReadonlyArray<{ href: string; label: string; here?: boolean }> = [
  { href: `${SITE}/tools/index-search`, label: 'The Index' },
  { href: `${SITE}/tools/sky-ledger`, label: 'Sky Ledger' },
  { href: `${SITE}/tools/50-upgrades`, label: TOOL_NAME, here: true },
  { href: `${SITE}/tools/race-unlocks`, label: 'Race unlock tracker' },
  { href: `${SITE}/tools/combo-calculator`, label: 'Race and primary calculator' },
  { href: `${SITE}/tools/faction-impact`, label: 'Faction impact checker' },
];

/* ------------------------------------------------------------- masthead */

/**
 * The whole frame above the page: the site's masthead, then the tool's own
 * rail. One component, so the two stick together — literally, on a desktop.
 */
export function SiteChrome({ route }: { route: Route }) {
  return (
    <div className="chrome">
      <SiteBar route={route} />
      <ToolBar route={route} />
    </div>
  );
}

function SiteBar({ route }: { route: Route }) {
  const [open, setOpen] = useState(false);

  // The mobile nav is a panel hanging off the bar, so a route change has to
  // close it — otherwise it covers the screen you just asked for.
  useEffect(() => setOpen(false), [route.name]);

  return (
    <header className="site-bar">
      <div className="shell">
        <a className="mark" href={SITE_HOME}>
          <span className="m1">EQL Source</span>
          <span className="m2">Survey</span>
        </a>
        <button
          type="button"
          className="burger"
          aria-expanded={open}
          aria-controls="site-nav"
          onClick={() => setOpen((v) => !v)}
        >
          Menu
        </button>
        <nav
          className={`site-nav${open ? ' open' : ''}`}
          id="site-nav"
          aria-label="EQL Source"
        >
          {SITE_NAV.map((entry) => (
            <a
              key={entry.href}
              href={entry.href}
              className={entry.find ? 'nav-find' : undefined}
              aria-current={entry.here ? 'true' : undefined}
            >
              {entry.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}

/* ------------------------------------------------------- breadcrumb rail */

function ToolBar({ route }: { route: Route }) {
  return (
    <div className="tool-bar">
      <div className="shell">
        {/* Their separator is `&nbsp;/&nbsp;`, which is what gives the trail
            its air at this tracking. A plain space collapses against the
            .24em and the slashes crowd the words. */}
        <p className="crumb">
          <a href={SITE_HOME}>EQL Source</a>
          <span aria-hidden="true">{'\u00a0/\u00a0'}</span>
          <a href={SITE_TOOLS_INDEX}>Tools</a>
          <span aria-hidden="true">{'\u00a0/\u00a0'}</span>
          <span className="crumb-here">{TOOL_NAME}</span>
        </p>
        <nav className="tool-nav" aria-label="Primary">
          {TOOL_NAV.map((entry) => (
            <a
              key={entry.href}
              href={entry.href}
              aria-current={entry.match.includes(route.name) ? 'page' : undefined}
            >
              {entry.label}
            </a>
          ))}
        </nav>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- footer */

interface Column {
  head: string;
  links: ReadonlyArray<{ href: string; label: string; here?: boolean }>;
}

const FOOT: ReadonlyArray<Column> = [
  {
    head: 'This tool',
    links: [
      { href: href.landing, label: 'What it does' },
      /*
       * Not "Your characters", which is what the empty state's own button
       * says. Two links with byte-identical accessible names pointing at the
       * same page is one ambiguous target for anybody reading by name rather
       * than by position, and a strict-mode violation in the browser suite is
       * how it announced itself.
       */
      { href: href.characters, label: 'Characters and sets' },
      { href: href.upgrades(), label: 'Ranked upgrades' },
      { href: href.items, label: 'Item browser' },
      /*
       * The site's Learn column links its own contamination page; this is the
       * same scan run against this tool's catalog and this tool's code, so it
       * belongs in the column that is about this tool rather than beside the
       * site's copy, which measures something else.
       */
      { href: href.contamination, label: 'What the scanner finds here' },
    ],
  },
  /* The six the site publishes, in its order. See `SITE_TOOLS`. */
  { head: 'Tools', links: SITE_TOOLS },
  {
    head: 'Dungeons',
    links: [
      { href: `${SITE}/dungeons/`, label: 'All surveys' },
      { href: `${SITE}/dungeons/najena`, label: 'Najena' },
      { href: `${SITE}/dungeons/lowerguk`, label: 'Lower Guk' },
      { href: `${SITE}/dungeons/mistmoore`, label: 'Castle Mistmoore' },
      { href: `${SITE}/items/`, label: 'Every item' },
      { href: `${SITE}/named/`, label: 'Every named mob' },
      { href: `${SITE}/sets/`, label: 'Every planar set' },
    ],
  },
  {
    head: 'Raids',
    links: [
      { href: `${SITE}/raids/`, label: 'Encounter index' },
      { href: `${SITE}/raids/plane-of-sky`, label: 'Plane of Sky, island by island' },
    ],
  },
  {
    head: 'Learn',
    links: [
      { href: SITE_STILL_TRUE, label: 'Is it still true?' },
      { href: `${SITE}/learn/difficulty`, label: 'What difficulty changes' },
      { href: `${SITE}/learn/motes`, label: 'Motes' },
      { href: `${SITE}/learn/raid-access`, label: 'How raid access works' },
      { href: `${SITE}/learn/deity`, label: 'Deity, and the level 11 lock' },
      { href: `${SITE}/learn/reading-the-plans`, label: 'Reading a floor plan' },
      { href: `${SITE}/learn/contamination`, label: 'Contamination' },
    ],
  },
  {
    head: 'About',
    links: [
      { href: `${SITE}/search`, label: 'Search the site' },
      { href: `${SITE}/data/`, label: 'Public data' },
      { href: `${SITE}/credits`, label: 'Credits' },
      { href: `${SITE}/archive/`, label: 'The original plates' },
      { href: `${SITE}/sources`, label: 'Sourcing standard' },
      { href: `${SITE}/sources#gaps`, label: 'Known gaps' },
      { href: `${SITE}/sources#changelog`, label: 'Change log' },
    ],
  },
];

/** The site's own finding form, from its footer. */
const FINDING =
  'https://github.com/samusmylove47-maker/eql-source/issues/new?template=finding.yml';

/**
 * Every `eqlsource.com` href this component can render, in one list, so a unit
 * test can pin properties of the whole set without a browser.
 *
 * The filter is the same one `e2e/routes.spec.ts` uses on the rendered DOM —
 * `a[href^="https://eqlsource.com"]` — so the two agree on what counts as a
 * chrome link. `href.landing` and its siblings are in-app hashes and are not
 * outbound; `FINDING` is GitHub's and is not the site's.
 *
 * Three counts, none of which is the other two, so that nobody reconciles them
 * by adjusting one:
 *
 *  - **39** entries here, because the nav and the footer are allowed to offer
 *    the same page and do: `/tools/`, `/tools/index-search`, `/dungeons/`,
 *    `/raids/`, `/sources`, `/search` and `/learn/still-true` are each written
 *    twice;
 *  - **32** distinct destinations, which is the number the drift and `.html`
 *    assertions are about and the number `routes.spec.ts`'s comment cites;
 *  - **40** matching anchors in the built page, one more than 39 because
 *    `${SITE}/` is written once and rendered twice — the wordmark and the first
 *    breadcrumb step.
 *
 * Measured together against the current file rather than carried forward:
 * `CHROME_LINKS.length`, `new Set(CHROME_LINKS).size`, and
 * `document.querySelectorAll('a[href^="https://eqlsource.com"]').length` on a
 * `VITE_BASE=/EQL50ups/` preview at 1440 and at 390.
 */
export const CHROME_LINKS: ReadonlyArray<string> = [
  SITE_HOME,
  SITE_TOOLS_INDEX,
  SITE_STILL_TRUE,
  ...SITE_NAV.map((entry) => entry.href),
  ...FOOT.flatMap((column) => column.links.map((link) => link.href)),
].filter((link) => link.startsWith(SITE));

export function SiteFooter() {
  return (
    <footer className="site-foot">
      <div className="shell">
        <div className="foot-grid">
          {FOOT.map((column) => (
            <div key={column.head}>
              <h4>{column.head}</h4>
              <ul>
                {column.links.map((link) => (
                  <li key={`${column.head}:${link.href}:${link.label}`}>
                    {/* `true`, not `page`: this marks the current item of a
                        set, and the href's target is a different document
                        from the one being read. See `SITE_TOOLS`. */}
                    <a href={link.href} aria-current={link.here ? 'true' : undefined}>
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/*
          The catalog's own account of itself, and the door to the page that
          explains it. This is the only link in the footer whose name contains
          "sources", deliberately: the About column's entry is the *site's*
          sourcing standard, this one is what these numbers actually are.
        */}
        <p className="foot-build">
          <CatalogFootnote />
          <span>Sets are stored in this browser only.</span>
        </p>

        {/* Verbatim from the site's own footer, because the invitation is the
            same invitation and the credit is the same credit. */}
        <div className="foot-contact">
          <p>
            <strong>Found something the site gets wrong, or something the wiki does?</strong> That
            is the most useful thing anyone can send us, and every finding is credited by name.{' '}
            <a href={FINDING}>Send a finding</a> ·{' '}
            <a href={SITE_STILL_TRUE}>see what is already open</a>.
          </p>
          <p className="foot-nolog">
            Please do not attach a combat log to a public issue — they can carry private chat. Say
            you have one and we will ask.
          </p>
        </div>

        <p className="foot-legal">
          Every claim on this site names its source and the date that source was read. Where a
          source is uncertain, contradicted or stale, the page says so rather than smoothing it
          over.
          <br />
          Unofficial fan resource. Not affiliated with or endorsed by Daybreak Game Company, Game
          Jawn or Darkpaw Studios. EverQuest is a registered trademark of Daybreak Game Company LLC.
        </p>
      </div>
    </footer>
  );
}
