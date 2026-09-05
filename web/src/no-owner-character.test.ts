/**
 * Nothing this tool ships or renders may print the owner's own character name.
 *
 * The site reserves its real character names to `credits.html`, once. This app
 * used one a second time, and it took a message hand-carried by the owner to
 * find out, because the session that could see it had no way to say so.
 *
 * It was in three rendered places and two of them were not where anyone was
 * looking:
 *
 *   web/src/screens/Landing.tsx      the demo card's <b> name
 *   web/src/screens/NewCharacter.tsx the name field's placeholder
 *   web/src/screens/sourcesData.ts   a citation naming the export FILE
 *
 * and, in a layer nobody had scanned at all, **the payload**: 11 catalogue
 * records carried the export's filename inside the `evidence` string that
 * `ItemWindow.tsx:143` and `Upgrades.tsx:2318` print, plus two `meta.json`
 * provenance fields the Sources page renders. Counting only the JS bundle finds
 * 3 and reports "three places". Counting what a visitor can read finds 26.
 *
 * The fix that made the citations safe was renaming the export itself to
 * `research/validation/tier0-inventory.txt` — stripping the name out of a
 * citation while leaving the file called something else would have made the
 * citation false, and a citation that cannot be followed is the one thing rule
 * 5 of the sourcing standard exists to forbid.
 *
 * ------------------------------------------------------------------ scope
 *
 * This guard covers what ships: the payload, and every non-test source file
 * with its comments stripped. It deliberately does NOT cover
 *
 *   - comments, which are removed by the production build (verified: the
 *     bundle's only three hits were real strings, never a comment), and
 *   - test fixtures, which seed characters by that name and never ship.
 *
 * Widening it to those is one line each; it was left narrow on purpose,
 * because the rule is about the site's voice rather than about the string.
 *
 * The name appears in this file, and only here, because a guard cannot check
 * for something it may not say.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** The one place in shipped-adjacent code this string is allowed to exist. */
const OWNER_CHARACTER = 'Avenrae';

function walk(dir: string, keep: (path: string) => boolean): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full, keep));
    else if (keep(full)) out.push(full);
  }
  return out;
}

/** Block and line comments removed, so a comment is not a violation. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('nothing shipped names the owner’s character', () => {
  const payload = [
    ...walk('public/data', (f) => extname(f) === '.json'),
    ...walk('public/bis', (f) => ['.json', '.js'].includes(extname(f))),
  ];

  const sources = walk('src', (f) => ['.ts', '.tsx'].includes(extname(f)))
    .filter((f) => !/\.test\.tsx?$/.test(f));

  it('has files to check, so a passing run means something', () => {
    // Both lists were non-empty when this was written; an empty one means the
    // walk broke and the assertions below became decoration.
    expect(payload.length).toBeGreaterThan(10);
    expect(sources.length).toBeGreaterThan(50);
  });

  it('finds it in no shipped payload file', () => {
    const guilty = payload.filter((f) => readFileSync(f, 'utf8').includes(OWNER_CHARACTER));
    expect(guilty, 'the payload is served verbatim to every visitor').toEqual([]);
  });

  it('finds it in no source file outside a comment', () => {
    const guilty = sources.filter((f) =>
      stripComments(readFileSync(f, 'utf8')).includes(OWNER_CHARACTER),
    );
    expect(guilty, 'a string literal here reaches the bundle and the screen').toEqual([]);
  });

  it('still points at an export file that exists', () => {
    // The rename is only safe while the citation resolves. If this file moves
    // again, the strings that cite it are wrong and the guard above would still
    // be green — which is why the citation is checked rather than assumed.
    const cited = '../research/validation/tier0-inventory.txt';
    expect(() => statSync(cited)).not.toThrow();
    const sourcesData = readFileSync('src/screens/sourcesData.ts', 'utf8');
    expect(sourcesData).toContain('tier0-inventory.txt');
  });
});
