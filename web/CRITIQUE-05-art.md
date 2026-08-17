<!-- Written by a review agent, 2026-08-17, against the re-skinned build.
     Preserved verbatim: these are findings to work from, not prose to polish. -->

Preview server stopped. Here is the review.

---

# Art direction review — EQL Upgrades vs. `DESIGN-EQLSOURCE.md`

I read the 25 PNGs in `/home/user/EQL50ups/.artifacts/reskin/`, then re-served the built `dist/` on :4399 and measured the DOM directly, because "does the type hierarchy do work" is a countable question and I did not want to eyeball it.

## First, the two things that are genuinely done, so the rest is not read as blanket dismissal

**The warmth is real, not a token swap.** I classified all 57 colour tokens by R−B: **47 warm, 3 neutral, 7 cool** — and every one of the 7 is a deliberate accent (`--accent`/`--source-corroborating` steel blue, `--at-cap` teal, the three `--client-*` replica hues). The 3 "neutral" are all `#0a0908`, the page ground itself. Then I sampled every rendered surface ≥8×8px on the set editor: `rgb(15,13,12)` ×79, `rgb(42,38,34)` ×64, `rgb(27,24,21)` ×10, `rgb(19,17,16)` ×9, `rgb(61,55,48)` ×5. Every single one warm. **There is no cool grey left behind anywhere.** That was the doc's #1 ask and it is fully delivered.

**Radius discipline is real.** `--radius`, `--radius-lg` and `--radius-pill` are all `2px` in `tokens.css:251-253` — the pill token being 2px is a nice piece of spite against its own name. Only three selectors escape to `50%`.

**The landing page is on-language.** 73 visible text runs across **18 distinct type treatments**, 44px Playfair, Oswald at 15px/800, body at 15px with real leading. `01-landing-desktop.png` and `01-landing-mobile.png` would not look out of place next to the reference screenshot.

Everything below is about the fact that the landing page is a showroom and the product behind it did not get re-skinned.

---

## 1. The tier accent bar — the doc's longest instruction — ships on 0.39% of the catalog

`DESIGN-EQLSOURCE.md` #3 is the most emphatic item in the file: *"Steal the tier accent bar outright… Our item cards and stat rows should use the same vocabulary."*

`styles.css:3628-3642` implements `[data-standing]` correctly. `styles.css:3600-3626` then documents, at length and with conviction, why it is applied to exactly one component. `ItemWindow.tsx:89-96`:

```ts
function standingOf(item: Item): StandingMark | null {
  if (statsAreUnknown(item)) return { standing: 'distrust', … };
  if (isTier0Confirmed(item.n)) return { standing: 'trusted', … };
  return null;
}
```

I counted what those two predicates actually match across the shipped catalog: `TIER0_LIVE_ITEMS` holds **11 names**, matching **9 of 3,868 items**; `statsUnknown === true` on **6**. So **15 items — 0.39% — can ever render an accent bar, and only inside a hover window.** 3,853 items show nothing.

The signature device of the reference design is not adopted. It is stubbed, and the stub is defended in a 27-line comment. The comment's principle (never infer a standing) is correct and I would keep it — but the answer was to *make the app know a standing for every item* from provenance the pipeline already computes (`quarantine.json`, era, wiki-vs-export), not to ship the device on nine items. As it stands a user can browse for an hour and never see it.

**Fix:** derive a standing for every catalog row at build time and put the `border-top` rule on `.cell-item`, `.slot-row` and `.result` — the doc names "item cards and stat rows" explicitly. The CSS is already written; it needs data, not design.

## 2. The type hierarchy measurably does not function on the two screens that are the product

I walked every visible text node and histogrammed declared family / size / weight:

| screen | runs | ≥16px | Oswald (heading role) | Playfair | distinct treatments |
|---|---|---|---|---|---|
| **Item browser** | 645 | **1 (0.2%)** | **0** | 3 | 11 |
| **Set editor** | 263 | 9 (3.4%) | **1** | 4 | 17 |
| Landing | 73 | 6 (8.2%) | 5 | 11 | 18 |

