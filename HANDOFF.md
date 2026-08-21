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

### Order 1 — gate.py is not dead. It is the most thoroughly proven check in either repository

**36 damages aimed at gate.py, 36 killed.** Every one carried a probe first, and the probe
fired on every one, so `check.py` demonstrably reaches `gate.run`. Full run: 42 examined,
40 ALIVE, 1 DEAD, 1 MASKED.

**But the UNPROVEN I sent you was not a finding at all, and that is the important part.**
`gate.py` has **no `__main__`**. `python3 scripts/gate.py` is silent and exits 0 — it runs
nothing. It executes only through `check.py:501`, `import gate; gate.run(pages, fail,
warn)`. My command exercised no code, so of course every operator survived. I published a
verdict about a no-op.

The tool now damages a checker's own source *before* auditing it and refuses to produce any
verdict if the check stays green — `NOT_EXERCISED`. The rule underneath is the same one
twice: before believing what an experiment says about its subject, prove the experiment
touched the subject.

**The one DEAD in that set was mine too, and it is a fourth class.** `gate.py:485` is a
`warn(...)`. `check.py` prints the message and still exits 0, so judging on the exit code I
called a live assertion dead:

```
  WARN  public/dungeons/najena.html: no roster row found for withheld mob 'Rathyl' — cannot verify
  check.py exit 0
```

**That blind spot is yours as well.** `gate_selftest.py:82` returns
`[... for l in out.splitlines() if l.strip().startswith("FAIL")]` — it cannot prove a
warn-only assertion either. Same fault, different language, reached independently. Worth
counting how many of gate.py's assertions are warns before trusting that harness's coverage.

### Two things in gate.py no damage can reach — dead weight, not dead checks

- **`truth["tools listed"]` is computed and never consumed.** `gate.py:265-271` imports
  `_partials.TOOLS` and stores `len(_T)`; no regex in the file reads that key. The comment
  at 289-295 records the "N trackers" rule being withdrawn — the truth entry stayed behind.
- **The home page hero-sig is outside check 1's reach.** `public/index.html:90` prints
  `<span>435 items indexed</span><span>232 named recorded</span>`, but `LABELLED` requires
  the adjacency `N items, N named` and `SINGLE` covers only zones. Typing `436` there is
  caught by nothing.

### Order 2 — you were right, and my report was wrong

`/usr/bin/python3.12` (3.12.3) and `3.13` (3.13.12) are installed. Behind a
`python3 → python3.12` shim, `build.sh` runs green end to end. I described a PATH default
as a limit without checking for another interpreter.

Both previously-masked checks now run, and both are **ALIVE**. The auditor gained a
`rebuild` that runs after the damage *and again after the restore* — the second half is
the part I nearly missed: restoring a damaged source is not enough when derived files were
written from it.

The other known-dead check is still MASKED, and it does not matter: the grep settles it
independently. `check.py:88`'s regex matches **0 of 715** pages on `55832900` and **0 of
723** on main. It is unreached, not broken, and no mutation can prove that.

**On the line number: we are both right.** Root-`index.html` guard is `check.py:116` at
`2aeac48b`, `check.py:139` on `55832900`. Same defect, different commits. I have re-pinned
the config to the branch, because `gate.py` is 431 lines on main and 945 there — auditing
main would have audited a file about to be replaced.

### Two defects found by accident, for Session A

A no-op `./build.sh` on a clean checkout dirties two files, every time:

- **`state/last-build.json`** — committed with CRLF, the build writes LF. Byte-identical
  content, permanently dirty.
- **`public/learn/contamination.html`** — the published page reads
  `Found in: sky.json, index-data.json, lowerguk.html`; a fresh build here produces
  `source\lowerguk.html`.

Cause: **`_build/build26.py:72`** calls `os.path.basename(p)` on a path containing
backslashes. On Linux that is a no-op, so a Windows path fragment reaches the reader — on
the page whose entire job is honest self-audit. `posixpath.basename('source\\x.html')`
returns the whole string; `ntpath.basename` returns `x.html`. Their own
`scripts/contamination.py:164` already does the normalisation (`path.replace(os.sep, '/')`)
that build26 skips.

Both symptoms say the committed output was built on Windows. The consequence: `git status`
after a build is never clean there, so "the tree is clean" cannot be used as a signal.

### Order 3 — the method note, and two more beside it

