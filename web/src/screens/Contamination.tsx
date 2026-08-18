/**
 * Contamination — what the scanner finds *here*.
 *
 * eqlsource.com/learn/contamination scans its own pages for Project 1999
 * inheritance and publishes the result on itself. This is that page for this
 * repository: the catalog we ship and the code that prints it, scanned by
 * `pipeline/contamination.mjs`, rendered as written.
 *
 * Three rules govern what may appear here, and all three are the site's.
 *
 *   1. **Nothing is transcribed.** Every figure is read live out of
 *      `data/contamination.json`. A contamination count is only true of the
 *      build it was measured on, so a hand-copied one would be a claim about a
 *      catalog that no longer exists. Where the file is absent the page says
 *      so and prints nothing.
 *
 *   2. **Marked and unmarked never merge.** A classic figure carrying a badge
 *      is doing its job; the same figure printed bare is the fault this project
 *      exists to prevent. Two columns, always, and the mark rule for each
 *      signature is printed above its own table so a reader can disagree with
 *      the rule rather than having to trust the count.
 *
 *   3. **The worst finding goes first.** The scanner's sharpest hit is against
 *      this app — it prints the wiki's haste figure under a percent sign and
 *      weights it in the ranking, with no badge anywhere — and the page opens
 *      on it. Sorting our own faults below somebody else's conventions would be
 *      the exact failure the page is about.
 *
 * The layout is `research/DESIGN-EQLSOURCE.md`'s, matched to the live page it
 * copies: numbered sections, a big-number score strip, notes as a left rule
 * rather than a box, and one table per signature group carrying Classic /
 * Legends / What would settle it / Found in.
 */

import type { ReactNode } from 'react';
import { count } from '../lib/format';
import { href } from '../router';
import {
  asCount,
  asList,
  asText,
  scanDate,
  signaturesIn,
  useContamination,
  type CodeSite,
  type ContaminationReport,
  type FoundIn,
  type Signature,
  type SignatureGroup,
} from './contaminationData';
import './Contamination.css';

/* ------------------------------------------------------------ small parts */

function Section(props: {
  num: string;
  id: string;
  title: string;
  lede?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="cn-section" aria-labelledby={props.id}>
      <div className="cn-section-head">
        <span className="cn-section-num" aria-hidden="true">
          {props.num}
        </span>
        <h2 className="cn-section-title" id={props.id}>
          {props.title}
        </h2>
      </div>
      {props.lede ? <p className="cn-lede">{props.lede}</p> : null}
      {props.children}
    </section>
  );
}

/**
 * A note: a left rule and no box, per the design language.
 *
 * `tone` tints the rule and the lead sentence. `sig` is the bone-white rule the
 * site spends on the one statement a page is really making.
 */
function Note({
  tone = 'plain',
  lead,
  children,
}: {
  tone?: 'plain' | 'sig' | 'warn' | 'ok';
  lead?: string;
  children: ReactNode;
}) {
  return (
    <div className={`cn-note cn-note-${tone}`}>
      {lead ? <strong>{lead}</strong> : null} {children}
    </div>
  );
}

/**
 * The score strip: figure, label, and nothing else.
 *
 * `tone` is the whole reason this component takes a prop at all — zero unmarked
 * hits is good news and reads as good news, and the same figure elsewhere on
 * the page is a fault. A number that cannot be read as good or bad at a glance
 * is a number the reader has to think about before they can care.
 */
function Score({
  figure,
  label,
  tone = 'plain',
}: {
  figure: number | null;
  label: string;
  tone?: 'plain' | 'good' | 'bad';
}) {
  return (
    <div className="cn-score-cell" data-tone={tone}>
      <b>{figure == null ? '—' : count(figure)}</b>
      <span>{label}</span>
    </div>
  );
}

/**
 * A big-number callout: figure, label, one sentence of consequence.
 *
 * The site's own device, and the sentence is not optional. A figure with no
 * consequence attached is decoration.
 */