**520 of the item browser's 645 text runs are 13px.** The heading face does not appear on that screen at all. On the set editor it appears once, out of 263 runs. Four roles were specified; on the working screens you get two-and-a-half at one size, which is why `02-items-desktop.png` and `09-exaltations-desktop.png` read as tables rather than pages.

The cause is in the CSS. `--condensed` is bound to exactly six selectors — `.set-switch .name`, `.modal-head h2`, `.card h3`, `.feature h3`, `.cmp-setname`, `.cmp-choicename` — every one at `--fs-mid` (15px) and `--fw-num`. So the "heading" role is one size, one weight, six places. **The item name is not among them**, and the item name is the most important text in a gear planner. And the scale itself has a hole: 10 / 11 / 13 / 15 / 30 / 44, with nothing between 15 and 30, so there is no step for a heading to occupy.

**Fix:** put `.cell-item .iname`, `.result` names and `.slot-row` item names on `--condensed` at a new ~17px step; that one change would touch every row on both screens.

## 3. Mono is the app's voice, not its labels

`--mono` accounts for **48 of the 63** explicit `font-family` declarations, and **190 of 263** text runs on the set editor. The doc scopes mono to "labels, eyebrows, nav" — a supporting role. Here it carries the entire stat line of every slot row, every picker row, every delta. Look at `06-picker-desktop.png`: each row is four stacked lines of near-identical 13px mono. That is a log viewer.

**Fix:** stat *values* stay mono; the stat *lines* in `.slot-row` and `.result` move to `--sans`. Mono then reads as deliberate again because it is rare.

## 4. Red is not spent once — it is the most common colour of the most important text

`13-items-usability-desktop.png` is the clearest evidence in the set. 57 of 100 item names painted `#c86454`, interleaved row-by-row with 43 green. It is a candy stripe. It reads like a failing test log, not a catalog. And the signal is inverted: "your trio cannot wear this" is the *normal* state, so 57% of the page shouts at you about the default.

Add the picker (`06-picker-desktop.png` carries roughly 30 red/green delta tokens at once) and `--client-red: #d5504a` — a **fifth, different red** — on the item window title bar, where it means nothing at all.

The token layer is actually disciplined: `--danger`, `--loss`, `--item-blocked` and `--source-distrust` all resolve to the same `#c86454`, so it is one red with one meaning. The failure is entirely in *frequency*.

**Fix:** invert the item-browser tint. Colour the 43 usable names sage; leave the 57 blocked ones in cream at reduced opacity. The stripe dies, the useful half becomes findable, and red returns to being an event.

## 5. Two visual languages fight and the wrong one wins

The item window is a 1999 EQ-client replica: `--client-red #d5504a` title bar, `--client-cyan #56b0f2` (B−R = 156, by far the coolest thing in the app), `--client-green #4ec06a`, `--client-gold #d9a441`. In `07-item-window-desktop.png` it is the brightest, most saturated, most chromatically foreign object on screen — and it is the payload of the entire product, opening on every hover.

So: editorial warm restraint in the chrome, neon skeuomorphism in the content. The content wins because it is louder. I understand this is a deliberate homage the landing page even advertises — but an art director's job is to say that the homage currently defeats the re-skin rather than sitting inside it. Damping the client hues 15-20% toward the warm ground would keep the reference legible and stop it outshouting the page.

The second-loudest offender is the `SET ALL TO +0…+10` ramp, clearest in `05-set-editor-filled-mobile.png`: eleven chips across a grey→gold gradient terminating in `--tier-10: #f0c02a`, **the highest-chroma pixel in the application**. On mobile it is the first colour you see. That is maximum visual priority spent on a preset control strip.

## 6. Whitespace is not generous; it is absent in the middle and dumped at the bottom

Measured on the set editor: the shell is `max-width: 1400px` with 24px inline padding, and the workspace is a three-column grid at `509px 302px 509px` with a **16px gap**. The doc asks for two columns and a ~24px gutter. Three columns at 16px inside a 1400px shell is dense-tool spacing.

Meanwhile `08-weights-desktop.png` ends its content around y=660 and then has ~250px of dead black before the footer, and `10-characters-desktop.png` puts one 435px card in a 1400px shell with the entire right 65% blank. That is not air between things, it is emptiness after them — the opposite failure, on the same page-set.

