# A licence for 50 Upgrades — three questions for the owner

**Status:** unsigned, and therefore unresolved. Nothing here is in force.
**Action required:** initial one option in each of the three questions in §3. That resolves it.
**Prepared** 2026-08-18, **rewritten and re-measured** 2026-08-22 against `web/public/data/meta.json`.

> **This is not legal advice and I am not a lawyer.** What follows is an inventory of what this
> project holds and where each part came from, assembled by measurement, plus the options that
> inventory permits. Which option is *lawful* in your jurisdiction, and which is *wise*, are
> questions for a person qualified to answer them. Stated once, not repeated.

---

## 1. Read this before answering — the whole situation in three buckets

Everything this project ships is in exactly one of these. They have different owners, and the
questions in §3 exist because each bucket needs a different answer.

| Bucket | What is in it | Ours to licence? |
|---|---|---|
| **OURS** | The code, the payload schema, the selection (which 3,663 of 11,252 scraped records ship, and the 7,599 refusals under 8 named reason codes), the standing vocabularies, the contamination signatures, the prose | **Yes, entirely.** Written here. |
| **WIKI-DERIVED** | The item facts and stat blocks scraped from eqlwiki: 2,171 of 3,663 shipped records print a wiki-sourced stat block (2,045 `tier-2` + 126 `tier-5`) | **No. Not at any price.** See §2. |
| **CLIENT-MINED** | The owner's first-hand observation of the running game: 297 name→ID pairs from a live `/outputfile inventory`, 197 records shipping on that export, 5 stat blocks read off a client window, 10 existence-only records | **Yes.** First-hand observation by the owner. |

Two facts that constrain every answer below:

- **There is no `LICENSE` file in this repository, on any branch.** `git ls-files` matches zero
  files named `LICENSE`, `COPYING` or `NOTICE`, and `git log --all` over those paths is empty.
  Absence is not neutrality: the default rule is *all rights reserved*, so the code — which is
  unambiguously ours to give — is currently more restricted than the data.
- **The Director reports that an external audit flags `eqlsource`'s vendored snapshot of our
  payload as an unlicensed dependency.** That finding is accurate. We publish a payload, another
  project consumes it, and we have told it nothing. The absence now costs somebody else, not
  only us. *(Nothing else about that repository is asserted here.)*

---

## 2. What the upstream silence means — the fact that shapes the wiki-derived bucket

`meta.license.content` is **`null`**, `contentSource` is **eqlwiki.com**, `checked` **2026-08-18**;
the recorded note gives the method — siteinfo `rightsinfo` empty url and empty text,
`/wiki/Project:Copyrights` 404, API normalising to `EQLWiki:Copyrights` and reporting it missing.
**The source states no terms at all.** Silence is not permission and it is not prohibition. Three
things follow, and they are why the wiki-derived bucket is not a question in §3:

1. **We cannot pass on what we were never given.** Asserting any licence over that material —
   including a permissive one, including CC0 — would manufacture a grant, which is exactly the
   fault corrected on 2026-08-18 when the assumed CC BY-SA 4.0 claim was withdrawn.
2. **It does not block us from publishing what is ours.** Silence upstream says nothing about
   our code, our selection, or the owner's own observations of the game.
3. **The useful move is precise notice, not a grant.** A downstream consumer has to make their
   own assessment; the most valuable thing we can hand them is exactly which fields are affected,
   which the payload already encodes per record in `sd` and `ex`.

---

## 3. The three questions

Initial one option in each. Each option says what actually happens if you pick it.

### Question 1 — What licence goes on the code?

**Deciding:** the terms offered for this repository's own programs, tests and prose — 84
non-test source files totalling 31,586 lines under `web/src`, plus 6,453 lines of pipeline.
**Not** the item data; that is Questions 2 and 3.

| | Option | What follows |
|---|---|---|
| ☐ | **1A — Permissive** (MIT, or Apache-2.0) | A `LICENSE` file lands at the repository root, where scanners look. Anyone may reuse the planner's code, commercially included. The audit's "no licence" line stops applying to the code. **Cost:** someone can ship a competing planner from our source — which matters little, because the asset is the selection, not the React. Apache-2.0 additionally gives a `NOTICE` file, a natural home for the eqlwiki attribution and the Daybreak disclaimer. |
| ☐ | **1B — Copyleft** (AGPL-3.0) | Same file, same place, but anyone who *hosts* a modified fork must publish their changes. Fits a project whose thesis is that provenance should be visible. **Cost:** many consumers refuse AGPL on sight, and if `eqlsource` ever vendors our *code* rather than our payload, it inherits the obligation. |
| ☐ | **1C — Nothing; leave it** | Default rule stands: all rights reserved. Nobody may legally reuse the code, the audit finding is unchanged, and the code stays more restricted than the data it ships. This is the status quo, chosen deliberately rather than by omission. |

