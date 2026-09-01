/**
 * Sentences that cite a record, checked against the record.
 *
 * This repository has now found the same defect at least seven times: prose
 * that was true when written, cites a source, and was never re-derived from it.
 * A comment naming a command is not evidence the command was re-run. These are
 * the claims where the record is machine-readable, so the check is cheap.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(p, 'utf8');

/**
 * Source with block and line comments stripped — what a READER can actually see.
 *
 * These checks forbid phrases that were once rendered, and the comment
 * explaining each fix quotes the phrase it replaced. That is the comment doing
 * its job, and searching the raw file would make a good comment fail the test
 * for its own accuracy. Twice now a check of mine has done exactly that, so the
 * search is over rendered source rather than over the whole file.
 */
const rendered = (p: string) => read(p)
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

describe('the Landing page on what the client windows settled', () => {
  /**
   * The card said the client windows "corrected two of them — including the
   * synthetic SV Void an upgraded item grants."
   *
   * `research/validation/TIER0-VALIDATION.md` says the opposite about that
   * rule: `| SV Void (synthetic, = full, ≥2 attrs) | 10 | 10 | MATCH |`, and in
   * prose, "appears exactly as predicted. That is strong evidence the whole
   * model is correct, not coincidence." `UI-REFERENCE.md` calls the same window
   * "confirming the synthetic SV Void".
   *
   * So the front page described this project's single strongest validation
   * result — a rule recovered from a calculator's source, documented nowhere,
   * predicted, and then matched exactly — as a correction of an error.
   */
  it('does not describe the SV Void rule as corrected, because the record says MATCH', () => {
    const record = read('../research/validation/TIER0-VALIDATION.md');
    // The record's own verdict on that row, quoted from the table.
    const row = record.split('\n').find((l) => l.includes('SV Void (synthetic'));
    expect(row, 'the validation row must still exist').toBeTruthy();
    expect(row).toContain('MATCH');

    /*
     * Searched over the WHOLE rendered file, not a window around the phrase.
     *
     * The first draft sliced +/-400 characters around `indexOf('SV Void')` — and
     * the first occurrence in this file is a data constant hundreds of lines
     * above the card, so the slice never contained the sentence under test. The
     * guard passed on the restored defect. A window is a way to miss; there is
     * no reason to narrow a search that is already cheap.
     */
    const landing = rendered('src/screens/Landing.tsx');
    expect(landing).toContain('SV Void');
    expect(landing, 'the page must not call a MATCH a correction')
      .not.toMatch(/corrected two of them\s*—\s*including the synthetic SV Void/);
  });
});

describe('the Landing page on how many predictions the client confirmed', () => {
  /**
   * The showcase said "nine of nine predictions exact" in two places, citing
   * `TIER0-VALIDATION.md §1`. That table has SEVEN rows, all MATCH — and the
   * page's own enumeration beside the claim named SIX things. Three different
   * numbers for one result, on the front page, as the headline evidence, with a
   * citation to the record that contradicts it.
   *
   * The count is now DERIVED here from the record's table rather than compared
   * to a second typed number, so the page and the record cannot drift apart
   * again without this failing.
   */
  it('claims exactly the number of MATCH rows the record holds', () => {
    const record = read('../research/validation/TIER0-VALIDATION.md');
    const table = record.slice(record.indexOf('### Earthshaker'));
    const rows = table.slice(0, table.indexOf('\n\n')).split('\n')
      .filter((l) => l.startsWith('|') && !l.startsWith('| Field') && !l.startsWith('|---'));
    expect(rows.length, 'the validation table must still be there').toBeGreaterThan(0);
    const matches = rows.filter((l) => l.includes('MATCH')).length;
    expect(matches, 'every row in this table is a MATCH').toBe(rows.length);

    const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
    const word = WORDS[matches];
    const landing = rendered('src/screens/Landing.tsx');
    expect(landing, `the record holds ${matches} matching predictions`)
      .toContain(`${word} of ${word} predictions exact`);
    // And no other count is claimed anywhere on the page.
    for (const other of WORDS.filter((w) => w !== word)) {
      expect(landing, `stale count "${other} of ${other}" still on the page`)
        .not.toContain(`${other} of ${other} predictions`);
    }
  });
});

describe('the Sources page on how many items a client window was read for', () => {
  /**
   * Section 04 had "two out of two" typed into its prose. The denominator was
   * written when two items were client-verified; three more were added and it
   * did not move — while section 03, in the same file, derives the count and
   * correctly says five. One page, one set, two different sample sizes, and the
   * argument rested on the stale one: two of two reads as every sample.
   */
  it('states no sample size that the payload does not', () => {
    const sources = rendered('src/screens/Sources.tsx');
    expect(sources, 'the hardcoded denominator is gone').not.toContain('two out of two');
    expect(sources, 'and the count is derived').toContain('clientVerifiedCount');

    // Both figures come from the payload, so they cannot disagree with it.
    const meta = JSON.parse(read('public/data/meta.json'));
    const verified = meta.sourceStanding?.stats?.clientVerified ?? [];
    const contradictions = meta.dataReliability?.flags?.clientVerifiedContradictions ?? [];
    expect(verified.length, 'the payload still publishes the list').toBeGreaterThan(0);
    expect(contradictions.length).toBeLessThanOrEqual(verified.length);
  });
});

