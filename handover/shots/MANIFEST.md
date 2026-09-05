# Product screenshots for `/tools/50-upgrades`

Taken from the running product against the shipped payload by
`web/e2e/handover-shots.spec.ts`. Re-take with:

    cd web && npx playwright test --config=playwright.config.ts e2e/handover-shots

## Provenance — what lets a stale shot be identified rather than suspected

| | |
|---|---|
| payload `items-index.json` sha256 (first 12) | `917ff6713832` |
| catalogue built at | 2026-09-05T02:54:40.762Z |
| items in that payload | 3,883 |
| viewport | 1440 × 950 |
| taken | 2026-09-05T02:52:30Z |

**If `items-index.json` no longer hashes to `917ff6713832`, these images are older
than the data the tool ships and the numbers in them are not the numbers a visitor
sees.** That is the whole reason the hash is here rather than just a date.

## The files

| file | size | sha256 (first 12) |
|---|---|---|
| `01-landing.png` | 124 KiB | `4636178840de` |
| `02-set-editor.png` | 174 KiB | `76e0b04c2cb9` |
| `03-upgrades.png` | 153 KiB | `b3d785864f61` |
| `04-planar.png` | 159 KiB | `2aee8ddb9e86` |
| `05-items.png` | 153 KiB | `d207f82a90e8` |
| `06-sources.png` | 135 KiB | `5df7003f62b3` |
| `07-compare.png` | 107 KiB | `2cefaf475abb` |

## What is in frame, and what is deliberately not

**No player data, and no character name that belongs to anybody.** The character
is `Ashvane` — invented — created through the app's own form and geared with
**Auto-fill** against the shipped catalogue. The Tier 0 inventory export
(`research/validation/tier0-inventory.txt`) is never loaded by this spec.

**That claim used to be narrower than it sounded, and the difference cost two
frames.** The previous revision of this file said "grep the spec for the owner's
character name and you will not find it", which was true and did not mean what it
appeared to mean: the spec never loads the export, but the app **printed the name
in static copy** — the landing page's demo card and a source citation on the
Sources page — so it was in the pictures regardless of what the spec loaded. The
name was checked in the layer under test and never in the layer being
photographed.

The check now runs against rendered text, in `settle()`, which every capture
passes through: a frame whose `document.body.innerText` contains that name fails
instead of being saved. When the fix landed, **exactly two of the seven files
changed — `01-landing.png` and `06-sources.png`** — the two the finding named,
which is the confirmation that the finding and the fix were about the same thing.

**A Berserker trio on purpose.** BER/WAR/BRD at level 50. Berserker is one of the
classes EQ Legends added on top of classic, so the shots show the game this tool
is actually for rather than the original EverQuest its catalogue is contaminated
by.

**Mid-progression on the ranking screen, not fully geared.** Nine positions are
cleared before `03-upgrades.png` is taken. The first run of this spec photographed
the flagship screen reading *"NOTHING OUTRANKS WHAT YOU ARE WEARING"* — 0 of 23,
+0.0 — which is true and useless: Auto-fill **is** the ranking, so a set it has
just built is optimal by construction and has nothing to rank. That is the worst
possible picture of the screen this tool is named after, and it is not what any
real player sees. Nothing is faked; the gains are computed by the engine against
the catalogue, and the only staged thing is that the character has not finished
gearing.

## Suggested order for the page

1. **`03-upgrades.png`** — the ranking, and the thing the tool is named after.
   11 of 23 slots with a better option, +57.5 best single gain, +306.5 listed,
   and a zone panel saying where to go and how well surveyed each zone is.
2. **`07-compare.png`** — two builds side by side: +290 EP across 9 changed slots,
   slot by slot. Nothing else in the ecosystem does this.
3. **`04-planar.png`** — 125 planar pieces across 18 sets resolved for one trio.
   The other differentiator.
4. **`02-set-editor.png`** — the paper doll at 23/23, 713 EP. What "it worked"
   looks like.
5. **`06-sources.png`** — the provenance page. If the launch leans on *better
   sourced*, this screen **is** that claim rather than a description of it.
6. `05-items.png`, `01-landing.png` — supporting.

Frames 2, 3, 4 and 7 are byte-identical to the previous revision, so the figures
quoted above are the same measurements, not re-derived ones.

## Three defects these shots found, all fixed before capture

Photographing a screen turns out to be a different test from asserting about it,
and every one of these had passed every existing guard.

**The site's voice used the owner's own character name.** Above; found by Session
A, reported by hand because the channel to this session was one-way that day.

**The planar page contradicted itself.** Its prose said the Shadow Rage set is
offered by name and given *"no score at all"*, sitting directly beside a
**computed** figure that had already fallen to 0 when the owner's client captures
landed that morning. A sentence and a number disagreeing on the same screen.
Both branches are now driven by `unmeasuredCount`.

**The upgrades zone rows printed one column over the next.** `.upg-zoneseen`
carried `white-space: nowrap` inside a 140px grid track while its longest form,
`16 sightings · 6 unplaced`, needs 165px — so the text left its cell and
overprinted the survey column beside it: `6 unplacedPARTIAL SURVEY`, on the
flagship screen. Fixed, and guarded by measuring `scrollWidth` against
`clientWidth`.

That guard took three attempts and the first two were worthless, which is
recorded in the test because it is the more useful half of the lesson. The first
compared element bounding boxes — but a grid cell never moves, so the boxes never
intersect and only the glyphs overlap. The second had a fixture too short to
produce the long string, so it passed against the bug deliberately reinstated.
Only the third, measuring content against its own box on a row that actually
carries the `unplaced` clause, fails when the bug is put back.
