/**
 * The footer's `Tools` column is a hand-copy of somebody else's index, and
 * hand-copies rot. This is the sibling of `site-nav-drift.test.ts`, for the
 * same reason and in the same shape — that file's argument applies here
 * unchanged, so it is not repeated.
 *
 * What is worth recording is that this column had already rotted, in both
 * directions at once, and that neither fault could be seen from inside this
 * repository:
 *
 *  - it offered three tools the site has withdrawn — `/tools/character`,
 *    `/tools/planar-gear`, `/tools/inventory`. Each one 301s to
 *    `/tools/50-upgrades.html` and 307s on to `/tools/50-upgrades`, so nothing
 *    was broken, nothing 404'd, and no link checker had anything to say. A
 *    footer whose staleness is invisible to link checking is exactly the thing
 *    a drift check is for;
 *  - and it omitted `/tools/50-upgrades`, which is *this tool*. The one entry
 *    in the site's tool index this repository is in a position to know about
 *    first-hand was the one entry missing from the index it publishes.
 *
 * Both were found by fetching `/tools/` and reading it, which is what the live
 * test below now does on every run that can reach the network.
 *
 * The source of truth is the site's own footer `Tools` column, because that is
 * the artefact this column is a copy of — same labels, same order. The tool
 * cards in that page's `<main>` are checked too, as a set, because they are
 * what actually says *which tools exist*: if the site ships a seventh tool and
 * its own footer lags a day behind its own cards, the copy is stale either way
 * and this repository should hear about it. Card order is deliberately not
 * asserted — as of 2026-08-18 the cards and the footer disagree about where
 * `faction-impact` sits, and that disagreement is the site's business.
 *
 * Two tests, deliberately, exactly as in the nav check: the OFFLINE one always
 * runs so CI needs no network, and the LIVE one SKIPS LOUDLY rather than
 * failing when the site is unreachable.
 *
 * The `node` pragma below is load-bearing for that live half — under the
 * suite's default `jsdom` environment its `fetch` ignores this container's
 * proxy and every call is refused with HTTP 403, so the test skips while
 * reporting a pass. `site-nav-drift.test.ts` carries the full account and the
 * before/after measurement; it is not repeated here.
 */

// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { CHROME_LINKS, SITE_TOOLS, TOOL_NAME } from './SiteChrome';

const SITE = 'https://eqlsource.com';

/**
 * Transcribed from the `Tools` column of the footer served at
 * `https://eqlsource.com/tools/` — six tools on 2026-08-18, **seven from
 * 2026-08-30, eight from 2026-08-31**, when the site published `Lockouts` and this check went red.
 * Re-pinned that day from the live footer, in the site's order; the page was
 * confirmed a real 200 with no redirect first, so this is a copy of a published
 * state rather than an anticipation of one.
 *
 * When this fails, the site changed. Update `SITE_TOOLS` and this list
 * together, and tell the Director, so the session working `eql-source` knows
 * this tool tracks its index.
 */
const EXPECTED = [
  ['The Index', `${SITE}/tools/index-search`],
  ['Sky Ledger', `${SITE}/tools/sky-ledger`],
  ['50 Upgrades', `${SITE}/tools/50-upgrades`],
  ['Gap engine', `${SITE}/tools/gap-engine`],
  ['Lockouts', `${SITE}/tools/lockouts`],
  ['Race unlock tracker', `${SITE}/tools/race-unlocks`],
  ['Race and primary calculator', `${SITE}/tools/combo-calculator`],
  ['Faction impact checker', `${SITE}/tools/faction-impact`],
] as const;

/**
 * The three the site withdrew. Pinned by URL rather than left to a reviewer's
 * memory: they 301 rather than 404, so nothing else in this repository — not
 * `tsc`, not the browser suite's link sweep, not a status check — will ever
 * notice one being typed back in.
 */
const WITHDRAWN = [
  `${SITE}/tools/character`,
  `${SITE}/tools/planar-gear`,
  `${SITE}/tools/inventory`,
] as const;

/**
 * The site writes two different href shapes for the same page on the same
 * document — `../tools/sky-ledger.html` in its footer, `sky-ledger.html` in its
 * tool cards — so resolution is done by `URL` against the page they were read
 * from rather than by trimming a known prefix off the front. Then the `.html`
 * comes off, because every chrome link in this repository is extensionless.
 */
function canonical(href: string): string {
  const url = new URL(href, `${SITE}/tools/`);
  url.pathname = url.pathname.endsWith('/index.html')
    ? url.pathname.slice(0, -'index.html'.length)
    : url.pathname.replace(/\.html$/, '');
  return url.href;
}

/**
 * The site's labels are plain text today. `&amp;` is decoded because its own
 * tool cards already use it — `Race &amp; primary calculator` — and a footer
 * that picks up the card's spelling should read as drift in the *label*, not as
 * a parser that cannot spell an ampersand.
 */