### Question 2 — Do we grant anything over the data that *is* ours?

**Deciding:** whether the OURS and CLIENT-MINED buckets — the selection and its 7,599 named
refusals, the schema, the standing vocabularies, the 297 client-export IDs, the 5 client-verified
stat blocks, the 10 existence-only records — are released to others. The wiki-derived bucket is
excluded from every option here; §2 settles why.

| | Option | What follows |
|---|---|---|
| ☐ | **2A — Yes, with attribution** (CC BY 4.0) | Downstream may reuse the selection, the schema and the client-mined observations, crediting this project. This is the layer with the real work in it, and it is the part that can carry an SPDX identifier an audit will accept. **Cost:** consumers must carry a credit line; the granted part must be distinguishable from the ungranted part, which is what Question 3 decides. |
| ☐ | **2B — Yes, no strings** (CC0) | The same material, released with no attribution requirement. Simplest thing for a consumer to comply with. **Cost:** gives up the credit this project asks of others and receives from `eqlsource`'s own published terms. |
| ☐ | **2C — No; grant nothing over any data** | Nothing changes for downstream: the whole payload stays unlicensed, not merely its wiki-derived half. Question 3 then has only one honest answer (3B or 3C), and the `eqlsource` finding stands in full rather than being reduced to the part we genuinely cannot fix. |

### Question 3 — How is "not ours to licence" communicated?

**Deciding:** not *whether* to licence the wiki-derived bucket — we cannot — but whether the
disclaimer is machine-readable or prose. The audit that raised this reads files, not paragraphs.

| | Option | What follows |
|---|---|---|
| ☐ | **3A — Make it machine-readable** | A `DATA-LICENCE.md` sits beside `LICENSE`, and `meta.json` gains a per-bucket licence block that `verify.mjs` gates, so every shipped field declares which of the three buckets it belongs to. A consumer — and `eqlsource`'s audit — can separate the granted part from the ungranted part automatically. **Cost:** real pipeline work, and `verify.mjs`'s current `license.content === null` gate must be replaced by an equally specific one, or the next session re-litigates this. |
| ☐ | **3B — Prose only** | A README and `NOTICE` paragraph explaining the split. Costs almost nothing to write. **Cost:** a scanner does not read it, so the audit finding is unchanged; the split exists only for a human who opens the right file. |
| ☐ | **3C — Withhold the payload** | Ship the app; publish no reusable dataset. Removes the finding by removing the artefact. **Cost:** contradicts the reason this project exists — that nobody in this community publishes machine-readable data, so every tool re-transcribes the same wiki pages and inherits the same 1999 errors doing it. Recorded as available; recommending against it is the one editorial position this document takes. |

---

## 4. Whatever is signed, these follow

Consequences, not decisions — listed so the cost is visible before signing.

1. **`verify.mjs` gates whatever is asserted.** It currently asserts `license.content === null`
   with its date and method, so the withdrawn claim cannot creep back. Any new assertion replaces
   that gate with an equally specific one.
2. **The `jmoyers` notice obligation is discharged in the same pass.** Its FSL-1.1 terms require a
   copy of or link to the licence wherever material is redistributed. We currently carry neither
   (§A3).
3. **`meta.provenance.repos[].license` becomes computed, not typed.** Four legal facts written
   once and never re-checked are the same defect class as a stat typed where it could be read;
   `refresh.mjs` can re-check four `LICENSE` paths at the pinned SHA.
4. **The `ic` single-source dependency is accepted, re-sourced, or dropped** (§A3).

---

## 5. Signature

| Question | Option | Initial | Date |
|---|---|---|---|
| 1 — the code | ☐ 1A ☐ 1B ☐ 1C | | |
| 2 — the data that is ours | ☐ 2A ☐ 2B ☐ 2C | | |
| 3 — the wiki-derived notice | ☐ 3A ☐ 3B ☐ 3C | | |

Signed: ......................................................  Date: ....................

*On signature this moves to `HANDOFF.md` → Standing as an applied ruling and §4 is queued. Until
then this document changes no code, no test and no existing file.*

---

# Appendix — the evidence

Not needed to answer §3. Every figure below was recomputed on 2026-08-22 by the command shown.

