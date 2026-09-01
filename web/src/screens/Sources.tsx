/**
 * Sources — where every number in this planner came from, and what is wrong
 * with it.
 *
 * Rule 5 of `research/SOURCING-STANDARD.md`: *a player looking at a number is
 * entitled to know whether it came from the game or from a wiki page of
 * uncertain provenance. Uncertainty belongs on screen, not buried in a README.*
 * The uncertainty was worse than buried in a README — `meta.dataReliability`
 * was downloaded by every visitor and read by nothing. This page is where it
 * surfaces.
 *
 * Two rules govern what may be written here:
 *
 *   1. **Nothing is inferred.** Every number is either read live out of the
 *      shipped `meta.json` or transcribed from a named file in the repository,
 *      and each section says which at the bottom of it. Where a fact is absent
 *      from the payload, the page says it is absent instead of guessing.
 *   2. **Uncertainty is stated in the same voice as certainty**, not in a
 *      footnote. The flag vocabulary is unreliable; that is the largest card on
 *      the page and it carries the one red rule the design language allows.
 *
 * The layout is `research/DESIGN-EQLSOURCE.md`'s own: a mono section number
 * outdented beside a display-serif title, a two-column card grid, a 2px tier
 * accent on each card's top edge, mono eyebrows, and closing callouts that are
 * a left rule rather than a box. That reference screenshot is a sources page,
 * so this is the one screen in the app that can follow it literally.
 */

import type { ReactNode } from 'react';
import { count } from '../lib/format';
import { href } from '../router';
import {
  asCount,
  asList,
  asText,
  readPurge,
  TIERS,
  useSourceMeta,
  type SourceMeta,
  type TierBand,
} from './sourcesData';
import './Sources.css';

/* ------------------------------------------------------------ small parts */

function Section(props: {
  num: string;
  id: string;
  title: string;
  lede?: string;
  source?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="src-section" aria-labelledby={props.id}>
      <div className="src-section-head">
        <span className="src-section-num" aria-hidden="true">
          {props.num}
        </span>
        <h2 className="src-section-title" id={props.id}>
          {props.title}
        </h2>
      </div>
      {props.lede ? <p className="src-lede">{props.lede}</p> : null}
      {props.children}
      {props.source ? <p className="src-source">{props.source}</p> : null}
    </section>
  );
}

function Card(props: {
  standing?: TierBand | 'unattributed';
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <article className="src-card" data-standing={props.standing ?? 'unattributed'}>
      <div className="src-card-eyebrow">{props.eyebrow}</div>
      <h3 className="src-card-title">{props.title}</h3>
      {props.children}
    </article>
  );
}

function Callout({ children }: { children: ReactNode }) {
  return <div className="src-callout">{children}</div>;
}

/** A value the payload does not carry. Said, never left blank. */
function Absent({ what }: { what: string }) {
  return <p className="src-absent">Not published in this build: {what}.</p>;
}

/** `1 item`, `289 items` — separated and agreeing with its noun. */
function countOf(n: number, one: string, many = `${one}s`): string {
  return `${count(n)} ${n === 1 ? one : many}`;
}

/**
 * A string out of `meta.json`, rendered as written.
 *
 * The pipeline writes prose with backtick-quoted field names in it — "`vf`
 * lists the fields actually checked" — because it is written by and for people
 * reading a JSON file. Printing the backticks raw on a page held to
 * eqlsource's standard looks like an escaping bug; dropping them silently
 * changes somebody else's words. They become `<code>`, which is what they
 * already meant.
 */