describe('the Share dialog on what actually travels in the link', () => {
  /**
   * The dialog said **"The whole plan travels in the link — every item, every
   * +N, exaltation donors, your per-class levels and every loadout."**
   *
   * Two of `GearSet`'s fields do not travel, and it is not the codec that drops
   * them — `planFrom` builds the plan as `{name, slots, weights, notes}` before
   * a byte is written. Verified by round-trip through the real codec rather
   * than by reading the type:
   *
   * ```
   *   planFrom set keys : ["name","slots","weights","notes"]
   *   withheld on plan  : undefined
   *   decoded withheld  : undefined
   * ```
   *
   * `withheld` is the one that matters. It records a position an import found
   * OCCUPIED by an item this build cannot score — `types.ts` keeps it precisely
   * so that "wearing something we cannot measure" stays distinguishable from
   * "wearing nothing", because otherwise "the upgrades ranking measured a
   * candidate against nothing and reported the whole item as gain". Dropped
   * from a link, the receiver sees that position as EMPTY and is shown an
   * inflated gain for it — the same defect `sanitizeSet` was fixed for on
   * reload, on the one surface where the sender cannot see what the receiver
   * gets.
   *
   * Whether `withheld` should be ADDED to the wire is not settled here: the
   * codec is a published format ("append only, never reorder, or every link
   * already in a Discord scrollback starts decoding to other items") and that
   * is the Director's call. What is settled is that the page must not promise
   * something it does not do.
   */
  it('does not claim the whole plan travels, when two fields do not', () => {
    const share = rendered('src/screens/SetEditor.tsx');
    expect(share, 'the dialog claimed the WHOLE plan travels')
      .not.toContain('The whole plan travels in the link');
    expect(share, 'an unqualified "every item" is the same promise reworded')
      .not.toMatch(/travels in the link — every item,/);
  });

  it('names what stays behind, in the words the rest of the app uses for it', () => {
    const share = rendered('src/screens/SetEditor.tsx');
    expect(share).toMatch(/cannot score/);
    expect(share, 'the reader is told the receiver sees it as empty')
      .toMatch(/empty/i);
  });
});

describe('the handover on what the fan-out actually returned', () => {
  /**
   * `HANDOFF.md` reported the pass as *"31 findings raised, 16 verdicts
   * returned, 15 mechanisms CONFIRMED by a refuter, 1 refuted. Severity: 12
   * agree, 3 too-high, 1 too-low."* Counted from the run's own journal, the
   * figures are 31 / 23 / 22 / 1 and 15 / 5 / 3. Five of the six were wrong:
   * typed mid-run, never re-derived, and left standing as the summary of a pass
   * whose remaining findings the next session was meant to work from.
   *
   * The journal itself lived under the session directory and is gone with the
   * container, so the numbers are now checked against the extraction committed
   * at `research/validation/AUDIT-UPGRADES-SURFACE.md` — which is in the
   * repository precisely so this check has something durable to read.
   *
   * Both documents are prose. Neither can be recomputed from the other by the
   * app, so the guard is that they AGREE: the tally block in the record and the
   * sentence in the handover state the same six numbers.
   */
  it('states the same counts the extracted record does', () => {
    const handoff = read('../HANDOFF.md');
    const record = read('../research/validation/AUDIT-UPGRADES-SURFACE.md');

    /*
     * Counted from the RUN'S OWN JOURNAL, not from either document.
     *
     * This compared the handover's sentence against the record's tally block —
     * and both of those are prose I wrote from the same source, so a mis-parse
     * would have made them wrong together and the check would still have gone
     * green. Under R225 that is the disallowed shape: a check that cannot
     * return one of its two answers converts an unmeasured property into a
     * green tick.
     *
     * The journal lived only under the session directory, which is why there
     * was nothing to disagree with. It is committed beside the record now, so
     * the numbers are re-derived from the primary artifact on every run and
     * BOTH documents can be contradicted by it.
     */
    const journal = read('../research/validation/raw/audit-upgrades-surface.journal.jsonl');
    const results = journal.split('\n').filter(Boolean)
      .map((line) => JSON.parse(line) as { type?: string; result?: unknown })
      .filter((r) => r.type === 'result')
      .map((r) => r.result as Record<string, unknown>);
    expect(results.length, 'the journal must hold agent results').toBeGreaterThan(0);

    const findings = results.filter((r) => Array.isArray(r.findings))
      .flatMap((r) => r.findings as unknown[]);
    const calls = results.filter((r) => typeof r.mechanism_verdict === 'string');
    const count = (key: string, value: string) =>
      calls.filter((v) => v[key] === value).length;

    const raised = findings.length;
    const verdicts = calls.length;
    const confirmed = count('mechanism_verdict', 'CONFIRMED');
    const refuted = count('mechanism_verdict', 'REFUTED');
    const agree = count('severity_verdict', 'AGREE');
    const tooHigh = count('severity_verdict', 'TOO-HIGH');
    const tooLow = count('severity_verdict', 'TOO-LOW');

    expect(confirmed + refuted, 'every verdict is confirmed or refuted').toBe(verdicts);
    expect(agree + tooHigh + tooLow, 'every verdict carries a severity call').toBe(verdicts);
    expect(raised, 'more raised than judged — the .slice(0, 3) cap').toBeGreaterThan(verdicts);

    // The record's own tally block must match the journal too, not just the
    // handover — otherwise the record could drift while this still passed.
    for (const [label, n] of [
      ['findings raised', raised], ['verdicts returned', verdicts],
      ['mechanism CONFIRMED', confirmed], ['mechanism REFUTED', refuted],
      ['severity  AGREE', agree], ['severity  TOO-HIGH', tooHigh],
      ['severity  TOO-LOW', tooLow],
    ] as Array<[string, number]>) {
      expect(record, `the record's tally for "${label}"`).toMatch(
        new RegExp(`^\\s*${label}\\s+${n}\\s*$`, 'm'),
      );
    }

    expect(handoff).toContain(
      `**${raised} findings raised, ${verdicts} verdicts returned, `
      + `${confirmed} mechanisms CONFIRMED by a refuter, ${refuted} refuted.**`,
    );
    expect(handoff).toContain(
      `Severity: ${agree} agree, ${tooHigh} too-high, ${tooLow} too-low.`,
    );
    // The count the run never reported, and the reason it did not.
    expect(handoff).toContain(`slice(0, 3)`);
    expect(handoff, 'the dead repo-relative citation must not stand alone')
      .toContain('under the session\ndirectory');
  });
});