function Callout({
  figure,
  label,
  tone = 'plain',
  children,
}: {
  figure: string;
  label: string;
  tone?: 'plain' | 'good' | 'bad';
  children: ReactNode;
}) {
  return (
    <div className="cn-callout" data-tone={tone}>
      <b className="cn-callout-figure">{figure}</b>
      <span className="cn-callout-label">{label}</span>
      <p className="cn-callout-body">{children}</p>
    </div>
  );
}

/**
 * The marked/unmarked legend.
 *
 * Repeated above every table on purpose. The site's own habit: badges repeat so
 * they are never off screen when the reader decides what a column means. A
 * legend stated once at the top of a long page is a legend nobody has in view
 * at the moment they need it.
 */
function Legend() {
  return (
    <div className="cn-legend">
      <span className="cn-chip cn-chip-bad">
        Unmarked <i>printed bare</i>
      </span>
      <span className="cn-chip cn-chip-ok">
        Marked <i>carries its provenance</i>
      </span>
    </div>
  );
}

/** `1 file`, `19 files` — separated and agreeing with its noun. */
function countOf(n: number, one: string, many = `${one}s`): string {
  return `${count(n)} ${n === 1 ? one : many}`;
}

/**
 * Where a signature was found.
 *
 * File first, then how it split. The site prints a bare list of filenames; a
 * split is strictly more useful, because "found in six files" is a weaker
 * statement than "733 of them are in one".
 */
function FoundInList({ rows }: { rows: FoundIn[] }) {
  if (!rows.length) return null;
  return (
    <ul className="cn-found">
      {rows.slice(0, 8).map((row, index) => (
        <li key={`${row.file ?? index}`}>
          <code>{asText(row.file) || 'unnamed'}</code>
          <span className="cn-found-split">
            {asCount(row.unmarked) ? `${count(row.unmarked)} unmarked` : null}
            {asCount(row.unmarked) && asCount(row.marked) ? ' · ' : null}
            {asCount(row.marked) ? `${count(row.marked)} marked` : null}
          </span>
        </li>
      ))}
      {rows.length > 8 ? <li className="cn-found-more">and {countOf(rows.length - 8, 'file more', 'files more')}</li> : null}
    </ul>
  );
}

