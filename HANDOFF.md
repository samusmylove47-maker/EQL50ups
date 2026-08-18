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

### Payload contract

- **`slots.positions.total` is the field a reader-facing slot count comes from.** It is 23.
  `slots.worn` is a list of 18 slot *types* and answers a different question; 18 + 2 = 20 is
  the arithmetic presumption gives, because three types are worn twice. Published
  2026-08-18 with `worn`, `any`, `types`, `doubled` and a note, so the number never has to
  be derived again. `verify.mjs` asserts the arithmetic closes and a vitest asserts the
  payload agrees with the app's own `TOTAL_POSITIONS`. *(Director, 2026-08-18.)*

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

*(nothing outstanding)*

---

## To the Director

### The slot figure: print `slots.positions.total`

**23 is right, 18 is right, and they answer different questions — so neither of us should
have had to presume.** Computed from the app's own constants:

```
types           = 18          <- this is meta.slots.worn, a list of slot TYPES
doubled         = EAR, WRIST, FINGERS
worn positions  = 21          <- 18 types + a second position for each of the three
any positions   = 2           <- the EQL-specific Any Slots
total           = 23          <- TOTAL_POSITIONS in web/src/engine/constants.ts
```

Session A could not reconcile it because **the doubling was published nowhere**. A
character wears two earrings, two bracers and two rings; without that, the only available
sum is 18 + 2 = 20. The README's "twenty-three slots, including the two EQL-specific Any
Slots" is true in total and incomplete in its explanation, which is exactly the shape of
the `counts.items` / `counts.purge.shipped` fault — right in one field, wrong in another,
indistinguishable until they diverge.

**Added rather than left to presumption**, since you pre-authorised it:

```json
"slots": { "worn": [ …18 types… ], "any": "ANY",
  "positions": { "total": 23, "worn": 21, "any": 2, "types": 18,
                 "doubled": ["EAR","WRIST","FINGERS"], "note": "…" } }
```

Two guards so it cannot drift: `verify.mjs` asserts `types + doubled = worn`,
`worn + any = total`, `types === slots.worn.length`, and that every doubled entry is a real
worn type; and `web/src/data/slot-positions.test.ts` asserts the payload agrees with the
app's `TOTAL_POSITIONS`. The pipeline deliberately does not import from `web/src`, so the
two copies of the doubling exist on purpose and that test is the seam that forces them to
agree.

**The catalogue did not move.** `items-index.json` and every shard are byte-identical —
`git diff --numstat web/public/data/items-index.json web/public/data/items/` returns 0
changed files. `counts.items` is still 3,663. `meta.json` gains the `positions` key and a
new `builtAt`; `contamination.json` moves only its two timestamps and `sourceLines`
31336 → 31365, which is the 29 comment lines written into `tokens.css` in the previous
commit — the freshness gate doing its job.

**Session A will need to re-vendor `meta.json`** to pick up the new key. Nothing existing
changed shape or type, so a stale snapshot keeps working and simply lacks the field.

### Already landed

- **The Chromium finding is recorded** — `CLAUDE.md` §5, pushed in `89eb6b0`, before this
  message arrived. Structural fact, the reset-not-certificate-error trap that makes it look
  retryable, and the three consequences. Nothing to do.

### State

Holding, and the catalogue stays frozen through the drop. Post-drop queue is in *Standing*
and I will not start it until you release it.
