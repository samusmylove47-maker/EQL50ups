#!/usr/bin/env node
/**
 * The contamination scanner, pointed at ourselves.
 *
 * eqlsource.com/learn/contamination scans its own pages for Project 1999
 * inheritance and publishes the result on itself. This is the same instrument
 * aimed at this repository: the catalog we ship, and the code that prints it.
 *
 * Its framing, kept verbatim because it is the whole discipline:
 *
 *   **A hit is a question, not a verdict.** EverQuest Legends kept a great deal
 *   of classic EverQuest intact, and most of these patterns are probably
 *   current. What a hit means is: *this figure carries a convention from a game
 *   whose numbers we know changed, and nobody has checked this one.*
 *
 *   **A classic figure carrying a badge is doing its job.** It tells the reader
 *   where it came from and how far to trust it. The same figure printed bare is
 *   the fault this project exists to prevent. So every signature is counted
 *   twice — MARKED and UNMARKED — and only the unmarked column is a fault.
 *
 * What is deliberately *not* here: anybody else's contamination. Four other
 * sites publish EQL item data and every one of them inherits classic text,
 * exactly as we do. A scanner that only finds someone else's rot is an attack
 * ad. This one runs here first.
 *
 * ---------------------------------------------------------------------------
 * TWO CORPORA, AND THEY ANSWER DIFFERENT QUESTIONS
 *
 *   `catalog`  web/public/data/ — the payload every browser downloads.
 *              A hit here means: we ship this figure.
 *   `code`     web/src/ — the app that renders it, tests excluded.
 *              A hit here means: we *print* this figure, which is worse.
 *
 * A figure carried in the payload and never rendered is a smaller fault than
 * one on screen, and the report keeps them apart rather than summing them into
 * a single impressive-looking number.
 *
 * ---------------------------------------------------------------------------
 * WHAT COUNTS AS MARKED
 *
 * Marking is defined per signature and the rule is written into the output, so
 * a reader can disagree with the rule rather than having to trust the count.
 * Two rules recur:
 *
 *   Catalog: the figure was read off a live client window — the record carries
 *   `sd: "tier-M"` and names the field in `vf`. That is the only evidence in
 *   this repository that settles what a number means, so it is the only thing
 *   counted as a mark on a catalog figure.
 *
 *   Code: **nothing in `web/src` is counted as marked.** A source comment is
 *   not a badge. If the figure reaches a screen without a caveat beside it, the
 *   reader is not told, and a comment in the file they cannot see does not tell
 *   them. This is the harshest rule in the scanner and it is aimed at us.
 *
 * Usage: node pipeline/contamination.mjs [--verbose]
 * Writes: web/public/data/contamination.json
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const DATA = join(ROOT, 'web', 'public', 'data');
const SRC = join(ROOT, 'web', 'src');
/*
 * Where the report lands. `CONTAMINATION_OUT` redirects it, which is what
 * `verify.mjs` uses to re-scan into a temporary file and compare the result
 * against the committed one — the gate could previously only tell that a report
 * existed, not that it still described this tree. See the freshness check
 * there. Unset, this writes the payload exactly as before.
 */
const OUT = process.env.CONTAMINATION_OUT ?? join(DATA, 'contamination.json');
const VERBOSE = process.argv.includes('--verbose');

const SCHEMA_VERSION = 1;

// ---------------------------------------------------------------------------
// corpus loading
// ---------------------------------------------------------------------------

function readJson(path) {
  if (!existsSync(path)) return null;
  const text = readFileSync(path, 'utf8').trim();
  if (!text) return null;
  return JSON.parse(text);
}

/**
 * Every shipped item, once.
 *
 * The slot shards carry an item once per slot it fits, so an item legal in
 * BACK and SECONDARY appears twice. Counting shard rows would inflate every
 * figure on this page by the multi-slot items, so the shards are keyed by name
 * and the first row wins. The index is the authority on how many items ship;
 * this is asserted below rather than assumed.
 */
