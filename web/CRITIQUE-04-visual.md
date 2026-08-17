# CRITIQUE-04 — Visual design & game authenticity

Adversarial re-score against sixtyupgrades.com (UI-REFERENCE §A) and the EverQuest Legends client
(§B). Everything below was driven in Chromium against a production build served on port 4243, with a
real character (`Avenrae · 50 BRD/WAR/BER · HEF`) created through the UI and auto-filled to 23/23.
Forty-five full-page screenshots at 1600 / 1280 / 1024 / 768 / 390, plus element captures and
computed-style measurements. Every visual claim here I looked at; every number I measured.

---

## Score

# 6.9 / 10

**The type system, the colour discipline and the item window are genuinely 8-level craft, but the
one object that was supposed to make this a character sheet instead of a dashboard — the centre
figure — still reads as a pegboard with holes, and the same nine vocabulary and layout defects have
now survived four consecutive reviews while the fix effort went to the cheap half of the list.**

| Lens | C-02 | C-03 | **C-04** | Δ |
|---|---|---|---|---|
| Visual design | 6.5 | 7.0 | **6.9** | −0.1 |
| Authenticity | 7.0 | 7.5 | **6.9** | −0.6 |
| **Mean** | 6.75 | 7.25 | **6.9** | **−0.35** |

Six named CRITIQUE-03 must-fixes genuinely closed, and I credit them below. But **not one of the
five authenticity/vocabulary findings moved**, the ragged-card geometry is byte-for-byte identical to
the numbers CRITIQUE-03 printed, and the fix for #9 introduced a new 8px misalignment that runs down
the middle of the app's primary column at every width from 390 to 900. Authenticity goes backwards
because the lens's entire must-fix list (#14, #15, #20) is untouched and the landing page now teaches
a colour rule the money screen deliberately contradicts.

---

## The centre figure: it does not read as a character

This is the question the build has staked its money screen on, so it gets its own section.

I looked at it at 1600, 1280, 1024, 768 and 390, empty, half-filled, fully filled and fully tiered.
**It reads as a grid with holes.** Measured row extents at `--cell: 48px`:

```
row 1  head/ears     3 cells   152px
row 2  face          1 cell     48px
row 3  shoulders     3 cells   256px   ← holes at columns 2 and 4
row 4  arms…range    5 cells   256px
row 5  hands…ammo    5 cells   256px
row 6  weapons/legs  3 cells   152px
row 7  any/feet      3 cells   152px
```

The comment at `CharacterFigure.tsx:17` and `styles.css:1049` claims the silhouette "narrows at the
head, widens at the shoulders and narrows again at the feet." **The feet half is now true** — that
was CRITIQUE-03 F7's ask and it was taken. **The shoulders half is still false, and it is the half
that carries the reading.** The widest *mass* on the figure is rows 4 and 5 — wrists, rings, waist,
range, ammo. Three consecutive 256px rows in the middle produce a square block whose broadest point
is the *waist*, which is anatomically backwards. Row 3, the collar, is 256px wide but holds only
three cells with two-cell voids either side of the neck, so the pauldron and the cloak float as
disconnected islands 104px away from the arms directly beneath them.

Four further things actively destroy the body reading, and I can see every one of them:

1. **Every cell is the same 48×48 rounded square with the same 1px border.** The head is the same
   size as a finger. There is no mass hierarchy anywhere in the arrangement, which is the single
   cheapest thing a silhouette needs.
2. **The centre of the "torso" is four featureless ovals.** WRIST_1/WRIST_2 (bare ellipses) and
   FINGERS_1/FINGERS_2 (small circles on stems) form a 2×2 block of near-identical rounded shapes at
   columns 2 and 4 of rows 4 and 5 — dead centre of the figure. Wrist 1 and Wrist 2 are literally
   identical glyphs two cells apart, as CRITIQUE-03 N20 noted and nobody fixed.
