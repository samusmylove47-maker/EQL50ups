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

*(nothing outstanding)*

---

## To the Director

### The map is fixed, and your hypothesis was the one thing that was already right

The doubled slots were **already mirrored** — `EAR_1`/`EAR_2` flanking, `WRIST_1`/`WRIST_2`
either side, `FINGERS_1`/`FINGERS_2` outermost. That part matched the game.

The fault was larger. The panel was a **5-column, 7-row anatomical silhouette** with a
decorative SVG body drawn behind it — ears flanking a helm, a chest-waist spine, weapons
beside the legs, Any Slots at the ankles — and three files carried comments arguing that
narrowing at the head and widening at the shoulders "is the whole point". Every position a
player already knows the place of was somewhere else.

Rendered and measured in a browser against the capture:

```
·          Ear 1      Neck       Face       Head       Ear 2
Fingers 1  Wrist 1    Arms       Hands      Wrist 2    Fingers 2
Shoulders  Chest      Back       Waist      Legs       Feet
Primary    Secondary  Range      Ammo       Any Slot 1 Any Slot 2
```

The silhouette is **removed, not adapted**. A body drawn behind the game's grid is
decoration competing with recognition, and there is nothing to adapt it to.

**Worth naming, because it is not the usual failure.** Nothing here was typed where it
could have been computed — the layout was measured, asserted in jsdom and re-measured in a
real browser, and every one of those checks passed against it for weeks. It was **invented
where it could have been observed.** Nobody looked at the game's own window. Rigour
downstream of a wrong premise just makes the wrong thing harder to dislodge.

### A miss of mine you should know about

**`e2e/routes.spec.ts` has been red since `ea76d92` and I pushed twice over it.** When the
32 chrome links moved off the `.html` form, three assertions kept the old spelling. I
started that suite, the run completed, and I read a different command's output instead of
its result — then reported "145/145" from a run that predated the change. The rule I broke
is my own: the command that produced the number has to be the command that answers the
question.

Fixed, and guarded: the spec now asserts the extensionless form and additionally fails if
**any** chrome link ends in `.html`, so the dependency on your redirect rule cannot come
back silently.

### From the capture, recorded not chased

- `Strength 70/510` and `SV Magic 25/1000` put `ATTRIBUTE_CAP` and `RESIST_CAP` on Tier M
  footing — a second character, far from the first, printing the same denominators.
- `AC 20/350 | 110` is **gap 7** in `research/validation/KNOWN-DATA-ISSUES.md`. The `110`
  is unexplained and is not guessed at. What would settle it: two captures of the same
  character with different gear, so the figure's response to worn AC can be measured. One
  capture cannot distinguish a constant from a function.

### Needs your relay to Session A

`slots.worn` is renamed to `slots.types`. Anything reading `slots.worn` gets `undefined`
rather than a wrong number, which is the failure mode I'd choose, but it is a break and
they cannot see it from here.

### State

891 unit, 145 e2e, 55 pipeline checks, verify green. Catalogue frozen: `counts.items`
**3,663**, `items-index.json` and every shard byte-identical. Holding, post-drop queue
untouched.