## A1. The buckets, measured

All of the following from
`node -e 'const m=require("./web/public/data/meta.json"); console.log(m.counts, m.provenance)'`:

- **3,663** shipped records. Stat provenance: `tier-2` **2,045**, `tier-5` **126**,
  `tier-M` **5**, `unattributed` **1,487**. Wiki-sourced stat blocks are the first two: **2,171**.
- **Purge:** 11,252 scraped → 7,599 quarantined under **8** reason codes (largest: Velious 2,828;
  no era in any source 2,230; Kunark 1,438) → 3,653 shipped, plus **10** admitted outside the
  scrape on Tier M evidence = 3,663, under **10** ship-reason codes.
- **Existence evidence:** `measured-drop` 277, `live-export` 197, `eqlsource-id` 95.
- **Client-mined IDs:** `meta.provenance.itemIds` — 297 observed in the owner's export
  (`research/validation/tier0-inventory-Avenrae.txt`, 2026-08-16), 257 in EQL Source's published
  table, **299** applied to catalogue records. *No wiki scrape carries a numeric game item ID.*
- **Code:** non-test `.ts`/`.tsx`/`.css` under `web/src` → 84 files, 31,586 lines;
  `wc -l pipeline/*.mjs` → 6,453.

Anyone can re-scrape eqlwiki in an afternoon and get 11,252 rows; knowing which 3,663 are in
*this* game, and naming a reason for all 7,599 refusals, is the work. The facts selected are not
ours. The selecting is.

## A2. Why the wiki-derived bucket is closed

`meta.license` records `content: null`, `contentSource: "EverQuest Legends Wiki (eqlwiki.com)"`,
`checked: "2026-08-18"`, and a note giving three independent checks (siteinfo `rightsinfo` empty;
`/wiki/Project:Copyrights` 404; API normalises to `EQLWiki:Copyrights`, missing). The prior CC
BY-SA 4.0 claim was assumed rather than checked, and was withdrawn; that is not reopened here.
Those network checks were run on 2026-08-18 — what is re-read today is the result in `meta.json`.

## A3. The four upstream repositories

`meta.provenance.repos`, four entries, feeding five input files (`meta.provenance.inputs`:
`jmoyers`, `eqlwiki`, `nathanbates`, `eqbuddy`, `focusEffects`):

| Repo | Role | Recorded licence |
|---|---|---|
| `Thiole/EQLGearPlanner` @`0213a63` | PRIMARY: stats, slots, classes, races, era, acquisition | *no license file; upstream content from eqlwiki, which states no licence* |
| `nathan-bates/eql` @`3caccd0` | gap-fill: endurance, required level, focus effects | *no license file; upstream content from eqlwiki, which states no licence* |
| `jmoyers/everquest-companion` @`d25455e` | enrichment: iconId, typed effects, statsBlock, name coverage | *FSL-1.1 (code); data derived from eqlwiki* |
| `DranakCorps-bot/EQBuddy` @`03c624c` | gap-fill: quests, recipes, drop zones | *MIT* |

**The silence is two layers deep:** the two largest inputs grant nothing, nor does their upstream.

**The `jmoyers` exposure is one field.** Every merged field draws from a ranked list of four or
five candidate sources — except one, which has a single candidate:
`const [ic] = pick('ic', [['jmoyers', () => int(j?.iconId)]]);` at `pipeline/build.mjs:1468`.
**3,631 of 3,663 shipped records carry an icon id** that exists only because of that input
(`items-index.json`, count of records with `ic`). Its FSL-1.1 terms carry a non-compete clause on
commercial use and a redistribution-notice obligation, which we do not currently satisfy. Bounded
and fixable, which is why it is named precisely: one field, not the catalogue.

*The earlier draft also cited scrape-intersection figures (3,650 / 13 / 46). Those were not
recomputed in this rewrite, so they are not restated here.*

## A4. The precedent already published by the consumer

The four vendored EQL Source datasets under `pipeline/sources/eqlsource/` each carry an identical
`terms` block (`node -e 'console.log(require("./pipeline/sources/eqlsource/items.v1.json").terms)'`):

> *"The measured data … is parsed from this project's own combat logs. Freely usable with
> attribution."* / *"Fields sourced from community wikis carry their tier and source. **Those
> values are not ours to license**; respect the original source and do not present a tier 5
> figure as fact."*

That is the same split-by-provenance posture Questions 2 and 3 offer. Adopting it is consistency
across two tools of one site, not an invention.
