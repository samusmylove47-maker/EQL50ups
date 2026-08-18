/**
 * Nothing the app ships may assume it is served from the origin root.
 *
 * `vite.config.ts` reads `base` from `VITE_BASE`, so a GitHub Pages project
 * deploy serves the whole app from a subdirectory. Vite rewrites the paths it
 * owns — module scripts, imported assets — but it copies `public/` verbatim,
 * so a root-absolute URL inside a static file there survives into the build and
 * resolves against the origin instead of the base.
 *
 * That is exactly what happened to the webfonts: all seven `src` values read
 * `url('/fonts/…')`, every one 404'd under the Pages base, and all four faces
 * fell back to their local stacks. The page still rendered, which is what makes
 * this worth a test — a silent fallback to Georgia and system-ui looks like a
 * design choice rather than a broken deploy.
 *
 * `fonts.css` always sits beside the files it names, so `./` is correct under
 * any base.
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** CSS with comments stripped, so a path quoted in prose is not a finding. */
function withoutComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function cssFilesUnder(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...cssFilesUnder(path));
    else if (entry.name.endsWith('.css')) out.push(path);
  }
  return out;
}

describe('static assets survive a non-root base path', () => {
  const files = cssFilesUnder('public');

  it('finds the stylesheets it is meant to be checking', () => {
    expect(files).toContain(join('public', 'fonts', 'fonts.css'));
  });

  it.each(files)('%s references no root-absolute url()', (file) => {
    const offenders = [...withoutComments(readFileSync(file, 'utf8'))
      .matchAll(/url\(\s*['"]?(\/[^'")]*)/g)]
      .map((m) => m[1]);
    expect(offenders).toEqual([]);
  });

  it('names a real file for every font src', () => {
    const css = withoutComments(readFileSync(join('public', 'fonts', 'fonts.css'), 'utf8'));
    const srcs = [...css.matchAll(/url\(\s*['"]?\.\/([^'")]+)/g)].map((m) => m[1]);
    expect(srcs.length).toBeGreaterThanOrEqual(7);
    const missing = srcs.filter((f) => !existsSync(join('public', 'fonts', f)));
    expect(missing).toEqual([]);
  });
});
