<!-- Written by a review agent on 2026-08-18, against the EQL Source integration build
     (workflow wf_0d4fa466-238). Preserved verbatim: these are findings to work from,
     not prose to polish. Committed so the score is auditable — the previous round's
     scores were reported in chat with no artefact behind them, which is worth less
     than no score. -->

Read-only review; I changed no files. Everything below was measured against `http://localhost:4399` (the running preview) and against a local mirror of eqlsource.com's own pages and stylesheet, both driven in the same Chromium at 1440×900.

---

# Does this read as a page *of* eqlsource.com?

Below the fold, yes — convincingly. Above the fold, no, and for two reasons that a reader sees before they read a word.

## BLOCKING for attachment (both are token-level; ~30 min combined)

**1. The frame doesn't line up with the site, or with itself.**
Measured left edges at 1440:

| | wordmark | breadcrumb | h1 | first ¶ | footer col 1 |
|---|---|---|---|---|---|
| site `/tools/planar-gear.html` | 140 | 140 | 140 | 140 | 140 |
| app `/#/planar` | **60** | **60** | **180** | **180** | **60** |
| app `/#/` and `/#/items` | 60 | 60 | **60** | 60 | 60 |

Site `.shell` is `x=100 w=1240` (`--max:1240` + `--gut:40`); app `.shell` is `x=20 w=1400` (`--shell-max:1400`). So crossing from eqlsource.com into the tool jerks the masthead 80px left — and clicking HOME → PLANAR *inside* the tool shifts the content 120px right while the frame stays put. It is visible in the round3 planar screenshot: `EQL SOURCE / TOOLS / 50 UPGRADES` sits clearly left of `TOOL · PLANAR ARMOUR` directly beneath it. `tokens.css` states the reason it adopted `.shell` was "the wordmark, the breadcrumb, the first column of content and the first footer column all sit on one left edge." That has not happened.
Fix: `--shell-max: 1240px` at least for `SiteChrome.css` and the footer; drop the 1080px inner column in `PlanarGear.css` / `Sources.css` / `Contamination.css` onto the same shell. Keep 1400 for the item table only if the six-column argument still holds — but then the frame must not follow it.

**2. The display tier is ~40% of the site's, and it is fixed where the site's is fluid.** At 1440:

| role | site | app |
|---|---|---|
| interior h1 | 72–78px Cinzel | **30px** |
| hero h1 | 76px | **44px** |
| h2 | 40px (`clamp(24,3.6vw,40)`) | **20px** |
| h3 / panel heading | 22px | **15px** |
| card title | 29px | **15px** |
| lede | 18.5px | **15px** |
| body | 15.5px | **13px** |

`grep 'font-size:.*clamp'` across all eight app stylesheets returns **0**; site.css has 25 clamps and the whole display tier is inside them. Consequence: `/#/planar` sets its page title at exactly the same 30px as its own "105" stat figure — the title of the page and a statistic weigh the same. At 390px the app is nearly right (site floors at 34); the gap is entirely a desktop gap, so `--fs-title: clamp(30px, 5.2vw, 68px)` and `--fs-hero: clamp(38px, 5.6vw, 76px)` in `web/src/styles/tokens.css` fixes it without touching mobile at all. The scale is also missing the site's 22px and 29px steps entirely.

## Serious, not blocking

**3. The card is missing the part the doc calls "the device worth copying."** Measured `/tools/`: three consecutive `.card`s carry `border-top: 2px` in `rgb(95,163,126)`, `rgb(242,234,218)`, `rgb(127,178,199)` — a per-card standing accent. App `.feature`: `border-top: 1px rgb(84,72,51)`, identical on all four, same as its other three sides. Background `rgb(25,19,9)` and radius 4px match exactly — so the hard part is right and the signature is absent. Also missing: kicker, chipline, and the `.foot`/`margin-top:auto` that stops ragged bottoms (landing cards 1 and 4 carry ~90px of dead space; card 2 fills). Site cards 376×398, app 312×231.

