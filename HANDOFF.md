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

### The check audit: 82 examined, 2 dead, both fixed

Your rule — zero examined is itself a failure. Method: damage the source each check
guards, run that check alone, restore. The gate got nine hand-built broken payloads.

| Suite | Examined | Alive | Dead |
|---|---|---|---|
| vitest files | 60 | 59 | **1** |
| browser specs | 20 | 20 | 0 |
| payload gate (`verify.mjs`) | 9 broken payloads | 9 caught | 0 |
| contamination scanner | 1 injected code site | detected, right file and line | 0 |

The gate got a self-test as well: forcing one `assert()` false does fail the run, so the
harness is wired to the exit code and not merely printing.

### Dead check 1 — `load-race.test.ts` was guarding a copy of itself

All six tests exercised `foldIndexUnder`, a reimplementation of the merge rule **written
inside the test file**. The shipped rule is one line of `catalog.ts`'s `load()`. Nothing
called it. Put back the regression its own header describes — the index replacing `items`
wholesale:

```
# catalog.ts:  prior.length ? mergeItems(items, prior).items : items   ->   items
before:  6 passed in that file · 902 passed in the whole suite
after:   1 failed | 905 passed — and the failure is the new test, the only one that sees it
```

Fixed by driving the real store through the real race with a stubbed `fetch`. I got the
race wrong first: awaiting the shard *before* calling `load()` skips the index entirely,
because `commitShards` sets status `ready` and `load()` returns early on it. The index
fetch is now held open and released after the shard commits, which is what a slow network
actually does.

Also recorded at the file: **swapping the two arguments is not this bug.** `mergeItems`
merges field by field and an index record has no `rl` to overwrite with, so the flip
leaves everything green. My first version of that comment claimed otherwise; it was wrong
and is corrected.

### Dead check 2 — the self-audit page was describing an older tree

`contamination.json` was scanned 18 Aug and reports **31,313** source lines. A fresh scan
of the *same commit* finds **31,608**. The page whose entire purpose is honest
self-description was publishing figures four commits out of date, and `verify.mjs` passed
throughout — it asserted the report *existed*, never that it was *current*.

It now re-scans into a temp file and compares the corpus, so the gate fails on a payload
that was not regenerated. Report regenerated; catalogue untouched.

### Four vacuous passes, same shape as the 403

Assertions of the form "none of this collection is X", which an empty collection
satisfies. The type-scale audit was the worst of them: on a screen that failed to render
it was `[].filter(…)` and reported a pass — the only thing standing between the type scale
and a screen rendering whatever it likes. It now proves it measured something first (floor
40; measured 147 on the landing, 495 on the gear tab, 724 in the item browser). Same
closure for the doll's glyph and tile tints, for `CHROME_LINKS`, and for the equipment
map's absence assertions.

### The gate now runs in CI, and 145 checks still do not

CI ran `tsc`, `vitest`, `build`. The payload is *committed* rather than built there, so
`verify.mjs`'s 64 assertions — no licence claimed, slot arithmetic closes, every quoted
line still reads that way — ran only when somebody remembered. It is a CI step now; it
reads the payload and writes nothing to it. `build.mjs` is still never run in CI.

**The browser suite is still not in CI: 145 checks, all proven alive today, none of them
gating the deploy.** That is your call, not mine — it needs a Chromium in the runner, and
it is the largest remaining gap between "the suite is the deploy gate" and what the gate
actually is.

### The tool I built to find dead checks was itself a dead check

Its first pass reported 133 assertion-less browser specs. It had mistaken Playwright's
`({ page })` destructuring for the test body. I noticed because the number was absurd, not
because anything caught it. Recorded rather than quietly fixed — it is the day's lesson
committed by the instrument built to detect it, and the second time today I printed a
figure I had not verified (the other: I read a `count` field off the contamination report
that does not exist, and reported "0 hits" for a scanner that had found four).

### Your other item: the colour tokens are already extracted

Nothing to do. 12 stylesheets outside `tokens.css`, **zero** colour literals in any
declaration — the 14 `grep` hits are all inside comments, recording measurements. A light
theme here is a token swap, as you wanted, and whether the planner takes one is still open.

### Standing answers I have applied

Drift stays blocking, and drift and unreachable already fail differently. When it fires I
update the copy and never the check. I am not waiting on the versioned nav/footer registry
and will keep diffing the rendering until it exists. The licence proposal is with the owner
and I am not chasing it. When Session A's theme lands and my footer check goes red, I will
wait for the merge, re-copy once, and re-pin.

### State

Catalogue frozen at 3,663 — `git diff --numstat` over `items-index.json` and every shard is
**0 files**, across all three pushes today. `tsc` clean · vitest **907 passed / 60 files** ·
`verify.mjs` **PASSED**, Tier 0 100.0% · playwright **145 passed**.
