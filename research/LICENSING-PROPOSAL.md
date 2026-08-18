# A licence for 50 Upgrades — proposal for signature

**Status:** draft, unsigned. Nothing in this document is in force.
**Prepared:** 2026-08-18. **Decides:** what terms this repository offers, and to whom.
**For:** the owner. **Action required:** initial one option in each of the three decisions
in §7, or reject.

> **This is not legal advice and I am not a lawyer.** What follows is an inventory of what
> this project holds and where each part came from, assembled by measurement, plus the
> options that inventory permits. Which option is *lawful* in your jurisdiction, and which
> is *wise*, are questions for a person qualified to answer them. Everything below is
> offered so that such a person — or you — can decide from facts rather than from
> impressions. That sentence is stated once and not repeated.

---

## 1. Why this is open

On 2026-08-18 this project withdrew its claim of **CC BY-SA 4.0** over item data. The
claim had stood for most of the project's life and had never been checked; it was assumed,
because a wiki usually is CC BY-SA. It was checked, and it was wrong: eqlwiki publishes no
content licence at all.

The withdrawal was correct and is not reopened here. But withdrawing a wrong licence does
not leave a right one behind — it leaves **nothing**. Today:

| | |
|---|---|
| Content licence asserted over item data | none (`meta.license.content === null`) |
| Licence file in this repository | **none, on any branch** |
| Licence offered to a downstream consumer | none |

The last line is the one that now costs something. The Director reports that an external
audit of `eqlsource` flags its vendored snapshot of our data as an **unlicensed
dependency**. That is an accurate finding, not a misunderstanding to be explained away: we
publish a payload, another project consumes it, and we have told that project nothing about
what it may do with it. An audit that flags this is doing its job.

*(Nothing else about `eqlsource`'s repository is asserted here. Per `HANDOFF.md`, everything
known about it comes through the Director, and only the audit finding above was stated.)*

**The commands behind the two "none" rows:**

```
git log --oneline --all -- LICENSE LICENSE.md COPYING     # no output: never tracked
node -e 'console.log(require("./web/public/data/meta.json").license.content)'   # null
```

---

## 2. The upstream silence, re-verified

The withdrawal rests on eqlwiki publishing no terms. I re-ran the three recorded checks
today, independently, and added a fourth. All four agree.

| # | Check | Result today (2026-08-18) |
|---|---|---|
| 1 | `api.php?action=query&meta=siteinfo&siprop=rightsinfo` | `{"url":"","text":""}` — both empty |
| 2 | `GET /wiki/Project:Copyrights` | `301` → `/Wiki/Project:Copyrights` → **`404`** |
| 3 | `api.php?action=query&titles=Project:Copyrights` | normalises to `EQLWiki:Copyrights`, `"missing":""` |
| 4 | **new** — rendered `Main_Page` footer | `footer-info` holds a lastmod line and nothing else; the string `rights` occurs **0 times** in 52,914 bytes of page |

Check 4 is worth recording because it closes a gap the first three leave. MediaWiki renders
a `footer-info-copyright` element on every page when `$wgRightsText` is set. It is absent.
So the silence is not an API quirk or an unwritten project page — the wiki does not display
terms to a human reader either. The site runs MediaWiki 1.45.3 (from the same `siteinfo`
call), so the machinery to publish terms is present and unused.

```
curl -sS "https://eqlwiki.com/api.php?action=query&meta=siteinfo&siprop=rightsinfo|general&format=json"
curl -sSL -o /tmp/c.html -w '%{http_code} %{url_effective}\n' "https://eqlwiki.com/wiki/Project:Copyrights"
curl -sS "https://eqlwiki.com/api.php?action=query&titles=Project:Copyrights&format=json"
curl -sS -o /tmp/mp.html -w '%{http_code} %{size_download}\n' "https://eqlwiki.com/Main_Page" && grep -ioc rights /tmp/mp.html
```

