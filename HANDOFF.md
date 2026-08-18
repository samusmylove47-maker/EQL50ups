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

### Item 1 done, and your brief was wrong about its size — in your favour

**Only three of this tool's links were withdrawn, not six.** You listed six and my own
earlier note in this file repeated them back to you. Measured before touching anything:

```
curl -o /dev/null -w '%{http_code} -> %{redirect_url}' https://eqlsource.com/tools/…
  character         301 -> /tools/50-upgrades.html      withdrawn
  planar-gear       301 -> /tools/50-upgrades.html      withdrawn
  inventory         301 -> /tools/50-upgrades.html      withdrawn
  race-unlocks      200                                 SURVIVES
  combo-calculator  200                                 SURVIVES
  faction-impact    200                                 SURVIVES
  index-search      200    sky-ledger 200    50-upgrades 200
```

`race-unlocks`, `combo-calculator` and `faction-impact` are still served and I have kept
them. Had I applied the brief as written I would have deleted three working links. The
`.html` target 307s on to the extensionless form: two hops, final 200.

The canonical `/tools/` page lists exactly the six you named, so the consolidation is
finished as you said — it is the *deletion list* that was over-long, not the count.

### The footer was also wrong in the other direction: it omitted this tool

`/tools/50-upgrades` was not in the column. Checked before fixing —
`grep -n '50-upgrades' web/src/components/SiteChrome.tsx` returned nothing. The one entry
in the site's tool index this repository knows about first-hand was the one entry missing
from the index it publishes.

It is listed now, marked `aria-current="true"` — the current item of a set. Not `"page"`,
which would claim the href's target is the document being read; it is not, it is the
site's own page *about* the planner, and a 200.

### The drift checks were not checking anything

This is the one I would want to hear about first. **The live half of both drift tests had
never run — not once, including `site-nav-drift`, silently, since the day I wrote it.**

`vitest.config.ts` sets `environment: 'jsdom'`. jsdom brings its own `fetch`, and it
ignores this container's proxy, so the call returns **HTTP 403** — and a reachability
check cannot tell HTTP 403 from a site being down. Both files took their loud-skip path
and the run reported passes.

That is the failure the loud skip was written to prevent, arriving by the one route the
skip is blind to. I had reported the nav pin to you as a working check. It was not one.

```
npx vitest run src/components/site-foot-drift.test.ts --reporter=verbose
  before: stderr "[site-foot-drift] SKIPPED — HTTP 403", 5 passed
  after:  live test runs, 522ms, no skip line, 5 passed
```

Fixed with a per-file `// @vitest-environment node` and the proxy variable named in
`vitest.config.ts`, so a bare `npx vitest run` gets the real check. Proved it *bites*, not
merely that it runs: relabelling one `SITE_TOOLS` entry to "Sky Ledger DRIFTED" fails the
live test with the message it was written to give. Reverted.

**One consequence needs your ruling.** This repository's CI can now go red because
eqlsource.com changed. That is what a drift check is and it is the behaviour you
specified — but it is a coupling to a repository this session cannot see, and Session A
can now redden my build by shipping. Keep it, or make the live half advisory. I have kept
it, because a check that cannot fail is what I just finished removing.

### A live defect found on the way, unrelated to the footer

The Upgrades screen called two hooks *below* its `if (!gearSet)` early return. `App.tsx`
calls `hydrate()` from an effect and the store opens at `hydrated: false`, so a real page
load onto that route crosses the boundary **every time**: first paint has no set, the
paint after hydration has one, the hook count changes, React aborts the tree.

It survived because every test in `upgrades-screen.test.tsx` seeds the store before
mounting, so every render it had ever done was on the ranked path. Shipped in `eff5732`.

Proved rather than argued — the new test mounts the crossing:

```
npx vitest run src/screens/upgrades-screen.test.tsx
  before: 1 failed — Rendered more hooks than during the previous render
  after:  20 passed
```

I also cut a claim from the fix's own comment that I could not check: it asserted the bug
"reproduced on nine specs of the browser suite". I did not measure that, so it is gone and
the reproducible vitest is cited instead.

### Verification, with the commands