function text(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .trim();
}

describe("the footer's Tools column", () => {
  it('matches the column transcribed from the site, in order', () => {
    expect(SITE_TOOLS.map((tool) => [tool.label, tool.href])).toEqual(
      EXPECTED.map((pair) => [...pair]),
    );
  });

  /*
   * Three of the assertions in this file are of the form "none of this
   * collection is X", and an empty collection satisfies all of them. If
   * `CHROME_LINKS` ever came back empty — a rename, a bad refactor, an import
   * that resolved to nothing — this file would report five passes while
   * checking nothing at all. That is the same shape as the 403 skip, so it is
   * pinned rather than assumed.
   *
   * The three counts are the ones recorded at `CHROME_LINKS`, computed here
   * rather than trusted: 41 entries over 34 distinct destinations, because the
   * nav and the footer are allowed to offer the same page and seven do.
   *
   * Was 39/32/6, then 40/33/7 on 2026-08-30, now 41/34/8 on 2026-08-31 — a
   * seventh tool then an eighth, each moving all three by exactly one, which is
   * the shape a single added link should make. A count that moved by anything
   * else would mean something other than an addition happened.
   */
  it('has a populated link set, so the assertions below are not vacuous', () => {
    expect(CHROME_LINKS.length, 'entries').toBe(41);
    expect(new Set(CHROME_LINKS).size, 'distinct destinations').toBe(34);
    expect(SITE_TOOLS.length, 'tools in the column').toBe(8);
  });

  it('links none of the three tools the site withdrew', () => {
    // Anywhere in the chrome, not just this column — a withdrawn tool moved to
    // another column would still be a withdrawn tool on the page.
    const withdrawn: readonly string[] = WITHDRAWN;
    expect(CHROME_LINKS.filter((link) => withdrawn.includes(link))).toEqual([]);
  });

  it('does not omit this tool from the index it publishes', () => {
    const self = SITE_TOOLS.filter((tool) => tool.here);
    expect(
      self.map((tool) => tool.label),
      'exactly one entry is this tool, and it is the one marked current',
    ).toEqual([TOOL_NAME]);
    expect(CHROME_LINKS).toContain(`${SITE}/tools/50-upgrades`);
  });

  it('links no .html form anywhere in the chrome', () => {
    // `e2e/routes.spec.ts` asserts this against the rendered DOM. This is the
    // same claim one layer down and without a browser: it fails on the edit
    // rather than on the run, and `CHROME_LINKS` is built to be the whole set
    // — the two arrays plus the three hrefs the chrome writes inline — so
    // passing here cannot mean "the half that lives in a list is clean".
    expect(CHROME_LINKS.filter((link) => link.endsWith('.html'))).toEqual([]);
  });

  it('agrees with the tools the site is publishing right now', async () => {
    let html: string;
    try {
      const response = await fetch(`${SITE}/tools/`, {
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      html = await response.text();
    } catch (error) {
      // Loud skip: unreachable is not disagreement, and must not read as a pass.
      console.warn(
        `[site-foot-drift] SKIPPED — could not reach ${SITE}/tools/ (${String(error)}). ` +
          'The offline tests above still pinned the column.',
      );
      return;
    }

    const foot = /<footer[^>]*class="site-foot"[^>]*>([\s\S]*)<\/footer>/.exec(html);
    expect(foot, 'no .site-foot block in the served page — the chrome may have been restructured')
      .not.toBeNull();

    const column = /<h4>\s*Tools\s*<\/h4>\s*<ul>([\s\S]*?)<\/ul>/.exec(foot?.[1] ?? '');
    expect(column, 'no Tools column in the served footer — its column set may have changed')
      .not.toBeNull();

    const live = [
      ...(column?.[1] ?? '').matchAll(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g),
    ].map((m) => [text(m[2] ?? ''), canonical(m[1] ?? '')]);

    expect(
      live,
      'eqlsource.com changed the Tools column of its footer. Update SITE_TOOLS and EXPECTED ' +
        'together, and tell the Director so the other session knows this tool tracks it.',
    ).toEqual(SITE_TOOLS.map((tool) => [tool.label, tool.href]));

    // And the cards, which are what the page actually publishes. Set, not
    // order: the two disagree about `faction-impact` and always have.
    const cards = [...html.matchAll(/<a class="card"[^>]*href="([^"]+)"/g)]
      .map((m) => canonical(m[1] ?? ''))
      .filter((link) => link.startsWith(`${SITE}/tools/`));

    expect(cards.length, 'no tool cards found — the /tools/ page markup may have changed')
      .toBeGreaterThan(0);

    expect(
      [...new Set(cards)].sort(),
      'the set of tools eqlsource.com publishes as cards is not the set this footer copies. ' +
        'A tool was added or withdrawn; update SITE_TOOLS and EXPECTED, and tell the Director.',
    ).toEqual(SITE_TOOLS.map((tool) => tool.href).sort());
  });
});