**What silence means.** It does not mean "public domain" and it does not mean "forbidden".
It means the source has granted nothing explicitly, and any statement we make about what a
third party may do with material derived from it would be a statement about *their* rights
that they have not made themselves. Re-asserting a licence over that material — any licence,
including a permissive one — would repeat exactly the fault the withdrawal corrected.

---

## 3. The four strata

Everything this project ships falls into one of four layers. They have different owners and
they must be licensed differently or not at all. Counts are computed, and the command that
produces each is given.

### Stratum A — DERIVED from eqlwiki (terms unstated; **not ours to licence**)

Four scraped catalogues feed the build. Three of them (`eqlwiki`, `jmoyers`,
`nathanbates`) state eqlwiki as their upstream; the fourth (`eqbuddy`) contributes only
where those three already have the item.

| Measure | Count | Of 3,663 |
|---|---:|---:|
| Shipped records whose name appears in at least one eqlwiki-derived scrape | **3,650** | 99.6% |
| Shipped records printing a wiki-sourced stat block (`sd` = `tier-2` or `tier-5`) | **2,171** | 59.3% |
| — of which in-era structured wiki data (`tier-2`) | 2,045 | 55.8% |
| — of which wiki numbers no era places in this game (`tier-5`, marked on sight) | 126 | 3.4% |
| Records carrying wiki classification but no sourced numbers (era / class / race / slot / flags / weight / icon) | **1,477** | 40.3% |
| Records carrying an icon id (`ic`) — single-source, see §4 | **3,631** | 99.1% |

Only **13** shipped names appear in no scrape at all (§3B). Put plainly: **essentially the
entire catalogue is derived from a source that has granted us nothing.** Whatever is decided
below, Stratum A cannot be sub-licensed by us.

```
node -e 'const i=require("./web/public/data/items-index.json").items;
 const t={};for(const x of i)t[x.sd]=(t[x.sd]||0)+1;console.log(i.length,t,
 i.filter(x=>x.ic!==undefined).length)'
```
The 3,650 and 13 figures come from re-indexing the four raw scrapes in `research/data/`
with the build's own `nameKey`, and intersecting against `items-index.json`.

### Stratum B — MINED by the owner from a live client (**ours, first-hand**)

This is the only material in the project observed directly from the running game by its
owner. It is original factual observation, recorded on a dated session by a named character.

| Source | Measure | Count |
|---|---|---:|
| `research/validation/tier0-inventory-Avenrae.txt` | rows in the `/outputfile inventory` export | 981 |
| | rows naming a real item (not `Empty`) | 447 |
| | distinct base name → game ID pairs, after the build's suffix rule | **297** |
| `research/validation/TIER0-VALIDATION.md` | dated client captures | 8 |
| `research/validation/TIER0-PLAYER-REPORTS.md` | direct owner reports | — |
| payload | records ranked with stats verified against a client window (`sd` = `tier-M`) | 5 |
| payload | records shipped on live-export existence evidence (`ex` = `live-export`) | 197 |

**No wiki scrape anywhere in the corpus carries a numeric game item ID.** All 299 IDs in the
payload come from a client export — the owner's, or EQL Source's equivalent (§3C). Matched
under the build's own loose key: **297 of the 299 are reachable from the owner's export**,
119 from EQL Source's table, 117 from both, and 2 from EQL Source alone. Wiki contribution
to this field: zero.

Thirteen shipped records exist on Tier M evidence alone, with no wiki catalogue entry of any
kind — ten existence-only records (`xo: true`) plus the three hard-coded Shadow Rage pieces
in `TIER0_KNOWN_ITEMS`. These are wholly Stratum B.

```
node -e 'const i=require("./web/public/data/items-index.json").items;
 console.log(i.filter(x=>x.id!=null).length, i.filter(x=>x.xo).length,
 i.filter(x=>x.ex==="live-export").length)'
```

### Stratum C — EQL SOURCE's own published datasets (**terms already stated**)

