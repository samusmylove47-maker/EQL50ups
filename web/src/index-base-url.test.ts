/**
 * Every subresource `index.html` names must survive being served from a
 * subdirectory — including when the document URL has no trailing slash.
 *
 * The app is published under three different bases: `/` locally,
 * `/EQL50ups/` on Pages (`deploy.yml` sets `VITE_BASE` to the repository name),
 * and `/tools/50-upgrades/` when eqlsource.com serves it as one page of that
 * site. Vite rewrites the URLs it generates itself — the emitted JS and CSS —
 * against that base. It does not touch a `href` written by hand.
 *
 * A hand-written `./fonts/fonts.css` resolves against the document's
 * DIRECTORY, and `/tools/50-upgrades` and `/tools/50-upgrades/` do not have the
 * same directory. The site's own measurement of that path records `200` with no
 * redirect to the slash form, so the no-slash shape is the one it would actually
 * be served at. Measured, on a real subdirectory build served both ways:
 *
 *   VITE_BASE=/tools/50-upgrades/ npm run build
 *
 *   no trailing slash   @font-face rules parsed 0   404 /tools/fonts/fonts.css
 *                       Cinzel, IBM Plex Mono, Public Sans, Saira Condensed all
 *                       measured the same advance width as a nonsense family:
 *                       every one of them had fallen back to the local stack
 *   trailing slash      @font-face rules parsed 7   404s 0    all four USED
 *
 * `%BASE_URL%` is Vite's substitution for the build's base, so it is correct at
 * every base and independent of how the document was addressed. This test pins
 * that: no hand-written subresource in the head may be document-relative.
 *
 * The measurement above used advance widths rather than `document.fonts.check`,
 * and the reason is worth keeping. `check()` reported all four families
 * available at BOTH shapes, including the one where the stylesheet declaring
 * them had 404'd — it answers "is every MATCHING face loaded", and a family
 * with no matching face has nothing to wait for, so it returns true. It is a
 * guard that cannot fail, which is the fault this project keeps finding in
 * itself.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync('index.html', 'utf8');
const rendered = html.replace(/<!--[\s\S]*?-->/g, '');
const head = /<head>([\s\S]*?)<\/head>/.exec(rendered)?.[1] ?? '';

/** Every `href`/`src` written by hand in the head, in source order. */
function headSubresources(): string[] {
  return [...head.matchAll(/(?:href|src)\s*=\s*"([^"]+)"/g)]
    .map((m) => m[1])
    // The group is `[^"]+`, so a match always carries one; the filter is for the
    // type, and dropping rather than substituting keeps a phantom '' out of the
    // list the assertions below iterate.
    .filter((url): url is string => url !== undefined);
}

describe('index.html survives a subdirectory base', () => {
  it('finds a head to check, so the rest of this file is not vacuous', () => {
    expect(head).not.toBe('');
    expect(headSubresources().length).toBeGreaterThan(0);
  });

  it('names no subresource relative to the document directory', () => {
    const relative = headSubresources().filter(
      (url) => url.startsWith('./') || url.startsWith('../'),
    );
    expect(
      relative,
      'a `./` href resolves against the document directory, which differs between '
        + '/tools/50-upgrades and /tools/50-upgrades/ — use %BASE_URL%',
    ).toEqual([]);
  });

  it('resolves every local subresource against the build base', () => {
    for (const url of headSubresources()) {
      // Absolute URLs are somebody else's origin and not ours to rebase; every
      // local one must carry the base.
      if (/^[a-z]+:/i.test(url) || url.startsWith('//')) continue;
      expect(url, `${url} does not start at %BASE_URL%`).toMatch(/^%BASE_URL%/);
    }
  });

  it('keeps the fonts local, which is what the base rewrite is protecting', () => {
    // Self-hosting is the standing rule — a render-blocking stylesheet on an
    // unreachable third party cost 12.9s to first paint once. A base-relative
    // URL that pointed at fonts.googleapis.com would satisfy the test above and
    // break that rule, so state it here too.
    expect(head).not.toMatch(/fonts\.googleapis\.com|fonts\.gstatic\.com/);
    expect(head).toContain('%BASE_URL%fonts/fonts.css');
  });
});