**4. Vertical rhythm is 3–7× tighter.** Gap from preceding element to each h2: site `/` = 222/238/236, site `/sources.html` = 295/257/269 (that's `--band: clamp(56,9vw,110)` plus a `--rule` hairline). App `/#/planar` = 49/**32**/71/**32**/**32**/62; `/#/sources` = 73/51/85/68/51; landing = 127/86. Seven correctly-built numbered sections separated by 32px is why Planar reads as one continuous column despite getting every house device right.

**5. No hero atmosphere.** `.hero` in `styles.css` is a bare grid with no `background`. The site's carries a brass radial `rgba(201,146,46,.07)`, a `surface-1→surface-0` fade, and a 96px coordinate grid at `rgba(242,234,218,.045)` masked at 72% — plus `.hero-art`. Pixel census over the same 1440×900: site `/tools/` **14.09%** warm-chroma vs app landing **7.21%**, the deficit concentrated in the 40° brass band (2,540px vs 1,137). The two gradient layers are ~6 lines and need no artwork.

**6. No `--brass`, and the one accent is cool.** The site calls brass "the one thing that makes the frame feel lit rather than printed." tokens.css has no equivalent and points `--accent` at `#7595b8`. The argument in the comment is defensible, but on the populated Upgrades screenshot the 200° cool-blue band is the **second-largest saturated band on the page (5,265px)**; on the site's tools page cool blue never reaches the top three. The site never lets its interactive colour be the loudest non-content thing.

**7. h2 is two faces in one app.** `/#/sources` and `/#/contamination` h2 = Cinzel 20px; `/#/planar` h2 = Saira Condensed 20px (`PlanarGear.css:220`, `.pl-section-title` → `--font-heading`). The site's stated rule is Cinzel for the top two levels, Saira below.

**8. The big-figure device renders three ways.** `/#/planar` 30px Saira · `/#/sources` 30px IBM Plex Mono · `/#/contamination` 44px Saira. Site `.ix dd` is always 42px Saira Condensed.

## Genuinely closed — and it is most of the work

- **Palette verbatim.** `#0b0704 / #191309 / #282013`, `--line #544833`, `--line-strong #6b5c46`, radius 4px. The 1.33:1 invisible-rule bug both codebases independently shipped is fixed here.
- **Warmth, measured.** `/#/items` text runs: 689 warm / 3 cool / 1 neutral; borders 480 warm / 0 cool. The app is if anything warmer than the site.
- **Red discipline.** 0–1 red text runs per screen (site: 0–4); red fill 0.00–0.01% of painted area. Red survives only on distrust, the client-window quotation, and blocked items.
- **Fonts.** All four self-hosted and painting; 288ms FCP with Google Fonts blocked and zero external requests — better than the site, which still blocks on `fonts.googleapis.com`.
- **The house method is written, not imitated.** Numbered sections 01–07 under a hairline; "Nothing here is ranked that nobody has measured" leading with the self-criticism; "One assumption, stated"; the T3 badge repeating. The eyebrow `TOOL · PLANAR ARMOUR · ABSORBED FROM EQLSOURCE.COM/TOOLS/PLANAR-GEAR` is better than anything the site does — it names what it replaces.
- **The Contamination index-strip is a near-exact `.ix`**: 44px Saira figures, 10px mono labels, 1px gaps on `--rule`.
- **Patch-day behaviour is safe, which is what matters tomorrow.** Searching "Shadow Rage" returns six existence-only rows: an amber mono `NO STAT DATA` chip and em-dashes in STATS/ERA/EP — never a zero, never ranked. 16 such records ship. Rule 7 is real on screen.
- **The dashed "not offered" slot chips** in Planar §05 draw an absence as an absence. The site doesn't have that; it should steal it.
- **The two-row sticky `.chrome`** (site bar + tool bar together on desktop, tool rail released under 760px) is a better answer to "a tool nested in a site" than the site has. I first read it as a defect and it is not — and the doubled masthead in `05c-upgrades-real-imported-set-1440x900.png` is a full-page-screenshot stitching artifact of that sticky wrapper, not a bug.

## What I did not do

I did not re-run the gates (the verifier's lane) and did not review Upgrades' or Compare's interaction states beyond what the round3 stills show. I did not audit 320px. My measure-overrun suspicion on Planar collapsed under measurement — the app's lede box is 624px against the site's 626px, so the measure is right and only the size is a step down; I've stated it that way rather than the way I first framed it.

**Ranking against the morning:** fix 1 and 2 and it reads as a page of that site. 3 is one line. 4 is one token plus applying it. 5–8 are cosmetic and can wait for after patch day.

SCORE: 7/10