3. **The gaps are pure page background.** Nothing — no axis line, no ground plane, no containing
   contour, no tone — says the 23 tiles are one object. The eye reads negative space as *missing
   tiles*, which is exactly the "inventory grid" impression the design set out to escape.
4. **The map is 268 × 360px inside a 302 × 721px panel.** It occupies half the height of the column
   §A1 reserves for the character, with the meter and seven vitals tiles filling the rest. In
   sixtyupgrades the model is full-height and it is the reason the layout reads as a person.

**The empty-vs-filled signal is still invisible, for a fourth consecutive review.** Measured on a
half-filled set: `.figure-cell.on` background `rgb(28,30,33)` against `.figure-cell`
`rgb(16,17,19)` = **1.13:1**. CRITIQUE-02 raised it, CRITIQUE-03 #19 measured 1.14 and asked for
≈2.5:1. `styles.css:1097` is unchanged. The border delta is 1.24:1; the *only* channel that actually
carries "this slot has an item" is the glyph stroke (`#5e666e` → `#8b939c`). An empty set and a
23/23 set produce a near-identical 302×721px panel in the exact centre of the money screen.

**Verdict: no.** It is a competent, well-navigated equipment map — the roving-tabindex composite
widget is good work and the 23-cells/1-tab-stop contract is genuinely better than 46 buttons. But it
is not a character, and it is not carrying the burden the 3D model carries in §A1. Naming the array
`FIGURE_LAYOUT` and writing "the panel reads as a body" in a comment does not make it one.

---

## The tier ramp: a state, not noise — but four bands, not eleven

I set eleven tiers across the doll and looked at both surfaces. **It works.** A column of 23 steppers
running grey → bronze → gold does read as an upgrade state at rest, and it is a real improvement on
the binary CRITIQUE-02 found. It is not noise.

Two measured caveats:

- **Adjacent steps are indistinguishable.** `--tier-7 #d9ad45` → `--tier-8 #dfb23c` is ΔRGB
  (6, 5, −9) at 11px/800 on a dark ground. In the rendered column I can separate roughly four bands:
  grey (0), warm grey (1–2), bronze (3–4), gold (5–10). The token file's "eleven steps" is true of
  the tokens and false of the reader. This is not worth re-engineering — but the top of the ramp
  should be spread, not the bottom.
- **`--tier-0` still fails AA.** `#7a838c` on `--bg-panel-raised` measures **4.34:1** (needs 4.5:1;
  11px/800 is not large text). It is what all 23 chips read on a freshly auto-filled set, which is
  the app's most common state. `tokens.css:33` justifies the value against `--bg-panel`, not against
  the raised surface the chip actually sits on. **CRITIQUE-03 #19, unfixed, fourth review.**
  The paired half *was* fixed: `−` is now genuinely `:disabled` at tier 0. Good.

On the figure, the badge is a worse citizen than on the stepper: a `--bg-page` chip pinned to the
tile's bottom-right corner, breaking the tile's radius and out-shouting the glyph it belongs to. On a
fully-upgraded set the map is 23 black chips with gold numbers and some faint grey line art behind
them. And a tier-0 filled slot renders no badge at all, so "+0 equipped" and "empty" are visually
identical on the map — a second consequence of the 1.13:1 fill delta.

---

## Prioritised findings

Ordered by score impact per unit of work. Recurring items are marked with the review count.

### 1. The centre figure is a grid, not a body — and is the substitute for §A1's 3D model
**RECURRING ×2.** *(measurements above)*

