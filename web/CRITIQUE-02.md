# CRITIQUE-02 — Reconciled punch list

Four independent reviewers scored the build against sixtyupgrades.com. This document merges their
findings into one ordered work list, resolves their contradictions, and separates the work that
moves the score from the work that does not.

---

## Scores

| Lens | Score |
|---|---|
| Visual / craft | **6.5** |
| IA & function | **7.0** |
| Feel & accessibility | **7.0** |
| Authenticity & bugs | **7.0** |
| **Mean** | **6.875** |

Target is 9.0. The four reviewers agree on the shape of the gap even where they disagree on the
detail: **the product is functionally sound and structurally fixed, and is now being held back by
(a) three named features that were specified and never built, (b) a visual system with no
typographic or colour discipline, and (c) a performance and accessibility layer that is fine
unthrottled and falls apart under load.** Robustness scored 9 — nothing below is a stability defect.

CRITIQUE-01 scored 4.5. Eighteen of its twenty-five findings are genuinely closed, and every P0 is
closed. The remaining distance is not a repeat of that review.

---

## How this list is ordered

By **score impact per unit of work**, not by how loudly a reviewer wrote it. Four things push an
item up:

1. It was found by more than one lens (real, not a lens artefact).
2. It breaks a stated non-negotiable — DESIGN.md §1 ("speed is the brand", "authenticity is trust")
   or an explicit "Mirror this" in UI-REFERENCE.
3. It is cheap. Six of the top twenty are one-line or three-line changes; they are ranked above
   larger work of similar severity because they buy score immediately.
4. It fails on a real user's machine, not just on a fast reviewer's.

---

## MUST FIX — required to reach 9/10

### 1. The right-hand doll column crushes item names to 34px below 720px
**Critical.** Raised by: authenticity (alone).

At 390px every `.slot-wrap.right` row gives `.slot-body` **34px** while the mirrored left row gives
it **166px**, with 174px of the row left empty. 14 of 23 names render as `Dj…`, `Im…`, `Bl…`;
12 of 23 at 430px; 7 of 23 at 768px.

Root cause, verified in source: `web/src/styles.css:2193-2195` sets
`.slot.right { grid-template-columns: 34px 1fr }` and `.slot.right .slot-icon { order: 0 }`, but
`.slot-body` precedes `.slot-icon` in source order (`SlotCard.tsx`), so with equal `order` values the
body lands in the 34px track and the icon takes the `1fr`.

**Fix:** `order: -1` on `.slot.right .slot-icon`. One character.

