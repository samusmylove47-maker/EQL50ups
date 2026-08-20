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

### 1. The drift check — understood, and nothing pre-empted

Waiting for the merge, then re-copy once and re-pin. Not disabling it, not pre-copying.

One thing you may not have from your side: **the theme cannot change how this app looks.**
Nothing here loads `site.css` and the fonts are self-hosted, so the only thing your merge
touches is the drift check's expectations. It will go red on markup, not on colour.

### 2. The planner stays dark — my call, costed

Your argument for the imported tools is the one that decided it: a dark *tool* is the
site's published convention, so following the theme would make this the odd one out among
tools, which is the opposite of the seam the chrome work closed.

Costed honestly, and the tokens are not the bill:

```
49 of 95 custom properties are colours
 0 colour literals in any declaration outside tokens.css, across 12 stylesheets
   -> the extraction is already done, so a second palette is additive, not a refactor
 3 test files assert literal colours
 4 carry contrast or compositing walks   <- the expensive half
   visual-system.spec.ts's AA walk alone is 18.8s, second-slowest check in the suite,
   and every one of these would run twice
```

So: an afternoon of tokens and a doubled verification burden. The reason that settles it
rather than merely discouraging it is rule 5 — a theme I cannot prove is AA on every screen
in both modes is a theme that publishes a contrast failure quietly, which is the one thing
this repository is not allowed to do. **One honest colour, as you put it.**

Recorded at `tokens.css` itself, where somebody would go to implement the alternative, with
the measurement and the note that the door costs nothing to leave open.

### 3. The audit method, as something you can hand to another repository

`tools/check-audit/` — `audit.py` (Python 3.9+, stdlib only, no VCS required), a config for
this repository, a wrapper for the one check that writes instead of returning, and a README
carrying the method.

It shells out to whatever command runs a check, so it works against vitest, pytest,
playwright, `check.py`, `gate_selftest.py`, or a make target. Session A's repository can use
it unchanged.

**Two things I got wrong the first time, both now built into the tool:**

- **A generic operator cannot reach a string constant.** My first campaign reported the two
  drift checks as survivors. They are not dead — no `===`→`!==` will ever move a label. So
  the tool reports `UNPROVEN` for a generic survivor and refuses to say `DEAD` until a
  *written* damage aimed at the subject also survives. Reporting those two as dead would
  have been a false accusation produced by the instrument.
- **Restoration must not go through version control.** An audit is run in a tree with
  unstaged work in it — that is *when* people run audits. It holds original content in
  memory and verifies by hash; it exits 2 and says so if it cannot put a file back.

**Proved on itself rather than described:**

```
the repo's own set          10 examined, 10 alive   exit 0
a damage it cannot notice    1 DEAD                 exit 1
nothing selected             0 examined             exit 2
after every run              tree restored, hash-verified
```

The first run of the config returned two `STALE` rather than two false passes — `meta.json`
ships minified and I had written the damages with a pretty-printer's spacing. That verdict
existing is the difference between an audit and a formality.

**And the part mutation cannot find.** The README documents the *vacuous pass* separately,
because damaging a subject a check never reaches changes nothing and looks merely
uncovered. Five shapes to grep for, including the one that produced the dead check here: a
test that reimplements its subject and then tests the copy. That one is invisible to
mutation, invisible to coverage, and looks more thorough than the real thing.

### State

Catalogue frozen at 3,663 — `git diff --numstat` over `items-index.json` and every shard is
**0 files**, across every push. `tsc` clean · vitest **907 passed / 60 files** ·
`verify.mjs` **PASSED**, Tier 0 100.0% · playwright **145 passed** · check audit
**10/10 alive**.

The freshness check added yesterday earned itself today: adding the theme note to
`tokens.css` moved the source line count and `verify.mjs` went red until I regenerated the
report. That is the gate doing the job it could not do on Monday.
