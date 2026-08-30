# Handoff — Session B (50 Upgrades) ⇄ Director

Session B works this repository. Session A works `eql-source` (the website). The two
sessions cannot see each other; everything that crosses between the repos comes through
the Director, and **nothing in this file may assert anything about `eql-source` that the
Director did not say.** The live site at `eqlsource.com` is public and may be observed —
observing what it serves is not the same as knowing what is in its repository, and this
file keeps those apart.

**The exchange is transient; decisions graduate.** When a ruling is applied it moves into
*Standing* and is deleted from the exchange, so what is left below is only ever live.

---

## Standing

Applied rulings and durable rules. These are settled — do not reopen them, and do not
"finish" anything recorded here as deliberate.

### Working rules

- **Cross-repo architecture decisions go to the Director first.** Two sessions that cannot
  see each other will otherwise solve the same problem twice, differently.
- **Everything known about `eql-source` comes through the Director.** Never assert
  something about that repository that was not stated here.
- **One push at a time.** `deploy.yml` sets `concurrency: {group: pages,
  cancel-in-progress: true}`, so a second push inside the build window cancels the first;
  if that second push fails `tsc` or `vitest`, neither deploys and the live site is older
  than both. No second push until the etag moves.
- **Verify against the live deploy, not the suite.** Pages serves HTML with
  `max-age=600` and the edge ignores cache-busters — poll the etag before asserting
  anything. Every verification `curl` reads `%{http_code}`: the SPA fallback returns the
  full landing page with HTTP 404 for any missing path, so `curl | grep` will happily
  match against a 404 body.
- **Grep the bundle, not the shell.** User-visible strings live in `assets/index-*.js`;
  `index.html` is scaffolding. Any check that greps the shell for content is unsound.
- **Fan out reading, never writing.** If outputs must agree with each other, one session
  writes them all. Never fan out anything that regenerates `web/public/data` — one writer,
  one pipeline run, then `git diff --stat web/public/data` before committing.
- **Before any push that touches rendering:** `VITE_BASE=/EQL50ups/ npm run build && npx
  vite preview`, browse the sub-path, watch for zero `pageerror`.
- **Report with evidence, not conclusions** — path, line, quoted text — and give the
  command that produced every number.

### Design decisions

- **The display ceilings sit below the site's, permanently.** `--fs-title` stops at 56px
  and `--fs-hero` at 84px against the site's 90px and 104px. The site's hero type is doing
  brand work; this tool's is doing wayfinding inside a working surface, and matching them
  would make the planner shout where a reader has come to concentrate. A tool frame a step
  below the site's display scale is correct rather than incomplete. Recorded at the tokens
  themselves so no future session "completes" it. *(Director, 2026-08-18.)*
- **The four −0.5px reading rungs stay as they are.** `--fs-small`, `--fs-body`,
  `--fs-mid` are half a pixel under the site's ladder. Half a pixel is below what a reader
  perceives, and moving four tokens reflows every screen for no perceptible gain.
  *(Director, 2026-08-18.)*
- **`--fs-heading` stays at 17px until a layout change pays for it.** Closing it to the
  site's 18.5px pushes the paper doll's `-webkit-line-clamp` onto a vertically cut line at
  1100px. The measurement is recorded at the token so nobody retries it blind. A ruling
  that breaks the paper doll is a wrong ruling. *(Director, 2026-08-18: revert accepted.)*

### Type scale and wayfinding

- **`--fs-mark` is the wordmark's rung, at the site's 18.5px; item names stay at 17px.**
  One token sizing both was a second source of truth in CSS form, and its two consumers
  are width-critical in opposite directions — which is why closing the shared rung cut the
  paper doll. Splitting it closes the mark to the site's size and moves `SURVEY` 11.59px
  right (measured at 1440, not the 13px first reported), with the doll's clip probe still
  passing. 18.5px is listed in `TYPE_SCALE_FIXED`, so it is a step rather than an
  exception. *(Director, 2026-08-18: approved post-drop; applied.)*
- **The breadcrumb carries the current screen**, three segments on the landing and four
  below it, and the tool's name becomes a link once it is no longer where you are.
  `screenName` has no `default` case, so a route added to `Route` fails `tsc` rather than
  arriving one level short. *(Director, 2026-08-18: approved post-drop; applied.)*

### Theme

- **The planner stays dark. eqlsource's light/dark theme is not being followed.** Mine to
  call; called 2026-08-20 and **re-examined the same day** against the prover Session A
  built. Unchanged, with one reason withdrawn rather than quietly kept.
  - *Retired:* "a theme I cannot prove is AA in both modes publishes a contrast failure
    quietly." The prover exists now. Checked our own AA walk against its four lessons —
    alpha compositing and zero-examined were already done (the second reached
    independently), the `background-image` lesson does not arise here (0 gradient or image
    declarations across 13 stylesheets, measured), and only "set the ground before the
    document exists" was a real gap, and only in a world where we theme.
  - *What carries it:* eqlsource keeps its own imported tools dark and says so, making
    dark the site's convention for a tool rather than an exception — following would make
    the planner the odd one out *among tools*. And it is a working surface kept open beside
    a fullscreen client, usually at night, which is about use rather than branding.
  - *Cost, unchanged:* 49 of 95 custom properties are colours; **20.0s** of contrast
    walking across two checks, all of it doubling; 3 test files assert literal colours; the
    focus-ring checks read drawn pixels and need both grounds.
  - The extraction is already complete — 0 colour literals in any declaration — so the
    door costs nothing to leave open and nobody should prepare for it. Recorded at
    `tokens.css` so no future session "completes" it.
- **The theme landing changes the drift check, not the rendering.** Nothing here loads
  `site.css`; the chrome is our own CSS and self-hosted fonts. When
  `site-foot-drift.test.ts` goes red on the merge, that is the check working: wait, re-copy
  once, re-pin. Do not disable it and do not pre-copy. *(Director, 2026-08-20.)*

### Auditing checks

- **`tools/check-audit/` is the method, and it is portable.** Damage the subject, run the
  check alone, restore, count what was examined; zero examined exits non-zero. Generic
  operators cannot reach a string constant, so a generic survivor is `UNPROVEN` and needs a
  written damage before anyone calls it `DEAD`. Restoration is by in-memory content and a
  hash comparison, never `git checkout` — an audit runs in a dirty tree by definition.
  `README.md` also carries the five shapes of *vacuous pass*, which mutation cannot find at
  all. *(Director, 2026-08-20: write it up so another repository can run it.)*

### The catalogue's own provenance

- **`pipeline/catalogue-audit.mjs` verifies that the sourcing standard is actually
  applied**, and is a check rather than a report: a figure whose source cannot be named
  fails it. In CI beside the payload gate. Of 2,176 records printing numbers, 0 carry no
  standing. Rule 6 was being broken — four of five inputs were undated — and the date is
  now derived from git rather than typed, because a hand-written date is the first thing
  to go stale. *(Director, 2026-08-20: nobody had run this audit on either side.)*
- **The two limits are printed beside the green tick, deliberately.** A vendoring date is
  not a currency date; and 84.5% of records carry no Tier M existence evidence, shipping
  on a wiki's era placement. Both are rule 2 working as written, and both belong on screen
  rather than in a drawer.

### Auditing another repository

- **A verdict about a command that runs no code is not a finding.** `gate.py` has no
  `__main__`; `python3 scripts/gate.py` is silent and exits 0. It survived every damage and
  was reported UNPROVEN — a verdict that meant nothing, and was published. Every check now
  carries a `probe` that damages the checker's own source and requires red; a check that
  stays green while its implementation is broken reports `NOT_EXERCISED` and produces no
  other verdict. *(2026-08-21.)*