Four versioned datasets vendored under `pipeline/sources/eqlsource/`, pinned by SHA-256 in
`manifest.json`: `items.v1.json` (257 name→ID pairs), `sightings.v1.json` (277 measured
drops), `zones.v1.json` (13 surveyed zones), `sky.v1.json` (16 rows, vendored but not yet
read by the build).

Every one of the four carries an identical `terms` block, and it already says the thing this
proposal has to say:

> *"The measured data — drop sightings, damage figures, spell lists — is parsed from this
> project's own combat logs. Freely usable with attribution."*
>
> *"Fields sourced from community wikis carry their tier and source. **Those values are not
> ours to license**; respect the original source and do not present a tier 5 figure as
> fact."*

This is the strongest precedent available: the very consumer whose audit raised the flag
already publishes under exactly the split-by-provenance posture proposed below. Adopting the
same shape is not an innovation; it is consistency across two tools of one site.

Our payload carries 277 measured-drop existence markers and 95 `eqlsource-id` markers
sourced from Stratum C, and 309 shard records carry drop rows (`ms`).

```
node -e 'console.log(require("./pipeline/sources/eqlsource/items.v1.json").terms)'
```

### Stratum D — ORIGINAL to this repository (**unambiguously ours to licence**)

Nothing in this stratum was scraped, derived or transcribed. It is the work.

| What | Measure |
|---|---:|
| Application source (`web/src`, excluding tests) | 31,240 lines across 84 files |
| Pipeline programs (`build`, `verify`, `contamination`, `refresh`) | 6,079 lines |
| Test suite | 14,822 lines; 58 unit files + 20 Playwright specs |
| Documentation prose (README, CLAUDE, DESIGN, HANDOFF, `research/`, `pipeline/README`) | 36,665 words |
| **Payload schema** — field codes in the shipped detail record | 32 (22 in the index record) |
| **Era purge** — quarantined records, each retained with a named reason | **7,599**, under 8 reason codes |
| **Admission rules** — reasons a record is allowed to ship | 10 reason codes |
| **Source-standing vocabulary** — the `ex` / `sd` codes and their definitions | 4 + 4 |
| **Contamination signatures** — the Project-1999-inheritance scanner | 11 signatures, 2 groups |
| Era ladder | 13 ranked eras |
| Slot map | 23 positions, 18 types, 3 doubled |

The most valuable item on that list is the one that looks least like property: **the
decision to quarantine 7,599 of 11,252 scraped records.** Anyone can re-scrape eqlwiki in an
afternoon and get 11,252 rows. Knowing which 3,663 of them are in this game — and being able
to name the reason for every one of the 7,599 refusals — is judgement exercised over years
of play and two days of correcting a specific inherited error. The selection is the asset.
The facts selected are not.

```
wc -l pipeline/*.mjs
cd web && find src -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.css' \) -not -name '*.test.*' | wc -l
node -e 'const q=require("./pipeline/quarantine.json");console.log(q.items.length,q.counts.quarantineReasons.length)'
```

---

## 4. The upstream licences — checked, not transcribed

`meta.provenance.repos` records a licence string for each of the four scrape repositories.
Those strings had the same standing the CC BY-SA claim had: written down once, never
verified. I fetched all four at the **pinned SHA**, not the branch tip.

| Repo | Role | Recorded as | Verified at pinned SHA |
|---|---|---|---|
| `Thiole/EQLGearPlanner` @`0213a63` | **PRIMARY**: stats, slots, classes, races, era, acquisition | no license file | **Confirmed.** `LICENSE`, `LICENSE.md`, `LICENSE.txt`, `COPYING`, `COPYING.md`, `UNLICENSE` all 404 |
| `nathan-bates/eql` @`3caccd0` | gap-fill: endurance, required level, focus effects | no license file | **Confirmed.** Same six paths, all 404 |
| `DranakCorps-bot/EQBuddy` @`03c624c` | gap-fill: quests, recipes, drop zones | MIT | **Confirmed.** `LICENSE` → MIT, © 2026 David Edwards |
| `jmoyers/everquest-companion` @`d25455e` | enrichment: iconId, typed effects, statsBlock, name coverage | "FSL-1.1 (code)" | **Confirmed present, and materially narrower than the note suggests** — see below |