**Fix:** narrow the shell to ~1200px, raise the grid gap to 24px, and let the Characters card grid actually be a grid (or constrain it to a single readable column) instead of one card floating in a void.

## 7. Body copy is set at 13px

`--fs-body: 13px`, with `--fs-small: 11px` and `--fs-micro: 10px` doing most of the labelling. On the item browser, 120 of 645 runs are ≤11px. This is a density scale from a dev tool, and it is the single reason the landing page reads editorial while nothing else does — the landing is the only place body sits at 15px with real leading. `03-new-character-desktop.png` runs two helper paragraphs at this size across the full 1330px measure, far past a comfortable line length.

## 8. Smaller, but each specific

- **`/#/characters` renders its `<h1>` inside a steel-blue double focus ring on plain page load.** Visible in `10-characters-desktop.png`. Confirmed live: `activeElement` is `h1.page-title` with `tabIndex=-1`, `:focus-visible` matches, computed `outline: rgb(117,149,184) solid 2px` *plus* `box-shadow: 0 0 0 2px rgb(117,149,184)` — two indicators, both in `--accent`. Only that route (items/landing focus body; new-character focuses the name input, correctly). The page title looks like a text field, and the app's one precious cool note is being spent on an artifact.
- **`.notice` is a box with a left rule bolted on.** `styles.css:577-589` has `border: 1px solid var(--line)` *and* `background: var(--panel)` *and* `border-left: 3px`. The doc: *"left vertical rule, **no box**, body text with a bold lead-in."* There is no bold lead-in anywhere. Visible on `12-compare-desktop.png`. Deleting the border and background is a two-line fix.
- **Repeated strings doing no work.** `09-exaltations-desktop.png`: "first socket at +1" printed **23 times**, once per row, identical. `12-compare-desktop.png`: an "UNCHANGED" boxed chip **23 times**. Both belong in the header once, shown per-row only on divergence. These two screens have literally zero visual hierarchy — 23 identical bands top to bottom.
- **Chip soup, and era rendered two different ways.** In the picker, `SKY` / `LORE` / `MAGIC` / `KUNARK` are identical grey outline pills — a GitHub-label idiom. The doc's eyebrow is `TIER M · STRONGEST`: mono, tracked, `·`-separated, **unboxed**. And era is gold text in the item browser's ERA column but a neutral grey box in the picker — same fact, two treatments.
- **Sixteen perfect circles** on `03-new-character-desktop.png` (class chips), plus the avatar and set badge, against *"nothing is rounded more than slightly."* The class grid also has an unexplained ~65px dead band between its two rows that reads as a layout accident.
- **`ATTACK 0` / `ATK SPEED 0%`** on a fully-geared 50 (`05-set-editor-filled-desktop.png`). The verifier is right that it is honest. It is still two dead tiles diluting four live numbers in a six-tile block.

## Where I found less than expected

I went looking for cool greys surviving the repaint and found none — the sweep was clean. I expected the type scale to be undisciplined and it is not; it is a coherent scale that simply has a hole where the heading step should be and sits two steps too small overall. And the `--danger`/`--loss`/`--item-blocked`/`--source-distrust` convergence on one hex is better token hygiene than I assumed I would find.

---

## Verdict

Against the four asks: **warmth — delivered, fully and measurably. Four-role type — the roles exist but do no work where it counts (1 run ≥16px in 645; heading face absent). Tier accent bars — 0.39% of the catalog, effectively not shipped. Red once — inverted into the dominant colour of the primary view. Generous whitespace — 16px gutters and 250px of trailing void.**

One of four, plus a half. This is a real, disciplined token layer underneath a marketing page that hits the brief and an application that did not get the treatment. It is not "a token swap that left cool greys behind" — I checked and it isn't — but from the Items or Exaltations screen it is still a competent dark-mode dev tool wearing a warm palette, and no amount of correct `#0a0908` fixes that when 520 of 645 text runs are 13px.

The cheapest path to a real 8: item names to `--condensed` at a new 17px step, invert the usable/blocked tint, derive a standing for all 3,868 items so the accent bar actually appears, and delete `.notice`'s box. Four changes, all already scaffolded in the CSS.

SCORE: 5/10