- **A checker with severities hides half its assertions from an exit code.** `check.py`
  prints `WARN` and exits 0. `failure_signal: "output"` makes the message the signal.
  *(2026-08-21.)*
- **Damages do not travel; the runner does.** Four wrong verdicts came from the damage, not
  the tool: a superstring replacement, a first-occurrence replacement, a damage that broke
  the build, and a damage judged on the wrong channel. Budget for the damages.

### The row says where its number came from

- **The Upgrades row carries the stat standing, not only the existence mark.** It named
  the sighting count and said nothing about where the EP came from — two independent facts,
  one of them missing, on the screen whose whole output is that number. Rule 5. Band and
  wording come from the shared `sourceStanding`; tier-5 tints, tier-2 does not, because
  2,045 of 2,176 records that print numbers are tier-2 and a colour every row shares is a
  wash. *(2026-08-22, found while designing the band image.)*

### Environment

- **A test that fetches must opt out of `jsdom`, or it is not fetching.** jsdom supplies
  its own `fetch` and it ignores this container's proxy; the call returns HTTP 403, which a
  reachability check cannot tell apart from the site being down. Both drift checks were
  skipping on that and reporting passes. The two files carry
  `// @vitest-environment node` and `vitest.config.ts` names the variable Node's `fetch`
  needs before it will honour a proxy. Anything new that reaches the network needs the same
  pragma. *(2026-08-18.)*
- **No headless browser in this toolchain reaches an external host; only `curl` does.**
  Three sessions hit this independently. Geometry and type are checkable against a local
  build; the network hop is not; a local mirror of the far side is the accepted substitute,
  and the substitution is stated when reporting. Recorded once, in `CLAUDE.md` §5, so the
  next session does not rediscover it. *(Director, 2026-08-18.)*

### Design decisions — the map

- **The equipment map reproduces the game's Equipment tab, cell for cell.** Six columns,
  four rows, 23 positions, row 1 indented by one, the three doubled slots mirrored to the
  outside. It was a 5x7 anatomical silhouette with a decorative SVG body behind it —
  invented, not observed. The silhouette is removed rather than adapted: the panel's job is
  to be recognised by someone who has just alt-tabbed out of the client. Recorded as
  capture 8 in `research/validation/TIER0-VALIDATION.md`. *(Director, 2026-08-18.)*

### Payload contract

- **`slots.positions.total` is the field a reader-facing slot count comes from.** It is 23.
  `slots.worn` is a list of 18 slot *types* and answers a different question; 18 + 2 = 20 is
  the arithmetic presumption gives, because three types are worn twice. Published
  2026-08-18 with `worn`, `any`, `types`, `doubled` and a note, so the number never has to
  be derived again. `verify.mjs` asserts the arithmetic closes and a vitest asserts the
  payload agrees with the app's own `TOTAL_POSITIONS`. *(Director, 2026-08-18.)*

- **`slots.types` holds the 18 type codes.** The key was `worn` while a character wears 21
  — the field name described a different quantity from its contents. `positions.worn` is
  the 21. **BREAKING for anyone reading `slots.worn`.** *(Director, 2026-08-18.)*

### The site's tool index

- **The footer copies the site's tool column, and a test holds it there.**
  `SITE_TOOLS` is the `Tools` column of the footer `eqlsource.com/tools/` serves, in its
  order, and `site-foot-drift.test.ts` checks the copy against the original the same way
  `site-nav-drift.test.ts` checks the masthead. Three withdrawn URLs are pinned by name
  because they 301 rather than 404, so nothing else here would notice one typed back in.
  *(Director, 2026-08-18: item 1, applied.)*
  **Six tools until 2026-08-30, seven since** — the site published `Lockouts`, the check went
  red, and the copy was refreshed once after confirming `/tools/lockouts` is a real 200 rather
  than an announcement. The procedure when it goes red: verify the change is live with `curl`
  reading `%{http_code}`, then re-copy and re-pin **all five** counts together — `SITE_TOOLS`,
  the drift check's `EXPECTED`, and the three offline pins (`CHROME_LINKS.length`, distinct
  destinations, column length). A sixth number, the rendered-anchor count in `CHROME_LINKS`'s
  comment, is asserted by nothing and must be **re-measured in a built preview**, never
  incremented.
- **This tool lists itself, marked `aria-current="true"`.** `/tools/50-upgrades` is a real
  200 and a different document from the planner — the site's page *about* it — so the link
  goes somewhere the reader is not. `"true"` and not `"page"`: the current item of a set,
  not a claim that the href's target is the document being read.
- **The prose references went with the links.** A withdrawn page named in a comment or an
  eyebrow is invisible to every link checker there is. The exception is the dated citation
  in `planarSets.ts`, which keeps its URL on purpose: a read of a page that existed on the
  date given is the record, and deleting it would leave the eighteen set names looking
  unsourced.

### Sourcing

- **No content licence is asserted.** `eqlwiki` publishes none — checked 2026-08-18;
  `siteinfo` `rightsinfo` empty, `Project:Copyrights` absent. Credit and the trademark
  disclaimer stay; the terms go, and their absence is stated rather than left blank.
  `verify.mjs` asserts `license.content === null` plus the date and method, so the
  correction cannot be reinstated by accident.
- The full standard lives in `research/SOURCING-STANDARD.md` and governs every number the
  planner puts on screen.

---

## From the Director

### Live — orders of 18 Aug

1. **The footer.** Copy once from the final six-tool state and add the drift check in the
   same commit. *Applied; graduated to Standing.*
2. **Split `--fs-heading`,** so the wordmark and item names stop sharing a size, and make
   the breadcrumb carry the current screen. Serial if the files are not disjoint.
   *Applied; not disjoint, so done serially by one. Graduated to Standing.*
3. **Deploy discipline.** Pushes serialize; never assert done until the live etag moves;
   grep the served bundle, not the shell. *In force; recorded in Standing → Working rules.*
4. **Licence: proposal only, adopt nothing.** *Applied — `research/LICENSING-PROPOSAL.md`,
   unsigned, no `LICENSE` file, no existing file changed.*

**Parked, not started:** `upgrades.eqlsource.com` and the `VITE_BASE` change it implies;
the `=50Upgrades` mark. A slot is left for the mark and nothing has been drawn.

## To the Director

## 30 Aug — D's message found a real defect in my capture request. Please relay.

D reached me; I cannot reply (cloud outbound is closed at both ends). Two things below: what
their method cost me, and what I owe them back.

### D's standard caught something I shipped four days ago

Their line — *"it ships the evidence rather than the conclusions, because four of those
findings inverted at least once and a careful reader re-derives the wrong answer from first
principles"* — sent me back to `CAPTURE-REQUESTS.md` §1, the instruction the owner is meant
to execute this week.

**It told the owner to go and farm three items that nobody has confirmed exist.** I named
`Idol of the Underking` (The Hole), `Emissary Mask` (Najena) and `Zaharn's Coronet`
(Permafrost) as the donors for the Improved Healing family. Checked properly this time:

```
Idol of the Underking   sd=tier-2  id=-  (no client-export id)
Emissary Mask           sd=tier-2  id=-  (no client-export id)
Zaharn's Coronet        sd=tier-2  id=-  ex=(none) — no existence evidence at all
```

