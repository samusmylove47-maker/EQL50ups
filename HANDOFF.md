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
  call, and called 2026-08-20. The site keeps its own imported tools dark and says so where
  a reader meets them, so a dark tool is the site's published convention rather than an
  exception to it. Costed: 49 of 95 custom properties are colours, but the extraction is
  already complete — **zero** colour literals in any declaration across 12 stylesheets — so
  a second palette is additive and the tokens are an afternoon. The bill is verification:
  3 test files assert literal colours and 4 carry contrast walks, and
  `visual-system.spec.ts`'s AA walk alone is 18.8s, the second-slowest check in the suite,
  every one of them doubling. A theme this repository cannot prove AA on every screen in
  both modes publishes a contrast failure, and rule 5 says uncertainty goes on screen. The
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

- **The footer copies the site's six-tool state, and a test holds it there.**
  `SITE_TOOLS` is the `Tools` column of the footer `eqlsource.com/tools/` serves, in its
  order, and `site-foot-drift.test.ts` checks the copy against the original the same way
  `site-nav-drift.test.ts` checks the masthead. Three withdrawn URLs are pinned by name
  because they 301 rather than 404, so nothing else here would notice one typed back in.
  *(Director, 2026-08-18: item 1, applied.)*
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

### 1. The portability claim was untested. It holds — and the tool was wrong four ways

Ran against `samusmylove47-maker/eql-source` at `2aeac48b`. **The runner needed no change.**
What it needed was a config, and writing that config is the real boundary: generic
operators are nearly useless against prose, HTML and JSON, so almost every check there
needs a written damage. Budget for the damages, not for porting the runner.

**Four things went wrong on the first run, and every one was my instrument manufacturing a
finding.** All four are now features:

| What happened | Why it lied | Fixed by |
|---|---|---|
| `.t3` → `.t3-renamed` on a `if ".t3" not in css` check | the substring is still there, so the check was right to stay green — and I reported it DEAD | a warning whenever a replacement contains what it replaced, plus `all_occurrences` |
| a damage made a 500-line gate red **on a neighbouring assertion** | reads exactly like proof | `expect_failure`: a regex the damaged output must match before red counts |
| dropped one of two links to a page | the page was still linked | `all_occurrences` again |
| damaging a *source* file tripped the repo's "output is stale" guard first | hides every downstream assertion | a new verdict, `MASKED` — not a verdict on the check, a verdict on the experiment |

Without the last one I would have sent you two false accusations.

**Findings for Session A** — their tree was restored after every damage, `git status` there
is empty, and I put nothing into it:

- **`check.py:116` guards `index.html` at the repository ROOT.** The site moved to
  `public/` and that path has not existed since, so the whole block never runs — the
  five-tier check at `:124` and the badge warning at `:127`. Confirmed on purpose: removing
  `Aggregator` from `public/index.html` entirely leaves `check.py` green. The page a reader
  gets carries all five tier names, so pointing the block at `public/index.html` should
  turn it green immediately.
- **`check.py:88` is unreached rather than broken.** Its regex `(\d+) verified to the full
  three-gate standard` matches **0 of 723 pages**. No mutation can prove that — there is
  nothing to damage — and one `grep` does. Worth recording as a method note: reach for the
  cheaper instrument when the question is "does this ever run".
- **Two checks are not auditable from here at all**, and that is a finding about their
  build rather than their checks: any damage to `assets/` trips `public/ is stale` before
  the assertion, and `./build.sh` needs Python 3.12 against this container's 3.11.15.
- **`gate.py` is UNPROVEN** — it survived every generic operator, which per my own rule
  means someone should aim a written damage at it, not that it is dead.
- **They already have this method.** `gate_selftest.py` passes 19 hand-written cases and
  says so in the same words I used. Its limit is the one that matters: it proves the 19
  checks somebody wrote a case for. It cannot find the check nobody suspected — which is
  what a generic-operator campaign is for, and how `check.py:116` fell out on purpose.

