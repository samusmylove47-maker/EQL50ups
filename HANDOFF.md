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

### 1. B5 could not be applied as ruled, and the reason changes the ruling

**`--fs-heading` cannot go to 18.5px without a layout change, and the rung is doing a
second job you were not told about.**

Attempted, measured, reverted. Evidence:

```
clipped text at 1100px (slot body 135px)
  slot-item: "Summoned: Jolum's Brilliant Bauble"
```

`.slot-item` on the paper doll is a `-webkit-line-clamp` box. At 1100px the doll's slot
body is 135px wide; that name wants **216.7px at 17px and 235.8px at 18.5px**, so it was
already wrapping, and the extra 1.5px pushes it past the clamp onto a line that is cut
vertically. `visual-system.spec.ts`'s clip probe catches it — it compares the height the
content wants against the height it gets, which `scrollWidth === clientWidth` cannot see
on an already-shrunk row. Raising the clamp changes the height of every row on the doll:
a layout change, not a token change, and exactly the churn the ruling was avoiding.

**But the rung is not only on item names — it is on the wordmark, at the seam.** Measured
across the crossing at 1440, both sides rendering the same self-hosted faces:

| | site `/upgrades` | this tool |
|---|---|---|
| `.mark .m1` font | Cinzel | Cinzel |
| `.mark .m1` size | **18.5px** | **17px** |
| `.mark .m1` letter-spacing | 1.85px | 1.7px |
| `.mark .m1` x | 140 | 140 |
| `.mark .m2` ("Survey") x | **292** | **279** |

The wordmark is the first thing a reader sees on both sides of the crossing, and it
shrinks by 1.5px as they cross. The shorter wordmark drags "Survey" 13px left with it.

**Recommendation, not applied:** split the token. Give the wordmark its own rung at
18.5px, matching the site exactly where nothing constrains its width, and leave item names
at 17px where the clamp binds. That is one token addition, no layout change, and it closes
the only part of the gap a reader meets at the boundary. Your call — the original ruling
assumed one job for one token, and there are two.

### 2. The seam, walked — and a limitation you should know about

**I cannot browse the real boundary from this container.** Headless Chromium reaches no
external host: `net::ERR_CONNECTION_RESET` for `eqlsource.com` *and* for our own
`github.io` deploy, with and without the proxy passed explicitly. `curl` works because it
trusts the proxy CA; Chromium does not, and I will not disable TLS verification to force
it. So I mirrored the site's `/upgrades` page locally from `curl`, served it beside the
sub-path build, substituted our self-hosted faces for the Google Fonts link the browser
also cannot reach, and walked that. Geometry and type are real; the network hop is not.

What a reader sees, 1440 and 390:

- **The masthead holds its position exactly.** Wordmark x=140 at 1440 and x=18 at 390, on
  both sides. Bar height 59px both. Ground colour identical. Nothing jumps.
- **The nav shifts 17px.** First nav link x=704 on the site page, x=721 in the tool; the
  last lands within 2px (1222 vs 1224). Small, and only visible if you are looking.
- **The tool marks `TOOLS` with a box; the site's `/upgrades` page does not.** Visible in
  the screenshots. It reads as "you are here", which is true, but it is a difference at
  the crossing rather than a continuation of it.
- **The tool adds a second rail the site page has none of** — breadcrumb on the left, tool
  nav (Home / Characters / Upgrades / Planar / Items) on the right. This is the clearest
  signal a reader gets that they have entered something, and I think it is the right one:
  it appears *below* an unchanged masthead, so the site frame stays put and the tool's own
  navigation arrives underneath it.
- **The breadcrumb is true on every route, and identical on every route.** It reads
  `EQL Source / Tools / 50 Upgrades` on `/`, `#/items`, `#/upgrades`, `#/planar`,
  `#/sources` and `#/contamination`. It never lies and it never localises: the tool nav
  does that job. Worth a ruling — it could carry the current screen as a fourth segment.
- **The way back is the masthead**, and it works: seven absolute links, all 200 direct.
  The breadcrumb's own `EQL Source` and `Tools` segments are also links back.
- **No horizontal scroll on any route at either width**, and no page errors.

Nothing about the crossing reads as *leaving* the site. It reads as going one level deeper
into it, which I believe is what you want.

### 3. The catalogue is frozen, and the 3,653 you are seeing is not stale

**Confirmed: the catalogue will not move today.** No pipeline run, no data change, no
feature work. The planar "Pick by hand" first impression stays parked.

**The two numbers are both live and both correct — they are different fields.** Read from
the deploy just now:

```
counts.items                        = 3663   <- the catalogue: what the app loads and ranks
counts.purge.shipped                = 3653   <- survivors of the era purge ONLY
counts.purge.admittedOutsideScrape  = 10
counts.purge.catalog                = 3663
builtAt                             = 2026-08-18T06:36:13.565Z
```

3,653 + 10 = 3,663. The ten are the existence-only records under rule 7 — items a Tier M
source *names* and no source *describes*, which ship with no slot, no class, no era and no
stats, and are never ranked. They were never in the scrape, so they are not "survivors" of
a purge and are correctly absent from `purge.shipped`.

So a snapshot reading 3,653 is not stale; it is reading the narrower field. If the intent
is "how many items does the planner hold", the field is **`counts.items`** (or
`counts.purge.catalog`, which is the same number by construction). If the intent is "how
many survived the era purge", 3,653 is right and should be labelled as such.

Whichever you vendor, it is stable as of `builtAt` above and will not move until you
schedule the refresh.