```
for r in Thiole/EQLGearPlanner nathan-bates/eql DranakCorps-bot/EQBuddy jmoyers/everquest-companion; do
  curl -sS -o /dev/null -w "$r LICENSE %{http_code}\n" "https://raw.githubusercontent.com/$r/<sha>/LICENSE"
done
```

**Three findings the owner needs before deciding.**

**(a) The two largest scrape inputs have no licence at all.** `Thiole/EQLGearPlanner` is the
PRIMARY source for stats, slots, classes, races, era and acquisition — the substance of the
catalogue — and it grants nothing. `nathan-bates/eql` likewise. Their own upstream is
eqlwiki, which also grants nothing. **The silence is two layers deep, not one.**

**(b) `jmoyers` is FSL-1.1-MIT, and the licence file is at the repository root with no scope
carve-out.** The provenance note annotates it "(code)", which is an interpretation, not a
reading. The `LICENSE` covers "the Software … as indicated by our inclusion of these Terms
and Conditions with the Software", and `src/main/data/items.json` sits inside that
repository. On the plain reading the data file is inside the grant. Two clauses then matter:

- **Permitted Purpose excludes a "Competing Use"** — making the Software available in a
  commercial product or service that "offers the same or substantially similar functionality".
  `everquest-companion` is an EverQuest companion application. This project is an EverQuest
  gear planner. Whether that is "substantially similar functionality" is a real question, and
  it is *not* one I can settle. It bites only on **commercial** use; a non-commercial fan tool
  is on much safer ground, and the licence names "non-commercial research" and "internal use"
  as expressly permitted.
- **Grant of Future License** — the terms convert irrevocably to MIT on the **second
  anniversary** of availability. The `LICENSE` is copyright **2026**. Conversion is therefore
  in 2028 at the earliest, not now.
- **Redistribution** — any copy, modification or derivative must carry a copy of or link to
  the FSL terms and must not remove copyright notices. We currently do neither.

**(c) The measurable exposure to `jmoyers` is one field and forty-six records.** Every merged
field in `build.mjs` draws from a ranked candidate list of four or five sources — except one:

```js
const [ic] = pick('ic', [['jmoyers', () => int(j?.iconId)]]);   // build.mjs:1468
```

`ic` has a single candidate. **3,631 of 3,663 shipped records carry an icon id that exists
only because of the FSL-licensed input.** Separately, **46 shipped records appear in the
`jmoyers` catalogue and in none of the other three** — drop that input and those records lose
their only name-bearing source. Every other jmoyers contribution is a fallback behind
`eqlwiki` or `statsBlock` and would degrade rather than vanish.

This is a bounded, fixable dependency, which is why it is worth naming precisely: it is one
field and a 46-record tail, not the catalogue.

---

## 5. What we can and cannot offer

| Stratum | Ours to licence? | Why |
|---|---|---|
| **A** — wiki-derived facts and stat blocks | **No** | Source grants nothing; two intermediaries also grant nothing |
| **B** — the owner's client observations | **Yes** | First-hand observation by the owner. Note that individual facts about a game may not attract copyright at all in many jurisdictions — but they are ours to *release*, and releasing them costs nothing |
| **C** — EQL Source datasets | **Already licensed to us**, on stated terms | Attribution + read-the-provenance; and their own terms already disclaim the wiki-sourced fields |
| **D** — code, schema, selection, vocabularies, prose | **Yes, entirely** | Written here |

The honest sentence for a downstream consumer is therefore not "here is our licence" but a
split one: *we grant what is ours, we name what is not, and we tell you where the unlicensed
part came from so you can make your own assessment.* That is worse than a clean grant. It is
also true, and it is what EQL Source's own datasets already say (§3C).

---

## 6. What is not on the table