`tools/check-audit/README.md` now carries three sections: the check that goes red for the
wrong reason (MASKED), the check that cannot fail at all (NOT_EXERCISED), and the check
that reports instead of failing (`failure_signal`). Each ends on the same rule.

**The honest headline of this week: four of my wrong verdicts came from the damage, not
the tool.** A superstring replacement, a first-occurrence replacement, a damage that
crashed the generator, and a damage judged on the wrong channel. The runner ported to a
Python static-site generator without a line changed. **The damages did not travel at all.**
That is the portability boundary, and it is where the budget goes.

### The consultation — the boast is right, its wording is not

**Lead with 7,599.** `counts.purge.quarantined` 7,599 against `counts.purge.before` 11,252
= **67.5%**, computed. It is the only figure in the payload that reports a *decision*
rather than an inventory. "3,663 items" is a number every planner has; "we deleted 7,599"
is one only a project with a sourcing standard can produce, and it explains why the shipped
list is short instead of apologising for it.

**Your caveat/boast distinction is right.** The recorded rule keeps the caveat out of the
band; 7,599 points the other way and belongs in it.

**But "every survivor carries a source tier" is false, and must not ship.** `counts.standing`
reads tier-2 2,045, tier-5 126, tier-M 5, **unattributed 1,487** — summing to 3,663. So
40.6% of survivors carry no tier at all, and `sourceStanding.stats.vocabulary` gives
`unattributed` `tier: null`. The true and still-strong form:

> **every survivor that prints a number names its tier** — 2,176 records, none of them
> silent.

Printing the stronger sentence would be the exact fault `CLAUDE.md` §7 names, on the band
that leads the site.

**One more wording trap.** Do not write "7,599 items that aren't in this game". **2,230** of
them (`quarantineReasons`, "no era in any source") were quarantined as *unconfirmed*, not
as proven foreign; **5,369** carry an explicit non-Legends era or flag. Nine words fixes it.

**Proposed copy.**

> **Eyebrow** — Live now · no account, no server
>
> **Lede** — The wiki this catalogue was scraped from holds 11,252 items. 7,599 of them
> belong to expansions EverQuest Legends does not have, or carry no era placing them in any
> game at all — every one quarantined by name, none of them shipped. 3,653 survived. The
> planner carries 3,663: the extra ten are items seen in the live game that no catalogue
> anywhere lists.
>
> **Body** — Pick a trio and a race, fill twenty-three slots, and compare what each
> candidate does to the character rather than to the item beside it. Every item upgrades
> from +0 to +10 and the stat sheet recomputes as you touch it. Eligibility is the union of
> your three classes, so a paladin in the mix opens plate for everyone, and points past a
> cap score nothing.
>
> Every row that prints a number names where that number came from — structured wiki data,
> wiki data with no era to place it, or a stat block read off the live client window. Five
> have been read off the client. Sets live in this browser and travel as a link.
>
> **Doors** — `Open the planner →` · `What survived the purge, and what didn't →`

Keep the mechanics paragraph: the band is a door, and a reader still needs to know what
opens.

**Image: yes — the ranked upgrade list with its per-row source badges.** One slot's
candidates, the delta column visible, at least one `Tier M · measured` row and one tier-5
row in the distrust colour. It is the only surface that shows the ranking *and* the
provenance in a single frame, so the picture argues what the copy argues. Not the equipment
map: more distinctive to a player who has just alt-tabbed out, but at band size it reads as
every planner's paper doll and says nothing about sourcing.

**One number trap for the building session.** The band currently interpolates
`counts.withStats` = **1,713**, while the sourcing accounting counts **2,176** records
printing numbers. Different quantities, like `slots.types` 18 against
`slots.positions.total` 23. Do not put both in one band.

**Where I disagree with you on length.** 766 against 2,271 characters is a real signal, but
it is a symptom. Padding to parity would spend the band's one virtue. The copy above is
longer only where it adds a claim.

### State

Their tree restored after every damage — `git status` there is **0**. Nothing was written
into it. `tsc` clean · vitest **907 / 60 files** · playwright **150** · `verify.mjs`
**PASSED**, Tier 0 100.0% · catalogue audit **PASSED** · this repo's check audit
**13/13 alive**. Catalogue frozen at 3,663 across every push.

Still parked, not started: `upgrades.eqlsource.com` and its `VITE_BASE` change; the
`=50Upgrades` mark, slot left, nothing drawn.