function loadCatalog() {
  const index = readJson(join(DATA, 'items-index.json'));
  const shardDir = join(DATA, 'items');
  const shardFiles = existsSync(shardDir)
    ? readdirSync(shardDir).filter((f) => f.endsWith('.json')).sort()
    : [];

  const byName = new Map();
  /** name -> the shard files it appeared in, for "found in". */
  const shardsOf = new Map();
  for (const file of shardFiles) {
    const shard = readJson(join(shardDir, file));
    for (const item of shard?.items ?? []) {
      if (!byName.has(item.n)) byName.set(item.n, item);
      const seen = shardsOf.get(item.n) ?? [];
      seen.push(`data/items/${file}`);
      shardsOf.set(item.n, seen);
    }
  }

  /*
   * WHAT THIS SCAN ACTUALLY OPENED, versus what ships.
   *
   * `catalogFiles` used to be `shardFiles.length + 2` — a typed literal for
   * items-index.json and meta.json — and the Contamination screen renders it as
   * *"across N payload files"*, which reads as coverage of the payload. It was
   * not coverage; it was an arithmetic expression that happened to equal the
   * number of files anyone had thought of.
   *
   * Measured 2026-09-01: `web/public/data` holds 23 files. The scan opens 21.
   * `contamination.json` is this scan's own output. **The remaining one is
   * `focus-effects.json` — 66 records of scraped prose that
   * `web/src/data/catalog.ts:419` fetches into every browser, and 16 of them
   * carry a percent figure beside the word "haste", which is the exact shape
   * signature 01 exists to find.** No signature has ever opened it, and the
   * `excluded` sentence named test files and quarantine.json but not this.
   *
   * The directory is now WALKED, with no extension filter — R109: an
   * extension-keyed coverage list is blind to extensions nobody thought of.
   * Every file lands in exactly one of three buckets, and `unscanned` is
   * published rather than quietly omitted, because a coverage number that omits
   * what it missed is the failure this whole report exists to prevent.
   */
  const walk = (dir, prefix = 'data') => {
    const out = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const rel = `${prefix}/${entry.name}`;
      if (entry.isDirectory()) out.push(...walk(join(dir, entry.name), rel));
      else if (entry.isFile()) out.push(rel);
    }
    return out;
  };
  const opened = new Set([
    'data/items-index.json',
    'data/meta.json',
    ...shardFiles.map((f) => `data/items/${f}`),
  ]);
  /** This scan's own output. Scanning it would measure the scanner. */
  const selfOutput = new Set(['data/contamination.json']);
  const shipped = existsSync(DATA) ? walk(DATA) : [];
  const unscanned = shipped
    .filter((f) => !opened.has(f) && !selfOutput.has(f))
    .map((f) => ({ file: f, bytes: statSync(join(DATA, f.replace(/^data\//, ''))).size }))
    .sort((a, b) => (a.file < b.file ? -1 : 1));

  return {
    items: [...byName.values()],
    shardsOf,
    shardFiles: shardFiles.map((f) => `data/items/${f}`),
    indexCount: index?.count ?? index?.items?.length ?? 0,
    meta: readJson(join(DATA, 'meta.json')),
    payload: { shipped, opened: [...opened].sort(), unscanned },
  };
}

/**
 * Every source file the app actually ships, as `{ path, lines }`.
 *
 * Tests are excluded. A test file is not a surface: nothing it contains is
 * printed to a reader, and counting the fixtures in `ep-scorer.test.ts` as
 * contamination would pad the report with hits nobody can see. Stylesheets are
 * included because a stylesheet can carry a unit in a `content` property.
 */
/**
 * Blank out comments and string contents, keeping line numbering intact.
 *
 * Deliberately crude — it is a scanner input, not a parser. Block comments are
 * tracked across lines; `//` runs to end of line; anything between matching
 * quotes (single, double or backtick) becomes spaces. Regex literals and
 * escaped quotes are not modelled, which can only blank slightly more than it
 * should, and blanking too much loses a hit rather than inventing one.
 */
function codeOnly(lines) {
  const out = [];
  let inBlock = false;
  for (const raw of lines) {
    let result = '';
    let quote = null;
    for (let i = 0; i < raw.length; i += 1) {
      const c = raw[i];
      const next = raw[i + 1];
      if (inBlock) {
        if (c === '*' && next === '/') { inBlock = false; i += 1; }
        result += ' ';
        continue;
      }
      if (quote) {
        if (c === '\\') { result += '  '; i += 1; continue; }
        if (c === quote) { quote = null; result += ' '; continue; }
        result += ' ';
        continue;
      }
      if (c === '/' && next === '*') { inBlock = true; i += 1; result += '  '; continue; }
      if (c === '/' && next === '/') { result += ' '.repeat(raw.length - i); break; }
      if (c === '\'' || c === '"' || c === '`') { quote = c; result += ' '; continue; }
      result += c;
    }
    out.push(result);
  }
  return out;
}

/**
 * The bindings a file actually imports.
 *
 * Marked-ness used to be `/HASTE_PROVENANCE|HASTE_STACKING/.test(wholeFile)`,
 * which is a text search and gave demonstrably opposite verdicts for identical
 * claims: `ep.ts:325` and `gear.ts:54` both weight `HASTE: 2`, and ep.ts counted
 * as MARKED solely because two of its comments mention the constants by name,
 * while gear.ts counted as unmarked because none of its comments do. Naming a
 * badge in prose is not wearing it. Importing it is.
 */
function importedBindings(lines) {
  const text = lines.join('\n');
  const names = new Set();
  for (const m of text.matchAll(/import\s+([\s\S]*?)\s+from\s+['"][^'"]+['"]/g)) {
    for (const part of m[1].replace(/[{}]/g, ' ').split(',')) {
      const name = part.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim();
      if (name) names.add(name);
    }
  }
  return names;
}

function loadSource() {
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.(tsx?|css)$/.test(entry)) continue;
      if (/\.test\.[tj]sx?$/.test(entry)) continue;
      const lines = readFileSync(full, 'utf8').split('\n');
      files.push({
        path: `web/src/${relative(SRC, full).split(sep).join('/')}`,
        lines,
        /*
         * The same lines with comments and string CONTENTS blanked out, index
         * for index. Predicates test against these; the report quotes the real
         * line, so it stays readable.
         *
         * Without this the scanner quoted its own disclosure as the fault it
         * was disclosing. Four of the seven sites under "OUR OWN SOURCE,
         * QUOTED" were prose about haste rather than code handling haste —
         * including `stats.ts:58`, which is a line of HASTE_PROVENANCE, the
         * constant whose entire job is to say the figure carries a classic
         * unit. A self-audit that cites its own warning label as the hazard is
         * the same failure it was built to catch, one level up.
         */
        code: codeOnly(lines),
      });
    }
  };
  if (existsSync(SRC)) walk(SRC);
  files.sort((a, b) => a.path.localeCompare(b.path));
  return files;
}

// ---------------------------------------------------------------------------
// counting helpers
// ---------------------------------------------------------------------------

/**
 * One signature's tally.
 *
 * `foundIn` is a map of file -> {unmarked, marked} rather than a bare list,
 * because "found in six files" is a weaker statement than "217 of them are in
 * one file", and the second is the one that tells you where to start.
 */
function tally() {
  return { unmarked: 0, marked: 0, foundIn: new Map(), examples: [] };
}

function hit(t, { file, marked, example }) {
  if (marked) t.marked += 1;
  else t.unmarked += 1;
  const row = t.foundIn.get(file) ?? { unmarked: 0, marked: 0 };
  if (marked) row.marked += 1;
  else row.unmarked += 1;
  t.foundIn.set(file, row);
  if (example && t.examples.length < 8) t.examples.push(example);
}

function finish(t) {
  const foundIn = [...t.foundIn.entries()]
    .map(([file, c]) => ({ file, unmarked: c.unmarked, marked: c.marked }))
    .sort((a, b) => b.unmarked - a.unmarked || b.marked - a.marked || a.file.localeCompare(b.file));
  return {
    unmarked: t.unmarked,
    marked: t.marked,
    total: t.unmarked + t.marked,
    foundIn,
    examples: t.examples,
  };
}

/** The shard file an item's hits are attributed to. */
function fileOf(catalog, item) {
  return catalog.shardsOf.get(item.n)?.[0] ?? 'data/items-index.json';
}

/** Did a live client window confirm this exact field on this exact item? */
function clientVerified(item, field) {
  return item.sd === 'tier-M' && (item.vf ?? []).includes(field);
}

/**
 * A comment line, by the only test available to a line-at-a-time scanner.
 *
 * Comments are skipped everywhere in this file. The first version of the
 * scanner did not skip them and reported `components/ItemDetail.tsx:73` — a
 * prose comment reading "folded its 41% haste into the headline stat" — as a
 * site where this app prints a classic percentage. It does not print anything;
 * it describes a design decision. Counting it would have inflated the one
 * number on this page that is supposed to be beyond argument.
 */
function isComment(text) {
  return text.startsWith('*') || text.startsWith('//') || text.startsWith('/*');
}

/**
 * Scan the source corpus for lines matching `test`, returning
 * `{file, line, text, kind}`. `text` is trimmed and clipped: the report quotes
 * it, and a 200-column line of JSX wrapped into a table cell is unreadable.
 */
function scanSource(source, test, kind = 'code') {
  const out = [];
  for (const file of source) {
    file.lines.forEach((raw, i) => {
      const text = raw.trim();
      if (isComment(text)) return;
      // Predicates see the line with comments and string contents blanked, so
      // prose describing a hazard is never quoted as the hazard.
      const bare = (file.code?.[i] ?? raw).trim();
      if (!bare) return;
      if (!test(bare, raw)) return;
      out.push({
        file: file.path,
        line: i + 1,
        kind,
        text: text.length > 160 ? `${text.slice(0, 157)}…` : text,
      });
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// the signatures
// ---------------------------------------------------------------------------

const catalog = loadCatalog();
const source = loadSource();
const items = catalog.items;
const signatures = [];

/* ======================================================================== *
 * 01  haste-pct — a mechanic we know changed, and a live hit on us
 * ======================================================================== */
{
  const t = tally();
  const values = [];
  for (const item of items) {
    const haste = item.st?.HASTE;
    if (haste == null) continue;
    values.push(haste);
    hit(t, {
      file: fileOf(catalog, item),
      marked: clientVerified(item, 'HASTE'),
      example: `${item.n} — HASTE ${haste}${clientVerified(item, 'HASTE') ? ' (client-verified)' : ''}`,
    });
  }

  // The code half: every place a haste figure reaches a screen carrying a
  // percent sign, and every place it is weighted as a linear scorable stat.
  const printed = scanSource(
    source,
    (text) => /(atk\s*speed|attack\s*speed|haste)/i.test(text) && /%/.test(text),
    'printed with a percent sign',
  );
  /*
   * `HASTE: 2` in a weights map and `st: { HASTE: 11 }` on a fixture item look
   * identical to a line-at-a-time scanner and are not the same claim, so they
   * are separated by whether the line is inside a stat block.
   */
  const weighted = scanSource(
    source,
    (text) => /\bHASTE\s*:\s*-?[\d.]+/.test(text) && !/\bst\s*:/.test(text),
    'weighted in the EP ranking',
  );
  const invented = scanSource(
    source,
    (text) => /\bst\s*:.*\bHASTE\s*:\s*-?[\d.]+/.test(text),
    'invented placeholder value',
  );
  const codeSites = [...printed, ...weighted, ...invented];
  /*
   * Whether a code site is MARKED is detected, not asserted.
   *
   * This block used to pass `marked: false` unconditionally and carry a
   * markRule saying "nothing counts as marked — no surface in this app tells a
   * reader that this figure carries a classic unit." Both were written before
   * the haste badge shipped, and both stayed put after it did: the page went on
   * accusing our own code of a fault that had been fixed, and quoted lines that
   * no longer existed to prove it.
   *
   * That is the worst failure available to a page whose entire purpose is
   * honest self-audit, and it is the same hand-written-prose drift this project
   * has now removed three times. A file counts as marked if it reaches for the
   * shared provenance constants — which is exactly what "this surface tells the
   * reader the figure carries a classic unit" means in this codebase.
   */
  const marksProvenance = new Map(
    source.map((file) => {
      const bindings = importedBindings(file.lines);
      return [file.path, bindings.has('HASTE_PROVENANCE') || bindings.has('HASTE_STACKING')];
    }),
  );
  for (const s of codeSites) {
    hit(t, {
      file: s.file,
      marked: marksProvenance.get(s.file) === true,
      example: `${s.file}:${s.line} — ${s.text}`,
    });
  }

  signatures.push({
    id: 'haste-pct',
    group: 'changed',
    title: 'Haste printed as a percentage',
    corpus: 'both',
    codeSites,
    /*
     * Which of those files carry the badge. Published so the app and its tests
     * can distinguish a marked source site from a marked catalog row without
     * re-deriving the rule — they are two different populations counted into
     * one `marked` total, and conflating them is how the old assertion managed
     * to be green while the page was wrong.
     */
    markedFiles: [...new Set(codeSites.map((s) => s.file).filter((f) => marksProvenance.get(f)))],
    ...finish(t),
    markRule:
      'Catalog: the item\'s HASTE was read off a live client window (sd "tier-M", "HASTE" in vf). ' +
      'Code: the surface reaches for the shared HASTE_PROVENANCE / HASTE_STACKING constants, so a ' +
      'reader of that screen is told the figure carries a classic unit and that the stacking rule ' +
      'is assumed rather than measured. Detected by scanning the file, not asserted here.',
    classic:
      'Haste was a percentage that divided weapon delay. Worn haste did not stack: only the largest ' +
      'percentage applied, and the number on the item was the number in the tooltip.',
    legends:
      'The eqltools/eqlwiki Haste Guide says Legends uses flat attack-speed values rather than a ' +
      'classic multiplicative percentage, capped around 50% below level 30 and 75% at 50, with only ' +
      'the highest worn item counting. eqlwiki\'s own item field is still documented as "worn haste %". ' +
      'The two best sources in the field disagree about what the number on the item means, and every ' +
      'haste figure in this catalog is scraped from the one that still says percentage.',
    settle:
      'One screenshot of a Legends item tooltip showing its haste line beside the character\'s ' +
      'Attack Speed reading, on a character wearing that item and nothing else hasted.',
    findings: [
      'This is a live hit on us, and it is the most valuable line on this page. This app takes the ' +
        'wiki\'s HASTE field, prints it under the label "Atk Speed %", and weights it in the upgrade ' +
        'ranking at 2 points per unit — three claims about a number whose unit two sources disagree ' +
        'about, and not one of them carries a badge.',
      `Every haste value in the shipped catalog is a classic-era percentage: ${[...new Set(values)].sort((a, b) => a - b).join(', ')}. ` +
        'Not one of them is a value this project measured.',
      'One is checked. Cloak of Flames reads HASTE 36 at +0 and was observed at 43 at +7 in a live ' +
        'client window (research/validation/TIER0-VALIDATION.md §5). That confirms the figure scales ' +
        'as a flat additive quantity through exaltation. It does not settle what the unit is.',
      'The client\'s own Stats window does print "Attack Speed %" (research/validation/UI-REFERENCE.md ' +
        '§B3), so the label on the totals panel is backed by Tier M evidence. The per-item figure it ' +
        'sums is not: that unit is the wiki\'s, and the badge that says so does not exist.',
    ],
  });
}

/* ======================================================================== *
 * 02  haste-stacking — not inheritance. Us, contradicting ourselves.
 * ======================================================================== */
{
  /*
   * This is the one signature that is NOT a contamination hit, and it is
   * reported anyway because it is the worst thing the scanner found.
   *
   * `engine/stats.ts` implements the rule correctly for the totals panel —
   * "Only the single highest worn haste applies; they do not sum." —
   * `engine/ep.ts` scores every stat in `resolved.flat` with `add(key, amount)`
   * and HASTE is in `resolved.flat`. So the scorer credits the second haste
   * item in full, at weight 2, for a gain the character will never receive.
   * The two halves of this engine disagree about a mechanic neither game ever
   * implemented the way the scorer assumes.
   *
   * Detected structurally rather than asserted: the scanner looks for the
   * maximum rule in the totals path and for an uncapped, unconditional add over
   * `resolved.flat` in the scoring path, and only reports the contradiction
   * when it finds both.
   */
  const t = tally();
  const maxRule = scanSource(source, (text) =>
    /haste/i.test(text) && />\s*totals\.haste|totals\.haste\s*=/.test(text));
  const flatAdd = scanSource(source, (text) =>
    /for\s*\(const\s*\[key,\s*amount\]\s*of\s*Object\.entries\(resolved\.flat\)\)\s*add\(/.test(text));

  const contradicts = maxRule.length > 0 && flatAdd.length > 0;
  if (contradicts) {
    for (const s of [...maxRule, ...flatAdd]) {
      hit(t, { file: s.file, marked: false, example: `${s.file}:${s.line} — ${s.text}` });
    }
  }

  signatures.push({
    id: 'haste-stacking',
    group: 'changed',
    title: 'The scorer stacks haste the totals panel refuses to stack',
    corpus: 'code',
    ...finish(t),
    markRule: 'Nothing counts as marked. This is a contradiction inside our own engine, not an inheritance.',
    classic:
      'Worn haste never stacked in classic EverQuest either. Two 21% belts gave 21%, and every ' +
      'planner of that era that summed them was wrong in the same way.',
    legends:
      'Same rule, per the eqltools Haste Guide: only the highest worn-haste item counts, under a ' +
      'level-scaled cap. This is one of the few haste facts both sources agree on.',
    settle:
      'Nothing needs settling. The rule is already known and this app already implements it in one ' +
      'of the two places it is needed. engine/stats.ts takes the maximum; engine/ep.ts adds every ' +
      'haste item at full weight with no cap, so a second haste item earns ranking points for a gain ' +
      'the character will never see.',
    findings: contradicts
      ? [
          'engine/stats.ts computeTotals: `if (haste > totals.haste) totals.haste = haste` — correct.',
          'engine/ep.ts scoreItem: `for (const [key, amount] of Object.entries(resolved.flat)) add(key, amount)` ' +
            '— unconditional, uncapped, and HASTE is in `resolved.flat`.',
          'Consequence: the upgrade ranking overvalues a haste item for any character already wearing ' +
            'one, and the stat panel below it will not show the gain the ranking promised.',
        ]
      : ['Not detected in this build. Either the scorer was fixed or the scanner\'s pattern no longer matches; check both before believing this line.'],
  });
}

/* ======================================================================== *
 * 03  flag-vocab — a classic vocabulary the client contradicts
 * ======================================================================== */
{
  const LEGACY = new Set(['NO_DROP', 'MAGIC']);
  const MODERN = new Set(['NO_TRADE', 'PLACEABLE', 'LORE_EQUIPPED']);
  const t = tally();
  let both = 0;
  let noDropAndNoTrade = 0;
  const counts = {};
  for (const item of items) {
    const flags = item.fl ?? [];
    for (const f of flags) counts[f] = (counts[f] ?? 0) + 1;
    const legacy = flags.filter((f) => LEGACY.has(f));
    if (!legacy.length) continue;
    if (flags.some((f) => MODERN.has(f))) both += 1;
    if (flags.includes('NO_DROP') && flags.includes('NO_TRADE')) noDropAndNoTrade += 1;
    for (const f of legacy) {
      hit(t, {
        file: fileOf(catalog, item),
        // Nothing marks a flag. `vf` names stat fields; no capture in this
        // repository has ever confirmed a flag, and both that were sampled
        // came back contradicted.
        marked: false,
        example: `${item.n} — ${f}`,
      });
    }
  }

  signatures.push({
    id: 'flag-vocab',
    group: 'changed',
    title: 'Classic flag wording the client disagrees with',
    corpus: 'catalog',
    ...finish(t),
    markRule:
      'Nothing counts as marked. No client capture in this repository has ever confirmed a flag, and ' +
      'the item window prints the flag row bare — the Tier M eyebrow above it is scoped to stats and ' +
      'says so.',
    classic: 'Classic item records spelled restrictions NO DROP and MAGIC ITEM.',
    legends:
      'The live client renders "Lore Equipped / No Trade / Placeable" for Earthshaker, where this ' +
      `catalog holds LORE / MAGIC. Both of the two items ever sampled against a client window came ` +
      'back contradicted. meta.dataReliability.flags rates the whole vocabulary low confidence and ' +
      'sets doNotUseAsAuthoritativeFilter — and MAGIC appears on zero modern-convention wiki pages ' +
      'and in zero client screenshots, so it may be a classic concept Legends no longer surfaces.',
    settle:
      'One screenshot of an item tooltip whose wiki page uses the modern convention. The Castle ' +
      'Mistmoore revamp lands new item pages tomorrow: those pages will be authored under the current ' +
      'convention, which is exactly the sample this question has been waiting for.',
    findings: [
      `Flag frequencies in the shipped catalog: ${Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')}.`,
      noDropAndNoTrade === 0
        ? 'NO_DROP and NO_TRADE co-occur on no shipped item, which reproduces at item level the clean ' +
          'partition meta.dataReliability found across wiki pages: they are most likely one restriction ' +
          'under two spellings, not two restrictions.'
        : `NO_DROP and NO_TRADE co-occur on ${noDropAndNoTrade} shipped items. meta.dataReliability ` +
          'reports zero co-occurrence across the 7,813 wiki pages carrying a flag line, so either those ' +
          'items were merged from two sources of different vintage, or the two spellings are two ' +
          'restrictions after all. Whichever it is, the merge is ours and the contradiction is ours.',
      `${both} items carry a legacy-only flag and a modern-only flag at once, so the clean partition ` +
        'meta.dataReliability found across wiki pages does not hold across every shipped item.',
    ],
  });
}

/* ======================================================================== *
 * 04  weapon-skill — the wiki is wrong about Monk fist weapons
 * ======================================================================== */
{
  /* The rule exactly as meta.dataReliability.weaponSkill.suspectRule publishes it. */
  const FIST = /fist|knuckle|claw|cestus|ulak|fistwrap/i;
  const t = tally();
  const found = [];
  for (const item of items) {
    const skill = item.wp?.skill;
    if (!skill) continue;
    const cl = item.cl ?? [];
    const explicit = cl.includes('MNK') && !cl.includes('ALL') && !cl.includes('ALL_EXCEPT');
    if (!explicit || !FIST.test(item.n) || skill === 'Hand to Hand') continue;
    found.push(item.n);
    hit(t, {
      file: fileOf(catalog, item),
      // Whitened Treant Fists carries a Tier M standing whose verified-field
      // list is DLY and DMG, and the item window prints "Anything else on this
      // item is catalog data that no client capture covers". That is a badge on
      // exactly this uncertainty, so it counts.
      marked: item.sd === 'tier-M',
      example: `${item.n} — wiki says ${skill}${item.sd === 'tier-M' ? ' (Tier M eyebrow scopes it)' : ''}`,
    });
  }

  const published = catalog.meta?.dataReliability?.weaponSkill?.suspectCount ?? null;
  const extra = published != null && found.length !== published;

  signatures.push({
    id: 'weapon-skill',
    group: 'changed',
    title: 'Monk fist weapons skilled as blunt',
    corpus: 'catalog',
    ...finish(t),
    markRule:
      'The item carries a Tier M stat standing, so the item dialog lists the fields a client window ' +
      'actually checked and states that everything else on the row is unchecked catalog data. Weaker ' +
      'than it sounds, and said plainly: that list appears in the dialog only. The hover card shows ' +
      'the eyebrow alone — "Tier M · stats read off the client" — which a reader could take to cover ' +
      'the skill line printed under it. One marked hit here is one mark that is doing about half its job.',
    classic:
      'Classic EverQuest itemised these as blunt weapons in places and as hand-to-hand in others, and ' +
      'the wiki inherited both conventions inside a single item family: Bronze, Rusty and Steel ' +
      'Knuckles are Hand to Hand while Brass Knuckles and every Velium Knuckledusters variant are 1H Blunt.',
    legends:
      'The client shows Hand to Hand for Whitened Treant Fists, where all four independent scrapes and ' +
      'the wiki page category say 1H Blunt. Only 11 items in the whole catalog carry Hand to Hand and ' +
      'all are low damage; the high-end Monk fist gear is uniformly skilled 1H Blunt, which is not a ' +
      'shape a real weapon table has.',
    settle:
      'Four client tooltips — one per suspect. Each is a single screenshot and each ends one row of ' +
      'this table permanently.',
    findings: [
      `Applying the published suspectRule to the shipped catalog selects ${found.length} items: ${found.join(', ')}.`,
      ...(extra
        ? [
            `meta.dataReliability.weaponSkill.suspectCount publishes ${published}. The difference is ` +
              'the rule, not the catalog: "claw" matches Bloodclaw Mace, which is a mace. The published ' +
              'rule over-selects by one and the published count was pruned by hand somewhere the rule ' +
              'does not record.',
          ]
        : []),
      'No weapon has been moved between skills in this build. The wiki spelling ships as the wiki ' +
        'spells it, which is the correct behaviour for a source we suspect but cannot yet correct.',
    ],
  });
}

/* ======================================================================== *
 * 05  sv-resist — a classic abbreviation, and this one is partly settled
 * ======================================================================== */
{
  const t = tally();
  let fields = 0;
  for (const item of items) {
    if (!item.sv) continue;
    for (const save of Object.keys(item.sv)) {
      fields += 1;
      hit(t, {
        file: fileOf(catalog, item),
        marked: clientVerified(item, `SV_${save}`),
        example: `${item.n} — SV ${save} ${item.sv[save] > 0 ? '+' : ''}${item.sv[save]}`,
      });
    }
  }
  /*
   * The app's own stat-key namespace is `SV_MAGIC`, `SV_FIRE` and so on — the
   * classic abbreviation, adopted as an internal vocabulary. Those sites are
   * reported as a finding rather than counted as hits: a key in a weights map
   * is not a figure printed to a reader, and folding 19 of them into the same
   * column as 734 shipped resist values would make the number mean two things.
   */
  const vocabularyFiles = [
    ...new Set(scanSource(source, (text) => /\bSV_[A-Z]+\b/.test(text)).map((s) => s.file)),
  ];

  signatures.push({
    id: 'sv-resist',
    group: 'format',
    title: 'Resists abbreviated SV MAGIC +N',
    corpus: 'catalog',
    ...finish(t),
    markRule:
      'The resist was read off a live client window: sd "tier-M", with the SV_ key named in vf.',
    classic: 'Classic stat blocks abbreviated resists as SV MAGIC +N.',
    legends:
      'Partly settled, and in our favour. The live client\'s own Stats window prints "SV Void 126/1000" ' +
      '(research/validation/UI-REFERENCE.md §B1), so the abbreviation is current in Legends and Void is ' +
      'a real sixth resist that classic never had. What is still unchecked is whether item tooltips use ' +
      'the same abbreviation, and whether these particular numbers are Legends numbers — the presence of ' +
      'the convention marks a block transcribed from a classic-era record, which is worth knowing even ' +
      'when every figure in it is right.',
    settle: 'Compare one shipped resist block against the item in game.',
    findings: [
      `${fields} resist figures ship across ${items.filter((i) => i.sv).length} items.`,
      'Exactly one has ever been checked: Cloak of Flames SV Fire, and it is the sample that corrected ' +
        'this project\'s exaltation rounding rule from rounding to truncation.',
      'The sixth resist is the evidence that this vocabulary is live rather than inherited: an import ' +
        'from a 2001 game could not have produced a Void column.',
      `The abbreviation is also this app's internal stat-key namespace — SV_MAGIC, SV_FIRE and the rest ` +
        `appear in ${vocabularyFiles.length} source files (${vocabularyFiles.join(', ')}). Those are not ` +
        'counted above: a key in a weights map is not a figure printed to a reader.',
    ],
  });
}

/* ======================================================================== *
 * 06  charges — shipped to every browser, rendered nowhere
 * ======================================================================== */
{
  const t = tally();
  for (const item of items) {
    if (item.chg == null) continue;
    hit(t, { file: fileOf(catalog, item), marked: false, example: `${item.n} — ${item.chg} charges` });
  }
  const rendered = scanSource(source, (text) => /\bitem\.chg\b|\bchg\s*[:?]/.test(text));

  signatures.push({
    id: 'charges',
    group: 'format',
    title: 'Bracketed charge counts on clickable items',
    corpus: 'catalog',
    ...finish(t),
    markRule:
      'Nothing counts as marked, and nothing could: the field is not rendered, so there is no point of ' +
      'use at which to badge it.',
    classic: 'Classic printed a charge count in brackets on clickable items.',
    legends:
      'Nobody has published whether Legends keeps charge counts, or the same numbers. No client capture ' +
      'in this repository shows a charges line.',
    settle: 'One screenshot of a clickable item tooltip.',
    findings: [
      `${t.unmarked} shipped items carry a charge count.`,
      rendered.length === 0
        ? 'None of them reaches a screen. `chg` is in the payload every visitor downloads and is read by ' +
          'nothing in web/src — the same burial rule 5 of the sourcing standard forbids, one field further down.'
        : `Rendered at ${rendered.map((r) => `${r.file}:${r.line}`).join(', ')}.`,
      'This is the cheapest signature on the page to clear: either render it with a badge, or drop the ' +
        'field and stop shipping an unchecked classic figure to every browser.',
    ],
  });
}

/* ======================================================================== *
 * 07  dmg-bonus — absent, and the absence is the finding
 * ======================================================================== */
{
  const t = tally();
  for (const item of items) {
    if (item.wp?.bonus == null) continue;
    hit(t, { file: fileOf(catalog, item), marked: false, example: `${item.n} — bonus ${item.wp.bonus}` });
  }

  signatures.push({
    id: 'dmg-bonus',
    group: 'format',
    title: 'Weapon damage bonus',
    corpus: 'catalog',
    ...finish(t),
    markRule: 'Not applicable — there is nothing to mark.',
    classic:
      'Classic printed a Dmg Bonus line on weapons, derived from character level and weapon delay ' +
      'rather than stored on the item.',
    legends:
      'The live client shows a Dmg Bon line — 13 on Whitened Treant Fists, 50 on Earthshaker — so the ' +
      'concept exists. Two sources print one in their stats-block text: four pages of the jmoyers ' +
      'dataset and four of the 2 September live-wiki supplement. Neither carries it as a field of ' +
      'its own, and the vendored August wiki scrape prints it nowhere.',
    settle:
      'Two client tooltips for the same weapon at different character levels would show whether it is ' +
      'stored or derived. Until then it cannot be computed, so it is not printed.',
    findings: [
      `${t.unmarked + t.marked} items carry a damage bonus. The field is emitted only where a source ` +
        'actually printed one.',
      'Fewer items carry one than sources print one, and that is the merge policy rather than a loss: ' +
        'a weapon block is taken whole from the first source supplying damage or delay, so a bonus ' +
        'printed by a later source for an item an earlier one already described is not grafted on.',
      'A dry streak is a ceiling, not a zero. This is the same rule: an absent bonus is shown as absent, ' +
        'never as 0, and never reconstructed from a classic formula that may not be this game\'s formula.',
    ],
  });
}

/* ======================================================================== *
 * 08  era-unplaced — the tier-5 fraction of the shipped catalog
 * ======================================================================== */
{
  const t = tally();
  for (const item of items) {
    if (item.sd !== 'tier-5') continue;
    // Every tier-5 row carries the eyebrow "Tier 5 · wiki stats, era unplaced"
    // wherever the item window renders, and the dialog adds the paragraph that
    // says why. This signature is fully marked, and that is the point of it.
    hit(t, { file: fileOf(catalog, item), marked: true, example: `${item.n} — era ${item.era ?? 'none'}` });
  }
  const eraUnknown = items.filter((i) => i.eraUnknown).length;
  const standing = {};
  for (const item of items) standing[item.sd ?? 'none'] = (standing[item.sd ?? 'none'] ?? 0) + 1;

  signatures.push({
    id: 'era-unplaced',
    group: 'format',
    title: 'Wiki numbers no source places in this game',
    corpus: 'catalog',
    ...finish(t),
    markRule:
      'The item window prints "Tier 5 · wiki stats, era unplaced" on the row, and the dialog adds a ' +
      'paragraph naming the era the wiki gives and why it does not place the item here.',
    classic:
      'These rows may be describing the original EverQuest item of the same name. That is the whole ' +
      'reason the tier exists.',
    legends:
      'The item is in the game — a live client holds it, which is Tier M existence evidence. Its ' +
      'numbers are not placed in the game by anything.',
    settle: 'A client capture of any one of these items replaces its whole stat block with a measured one.',
    findings: [
      `${t.marked} rows, and ${t.unmarked} of them are printed bare. This is the column the scanner ` +
        'exists to drive to zero, and on this signature it already is.',
      `${eraUnknown} shipped items carry no era from any source at all.`,
      `Stat provenance across the whole shipped catalog: ${Object.entries(standing).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')}.`,
    ],
  });
}

/* ======================================================================== *
 * 09  wiki-markup — raw scrape residue, on screen
 * ======================================================================== */
{
  const t = tally();
  let duplicated = 0;
  for (const item of items) {
    if (!item.fx?.length) continue;
    const clean = item.fx.map((f) => (f.n ?? '').replace(/<[^>]*>/g, '').trim());
    if (new Set(clean).size < clean.length) duplicated += 1;
    for (const fx of item.fx) {
      if (!/<[a-z][^>]*>/i.test(`${fx.n ?? ''}${fx.d ?? ''}`)) continue;
      hit(t, { file: fileOf(catalog, item), marked: false, example: `${item.n} — ${fx.n}` });
    }
  }

  signatures.push({
    id: 'wiki-markup',
    group: 'format',
    title: 'Raw wiki markup in effect names',
    corpus: 'catalog',
    ...finish(t),
    markRule: 'Nothing counts as marked. This is transcription residue, and residue is never intentional.',
    classic:
      'Not a classic convention — a scraping one. The wiki wraps effect names in <span class="itemeff">, ' +
      'and the parser kept the wrapper on one code path and stripped it on another.',
    legends:
      'Not a question about Legends at all. The item window renders effect names as text, so React ' +
      'escapes the tag and the reader is shown the angle brackets.',
    settle:
      'Nothing. This one is not a question, it is a defect, and it belongs on this page because the ' +
      'scanner found it while looking for something else and hiding it would be the fault this page is about.',
    findings: [
      `${t.unmarked} effect entries across the catalog carry an unstripped HTML tag.`,
      `${duplicated} items carry the same effect twice — once wrapped, once clean — so those rows print ` +
        'a duplicate line as well as a broken one.',
    ],
  });
}

/* ======================================================================== *
 * 10  source-conflict — where two sources disagreed and one quietly won
 * ======================================================================== */
{
  const t = tally();
  const detail = [];
  for (const item of items) {
    if (!item.cf?.length) continue;
    for (const c of item.cf) {
      hit(t, {
        file: fileOf(catalog, item),
        marked: false,
        example: `${item.n} — ${c.f}: ${c.sa} says ${c.a}, ${c.sb} says ${c.b}`,
      });
      detail.push(`${item.n} ${c.f} ${c.a}/${c.b}`);
    }
  }
  const rendered = scanSource(source, (text) => /\bitem\.cf\b/.test(text));

  signatures.push({
    id: 'source-conflict',
    group: 'format',
    title: 'Two sources disagreed and the reader is not told',
    corpus: 'catalog',
    ...finish(t),
    markRule:
      'Nothing counts as marked. The conflict is recorded on the item as `cf` and read by nothing in web/src.',
    classic:
      'Not a classic convention. It is the same failure in a different coat: a figure whose provenance ' +
      'is uncertain, printed as though it were not.',
    legends:
      'Unknown which value is right. The pipeline keeps eqlwiki\'s and records the loser rather than ' +
      'discarding it, which is correct — but a value that survived an argument is not the same as a ' +
      'value nobody disputed, and the row prints them identically.',
    settle: 'One client capture per disputed item. There are few enough to finish in an evening.',
    findings: [
      `${t.unmarked} disputed fields across ${items.filter((i) => i.cf?.length).length} items.`,
      rendered.length === 0
        ? 'The `cf` record reaches no screen. eqlsource.com strikes a figure through and prints the ' +
          'source it disbelieves beside it; this app prints the winner alone.'
        : `Rendered at ${rendered.map((r) => `${r.file}:${r.line}`).join(', ')}.`,
      ...(detail.length ? [`Disputed: ${detail.slice(0, 12).join('; ')}.`] : []),
    ],
  });
}

/* ======================================================================== *
 * 11  removed-from-game — the source says it is not in the game, and we ship it
 * ======================================================================== */
{
  const t = tally();
  const names = [];
  for (const item of items) {
    const zones = item.src?.z ?? [];
    if (!zones.some((z) => /removed from game/i.test(z))) continue;
    names.push(item.n);
    hit(t, { file: fileOf(catalog, item), marked: false, example: `${item.n} — src.z says "${zones.join(', ')}"` });
  }

  signatures.push({
    id: 'removed-from-game',
    group: 'format',
    title: 'Items the source itself says were removed',
    corpus: 'catalog',
    ...finish(t),
    markRule:
      'Nothing counts as marked. The wiki\'s own note survives into the payload as an acquisition ' +
      'zone string and is rendered as if it were a place you could go.',
    classic:
      'A classic-era wiki note. "ITEM REMOVED FROM GAME" was written about the original game, at some ' +
      'unrecorded date, by somebody describing a patch that predates this one by two decades.',
    legends:
      'Unknown. The note may be inherited from the original game\'s wiki and say nothing about Legends, ' +
      'or it may be current. The era filter passed these rows because the wiki also tagged them Classic.',
    settle: 'A single /itemsearch or vendor check in the live game per item.',
    findings: names.length
      ? [
          `${names.length} shipped item: ${names.join(', ')}.`,
          'It carries a classic 36% haste figure, which puts it on two rows of this table at once — an ' +
            'unchecked classic number on an item the source says does not exist.',
        ]
      : ['None found in this build.'],
  });
}

// ---------------------------------------------------------------------------
// headline figures
// ---------------------------------------------------------------------------

const byGroup = (g) => signatures.filter((s) => s.group === g);
const sum = (list, key) => list.reduce((n, s) => n + s[key], 0);

const changed = byGroup('changed');
const format = byGroup('format');

const shippedStatBlocks = items.filter((i) => i.st || i.sv || i.wp).length;
const clientChecked = items.filter((i) => i.sd === 'tier-M').length;

const report = {
  v: SCHEMA_VERSION,
  generator: 'pipeline/contamination.mjs',
  scannedAt: new Date().toISOString(),
  builtAt: catalog.meta?.builtAt ?? null,

  principle: {
    hit: 'A hit is a question, not a verdict.',
    hitBody:
      'EverQuest Legends kept a great deal of classic EverQuest intact, and most of these patterns are ' +
      'probably current. What a hit means is: this figure carries a convention from a game whose numbers ' +
      'we know changed, and nobody has checked this one.',
    marked: 'A classic figure carrying a badge is doing its job.',
    markedBody:
      'It tells the reader where it came from and how far to trust it. The same figure printed bare is ' +
      'the fault this project exists to prevent. The number that matters is the unmarked column.',
    ourselves: 'Why this page is about us and nobody else.',
    ourselvesBody:
      'Every EQL reference is part Project 1999 text describing a game that stopped existing in 2001, ' +
      'and this one is no exception. Other projects publish EQL item data and every one of them inherits ' +
      'the same classic text. A scanner that only finds someone else\'s rot is an attack ad. The only ' +
      'version worth having is the one that runs here first and publishes the result whatever it says.',
  },

  corpus: {
    catalogItems: items.length,
    indexCount: catalog.indexCount,
    /* DERIVED from what was opened — never `shards + 2`. See loadCatalog(). */
    catalogFiles: catalog.payload.opened.length,
    /** The exact files opened, so a cross-check need not re-guess them. */
    opened: catalog.payload.opened,
    /**
     * Payload files that ship to a browser and no signature reads.
     *
     * Published, not omitted. A coverage figure that leaves out what it missed
     * is the exact failure this report exists to name in others.
     */
    unscanned: catalog.payload.unscanned,
    unscannedNote:
      'These files ship in web/public/data and every browser can fetch them, but no '
      + 'signature opens them, so this report says nothing about their contents either '
      + 'way. focus-effects.json is the live case: 66 scraped prose records, 16 of which '
      + 'carry a percent figure beside the word "haste" — the shape signature 01 exists '
      + 'to find. Whether those are contamination or ordinary spell-haste prose is '
      + 'UNMEASURED, and unmeasured is what this line reports.',
    sourceFiles: source.length,
    sourceLines: source.reduce((n, f) => n + f.lines.length, 0),
    excluded:
      'Test files are excluded from the source corpus: a test is not a surface, and counting its ' +
      'fixtures would pad this report with hits nobody can see. pipeline/quarantine.json is excluded ' +
      'too — the 7,599 items it holds are the ones we refused to ship, and scanning them would measure ' +
      'the wiki rather than us.',
  },

  headline: {
    unmarkedOnChangedMechanics: sum(changed, 'unmarked'),
    markedOnChangedMechanics: sum(changed, 'marked'),
    classicFormats: sum(format, 'unmarked') + sum(format, 'marked'),
    classicFormatsUnmarked: sum(format, 'unmarked'),
    filesScanned: catalog.payload.opened.length + source.length,
    statBlocksShipped: shippedStatBlocks,
    statBlocksCheckedAgainstTheGame: clientChecked,
    /*
     * Said out loud rather than left for a reader to work out from the table.
     * One signature supplies almost the whole first figure, and a headline that
     * hides that is a headline optimised to look alarming.
     */
    note: (() => {
      const worst = [...changed].sort((a, b) => b.unmarked - a.unmarked)[0];
      if (!worst) return '';
      const share = Math.round((worst.unmarked / Math.max(1, sum(changed, 'unmarked'))) * 100);
      return (
        `${worst.unmarked} of those ${sum(changed, 'unmarked')} — ${share}% — are the one signature ` +
        `"${worst.id}", which is a single unanswered question multiplied across the catalog rather than ` +
        `${worst.unmarked} separate problems. The table below is the honest shape of this number.`
      );
    })(),
  },

  groups: [
    {
      id: 'changed',
      title: 'Mechanics we know changed',
      lede:
        'A hit here is probably a wrong number, because the mechanic it describes demonstrably works ' +
        'differently in Legends, or because the live client has already contradicted it.',
    },
    {
      id: 'format',
      title: 'Classic formats',
      lede:
        'These are conventions rather than errors. They are usually harmless and often still current. ' +
        'They are counted because in aggregate they measure how much of this catalog was transcribed ' +
        'from a classic-era record, which is worth knowing even when every number in it is right.',
    },
  ],

  signatures,

  assumption: {
    title: 'One assumption, stated.',
    body:
      'The scanner assumes that a figure whose provenance is not printed beside it is not marked, even ' +
      'when a comment in the source explains it and even when meta.json records the doubt. Nothing in a ' +
      'file the reader cannot open is a badge. If you think that rule is too harsh, the mark rule for ' +
      'every signature is printed above its table so you can apply your own and get a different number.',
    correction:
      'If a signature here is wrong — the classic behaviour misdescribed, the Legends behaviour already ' +
      'settled by a source we missed, a figure marked that is not — that correction is the most useful ' +
      'thing anyone can send, and it will be credited.',
  },
};

writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);

// ---------------------------------------------------------------------------
// console report
// ---------------------------------------------------------------------------

const pad = (s, n) => String(s).padEnd(n);
const padL = (s, n) => String(s).padStart(n);

console.log('-- contamination scan, pointed at ourselves --');
console.log(`   catalog: ${items.length} items across ${catalog.shardFiles.length} shards`);
console.log(`   source:  ${source.length} files, ${report.corpus.sourceLines} lines (tests excluded)`);
console.log('');
console.log(`   ${padL(report.headline.unmarkedOnChangedMechanics, 6)}  unmarked, on mechanics we know changed`);
console.log(`   ${padL(report.headline.markedOnChangedMechanics, 6)}  of those, marked`);
console.log(`   ${padL(report.headline.classicFormats, 6)}  classic formats, mostly harmless`);
console.log(`   ${padL(report.headline.statBlocksCheckedAgainstTheGame, 6)}  of ${report.headline.statBlocksShipped} shipped stat blocks have been checked against the game`);
console.log('');
console.log(`   ${pad('signature', 22)}${padL('unmarked', 10)}${padL('marked', 8)}  group`);
for (const s of signatures) {
  console.log(`   ${pad(s.id, 22)}${padL(s.unmarked, 10)}${padL(s.marked, 8)}  ${s.group}`);
}
console.log('');
if (VERBOSE) {
  for (const s of signatures) {
    console.log(`-- ${s.id} --`);
    for (const f of s.foundIn) console.log(`     ${pad(f.file, 40)} ${padL(f.unmarked, 6)} unmarked  ${padL(f.marked, 5)} marked`);
    for (const e of s.examples) console.log(`     e.g. ${e}`);
    console.log('');
  }
}
console.log(`written: ${relative(ROOT, OUT)}`);