**Why it is first:** it is the cheapest critical in the list, and the *only* reason three reviewers
declared responsive behaviour clean is that they all tested `scrollWidth === clientWidth`. The layout
clips instead of overflowing, so the standing check cannot see it. Add an assertion that no
`.slot-item` has `scrollWidth > clientWidth + 1` at 390/430/768 — that class of bug has now shipped
twice (CRITIQUE-01 #1 was the same missing-`min-width:0` family).

---

### 2. Reaching Cancel in the picker costs 157 Tab presses
**Critical.** Raised by: feel-a11y.

All 150 result rows are plain `<button role="option">` with no `tabIndex`, so every one is a tab
stop (`web/src/components/ItemPicker.tsx:368`). Measured with real key events: 157 Tabs from the
search box to Cancel on Primary, 58 on Ear 1. Shift-Tab walks back up through options rather than to
the filters, so overshooting strands the user mid-list.

This is pure surplus. The component *already* implements the correct composite-widget contract —
`role="combobox"`, `aria-controls`, `aria-activedescendant`, `aria-selected`, arrow keys, Home/End,
Enter — and the ARIA listbox pattern requires options to be `tabindex="-1"` precisely so the widget
is one tab stop.

**Fix:** add `tabIndex={-1}` to the result `<button>`. Nothing else changes; Tab then reaches
Zone → Era → Source → 2 checkboxes → Clear slot → Cancel in 7 presses.

---

### 3. The picker blocks the main thread for 263–663ms, and Auto-fill freezes for 2.6s with no busy state
**Critical.** Raised by: feel-a11y (measured), corroborated by visual and authenticity's own note
that ~1,400 of ~1,500 built nodes are never seen.

DESIGN.md §1 makes speed the brand: *"Every piece of praise it receives mentions smoothness."*
Unthrottled the build hits that bar (equip 40ms, stepper 24ms, tab switch 24ms). Under CPU
throttling it does not:

| Interaction | 4× CPU | Longest block |
|---|---|---|
| Open Primary picker | 1,482ms | 663ms |
| Toggle "Live content only" | 1,143ms | 396ms |
| Change era filter | 895ms | 263ms |
| Auto-fill 23 slots | 2,629ms | 663ms (16 long tasks) |

`RENDER_LIMIT = 150` but the results viewport is 682px — about 9 rows. During the 2.6s Auto-fill
freeze the button reports `disabled:false`, `aria-busy:null` and unchanged text: nothing on screen
says work is happening, on the app's marquee button.

**Fix, in payoff order:** (a) virtualise `.results`; (b) wrap `setLiveOnly`/`setEra`/`setSource`/
`setPreview` in `startTransition` so the re-rank is interruptible; (c) give Auto-fill a real pending
state (`disabled` + `aria-busy="true"` + label change) and chunk the assignment across rAF.

---

### 4. Four of twenty-three pickers silently truncate at 150 items — including both Any Slots and both weapon hands
**Critical.** Raised by: ia-function (critical), authenticity (minor), feel-a11y (as the perf cause).

PRIMARY shows 150 of 418, SECONDARY 150 of 371, ANY SLOT 1 and 2 each 150 of **1,840**. No
pagination, no load-more, no virtualisation. Because the list is EP-ranked, changing your weights
changes *which* 150 you can see — an item reachable under Tank weights vanishes under Melee DPS with
no message. NECK at 148 is two items from joining them.

This is CRITIQUE-01 #12 surviving in the four slots where the candidate pool is largest, one of which
(Any Slot) is the app's own headline EQL differentiator. The item browser got a proper fix — 59
pages, jump-to-page — so two lists over the same data now behave differently.

**Fix:** virtualise, which resolves this *and* finding 3 with one change. See the disagreement note
below: pagination alone would fix reachability but leave the 150-node build cost in place.

---

### 5. Four client-vocabulary breaks, all one-line, all contradicted by Tier 0 evidence
**Critical.** Raised by: authenticity. Verified against `research/validation/`.

- **`DELA`.** `shortStatLabel()` at `web/src/selectors/gear.ts:70-72` is
  `SHORT_LABELS[key] ?? statLabel(key).slice(0, 4).toUpperCase()`. `DLY` is absent from
  `SHORT_LABELS` (verified), `statLabel('DLY')` returns `'Delay'` (gear.ts:42), so every weapon row
  in the picker and browser prints **`DELA +21`** — a fake word. The same component's item window
  hardcodes the correct `DLY`, so the app prints both for one field, sometimes in one viewport.
  Delay is also rendered as a signed *bonus*, so a 44-delay club reads as an upgrade over a 21-delay
  dagger. The same fallback will emit `DRAG`, `FLYI`, `ROUN`, `TIGE`, `EAGL`, `FREN`, `RATI` the
  moment any item grants a skill-damage key.
- **`FINGERS: 'Ring'`** at `web/src/engine/constants.ts:64`, inside a file whose header claims
  validation against a live `/outputfile inventory`. TIER0-VALIDATION §3 records the client's own
  vocabulary as **`Fingers ×2`**. The item window and the browser filter both say `FINGERS`; only the
  doll and picker say `Ring`, so all three surfaces are on screen disagreeing at once.
- **`ATTRIBUTES = ['STR','STA','AGI','DEX','WIS','INT','CHA']`** at `constants.ts:92`.
  UI-REFERENCE §B3 records the client order as **STR, STA, INT, WIS, AGI, DEX, CHA**. Everything
  else in the stat sheet is faithful digit-for-digit, which makes this read as an oversight.
- **A forward-version payload is silently wiped.** `persistence.ts` treats
  `storedVersion !== STATE_VERSION` as "migrate", with no guard for `version > STATE_VERSION`, so a
  v9999 payload is normalised to an empty library and written back. Every *corrupt* payload is
  handled beautifully — banner shown, original bytes preserved — and only the future-version case
  both wipes and stays silent. Reachable by anyone with two tabs open across a deploy.

**Fix:** add `DLY: 'DLY'` and explicit short labels for every `SKILL_DAMAGE_MODS` key, then **delete
the `.slice(0,4)` fallback and return the raw key** — a visibly wrong key beats a plausible fake
word. `FINGERS: 'Fingers'`. Reorder `ATTRIBUTES`. Treat `version > STATE_VERSION` as set-aside, not
as migrate. On weapon rows print `11/21 dmg/dly` as the doll already does, plus the ratio.

---

### 6. Set-vs-set diff — DESIGN.md's own named leapfrog — is still entirely absent
**Critical.** Raised by: ia-function (5), authenticity (4). CRITIQUE-01 #20, unchanged.

`src/router.ts:21` defines `SET_TABS = ['gear','exaltations','weights']` with no compare branch, so
DESIGN.md §3's declared URL `/set/{id}/compare/{id2}` is unimplemented; the only `compare` identifier
in the codebase is a sort comparator. With two sets in the library a DOM sweep for
`compar|diff|versus` returns nothing. The `⋯` menu offers Duplicate / Clear all slots / Delete.

DESIGN.md §4 P1 #11 annotates this **"an opportunity to leapfrog"**, and §4's gripe list names
*"Explicit diff view — theirs makes you open two tabs"* as one of only three things this product
exists to fix. Shipping without it forfeits a free win and leaves the user worse off than
sixtyupgrades' own workaround, because switching sets replaces the page — there is no second tab
affordance either, so the comparison happens from memory across ~40 numbers.

**Fix:** implement the declared route, reached from the `⋯` menu (`Compare with…`) and the switcher.
Render slot lists side by side with a centre delta column, and diff the stat groups the panel
already computes: signed deltas on the KPI tiles and on STATS/RESISTS with cap headroom shown, so the
diff inherits the cap-awareness that is already the app's best original idea. The engine computes
per-slot EP and a full stat vector already — this is a selector plus a view, not new math.

---

### 7. `+ New set` creates "Set 2" instantly — §A4's explicitly-flagged lesson is not mirrored
**Critical.** Raised by: ia-function (5), authenticity (3), visual (regression). CRITIQUE-01 #19.

UI-REFERENCE §A4 documents the reference flow — `BASIC DETAILS → EQUIVALENCY POINTS → DEFAULT
FILTERS → Create` — and states the lesson in bold: *"stat weights and filters are configured at set
creation, making every set carry its own scoring lens. **Mirror this.**"*

As shipped, `+ New set` navigates straight to a set named `Set 2` with default `balanced` weights and
no dialog. The only set-level dialog is `⚙ EDIT`, which holds exactly two fields: SET NAME and NOTES.
Default filters do not exist at all — every picker re-derives filter state from scratch. So the
moment that defines a set's scoring lens is the one moment the user is never asked about, and a new
user's first Auto-fill runs against a profile they were never shown.

The Weights tab itself is a genuine improvement (packed cards, preset dropdown with descriptions) and
is a defensible home for the editor — but it is a *third tab discovered afterwards*, not a creation
step.

**Fix:** put a create dialog behind `+ New set` with the three §A4 sections — name; weights seeded
from the five existing presets in `ep.ts` (using their `description` strings as help text) with an
expandable custom editor; and a DEFAULT FILTERS grid (era, source, hide No Drop) that the per-slot
pickers inherit as their starting state. Reuse the same dialog for `⚙ EDIT` so there is one
set-configuration surface, not a creation path with no options and an edit path with two fields.

---

### 8. The colour system carries three collisions, and the accent is spent as decoration
**Critical.** Raised by: visual (two criticals, 5 + 4, plus a major on amber).

This is where the 6.5 lives. Four separate problems in one system:

- **The accent is decoration, not signal.** 21 of 23 slot glyphs in `SlotGlyph.tsx` contain a
  `.glyph-accent` stroked with `var(--accent)`. On the filled gear tab: **48 azure SVG strokes
  against 5 azure text elements** — a 10:1 decoration-to-signal ratio for the one colour §A6 reserves
  for *"primary buttons, active tabs, and selection rings."* It also fights the signal it sits
  inside: the Hands glyph is a mostly-blue palm with a thin green outline, so an item you *can* equip
  renders predominantly blue.
- **Green and red each carry two meanings, 30px apart.** `--item-usable` and `--gain` are the same
  value; `--item-blocked` and `--loss` are the same value. One picker row therefore shows a green
  item name (= you can equip this), a green `+6 WIS` delta (= better than worn), a red `-29 HP`
  delta (= worse), and a red `-0.8 vs worn` verdict — while the same red on the item browser means
  "you cannot equip this at all." One hue, two semantics, in 60px.
- **Amber means three things** and is the most repeated accent on two screens. `--item-caution`,
  `--at-cap`, `--warn` and the era token all resolve to `#d9a441`. It marks era badges (`CLASSIC` on
  10 of 12 picker rows — the *majority* value rendered as a loud outlined badge, the exact mistake
  `ERA UNKNOWN` used to make), both Any Slot rows (solid amber border plus warm wash, making the two
  least-important slots the visually heaviest rows on the tab), the `FLEX` badge at 8.5px, at-cap
  values, and the fourth-class refusal flash. §A6 gives amber one job: phase/era labels.
- **The class-picker selection ring is amber**, where §A5 describes a glowing blue ring — and the
  class code inside the ring is blue, so one control uses both accents backwards.

**Fix:** delete `.glyph-accent` entirely; make every glyph a single stroke inheriting `currentColor`
so the usability tint is the only thing colouring it, and use stroke-width or opacity for internal
contrast. Reserve `#3b9fe8` for the tab underline, focus ring, primary pills, class-picker ring and
fill meter — nothing else. Move the delta line off green/red onto a cool/warm pair or onto ▲/▼ with
the existing greys. Grey the era badge when it equals the modal era of the result set and reserve
amber outline for notable eras; give at-cap its own colour; restyle the Any Slot rows to match their
siblings.

---

### 9. On the money screen the usability colour is a constant, so it carries zero information
**Major.** Raised by: visual (3), authenticity (2). Merged — they propose complementary halves.

A computed-style audit of a fully auto-filled doll: **23 of 23** `.slot-item` names are
`rgb(78,192,106)`; all 46 slot tiles carry a green border and wash; 92 of 140 SVG strokes are green.
This is logically inevitable — auto-fill and the pickers only ever offer equippable items, so on the
two screens a planner lives in, green can only take one value. A constant is not a signal; it is a
full-screen tint. CRITIQUE-01 #3 measured 22/23 identical grey; the wall is now green.

(The Items browser is genuinely two-colour — 41 green / 59 red of 100 — which is where the system
earns its keep. Keep it there.)

**Fix, both halves:**
- *Invert the marked state,* the way the client does: render usable names in `--text-strong` and
  reserve `#d5504a` for the exception, so the doll is calm and an unusable item is the only thing
  that shouts. Tint the **name**, not the glyph, tile border and tile wash.
- *Give the doll a second channel that actually varies:* tint the `+N` chip by tier (grey at +0
  through gold at +10), so the app's headline differentiator is visible at rest across 23 rows.
  This also closes CRITIQUE-01 #14's unresolved half.

---

### 10. The centre figure is a second, information-poorer copy of the two item columns
**Major.** Raised by: visual (critical, 4), ia-function (3), feel-a11y (2). Three lenses, one object.

`querySelectorAll('button[aria-label*="Change item"]')` returns **46** on a filled set — 23 column
rows and 23 figure cells, carrying **byte-identical accessible names**
(`"Ear 1: Black Sapphire Electrum Earring. Change item."` at tab stop 19 and again at stop 55).
Confirmed in `CharacterFigure.tsx:80-84` vs `SlotCard.tsx:109-111`. A keyboard user pays 23 surplus
stops crossing the middle of the doll (110 stops total on the gear page); a screen-reader user hears
the whole set announced twice with nothing to distinguish the copies. The figure's entire unique
payload is a `+N` badge the row's stepper already shows and a usability tint that is constant
(finding 9).

Separately, as a *picture*: it is a 268×256px rectangle of 23 identical 46px tiles laid out 5/5/5/5/3
with the last three centred so the shape dangles. It has no anatomy, no left/right symmetry and no
labels, and it is redundant with the `23/23 slots` meter directly beneath it.

**Fix:** decide which surface owns interaction — make the figure a *summary*. Set the cells
`tabIndex={-1}` and make the grid one composite widget with arrow-key navigation and a single tab
stop (it is already a CSS grid), keeping click and hover. Then arrange the 23 tiles as a body:
head/face/ears cluster on top, shoulders-arms-hands flanking a chest/legs/feet spine, weapons at the
bottom, rings and wrists paired left and right, the two Any Slots offset. That is what makes §A1 read
as a character rather than a form, and it costs a grid template.

*Scope note: a full-height 3D model is an explicit non-goal in DESIGN.md §4. The anatomical
arrangement is the in-scope version of §A1 and the one to build.*

---

### 11. Every text input, search box and checkbox has a 1.24:1 focus indicator
**Major.** Raised by: feel-a11y. Verified in source.

`web/src/styles.css:402-407` — `input:focus, select:focus, textarea:focus { border-color:
var(--accent-dim); outline: none; box-shadow: 0 0 0 2px var(--accent-ghost) }` — and
`--accent-ghost` is `rgba(59,159,232,0.14)` (verified, `tokens.css:31`). Over `--panel` that resolves
to roughly `#1B2A36`: **1.24:1**, against WCAG 2.2 SC 2.4.13's 3:1.

The good ring exists — `tokens.css:114`, `:where(button, a, input, select, [tabindex]):focus-visible
{ box-shadow: var(--focus-ring) }` at solid `#3b9fe8` — but `:where()` contributes zero specificity,
so `input:focus` at (0,1,1) beats it at (0,1,0). Inputs are the only controls in the app that lose
the solid ring. For the two 13×13px picker checkboxes there is no border to fall back on, so those
tab stops have **no visible focus at all**.

**Fix:** change the rule to `input:focus-visible, select:focus-visible, textarea:focus-visible` and
drop the ghost shadow so `tokens.css` applies. Give the checkboxes `accent-color: var(--accent)` plus
an explicit `outline: 2px solid var(--accent); outline-offset: 2px` on `:focus-visible`.

---

### 12. `<tr role="button" aria-label>` destroys the item browser's table semantics
**Major.** Raised by: feel-a11y. Verified at `web/src/screens/ItemBrowser.tsx:345-352`.

Each data row is `<tr className="rowlink" tabIndex={0} role="button" aria-label={`Open ${item.n}`}>`.
`role="button"` removes the element from the table's row structure, orphaning the six `<td>`s, and
`aria-label` on a `role="button"` *replaces* its contents as the accessible name. A screen reader
announces `"Open Aldryn, Blade of the Ocean, button"` and the SLOT, CLASSES, STATS, ERA and EP
columns — the entire reason the browser exists — are never spoken. None of the six `<th>` elements
carries `scope` (all null, verified) and there is no `<caption>`.

Keyboard behaviour itself is correct: Enter opens the dialog, Escape restores focus to the row.

**Fix:** drop `role="button"` and `aria-label` from the `<tr>`, keep `tabIndex={0}` and the handlers,
and put the activation affordance in the first cell as a real `<button>` supplying the accessible
name. Add `scope="col"` to every `<th>` and a visually-hidden `<caption>`.

---

### 13. Clicking Auto-fill shifts the button 68px out from under the cursor, and the toast never clears
**Major.** Raised by: feel-a11y (3), visual (regression), ia-function. CRITIQUE-01 #25, half fixed.

The comment at `web/src/screens/SetEditor.tsx:110` reads *"The notice used to have no dismiss and
shifted the whole page down 60px until you navigated away."* Only the first half was fixed. The
notice is still an in-flow `<div class="notice">` rendered **above the header** (verified,
SetEditor.tsx:112-124). Measured: clicking Auto-fill moves `.set-header` from y=140 to y=208, and
`elementFromPoint` at the original cursor position afterwards returns `HEADER.set-header` — the
pointer is now over the character name. Dismissing jerks everything back up 68px. Still present and
unchanged after 6.9s.

This compounds finding 3: at 4× CPU the click is followed by 2.6s of frozen UI with no busy state,
so clicking again is the natural reaction — and the second click lands on nothing.

**Fix:** take the notice out of flow — a fixed-position toast in a corner, or a 0-height container
below the tab row that expands in place. Auto-dismiss at ~6s, keep the ✕. Nothing above the fold
should move because of a button in the tab row.

---

### 14. There is no typographic system: 11 rendered sizes, 5 weights, and 78% of text in the two dimmest greys
**Major.** Raised by: visual (two majors, 3 + 3), feel-a11y (contrast, 1). Merged — one system.

- **The declared scale is fiction.** `tokens.css` declares a clean 7-step scale
  (10/11/13/15/20/30/44); `styles.css` then hard-codes `font-size` 30 more times outside it —
  `8.5px ×2, 10.5px, 11.5px ×2, 12.5px ×8, 14px ×3, 17px, 24px`. The gear tab renders at
  8.5/10/11/11.5/12/12.5/13/14/15/20/24px, and the two most-used sizes are **11px (89 nodes) and
  12.5px (90 nodes)** — neither is a token. Five weights (300/400/600/700/800) on one screen. No two
  "body" texts are the same size, so the hierarchy cannot be learned.
- **The page is murky.** Colour histogram of the 302 visible leaf text nodes on the filled gear tab:
  `#8b939c` 123 (41%), `#5e666e` 112 (37%), `#cfd4da` 27, `#4ec06a` 24, `#f0f3f6` 9, `#3b9fe8` 5,
  `#d9a441` 2. Only 12% uses either bright token.
- **The slot labels fail AA.** `EAR 1` / `HEAD` / `PRIMARY` — the thing that tells you which row you
  are reading — is 10px/700 `#5e666e` on `#161719`: **3.08:1**, 23 times per screen. The stat line
  beneath it is *brighter* (5.77:1) than the label that identifies it. Five other `--faint`
  text uses fail similarly (stepper `−` 3.24:1, `dmg/dly · ratio` 3.08:1, toast ✕ 3.08:1, footer
  3.33:1).

**Fix:** delete every literal `font-size` in `styles.css` and use tokens. Collapse 11.5/12/12.5 into
one secondary size; kill 8.5px and 10.5px outright. Cap weights at three (400 body, 600 emphasis,
800 numerics). Raise `--faint` from `#5e666e` to about `#7a838c` (≈4.6:1) and promote `.slot-name` to
`--text-dim` at 11px. Then fix the information order per row: item name bright → slot label mid →
stat line dim. Audit remaining `--text-faint` uses — 3:1 belongs on rules and disabled glyphs, not
words.

---

### 15. The item window stops just short of §B5, and contradicts itself
**Major.** Raised by: visual (2), authenticity (3). Both call it the best thing in the app.

Everything structural is right — red gradient title bar with the name in white, warm stone body,
green numerics, cyan group headers, gold weight, a coloured `USABLE BY THIS LOADOUT` verdict, the
SOURCE line, and one implementation bound to hover on the doll, the picker and the browser. Two gaps
keep it from reading as a game artefact:

- **Chrome.** It renders inside a 4px-radius card with a flat 1px border and 13px system-ui. The
  bevel is the single most identifiable piece of EQ window chrome and it is absent, so at a glance
  the panel reads as a web card with a red header. The requirements table is also loose for a 330px
  panel — `Class` at the left edge, `ALL` at the right, ~230px of nothing between, on 32px row pitch
  for 13px text, where the client is dense.
- **Vocabulary is WoW's, not EQ's.** `Intelligence +5` / `Charisma +5` where the client says
  `INT: +5`; `Void Resist +10` where §B1 records `SV Void`; `Weight 4.5` where the client says `WT:`;
  `AC +20` where AC is absolute, not a bonus. Worse, `ItemWindow.tsx:131` does
  `wide ? CLASS_NAMES[c] : c` (verified), so hovering an item gives `Class WAR` and clicking the same
  item in the browser gives `Class Warrior` — one component, two vocabularies. The class list is also
  alphabetised while the browser's own filter uses EQ's canonical order. And `STATS AT +N` appears on
  the landing mock but is suppressed at +0 live, so the window has two structures.

**Fix:** square the corners and build a two-tone bevel — 1px `#4a4440` top/left, 1px `#1a1715`
bottom/right over the existing warm body. Three lines of CSS and it reads as EverQuest instantly.
Tighten requirement rows to 24px pitch with values in a fixed 120px right column. Use `INT`/`CHA`,
`SV Magic`/`SV Void`, `WT`, and `AC:` unsigned. Delete the `wide ?` branch. Sort `item.cl` by
`CLASSES` index. Show `STATS AT +0` always or never.

---

### 16. On tablet and phone, the first gear row is 718–951px down the page
**Major.** Raised by all four (feel-a11y 2, ia-function 2, authenticity 1.5, visual 1).

Measured first-slot document offsets: y=261 (1600px), 261 (1280px), **718 (1024px), 752 (768px), 951
(390px)**. At 390×844 that is 2.4 viewport-heights of scrolling — auto-fill notice, header, tab row,
the 23-cell figure grid (~500px), the meter and the Vitals tiles — before the row the user came to
edit. On the smallest screen the largest element is the least informative one: the figure carries no
item names at all on mobile.

CRITIQUE-01 #23's stat-*sheet* half was genuinely fixed (statsY 1474 vs firstSlotY 752 at 768px). The
centre column was not moved with it.

Two co-defects in the same area:
- **A void reopened at 1024px.** The figure grid is ~280px wide inside a ~970px panel, leaving
  roughly 660×250px empty to its right with one thin meter bar spanning it, plus an orphaned empty
  seventh cell in the KPI row before `EQUIPPED WEIGHT` drops to a full-width row. The 592px hole
  CRITIQUE-01 #5 found at 1600px was filled; an equivalent one opened one breakpoint down.
- **Touch targets.** 75 of 144 interactive controls at 390px are under 32px — 23 stepper values at
  36×28, 23 ± at 28×28, 24 remove buttons at 26×26 packed three-across in a 58px row, with the ✕ only
  12px from the +. They clear SC 2.5.8's 24px floor but sit well under platform guidance.

**Fix:** below ~1024px put gear columns *before* the centre panel; collapse the figure grid to a
compact strip (`23/23 slots · 719 EP · 82 wt`) and move the Vitals tiles below the columns, so the
first slot lands in the first viewport. At 1024px use `grid-template-columns: auto 1fr` with the grid
in column one and meter+vitals in column two, and let the KPI tiles use `auto-fit`. Below ~820px
collapse the doll to a single full-width column rather than two truncated ones. Bump steppers and
remove buttons to 36–40px under `(pointer: coarse)`.

---

### 17. The Items screen colours 59% of the catalog against a character it never names, and scores against weights that are not yours
**Major.** Raised by: ia-function (3), authenticity (2).

On `#/items` names render red or green via `colorContext` (`ItemBrowser.tsx:162-165`), derived
silently from the active character — 41 green / 59 red on page 1. `document.body.innerText` on that
route contains no character name and no loadout string, and there is no control to switch. On a fresh
profile with no character the same screen is 100% neutral grey, so the page has two completely
different visual modes and announces neither. The only legend lives on the landing page.

Separately the weight-profile dropdown offers five fixed presets and **none of your saved sets**, so
the helper line has to concede *"Open any row for the full item, or your own set for cap-aware
scoring."* Two EP scales survive in one product, with the weaker one on the page named ITEMS.

**Fix:** add a character chip to the toolbar — `Colouring for Avenrae · 50 BRD/WAR/BER` — defaulting
to the active character, switchable and clearable, with a one-line legend. When no character exists,
say so. Add each saved set to the weight dropdown above the five presets; selecting one switches the
EP column to that set's cap-aware scoring and lets the apology line be deleted.

---

### 18. No per-set JSON export — only a whole-library dump on a different screen
**Major.** Raised by: ia-function (3), authenticity (2). CRITIQUE-01 #21, unchanged.

`downloadJson` is called exactly once, at `web/src/screens/Characters.tsx:60`, emitting
`buildEnvelope()` — every character and every set — as `eql-upgrades-export.json`. No export
affordance on the set page, not in `⋯` (Duplicate / Clear all slots / Delete set), not in the Share
modal. DESIGN.md §4 P1 #13 names JSON export/import a moat because *"downstream adoption is a
moat"* — and the unit a sim, DPS calculator or Discord bot wants is **one set**, not somebody's
whole library.

**Fix:** `Export this set (JSON)` in the `⋯` menu, emitting a versioned envelope with one character
context plus one set — slots, per-slot +N, exaltation donors, weights, and the loadout it was planned
against. Reuse the existing `isExportEnvelope` schema with a `sets: [one]` payload so import already
works, and reuse the download helper rather than adding a second one.

---

### 19. "A row of bordered cards with unequal content" is the only layout primitive, and it leaves a ragged bottom on five screens
**Major.** Raised by: visual (3).

- **Weights:** six top-aligned cards ending at six different heights, 276px of variance, with CASTING
  a 90px box holding one field beside a 280px ATTRIBUTES — it reads as a rendering error.
- **Stat sheet:** four cards (WEAPONS 2 rows, REGEN 3, STATS 7, RESISTS 6) at four different heights.
- **Full client stat sheet:** three cards (5/2/5 rows), SPELL MODS leaving ~110px of empty card.
- **Exaltations:** 23 rows where the name ends near x=520 and the stepper starts at x=1216 — ~700px
  of every row empty. The `ADD` button sits ~1,270px from the label it belongs to.
- **Landing:** the "EVERY ITEM" panel is 336px tall with a 70px paragraph in the right 55%.

**Fix:** stop boxing small lists. For the stat sheet and weights, drop the card borders and use one
continuous two- or three-column definition list per group separated by 1px rules under a section
label — that is what §A6's *"thin vertical rules between stat columns"* describes, and it removes the
ragged edge for free. Where cards must stay, `align-items: stretch` and distribute rows so boxes end
level. On Exaltations pull the stepper and socket note into a right-hand column at ~640px.

*Related, same cause:* the 3-column grid still orphans a lone cell in five places (`Equipped Weight`,
`Charisma`, `Combat End Regen`, `Tiger Claw`, `Secondary —`), and `.class-grid` at
`repeat(auto-fill, minmax(78px, 1fr))` resolves to 14 columns at 1600px, stranding BST and BER on a
second row beside twelve empty cells — a ~1,200×130px hole inside the character screen's most
important control. Fix with `repeat(8, minmax(0, 1fr))` plus a `max-width`.

---

### 20. One live region in the entire application, and the item window does not exist on touch
**Major.** Raised by: feel-a11y (2 + 2).

- **Live regions.** A sweep for `[aria-live]`, `[role=status]`, `[role=alert]`, `[role=log]` across
  the gear page, picker, exaltations, weights and browser returns exactly **one** node: the auto-fill
  notice. Typing in the picker changes "48 matches" to "6 matches" silently; "No matching items" is
  silent; equipping an item silently rewrites the whole stat sheet, EP total and weight; changing a
  weight moved set EP from 719 to 1,907 with no announcement. The `+N` stepper is the only control
  that announces, and only because `role="spinbutton"` + `aria-valuetext` gets it for free.
- **Touch.** `itemHoverProps` (`ItemWindow.tsx:262-273`) binds `onPointerMove` and `onFocus` only. On
  the gear page a tap opens the picker; on a picker row a tap equips immediately. There is no
  long-press and no info affordance, so on phone and tablet the item window is reachable *only* from
  the item browser. The landing page markets *"Hover anything, anywhere — a slot on the doll, a row
  in a picker, a row in the item browser"*; two of those three are pointer-only. A touch user must
  equip an item to learn its requirements, then undo — and at 390px only 2–3 of 48 candidates are
  visible at a time, which is exactly when inspecting before committing matters most.

**Fix:** put `aria-live="polite" aria-atomic="true"` on the `.picker-meta` count, debounced ~500ms,
and add one visually-hidden polite region on the set page announcing equip/clear/upgrade outcomes
("Ear 1 set to Ivandyr's Hoop. 719 EP, 561 hit points") reusing strings the KPI row already computes.
Add a small ⓘ button on each picker row and slot card that opens `ItemDetail` in the existing Modal,
`tabIndex={-1}` so it costs no keyboard stops — that fixes touch and gives the keyboard path a
deliberate action instead of a focus-triggered floating card.

---

## ─────────────  THE LINE  ─────────────

**Everything above is required to reach 9/10.** Items 1–5 and 11–13 are small, mechanical and should
land in the first pass; 6, 7 and 18 are the three specified-but-unbuilt features and are the largest
single block of missing score; 8, 9, 14 and 15 are the visual-identity work that alone accounts for
the 6.5.

**Everything below is genuine polish.** None of it is worth delaying the above for, and shipping all
of it would not by itself move the score a full point.

---

## NICE TO HAVE

**Iconography.** Roughly 60% of the 23 slot marks are legible at 26px; the rest are decoration.
Wrist and Waist reduce to the same silhouette and appear within 100px of each other in the centre
grid. `Arms` reads as a pen nib, `Face` as a comedy mask, `Ammo` as a cup with an arrow, and both
`Any Slot` tiles are a pentagon-with-cross that reads as a gift box. Redraw Wrist as a cuff seen
end-on, Waist as a strap with a square buckle, Arms as a tapered vambrace, Face as a visored
half-mask, Ammo as a fletched bundle, and give Any Slot a wildcard mark (dashed square, asterisk).
Test every mark at 26px on `#161719` in greyscale at 1×.

**Three icon systems in one product.** Drawn SVG for slots, **emoji** for tab-row actions (🔗 renders
full-colour against a monochrome bar, beside ✦ / ⚙ / ⋯ at three optical weights), and text characters
for disclosure triangles. Draw four 14px line icons in the slot set's stroke weight and drop the
emoji; same for the triangles.

**Era keys leak into the UI.** The dropdown offers `FearHateRevamp` (unspaced camelCase straight from
source data — verified present in the shipped index), `Nov 2000` (a date among place names),
`Chardok Revamp` and `Epic Quests` (patch labels on the same axis as zones). A user cannot tell
whether `Fear`, `FearHateRevamp` and `Hate` are three eras or one spelled three ways. Map raw keys to
display names in one place and either `optgroup` the patch-style entries or fold them into their
parent era.

**A character's name and race are immutable after creation.** `state/store.ts:157` implements
`updateCharacter`; verified **zero callers** in any `.tsx`. Race in particular drives race-restricted
item filtering, so a wrong choice silently filters the pool forever. Sets can be renamed from two
places; characters from none. Wire the existing action to an inline name edit and a race select on
the character detail page.

**The character detail page is reachable only through a status line.** `screens/Characters.tsx:130`
renders the name as a plain `<h3>`; the only anchor to `href.character(id)` is a `.hint`-styled
`1 loadout · per-class levels`. Set names on the same card *are* links, so the card teaches a rule
and then breaks it. Make the name the link.

**Sixteen always-visible class-level inputs, thirteen irrelevant.** For a BRD/WAR/BER character,
three meaningful values sit at grid positions 1, 8 and 16 among thirteen reading `1`. Same pattern
`FULL CLIENT STAT SHEET` already solves — show the loadout's classes first, park the rest behind a
closed disclosure.

**The item window says "THIS LOADOUT CANNOT EQUIP IT" and then offers three ordinary equip buttons**,
identically styled to the usable case, 40px below. Planning for a future loadout is legitimate; say
so — relabel the group `EQUIP ANYWAY (not usable by this loadout)` and style the pills as cautionary,
or disable them with a title naming the required class.

**No bulk +N action.** Reaching +10 on one slot is cheap (focus, press End); on a set it is 23
separate interactions, and there is no non-destructive way to model "what does this look like fully
upgraded." Add a set-level `Show set at +N` preview beside the KPI strip, matching the picker's
existing `Preview at` control, and optionally `Set all to +N` in `⋯`.

**The weights editor has no scale, no total and no undo.** 26 inputs, 15 reading 0, with
`Weapon Ratio` seeded at 20 against `Strength` 0.5 — a 40× spread with no stated unit. Inputs are
`type="number" step="0.1"` with empty `min`/`max`. `CLEAR ALL` zeroes 26 fields with no confirmation.
Add `min="0" max="10"`, a `?` defining the unit, the set's EP recomputing live above the grid, and a
one-line "3 slots now have a better candidate — re-run Auto-fill" prompt driven by the ranking
already computed.

**Duplicated values.** `82 wt` in the meter strip and `EQUIPPED WEIGHT 82` ~300px below it, in the
same 302px column, under two names (verified: `CharacterFigure.tsx:116` and `StatPanel.tsx:138`).
`50 BRD/WAR/BER` printed twice on the set page ~900px apart — once as static sub-line, once as the
loadout switcher's label — with nothing distinguishing them. Drop the meter's `wt`; give the switcher
a distinguishing label (`Loadout: 50 BRD/WAR/BER ▾`) or hide it when there is one loadout.

**Resist vocabulary, last residue.** The doll and picker say `MR`, the stat sheet `Magic`, the
weights editor `Magic Resist`, the item window `Void Resist`. The doll/picker/browser were genuinely
unified; the weights editor and item window were not. Pick the client's short form
(`SV Magic`) and use it everywhere.

**Exaltations residue.** `first socket at +1` is printed on all 23 rows at +0 — one fact derivable
from a number already in the row. The summary `0 socketed · 12 open · 20 waiting on +N` mixes sockets
and items in one comma list, so it scans as 32 objects when there are 23 slots and 12 sockets. Print
the rule once in the header; reword as `Sockets 0 filled / 12 open · 20 items still at +0`. When
nothing is socketed, replace the 23 rows with one empty-state card.

**ATTACK occupies a headline KPI tile and reads 0 permanently.** Verified directly over the shipped
catalog: **2 of 12,376 items** carry an attack field. Move the tile into the parked `FULL CLIENT STAT
SHEET`, or render it `—` with the "granted by no item yet" note the Heroic Mods group already
carries, and promote it automatically when a set grants a non-zero value. *(See the dropped-findings
section for why the REGEN half of this finding does not apply.)*

**Truncation cuts inside numeric values.** `… · HASTE +…` tells you a haste value exists and hides
it; at 768px the doll gives `DR +10…`, so +10 and +100 are indistinguishable. Truncate at the last
complete `·` group and append `+2 more`; prefer two-line wrap over ellipsis on the doll at ≤900px.

**The 44px hero headline breaks to a five-character orphan** (`SPEED` alone) at 1600, 1280 and 768
alike, with ~270px of unused width beside it at 1600. `text-wrap: balance` plus `max-width: 15ch`.
Cap body paragraphs at `62ch` — the 890px "Hover anything, anywhere…" line runs ~120 characters.

**Class ordinals read `PRIMARY / SECOND / THIRD`** — an adjective followed by two ordinals, on the
app's best control. Use `PRIMARY / SECONDARY / TERTIARY` or `1st / 2nd / 3rd`.

**The hover card covers the left column's own stepper.** Left slot buttons end at x=496 and the card
occupies 508–838, over `.slot-foot` at 505–620 — so reading an item hides the − / +N / + / ✕ for that
row, and bumping the tier is the natural next gesture. Prefer `rect.left − GAP − CARD_WIDTH` for
left-column anchors. Same class of bug in the picker, where the card clips the EP unit off ~5 rows.

**The Characters screen is ~90% empty with one character** — a 443×245px card with ~538px of dead
black beneath and ~950px beside it, on the screen returning users land on. Widen the card, drop the
figure grid in as a ~140px fill-state thumbnail, add HP/AC/EP chips, and keep
`repeat(auto-fill, minmax(420px, 1fr))`.

**Smaller items.** Catalog files are fetched with `cache: 'no-cache'` (verified,
`data/catalog.ts:80`), forcing a full RTT per file per load — ~300ms of dead time each on Fast 3G;
use `cache: 'default'` with content-hashed filenames. The avatar monogram uses `name[0]`, so an
emoji name renders a tofu box from a lone surrogate — use `[...name][0]` or `Intl.Segmenter`. Weapon
ratio prints at 3dp beside the fraction it is the quotient of — 2dp, and show it in the picker where
it is missing and most needed. The picker's icon column is 150 identical glyphs (a picker is scoped
to one slot) — drop it there, keep it in the browser. The race picker offers seven codes with no
guidance for absent races — add "if your race is not listed, leave this Unset; no item in the catalog
restricts on it."