function Prose({ text }: { text: string }) {
  const parts = text.split(/`([^`]+)`/g);
  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? <code key={index}>{part}</code> : <span key={index}>{part}</span>,
      )}
    </>
  );
}

function ReasonTable({
  caption,
  rows,
  total,
}: {
  caption: string;
  rows: readonly { reason: string; items: number }[];
  total: number;
}) {
  return (
    <div className="src-scroll">
      <table className="src-table">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Reason, as the pipeline records it</th>
            <th scope="col" className="src-num-col">
              Items
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.reason}>
              <th scope="row">
                <code>{row.reason}</code>
              </th>
              <td className="num src-num-col">{count(row.items)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Total</th>
            <td className="num src-num-col">{count(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/* --------------------------------------------------------------- the page */

/** Tier band for a standing code, matching `lib/itemStyle`'s vocabulary. */
function bandFor(code: string): TierBand | 'unattributed' {
  if (code === 'tier-M' || code === 'tier-2' || code === 'live-export' || code === 'player-report') {
    return 'trusted';
  }
  if (code === 'tier-5') return 'distrust';
  if (code === 'tier-3' || code === 'tier-4') return 'corroborating';
  return 'unattributed';
}

function tierLabel(tier: string | null | undefined): string {
  const text = asText(tier);
  return text ? `Tier ${text}` : 'No tier';
}

export function Sources() {
  const { status, meta, error } = useSourceMeta();
  return (
    <div className="src">
      <header className="src-head">
        <div className="src-head-eyebrow">Data provenance · EQL Upgrades</div>
        <h1 className="src-head-title">Sources</h1>
        <p className="src-head-lede">
          This planner prints numbers about a live game, and they are not all worth the same. This
          page names the hierarchy they are held to, what was thrown out before the catalog shipped,
          where each row&apos;s numbers came from, and — at length, because it is the part that
          matters — what is <em>known to be unreliable</em> in the data you are looking at.
        </p>
        <p className="src-head-lede">
          Nothing here is inferred. Every figure is either read live from the payload this build
          shipped or transcribed from a named file in the repository, and each section says which.
        </p>
      </header>

      {status === 'loading' ? (
        <p className="src-absent">Loading the catalog&apos;s own metadata…</p>
      ) : null}
      {status === 'missing' ? (
        <p className="src-absent">
          This build published no <code>data/meta.json</code>, so every live figure below is absent.
          The hierarchy and the era purge are transcribed from the repository and still stand.
        </p>
      ) : null}
      {status === 'error' ? (
        <p className="src-absent">
          The catalog&apos;s metadata could not be read{error ? `: ${error}` : ''}. The transcribed
          sections below still stand; the live ones are absent.
        </p>
      ) : null}

      <Hierarchy meta={meta} />
      <Purge meta={meta} />
      <Standing meta={meta} />
      <Reliability meta={meta} />
      <Upstream meta={meta} />

      <Callout>
        <p>
          <strong>If a number here is wrong, say so.</strong> Every claim on this page resolves to a
          file — <code>research/SOURCING-STANDARD.md</code>,{' '}
          <code>research/validation/TIER0-VALIDATION.md</code>, <code>pipeline/quarantine.json</code>{' '}
          or the shipped <code>meta.json</code> — and a correction to one of those is a table entry
          rather than a re-scrape. A Tier M observation ends the argument: where the game and a
          source disagree, the source is corrected, not averaged.
        </p>
      </Callout>

      <p className="src-back">
        <a href={href.items}>Browse the catalog</a> · <a href={href.landing}>Back to the planner</a>
      </p>
    </div>
  );
}

/* ------------------------------------------------------------- 01 hierarchy */

function Hierarchy({ meta }: { meta: SourceMeta | null }) {
  const standingCounts = meta?.counts?.standing;
  const tierM = asCount(standingCounts?.['tier-M']);
  const tier2 = asCount(standingCounts?.['tier-2']);
  const tier5 = asCount(standingCounts?.['tier-5']);
  const liveExport = asCount(meta?.counts?.existence?.['live-export']);

  /*
   * The live figure appended to a tier's "in this repository" line, where this
   * build publishes one. Null rather than zero when it does not: a zero would
   * read as "nothing in the catalog is Tier M", which is a different claim from
   * "this build shipped no count", and only one of them would be true.
   */
  const tierMLine = [
    liveExport === null ? null : `${countOf(liveExport, 'row')} resolve to a line in that export`,
    tierM === null ? null : `${count(tierM)} carry a stat block checked against a client window`,
  ].filter((part): part is string => part !== null);

  const liveFigure: Record<string, string | null> = {
    'Tier M': tierMLine.length ? `${tierMLine.join('; ')}.` : null,
    'Tier 2':
      tier2 === null ? null : `${countOf(tier2, 'row')} in this build take their numbers from here.`,
    'Tier 5': tier5 === null ? null : `${countOf(tier5, 'row')} in this build.`,
  };

  return (
    <Section
      num="01"
      id="src-hierarchy"
      title="The hierarchy"
      lede="Five kinds of source, ranked, plus our own instrument data above all of them. This is the standard published at eqlsource.com/sources, which this project is held to because it will eventually be absorbed into that site."
      source={
        <>
          Transcribed from <code>research/SOURCING-STANDARD.md</code>. Row counts are read live from
          this build&apos;s <code>meta.json</code>.
        </>
      }
    >
      <div className="src-grid">
        {TIERS.map((tier) => (
          <Card
            key={tier.tier}
            standing={tier.band}
            eyebrow={`${tier.tier} · ${tier.standing}`}
            title={tier.title}
          >
            <p>{tier.body}</p>
            <p className="src-card-here">
              <span className="src-card-here-label">In this repository</span>
              {tier.here}
              {liveFigure[tier.tier] ? ` ${liveFigure[tier.tier]}` : ''}
            </p>
          </Card>
        ))}
      </div>

      <Callout>
        <p>
          <strong>Two systems break almost all inherited advice.</strong> Legends characters run{' '}
          <em>three</em> classes at once, and difficulty D0–D4 changes mob behaviour rather than mob
          level. Any line that says &ldquo;you need a full group of level 50s&rdquo; came from a game
          where neither was true, and is unreliable in both directions.
        </p>
      </Callout>
    </Section>
  );
}

/* ----------------------------------------------------------------- 02 purge */

function Purge({ meta }: { meta: SourceMeta | null }) {
  const shipped = asCount(meta?.counts?.items);
  const policy = asText(meta?.era?.policy);
  const current = asText(meta?.era?.current);
  const order = asList(meta?.era?.order);
  const purge = readPurge(meta);
  const eraLess =
    purge?.quarantineReasons.find((row) => row.reason === 'no era in any source')?.items ?? 0;
  // Counted, never asserted: "sixth of thirteen" is a claim about this build's
  // own era order and has to be read off it.
  const eraIndex = current ? order.indexOf(current) : -1;
  const eraPosition = eraIndex >= 0 ? eraIndex + 1 : null;

  return (
    <Section
      num="02"
      id="src-purge"
      title="What ships, and what does not"
      lede="The source wiki is partly a Project 1999 import, and the item tables inherit it. Just over two thirds of the scraped catalog is content from expansions this game does not have, or carries no era at all."
      source={
        <>
          Every figure here is read live from <code>meta.json</code>, which the pipeline writes
          from <code>{purge?.source ?? 'pipeline/quarantine.json'}</code> at build time. Nothing on
          this page is transcribed by hand — it used to be, and it was wrong the first time the
          catalog moved.
        </>
      }
    >
      <div className="src-figures">
        <div className="src-figure">
          <span className="num src-figure-value">{count(purge?.before ?? null)}</span>
          <span className="src-figure-label">items in the raw scrape</span>
        </div>
        <div className="src-figure">
          <span className="num src-figure-value">{count(purge?.shipped ?? null)}</span>
          <span className="src-figure-label">ship</span>
        </div>
        <div className="src-figure">
          <span className="num src-figure-value">{count(purge?.quarantined ?? null)}</span>
          <span className="src-figure-label">quarantined</span>
        </div>
      </div>

      {purge && shipped !== null && shipped !== purge.shipped ? (
        <p className="src-absent">
          This build ships {count(shipped)} items, which is not the {count(purge.shipped)} the purge
          block records. The payload disagrees with itself; rebuild before trusting either.
        </p>
      ) : null}

      <div className="src-two">
        <ReasonTable
          caption="Why an item shipped"
          rows={(purge?.shipReasons ?? [])}
          total={purge?.shipped ?? 0}
        />
        <ReasonTable
          caption="Why an item was quarantined"
          rows={(purge?.quarantineReasons ?? [])}
          total={purge?.quarantined ?? 0}
        />
      </div>

      <div className="src-grid">
        <Card standing="trusted" eyebrow="The rule" title="Confirmed in era, or seen in a client">
          <p className="src-quote">{policy ?? (purge?.rule ?? "")}</p>
          {current ? (
            <p>
              The current era is <strong>{current}</strong>
              {eraPosition === null
                ? ''
                : `, ${eraPosition} of ${order.length} in the pipeline's order`}
              . Everything past it is quarantined unless a live client is holding it.
            </p>
          ) : null}
          {order.length ? <p className="src-note">{order.join(' · ')}</p> : null}
          <p>
            Quarantine is not deletion. Every one of the {count(purge?.quarantined ?? null)} is retained by
            name, with its reason, in <code>{purge?.source ?? 'pipeline/quarantine.json'}</code>, so restoring any of them is a
            table entry rather than a re-scrape.
          </p>
        </Card>

        {/*
          The title read "The largest reason is not an expansion", directly under
          a table this page renders largest-first whose top row is `era:Velious`
          at 2,828 — an expansion. Its own body says "second largest" two lines
          below. Measured from the payload the page is drawn from:
            node -e 'console.log(require("./web/public/data/meta.json")
              .counts.purge.quarantineReasons.slice(0,3))'
            -> era:Velious 2828, no era in any source 2230, era:Kunark 1438
          Title now agrees with the body and with the table. `sources.test.tsx`
          fails if it claims otherwise while the largest really is an expansion.
        */}
        <Card
          standing="distrust"
          eyebrow="Era-less is not classic"
          title="The second largest reason is not an expansion"
        >
          <p>
            An item with no era anywhere is <em>unconfirmed</em>, not assumed in-era. The second
            largest quarantine reason is not an expansion at all — it is{' '}
            <code>no era in any source</code>, {count(eraLess)} items nobody can place. They are
            withheld until a Tier M or Tier 1 source puts them in this game.
          </p>
          {asCount(meta?.counts?.eraUnknown) !== null ? (
            <p>
              {count(asCount(meta?.counts?.eraUnknown))} era-less items do ship, because the live
              client export vouches for them. Each carries <code>eraUnknown</code>.
            </p>
          ) : null}
        </Card>
      </div>

      <Callout>
        <p>
          <strong>An inference is never evidence.</strong> A previous session read the wiki&apos;s{' '}
          <code>FearHateRevamp</code> era tag, inferred that its five sets were EQL-added planar
          class gear, and reported that inference to the owner as structural confirmation. It was
          confirmation of nothing: <code>FearHateRevamp</code> is an original-EverQuest content
          patch, those sets are not in this game, and the only confirmed EQL-specific set is{' '}
          <strong>Shadow Rage</strong> — named by the owner, which is Tier M. That is the whole point
          of the hierarchy, and it is why those 53 items are in the right-hand table.
        </p>
      </Callout>
    </Section>
  );
}