**Fix, in the order that buys the most for the least.**
(a) Give the figure mass: `HEAD` and `CHEST` at 1.5 cells, `PRIMARY`/`SECONDARY` at 1×1.5 vertical,
rings and wrists at 0.75 — a `grid-auto-rows` + explicit spans change to `FIGURE_LAYOUT`, no new
component. (b) Move `SHOULDERS`/`BACK` inboard to columns 2 and 4 so the collar sits *above* the
arms rather than 104px outboard of them, and let rows 4–5 be the narrower rows — then the silhouette
actually widens at the shoulders. (c) Draw one containing contour: a single `--line` stroke or a
`radial-gradient` torso wash behind the grid, so the holes read as body edge rather than as missing
cells. (d) Differentiate `WRIST_1`/`WRIST_2` and `FINGERS_1`/`FINGERS_2` — the client's own inventory
window distinguishes them; four identical ovals at the centre of the figure is the single most
body-destroying detail on the screen.

### 2. Filled and empty tiles differ by 1.13:1 — the map has no resting-state signal
**RECURRING ×3.** *(`styles.css:1095-1097` unchanged since CRITIQUE-02)*

**Fix, one token value.** `.figure-cell.on { background: #2a2e34 }` (≈2.5:1 against `--bg-inset`).
`--bg-active` already holds that value. Add the screenshot-diff assertion CRITIQUE-03 asked for:
empty and filled figure panels must differ by more than N% of pixels.

### 3. `--tier-0` is 4.34:1 on the surface it sits on, on 23 chips of every fresh set
**RECURRING ×2. ONE TOKEN.** Lift `--tier-0` to ≈`#868f99`. Re-measure against
`--bg-panel-raised`, not `--bg-panel`, and fix the comment at `tokens.css:33` that records the wrong
ground.

### 4. An 8px indent step runs down the middle of the 23-row column at every width ≤900px
**NEW — a regression introduced by the CRITIQUE-03 #9 fix. NEAR ONE-LINER.**

Measured at 768: rows 1–12 place the icon at x=33, the name at x=79, the controls ending at x=735.
Rows 13–23 place them at x=41 / x=87 / x=743. Identical at 900 (33 vs 41) and at 430/390 (21 vs 29).
Twenty-three rows in one visual column, split into two groups misaligned by exactly 8px, plus an
extra ~30px vertical break where the two `.doll-col`s meet — so the seam is doubly visible. I
cropped it at 1.6× and it is unmistakable: `HANDS / Indicolite Gauntlets` sits visibly left of
`PRIMARY / Dagas`.

**Root cause.** `styles.css:829-833` gives `.slot-wrap.right` `padding-right: 0; padding-left:
var(--s2)`, correct while it was the right-hand column. The `max-width: 900px` block
(`styles.css:2638`) flips `flex-direction` back to `row` and **never resets the padding**. The
collapse that fixed 768 created this.

**Fix.** Add `padding-right: var(--s2); padding-left: 0;` to `.slot-wrap.right` inside the 900px
block. Add an assertion that all 23 `.slot-icon` left edges are equal at 900, 768, 430 and 390.

### 5. Mobile scroll depth went backwards, for a fourth review
**RECURRING ×4.** Measured first-slot document offsets, notice dismissed:

| width | C-03 | **C-04** | Δ |
|---|---|---|---|
| 1024 | 612 | 612 | 0 |
| 768 | 651 | 650 | −1 |
| 430 | 749 | **899** | **+150** |
| 390 | 862 | **952** | **+90** |

Page height at 390 is **3,518px**, up from CRITIQUE-03's 3,078. At 390×844 the first row a user came
to edit is now **more than a full viewport further down** than it was one review ago. The cause is
the `max-width: 430px` block stacking map / meter / vitals into one column, which takes `.figure` to
620px tall on the narrowest screens. CRITIQUE-03 #16's remedy — collapse the figure to a compact
strip below ~900px — was not taken; the panel instead grew.

**Fix.** Below ~900px replace the 23-cell map with the strip CRITIQUE-03 specified —
`23/23 slots · 716 EP · 57 wt` plus the two or three vitals a phone user actually reads — behind a
`<details>` that opens the full map. That is ~450px of a 3,518px page recovered on the screen where
scroll cost is highest.

