# CRITIQUE-03 — Reconciled punch list

> **Historical record — figures predate the 2026-08-17 era purge.** The catalog described here
> shipped 11,249–11,252 items with out-of-era content hidden behind a "Live content only"
> toggle. It now ships 3,533; 7,719 records are quarantined in `pipeline/quarantine.json`, and
> the toggle has been removed because it could no longer change a single row. Every count below
> was correct when measured and is not current. See `research/SOURCING-STANDARD.md`.

Four independent critics re-scored the build against sixtyupgrades.com, and three adversarial
verifiers independently re-drove the fixes the previous round claimed. This document merges all
seven into one ordered work list, adjudicates their contradictions against the source, and separates
the work that moves the score from the work that does not.

Every source citation below I opened and read myself. Where a critic and a verifier disagree I say
which reading I checked and which one holds.

---

## Scores

| Lens | CRITIQUE-02 | CRITIQUE-03 | Δ |
|---|---|---|---|
| Visual / craft | 6.5 | **7.0** | +0.5 |
| IA & function | 7.0 | **7.4** | +0.4 |
| Feel & accessibility | 7.0 | **7.25** | +0.25 |
| Authenticity & bugs | 7.0 | **7.5** | +0.5 |
| **Mean** | **6.875** | **7.29** | **+0.41** |

Verifier scores (not averaged into the mean — they score fix-claim accuracy, not the product):
perf **7.0**, visual **7.0**, features **7.5**.

Target is 9.0. The gap has changed shape. Last round the product was held back by three specified
features that did not exist; **all three now exist and two of them are the best screens in the app.**
What holds it at 7.29 is narrower and more embarrassing: **five named CRITIQUE-02 must-fixes are
verbatim untouched for a third consecutive review, four fixes that were claimed are not real, and
the newest commit traded one visible text defect for another at the exact width it was written for.**

Robustness scored 9 again and deserves it — see *What genuinely works*. Nothing in the top ten below
is a stability defect.

---

## ─────────  FALSIFIED CLAIMS — read this section first  ─────────

A fix claimed but not real is worse than an unfixed defect, because it stops being tracked. Seven
claims from the last round came back REFUTED or PARTIAL. I re-checked each against the source.

### F1. "The compare screen's per-slot EP is cap-aware" — FALSE, and the KPI contradicts its own subtitle

*(verify:features, claim 1 PARTIAL)*

`SetCompare.tsx:436` renders the literal string `EP scored under {setA.name}'s weights, cap-aware`.
But `sideFor` at `src/lib/setDiff.ts:155` is:

```ts
ep: view.item ? finite(scoreItem(view.item, upgrade, lens).total) : 0,
```

— no `existing` argument. `src/selectors/gear.ts:285` (picker) and `:417` (Auto-fill) both **do** pass
`existing: capContext`. So the compare screen is the only surface in the app that disagrees with the
app's own scoring: the verifier measured one item, one tier, one profile scoring **130.0 EP on the
diff and 80.0 EP in the picker**.

Worse, the contradiction is visible in a single frame: `EQUIVALENCY POINTS +180` sits immediately
beside `CREDITABLE STAT GAIN +155 · 50 lost above the 510/1000 ceilings`. The +50 Stamina is counted
in one tile and disowned in the one next to it.

**Second half, same file.** `setDiff.ts:341-344` computes four totals and then mixes two scales in
one tile: the headline is `epDelta = epBUnderLens - epALens` while the subtitle prints
`epA → epBUnderLens`. Zero out a set's weights through the ordinary Weights tab (`WeightsEditor.tsx:115`
deletes the key on 0) and the KPI renders **`−1860` in red over an ascending `0.0 → 1427.5`**. The
banners at `:361` and `:436` also both name set A while `lens` at `:303` fell through to B's profile.

This is the product's declared leapfrog being wrong on the screen built to showcase it.

### F2. "Cold picker open blocks ~134 ms" — REFUTED at 176–293 ms, and 2.1 s cumulative on an Any Slot

*(verify:perf, claim 6 REFUTED)*

Measured at 4× throttle with a `PerformanceObserver` on longtask entries installed before the click —
real main-thread task durations, not poll latency:

| Slot | first row painted | longest task | TBT | long tasks |
|---|---|---|---|---|
| Head (114 cands) | 214 ms | 176 ms | 281 ms | 3 |
| Primary (445) | 206 ms | 244 ms | 416 ms | 3 |
| **Any Slot 1 (1,925)** | 319 ms | 293 ms | **2,119 ms** | **21 over ~3.4 s** |

No slot came in at or below 134 ms. I confirmed the Any Slot root cause in source:
`catalog.ts:291-296` — `ensureAll` fires all nineteen `ensureSlot` calls in parallel, and each one
`set()`s its own revision bump, so the open picker re-runs `rankSlotItems` over ~7,000 ANY candidates
nineteen times. This is fix #11 below and it is about five lines.

### F3. "Filter toggles now block 0 ms" — true for three of four controls

*(verify:perf, claim 2 PARTIAL)*

era → 0 ms, source → 0 ms, Hide No Drop → 0 ms: all CONFIRMED. But **"Live content only" still blocks
200 ms** on an Any Slot, and each *new* preview tier blocks 68–81 ms. The tell is the asymmetry —
toggling Live-only back ON measures 0 ms, because `includeUnreleased` and the upgrade tuple are both
in the `rankSlotItems` cache key (`gear.ts:258-270`), so the second press is a cache hit. A benchmark
that toggles twice and keeps the better number reads 0 ms; a user reads 200 ms.

### F4. "Every focusable control now has a visible focus ring" — one control on the default gear tab has none

*(verify:visual, claim 6 PARTIAL)*

The verifier walked 201 tab stops across four screens screenshotting each. Every stop carries a ring
except `.stat-group > summary`. Confirmed in source: `styles.css:1233` sets `.stat-group { overflow:
hidden }` and the ring is `outline` with a positive `outline-offset`, drawn entirely outside the
summary's border box — which is exactly the clipping parent's padding box. Measured on the **closed**
FULL CLIENT STAT SHEET, which is how the gear tab ships: **0 azure pixels on all four edges.** With
groups open, 3 of 4 edges are still clipped.

This is the precise WCAG 2.4.7 failure the claim says was fixed, on the app's primary screen. The
accompanying e2e assertion (`e2e/visual-system.spec.ts`) only samples the picker search box and one
checkbox, so it can never reach a `<summary>`. **Fix is one declaration.**

### F5. "Six sizes, three weights" — a fourth, off-token weight ships on two screens

*(verify:visual, claim 5 PARTIAL)*

The gear tab genuinely renders 6 sizes / 3 weights, and three other screens are clean. But the item
browser and the landing page render a fourth weight — UA-default `bold` (700). Confirmed in source:
`table.data th` (`styles.css:1828`), `table.data th button` (`:1843`) and `.feature h3` (`:2372`) each
set `font-size` from a token and never declare `font-weight`. `tokens.css:152` says "Three weights…
which is a hierarchy nobody can learn"; there are four. The type-scale test only runs on the gear tab.

### F6. "No element clips its own text" — false at three of the widths the claim names

*(verify:visual, claim 7 PARTIAL)*

The 34px right-column crush is genuinely dead — `.slot-item` never drops below 152px anywhere between
360 and 1600, and there is no horizontal page scroll on eight routes. But with collapsed-disclosure
false positives filtered out, the clip count is 12+20 at 360px, 5+17 at 390px, 2+11 at 430px and
**7+17 at 768px**. See must-fix #9.

### F7. "The centre figure narrows at the head, widens at the shoulders and narrows again at the feet"