Stated so that no future session proposes it as a tidy solution.

- **Re-asserting any content licence over Stratum A.** Including permissive ones. Including
  CC0. We cannot give away what was never granted to us, and doing so would repeat the exact
  fault of 2026-08-18 — the fault this project spent two days removing from its item stats.
- **Leaving the repository with no `LICENSE` file at all.** Absence of a file is not
  neutrality; under the default rule it is *all rights reserved*, which means the code — 31,240
  lines that are unambiguously ours to give — is currently more restricted than the data.
  Doing nothing is itself a choice, and it is the least defensible one.
- **Asserting a licence and disclaiming it in prose.** A `LICENSE` file saying MIT with a
  README saying "except the data" is a trap for a machine reader; the audit that flagged this
  reads files, not paragraphs. Whatever is decided must be legible to a scanner.

---

## 7. The decisions

Three independent decisions. Initial one option in each.

### Decision 1 — the code

| | Option | Trade-off |
|---|---|---|
| ☐ **1A** | **Permissive** (MIT or Apache-2.0) on `web/`, `pipeline/`, tests, docs | Clears the audit finding for the code immediately and costs nothing that matters — the value here is the data selection, not the React. Apache-2.0 adds an explicit patent grant and a NOTICE mechanism, which is a convenient place to carry the eqlwiki attribution and the Daybreak disclaimer. Cost: anyone may ship a competing planner from this source. Given the catalogue is the asset, that cost is small. |
| ☐ **1B** | **Copyleft** (AGPL-3.0) | A hosted fork must publish its changes back. Fits a project whose whole thesis is that provenance should be visible. Cost: many downstream consumers, including some commercial tooling, will not touch AGPL — and if `eqlsource` ever vendors our *code* rather than our payload, this constrains it. |
| ☐ **1C** | **Source-available** (FSL-1.1-MIT, mirroring `jmoyers`) | Symmetry with an upstream, and a non-compete window that converts to MIT in two years. Cost: not an OSI-approved open-source licence; most audit tools flag it; and it imports the same "substantially similar functionality" ambiguity we are trying to resolve, pointed outward this time. |

*Whichever is chosen, the FSL notice obligation from §4(b) is discharged in the same pass:
carry a copy of or link to the `jmoyers` terms wherever the payload is redistributed.*

### Decision 2 — the data