All three are wiki records. A trip that came back empty would have proved nothing about
stacking and would have arrived looking like outcome E — the exact confusion the section was
written to prevent. I shipped a conclusion ("get these three") where the evidence ("these are
tier-2 claims, unconfirmed") was the thing that mattered.

### The fix, and it is much better than a correction

Ranked all 37 multi-rank families by how much hard evidence sits behind their donors. **The
owner needs to farm nothing** — their own export already holds a same-family pair, and one
half is already socketed:

| | Effect | Donor | Where | Existence | Effect name |
|---|---|---|---|---|---|
| higher | `Burning Affliction III` | Bone-Clasped Girdle +4 (11666) | **worn on the Waist, already in its own Focus socket** — export 110-111 | **Tier M** | **Tier M** (`sd: tier-M`) |
| lower | `Burning Affliction II` | Serpentine Bracer +2 (10148) | Bank11-Slot7, already under `Augmentation` — export 662, 838 | **Tier M** | Tier 2 — wiki's word |

Both `k: focus`, which is the kind the sourced rule is actually about. The provenance is now
split into two columns precisely because they differ: the *items* are certain, the *effect the
Bracer carries* is not, and if its window says something else that is a catalogue correction
rather than a failed capture.

Three further changes, all from the same reading:

- **A trap named and closed.** `Black Tome with Silver Runes` (13400) also carries `Burning
  Affliction II` and the owner holds it — but it is ENC/MAG/NEC/WIZ only, so on our own
  reading of the socketing rules it narrows its host out of the trio. A capture failing for
  *that* reason is indistinguishable from one failing because the effects do not stack. The
  section now says do not substitute it, and why.
- **The reading changed to `Spell Damage`**, and the honest caveat is stated: whether a damage
  focus surfaces on that field is itself unverified. That is what the control reading is for,
  and it is why the control comes first rather than last.
- **Improved Healing is demoted to the fallback**, kept because a heal focus against a heal
  field is better matched — but flagged with the tier-2 problem in the open.

The outcome table's field names were updated with it. I had left them saying `Heal Amount`
after changing the steps, which would have made the instruction contradict itself — the same
drift I caught in the `settle:` string last week, caught this time by re-reading rather than
by luck.

### What I owe D back — two things, please pass them on

1. **The C-vs-E distinction, which is the same discipline as their control line.** A reading
   that closes a route ("this field cannot show us this") is a finding about the game. A
   capture that did not happen is nothing. Both arrive as *"nothing moved"*, and filing the
   second as the first puts a fact in the record that never existed. If `FOR-SESSION-C.md`
   separates those, C inherits it; if it does not, it is one table row.
2. **`tools/check-audit/` is portable and it is theirs if they want it.** Python 3.9+,
   stdlib only, config-driven JSON, restores by SHA-256 rather than `git checkout`. It ran
   unchanged against a second repository — 42 checks, 40 ALIVE, 1 DEAD, 1 MASKED. The verdict
   that matters for their kind of work is **NOT_EXERCISED**: a check that cannot fail at all,
   which reads as passing. Their *"14 locks across 6,133 seconds showed one value with zero
   spread"* is the same instinct — prove the experiment touched the subject — and their
   *"four of these inverted at least once"* is the reason the runner damages the source and
   watches for a kill rather than trusting a green run.

One flag for you, not for D: their message qualifies something you told me on 25 Aug. You had
it as a **six-day rolling** lockout; D now has B−R at exactly 5d23h with six days
**conditional** on the replay period being one hour. Nothing in my queue depends on it. I am
noting it only because the six-day figure is the sort of number that travels between sessions
faster than its condition does.

### The footer drift check went red, and this time it was not the theme

Not caused by my edits — it reaches the live site. `eqlsource.com` published a **seventh
tool**, `Lockouts` at `/tools/lockouts`, between `50 Upgrades` and `Race unlock tracker`.
That is D's tracker, reaching the site's index ahead of C's 1 September integration.

Your 20 Aug rule is *"do not pre-copy; wait for the merge, re-copy once, re-pin."* I checked
whether this was a merge or an anticipation before touching anything, against the live deploy
rather than the suite:

```
https://eqlsource.com/tools/lockouts        200  final=https://eqlsource.com/tools/lockouts
https://eqlsource.com/tools/50-upgrades     200  final=https://eqlsource.com/tools/50-upgrades
https://eqlsource.com/tools/race-unlocks    200  final=https://eqlsource.com/tools/race-unlocks
```

Real 200, no redirect. So the merge has happened and copying it is mirroring published state,
not anticipating one. **Re-copied once and re-pinned**, in the site's own position.

**It moved five numbers, and the fifth is the one worth reporting.** `SITE_TOOLS` and the
drift check's `EXPECTED` are the obvious two. Three more were pinned offline against exactly
this: `CHROME_LINKS.length` 39 → **40**, distinct destinations 32 → **33**, and tools in the
column 6 → **7**. The first two I computed rather than typed.

The fifth is a count in prose that no test asserts — *"40 matching anchors in the built
page"*. Its own comment names the method, so I ran it instead of adding one:

```
VITE_BASE=/EQL50ups/ preview, document.querySelectorAll('a[href^="https://eqlsource.com"]')
  1440px : anchors=41  distinct=33
   390px : anchors=41  distinct=33
```

**41, and I would have written 41 by inference anyway** — which is precisely why measuring it
mattered. Adding one to a number is how a count stops being a measurement, and the next drift
will not necessarily be a clean single addition. The comment now says it was re-measured and
at what widths.

Nothing here was a judgement call I made on your behalf: the site published it, the page is
live, and the rule said re-copy once after the merge. If you would rather the footer wait for
C's 1 September integration before it lists Lockouts, say so and I will revert the copy —
but the check will stay red until one of the two happens, which is the check working.

**A messaged me mid-run and independently confirmed it** — *"the lockout tracker is live as
the seventh tool… 50 Upgrades is unchanged and still first of the four bands."* That is the
same fact from the other side of the fence, arrived at without either of us being able to ask
the other. Reassuring rather than load-bearing: I had already verified it with `curl`.

### A named a coupling between us that I cannot see, and it is the stale-number problem again

Their words: *"the band and the tool page interpolate every figure from
`assets/50-upgrades.json` by field path, so a renamed field breaks the build rather than
printing a wrong number."* They asked to be told if the snapshot changes shape.

Two things I checked before answering, and the answer is not what they may assume:

1. **This repository does not produce that file.** `git ls-files | grep 50-upgrades.json`
   returns nothing, and no generator under `pipeline/` or `web/src` mentions it. Whatever
   feeds their band, it is not something I emit.
2. **The path is a 404 publicly** — `curl -o /dev/null -w '%{http_code}' -L
   https://eqlsource.com/assets/50-upgrades.json` returns **404**, while
   `/tools/50-upgrades` returns **200**. If it is a build-time asset in their tree rather
   than a served one, that is expected; I note it only because it means **I cannot read the
   field paths they depend on**, so I cannot warn them about a break I cannot see.

**So the guarantee A believes they have is weaker than they think.** "A renamed field breaks
the build" holds only if the file is generated from my payload. If it is transcribed — and
from here it looks transcribed, because nothing on my side writes it — then a figure that
goes stale does not break anything. It just prints an old number on the site's landing band,
under my tool's name, where no check of mine or theirs can see it. That is precisely the
fault my band-image recipe refuses to ship a PNG over, one layer further out.

**The offer, for you to relay or decline.** I can emit that snapshot from `build.mjs` as a
published artefact with pinned field names, so A interpolates from a generated file instead of
a copied one, and `verify.mjs` gates its shape the way it gates the rest of the payload. It is
a contract between two repositories, which makes it yours rather than mine to agree — and it
is exactly the kind of two-sessions-in-one-surface coupling you have been keeping us out of.
I have written nothing.

Also from A, noted and not acted on: PR #149 *"corrects a figure in `gate.py` from four to
six"* — that is the file I audited; the correction is theirs and my proposal does not touch
that line.

## 26 Aug, second report — the rank parser is fixed, the rule is marked, the capture is written

Orders 1-3 are done and pushed. Order 4 is judgement, and it is at the end.

### Order 1 — the rank parser, fixed and proven to be exercised

`parseEffectRank` read a trailing Roman numeral and nothing else, so `Wind Resonance 11`
became a family of its own at rank 1. You are right that this is wrong under either stacking
rule: it is a reading of the client's own notation, not a claim about the game, and the
client prints both notations four lines apart in the one capture we have.

**The fix, and a regression I caught in it.** My first version read any trailing integer as a
rank. Measured against the shipped payload before committing to it — `node` over
`web/public/data/items/*.json`, 401 distinct effect names — it changed 15 parses. Fourteen
were the bard resonances and correct. The fifteenth was **`Allure of Death req. level 20`**,
which became family *"Allure of Death req. level"* at rank 20. A second name shape,
`Complete Healing as Level 20` (14 of them), has the same problem.

One rule covers both rather than two special cases: **the word `level` before the number
means the number is a level.** A cast level and a requirement level are not rungs of a
ladder, and reading them as ranks would have asserted that two clickies of one spell
supersede each other — which is not even what the stacking rule is about.

```
Improved Healing I / II / III                    -> 1 survivor   (unchanged)
Wind Resonance 0 / 10 / 11 / 12 / 14             -> 1 survivor   (was 5)
Complete Healing as Level 20 / as Level 30       -> 2 survivors  (not ranks)
```

**A third defect, same class, found while fixing the first.** Two sockets holding the *same*
effect reach the family collapse as one family at one rank, so one is struck out — and the
tab resolved the winner's name back out of the family and printed **"Complete Healing as
Level 20 does not count — Complete Healing as Level 20 is the higher rank in the same
family"**. A row named as its own superior. The selector now carries a `supersededAs`
discriminator and the tab says *"… is socketed twice"* instead. Equal rank inside a family
can only be the identical string — the family is the stem and the rank is the suffix — so the
discriminator is exact rather than heuristic.

**Proven exercised, not merely written.** `parseEffectRank` and `dedupeByFamily` had **no
direct tests at all**; the only coverage drove them through gear sets built from Roman
fixtures, so the half the client also prints was never touched. 15 new tests — 10 on the
parser, 2 in the selector suite, 3 mounting the tab — and 910 → 925 in the run. Each fix was
A/B'd by restoring the pre-fix source, running, and restoring by SHA-256 — never
`git checkout`:

```
pre-fix parser restored          -> 2 failed / 8 passed   (both arabic cases)
supersededAs collapsed to 'rank' -> 1 failed / 16 passed  (the duplicate case)
chip removed from the tab        -> 2 failed
duplicate wording reverted       -> 1 failed
restore verified by hash         -> true, all four
```

Worth saying plainly: only 2 of the 10 engine tests fail against the old parser. The other 8
guard behaviour that did not change. A count of tests is not a measure of reach, which is the
same thing I told you about `gate_selftest`.

### Order 2 — downgraded, not deleted, and the planner now says so

`EXALTATION_STACKING` in `web/src/engine/exaltation.ts`, built the way `HASTE_STACKING` is
built next door — chip, rule, standing, and the capture that would end it. The doc comment
above it states all three problems with the provenance: one community author's reading of a
wiki the standard calls a partial P99 import; uncorroborated, since the second tool covering
the same ground does not restate it; and identical to classic EverQuest's focus rule, which
is corroboration by inheritance. It also names the file's own **"Use jmoyers. Do not use
Thiole's math."**

**On screen.** The struck-out lines were a bare `hint` paragraph. They are now a block headed
**Not counted**, carrying the `.tier t5` chip — the same device as the haste figure on the
stat panel and the standing labels in the item window — whose hover carries the standing and
the capture request. One sentence of plain English sits under it. Both struck-row sentences
now end *"on this rule a family only counts once"* rather than stating it flatly.

**Nothing rendered that block before.** No test, unit or browser, had ever painted a
superseded row, so the sentence a player actually reads was unexamined. `exaltations-tab.test.tsx`
mounts the tab and pins the chip, its title, the duplicate wording, and that no chip appears
when nothing is struck out.

I also recorded, in the same comment, what is applied **beyond** what is even claimed: the
sourced sentence is about *focus* effects, and the selector pools all four socket kinds into
one family check, so a worn effect and a focus effect of one family compete. No source says
they do. It is not separately marked because it cannot be separately settled — the same
capture answers both, and §1 says so.

### Order 3 — `research/validation/CAPTURE-REQUESTS.md`

One request, written to be executed without interpretation, naming the three real donor items
that carry the family (`Idol of the Underking` at rank III; `Emissary Mask` and `Zaharn's
Coronet` at rank I) and the exact reading: **`Heal Amount`, under Spell Mods, on the Stats
window** — baseline, one socketed, both socketed.

**I picked that reading because it is a window we have documented at Tier M**
(`UI-REFERENCE.md` §B3). I have never seen a character-side "active focus effects" list in
this client and did not want to write an instruction that presumes one exists.

Five outcomes, separated on purpose:

| | What it means |
|---|---|
| **A** Heal Amount moves again on the third reading | They stack. **Our rule is wrong** and `dedupeByFamily` comes out of the effects path. |
| **B** Moves on the second reading, not the third | They do not stack. The rule becomes Tier M and the chip comes off. |
| **C** Does not move even with **one** socketed | Not an answer and **not a failed capture** — this field does not surface focus effects, so no number of screenshots of it will ever settle this. Close the route, keep the mark, design another. |
| **D** The game refuses the second socket | A different question answered. **There is not one refused socketing on record anywhere in this repository**, and `canSocket` has the same Tier 5 provenance. First observation of that rule. |
| **E** Could not get the items or the window | Nothing learned, nothing recorded. |

**C and E are why the section is written out at all.** Both arrive as "nothing moved", and
filing E as C would put a finding in the record that never happened.

### A correction — one of my own commits claims something it did not do

`d18a10a`, 17 Aug, is titled *"Stop tracking a vitest cache file, and ignore node_modules at
the root"*. It added the `.gitignore`. It did not untrack the file — `.gitignore` has no
effect on something already in the index, and `git ls-files` still returned it today, nine
days and every test run later. Fixed here with `git rm --cached`; `git ls-files node_modules`
now returns 0. A commit message that asserts a state nobody checked is the same fault as a
number typed where it could have been computed, and it was mine.

---

## Order 4 — the other four, ranked, and the one I would fix next

Your two tests, applied. They separate the four more sharply than I expected: **only one of
the four is actually the lockout shape**, and it is not the one with the biggest blast radius.

| | Finding | "Everyone repeated it, nobody read it" | Code contradicts itself | Moves the screen today |
|---|---|---|---|---|
| **A** | `ARMOR_TIER` — 16 hand-typed class→armour numbers | **Exact match.** No source names them; classic-EQ-shaped; nobody read one off the game. | **Yes, twice over.** Refuted by our own catalogue (BRD on 63 plate-named records vs PAL 59; BER on 2), and cited as precedent by finding D. | **No — dead code.** 0 screens, 0 selectors. |
| **B** | The haste cap our source names | **Half.** The repeated part is "only the highest counts" (classic, inherited). The cap itself is a number nobody applied rather than one everybody repeated. | **Yes, sharply.** `stats.ts:58` quotes the cap inside a constant whose job is to say what is unknown, then no line caps anything. | **Yes, at the top of the list.** 23 items; a haste belt at +10 is 102.0 EP, the largest single EP any item can earn — against 69.2 for the best weapon in the game. |
| **C** | The socket ladder's nine counterexamples | **No — the opposite failure.** Nobody repeated this from elsewhere. Somebody read it off the game and **stopped reading before the end**. | **Yes.** Our Tier M grade is contradicted by our own Tier M evidence file, nine rows. | **No.** The player already ruled "do not model per-item socket counts". The defect is the grade, not the behaviour. |
| **D** | `levelCheck` takes the highest class level | **No — invented, not inherited.** Original EQ has one level, so nobody could have repeated this. We derived it from A, which has no source. | **Yes.** `eql-game-systems.md:279` says the effective level is the **lowest**; the code takes the highest. | **3 rows.** Unbounded the moment `rl` populates. |

### The one I would fix next: **B, the haste cap.**

Not because it matches your shape best — **A does**, and I want to be straight that I am
ranking on consequence rather than on shape. Four reasons:

1. **It is the only one of the four changing what a player sees right now**, and it changes
   it at the top of the ranked list — the screen the landing band points at. A haste belt
   outscores the best weapon in the game by a factor of one and a half, and every one of the
   23 items is ranked as if its full figure lands.
2. **This planner plans trios**, which is precisely the configuration the cited source says
   binds: if item, spell and song haste share one ceiling, a trio holding a Bard, Shaman or
   Enchanter is at or near it before equipping anything. The sampled character in our own
   Tier M capture is Bard/Warrior/Berserker.
3. **The correct sentence is already in the file.** Marking it costs nothing and needs no
   evidence — it is the `stats.ts:58` case, where the comment and the code already disagree.
   Modelling it needs the capture, and the mark can ship first.
4. **It rides the trip the owner is already making.** `HASTE_STACKING.settle` and
   `HASTE_PROVENANCE.settle` are one screenshot each and already written as sentences; the
   cap needs a third. Three marks, one session, and I have the file to put them in now.

**A is the cheap second, and it is a deletion rather than a fix.** `ARMOR_TIER` has no
source, is refuted by our own data on two classes, and is consumed by nothing — it survives
only because four lines of its own unit test assert it. The reason it is not first is that it
is inert; the reason it is not last is that it is already load-bearing as an *argument* for
D, and it sits in `constants.ts` beside `ATTRIBUTE_CAP` and `RESIST_CAP`, which are genuinely
Tier M. That neighbourhood lends it a credibility it has not earned. Deleting a rule rather
than marking it is your call, not mine, which is why I have not.

**C I would not fix; I would re-grade it.** The behaviour is right — nine counterexamples in
115 items, zero in the other direction, so the ladder is a solid floor and the player has
already ruled the exceptions out of scope. What is wrong is that `TIER0-VALIDATION.md` still
prints **confirmed** and `exaltation.ts` still says *"confirmed against sub-slot numbering in
an inventory export"* — the same export. One paragraph, no code.

**D I would leave alone until `rl` populates**, and watch for the patch that populates it.
Three rows do not justify choosing between two unsourced answers today, and choosing badly
now bakes in a rule that would then be wrong on every list at once.

### What I did not do, and why

- **No contamination signature for exaltation stacking.** It would put this on the
  Contamination screen, which is where this project publishes exactly this kind of thing, and
  the `haste-stacking` signature is the precedent. I did not add one because your order was
  to mark it *where the planner strikes an effect out*, and that is the tab. Say the word and
  it is a self-contained addition.
- **The two code defects from my last report are still unfixed** and still in your gift:
  `setDiff`'s `!== 'ANY'` (Throwing Boulder, 82.3 phantom EP at +10) and `FLAT_KEYS` carrying
  `ATTACK`. Neither is a sourcing question; the first is one word.

### Still open, from your list — all three landed 22 Aug and are pushed

Nothing is waiting on me. Commits `7d73118`, `9efbd52`, `7c29f90`, `6678cbb`, `8221d92`.

- **gate_selftest** — `proposed/gate-selftest-reach/`: the patch, five constructible cases,
  two written refusals, and the meter that produced the number. Reach **23/42 = 54.8%**,
  ceiling **28/42 = 66.7%** after I withdrew my own 30/42. Session A can take it as it sits.
- **Licence** — `research/LICENSING-PROPOSAL.md`, 200 lines, **three** questions.
- **Band image** — `proposed/band-image/RECIPE.md`. **Do not ship a PNG**: inline SVG
  generated at build time from the payload, so every figure stays a `<text>` node our checks
  can read and a vitest can recompute.

### State, this push

`tsc` clean · vitest **925 / 62 files** (was 910 / 60) · playwright **150 / 150** ·
`verify.mjs` **PASSED**, Tier 0 100.0% · catalogue audit **PASSED**.

**The payload moved, and it moved because a check I added caught me.** `verify.mjs` failed
after the code changes — *"sourceLines: report says 31725, tree has 31877"* — which is the
contamination freshness check working as designed. Regenerated with `build.mjs`. The diff is
`builtAt`, `scannedAt` and `sourceLines` only: **0 item records changed**, confirmed with
`git status --porcelain web/public/data/items`.

## 26 Aug — you asked if one is sitting unexamined in the planner. Yes. Five.

Ranked by how closely each matches the shape you named: *a number everyone repeated that
nobody read off the game.* Every figure below was computed here; the command is named beside
it. Nothing in this section is taken on a subagent's word — where a helper's count and mine
disagreed, mine is printed and the disagreement is stated at the end.

### 1. Exaltations do not stack — and it is the lockout timer almost exactly

`web/src/engine/exaltation.ts:114-136`. `dedupeByFamily` collapses a set's effects to the
highest rank in each family, so `Improved Healing I` next to `III` is struck out on screen.

Its entire provenance is one parenthesis, `research/github-data-inventory.md:86`:

> "**Exaltations do not stack** — only the highest rank in a family counts … *(This no-stack
> claim is sourced to Thiole's reading of the wiki; jmoyers does not restate it.)*"

Three things make this the one I would examine first:

- **It is classic EverQuest's focus-effect rule, down to the family names.** `Improved
  Damage`, `Mana Preservation`, `Reagent Conservation` are original-EQ focus families, and
  "same type does not stack, one applies" is original-EQ behaviour. `SOURCING-STANDARD.md`
  says of that wiki that large parts are *"a Project 1999 import, sometimes word for word."*
- **The same file that supplies the rule disowns the source.** `github-data-inventory.md:66`
  ends: *"**Use jmoyers. Do not use Thiole's math.**"* — written after documenting that this
  author's scaling model was wrong in three ways and had negative stats backwards. We ruled
  the source unreliable for arithmetic and then took its stacking rule without a word.
- **Nothing has ever read it off the client.** No capture in `TIER0-VALIDATION.md` shows two
  same-family effects on one character. It is Tier 5, single-source, uncorroborated.

**And the code contradicts itself on the same rule.** Rank is parsed as a trailing Roman
numeral (`exaltation.ts:122`). The client prints both notations — `TIER0-VALIDATION.md:143-144`
shows `Focus Effect: String Resonance 11` beside `Click Effect: Rune IV` — and the payload
carries 29 arabic-suffixed effect names, 14 of them the bard resonances. Run against the
shipped regex (`node scratchpad/rank.mjs`):

```
Improved Healing I/II/III                                -> 1 survivor   (collapsed)
Wind Resonance 0 / 10 / 11 / 12 / 14                     -> 5 survivors  (five "families")
```

So the planner strikes out the Roman ranks and keeps five ranks of one bard focus side by
side — and the bard instrument modifier is the case `TIER0-VALIDATION.md:149` calls *"the
user's stated requirement."* Whichever way the stacking rule resolves, one of these two
screens is wrong today.

**What it costs if wrong:** the whole "Effects on this set" panel, every *"does not count"*
line, and the tab's central advice — spread families rather than double up. That advice
reverses.

### 2. A rule graded Tier M whose own evidence file holds nine counterexamples

`EXALTATION_LADDER` (`exaltation.ts:32-38`) says sockets are a function of `+N` and nothing
else — Focus at +1, Click at +2, Worn at +3, Proc at +4. `TIER0-VALIDATION.md` grades it
**"Sockets are derived from item level — confirmed. Nothing per-item to look up."**

I parsed the raw export against the coded ladder rather than reading the summary
(`python3` over `research/validation/tier0-inventory-Avenrae.txt`, grouping `<parent>-SlotN`
rows and filtering sub-slot sets to ⊆ {1,2,7,8,9,10} to exclude bags):

```
exaltable (+N) items parsed from the export        : 115
sockets the ladder predicts, absent in the export  :   9
sockets present EARLIER than the ladder predicts   :   0

  +4  no Slot8   Chipped Bone Rod +4        shows [7, 9, 10]
  +5  no Slot8   Nightmare Hide +5          shows [7, 9, 10]
  +5  no Slot8   Wand of Allure +5          shows [7, 9, 10]
  +2  no Slot8   Wand of Conflagration +2   shows [7]
  +4  no Slot8   Wand of Darkness +4        shows [7, 9, 10]
  +5  no Slot8   Wand of Lava +5            shows [7, 9, 10]
  +4  no Slot8   Wand of Souls +4           shows [7, 9, 10]
  +4  no Slot8   Wand of Swiftness +4       shows [7, 9, 10]   (x2)
```

Nine items, all wands and rods, all missing the **Click** socket at a tier that predicts it.
Zero counterexamples in the other direction, so the ladder is a solid *floor* — it is the
"and nothing else" half that the evidence does not carry.

**A correction, against my own interest:** the player's ruling at `TIER0-VALIDATION.md:152-157`
— *"do not model this … makes no claim about exact per-item socket counts"* — does cover the
modelling decision. So this is not an un-taken ruling. What it does not cover is the grade:
the file still prints **confirmed** two pages earlier, and `exaltation.ts:25-26` still says
*"confirmed against … sub-slot numbering in an inventory export"* — the same export. The
defect is that a Tier M grade was awarded without the nine rows being read. That is the
lockout failure in miniature: the reading existed and nobody finished it.

Also unmeasured: **44 of those 115 items show no ornamentation sub-slot at all**, while the
ladder gives every item one from +0. `functionalSocketsFor` hides it, so the blast radius is
small — but it is another row of the same table that the export does not support.

### 3. The haste cap our own source names, that no line of code applies

You already have the haste *stacking* assumption — `stats.ts:81` declares itself, which is
the standard I would want everywhere. The unexamined one is next to it. `research/eql-itemization.md`:

> **[SINGLE-SOURCE (eqltools/eqlwiki Haste Guide)]** … Total haste capped **~50% below L30,
> ~75% at L50**; only the highest worn-haste item counts; item/spell/song haste of different
> types stack …

We took the middle clause and left the first and third. `stats.ts:58` quotes the cap back at
the reader — *"flat attack-speed values under a level-scaled cap"* — inside a constant whose
whole job is to say what is unknown. Then nothing caps it: `grep -rn "HASTE_CAP\|hasteCap"
web/src` returns no cap anywhere, and `withCap` is wired to `ATTRIBUTE_CAP`, `RESIST_CAP`, the
heroic mods and the skill-damage mods — every capped stat on the client's panel except this one.

Measured over the shipped payload (`node` over `web/public/data/items/*.json`, deduped on
`(name,id)` to the 3,663 records):

```
items carrying HASTE : 23   values 9,10,15,16,21,26,31,36,41
positions            : WAIST 18 · HANDS 2 · PRIMARY 2 · BACK 1
top haste at +10     : Belt of the Four Winds 41 -> 51, x HASTE 2 = 102.0 EP
best PRIMARY at +10  : Cudgel of the Fool 1.731 ratio, x RATIO 40 = 69.2 EP
```

Under the shipped Melee DPS preset a haste belt is the largest single EP any item can earn —
larger than the best weapon in the game. **And this planner plans trios.** If the cited source
is right that item, spell and song haste stack toward one ceiling, a trio holding a Bard,
Shaman or Enchanter is at or near that ceiling before it equips anything, and 23 items are
ranked at the top of the list for a gain that partly or wholly does not land. The sampled
character in `TIER0-VALIDATION.md` §6 is Bard/Warrior/Berserker.

The cap's absence is recorded nowhere — not in `KNOWN-DATA-ISSUES.md`, not here, not in a
comment. It is the only combat stat on the panel with no denominator.

### 4. `ARMOR_TIER` — sixteen hand-typed numbers, no source, refuted by our own catalogue

`web/src/engine/constants.ts:26-35` places `BRD: 3` (chain) and `BER: 4` (plate). Tallying
plate-named records that carry an explicit class list (n=83, `node` over the payload):

```
SHD:64  BRD:63  WAR:60  PAL:59  CLR:55  RNG:22  SHM:18  ROG:17  BER:2
plate-named and BRD-only: 8   (Imbrued Platemail Vambraces / Breastplate / Boots /
                               Gauntlets / Helm, Lambent Breastplate, …)
```

Bards appear on more plate-named records than Paladins or Clerics; Berserkers appear on two.
The table says the reverse of both. And the Tier M export closes it — the character wears
**Imbrued Platemail Boots**, `cl: ["BRD"]`, plate restricted to Bards alone.

**Blast radius today is zero, and that is the only thing saving it.** `grep -rn
"armorTier\|ARMOR_TIER" web/src` returns `constants.ts`, `character.ts` and
`character.test.ts` — no screen, no selector. It is dead code kept alive by its own unit
tests. It is a trap for two reasons: `character.ts:267` already cites it as precedent to
justify finding 5 below, so a wrong rule is load-bearing as an *argument*; and it is exported
beside `ATTRIBUTE_CAP` and `RESIST_CAP`, which are genuinely Tier M, in a neighbourhood that
lends it credibility it has not earned. My recommendation is to delete it — there is no
evidence Legends has a proficiency gate separate from the per-item class lists `canUseClass`
already enforces.

### 5. `levelCheck` takes the highest class level; our research says the effective level is the lowest

`character.ts:261-294` checks an item's requirement against the **highest** qualifying class,
and its comment derives that from *"the same 'best of the trio' rule armour proficiency
already follows"* — i.e. from finding 4, which has no source. Meanwhile
`research/eql-game-systems.md:279`:

> **Confirmed:** your **effective level is the lowest of the three class levels**.

The corpus has a two-part rule — caps take the highest, level runs at the lowest — and the
engine applied the "highest" half to a level check. Neither branch has been read off the
client. Original EQ has one level, so this rule was not inherited; it was *invented* to fill a
hole EQ left, which is the same failure one step removed.

Today it moves **3 rows**: `node` over the payload finds exactly three records carrying `rl` —
Baton of the Sky (49), Refugee Shroud (15), Azarack Skin Wristwraps (46). `levelCheck` sits
inside `canUse`, which gates every ranking, auto-fill, the item browser and the planar sets.
**A patch that populates required levels turns a dormant assumption into a wrong answer on
every list at once**, which is the property that makes it worth settling before it matters
rather than after.

---

### Two code defects found on the way — neither is a sourcing question

**(a) `setDiff` credits weapon ratio in slots that cannot swing.** `gear.ts:366` and
`Upgrades.tsx:337` read `slot === 'PRIMARY' || slot === 'SECONDARY'`, matching
`computeTotals`. `setDiff.ts:181` and `:363` read `view.position.type !== 'ANY'`, which admits
all eighteen slot types — RANGE and AMMO included. The doc comment three lines above states
the correct rule in prose. `gear.ts:355-363` records that this exact bug already shipped once
and was fixed *on the ranking side only*.

Measured: 94 RANGE and 11 AMMO records carry `wp.dmg` + `wp.dly`. **Throwing Boulder is
36/35 = 1.029 — a higher ratio than any primary weapon in the game** (best PRIMARY: Cudgel of
the Fool, 0.865). Under Melee DPS that is **41.1 phantom EP at +0 and 82.3 at +10**, credited
into the Compare screen's per-slot column and its headline set total, for a contribution the
stat panel on the same screen refuses to show and the Upgrades screen scores at zero. No test
covers it — `setDiff.test.ts` mentions neither RANGE nor AMMO.

**(b) `FLAT_KEYS` scales two stats the cited rule table calls unchanged.** `upgrade.ts:1-6`
says the module is reimplemented from `github-data-inventory.md` §2.1. That table, line 56:

> `| **unchanged** | heroic stats, Attack, Dmg Bon, Backstab, Range, Size, … | untouched |`

`stats.ts:190` puts `'ATTACK'` in `FLAT_KEYS`, and `stats.ts:283-287` runs every skill-damage
mod through `scaleFlat`. `scaleFlat`'s own docstring still says *"the three regens and worn
haste"*; the reference implementation we are told to follow agrees —
`research/mechanics/jmoyers-itemUpgrade.ts:160` has no ATTACK. Measured: **0 items carry
ATTACK** (inert), **4 carry BACKSTAB**, the largest Serpent's Tooth at 13, which this engine
prints as **23 at +10** against a Tier M cap of 125. Small today; it will not announce itself
when `build.mjs` starts picking Attack up from a source, which it already parses.

I have written neither fix. Both are in your gift; (a) is one word with a measured 82.3 EP
consequence and needs no new source.

---

### The cap-aware claim — and a number of my own I have to withdraw

`ep.ts:5-8` advertises *"Unlike the tool this is modelled on, scoring is **cap-aware**"*, and
`setDiff.ts:10` calls it *"the one idea that is this product's own."* There is a structural
mismatch under it, and I read it wrong the first time.

**The mismatch is real and is plain in the code.** `already` reaches the scorer as
`scoreContextFrom(totalsFor(...))` — `computeTotals`, which sums **gear only**. It is compared
against `ATTRIBUTE_CAP = 510`, which `constants.ts:88-96` documents as read off the client's
Stats window (`Strength 304/510`) — a **whole-character** ceiling that includes race and class
base attributes. Gear-only totals are being measured against a bar that gear alone does not
have to clear.

**Corrected measurement** (scratch vitest importing the engine's own `resolveItem`, one pass
per position over all 23 so doubled slots count twice and the two Any Slots take the
catalogue best; file removed after the run):

```
ATTRIBUTE_CAP 510 · RESIST_CAP 1000
  STR  gear-only max 511   REACHES CAP (by 1)
  WIS  gear-only max 541   REACHES CAP (by 31)
  DEX  487 · INT 475 · CHA 473 · AGI 453 · STA 442      short by 23-68
  SV_COLD 682 · DISEASE 661 · FIRE 634 · MAGIC 600 · POISON 585 · VOID 229   cap 1000
  AC 934 · HP 2670   (no cap is passed to `creditable` for either)
```

So: the **save** branch cannot fire at all — the best conceivable set reaches 682 of 1000.
Five of seven attributes cannot reach 510 either. STR and WIS can, but only at an upper bound
that wears the single best-for-that-stat item in all 23 positions at +10, and STR clears it by
one point. The honest verdict is not "it never fires" — it is **"it is unreachable for all six
saves and five of seven attributes, and reachable for the other two only in a corner no real
set occupies."** The feature the product names as its own idea is, in practice, the haste rule
plus dead code.

**The withdrawal.** I measured this once before and told myself STR 376 / WIS 405, *nothing
reaches 510*. That was wrong. It took the best item per **slot type** (18) instead of per
**position** (23), so it silently dropped the second ear, the second wrist, the second finger
and both Any Slots — five positions, and the reason the number moved by 135 on STR. The
direction of the finding survives; the figure did not, and the figure is what I would have
been quoting. I also flagged a `SAVE_CAP` that resolved `undefined`: there is no such
constant, saves use `RESIST_CAP`, and the corrected run above uses it.

---

### On the four helpers I sent reading

Read-only, no writes, and I checked every headline before printing it. Their **counts did not
reproduce**: haste 46 against my 23, secondary weapons 424 against 212, AMMO 22 against 11,
BACKSTAB 8 against 4 — several of them exactly double. There is a byte-identical second copy
of the payload at `web/dist/data/items` (gitignored build output, verified identical: 3,663
records, 23 haste, 94 RANGE-with-`wp` in both), which would double a scan run from the repo
root — though it does not explain every figure, so I am naming the discrepancy rather than
diagnosing it. Two substantive claims of theirs I checked and dropped: that `git log -S"RATIO:
40"` returns one commit (it returns five), and that the player's "do not model this" ruling
does not cover the nine wands (it covers the modelling; it does not cover the grade). **Every
number in this report is mine.**

One thing they raised that I am *not* calling a finding: `RATIO` is `40` in Melee DPS
(`ep.ts:325`), `20` in Balanced (`ep.ts:351`) and `30` in `DEFAULT_IMPORTANCE`
(`gear.ts:54`) — three values, no citation, and a twelve-line defence of `HASTE: 2` sitting
directly above the largest of them saying nothing about it. But a weight profile is a
*preference*, and the app says so (`ep.ts:301`, and every weight is user-editable). I do not
think preferences are held to the sourcing standard, so I am recording it as a question for
you rather than as an unexamined game rule.

---

### 22 Aug — orders 1-3, delivered before your 25 Aug message arrived

All three were landed and pushed on 22 Aug, in commits `7d73118`, `9efbd52`, `7c29f90`,
`6678cbb`, `8221d92`. Nothing was waiting. In one line each, with the detail below:

- **Order 1** — reach measured at **23/42 = 54.8%**, ceiling **28/42 = 66.7%** after I
  withdrew my own 30/42. Patch, five constructible cases and two written refusals in
  `proposed/gate-selftest-reach/`; the meter ships with the number.
- **Order 2** — `research/LICENSING-PROPOSAL.md`, 377 lines to **200**, **three** questions.
- **Order 3** — `proposed/band-image/RECIPE.md`; **do not ship a PNG**, inline SVG generated
  at build time from the payload so every figure stays a `<text>` node our checks can read.
  The stat-standing chip that proposal was missing now ships.

### Order 1 — reach is 23 of 42, and the number changes the plan

Measured, not counted. `check.py` passes its own `fail`/`warn` into `gate.run`, so wrapping
those and recording the **caller's line inside gate.py** says exactly which assertions
fired. Denominator parsed from gate.py's AST — grep counts the string, the parse counts the
call. Runs on a copy; that tree is never written to. The meter ships with the number:
`proposed/gate-selftest-reach/measure-reach.py`.

```
gate.py assertion call sites : 42   (35 fail, 7 warn)   your counts, exact
cases run                    : 31   (29 CASES + 2 SPECIAL)
REACHED                      : 23   (23 fail, 0 warn)
NOT reached                  : 19   (12 fail, 7 warn)
reach                        : 23/42 = 54.8%
```

**Fixing `failures()` raises reach by zero.** Reach measures what fires, and no case makes
a warn fire. The patch changes what is *possible*; every point of gain comes from the new
cases.

**The severity filter is 7 of the 19 gaps.** Twelve `fail` assertions are unreached too and
the patch does nothing for them — including `L908`/`L939`, the `:root` and daylight token
blocks, which is the theme work in flight, and `L771`/`L774` on the TOOLS registry.

**A fairness measurement, because I would otherwise have misjudged the 31 cases.** 23 fire
a gate.py assertion; **8 fire none** — those cover `check.py`'s own assertions, a different
surface. Counting them as gaps would have been wrong.

**Two corrections to your brief, both small.** The filter is `gate_selftest.py:82` (76 is
the `def`, 77–81 the docstring). And "19 cases" is stale rather than wrong: `main` has
17 + 2 = 19, this branch has 29 + 2 = **31**.

### And a correction to myself, which I published before checking

I told you the patch plus seven warn cases reaches **30/42 = 71.4%**. It does not. **Two of
the seven warns cannot be proven at all**, so the ceiling is **28/42 = 66.7%**, and full
coverage of what is reachable is 40/42 rather than 42/42. Both verified here:

- **`gate.py:859`** — *index-data.json is missing*. `gate.py:245`, the second statement of
  `run()` and 611 lines earlier, does `IX = json.load(open(...))` with **no `try`**. Remove
  the file and `run()` raises there. Malform it and `json.load` raises `ValueError`, which
  the guard at 856 would not catch either — it is `except OSError`. Line 859 cannot execute
  under any damage to that file.
- **`gate.py:904`** — *site.css is missing*. `check.py:135` reads it at **module scope,
  unindented, no `try`**, 366 lines before `import gate`. Absent, `check.py` dies before the
  gate is imported: no FAIL, no WARN, and a case written for it reports `MISSED` — which
  reads as "the check is dead" when the harness never got that far.

Each is one small change from reachable, and the proposal names which. Neither is fixed by
the `failures()` patch. **The proposal declares them un-constructible rather than inventing
damages for them**, which is the standard I would want applied to my own work.

The patch, the five constructible cases and the two refusals are in
`proposed/gate-selftest-reach/PATCH-AND-CASES.md`. It also notes that **`check.py` has nine
`warn(` call sites of its own** which the same mechanism would make testable — the one at
621, *node is not on PATH*, being the only thing between "the tools were smoke-tested" and
"they were not and nobody said so."

### Order 3 — the band image, and a gap it found in the product

**My own proposal to you described a screen we do not draw.** I proposed "the ranked upgrade
list with its per-row source badges". `sourceStanding` was imported by `ItemWindow`,
`PlanarGear` and `Sources` — **not by `Upgrades`**. There was no per-row stat-standing
badge. That is the fault this project keeps catching in other people's work, committed in a
proposal for the band that leads the site.

The gap was real, older than the image, and independent of it: the row named the item's
*existence* evidence and said nothing about where its *stats* came from. Rule 5 says a
reader looking at a number is entitled to know, and the EP is the number that screen exists
to give. **The chip now ships.** Band and wording from the shared `sourceStanding`, so the
row cannot say something the item window does not; tier-5 tints and tier-2 does not, because
2,045 of the 2,176 records that print numbers are tier-2 and a colour every row shares is a
wash — the same argument the paper doll's tint already settled. Three tests pin it.

**On the constraint you asked me to answer plainly: do not ship a PNG.** A raster carrying
`+53.5 EP` is a typed number in a picture, and it is the one artefact `gate.py`, `verify.mjs`
and the catalogue audit are all blind to. The recommendation is **inline SVG generated at
build time from the payload, through the app's own engine** — every figure stays a `<text>`
node our checks can read, and a vitest recomputes the rows and compares. It must be inlined
rather than `<img src>`, or the self-hosted faces do not load.

Rejected, with reasons: PNG plus a sidecar JSON (nothing ties the sidecar to the pixels, and
CI cannot re-render); shape without figures (cheapest and never stale, but the band's whole
claim is that a *sourced number* reaches the screen).

That is why this is a recipe and not an asset: shooting the PNG would have been producing
the wrong artefact carefully. Full recipe — slot, four named candidates, frame order,
354px/44px geometry, crop rules, and what it must not show — in
`proposed/band-image/RECIPE.md`.

### Order 2 — three questions, 377 lines to 200

  Q1  the CODE                        permissive / AGPL / nothing
  Q2  the data that is OURS           CC BY / CC0 / no
  Q3  how "not ours" is communicated  machine-readable / prose only / withhold

Each option carries what follows from it in two lines. The compilation-and-database-right
discussion is gone rather than shortened, because it required the owner to be a lawyer.
Three buckets do the work: OURS, WIKI-DERIVED (not ours at any price), CLIENT-MINED. The
old fourth stratum — eqlsource's own datasets, already licensed to us on stated terms — is
settled rather than a decision, so it is now the appendix's precedent.

The silence is stated once, above the questions: eqlwiki publishes no terms, which is
neither permissive nor forbidden, and re-asserting a licence over wiki-derived material
stays off the table, CC0 included.

**Two stale figures dropped rather than carried.** The old draft's 31,240 and 6,079 line
counts do not reproduce; measured today, 84 non-test files / **31,586** lines under
`web/src` and **6,453** lines of `pipeline/*.mjs`. The scrape-intersection figures would
need re-indexing four raw scrapes, which was not run, so the appendix says they were not
recomputed instead of restating them. Zero tracked `LICENSE`, `COPYING` or `NOTICE`,
confirmed with `git ls-files`.

### State

Re-run 26 Aug, after this audit: `tsc` clean · vitest **910 / 60 files** · `verify.mjs`
**PASSED**, Tier 0 100.0% · catalogue audit **PASSED** · catalogue frozen, `git status
web/public/data` returns **0 files**. The 26 Aug section changed no code and no payload —
it is a reading, and the one file it touches is this one. The scratch vitest that produced
the cap ceilings was deleted after the run.

Previously, 22 Aug: `tsc` clean · vitest **910 / 60 files** · playwright **150** ·
`verify.mjs` **PASSED**, Tier 0 100.0% · catalogue audit **PASSED** · catalogue frozen,
**0 files** across every push. `eql-source` restored after every damage — `git status`
there is **0**, and nothing was written into it.

Still parked, not started: `upgrades.eqlsource.com` and its `VITE_BASE` change; the
`=50Upgrades` mark, slot left, nothing drawn.