---

## Regressions — CRITIQUE-01 items not actually closed

Confirmed against source, not taken on report:

| CRITIQUE-01 | Status | Evidence |
|---|---|---|
| **#19** set-creation flow | **Not fixed** | `+ New set` still creates `Set 2` instantly; `⚙ EDIT` holds only name and notes. The Weights *tab* was genuinely fixed; the §A4 flow was not built. |
| **#20** set-vs-set diff | **Not fixed, untouched** | `router.ts:21` has no compare branch; DOM sweep for `compar\|diff\|versus` returns zero with two sets loaded. |
| **#21** per-set JSON export | **Not fixed** | `downloadJson` called once, `Characters.tsx:60`, whole-library only. |
| **#12** hard result ceiling | **Half fixed** | Browser got 59 pages; `ItemPicker.tsx:40 RENDER_LIMIT = 150` still truncates 4 slots with no pager. Browser also still scores against 5 fixed presets, so the two-EP-scales problem survives. |
| **#25** Auto-fill notice | **Half fixed** | Gained a ✕; still in-flow above the header, still displaces the page 68px, still never self-clears. The code comment at `SetEditor.tsx:110` describes the shift in the past tense. |
| **#23** mobile | **Half fixed, and it masked a worse defect** | Overflow genuinely gone to 320px. But the stacked order still puts figure+KPIs above all gear (first slot y=718–951), and the right column now **clips** where it used to overflow — 14 of 23 names unreadable at 390px, invisible to the overflow check. |
| **#16** always-zero rows | **Half fixed** | Heroic/Spell/Skill correctly parked; ATTACK left in the seven-tile KPI strip on identical evidence (2 of 12,376 items). |
| **#15** one stat vocabulary | **Half fixed, with a new break** | EP precision genuinely solved (1dp, decimal-aligned, across 97 picker and 100 browser rows) and doll/picker/browser share one abbreviation table. But resists still render four ways, and **`DELA` is a new mangled abbreviation introduced on every weapon row.** |
| **#14** +N stepper | **Half fixed** | Accessibility half is genuinely excellent (28×28, `role="spinbutton"`, aria min/max/now/valuetext, Shift ×5, End → +10). The value chip is still uncoloured at every tier, so the marquee differentiator is invisible at rest. |
| **#8** KPI/VITALS duplication | **Reduced, not resolved** | Two reviewers reported it deleted. Verified false: `CharacterFigure.tsx:116` renders `82 wt` and `StatPanel.tsx:138` renders `Equipped Weight 82`, same column, ~300px apart. |
| **#5** centre void | **Relocated** | Filled at 1600px by the figure. A ~660×250px void reopened at 1024px beside the grid, plus an orphaned empty seventh KPI cell. |
| **#25** picker footer | **Contested** | See disagreements. |