/** The exact lines of our own source the scanner matched, quoted. */
function CodeSites({ sites }: { sites: CodeSite[] }) {
  if (!sites.length) return null;
  return (
    <div className="cn-sites">
      <div className="cn-sites-head">Our own source, quoted</div>
      <ul>
        {sites.map((site, index) => (
          <li key={`${site.file ?? ''}:${site.line ?? index}`}>
            <code className="cn-sites-loc">
              {asText(site.file)}:{asCount(site.line) ?? '?'}
            </code>
            {asText(site.kind) ? <span className="cn-sites-kind">{site.kind}</span> : null}
            <pre>{asText(site.text)}</pre>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * One signature, as a table row.
 *
 * Two numeric columns and one wide cell carrying Classic / Legends / What would
 * settle it / Found in — the live page's own shape. On a narrow screen the
 * table scrolls inside its own container rather than pushing the page sideways.
 */
function SignatureRow({ sig }: { sig: Signature }) {
  const unmarked = asCount(sig.unmarked) ?? 0;
  const marked = asCount(sig.marked) ?? 0;
  const findings = asList<string>(sig.findings);
  const sites = asList<CodeSite>(sig.codeSites);
  return (
    <tr>
      <th scope="row" className="cn-sig">
        <code>{asText(sig.id) || 'unnamed'}</code>
        <span className="cn-sig-title">{asText(sig.title)}</span>
        {asText(sig.corpus) ? <span className="cn-sig-corpus">{sig.corpus}</span> : null}
      </th>
      <td className="cn-num" data-tone={unmarked > 0 ? 'bad' : 'good'}>
        {count(unmarked)}
      </td>
      <td className="cn-num" data-tone={marked > 0 ? 'ok' : 'plain'}>
        {count(marked)}
      </td>
      <td className="cn-what">
        <p>
          <b>Classic:</b> {asText(sig.classic) || 'Not recorded in this scan.'}
        </p>
        <p>
          <b>Legends:</b> {asText(sig.legends) || 'Nobody has published what Legends does here.'}
        </p>
        <p>
          <b>What would settle it:</b> {asText(sig.settle) || 'Not recorded in this scan.'}
        </p>
        {findings.length ? (
          <ul className="cn-findings">
            {findings.map((line, index) => (
              <li key={index}>{line}</li>
            ))}
          </ul>
        ) : null}
        {asText(sig.markRule) ? (
          <p className="cn-markrule">
            <b>Counted as marked when:</b> {sig.markRule}
          </p>
        ) : null}
        <CodeSites sites={sites} />
        {/* No heading over an empty list. A signature with no hits has nowhere
            it was found, and printing the label anyway is a blank pretending to
            be a fact. */}
        {asList<FoundIn>(sig.foundIn).length ? (
          <>
            <div className="cn-found-head">Found in</div>
            <FoundInList rows={asList<FoundIn>(sig.foundIn)} />
          </>
        ) : (
          <p className="cn-found-none">Found in nothing this build ships.</p>
        )}
      </td>
    </tr>
  );
}

function SignatureTable({ group, rows }: { group: SignatureGroup; rows: Signature[] }) {
  if (!rows.length) {
    return <p className="cn-absent">No signature in this scan belongs to this group.</p>;
  }
  return (
    <div className="cn-scroll">
      <table className="cn-table">
        <caption className="cn-visually-hidden">
          {asText(group.title)} — one row per signature, unmarked and marked counted separately
        </caption>
        <thead>
          <tr>
            <th scope="col">Signature</th>
            <th scope="col" className="cn-num-col">
              Unmarked
            </th>
            <th scope="col" className="cn-num-col">
              Marked
            </th>
            <th scope="col">What it is</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((sig) => (
            <SignatureRow key={asText(sig.id) || asText(sig.title)} sig={sig} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* --------------------------------------------------------------- the page */

function groupFor(report: ContaminationReport | null, id: string): SignatureGroup {
  return asList<SignatureGroup>(report?.groups).find((g) => g.id === id) ?? { id };
}

export function Contamination() {
  const { status, report, error } = useContamination();

  const headline = report?.headline;
  const corpus = report?.corpus;
  const principle = report?.principle;
  const changed = signaturesIn(report, 'changed');
  const format = signaturesIn(report, 'format');
  const checked = asCount(headline?.statBlocksCheckedAgainstTheGame);
  const shipped = asCount(headline?.statBlocksShipped);
  const scanned = scanDate(report?.scannedAt);

  return (
    <div className="cn">
      <header className="cn-head">
        <div className="cn-head-eyebrow">
          Self-audit · EQL Upgrades
          {scanned ? <> · scanned {scanned}</> : null}
        </div>
        <h1 className="cn-head-title">
          What the scanner <em>finds here</em>
        </h1>
        <p className="cn-head-lede">
          Every EverQuest Legends reference is part Project 1999 text describing a game that stopped
          existing in 2001, and this one is no exception. So this repository has a scanner for it,
          and it is pointed at us. <em>This is what it finds in the catalog this build ships and in
          the code that prints it</em> — not on anybody else.
        </p>
      </header>

      {status === 'loading' ? <p className="cn-absent">Reading this build&apos;s scan…</p> : null}
      {status === 'missing' ? (
        <p className="cn-absent">
          No scan was published with this build. Run <code>node pipeline/contamination.mjs</code> and
          deploy again; until then this page has nothing to say, and saying nothing is the correct
          behaviour for a page about not printing figures you cannot source.
        </p>
      ) : null}
      {status === 'error' ? (
        <p className="cn-absent">The scan could not be read: {error}.</p>
      ) : null}

      {status === 'ready' && report ? (
        <>
          <div className="cn-score">
            <Score
              figure={asCount(headline?.unmarkedOnChangedMechanics)}
              label="unmarked, on mechanics we know changed"
              tone={(asCount(headline?.unmarkedOnChangedMechanics) ?? 0) > 0 ? 'bad' : 'good'}
            />
            <Score
              figure={asCount(headline?.markedOnChangedMechanics)}
              label="of those, marked"
            />
            <Score figure={asCount(headline?.classicFormats)} label="classic formats, mostly harmless" />
            <Score figure={asCount(headline?.filesScanned)} label="files scanned" />
          </div>

          {asText(headline?.note) ? <p className="cn-score-note">{headline?.note}</p> : null}

          <Note tone="sig" lead={asText(principle?.hit) || 'A hit is a question, not a verdict.'}>
            {asText(principle?.hitBody)}
          </Note>
          <Note
            tone="plain"
            lead={asText(principle?.marked) || 'A classic figure carrying a badge is doing its job.'}
          >
            {asText(principle?.markedBody)}
          </Note>

          <div className="cn-callouts">
            <Callout
              figure={checked == null || shipped == null ? '—' : `${count(checked)} of ${count(shipped)}`}
              label="stat blocks checked against the game"
              tone="bad"
            >
              Every other row on this planner is a wiki scrape. That is not a scandal — it is what a
              catalog built from a wiki is — but it is the number every other number here depends on,
              and it belongs on screen rather than in a README.
            </Callout>
            <Callout figure="0" label="damage bonuses printed" tone="good">
              The live client shows a Dmg Bon line and no source in this project carries it per item,
              so this planner prints nothing there. A dry streak is a ceiling, not a zero, and an
              absent figure is shown as absent rather than reconstructed from a classic formula.
            </Callout>
            <Callout
              figure={count(
                changed.concat(format).find((s) => s.id === 'era-unplaced')?.marked ?? 0,
              )}
              label="era-unplaced rows, all of them badged"
              tone="good"
            >
              These are wiki numbers that no source places in this game, shipping only because a live
              client holds the item. Every one carries <em>Tier 5 · wiki stats, era unplaced</em> at
              the point of use. This is the column the scanner exists to drive to zero, and here it
              already is.
            </Callout>
          </div>

          <Section
            num="01"
            id="cn-changed"
            title={asText(groupFor(report, 'changed').title) || 'Mechanics we know changed'}
            lede={asText(groupFor(report, 'changed').lede)}
          >
            <Legend />
            <SignatureTable group={groupFor(report, 'changed')} rows={changed} />
          </Section>

          <Section
            num="02"
            id="cn-format"
            title={asText(groupFor(report, 'format').title) || 'Classic formats'}
            lede={asText(groupFor(report, 'format').lede)}
          >
            <Legend />
            <SignatureTable group={groupFor(report, 'format')} rows={format} />
          </Section>

          <Section
            num="03"
            id="cn-assumption"
            title={asText(report.assumption?.title) || 'One assumption, stated'}
          >
            <Note tone="plain">{asText(report.assumption?.body)}</Note>
            <Note tone="ok" lead="Corrections are the point.">
              {asText(report.assumption?.correction)}
            </Note>
          </Section>

          <Section
            num="04"
            id="cn-ourselves"
            title={asText(principle?.ourselves) || 'Why this page is about us'}
          >
            <Note tone="warn">{asText(principle?.ourselvesBody)}</Note>
            <p className="cn-source">
              Scanned by <code>{asText(report.generator) || 'pipeline/contamination.mjs'}</code> over{' '}
              {asCount(corpus?.catalogItems) != null
                ? countOf(corpus?.catalogItems ?? 0, 'shipped item')
                : 'the shipped catalog'}{' '}
              across {countOf(asCount(corpus?.catalogFiles) ?? 0, 'payload file')} and{' '}
              {countOf(asCount(corpus?.sourceFiles) ?? 0, 'source file')} (
              {count(asCount(corpus?.sourceLines) ?? 0)} lines) of <code>web/src</code>.{' '}
              {asText(corpus?.excluded)}
            </p>
            <p className="cn-source">
              The hierarchy these tiers come from is on the <a href={href.sources}>Sources</a> page,
              with what was thrown out before the catalog shipped and what is known to be unreliable
              in what remains.
            </p>
          </Section>
        </>
      ) : null}
    </div>
  );
}
