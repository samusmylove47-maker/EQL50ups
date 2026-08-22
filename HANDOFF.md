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

`tsc` clean · vitest **910 / 60 files** · playwright **150** · `verify.mjs` **PASSED**,
Tier 0 100.0% · catalogue audit **PASSED** · catalogue frozen, **0 files** across every
push. `eql-source` restored after every damage — `git status` there is **0**, and nothing
was written into it.

Still parked, not started: `upgrades.eqlsource.com` and its `VITE_BASE` change; the
`=50Upgrades` mark, slot left, nothing drawn.