| Check | Command | Result |
|---|---|---|
| Types | `npx tsc --noEmit` | clean |
| Units | `npx vitest run` | **897 passed / 59 files** (896 + the new guard) |
| Payload gate | `node pipeline/verify.mjs` | **PASSED** — 62 checks, 0 failures, Tier 0 100.0% |
| Bundle | `npm run build` | clean, 500.92 kB |
| Browser | `npx playwright test` | **145 passed** (3.1m) |
| *(re-run after item 2)* | `tsc` · `vitest` · `playwright` | clean · **902 passed / 60 files** · **145 passed** |
| Sub-path | `VITE_BASE=/EQL50ups/` preview, 6 routes at 1440 and 390 | 40 anchors, 32 distinct, 0 `.html`, 0 withdrawn, self listed once, `aria-current` on 50 Upgrades, scrollX 0, **0 pageerrors, 0 4xx/5xx** |
| Catalogue | `git status --short web/public/data/` | **0 files** — frozen, `counts.items` 3,663 |

One push, four commits: `34a90ee` `4a20aed` `00cd509` `8f7b14e`.

**Deploy confirmed live, not inferred from a green suite.** The etag moved
`"6a843c14-a9e"` -> `"6a84be8f-a9e"`, and the served assets carry it — read from the
bundle, not the shell:

```
assets/index-BCbLFY5Q.js   200, 500,956 bytes
  present: tools/50-upgrades 1 · Faction impact checker 1 · now withdrawn 1
  absent:  tools/character 0 · tools/planar-gear 0 · tools/inventory 0
           Inventory reader 0 · Character sheet 0 · CC BY-SA 0
assets/index-BWw-Q4Ia.css  200
  .foot-grid a[aria-current]:after{content:"you are here"; …}
```

### Item 2 done — and the files were NOT disjoint, as you asked me to check

Splitting `--fs-heading` and giving the breadcrumb the current screen both land in
`web/src/components/SiteChrome.css`, and the breadcrumb also touches `SiteChrome.tsx`.
One agent, serially, after the first deploy landed. Both are in `34f5c0c`.

**The rung.** `--fs-mark: 18.5px`, the wordmark's alone; item names stay at 17px. The
fault was never the size, it was one token with two masters, width-critical in opposite
directions. Measured at 1440 by overriding the token in place:

```
EQL SOURCE   131.41px -> 143.00px   (+11.59)
SURVEY       moves right             +11.59
```

**A correction.** I told you the lockup was dragging `SURVEY` 13px left. Measured, the
close is worth **11.59px**, not 13. What remains against the site's own rendering I did
not measure and do not claim — no headless browser here reaches an external host, and I
did not build a mirror for a figure this small.

The check that failed when this was tried as a single token is the check that clears it
now: `visual-system.spec.ts`, *no doll row clips its own text at any width down to 360px*
— passing, with 18.5px on the mark and 17px on the names. 18.5px is listed in
`TYPE_SCALE_FIXED`, so it is a step on the scale rather than an exception to it.

**The breadcrumb.** Three segments on the landing, four everywhere else:

```
#/                EQL Source / Tools / 50 Upgrades
#/upgrades        EQL Source / Tools / 50 Upgrades / Upgrades
#/contamination   EQL Source / Tools / 50 Upgrades / What the scanner finds
```

The tool's name becomes a link once it stops being where you are — to this app's landing,
not the site's page about it. `screenName` switches over `Route` with no `default`, so a
route added in `router.ts` fails `tsc` rather than arriving one level short; the new test
covers the case `tsc` cannot see, a route handled by returning `null`. No clipping at 360,
390, 768 or 1440; it wraps to two lines below 768.

### Licence

`research/LICENSING-PROPOSAL.md`, unsigned. No `LICENSE` file, no existing file changed.
Three independent decisions, none chosen; §9 is a signature block. It records that no
terms at all is not neutrality but all-rights-reserved by default, and refuses re-asserting
any content licence over wiki-derived material, which would repeat this morning's fault.

### Still parked, nothing drawn

`upgrades.eqlsource.com` and its `VITE_BASE` change: not started. The `=50Upgrades` mark:
a slot is left and nothing has been drawn that could ship.

### State

Catalogue frozen at 3,663; `items-index.json` and every shard untouched this turn — two
pushes, zero regenerations of `web/public/data`.

Items 1 and 2 are both done. Nothing in the parked list has been started. What is open is
one ruling from you: whether this repository's CI may go red because eqlsource.com
changed.
