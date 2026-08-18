/**
 * The masthead is a hand-copy of somebody else's nav, and hand-copies rot.
 *
 * `SITE_NAV` was transcribed from `eqlsource.com/tools/` and dated in a comment.
 * Nothing checked it. When that site's nav next changes — and it will, it is
 * under active development by a session that cannot see this repository — this
 * tool's masthead would go on advertising the old one silently, offering a
 * reader a section that no longer exists or omitting one that does.
 *
 * That is the same fault class as the transcribed tier ladder and the assumed
 * content licence, in the one place where checking is nearly free.
 *
 * Two tests, deliberately:
 *
 *  - the OFFLINE one always runs and pins the list, so a local edit that drops
 *    or reorders an entry fails in CI, which has no network guarantee;
 *  - the LIVE one fetches the real nav and fails on disagreement. It SKIPS,
 *    loudly, when the site is unreachable — a network outage is not a defect in
 *    this repository, and a test that fails for it would be turned off within a
 *    week.
 *
 * -------------------------------------------------------------------------
 * WHY THIS FILE RUNS IN `node` AND NOT IN `jsdom`
 *
 * The pragma below is load-bearing, and it was added after discovering that the
 * live half of this test had **never once run**. `vitest.config.ts` sets
 * `environment: 'jsdom'` for the whole suite, because the screen tests render
 * the app shell. jsdom supplies its own `fetch`, and that one ignores the proxy
 * variables this container routes all egress through, so every call returned
 * HTTP 403 and the test took its own skip path — reporting `5 passed` while
 * checking nothing against the site:
 *
 *   npx vitest run src/components/site-nav-drift.test.ts --reporter=verbose
 *   # stderr: [site-nav-drift] SKIPPED — HTTP 403        <- before
 *   # 675ms, no skip line                                <- after
 *
 * That is the failure mode the loud skip was written to prevent, arriving by a
 * route the skip could not distinguish: a proxy refusing the call looks exactly
 * like a site being down. Under `node` the real `fetch` honours the proxy — see
 * `NODE_USE_ENV_PROXY` in `vitest.config.ts`, set there so this works from a
 * bare `npx vitest run` rather than only when somebody remembers a flag. CI has
 * no proxy and reaches the site directly, so the variable is inert there.
 *
 * Nothing in this file touches the DOM, so `node` costs it nothing.
 */

// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { SITE_NAV } from './SiteChrome';

/** Transcribed from https://eqlsource.com/tools/ on 2026-08-18. */
const EXPECTED = [
  ['Dungeons', 'https://eqlsource.com/dungeons/'],
  ['Raids', 'https://eqlsource.com/raids/'],
  ['Tools', 'https://eqlsource.com/tools/'],
  ['The Index', 'https://eqlsource.com/tools/index-search'],
  ['Learn', 'https://eqlsource.com/learn/'],
  ['Accuracy', 'https://eqlsource.com/sources'],
  ['Search', 'https://eqlsource.com/search'],
] as const;

/** `../dungeons/index.html` as the site writes it -> what we must link. */
function canonical(href: string): string {
  const path = href.replace(/^\.\.\//, '/');
  const stripped = path.endsWith('index.html')
    ? path.slice(0, -'index.html'.length)
    : path.replace(/\.html$/, '');
  return `https://eqlsource.com${stripped}`;
}

describe('the masthead nav', () => {
  it('matches the list transcribed from the site, in order', () => {
    expect(SITE_NAV.map((entry) => [entry.label, entry.href])).toEqual(
      EXPECTED.map((pair) => [...pair]),
    );
  });

  it('links no .html form, so it does not depend on the redirect rule', () => {
    // All 32 chrome links resolve 200 directly. They used to 307 via the .html
    // form, which cost a round trip and — the real exposure — would break the
    // entire footer at once if that redirect rule were ever removed.
    expect(SITE_NAV.filter((entry) => entry.href.endsWith('.html'))).toEqual([]);
  });

  it('agrees with the nav the site is serving right now', async () => {
    let html: string;
    try {
      const response = await fetch('https://eqlsource.com/tools/', {
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      html = await response.text();
    } catch (error) {
      // Loud skip: unreachable is not disagreement, and must not read as a pass.
      console.warn(
        `[site-nav-drift] SKIPPED — could not reach eqlsource.com/tools/ (${String(error)}). ` +
          'The offline test above still pinned the list.',
      );
      return;
    }

    const nav = /<nav[^>]*class="site-nav"[^>]*>([\s\S]*?)<\/nav>/.exec(html);
    expect(nav, 'no .site-nav block in the served page — the chrome may have been restructured')
      .not.toBeNull();

    const live = [...(nav?.[1] ?? '').matchAll(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map(
      (m) => [(m[2] ?? '').replace(/<[^>]+>/g, '').trim(), canonical(m[1] ?? '')],
    );

    expect(
      live,
      'eqlsource.com changed its nav. Update SITE_NAV and EXPECTED together, and tell the Director ' +
        'so the other session knows this tool tracks it.',
    ).toEqual(SITE_NAV.map((entry) => [entry.label, entry.href]));
  });
});
