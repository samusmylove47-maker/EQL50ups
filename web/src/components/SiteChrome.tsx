/**
 * Site chrome — the frame that makes this a page *of* eqlsource.com.
 *
 * This planner is not a standalone site. It is one of three flagship tools on
 * eqlsource.com, alongside Sky Ledger and the overlay, and it is meant to
 * replace that site's Planar gear targets, Inventory reader and The Index. A
 * reader who arrives here from `/tools/` should not feel the floor change, and
 * — more importantly — should be able to walk back out.
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

/**
 * The masthead nav, verbatim from `/tools/index.html`. `Tools` is marked as the
 * current section because that is the section this tool lives in — the site
 * marks it the same way, with `a[aria-current]`.
 */
const SITE_NAV: ReadonlyArray<{ href: string; label: string; here?: boolean; find?: boolean }> = [
  { href: `${SITE}/dungeons/index.html`, label: 'Dungeons' },
  { href: `${SITE}/raids/index.html`, label: 'Raids' },
  { href: `${SITE}/tools/index.html`, label: 'Tools', here: true },
  { href: `${SITE}/tools/index-search.html`, label: 'The Index' },
  { href: `${SITE}/learn/index.html`, label: 'Learn' },
  { href: `${SITE}/sources.html`, label: 'Accuracy' },
  { href: `${SITE}/search.html`, label: 'Search', find: true },
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
   * The site's own `/tools/planar-gear.html`, absorbed. It sits in the rail
   * rather than under a set because the question it answers — which planar
   * pieces are open to my trio — is one a reader arrives with, before they have
   * saved a character.
   */
  { href: href.planar, label: 'Planar', match: ['planar'] },
  { href: href.items, label: 'Items', match: ['items'] },
];

/** The name this tool is published under on the site's `/tools/` index. */
export const TOOL_NAME = '50 Upgrades';

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
        <a className="mark" href={`${SITE}/index.html`}>
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
          <a href={`${SITE}/index.html`}>EQL Source</a>
          <span aria-hidden="true">{'\u00a0/\u00a0'}</span>
          <a href={`${SITE}/tools/index.html`}>Tools</a>
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
  links: ReadonlyArray<{ href: string; label: string }>;
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
  {
    head: 'Tools',
    links: [
      { href: `${SITE}/tools/character.html`, label: 'Character sheet' },
      { href: `${SITE}/tools/index-search.html`, label: 'The Index' },
      { href: `${SITE}/tools/sky-ledger.html`, label: 'Sky Ledger' },
      { href: `${SITE}/tools/race-unlocks.html`, label: 'Race unlock tracker' },
      { href: `${SITE}/tools/combo-calculator.html`, label: 'Race and primary calculator' },
      { href: `${SITE}/tools/faction-impact.html`, label: 'Faction impact checker' },
      { href: `${SITE}/tools/planar-gear.html`, label: 'Planar gear targets' },
      { href: `${SITE}/tools/inventory.html`, label: 'Inventory reader' },
    ],
  },
  {
    head: 'Dungeons',
    links: [
      { href: `${SITE}/dungeons/index.html`, label: 'All surveys' },
      { href: `${SITE}/dungeons/najena.html`, label: 'Najena' },
      { href: `${SITE}/dungeons/lowerguk.html`, label: 'Lower Guk' },
      { href: `${SITE}/dungeons/mistmoore.html`, label: 'Castle Mistmoore' },
      { href: `${SITE}/items/index.html`, label: 'Every item' },
      { href: `${SITE}/named/index.html`, label: 'Every named mob' },
      { href: `${SITE}/sets/index.html`, label: 'Every planar set' },
    ],
  },
  {
    head: 'Raids',
    links: [
      { href: `${SITE}/raids/index.html`, label: 'Encounter index' },
      { href: `${SITE}/raids/plane-of-sky.html`, label: 'Plane of Sky, island by island' },
    ],
  },
  {
    head: 'Learn',
    links: [
      { href: `${SITE}/learn/still-true.html`, label: 'Is it still true?' },
      { href: `${SITE}/learn/difficulty.html`, label: 'What difficulty changes' },
      { href: `${SITE}/learn/motes.html`, label: 'Motes' },
      { href: `${SITE}/learn/raid-access.html`, label: 'How raid access works' },
      { href: `${SITE}/learn/deity.html`, label: 'Deity, and the level 11 lock' },
      { href: `${SITE}/learn/reading-the-plans.html`, label: 'Reading a floor plan' },
      { href: `${SITE}/learn/contamination.html`, label: 'Contamination' },
    ],
  },
  {
    head: 'About',
    links: [
      { href: `${SITE}/search.html`, label: 'Search the site' },
      { href: `${SITE}/data/index.html`, label: 'Public data' },
      { href: `${SITE}/credits.html`, label: 'Credits' },
      { href: `${SITE}/archive/index.html`, label: 'The original plates' },
      { href: `${SITE}/sources.html`, label: 'Sourcing standard' },
      { href: `${SITE}/sources.html#gaps`, label: 'Known gaps' },
      { href: `${SITE}/sources.html#changelog`, label: 'Change log' },
    ],
  },
];

/** The site's own finding form, from its footer. */
const FINDING =
  'https://github.com/samusmylove47-maker/eql-source/issues/new?template=finding.yml';

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
                    <a href={link.href}>{link.label}</a>
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
            <a href={`${SITE}/learn/still-true.html`}>see what is already open</a>.
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