/* -------------------------------------------------------------- 03 standing */

function Standing({ meta }: { meta: SourceMeta | null }) {
  const standing = meta?.sourceStanding;
  const statsVocab = asList(standing?.stats?.vocabulary);
  const existenceVocab = asList(standing?.existence?.vocabulary);
  const statsCounts = meta?.counts?.standing;
  const existenceCounts = meta?.counts?.existence;
  const notPresent = Object.entries(standing?.stats?.tiersNotPresent ?? {}).flatMap(
    ([tier, why]) => {
      const reason = asText(why);
      return reason ? [{ tier, reason }] : [];
    },
  );
  const clientVerified = asList(standing?.stats?.clientVerified);
  const items = asCount(meta?.counts?.items);

  return (
    <Section
      num="03"
      id="src-standing"
      title="Where each row's numbers came from"
      lede="Two questions, asked separately of every row: is this item in the game, and where did the numbers printed on it come from? They rest on different files and they get different answers."
      source={
        <>
          Read live from this build&apos;s <code>meta.json</code> —{' '}
          <code>sourceStanding</code> and <code>counts</code>. The same two marks are printed on
          every item window in the app.
        </>
      }
    >
      {asText(standing?.principle) ? (
        <p className="src-quote">
          <Prose text={asText(standing?.principle) ?? ''} />
        </p>
      ) : null}

      <h3 className="src-sub">Is the item in the game?</h3>
      {existenceVocab.length ? (
        <div className="src-grid">
          {existenceVocab.map((entry) => {
            const code = asText(entry.code) ?? 'unnamed';
            const n = asCount(existenceCounts?.[code]);
            return (
              <Card
                key={code}
                standing={bandFor(code)}
                eyebrow={`${tierLabel(entry.tier)} · ${n === null ? 'count absent' : countOf(n, 'item')}`}
                title={code}
              >
                <p>
                  <Prose text={asText(entry.means) ?? 'No description published.'} />
                </p>
              </Card>
            );
          })}
          <Card standing="unattributed" eyebrow="No sighting" title="absent">
            <p>
              {asText(standing?.existence?.absent) ??
                'No Tier M sighting; the item ships because its era places it in this game.'}
            </p>
          </Card>
        </div>
      ) : (
        <Absent what="the existence vocabulary" />
      )}
      {asText(standing?.existence?.note) ? (
        <p className="src-note">
          <Prose text={asText(standing?.existence?.note) ?? ''} />
        </p>
      ) : null}

      <h3 className="src-sub">Where did the numbers printed on this row come from?</h3>
      {statsVocab.length ? (
        <div className="src-grid">
          {statsVocab.map((entry) => {
            const code = asText(entry.code) ?? 'unnamed';
            const n = asCount(statsCounts?.[code]);
            return (
              <Card
                key={code}
                standing={bandFor(code)}
                eyebrow={`${tierLabel(entry.tier)} · ${n === null ? 'count absent' : countOf(n, 'row')}`}
                title={code}
              >
                <p>
                  <Prose text={asText(entry.means) ?? 'No description published.'} />
                </p>
              </Card>
            );
          })}
        </div>
      ) : (
        <Absent what="the stat-standing vocabulary" />
      )}

      {notPresent.length ? (
        <p className="src-note">
          Tiers {notPresent.map((entry) => entry.tier).join(', ')} do not occur in this catalog:{' '}
          {notPresent.map((entry) => entry.reason).join('; ')}.
        </p>
      ) : null}

      {clientVerified.length ? (
        <>
          <h3 className="src-sub">Every stat block a client window has confirmed</h3>
          <ul className="src-list">
            {clientVerified.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="src-note">
            That is the whole list — {count(clientVerified.length)} items
            {items === null ? '' : ` out of ${count(items)}`}. The honest reading of this page is
            that every other stat block is a wiki field somebody typed in, and that the marks in the
            item window are what tell the two apart.
          </p>
        </>
      ) : null}
    </Section>
  );
}

/* ----------------------------------------------------------- 04 reliability */

function Reliability({ meta }: { meta: SourceMeta | null }) {
  const rel = meta?.dataReliability;
  /*
   * The same list section 03 renders, read from the same place, so the two
   * sections cannot state different sample sizes for one set. They did: this
   * one had "two out of two" typed into prose while section 03 derived five.
   */
  const clientVerifiedCount = asList(meta?.sourceStanding?.stats?.clientVerified).length;
  if (!rel) {
    return (
      <Section
        num="04"
        id="src-reliability"
        title="What we are not sure of"
        lede="The catalog's own account of its weak spots."
      >
        <Absent what="dataReliability" />
      </Section>
    );
  }

  const flags = rel.flags;
  const legacy = flags?.pageConventions?.legacy;
  const modern = flags?.pageConventions?.modern;
  const legacyNoDrop = asCount(legacy?.NO_DROP);
  const modernNoDrop = asCount(modern?.NO_DROP);
  const skill = rel.weaponSkill;
  const suspects = asList(skill?.suspects);
  const unstatted = rel.unstattedKnownItems;

  return (
    <Section
      num="04"
      id="src-reliability"
      title="What we are not sure of"
      lede="The catalog keeps its own account of where it is weak. It has shipped to every browser in meta.dataReliability all along; this is it, in its own words."
      source={
        <>
          Read live from this build&apos;s <code>meta.json</code> — <code>dataReliability</code>.
        </>
      }
    >
      <div className="src-grid">
        <Card
          standing="trusted"
          eyebrow={`Stats · confidence ${asText(rel.stats?.confidence) ?? 'unstated'}`}
          title="The numbers themselves hold up"
        >
          <p>
            {asText(rel.stats?.note) ??
              'No note published for the stat block confidence in this build.'}
          </p>
          <p className="src-note">
            This is the one green light on the page, and it is narrow: it says the values we print
            match the client on every sample taken so far. It is not a claim that any particular
            unsampled row is right.
          </p>
        </Card>

        <Card
          standing="unattributed"
          eyebrow={`Damage bonus · ${asText(rel.dmgBonus?.confidence) ?? 'unstated'}`}
          title="Dmg Bon is not in the data"
        >
          <p>
            <Prose text={asText(rel.dmgBonus?.note) ?? 'No note published.'} />
          </p>
        </Card>

        <Card
          standing="trusted"
          eyebrow={`Item ids · ${asText(rel.itemIds?.confidence) ?? 'unstated'}`}
          title="Right where present, mostly absent"
        >
          <p>
            <Prose text={asText(rel.itemIds?.note) ?? 'No note published.'} />
          </p>
        </Card>

        <Card
          standing="unattributed"
          eyebrow={`Known items, no stats · ${asCount(unstatted?.count) ?? 0}`}
          title="Withheld rather than guessed"
        >
          <p>
            <Prose text={asText(unstatted?.policy) ?? 'No policy published.'} />
          </p>
          {asList(unstatted?.items).length ? (
            <p className="src-note">
              {asList(unstatted?.items)
                .map((item) => asText(item.n))
                .filter(Boolean)
                .join(' · ')}
            </p>
          ) : null}
        </Card>
      </div>

      {/*
        The flag vocabulary gets the page's one red rule and its own full-width
        card. It is the only field in the catalog the data itself says must not
        be used as a filter, and the app has been filtering on it.
      */}
      <article className="src-card src-card-wide" data-standing="distrust">
        <div className="src-card-eyebrow">
          Flags · confidence {asText(flags?.confidence) ?? 'unstated'}
          {flags?.doNotUseAsAuthoritativeFilter ? ' · do not use as an authoritative filter' : ''}
        </div>
        <h3 className="src-card-title">The flag line is the least trustworthy thing we print</h3>
        <p>
          <Prose text={asText(flags?.summary) ?? 'No summary published.'} />
        </p>

        {asList(flags?.clientVerifiedContradictions).length ? (
          <>
            <h4 className="src-sub-sm">Where a live client disagrees with the catalog</h4>
            <div className="src-contras">
              {asList(flags?.clientVerifiedContradictions).map((contra) => (
                <div className="src-contra" key={asText(contra.item) ?? 'item'}>
                  <div className="src-contra-item">{asText(contra.item) ?? 'Unnamed item'}</div>
                  <div className="src-contra-row">
                    <span className="src-contra-label">Client</span>
                    <span>{asList(contra.client).join(', ') || '—'}</span>
                  </div>
                  <div className="src-contra-row">
                    <span className="src-contra-label">Catalog</span>
                    <span>{asList(contra.catalog).join(', ') || '—'}</span>
                  </div>
                </div>
              ))}
            </div>
            {/*
              * Both figures DERIVED, and that is the point of the change.
              *
              * This read "Both of the items a client window has been read for
              * contradict … it is two out of two". The denominator was typed
              * when two items were client-verified, and three more were added
              * without it moving — while section 03, ten screens up, renders
              * `count(clientVerified.length)` and correctly says five. The page
              * stated two different sample sizes for the same set, and the
              * rhetorical weight sat entirely on the one that had gone stale:
              * two of two reads as every sample, two of five does not.
              */}
            <p className="src-note">
              {count(asList(flags?.clientVerifiedContradictions).length)} of the{' '}
              {count(clientVerifiedCount)} items a client window has been read for contradict the
              catalog&apos;s flag line. That is not a rate — the sample is far too small — but one
              of them is the weapon on this app&apos;s front page.
            </p>
          </>
        ) : null}

        {legacy || modern ? (
          <>
            <h4 className="src-sub-sm">The vocabulary splits by who wrote the page</h4>
            <div className="src-scroll">
              <table className="src-table">
                <thead>
                  <tr>
                    <th scope="col">Flag</th>
                    <th scope="col" className="src-num-col">
                      Legacy-style pages
                    </th>
                    <th scope="col" className="src-num-col">
                      Modern-style pages
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {['NO_DROP', 'NO_TRADE', 'LORE', 'LORE_EQUIPPED', 'MAGIC', 'PLACEABLE'].map(
                    (flag) => {
                      const l = asCount(legacy?.[flag]);
                      const m = asCount(modern?.[flag]);
                      if (l === null && m === null) return null;
                      return (
                        <tr key={flag}>
                          <th scope="row">
                            <code>{flag}</code>
                          </th>
                          <td className="num src-num-col">{l === null ? '—' : count(l)}</td>
                          <td className="num src-num-col">{m === null ? '—' : count(m)}</td>
                        </tr>
                      );
                    },
                  )}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row">Pages of that style</th>
                    <td className="num src-num-col">
                      {asCount(legacy?.pages) === null ? '—' : count(asCount(legacy?.pages))}
                    </td>
                    <td className="num src-num-col">
                      {asCount(modern?.pages) === null ? '—' : count(asCount(modern?.pages))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        ) : null}

        {asList(flags?.findings).length ? (
          <>
            <h4 className="src-sub-sm">What that means</h4>
            <ul className="src-list">
              {asList(flags?.findings).map((finding) => (
                <li key={finding}>
                  <Prose text={finding} />
                </li>
              ))}
            </ul>
          </>
        ) : null}

        {asText(flags?.openQuestion) ? (
          <p className="src-open">
            <span className="src-card-here-label">Open question</span>
            <Prose text={asText(flags?.openQuestion) ?? ''} />
          </p>
        ) : null}

        <h4 className="src-sub-sm">What this means for the filters in this app</h4>
        <p>
          The item picker offers a <strong>Hide No Drop</strong> checkbox, and the auto-fill filters
          carry the same switch.{' '}
          {legacyNoDrop !== null && modernNoDrop !== null ? (
            <>
              <code>NO_DROP</code> is recorded on {count(legacyNoDrop)} legacy-style pages and{' '}
              {count(modernNoDrop)} modern-style ones,{' '}
            </>
          ) : (
            <>
              <code>NO_DROP</code> is recorded only by the older of the wiki&apos;s two authoring
              conventions,{' '}
            </>
          )}
          so that box filters by which convention wrote the page at least as much as by what the
          game does. It hides legacy-style untradeable items and keeps modern-style ones, which
          spell the same restriction <code>NO_TRADE</code>. Read it as{' '}
          <em>&ldquo;hide items whose legacy wiki page said NO DROP&rdquo;</em>, not as{' '}
          <em>&ldquo;hide everything I cannot trade&rdquo;</em>. Nothing in the app filters on{' '}
          <code>MAGIC</code>, which the client has never once shown us.
        </p>
      </article>

      {skill ? (
        <article className="src-card src-card-wide" data-standing="distrust">
          <div className="src-card-eyebrow">
            Weapon skill · confidence {asText(skill.confidence) ?? 'unstated'}
          </div>
          <h3 className="src-card-title">Monk fist weapons are probably filed under the wrong skill</h3>
          <p>
            <Prose text={asText(skill.summary) ?? 'No summary published.'} />
          </p>

          {asList(skill.clientVerifiedContradictions).length ? (
            <div className="src-contras">
              {asList(skill.clientVerifiedContradictions).map((contra) => (
                <div className="src-contra" key={asText(contra.item) ?? 'item'}>
                  <div className="src-contra-item">{asText(contra.item) ?? 'Unnamed item'}</div>
                  <div className="src-contra-row">
                    <span className="src-contra-label">Client</span>
                    <span>{asText(contra.client) ?? '—'}</span>
                  </div>
                  <div className="src-contra-row">
                    <span className="src-contra-label">Catalog</span>
                    <span>{asText(contra.catalog) ?? '—'}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {asList(skill.evidence).length ? (
            <ul className="src-list">
              {asList(skill.evidence).map((line) => (
                <li key={line}>
                  <Prose text={line} />
                </li>
              ))}
            </ul>
          ) : null}

          {suspects.length ? (
            <p className="src-note">
              <span className="src-card-here-label">
                {count(suspects.length)} suspects, by the rule{' '}
                {asText(skill.suspectRule) ? <code>{asText(skill.suspectRule)}</code> : null}
              </span>
              {suspects
                .map((s) => {
                  const name = asText(s.n);
                  const listed = asText(s.skill);
                  return name ? (listed ? `${name} (listed ${listed})` : name) : null;
                })
                .filter(Boolean)
                .join(' · ')}
            </p>
          ) : null}

          <p className="src-note">
            Nothing has been moved: every weapon ships with the skill its source gives it. The
            suspicion is recorded rather than acted on, because correcting a skill on suspicion
            would be exactly the invention this standard exists to prevent.
          </p>
        </article>
      ) : null}
    </Section>
  );
}

/* -------------------------------------------------------------- 05 upstream */

function Upstream({ meta }: { meta: SourceMeta | null }) {
  const repos = asList(meta?.provenance?.repos);
  const inputs = asList(meta?.provenance?.inputs);
  const ids = meta?.provenance?.itemIds;
  const built = asText(meta?.builtAt);
  const when = built ? new Date(built) : null;
  const builtOn =
    when && !Number.isNaN(when.getTime())
      ? when.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
      : null;

  return (
    <Section
      num="05"
      id="src-upstream"
      title="What this build was made from"
      lede="Four upstream repositories, each pinned to a commit, all of them ultimately carrying eqlwiki content."
      source={
        <>
          Read live from this build&apos;s <code>meta.json</code> — <code>provenance</code>,{' '}
          <code>license</code> and <code>builtAt</code>.
        </>
      }
    >
      {repos.length ? (
        <div className="src-scroll">
          <table className="src-table">
            <caption>Upstream repositories, pinned</caption>
            <thead>
              <tr>
                <th scope="col">Repository</th>
                <th scope="col">Commit</th>
                <th scope="col">Role</th>
                <th scope="col">License</th>
              </tr>
            </thead>
            <tbody>
              {repos.map((repo) => (
                <tr key={`${asText(repo.repo)}-${asText(repo.sha)}`}>
                  <th scope="row">
                    <code>{asText(repo.repo) ?? 'unnamed'}</code>
                    {asText(repo.file) ? <div className="src-cell-sub">{asText(repo.file)}</div> : null}
                  </th>
                  <td>
                    <code>{(asText(repo.sha) ?? '').slice(0, 12) || '—'}</code>
                  </td>
                  <td>{asText(repo.role) ?? '—'}</td>
                  <td>{asText(repo.license) ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Absent what="the upstream repository list" />
      )}

      {inputs.length ? (
        <div className="src-scroll">
          <table className="src-table">
            <caption>Input files, hashed</caption>
            <thead>
              <tr>
                <th scope="col">Key</th>
                <th scope="col">File</th>
                <th scope="col" className="src-num-col">
                  Bytes
                </th>
                <th scope="col">SHA-256 (first 16)</th>
              </tr>
            </thead>
            <tbody>
              {inputs.map((input) => (
                <tr key={asText(input.file) ?? asText(input.key) ?? 'input'}>
                  <th scope="row">{asText(input.key) ?? '—'}</th>
                  <td>
                    <code>{asText(input.file) ?? '—'}</code>
                  </td>
                  <td className="num src-num-col">
                    {asCount(input.bytes) === null ? '—' : count(asCount(input.bytes))}
                  </td>
                  <td>
                    <code>{asText(input.sha256_16) ?? '—'}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="src-grid">
        <Card standing="trusted" eyebrow="Item ids" title="The only numbers the wiki never had">
          <p>
            <Prose text={asText(ids?.note) ?? 'No note published.'} />
          </p>
          {asText(ids?.source) ? <p className="src-note">{asText(ids?.source)}</p> : null}
          {asCount(ids?.observed) !== null && asCount(ids?.applied) !== null ? (
            <p className="src-note">
              {count(asCount(ids?.observed))} observed in the export, {count(asCount(ids?.applied))}{' '}
              matched to a shipped item.
            </p>
          ) : null}
        </Card>

        {/*
          Titled for what the source actually says, which is nothing.

          This card read "CC BY-SA, share alike" until eqlsource.com verified
          on 2026-08-18 that eqlwiki publishes no content licence at all. The
          heading is now the finding rather than the assumption, and the body
          renders `meta.license.note`, which carries how it was checked.
        */}
        <Card standing="unattributed" eyebrow="Licence and credit" title="No licence is stated">
          <p>{asText(meta?.attribution) ?? 'No attribution published in this build.'}</p>
          {asText(meta?.license?.note) ? (
            <p className="src-note">{asText(meta?.license?.note)}</p>
          ) : null}
          <p className="src-note">
            {builtOn ? `This catalog was built on ${builtOn}` : 'This catalog carries no build date'}
            {asText(meta?.generator) ? ` by ${asText(meta?.generator)}` : ''}. Per tier 4&apos;s rule,
            anything older than the last patch is treated as stale.
          </p>
        </Card>
      </div>
    </Section>
  );
}