*(verify:visual, claim 4 PARTIAL)*

Asserted twice in source — `CharacterFigure.tsx:17` and `styles.css:976`. Measured row extents:
152 / 48 / 256 / 256 / 256 / 152 / **256**. It never narrows at the feet, because ANY_1 and ANY_2 sit
in the outer columns at ankle level. Row 2 (SHOULDERS, NECK, BACK) also has holes at columns 1 and 3,
so the pauldron and cloak float wider apart than the arms directly beneath them. The countable half
of the claim — 23 cells, 1 tab stop, 46 → 23 `Change item` names, arrow keys, Home/End, roving
tabindex — is fully CONFIRMED and is good work. Only the silhouette prose is overstated. This is a
one-line change to `FIGURE_LAYOUT`, which drives both the layout and the arrow keys.

### F8. Bonus — a live correctness bug the last pass introduced the conditions for and did not notice

*(verify:perf; I confirmed it in source)*

`ItemPicker.tsx:243-252` resets the keyboard-active row on six deferred values — query, zone, era,
source, hideNoDrop, liveOnly — but **not on `rankPreview`**, the one deferred value that changes the
*order* of `rows` rather than its membership. Reproduced: ArrowDown to row 1 ("Truwian Baton"), click
the read-only "Preview at +5" stepper five times, press Enter → the set gets **"Dagas"**. The list
re-sorted under the selection and the app equipped an item the user never highlighted.

That pass rewrote this exact effect to add the four deferred filter values and missed the tier.
No test covers it. **This is a one-line fix and it prevents wrong data.**

### Also refuted — from CRITIQUE-02's own *what-works* section

- **"Overflow genuinely gone to 320px"** — false. 29px of horizontal page scroll on the filled set
  page and 52px on `#/characters` at 320×700. `e2e/helpers.ts:78` defaults to `[1600, 1280, 1024, 768]`,
  so the suite is structurally blind to it — the same blind spot that let the 34px name clip ship twice.
- **"The modal and keyboard contracts are textbook and unbreakable"** — no longer holds. See #5.

---

## How this list is ordered

By **score impact per unit of work**, not by severity label or by how loudly it was written. Four
things push an item up:

1. **It is a claim that was checked and failed.** Untracked defects rot.
2. It was found by more than one lens (real, not a lens artefact).
3. It breaks a stated non-negotiable — DESIGN.md §1 ("speed is the brand", "authenticity is trust"),
   an explicit "Mirror this" in UI-REFERENCE, or a promise the app makes in its own copy.
4. **It is cheap.** Six of the top fourteen are one-line or three-line changes. They are ranked above
   larger work of equal severity because they buy score immediately.

Sub-scores say where the mass is: `coldOpenCost` 4, `screen_reader_semantics` 5.5,
`informationAccessibility` 5.5, `touch_and_small_screen` 5.5, `responsiveFidelity` 5.5,
`pixelCraft` 5.5, `claimAccuracy` 6, `layoutBalance` 6. Accessibility semantics, small-screen
fidelity and claim honesty are the three holes; everything else is already at or near 8.

---

## MUST FIX — required to reach 9/10

### 1. The preview stepper re-sorts the list under the keyboard selection, and Enter equips a different item

**ONE-LINER.** *(verify:perf; verified at `ItemPicker.tsx:243-252`)*

Add `rankPreview` to the active-row reset effect's dependency list, consistent with the six values
already there. Better still, hold the active *item* across a re-rank and re-derive the index, so the
highlight follows what the user was looking at. Add a test — this is the only finding in the whole
review where the app writes the wrong data into the user's set.

### 2. `<tr role="button" aria-label>` still silences five of six columns — third review running

