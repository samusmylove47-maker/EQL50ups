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

### Queued — ruled, applied after the drop

- **Split the heading token.** One token sizing both the wordmark and
  item names, with opposite constraints, is a second source of truth in CSS form and will
  keep producing this. Give the wordmark its own 18.5px rung; leave item names at 17px. The
  bar itself already holds position exactly, so the 13px inside the lockup is polish, not a
  seam failure. First thing after the drop. *(Director, 2026-08-18: approved, post-drop.)*
- **The breadcrumb carries the current screen.** One that reads
  identically on six routes encodes nothing, and `DESIGN.md`'s rule is that a decorative
  mark should encode something true. Keep three segments on the landing, where there is no
  deeper screen to name. *(Director, 2026-08-18: approved, post-drop.)*

### Environment

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

### Pending — the footer, after the consolidation lands

The site is consolidating nine tools to three: The Index, Sky Ledger and 50 Upgrades. Six
pages this tool's footer links are being deleted:

| Link | Where |
|---|---|
| `/tools/character` | `SiteChrome.tsx:211` |
| `/tools/race-unlocks` | `SiteChrome.tsx:214` |
| `/tools/combo-calculator` | `SiteChrome.tsx:215` |
| `/tools/faction-impact` | `SiteChrome.tsx:216` |
| `/tools/planar-gear` | `SiteChrome.tsx:217` |
| `/tools/inventory` | `SiteChrome.tsx:218` |

All six are extensionless, confirmed in this repository's own source and in the live bundle.
Session A is writing every withdrawal redirect in both the `.html` and extensionless forms,
so they will 301 rather than break.

**Do not fix this yet — fixing now means fixing twice.** When the removals land, the
Director says so, and then: copy the footer once from the final state and add a drift check
of the same shape as `web/src/components/site-nav-drift.test.ts` — expected set pinned
offline so CI can run it without a network, checked against the live site when reachable,
skipping loudly rather than failing when not. A hand-copied footer drifts silently, which
is the whole reason that test exists. *(Director, 2026-08-18: heads-up, no action.)*

**One thing beyond the footer, for whenever this is actioned.** `PlanarGear.tsx:461`
renders a visible eyebrow reading *"Tool · planar armour · absorbed from
eqlsource.com/tools/planar-gear"*. It is prose, not a link, so nothing 404s — but it points
a reader at a page that will no longer exist, and it is the kind of line no link-checker
looks at. It should be rewritten in the same pass, not left behind because it happens not
to be an `<a>`.

---

## To the Director

### Acknowledged, nothing touched

The footer is unchanged. `git status` this turn is one file: `HANDOFF.md`.

Two things from checking my own source while recording it, both read-only:

- The six links are where you said, all extensionless — `SiteChrome.tsx:211, 214, 215, 216,
  217, 218`. Recorded above with line numbers so the eventual pass has a work list rather
  than a search.
- **`PlanarGear.tsx:461` carries the same exposure in prose.** It renders a visible eyebrow
  reading *"Tool · planar armour · absorbed from eqlsource.com/tools/planar-gear"*. Not a
  link, so nothing 404s and no link-checker will ever flag it — but it names a page that is
  going away, to a reader, on screen. Worth folding into the same pass rather than
  discovering later.

### State

Holding. Catalogue frozen at `counts.items` **3,663**; `items-index.json` and every shard
untouched. Post-drop queue untouched. Waiting on your word that the removals have landed.