### 2. Theme re-costed. Unchanged — and one of its two reasons is withdrawn

You asked for re-examined, not reversed. The re-examination cost a reason.

**Retired:** "a theme I cannot prove is AA in both modes publishes a contrast failure
quietly." Session A built that prover, so the claim has weakened and I am not keeping it.
I checked my own AA walk against the four lessons:

```
1 composite the alpha       already done, incl. the ancestor opacity chain
2 image over opaque has a
  ground, over transparent
  none                      does not arise — 0 background-image or gradient
                            declarations across all 13 stylesheets, measured
3 zero examined is failure   already done, independently: seen > 20 per screen,
                            both widths
4 ground set BEFORE the
  document exists           the one real gap, and only if we theme
```

Lesson 4 is a genuine gift — the expensive mistake, not obvious, and mine to have made.

**What did not move:** 49 of 95 custom properties are colours; **20.0s** of contrast
walking across two checks (`visual-system` 18.6s, `planar` 1.4s), all of which doubles;
3 test files assert literal colours; and the focus-ring checks read *drawn pixels*, so
they need both grounds too.

**What carries it now**, and always did: eqlsource keeps its imported tools dark and says
so, making dark the site's convention for a tool rather than an exception — following the
theme would make the planner the odd one out *among tools*. And this is a working surface
kept open beside a fullscreen client, usually at night, which is an argument about use and
does not move when a verification cost does.

### 3. The catalogue audit — the standard holds on the axis that matters, and broke on rule 6

`pipeline/catalogue-audit.mjs`, computed from the payload, in CI, and a check rather than
a report: a figure whose source cannot be named fails it.

**Where each figure comes from.** 2,176 records print numbers a reader acts on — 2,045
tier-2, 126 tier-5, 5 tier-M — and **zero print a number with no recorded standing.** Rule
5 is met in fact and not only in intent: tier-5 renders as *"wiki stats, era unplaced"* in
the distrust colour.

**When it was last read — this is where the standard was being broken.** Rule 6 says date
everything. **Four of five inputs carried no date at all.** A commit pin says *what* we
hold, never *when*, so the staleness rule could not be applied to them. Now derived from
git rather than typed, because a hand-written date is the first thing to go stale.

**What a green run still does not say**, printed next to the tick:

- A vendoring date is not a currency date. The four repository inputs are pinned by SHA, so
  what we hold is exact — when those projects last checked their numbers against the game
  is unknown and unknowable from here.
- **3,094 of 3,663 records — 84.5% — carry no Tier M existence evidence at all.** They ship
  because a wiki placed their era: a Tier 2 statement about content, not an observation of
  the game. Rule 2 working as written, and the honest headline of this catalogue.

If you want one sentence for the site: *every number the planner prints names its tier, and
five of them have been read off the game.*

### 4. The burst, before the traffic

Five browser checks for the partial and ordered failures — the complete ones were already
covered. A single shard 404s (catalog intact, and **no** failure notice, because a missing
shard is not a missing catalog); that slot's picker still opens; a slow catalog reads as
loading rather than broken; nineteen shards at once list every candidate exactly once.

**The fifth was wrong first, in this repository's favourite way.** "The index arriving last
does not throw away what a shard brought" asserted the catalog was *populated* — true even
with the load-race regression in, because the index is where the names come from. It passed
against the bug it was named for. `src` is what the shard has and the index does not, so it
now drives the picker's own source filter: with the regression reinstated, `Drops` matches
nothing and it fails. Verified both ways and added to the audit set.

### State

`tsc` clean · vitest **907 / 60 files** · playwright **150 passed** · `verify.mjs`
**PASSED**, Tier 0 100.0% · catalogue audit **PASSED** · check audit **13/13 alive**.
Catalogue frozen at 3,663 — `git diff --numstat` over the index and every shard is **0
files**, across every push.

Still parked, not started: `upgrades.eqlsource.com` and its `VITE_BASE` change; the
`=50Upgrades` mark, slot left, nothing drawn.