*(ia-function, feel-a11y, authenticity; CRITIQUE-02 #12, a named must-fix)*

Verified byte-for-byte at `ItemBrowser.tsx:345-352`. `role="button"` removes the row from the table
structure, orphaning six `<td>`s, and `aria-label` on a button *replaces* its contents as the
accessible name. All six `<th>` return `scope: null`; there is no `<caption>`. The screen that exists
to expose SLOT / CLASSES / STATS / ERA / EP across 5,861 items announces exactly one thing per row.

**Fix.** Drop `role="button"` and `aria-label` from the `<tr>`; keep `tabIndex={0}`, `onClick` and
`onKeyDown`. Put the activation affordance in the first cell as a real `<button>` wrapping the item
name — that supplies the accessible name without eating the row. Add `scope="col"` to all six `<th>`
and a visually-hidden `<caption>` naming the current filter state. Roughly ten lines, and the exact
remedy was spelled out twice before.

### 3. Auto-fill still shifts the page 68px out from under the cursor and never clears — third review running

*(all four critics; CRITIQUE-01 #25 → CRITIQUE-02 #13)*

Verified at `SetEditor.tsx:159-171`: still an in-flow `<div className="notice">` rendered above
`<SetWorkspace>`. Four independent measurements agree on `.set-header` moving y=76 → y=144. Two lenses
confirmed `elementFromPoint` at the original click position afterwards returns the header, so a
reflexive second click lands on the character name. Present unchanged after 8, 9 and 11.5 seconds in
three separate sessions. Chrome's CLS excludes it because `hadRecentInput` is true — which is exactly
why three rounds of automated checks have missed it.

The comment at `SetEditor.tsx:157` still describes the displacement in the **past tense** while the
displacement is live. That comment is now the most misleading line in the codebase.

**Fix.** `position: fixed; right: var(--s5); bottom: var(--s5); max-width: 420px; z-index: 60`, or a
0-height container below the tab row that expands in place. Auto-dismiss at ~6 s, paused on hover.
Keep the ✕ and the `role="status"`, but move the ✕ adjacent to the text rather than 1,560px away, and
add a 3px left rule in `--accent` / `--warn` so it reads as a status object rather than a paragraph.
Add an e2e assertion that `.set-header`'s `top` is unchanged across the click. **Delete the comment.**

### 4. Compare's EP column claims cap-awareness it does not have, and its headline KPI contradicts its own subtitle

*(verify:features — see F1)*

**Fix, two parts, ~6 lines.** (a) For each side compute `scoreContextFrom(totalsFor(views, position))`
and pass it to `scoreItem` as `existing`, exactly as `gear.ts:285` already does — or delete the words
"cap-aware" from `SetCompare.tsx:436` and say per-slot EP is scored in isolation. (b) Display `epALens`
rather than `epA` so the tile's headline and its from→to pair come from one scale, and derive the
banner's named set from `lens` rather than hard-coding A. Add a `a.weights = {}` case to
`setDiff.test.ts`.

### 5. Focus is dropped to `<body>` on every destructive action

*(feel-a11y, critical; verified at `SlotCard.tsx:155-163`)*

The remove button unmounts itself and nothing takes focus. Reproduced 3/3 on rows 0, 1 and 2, and
`⋯ → Clear all slots` does the same. A keyboard user pruning five items pays five full re-traversals
of an 89-stop document; a screen-reader user gets silence, because there is also no live region
announcing the removal (#8).

This is an isolated new break, not a systemic one — equip, Clear-slot, Escape and modal-open all
restore focus correctly, **so the correct target already exists in the codebase.**

**Fix.** Capture the row's slot button ref before the state update and `.focus()` it in the follow-up
effect — the same `Face: empty. Choose an item.` button the picker's Clear-slot path already restores
to. Add an e2e assertion that `document.activeElement !== document.body` after every destructive
control in the app.

### 6. The focus ring on `.stat-group > summary` is clipped to nothing

**ONE-LINER.** *(verify:visual — see F4)*

```css
.stat-group > summary:focus-visible { outline-offset: -2px; }
```

Or drop `overflow: hidden` from `.stat-group` and clip corners on the children that need it. Then
extend the visual-system spec to walk `<summary>` elements, not just inputs.

### 7. Auto-fill silently ignores the set's own DEFAULT FILTERS, and the dialog promises it will not

*(ia-function, critical; verified in source)*

`SetConfigDialog.tsx:340` states, verbatim: *"Every item picker in this set opens with these already
applied."* `SetEditor.tsx:119-124` calls `autoFillSteps(..., { includeUnreleased: false, keepFilled })`,
and `autoFillSteps` (`gear.ts:376-382`) accepts **no era, source or hideNoDrop at all**. `filtersFor`
is computed at `SetEditor.tsx:43` and published to the pickers via `publishPickerDefaults`, and never
reaches the auto-filler.

The verifier set ERA = Sky and Hide No Drop = ON, saved, cleared, and pressed Auto-fill: it placed a
byte-identical 23-item set to the unfiltered run, including four items verified NO_DROP or wrong-era
against `public/data/items/*.json`. In the same session the HEAD picker under those defaults reported
"1 match". **Two surfaces on one screen disagree about the set's own rules, and the doll shows a helm
the picker would refuse to offer.**

No Drop is a hard raid-planning constraint — you cannot buy or trade it — so a set built for a fresh
alt is silently filled with gear that alt can never obtain.

*One nuance worth recording:* the promise's literal wording covers *pickers*, and Auto-fill is not a
picker. So the minimum honest fix is either to honour the filters or to say plainly that Auto-fill
does not. Honouring them is better and barely harder.

**Fix.** Widen `autoFillSteps`' options to `{ includeUnreleased, keepFilled, filters: SetFilters }`
and forward them into `rankSlotItems`' candidate predicate — `setFilters.ts` already has that
predicate. Then have the notice name what it applied: *"Auto-fill placed 23 items (Sky era, No Drop
hidden)."* If honouring a filter empties a slot, say so in the skipped list rather than reaching past
the filter.

### 8. Zero useful live regions on the gear page, the picker, Items and Weights — third review running

*(ia-function, feel-a11y, authenticity; CRITIQUE-02 #20, a named must-fix)*

I swept the source: no `aria-live` attribute exists anywhere in `src/**/*.tsx`. The only `role="status"`
nodes are static banners plus the Exaltations summary and the transient Auto-fill notice — which is
why three lenses counted 0, 1 and 2 regions and all three were right (see *Disagreements*).

Reproduced consequences: typing in the picker takes "445 matches" to "52 matches" — silent. Equipping
rewrites HP / Mana / END / AC / EP / weight plus seven attributes and six resists — silent. Removing —
silent, and focus is destroyed (#5). Editing one weight moved a set from 719 EP to 2,673 EP — silent
on every screen. The item browser has zero live regions, so `5,861 → 94 matches` is unannounced. The
`+N` stepper is the only control that speaks, and only because `role="spinbutton"` gets it for free.

**Fix, two changes.** (a) `aria-live="polite" aria-atomic="true"` on `.picker-meta`'s count and the
browser's `N matches · a–b` span, debounced ~500 ms. (b) One visually-hidden polite region on the set
page fed by strings the KPI row already computes: *"Ear 1 set to Ivandyr's Hoop. 719 EP, 561 hit
points."* / *"Face cleared. 761 EP."* Also split the Exaltations counts out of the 250-character
explanatory paragraph currently sharing their `role="status"` — a live region should carry changing
values, not standing prose.

### 9. 768px is the worst breakpoint in the app — the doll body is narrower there than on a phone

**NEAR ONE-LINER.** *(all four critics + verify:visual)*

Verified in source: `styles.css:2452` — `@media (max-width: 720px) { .doll { grid-template-columns:
1fr } }`. So at 768px the doll is still two columns, and `.slot-body` measures **152px at 768 against
166px at 390**. Tablet portrait gets less room per row than the phone does.

Consequences measured by three lenses independently: 7–8 item names ellipsised (`Black Sapphire Ele…`,
`Indicolite Breastpl…`, `Pauldrons of the B…`) and 16–20 stat lines truncated. The stat lines are
worse than the names because truncation lands mid-value: `AC +8 · HP +50 · DR +10…` makes +10 and +100
indistinguishable, and some rows end on a dangling `·`.

CRITIQUE-02 #1's silent 34px crush is genuinely closed — both columns are equal at every width. But
#16's stated remedy, *"below ~820px collapse the doll to a single full-width column rather than two
truncated ones"*, was not taken.

**Fix.** Move the `.doll { grid-template-columns: 1fr }` collapse (and the `.slot.right` reflow that
travels with it) from `max-width: 720px` to `max-width: 900px`. 152px becomes ~600px for free and
every truncation at 768 disappears with no other change. Then allow `.slot-item` two lines via
`-webkit-line-clamp: 2`, and truncate `.slot-stats` at the last complete `·` group with a `+N more`
suffix rather than cutting inside a numeral.

### 10. The vitals fix traded a truncated word for a broken one at the width it was written for

*(visual, ia-function, feel-a11y, verify:visual — a regression from HEAD commit `010d730`)*

`styles.css:1382-1384` added `white-space: normal; overflow-wrap: anywhere` to `.stat-row.vital .k`
to fix `ENDURANC`. No characters are lost now, so the literal claim holds — but nobody looked at the
result. At 390px the label column is 56px and renders **`ENDURA` / `NCE`** and **`EQUIPPE` / `D` /
`WEIGHT`**, screenshot-confirmed at 3× by two independent lenses. At 360px it degrades to `HIT /
POINT / S`, `ATTA / CK / SPEE / D`, and three value numerals (561, 300, 297) are cut ~2.8px by
`.vitals { overflow: hidden }`.

`overflow-wrap: anywhere` is the right tool for user-supplied names and the wrong tool for seven fixed
label strings the app controls. The comment above the rule records the trade as deliberate; it should
not be. **A mid-word break fails visibly instead of invisibly — that is not the same as fixing it.**

**Root cause is upstream.** At ≤1080px `.figure` becomes `auto minmax(0, 1fr)` with the 5-cell map at
its natural width, so the vitals absorb the entire shortfall.

**Fix.** Remove `overflow-wrap: anywhere` from `.stat-row.vital .k`, give the tiles a real floor
(`flex-basis: 96px`), and stack `.figure` into a single column below ~430px so the label track never
drops under ~90px. The client's own vocabulary is short-form — `HP`, `END`, `WT` — so a second short
label field on the tile data is both the authentic answer and the fitting one. Add an assertion that
no fixed label's rendered line count exceeds its word count.

### 11. Opening an Any Slot picker re-ranks the list nineteen times

*(verify:perf — see F2; root cause verified at `catalog.ts:291-296`)*

`ensureAll` fires nineteen `ensureSlot` calls in parallel and each `set()`s a revision bump, so the
picker re-runs `rankSlotItems` over ~7,000 candidates once per shard: 21 consecutive 80–293 ms tasks,
2,119 ms TBT, for three and a half seconds *after* the dialog has already painted rows. `reindexShard`
did make each individual fold cheaper; it did not stop the picker re-ranking nineteen times.

**Fix, ~5 lines.** Resolve `ensureAll`'s `Promise.all` and set state **once**. That alone takes 2,119 ms
of blocking down to roughly one 293 ms task. Separately, drop `includeUnreleased` from the rank cache
key and apply `isLive(item)` in the `rows` filter memo alongside era/source/hideNoDrop — that makes
"Live content only" 0 ms like the other three (F3).

### 12. The forward-version banner tells the user their browser is broken when their data was preserved

**THREE-LINER.** *(authenticity; verified at `App.tsx:29-35` and `persistence.ts:318`)*

The guard landed and works: a `version > STATE_VERSION` payload is quarantined to
`eqlups.state.v1.future` with the original bytes intact, returning status `'future'`. But
`StorageWarning` branches only on `'quota'` and `'corrupt'`; every other status falls through to
*"This browser is not allowing local storage, so nothing will be remembered after you close the tab."*

That is factually false, says nothing about where the library went, and implies subsequent work will
not be saved when it will. Every other failure path in this app gets a specific, honest,
recovery-oriented message — this one is a lie on the most expensive failure the app can have.
**Data safety improved and message truthfulness regressed from silent to actively wrong.**

**Fix.** Add a `status === 'future'` branch: *"This library was saved by a newer version of the
planner and has been set aside so it is not overwritten. Reload to pick up the newest version, or
import your JSON export."*

### 13. The Items screen colours 59% of the catalog against a character it never names — third review running

*(all four critics; CRITIQUE-02 #17, a named must-fix)*

Verified at `ItemBrowser.tsx:162-165` and `:309-310`. `colorContext` derives silently from
`setsForCharacter(app, activeCharacterId ?? characters[0])[0]`. With a character present, 41 of 100
names render green and 59 red; on a fresh profile the same page renders 100 of 100 neutral — a
completely different visual mode, announced nowhere. `document.body.innerText` contains neither
`Avenrae` nor `BRD/WAR/BER`; both strings were tested explicitly by two lenses, both false. There is
no legend, no switcher and no way to clear it. The only legend in the product is on the landing page,
and it now describes this screen (commit `a3c656b`) while sitting next to a picture of a different one
(nice-to-have N16).

Second half unchanged: the scoring dropdown offers exactly five presets and none of the user's saved
sets, which is why the apology line survives verbatim — *"Scored against the Melee DPS preset. Open
any row for the full item, or your own set for cap-aware scoring."* **Two EP scales in one product,
and the weaker one is on the page called ITEMS.** Also: zero live regions here, so filtering and
paging are silent (#8).

**Fix.** A toolbar chip — `Colouring for Avenrae · 50 BRD/WAR/BER ▾` — defaulting to the active
character, switchable and clearable, with a one-line green/red legend beside it; when no character
exists, say so rather than rendering neutral in silence. Prepend each saved set to the scoring
`<select>` above the five presets; selecting one switches the EP column to that set's cap-aware
scoring and the apology line gets deleted.

### 14. The item window speaks two vocabularies for one field, reachable in two gestures

**ONE-LINER plus two more.** *(ia-function, authenticity; CRITIQUE-02 #15, unfixed)*

Verified at `ItemWindow.tsx:131` — the `wide ? (CLASS_NAMES[c] ?? c) : c` branch survives verbatim.
Hovering an item on the doll prints `Class WAR BRD CLR PAL RNG ROG SHD SHM BER`; clicking the same
item in the browser prints `Class Warrior Bard Cleric Paladin Ranger Rogue Shadow Knight Shaman
Berserker`, wrapping so line two reads "Knight Berserker" — a reader genuinely cannot tell whether
that is five classes or six. The browser's own CLASSES column uses codes for exactly this reason.

Same panel, more residue: the headline block uses client shorthand (`AC +26`, `HP +100`, `END +25`)
while the stats block 30px below uses full words (`Strength +15`), 200px from a doll row that says
`STR +15`. `Weight 7.5` where the client says `WT:`. The class list is unsorted source order, while
the app's own class picker and the browser's filter both use EQ's canonical order.

**Fix.** Delete the `wide ?` branch — always print codes, sorted by index into `CLASSES`. Route the
`STATS AT +N` block through `shortStatLabel()`. Rename the row to `WT`.

### 15. Delay is rendered as a signed bonus on both dense list surfaces, so a slow weapon reads as an upgrade

*(authenticity critical, ia-function minor; verified at `gear.ts:104-107`, `ItemPicker.tsx:546`,
`ItemBrowser.tsx:375`)*

CRITIQUE-02 #5 fixed the `DELA` mangle but not the second half of the same finding. `statVector`
pushes DMG and DLY as ordinary stat entries and both list surfaces format them with `signed()`, so
`Blued Two-Handed Hammer — DMG +21 · DLY +44` renders identically to `STR +10`. Delay is a cost, not
a bonus; +70 on Earthshaker is the worst delay on the page and reads as the biggest number.

Worse, **delay is omitted from the delta line entirely**: a Dagas → Sunderfury swap reports `▲+14 DMG`
and silently drops the accompanying +15 delay. Neither weapon's ratio appears in the picker at all,
though the item window computes and prints it — and the swap is actually a *ratio gain* (0.524 →
0.694), which the row cannot say. The doll already gets this right (`11/21 dmg/dly`), so the app
prints the correct and the misleading form simultaneously.

**Fix.** In `statVector`, stop emitting DMG/DLY as signed entries; emit one synthetic `WEAPON` entry
that the list formatters render in the doll's own form — `25/36 dmg/dly · ratio 0.694` — reusing
`summarizeItem`'s weapon branch. Put the ratio delta on the comparison line (`▲+0.17 ratio`) in place
of the DMG delta.

### 16. On tablet and phone the first gear row is still 612–862px down the page — third review running

*(all four critics; CRITIQUE-02 #16, a named must-fix)*

Measured first-slot document offsets, notice dismissed: 202px at 1600 and 1280 (correct), then **612px
at 1024, 651px at 768, 749px at 430, 862px at 390.** CRITIQUE-02 measured 718 / 752 / 951 and asked
for a structural change; the shipped work shaved 100–140px by rearranging the figure/KPI band and kept
the order. At 390×844 the first row a user came to edit is still more than a full viewport down,
behind a ~300px glyph map and a KPI stack, in a 3,078px page.

**One half of this is a documented decision and should stay.** `styles.css:2399-2419` deliberately
puts `.doll-center` at `order: -1` below 1080px, with a comment explaining that the *stat sheet* used
to stack above every slot and cost ~800px of scroll. That was the right call. The remaining cost is
the size of the character panel, not its position.

**Fix.** Collapse the figure to a compact strip below ~900px — `23/23 slots · 719 EP · 82 wt` — and
move the vitals tiles below the columns rather than beside the map (which also fixes #10 at its root).
Let the KPI tiles run `repeat(auto-fit, minmax(140px, 1fr))` so they stop splitting 5+2 at 1024 and
3+3+1 at 768 with EQUIPPED WEIGHT spanning full width.

### 17. No `(pointer: coarse)` media query exists anywhere in the stylesheet

**~4 lines.** *(visual, authenticity, feel-a11y; CRITIQUE-02 #16's third bullet)*

I grepped: zero occurrences of `pointer: coarse` in `styles.css`. Two lenses measured the same
consequence from different set states — 93 of 161 controls under 32px at 390px in a real touch context
(`matchMedia('(pointer: coarse)').matches === true`), and 70 of 136 identical at 390 **and** 1280,
which is the tell that the CSS does not respond to pointer type at all.

The worst cluster is the doll row: 23 stepper values at 36×28, 46 stepper buttons at 28×28, 23 remove
✕ at 26×26, with roughly 12px between `+` and `✕`. They clear SC 2.5.8's 24px floor — so this is a
craft failure rather than a conformance one — but on the screen where a user is one-thumbed, the
headline control is a 28px target sitting a thumb-width from a 26px destructive one.

**Fix.** `@media (pointer: coarse) { .stepper button, .slot-foot button { min-width: 40px; min-height:
40px } }` and give `.slot-remove` at least `var(--s3)` of separation from `+`.

### 18. Exaltations wastes ~600–900px of every row and prints one derivable fact 24 times

*(all four critics; CRITIQUE-02 #19's exaltations bullet)*

Geometry measured at 1600: the item name ends between x=520 and x=605 and the stepper does not begin
until x≈1,204 — **roughly half of every row is empty, 23 times.** With nothing socketed the tab is
~1,488 CSS px of visually identical rows carrying zero variable information beyond the item name, and
it is one of only three tabs on the money screen.

And the fix for the redundant note went the **wrong way**: `ExaltationsTab.tsx:99` now correctly states
the rule once in the header (`Focus +1 · Click +2 · Worn +3 · Proc +4`) and `:235` still prints
`first socket at +${entry.nextUnlockTier}` on every row. **Net duplication went up: one fact, 24
appearances on one screen, where the last review counted 23.**

**Fix.** Pull the stepper, the x/4 socketed count and the ADD buttons into a right-hand column anchored
around x=640 (`grid-template-columns: 120px 1fr auto` on `.exalt-row`) so the row reads name → state →
control. Delete the per-row note — the header owns the rule. When zero sockets are open, replace the
23 rows with one empty-state card: *"No item is above +0 yet. The first socket opens at +1 — raise a
tier on the Gear tab, or set the whole set at once."* Add "Set all to +N" to the ⋯ menu; there is
currently no bulk +N action anywhere in the product, so the only way to make this tab do anything is
23 separate stepper interactions.

### 19. The doll's resting state carries no readable signal, and its two measurable values both miss

**Two token values.** *(authenticity critical + visual major + verify:visual polish — the measurable
half of three findings)*

Two numbers, both verified in source:

- `.figure-cell` is `background: var(--bg-inset)` `#101113` and `.figure-cell.on` is
  `var(--bg-panel-raised)` `#1c1e21` — **a 1.14:1 delta.** An empty set and a fully-equipped set render
  a visually indistinguishable 305×580px panel in the exact centre column §A1 reserves for the
  character. The glyph does step (`--ink-quiet` → `--text-dim`), which is real but modest.
- `--tier-0` is `#7a838c` on `--bg-panel-raised` `#1c1e21` = **4.34:1**, under AA for 11px/800 text,
  and that is what all 23 chips read on a freshly auto-filled set. `tokens.css:33` justifies the value
  as "~4.6:1", which is true over `--bg-panel` and not over the raised surface the chip sits on. Its
  paired `−` glyph is still `--ink-quiet` at 3.24:1 while `+` is ~10:1 — a 3× contrast asymmetry
  between two halves of one control, repeated 23 times, which makes the decrement read as disabled.

*Scope note.* `styles.css:1011-1015` documents that filled is deliberately a **lightness step, not a
tint**, because the previous build's usability wash meant "46 green tiles saying one thing 46 times."
That decision is right and stays. This finding asks only that the step be large enough to see.

**Fix.** Raise `.figure-cell.on`'s background to about `#2a2e34` (≈2.5:1 against the empty tile), lift
`--tier-0` to about `#868f99`, and bring `−` up to `+`'s value — expressing "cannot decrement" as a
real `:disabled` state at `--ink-quiet` only when `full === 0`. Add a screenshot-diff assertion that
the empty and filled figure panels differ by more than N% of pixels.

### 20. Resists render four different ways, two of them in one frame

*(authenticity major, ia-function minor; UI-REFERENCE §B1)*

Verified across four surfaces: the doll and picker print `MR / FR / CR / DR / PR / VR`; the stat sheet
prints `Magic / Fire / Cold / Disease / Poison / Void`; the weights editor prints `Magic Resist … Void
Resist`; the item window prints `Void Resist`. UI-REFERENCE §B1 records the client's own form from a
real screenshot as **`SV Void 126/1000`** — a form this app uses nowhere. On the Compare screen two of
the four appear simultaneously: `+7 VR` at y≈496 and `Void` at y≈1632. The WEAPONS group adds a fifth
naming for the weapon fields (`Primary damage / Primary delay`) where the client says DMG/Dly.

This ranks above the remaining ragged-card work because it was found by two lenses, it breaks an
explicit "Mirror this" in UI-REFERENCE, and it is one lookup table against a multi-screen layout
refactor.

**Fix.** Route every resist label through one table keyed off `SAVE_NAMES`, emitting `SV Magic … SV
Void` for long form and `MR…VR` for the dense one-liners, and delete the three ad-hoc spellings in
`WeightsEditor`, `StatPanel` and `ItemWindow`. Same for the weapon fields on Compare.

---

## ─────────────  THE LINE  ─────────────

Everything above is required for 9/10. Items 1, 6, 12 and 14 are one- to three-line changes; items 9
and 11 are near one-liners with outsized effect. **Six of the top fourteen can ship in an afternoon
and they include four of the five falsified claims.** Do those first — not because they are small, but
because a review cycle that keeps re-finding the same twenty defects is the actual thing costing score.

Everything below improves the product and does not, on its own, close the gap.

---

## NICE TO HAVE

**N1. Ragged card rows on the gear stat sheet and Compare** *(visual; the remainder of CRITIQUE-02 #19).*
Genuinely closed on Weights, which is now the cleanest layout in the app and the one place §A6's "thin
vertical rules between stat columns" is literally executed. Not closed elsewhere: gear stat sheet row
1 ends at four different y with 55px of variance; SPELL MODS leaves 83 × 439px of empty card; the new
Compare screen reproduces it with a 443 × 151px void. Demoted from must-fix because applying the
Weights treatment to two more screens is a layout refactor, i.e. expensive per unit of score — but it
is the first thing to pick up after the line.

**N2. Four icon systems in the tab-row action bar, one a full-colour emoji in a second blue.**
`SetEditor.tsx:254,273,276,280` — `🔗 Share` renders as a saturated light-blue chain that is not
`--accent`; beside it `✦`, `⚙` and `⋯` sit at three optical weights and three baselines. Add `▾`, `⇄`
and `◆` and the app runs drawn SVG, colour emoji, monochrome dingbats and text characters at once. It
is now the most conspicuous inconsistency on the money screen precisely because everything around it
was cleaned up. Draw four 14px line icons in the slot set's `stroke-width: 1.5 / currentColor` idiom.

**N3. A character's name and race can never be changed after creation.** `updateCharacter` is declared
at `store.ts:52` and implemented at `:174` with **zero callers** — I grepped. The character page has no
name field and no race control. Race drives race-restricted filtering, so a wrong pick, or the default
"Unset" that the creation form labels "RACE (OPTIONAL)", permanently skews the pool with no remedy
short of DELETE CHARACTER, which destroys every attached set. Both fixes are one call to an action
that already exists.

**N4. The `/items` detail dialog never says whether the drop is an upgrade.** The per-slot picker does
this perfectly (`13.9 EP · ▼-39.1 vs worn`, `Equipped: Dagas`) one component away, and the dialog
already computes `equipTargets` at `ItemBrowser.tsx:166-171`. The surface a raider reaches from a loot
link is the one that withholds the comparison. A selector call plus a span.

**N5. Compare buries 4 real changes under 19 UNCHANGED rows, and its second KPI is undefined.**
"Dimming is not filtering." Add a "Changed slots only" toggle defaulted on when unchanged > 8. And
rename `CREDITABLE STAT GAIN`: `setDiff.ts:265` sums only the capped groups — seven attribute points
plus six resist points added as one scalar, mixing units and excluding HP/Mana/END/AC, the four numbers
that moved most. Also render the computed-but-never-rendered `capSummary.absorbed`, which is why the
KPI can read "nothing lost to a ceiling" above a row reading "150 absorbed above the cap".

**N6. The Weights tab gives zero feedback, and CLEAR ALL zeroes 25 fields with no confirmation.**
Editing a weight changes nothing on screen; navigating away revealed the set had gone 719 → 2,673 EP.
DESIGN.md §4 P0 #6 calls this the surface that "turns a database into an advisor" and it is a blind
control panel. CLEAR ALL captured zero dialog events while every other destructive action in the app
confirms. Render live set EP above the grid; put CLEAR ALL behind the same `window.confirm`.

**N7. On a multiclass-first product the item browser cannot filter to "usable by my trio."**
`ItemBrowser.tsx:60` declares `classFilter` as a single select. The colouring already computes exactly
the predicate needed (`canUse` against `colorContext`), so a checkbox is one boolean away.

**N8. `document.title` is "EQL Upgrades" on every route; no skip link; two headings on the money
screen.** In an SPA the title is the primary "where am I" signal and the only label in the tab strip.
The set page's heading tree is `H1 Avenrae → H2 Stat sheet` and stops. Compare has seven headings and
shows what good looks like.

**N9. Horizontal page scroll at 320px** — 29px on the set page, 52px on Characters (`ARTICLE.card`
measuring 360px inside a 320px viewport). No minimum width is declared anywhere in DESIGN.md and
`e2e/helpers.ts:78` asserts only 1600/1280/1024/768, so this is out of the tested range rather than a
broken promise. **Extend that default width list to 390 and 320 regardless** — the blind spot, not the
overflow, is what let the 34px name clip ship twice.

**N10. The hover card covers the stepper of the row that opened it.** Reproduced by three lenses:
hovering a left-column row opens the card at x=508–838 across that row's own `− / +N / + / ✕` cluster,
overlapping four steppers. Because the card is `pointer-events: none` the stepper is still clickable
but invisible. Prefer `rect.left − GAP − CARD_WIDTH` for left-column anchors, falling back to the right
only when that would clip the viewport. A five-line change to the existing clamp.

**N11. On touch, equipping from the picker strands a 330×294px item window over the doll.**
`itemHoverProps` binds `onPointerMove`/`onPointerLeave`/`onFocus` only, and touch never fires a leave,
so the card sits over four doll rows indefinitely — and tapping it to dismiss hits the row underneath
and opens the wrong picker. Meanwhile the landing still markets *"Hover anything, anywhere — a slot on
the doll, a row in a picker, a row in the item browser"*, which is 1-of-3 true on a phone. Ignore
`onPointerMove` when `pointerType !== 'mouse'`, call `hideItemWindow()` from the picker's select
handler, and add the small ⓘ button (`tabIndex={-1}`) CRITIQUE-02 specified.

**N12. The keyboard-active picker option is marked by a 2px left sliver** — 108px² on a 980×54 row,
0.2% of it — while the *equipped* row gets a full background wash and is the more prominent of the
two. In a combobox+listbox the activedescendant is the keyboard focus, so 2.4.7 applies to it.

**N13. The new-set dialog costs 29 Tabs to reach Cancel, and Create is unreachable while disabled.**
22 of the 31 stops are the always-expanded weights grid. A `disabled` button is not focusable, so the
`aria-describedby="setconfig-problem"` explaining "Give the set a name." can never be announced. Same
surplus-tab-stop shape as CRITIQUE-02 #2, on the surface built to close #7. Collapse the grid behind a
`<details>`; use `aria-disabled` rather than `disabled` on Create.

**N14. The picker's EP score never lines up with the item name it scores.** `.result` is
`grid-template-columns: 1fr auto` with `align-items: center` against rows of three different heights
(57/75/91px), so the EP block's offset from the top-aligned name runs +9 / +22 / +30 down the app's
most-used list. `align-items: baseline` on the name/EP line. sixtyupgrades keeps its score on the item
name's baseline.

**N15. Scroll containers have no bottom affordance.** `.results` is `overflow: auto` with no
`padding-bottom` and no mask (`styles.css:1503`), and `.modal-body` the same (`:1452`), so a
partially-scrolled row or the dialog's DEFAULT FILTERS row is cut with nothing saying "more below."
*Adjudication: this is a missing affordance, not a rendering bug — see Disagreements 5.* Add
`mask-image: linear-gradient(to bottom, #000 calc(100% - 24px), transparent)` plus `scroll-padding-bottom`,
and put the modal footer in a `position: sticky` opaque band.

**N16. The landing hero advertises a layout and a colour rule the product no longer ships.** Commit
`a3c656b` changed the caption's words and left the picture alone: `.hero-art` still uses the pre-fix
`.figure-grid` flex block and renders 75 green + 5 red glyph strokes across a 23-cell mock character
panel, while the caption underneath now says the green/red rule belongs to the item browser. Point the
hero at the same `FIGURE_LAYOUT` the product uses and show a two-row item-browser fragment for the
legend instead.

**N17. The virtual list's scrollbar over-reports by 16.8% on any slot that already holds an item.**
`ROW_ESTIMATE = 74` (`ItemPicker.tsx:60`) is calibrated for a row without a delta line, but the delta
line renders whenever `currentItem && !isEquipped` — i.e. on all 23 slots after Auto-fill. The canvas
grows 142,687 → 166,597px as you scroll, so the thumb shrinks and the bottom recedes the whole way
down and one drag-to-bottom leaves 207px to go. Replace `measured[i] || estimate` with a running mean
of heights measured so far; that converges within the first viewport.

**N18. The item window stops one CSS rule short of reading as an EverQuest artefact.** It remains the
best-designed object in the app and is now bound to doll, picker and browser — but computed
`border-radius: 3px` with a symmetric `inset 0 0 0 1px` highlight. A bevel is two-tone by definition;
a uniform inset ring reads as a web-card outline. `border-radius: 0` plus `inset 1px 1px 0 #4a4440,
inset -1px -1px 0 #1a1715` is three lines. Also: requirement values flush-right across ~250px of
nothing (use a fixed 120px right column), and `STATS AT +N` suppressed at +0 while the landing mock
shows it at +10, so the window has two structures.

**N19. Raw era keys now leak into three surfaces instead of one.** `FearHateRevamp` (unspaced camelCase
straight from source), `Nov 2000` (a date among place names), `Chardok Revamp`, `Epic Quests` — a
reader cannot tell whether Fear, Hate and FearHateRevamp are three eras or one spelled three ways. The
new set-config dialog and every per-slot picker now render the same unmapped list. Map keys in one
table next to `eraLabel()` and `optgroup` the patch-style entries.

**N20. Smaller residue, each verified.** The Characters screen — where returning users land — is a
443×355px card in a 1600×1000 viewport, and the character's name is the one name on it that is *not*
a link while both set names are (`Characters.tsx:130`). ⋯ → "Import a set (JSON)…" always clones a
whole character because `singleSet` is parsed at `setExport.ts:299` and never read, so re-importing one
file three times leaves three duplicate characters. `#/set/{id}/compare/{id}` renders a set against
itself. The `+N` stepper's `aria-valuetext` advertises banked fractions while `UpgradeStepper.tsx:38-41`
always writes `fraction: 0`, destroying any fraction from an import or share link. The avatar monogram
uses `charAt(0)` in three places, so an emoji name renders U+FFFD. Weight inputs declare `min="0"
max="100"` and enforce neither, with no `:invalid` styling. Weapon ratio prints at three decimals
beside the two-integer fraction it is the quotient of. `50 BRD/WAR/BER` prints twice per viewport with
nothing distinguishing the header sub-line from the loadout switcher. The character page shows sixteen
class-level inputs for a three-class character, and `SHADOW KNIGHT` is the only two-line label so its
input sits 14px below its row. The donor picker withholds effect prose that `focus-effects.json`
already ships and the socketed view already renders. The Compare screen stays single-column to 768px.
Catalog JSON is still fetched with `cache: 'no-cache'` (`catalog.ts:80`). Two weights editors exist for
one object with different field sets and no link between them. Wrist 1 and Wrist 2 are identical bare
ellipses two cells apart; Arms reads as a bucket and Shoulders as a cap. The landing feature grid
breaks 3+1 at 768. No `#/about` route despite DESIGN.md §3 promising provenance, and no `/{ruleset}/`
prefix despite the same section listing it as a day-one decision.

---

## Disagreements — adjudicated against the source

**1. "The doll collapses to a single full-width column below ~820px" (ia-function, *what works*) —
WRONG, and I checked.** `styles.css:2452` is `@media (max-width: 720px)`. Three other lenses plus
verify:visual independently measured `.slot-body` at 152px with two columns at 768px, and
verify:visual measured 166px at 390 against 152 at 768 — which is only possible if the collapse
happens between them. ia-function's praise is a measurement taken at the wrong width. Recorded here so
it does not get cited as closed. Must-fix #9 stands.

**2. Live-region count: 0, 1 or 2? All three are right.** ia-function found one (Exaltations),
authenticity found zero on the gear page, feel-a11y found two in the gear flow. The Auto-fill notice
carries `role="status"` but exists only while a message is set, so a sweep taken before or after a fill
sees a different number. I grepped the source: **no `aria-live` attribute exists anywhere in
`src/**/*.tsx`.** The substantive claim — that equip, remove, match count and EP recompute are all
silent — is unanimous and correct.

**3. Touch targets: "fixed" (feel-a11y) vs "93 of 161 under 32px" (visual) vs "70 of 136" (authenticity).
No contradiction — different thresholds.** feel-a11y measured against SC 2.5.8's **24px** conformance
floor and is right that only one sub-24px control survives. The other two measured against a **32px**
craft bar. Both readings hold, and the decisive fact settles it either way: I grepped and there is no
`(pointer: coarse)` query in the stylesheet at all, which is why authenticity measured *identical*
counts at 390 and 1280. Kept as a craft finding (#17), not a conformance one.

**4. Cold picker open: ~134 ms (previous claim) vs 238 ms (feel-a11y) vs 176–293 ms + 2.1 s TBT
(verify:perf).** I take verify:perf. It is the only measurement that installed a `PerformanceObserver`
on longtask entries *before* the click and reported real task durations rather than wall-clock
settle time, it reports per-slot rather than as one figure, and its root-cause diagnosis
(`ensureAll` → 19 revision bumps) is verifiable in source and I verified it. feel-a11y's 238 ms is
consistent with verify:perf's Head/Primary numbers; the ~134 ms claim is not consistent with anything.

**5. "The picker clips content mid-glyph — 5.0 EP renders as 5.0 FP" (visual, critical).** Downgraded
to N15. A scroll container cutting a partially-scrolled row is expected behaviour, not a clip.
verify:perf specifically audited row geometry at five scroll depths — no gaps, no overlaps, all rows
inside the canvas bounds — and verify:visual independently established that the item browser's
apparent cut-off is `overflow-x: auto` scroll, not clipping, and said so before reporting. The real
defect is the missing bottom affordance, which is worth fixing and is not a rendering bug. Same
adjudication for the SET CONFIGURATION dialog's "scissored" DEFAULT FILTERS row: verify:features
measured 13px under the footer at 1600×1000 with a real scroll available.

**6. Auto-fill blocking: 1,031 ms / 114 ms worst (authenticity) vs 2,107 ms / 197 ms (feel-a11y) vs
2,569 ms / 232 ms (verify:perf).** The spread is shard warmth, not disagreement — a cold run pays for
`ensureAll`. All three agree the busy affordance is correct and complete (`… Filling`, `disabled`,
`aria-busy`, one unflickering state, a disabled button on a real double-click) and that no single task
exceeds ~250 ms. Not a must-fix. The fix for #11 will shorten it as a side effect.

**7. Font weights: three (visual, feel-a11y, authenticity) vs four (verify:visual).** verify:visual is
right and the other three sampled only the gear tab. Confirmed in source at `styles.css:1828` and
`:2372`: neither declares `font-weight`, so both fall through to UA `bold`. Two lines. Filed as F5 and
folded into the type-system work.

---

## Dropped — findings that misread a deliberate, documented decision

**"Give the doll one always-on chromatic channel that varies at +0" / "print the era as an amber word
on each row"** *(visual, half of one finding).* This re-litigates CRITIQUE-02 #8 and #9, whose executed
fix was precisely to strip decorative colour from the doll and reserve usability red for the exception.
`styles.css:1011-1015` records the reasoning — the previous build's tint "meant 46 green tiles saying
one thing 46 times" — and all four lenses this round independently praised the result as calm and
correctly ranked. Re-spending the budget the last round deliberately cut is not the fix. **The
measurable half is kept as #19**: the +0 chip fails AA at 4.34:1 and the empty-vs-filled tile delta is
1.14:1. Make the existing channel legible; do not add a new one.

**"Render the equipped item's first letter, or a filled corner notch, in each figure tile"**
*(authenticity, alternative fix on the same finding).* DESIGN.md §4 lists a 3D model viewer among
explicit v1 non-goals, and CRITIQUE-02 settled the anatomical glyph map as the answer to that finding.
Substituting letters for the drawn glyph set would undo the iconography work three lenses just
credited. The lightness-step half of the fix is kept.

**"The +N tier ramp resolves to about three readable bands, not eleven"** *(visual, polish).*
verify:visual drove tiers 0–10 through the spinbutton and CONFIRMED eleven distinct colours matching
`--tier-0` through `--tier-10` byte for byte, applied to both the stepper chip and the figure badge,
and described the column as visibly a grey-to-gold gradient. The finding critiques the wording of a
token comment, not the rendered UI. The actionable residue — tier-0's legibility — is #19.

**"Document the picker's Home/End scoping in the UI"** *(feel-a11y, half of one finding).* feel-a11y
itself calls the scoping "a good, documented decision" and the rationale is written out at
`ItemPicker.tsx:280-322`. Only the optional help-line addition survives, at the very bottom of N20.

**Not dropped but recorded so it stays closed:** the parked `FULL CLIENT STAT SHEET` disclosure remains
a mild deviation from §B1's "show them, at zero, to match the client." CRITIQUE-02 put it on the record
as deliberate; nobody re-raised it this round; it stays. Must-fix #6 is about that disclosure's *focus
ring*, which is a separate bug.

---

## Regressions — CRITIQUE-02 must-fixes not actually closed

Five named must-fixes are untouched or barely moved. Listed plainly because three review cycles have
now re-derived some of them from scratch.

| CRITIQUE-02 | Status | Evidence |
|---|---|---|
| **#12** item browser table semantics | **untouched** | `ItemBrowser.tsx:345-352` byte-for-byte as described; `<th scope>` null ×6; no `<caption>` |
| **#13** Auto-fill notice | **untouched** | `position: static`, in-flow above `<SetWorkspace>`, 68px shift, present at 11.5s; comment still past-tense |
| **#17** Items screen context | **untouched** | no chip, no legend, no switcher; five presets only; apology line verbatim |
| **#20** live regions and touch | **untouched** | zero `aria-live` in source; `itemHoverProps` still pointer-only; no ⓘ affordance |
| **#16** mobile scroll depth | **~15% closed** | 951→862px at 390, 752→651px at 768; no `(pointer: coarse)`; doll still two columns at 768 |
| **#19** ragged rows | **~⅓ closed** | genuinely fixed on Weights; gear stat sheet, Exaltations and the *new* Compare screen all still ragged |
| **#15** item window | **half closed** | chrome landed; `wide ?` branch, `Weight` not `WT`, unsorted class list all survive |
| **#5** client vocabulary | **half closed** | DELA fixed; DLY still signed on both list surfaces; resists still four spellings |

**New this round:**

- The HEAD commit traded `ENDURANC` truncation for `ENDURA / NCE` mid-word wrapping at 390px, plus
  `EQUIPPE / D / WEIGHT`, plus three clipped value numerals at 360px. The defect changed shape, not
  status, and the trade is recorded in a comment as deliberate.
- Focus drops to `<body>` on every item removal and on Clear all slots — an isolated new break in an
  otherwise excellent keyboard contract.
- The forward-version guard landed correctly and was wired to the wrong banner branch, so message
  truthfulness regressed from *silent* to *actively false*.
- The §A4 DEFAULT FILTERS were built and reach the pickers correctly, but Auto-fill was never wired to
  them — so the app now makes a written promise its most-used button breaks. **This failure mode did
  not exist before the feature landed.**
- The exaltation-note fix was applied additively rather than as a replacement: one fact now appears 24
  times instead of 23.
- Unmapped era keys spread from one surface to three.
- The keyboard-active row survives a preview-tier re-sort, so Enter can equip an item the user never
  highlighted.

---

## What genuinely works

Recorded so it does not get refactored away. All four lenses and all three verifiers agree on this
list, and much of it is new since CRITIQUE-02.

**The three specified-but-unbuilt features are built, and two are the best screens in the app.**
The set-vs-set diff — DESIGN.md's own named leapfrog, absent through two reviews — is routed at the
declared `/set/{id}/compare/{id2}`, reachable from both the ⋯ menu and a ⇄ per sibling, and carries
four KPI tiles, a 23-row slot table with SWAPPED/RETUNED/ADDED/REMOVED/UNCHANGED badges, five stat
groups labelled with how many rows moved, printed ceilings, SWAP SIDES, and specific banners for
identical-sets, both-empty, cross-character, missing-id, bogus-id and single-set-library. verify:features
drove nine awkward pairings and none of them threw. The §A4 set-creation dialog is built exactly as
specified and — critically — **the same dialog serves create and edit**, with disabled-with-a-reason
validation properly wired to `aria-describedby`. Per-set JSON export and import shipped in two places.

**The cap column is real arithmetic, not decoration.** verify:features built a set 150 points over the
510 ceiling and checked every direction by hand: gain crossing the cap, gain entirely above it, loss
entirely above it, and the group header's own accounting. `creditableDelta` matches `ep.ts` exactly.

**JSON round-trip and v1 migration are hardened past the point of reasonable doubt.** A damaged export
imported its good half and named all ten casualties individually. Foreign format, schema 99,
unparseable text, a bare array, `{}` and a well-formed-but-empty envelope each produced a distinct
refusal. A v1 payload migrates, fans the level onto the trio, synthesises a loadout and comes back
version 2.

**The picker rebuild paid for itself.** The 150-item ceiling is gone (1,925 matches, 14–22 rows in the
DOM, 253 element nodes, a window that scales with the viewport rather than the list). verify:perf
confirmed the last row reachable on all 23 positions by keyboard, 30 consecutive PageDowns each landing
on a rendered fully-visible row, correct scroll reset on filter change, no gaps or overlaps at five
depths, and hover cards that tear down on recycle rather than orphaning. Tab-to-Cancel is 6–7 presses,
down from 157.

**The keyboard and modal contracts are otherwise textbook.** Focus trapped both directions, Escape
restoring to the exact opener, the centre figure as a single composite widget with 2D arrow keys and
Home/End, 110 → 89 gear-page tab stops, `prefers-reduced-motion` resolving transitions to 0s, no scroll
hijacking, no scroll chaining, `body: overflow hidden` under a modal.

**Auto-fill's busy contract is complete.** Sampled at 20 ms: `… Filling`, `disabled`, `aria-busy` held
as one unflickering state for the whole run, then a `role="status"` announcement. A real double-click
hits a disabled button. `git show 8623511` confirms the algorithm itself is untouched — converted to a
generator and nothing else — so "same answer as before" holds structurally, not just empirically.

**The typographic and colour systems are real and measurable.** Six sizes and three weights on the gear
tab, every one a token; zero literal px font-sizes in `styles.css`; every spacing literal is 1px, i.e.
borders only. All 150 SVG strokes on the gear tab are one neutral grey, `.glyph-accent` is deleted, and
azure is down to five text nodes plus the tab underline, fill meter and focus ring. `--at-cap` got its
own teal so amber stopped meaning four things. verify:visual scanned 847 elements across nine colour
properties plus pseudo-elements and confirmed both stated exceptions.

**Focus indicators are solid where they are drawn** — 4.85–6.77:1 measured from actual pixels across
seven control types, up from a 1.24:1 ghost, with the two picker checkboxes that previously showed
nothing now showing rings.

**The doll reads calm and correctly ranked**: bright name → mid label → dim stats, 23 uniform 54px rows
on a 60px pitch, and the right-column mirroring bug is properly dead — `.slot-body` is equal in both
columns at every width measured.

**The item window is the best-designed object in the product** and is now everywhere: one implementation
bound to doll hover, picker hover and browser click, with a red gradient title bar, warm stone body,
green numerics, cyan group headers, gold weight, the SOURCE line a raid-night user needs, and a coloured
usability verdict.

**Client stat fidelity is exact where it matters.** All ten Heroic Mod caps and all nine Skill Damage
caps match UI-REFERENCE §B3 digit for digit. Resists run the client's order with Void present as the
genuine sixth. `50 BRD/WAR/BER` is exactly §B2. `shortStatLabel` now returns the raw key for unmapped
stats, with a comment explaining that `DELA` and `DRAG` were "plausible-looking fictions worse than an
obviously raw key" — which is the right instinct written down.

**Click economy is at or above the sixtyupgrades bar, measured with real clicks.** Landing → scored
23-slot set: 5 clicks plus a name. Empty slot → equipped: 2. Loot drop → equipped: 1 plus typing.
Share: 2. Compare two sets: 2. Nothing in the core loop is buried.

**Robustness is outstanding and three lenses tried hard to break it.** Fourteen malformed localStorage
payloads including a `__proto__` pollution attempt, ten bad share payloads, eight bad routes, eight junk
import files, ten pathological character names including zalgo and RTL, plus eleven browser runs and a
ten-route sweep at two widths. Result: zero console errors, zero page errors, zero unhandled rejections,
zero NaN / undefined / `[object Object]`, no prototype pollution, no XSS execution, and the original
bytes always preserved for recovery — each failure carrying its own specific, honest message. 391 unit
tests in 28 files pass and `npm run build` is clean.

**Point-of-use explanation remains well judged where it exists** — the Any Slot picker states its own
rule, the exaltations header states the socket ladder and explicitly disclaims what the planner does
not know about Ornamentation, the socketed-effect card says "Named, not scored", the compare footnote
explains the middle column, and the race field explains why base attributes are not modelled.