### 6. The item window speaks two class vocabularies for one field, two gestures apart
**RECURRING ×3** (CRITIQUE-02 #15 → CRITIQUE-03 #14 → here). *All three prescribed changes untaken.*

Reproduced side by side this session:

- Hover CHEST on the doll → `Class WAR`, `Weight 7.5`, and a `STATS AT +0` block printing
  `Strength +15 · Stamina +15 · Dexterity +15`.
- Click the same class of item in the browser → `Class Monk`, `Weight 0.1`, `Strength +15`.

So one product prints the code and the full name for one field; prints `Weight` where the client
prints `WT:`; and prints `Strength` in a panel floating 200px from a doll row that says `STR +15`
and a headline block six lines above that says `AC +5`. Three vocabularies for stats and two for
classes, inside one 660×430px object.

**Fix, unchanged from CRITIQUE-03 and still ~4 lines.** Delete the `wide ?` branch at
`ItemWindow.tsx:131`; always print codes, sorted by index into `CLASSES`. Route the `STATS AT +N`
block through `shortStatLabel()`. Rename the row to `WT`.

### 7. Delay renders as a signed bonus on both dense list surfaces
**RECURRING ×3** (CRITIQUE-02 #5 half → CRITIQUE-03 #15 → here). *Verified unchanged at
`gear.ts:110-113`, `ItemPicker.tsx:616-619`, `ItemBrowser.tsx:435-438`.*

`statVector` still pushes `DMG` and `DLY` as ordinary entries and both list surfaces format them with
`signed()`. On the items browser I can read `DMG +30 · DLY +45`, `DLY +54`, `DLY +70` down the page —
delay is a **cost**, and the worst delay on the page renders as the biggest positive number in its
row. The doll gets it right (`11/21 dmg/dly`) and the item window computes the ratio, so the app
prints the correct form and the misleading form in the same session.

**Fix.** Emit one synthetic `WEAPON` entry from `statVector` that the list formatters render in the
doll's own form — `25/36 dmg/dly · ratio 0.694` — reusing `summarizeItem`'s weapon branch. Put the
ratio delta on the comparison line in place of the DMG delta.

### 8. Resists render four ways; the client's actual form appears nowhere
**RECURRING ×2.** *(UI-REFERENCE §B1 records `SV Void 126/1000` from a real client screenshot)*

Verified across four surfaces this session:

| surface | form |
|---|---|
| doll rows, picker rows, compare slot deltas | `MR / FR / CR / DR / PR / VR` |
| gear stat sheet, compare stat cards | `Magic / Fire / Cold / Disease / Poison / Void` |
| Weights tab | `Magic Resist … Void Resist` |
| item window | `Void Resist` |

Two of them appear in one frame on the Compare screen (`+2 VR` at the slot table, `Void` in the
RESISTS card). The client's own `SV Magic` / `SV Void` is used on zero surfaces. The Compare screen
adds a fifth naming for the weapon fields — `Primary damage` / `Primary delay` / `Primary ratio` —
where §B says DMG/Dly.

**Fix.** One table keyed off `SAVE_NAMES`, emitting `SV Magic … SV Void` long-form and `MR…VR`
short-form; delete the three ad-hoc spellings in `WeightsEditor`, `StatPanel` and `ItemWindow`. Same
for the weapon fields on Compare.

### 9. The Items screen colours 59% of the catalog against a character it never names
**RECURRING ×4** (CRITIQUE-02 #17 → CRITIQUE-03 #13 → here). *Verified at `ItemBrowser.tsx:152-165`.*

`colorContext` still derives silently from the first set of the active-or-first character. On my
seeded profile the first hundred names render green and red with no legend, no chip and no switcher,
and `document.body.innerText` contains neither `Avenrae` nor `BRD/WAR/BER`. The scoring dropdown
still offers exactly five presets and none of the user's saved sets, which is why this line survives
**verbatim for a third review**:

> *Scored against the Melee DPS preset. Open any row for the full item, or your own set for
> cap-aware scoring.*

Two EP scales in one product and the weaker one is on the page called ITEMS, above a hundred rows
tinted by a character the page refuses to name.

**Fix.** The toolbar chip CRITIQUE-03 specified — `Colouring for Avenrae · 50 BRD/WAR/BER ▾` — with
a one-line green/red legend beside it. Prepend saved sets to the scoring `<select>` and delete the
apology.

### 10. The landing hero advertises a layout the app does not ship and a colour rule its money screen rejects
**RECURRING ×2.** *(CRITIQUE-03 N16, byte-for-byte unfixed — measured, not inferred)*

`.hero-art` still renders the **old `figure-grid` flex block**: rows of 5/5/5/5/3 at extents
256/256/256/256/152 — not the anatomical `figure-body` the product ships. Its 23 glyphs render
**18 green, 4 neutral, 1 red**, directly above a caption that now reads *"Browsing items, green is
what this trio can equip and red is what it cannot."* So the front door of the product illustrates
an item-browser rule with a picture of a paper doll, in a layout the paper doll no longer uses, and
the shipped paper doll **deliberately does not colour names that way** (`styles.css:760-779`, a
documented and correct decision). The one legend in the app teaches a rule the money screen
contradicts.

**Fix.** Point `.hero-art` at the same `FIGURE_LAYOUT` the product uses, and illustrate the legend
with a two-row item-browser fragment.

### 11. Exaltations is 900–1,060px of dead space per row, 91 rows deep, and still prints one fact 24 times
**RECURRING ×3.** *(CRITIQUE-03 #18's prescribed fix untaken in every part)*

Measured at 1600 with tiers set — item name ends at x≈306, the stepper does not begin until x=1204.
**~900px of empty row, 23 times.** Each socket row is worse: `Focus Exaltation [154..306]`, then a
**1,061px-wide element containing a single em-dash**, then `Add [1391..1446]` — 68 of those. Page
height 5,021px.

At all +0 the page is 1,489px — CRITIQUE-03 measured 1,488 — with 23 identical rows, no empty-state
card, and `first socket at +N` printed on **all 23 rows plus once in the header: 24 appearances of
one fact**, exactly the count CRITIQUE-03 recorded. There is still no bulk "Set all to +N" anywhere
in the product, so the only way to make this tab do anything is 23 separate stepper interactions.

**Fix (unchanged).** `grid-template-columns: 120px 1fr auto` on `.exalt-row` and `.socket` so rows
read name → state → control with the controls anchored around x=640. Delete the per-row note. Replace
the 23 rows with one empty-state card when no sockets are open. Add "Set all to +N" to `⋯`.

### 12. Ragged card rows on three screens — numerically identical to CRITIQUE-03
*(CRITIQUE-03 N1, "the first thing to pick up after the line". It was not picked up.)*

Measured at 1600, gear stat sheet, all four cards top-aligned at y=976:

| card | height | bottom |
|---|---|---|
| WEAPONS | 91 | 1067 |
| REGEN | 128 | 1104 |
| STATS | 146 | **1122** |
| RESISTS | 118 | 1094 |

**55px of variance across one row.** Second row: HEROIC MODS 174, SPELL MODS **91**, SKILL DAMAGE
174 — **83 × 439px of empty card in SPELL MODS**, the exact figure CRITIQUE-03 printed. At 1024
RESISTS drops alone onto row 2 at 320px in a 976px track, leaving a **656 × 118px void**. Compare
reproduces the same shape with REGEN and WEAPONS occupying 2 of 3 columns.

**Fix.** Apply the Weights tab's own treatment — it is the one screen in the app that literally
executes §A6's "thin vertical rules between stat columns" and it is clean. Either equalise card
heights within a row (`align-items: stretch` plus an internal spacer) or flow the groups as a
masonry/`column-count` so short groups do not strand a row.

### 13. The vitals tile grid strands an odd tile at every width, and jumps 5+2 at 1024
*(CRITIQUE-03 #16's second half, untaken)*

Seven tiles, measured:

| width | layout | stranded tile |
|---|---|---|
| 1600 / 1280 | 3 rows × 2 @ 133×67 | `EQUIPPED WT` at 266px, 2× the others |
| 1024 | **5 @ 131×158, then 2 @ 330×158** | two tiles 2.5× the width of the five above |
| 768 | 3 rows × 3 @ 134×105 | `EQUIPPED WT` at 404px, 3× |
| 390 | 3 rows × 2 @ 166×… | `EQUIPPED WT` full-width |

The same seven tiles also change height by 2.4× (67 → 158) between 1280 and 1024 while the numeral
stays 20px, so the tile's ink-to-area ratio collapses at exactly the width where space is tightest.

**Fix.** `repeat(auto-fit, minmax(140px, 1fr))` with a fixed tile height, as CRITIQUE-03 asked. Seven
is a bad count for a 2-column grid; either promote `EQUIPPED WT` out of the grid onto the meter row
(where `57 wt` used to live) or add the client's `Velocity` line from §B3 to make it eight.

### 14. Four icon systems in the action bar, one a full-colour emoji in a second blue
**RECURRING ×2.** *(CRITIQUE-03 N2)* Cropped at 2.4× and looked at: `🔗 SHARE` renders as a
saturated light-blue chain emoji that is **not** `--accent`, and it is the only coloured object in a
row of `--text-dim` grey. Beside it `✦` (thin, riding above cap height), `⚙` (a small optically-light
dingbat) and `⋯` (sitting on the baseline rather than at mid-height). Four systems, four optical
weights, three baselines, in a 500px strip on the money screen — now the most conspicuous
inconsistency there precisely because everything around it was cleaned up.

Worse in the same strip: `50 BRD/WAR/BER` is a `<summary class="btn btn-quiet btn-sm">` styled
identically to the three action verbs, with **no chevron**, so the one control in the row that opens
a menu is the one that looks like a static label — and it duplicates the header sub-line 1,000px to
its left, verbatim, in the same viewport.

**Fix.** Four 14px line icons in the slot set's `stroke-width: 1.5 / currentColor` idiom. Give the
loadout switcher a `▾` and move it left of the vertical rule, beside the identity it names.

### 15. The item window stops one CSS rule short of being an EverQuest artefact
*(CRITIQUE-03 N18, unfixed)* It remains the best-designed object in the product and I want that on
the record. But computed `border-radius: 3px` with a symmetric `inset 0 0 0 1px` highlight is a
web-card outline; a bevel is two-tone by definition. And `Class ALL` / `Race ALL` / `Size GIANT`
still fly flush-right across ~400px of nothing.

**Fix.** `border-radius: 0` plus `inset 1px 1px 0 #4a4440, inset -1px -1px 0 #1a1715`; a fixed 120px
right column for requirement values.

### 16. Raw era keys still leak into three surfaces
*(CRITIQUE-03 N19, unfixed)* Enumerated from the live `<select>`: `Classic, Fear, Hate, Paineel,
Temple, Sky, Kunark, Epic Quests, Nov 2000, FearHateRevamp, Velious, Chardok Revamp`. A date and an
unspaced camelCase key sit among place names, and a reader cannot tell whether Fear, Hate and
FearHateRevamp are three eras or one spelled three ways. One lookup table next to `eraLabel()`, with
the patch-style entries in an `optgroup`.

### 17. At 1024–1080 the mirrored columns survive after the character they framed has moved away
*(new observation)* `.doll` becomes `1fr 1fr` and `.doll-center` moves to `order: -1`, but
`.slot.right` stays mirrored until 900px. Measured at 1024: left column right edge 504, right column
left edge 520 — **a 16px gutter** where two right-aligned item names and two clusters of
`− +N + ✕` controls meet with nothing between them. §A1's mirroring exists to frame a model; with the
model hoisted to the top, the right column is right-aligned against a seam. Move the `.slot.right`
un-mirroring from 900px to 1080px so it travels with the figure, not with the collapse.

### 18. Large dead zones on three secondary screens
*(new, measured at 1600×1000)* The Weights tab's content ends at y=790 with ~700px of empty page
below, and inside its card the CASTING column holds one field beneath a 290px void while ATTRIBUTES
holds seven — roughly 40% of a 1,690×400px card is empty. The character page ends at y=750 with
~1,250px below it. The landing's "EVERY ITEM, IN THE WINDOW YOU ALREADY KNOW" panel is 1,685×390
with a 470px window on the left and two lines of prose on the right, leaving ~1,100×270px of empty
panel. Balance the weights grid by field count rather than by category, and give the landing panel
either a second window state (+0 vs +10, which is the actual story) or less height.

### 19. Smaller residue, each verified this session
`SHADOW KNIGHT SHD` is still the only two-line label on the character page, so its input sits 18px
below the other seven in its row; sixteen class-level inputs still show for a three-class character.
`updateCharacter` still has **zero callers** — name and race remain unchangeable after creation
(N3). The picker still leaves 635–722px between the item name and its EP score on every row, and the
score still sits 15px below the name's top rather than on its baseline — though the *variance* half
of N14 is genuinely fixed, the offset is now a constant 15px across 73px and 91px rows. The picker's
last visible row is still cut behind the `CLEAR SLOT / CANCEL` footer with no mask and no sticky
opaque band (N15). At 390 the items table's SLOT column is cut mid-word (`WAI`, `PRIM`, `BAC`) with
no edge affordance saying it scrolls. `Weapon Damage` wraps to two lines in the Weights COMBAT
column, breaking that column's row rhythm. The character name renders `Avenrae` at 30px normal-case
on the set page and `AVENRAE` at 30px uppercase on the character page.

---

## Regressions against CRITIQUE-03

1. **The 8px column seam** (#4 above) is new and was caused by the #9 fix. It affects every width
   from 360 to 900 — i.e. every phone and every tablet — on the app's primary column.
2. **Scroll depth at 390 and 430 got worse** (#5): +90px and +150px, with the page 440px taller.
   The fourth consecutive review of this finding, and the first one where the number moved backwards.
3. **Exaltations grew from 1,489px to 5,021px** once tiers are set, because the socket rows landed
   without the row geometry #18 asked for. The feature is right; the layout it landed into was
   already the flagged one.

## Recurring-unfixed, called out as such

| Finding | First raised | Reviews unfixed | Status |
|---|---|---|---|
| Items screen names no colouring context; apology line verbatim | C-02 #17 | **4** | untouched |
| Figure filled-vs-empty delta 1.13:1 | C-02 | **3** | untouched |
| `--tier-0` 4.34:1 | C-03 #19 | 2 | untouched |
| Item window: `wide ?` branch, `Weight` not `WT`, long stat names | C-02 #15 | **3** | untouched |
| `DLY` signed on both list surfaces | C-02 #5 | **3** | untouched |
| Resists in four spellings; `SV` form used nowhere | C-03 #20 | 2 | untouched |
| Exaltations row geometry; one fact 24× | C-02 #19 | **3** | untouched |
| Ragged card rows (55px / 83×439px) | C-02 #19 | **3** | numerically identical |
| Four icon systems in the action bar | C-03 N2 | 2 | untouched |
| Landing hero layout + legend mismatch | C-03 N16 | 2 | untouched, measured |
| Raw era keys | C-03 N19 | 2 | untouched |
| No `(pointer: coarse)` query anywhere | C-02 #16 | **3** | still zero occurrences |
| Zero `aria-live` in `src/**/*.tsx` | C-02 #20 | **3** | still zero |

Nine of these thirteen are one-file, sub-thirty-line changes. A review cycle that re-derives the same
list four times is itself the finding.

---

## What genuinely works

Recorded so it does not get refactored away, and because several items here are new since
CRITIQUE-03.

**The type system is real and now holds on every route.** I swept computed styles on the landing,
items, characters, new-character and gear screens: **six sizes (10/11/13/15/20/30) and exactly three
weights (400/600/800)**, zero off-token values, on all five. CRITIQUE-03 F5's fourth UA-default 700
on `table.data th` and `.feature h3` is **gone**. That is a clean, learnable hierarchy and it is one
of the few things in this app that would survive a side-by-side with §A6.

**Colour discipline holds.** Azure has its five §A6 jobs and no more. Slot glyphs are one neutral
grey. `--at-cap` has its own teal so amber means only era and the top of the tier ramp. The decision
to re-point `--item-usable` at `--text-strong` on the doll and in pickers — spending colour on the
tier ramp instead of on 23 identical green names — is correct, well-argued in the source, and
visibly the right call.

**The item window is the best object in the product and it does look like EverQuest.** Red gradient
title bar, warm stone body, green numerics, cyan group headers, gold weight, a coloured usability
verdict, and the SOURCE line a raid-night reader needs. One implementation bound to doll hover,
picker hover and browser click. Put it beside a client screenshot and it belongs there.

**Client fidelity where it is hard.** `50 BRD/WAR/BER · HEF` is exactly §B2. Caps render natively —
`123/510`, `31/1000` — which is simultaneously authentic and a feature sixtyupgrades users complain
it lacks. Stat groups run the client's own order with Void present as the genuine sixth resist. The
vitals now use the client's short forms (`END`, `AC`, `ATK SPEED`, `EQUIPPED WT`), which closed
CRITIQUE-03 #10 properly rather than by wrapping mid-word.

**Six named CRITIQUE-03 must-fixes are genuinely closed and I verified each in the browser.**
#3 — the Auto-fill notice is now `position: fixed` bottom-right, 420px, 6s auto-dismiss, held on
hover, accent left rule, ✕ adjacent to the text: exactly as prescribed, page no longer shifts.
#4 — the Compare KPI now reads `-120.7 / 1091.4 → 970.7` on one scale, and the banner says
"cap-aware against the rest of each set" truthfully. #6 — `outline-offset: -2px` on
`.stat-group > summary`, ring visible. #9 — the doll collapses at 900px; **at 768 there is no
truncation anywhere**, the exact win CRITIQUE-03 predicted. #2 — the item browser now has a real
`<button>` in the first cell, `scope="col"` on all six `<th>` and a filter-aware `<caption>`.
N9 — **zero horizontal page scroll at 320, 360, 390, 430, 768, 900, 1024, 1280 and 1600.**

**Zero console errors and zero page errors across forty-five full-page captures**, five viewport
widths, nine routes, two set states and four live interaction flows. No `NaN`, no `undefined`, no
`[object Object]` on any screen. `npm run build` is clean.

**The Weights tab is the cleanest layout in the app** and the one place §A6's "thin vertical rules
between stat columns" is literally executed. It is the template the stat sheet and Compare should be
refactored toward.

**The doll rows read exactly right**: bright name → mid label → dim stats, uniform 52px rows, both
columns equal at every width, two-line clamping that breaks at spaces so no numeral is ever cut. The
Any Slot rows are marked by one word rather than by amber, which was the right call and still is.

---

## To move visual and authenticity to 9

Findings 1–4 and 6–8 are the whole gap. Two of them are single token values, one is a single CSS
declaration, and three are one-file vocabulary changes that CRITIQUE-02 and CRITIQUE-03 both spelled
out line by line. Only #1 is real design work — and it is the one that decides whether this is a
character sheet or a competent dashboard with a grid where the character should be.