---

## Disagreements between reviewers

**1. Is the responsive layout clean?** Visual scored responsive **8.5** ("clean at every width I
tested"); feel-a11y verified zero overflow at five widths; authenticity found **14 of 23 item names
clipped to 34px at 390px**. *Authenticity is right, and the disagreement is instructive:* the other
three all tested `scrollWidth === clientWidth`, and this layout clips rather than overflows, so the
standing check is blind to it. Do not treat "no overflow" as "layout is fine" again — add the
`scrollWidth > clientWidth` per-element assertion in finding 1.

**2. How should the picker's 150-item ceiling be fixed?** ia-function and authenticity both say "add
the browser's pagination"; feel-a11y says "virtualise, or drop the limit to ~40 with load-on-scroll."
*Feel-a11y's fix is the right one.* Pagination restores reachability but leaves the 150-node build
cost on every filter change — the 263–396ms block would survive, and DESIGN.md §1 makes smoothness
non-negotiable. Virtualisation closes both findings with one change. Note the severity spread too:
ia-function called this critical, authenticity minor. Given that both Any Slots hide 1,690 candidates
each and Any Slot is the app's own headline differentiator, ia-function's reading is the credible one.

**3. Was the KPI/VITALS duplication deleted?** ia-function's and authenticity's "what works" both say
yes; visual and ia-function's *own finding #15* say no. *Verified: not deleted.* The VITALS group was
restructured, but equipped weight still renders twice under two names. The whatWorks claims are
overstated.

**4. Does the picker footer have a primary action?** Authenticity lists `CLEAR SLOT` as "a real
primary action"; feel-a11y says it is destructive, not affirmative, and the footer still has none.
*Feel-a11y is right about the taxonomy and wrong about it mattering.* A single-select list commits on
row click; adding a footer confirm would add a click to the app's most-used path. Neither reading
produces work — dropped from the list. The static help line occupying a permanent 40px bar is a
minor space cost, noted nowhere above deliberately.

**5. How many items carry ATTACK?** ia-function says 4 of 23,691; authenticity says 2 of 12,376.
*Authenticity is correct* — verified directly: the shards hold 12,376 items and 2 carry an attack
field. 23,691 ≈ index + shards, i.e. every item counted twice. Same conclusion either way, but
ia-function's derived counts (including "192 items carry haste"; the shards say 71) should not be
quoted downstream.

**6. Is the Weights tab fixed?** ia-function calls it genuinely fixed; visual measures six cards
ending at six different heights across 276px of variance with a 90px CASTING box beside a 280px
ATTRIBUTES. *Both are true.* The content problem CRITIQUE-01 #19 named (mostly-empty cards) is fixed;
the ragged-edge problem is a different, still-open defect — captured in finding 19, not in finding 7.

**7. Mobile scroll depth: 883px or 951px at 390?** ia-function and feel-a11y differ by ~68px at every
breakpoint. That is exactly the auto-fill notice (finding 13) — feel-a11y measured with it present.
Both measurements are right; fixing 13 removes 68px from 16 for free.

---

## Dropped — findings that are wrong, or out of documented scope

**"No buffs or consumables surface (§A3)"** *(ia-function).* DESIGN.md §4 scopes buffs into neither
P0 nor P1, and §2.4 records that EQL itemization is classic-style. The reviewer scored it 0
themselves and flagged it as a scope boundary. Not a defect. If anything is owed here it is one line
of product copy, which is already covered by the panel's "From gear only" note.

**"Move the REGEN group into the parked full stat sheet"** *(authenticity, half of one finding).*
UI-REFERENCE §B3 lists **Regen** as a top-level group of the client's own Stats window, and §B1 is
explicit about the principle: *"The planner must show them, at zero, to match the client."* Chasing
emptiness here inverts the spec — the client shows an all-zero Regen group and so should the planner.
**The ATTACK half of the same finding stands**, because that one is about a stat occupying a
*headline KPI tile* rather than about whether it is displayed at all. Fix the tile; leave the group.

**"Give the centre column a real character silhouette / a full-height 3D model"** *(visual, part of
one finding).* DESIGN.md §4 lists "3D model viewer" among explicit non-goals for v1. The rest of that
finding — that a 5×5 grid of identical tiles is not a character and should be arranged anatomically —
is in scope, cheap, and kept as finding 10.

**"The picker footer has no primary action"** *(feel-a11y).* See disagreement 5. Correct as
taxonomy, wrong as a defect.

**Not dropped but worth flagging:** the parked `FULL CLIENT STAT SHEET` disclosure itself is a mild
deviation from §B1's "show them, at zero, to match the client." Three reviewers praised it and it is
clearly the better UI; it is called out here only so the deviation is deliberate and on the record,
rather than something a future reviewer re-litigates.

---

## What genuinely works

Recorded so it does not get refactored away.

**The item window is the best-designed thing in the app, and it is everywhere.** One implementation
(`ItemWindow.tsx`) bound to hover on the doll, hover on a figure cell, hover on a picker row, and
click on a browser row. Red gradient title bar with the name in white, warm stone body, green
numerics, cyan group headers, gold weight, flags, era, an AC/HP/MANA headline block, an Effects
group, a level requirement that explains itself ("your BRD is 42"), weight scaled to the previewed
+N, the SOURCE line a mid-raid user actually needs (`Plane of Hate · a kiraikuei`), and a coloured
usability verdict. Finding 15 is a finishing pass on something already right.

**Every P0 from CRITIQUE-01 is closed, and the structural work is comprehensive.** Filled slot rows
are 55px whether empty or filled (all 23 measured, down from 104); the doll is 698px and the page
1,341px (down from 1,313/1,648) — filling a slot no longer grows the page. The centre column went
from a 592px void to the narrowest of three (509 | 302 | 509), reversing the old spreadsheet-first
proportion. Column mirroring is textbook §A1 at every width. The Exaltations tab went 7,728px →
1,475px with a working slot-and-kind-filtered donor picker. Share links went 1,348 → 282 characters.
Equipped Weight survives a cold reload. `Empty` appears zero times; `ERA UNKNOWN` is an em dash.

**Robustness is genuinely excellent — scored 9, and it earns it.** Ten malformed localStorage
payloads (unparseable text, `{}`, `null`, `[]`, `{characters:"nope"}`, a numeric itemName, 200-deep
nested arrays) all produce zero console errors, a specific banner, **and leave the original bytes
untouched for recovery.** Nine bad share payloads and seven bad routes each get a specific,
non-generic page. Six pathological names (XSS payload, emoji, RTL, 500 chars, whitespace, zalgo)
produce no alert and no broken layout. A v1 payload migrates cleanly; `upgrade: {full: 999}` clamps
to +10; an unknown item renders `Not in catalog` rather than vanishing. Across every screen, state
and viewport all four reviewers exercised: **zero console errors, zero page errors, zero NaN,
zero `[object Object]`.**

**Client stat fidelity is exact where it matters.** All ten Heroic Mod caps and all nine Skill Damage
caps match §B3 digit for digit. Resists run Magic/Fire/Cold/Disease/Poison/Void in the client's order
with Void present as the genuine sixth. `119/510` and `30/1000` render with value green and cap
dimmed. The class picker uses EQ's canonical 16-class order. `50 BRD/WAR/BER` is perfect.

**The modal and keyboard contracts are textbook and unbreakable.** Focus lands on the search box,
Tab is trapped both directions (14 forward + 6 reverse verified), Escape closes, focus restores to
the exact opener, Enter on the restored button reopens. Keyboard equip works end to end via
`aria-activedescendant`. The set tabs are a correct ARIA tablist with roving tabindex, ←/→ wrap and
Home/End. The `+N` control is a real `role="spinbutton"` with `aria-valuetext` reading "plus 3 (2/4
banked)", flanking ± buttons correctly `aria-hidden` so AT is told about one working control instead
of two it cannot reach. `prefers-reduced-motion` is honoured in two places and verified live, with
the `role="status"` feedback surviving the suppressed animation.