describe('the extracted audit record is citable', () => {
  /**
   * The first version of this record numbered the same 31 findings three ways —
   * the verdict table 1–23, the never-judged table 1–8, and the body 1–31 — so
   * a number carried from a table into the body landed on a different finding.
   * "Finding 8" was the `src.c` Crafted flag in one place and "Nothing outranks
   * what you are wearing" in another, and every cross-reference written against
   * it, including the ones in HANDOFF.md, resolved wrongly.
   *
   * It was found by trying to USE the file, an hour after committing it. A
   * record whose identifiers do not resolve is not a record, so the property is
   * pinned rather than left to the next generator run.
   */
  const RECORD = '../research/validation/AUDIT-UPGRADES-SURFACE.md';

  function parse() {
    const s = read(RECORD);
    const body = new Map(
      [...s.matchAll(/^### (F\d\d)\. (.+)$/gm)].map((m) => [m[1] as string, m[2] as string]),
    );
    // To the NEXT heading, not to the first blank line: the status section
    // opens with prose and its table would otherwise be invisible to this check
    // — which is exactly how the first run of it reported an empty table.
    const section = (heading: string): string => {
      const m = new RegExp(`\\n## ${heading}\\n([\\s\\S]*?)(?=\\n## |$)`).exec(s);
      expect(m, `the "${heading}" section`).toBeTruthy();
      return m?.[1] ?? '';
    };
    const idsIn = (t: string) => [...t.matchAll(/^\| `(F\d\d)`/gm)].map((m) => m[1] as string);
    return { s, body, section, idsIn };
  }

  it('gives every finding exactly one id, used by both tables and the body', () => {
    const { body, section, idsIn } = parse();
    expect(body.size, 'the body lists all 31 findings').toBe(31);

    const judged = idsIn(section('Findings with a verdict'));
    const unjudged = idsIn(section('Findings that were raised and never judged'));
    expect(judged).toHaveLength(23);
    expect(unjudged).toHaveLength(8);

    const all = [...judged, ...unjudged];
    expect(new Set(all).size, 'no id appears in both tables').toBe(all.length);
    expect(all.slice().sort()).toEqual([...body.keys()].sort());
  });

  it('gives the same title under an id wherever that id appears', () => {
    const { body, section } = parse();
    const check = (heading: string, column: number) => {
      for (const line of section(heading).split('\n')) {
        const m = /^\| `(F\d\d)` \|/.exec(line);
        if (!m) continue;
        const cells = line.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
        expect(cells[column]?.replace(/\\\|/g, '|'), `${m[1]} in "${heading}"`)
          .toBe(body.get(m[1] as string));
      }
    };
    check('Findings with a verdict', 5);
    check('Findings that were raised and never judged', 3);
  });

  it('cites only ids that exist, from the status table and from the handover', () => {
    const { body, section } = parse();
    const status = [...section('What has since been done about them')
      .matchAll(/^\| `(F\d\d)`/gm)].map((m) => m[1] as string);
    expect(status.length, 'the status table is not empty').toBeGreaterThan(0);
    for (const id of status) expect(body.has(id), `status cites ${id}`).toBe(true);

    // HANDOFF.md points into this record by id; a dangling one is the defect
    // this whole describe exists for.
    for (const m of read('../HANDOFF.md').matchAll(/`(F\d\d)`/g)) {
      expect(body.has(m[1] as string), `HANDOFF cites ${m[1]}`).toBe(true);
    }
  });
});