| | Option | Trade-off |
|---|---|---|
| ☐ **2A** | **No licence, provenance statement only.** Publish, per record, where each field came from — which the payload already does — and state that wiki-derived values carry no granted terms. | Maximally honest and needs almost no new work: `sd`, `ex`, `sdc` and `vf` already encode it. Cost: an audit still reports "no licence", because there is none. It converts an unlicensed dependency into a *documented* unlicensed dependency. That is a real improvement and it is not a clean bill of health. |
| ☐ **2B** | **Layered grant** — licence Strata B and D explicitly (e.g. CC BY 4.0 over the owner's observations, the schema, the selection and the quarantine reasons), and mark Stratum A `no-license-granted` field by field. | The strongest defensible position: a downstream consumer gets real permission over the part that is ours, and precise notice over the part that is not. Cost: the most work — the payload must carry per-field or at least per-stratum licence markers, and `verify.mjs` must gate them, or they will drift. |
| ☐ **2C** | **Assert a compilation / database right over the selection and arrangement**, while granting nothing over individual facts, and licence *that* right (e.g. CC BY-SA 4.0 or ODbL over the compilation). | This is the option most likely to be *correct* on the merits. The selection is the substantive investment (§3D): 7,599 refusals under 8 reasons, a 13-era ladder, a 32-code schema, 11 contamination signatures. In jurisdictions recognising a *sui generis* database right — the EU and UK notably — that investment is precisely what the right protects, and it exists independently of whether the underlying facts are protected. Cost: **the right is not recognised everywhere**, conspicuously not in the United States, where the *Feist* rule denies protection to a compilation lacking original selection or arrangement — an argument we would win on the facts, but would have to make. Asserting it invites the question "under what law?", which needs a lawyer's answer before it is published, not after. It also does nothing about Stratum A on its own and must be paired with 2A or 2B. |
| ☐ **2D** | **Withhold the data.** Ship the app; do not publish the payload as a reusable dataset. | Removes the problem by removing the artefact. Cost: contradicts the project's stated reason for existing — "nobody in this community publishes machine-readable data, so every tool re-transcribes the same wiki pages and inherits the same 1999 errors doing it." Listed for completeness; recommending against it is the one editorial position this document takes. |

### Decision 3 — what is offered to `eqlsource`

| | Option | Trade-off |
|---|---|---|
| ☐ **3A** | **Mirror EQL Source's own terms back at it** — attribution, read-the-provenance, measured data freely usable, wiki-sourced values explicitly not ours to license. | One posture across both tools of one site, in the site's own words (§3C). An auditor comparing the two finds them consistent. Cost: it does not make the dependency "licensed" in a scanner's sense; it makes it *consistently and deliberately* provenance-bound. If the audit demands an SPDX identifier, this does not supply one. |
| ☐ **3B** | **A named grant over the ours-only subset** — publish a reduced payload containing Stratum B and D alone (schema, selection, quarantine reasons, the 299 client-export IDs, the 13 Tier M records, the standing vocabularies) under a real licence, and leave the full catalogue under 2A/2B. | Gives `eqlsource` something with an SPDX identifier that an audit can accept. Cost: the reduced payload is not the planner's catalogue — a consumer wanting stats still faces the unlicensed question, so this clears the audit line without clearing the substance. |
| ☐ **3C** | **Internal-use grant.** Both projects are the owner's; state that `eqlsource` uses the payload as a first party, not a licensee. | Simplest, and arguably the accurate description of the relationship. Cost: it only holds while both projects share an owner, and an external auditor may not accept a self-declared first-party relationship as resolving a third-party rights question — which is what the eqlwiki layer actually is. |

---

## 8. If any option in Decision 2 is signed, these follow

Not decisions — consequences, listed so the cost is visible before signing rather than
discovered after.

1. **`verify.mjs` must gate whatever is asserted.** It already asserts
   `license.content === null` plus the date and the method, specifically so the withdrawn
   claim cannot be reinstated by accident. Any new assertion replaces that gate with an
   equally specific one, or the next session re-litigates this from scratch.
2. **The FSL notice obligation (§4(b)) is discharged in the same pass**, or not at all.
3. **`meta.provenance.repos[].license` becomes computed, not typed.** Four strings recording
   a legal fact, written once and never re-checked, are the same defect class as a stat typed
   where it could have been read. `refresh.mjs` already re-fetches and diffs the upstream
   datasets; re-checking four `LICENSE` paths at the pinned SHA is a small addition to it.
4. **The `ic` single-source dependency (§4(c)) is either accepted, sourced elsewhere, or
   dropped.** 3,631 records currently carry a field with exactly one upstream, and that
   upstream has a non-compete clause. It is worth knowing which of the three we chose.
5. **A `LICENSE` file appears at the repository root**, because that is where every scanner
   looks, and the prose that qualifies it appears in a `NOTICE` or `DATA-LICENSE` beside it
   rather than only in a README.

---

## 9. Signature

I have read §§1–6, and record my decisions:

| Decision | Option | Initial | Date |
|---|---|---|---|
| 1 — the code | ☐ 1A ☐ 1B ☐ 1C | | |
| 2 — the data | ☐ 2A ☐ 2B ☐ 2C ☐ 2D | | |
| 3 — `eqlsource` | ☐ 3A ☐ 3B ☐ 3C | | |
| — | ☐ Reject; leave as §1 describes | | |

Signed: ......................................................  Date: ....................

*On signature this document moves to `HANDOFF.md` → Standing as an applied ruling, and the
work in §8 is queued. Until then nothing in this repository changes: this proposal touches
no code, no test and no existing file.*