**Unthrottled feel is at the bar.** Equip 40ms, stepper 24ms, tab switch 24ms, search 16ms/keystroke,
FCP and LCP both 192ms. No scroll hijacking, no scroll chaining, and the `pointerMoved()` guard means
scrolling under a stationary cursor does not drag the keyboard-active row. The hover card opens at
146ms against a 140ms target, is `pointer-events: none`, dismisses on scroll and resize, and has an
`anchor.isConnected` watchdog so it cannot survive a route change — with no stale-position flash on
an A→B transition, sampled per frame.

**The multiclass system is presented as first-class, not bolted on** — header trio, loadout switcher,
per-class levels, named loadouts with add/edit/delete. The class trio picker is still the best
control in the app, and the fourth-class refusal is now a real disabled state with an explanatory
`role="status"` line and a CLEAR action, with the ordinal row's space reserved so the grid no longer
reflows.

**The item browser went from dead end to the best-composed screen in the app** — 5,861 matches across
59 pages with jump-to-page, four sortable columns with `aria-sort`, dense rows with slot glyphs and
right-aligned aligned EP, rows that open the item window, and an equip path
(`EQUIP IN MAIN SET → WAIST / ANY SLOT 1 / ANY SLOT 2`) that did not exist before.

**Point-of-use explanation is well judged where it exists** — the Any Slot picker states its own rule
in the results header rather than making the user find a help page, and running Auto-fill twice asks
before replacing what is equipped.

**Click economy is at the bar.** Landing → scored empty 23-slot set is 5 clicks plus a name. Empty
slot → equipped is 2. Looted item → equipped from `/items` is 2. Nothing in the core loop is buried.
