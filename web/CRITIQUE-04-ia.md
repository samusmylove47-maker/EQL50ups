# CRITIQUE-04 — Information architecture, workflows, functional completeness

> **Historical record — figures predate the 2026-08-17 era purge.** The catalog described here
> shipped 11,249–11,252 items with out-of-era content hidden behind a "Live content only"
> toggle. It now ships 3,533; 7,719 records are quarantined in `pipeline/quarantine.json`, and
> the toggle has been removed because it could no longer change a single row. Every count below
> was correct when measured and is not current. See `research/SOURCING-STANDARD.md`.

Adversarial re-score against sixtyupgrades.com. Everything below was measured in Chromium at
1600×1000 (and at 1280/1024/768/430/390/320) against a production build served from `dist`, or read
in the source it names. Prior scores: 4.5 → 6.875 → 7.29. Target 9.0.

---

## Score

| Lens | CRITIQUE-03 | CRITIQUE-04 | Δ |
|---|---|---|---|
| Information architecture | 7.4 (combined) | **7.0** | — |
| Functional completeness | 7.4 (combined) | **6.75** | — |
| **Overall (this lens)** | **7.4** | **6.9** | **−0.5** |

**The justifying sentence:** six real fixes landed and three of them were multi-review embarrassments,
but this pass measured two structural facts nobody has named in three reviews — the multiclass
loadout is attached to the *character* and not the set, and the 510/1000 ceilings are physically
unreachable from the gear-only totals this app models — which means the two systems the product
markets as its reasons to exist, multiclass-first planning and cap-aware scoring, are decorative in
the workflow rather than operative, and that costs more than the polish fixes earned.

I am scoring this **down** from 7.4 deliberately. The previous three reviews scored surfaces. This
one scored whether the surfaces let a player finish a job, and two of the six jobs cannot be finished
at all.

---

## The two structural findings — read these first

### S1. `GearSet` has no loadout. The trio is a property of the character, so no two sets can be planned under different trios.

Verified in source: `engine/types.ts:64-75` — `GearSet` carries `id, name, characterId, slots,
weights, notes, createdAt, updatedAt`. No loadout field, and `grep -rn loadoutId` returns hits only
in `engine/character.ts` and `state/store.ts`, all against `Character.activeLoadoutId`.

The consequence I drove: with two sets in the library and the loadout switcher used on one of them,
the compare screen prints `Avenrae · 50 BRD/WAR/BER · 23 equipped` on **both** sides. It is
structurally incapable of printing anything else. So the single most EQL-specific question a player
has — *"is my BRD/WAR/BER kit worth more than my WAR/PAL/SHD kit?"* — cannot be asked by the tool
built for a game whose headline mechanic is running three classes at once.

Worse in daily use: switching the loadout to re-rank one set silently re-lenses **every other set of
that character**, because eligibility, armour proficiency and best-of-three skill caps are all read
off `activeLoadoutId`. A player who keeps a "Tank set" and a "DPS set" has no way to keep them
correct at the same time.

This is not an oversight the reference is silent about. `UI-REFERENCE.md` §A4 writes the lesson out:
*"stat weights and filters are configured at set creation, making every set carry its own scoring
lens. **Mirror this.**"* Weights were mirrored. Default filters were mirrored. The loadout — the most
consequential lens in this game, and the thing `DESIGN.md` §2.1 calls "the most important control on
the character screen" — was not.

**Fix.** Add `loadoutId?: string` to `GearSet`, default it to the character's active loadout at
creation, resolve `activeContext()` from `gearSet.loadoutId ?? character.activeLoadoutId`, and put
the loadout name in the set header beside the set name (where §A1 puts the phase label). The set
switcher and the set-config dialog already have the shape to host it. `SetCompare` then prints two
different trios and the diff finally answers the question the game asks.

### S2. Cap-aware scoring — a headline claim on the landing page and the compare screen's declared leapfrog — can never fire.

Measured, not inferred. I auto-filled a level-50 BRD/WAR/BER set and then drove all 23 upgrade
spinbuttons to **+10** — the theoretical maximum this character can reach from gear:

| | +0 (auto-filled) | +10 on all 23 slots | ceiling |
|---|---|---|---|
| Strength (highest attribute) | 119 | **271** | 510 |
| Void (highest resist) | 0 | **180** | 1000 |
| every other resist | ≤ 30 | ≤ 60 | 1000 |

At the absolute ceiling of what gear can give, the best attribute reaches **53% of its cap** and the
best resist **18%**. The `creditable()` function in `engine/ep.ts:51-54` is correct arithmetic and it
is unit-tested; it is also arithmetic on a number that will never approach its bound.

The reason is documented and deliberate — race and class base attributes are not modelled — but the
*consequence* is not documented anywhere, and it is being sold. `UI-REFERENCE.md` §B1 records the
client reading `Strength 304/510` and `SV Void 126/1000` for this exact character. The planner reads
119 and 0. The missing ~185 Strength is base plus buffs, and it is the entire distance between "the
cap never binds" and "the cap binds constantly." A player at a real 480 STR who picks up a +40 STR
item loses 10 points to the ceiling; this app tells them all 40 count, because it thinks they are
at 119.

So the fourth KPI tile on the compare screen, `CREDITABLE STAT GAIN −9 · −9 raw · nothing lost to a
ceiling`, has a subtitle that is a constant string, and the landing page's `CAP-AWARE SCORING —
"Points past a ceiling score nothing, so an item cannot win a slot by piling on a stat you have
already maxed"` describes a mechanism that has never once changed a ranking in this build.

**Fix, in ascending order of honesty.** (a) Minimum: change the ceiling copy to *"gear only — the
client counts your base attributes and buffs against these ceilings too."* (b) Right: one collapsed
panel of 13 number inputs on the character page — "base + buffs offset" per attribute and resist —
fed straight into `ScoreContext.existing`, which every scoring call site already accepts. That is
roughly one component and one store field, it makes the cap column live, and it is also the fix for
the missing buffs feature (§4 below). It does **not** require inventing race base values: the player
types what their client shows them.

---

## Prioritised findings

Ordered by score impact per unit of work, matching CRITIQUE-03's stated method. Recurring items are
marked with the review count.

### 1. No importer for `/outputfile inventory` — the one capability that would change a real player's day

**Verified by driving it.** The only file inputs in the app declare `accept="application/json,.json"`
(`SetEditor.tsx` and `Characters.tsx`). I fed the project's own Tier-0 file,
`research/validation/tier0-inventory-Avenrae.txt`, to the Characters import and got
**"That file could not be read as JSON."** — a correct message for the wrong capability.

That file is a 983-line tab-separated table whose first four columns are exactly what a set needs:

```
Location	Name	ID	Count	Slots
Any Slot	Nautilus Shield +6	9404	1	10
Ear	Black Sapphire Electrum Earring +4	14701	1	10
Head	Shadow Rage Helm +5	55601	1	10
```

Location maps onto `POSITIONS`, the `+N` suffix maps onto `UpgradeState.full`, and the ID column is a
join key better than the name join the pipeline already relies on. `DESIGN.md` §6 asked the user for
this file specifically because *"which we should support importing"*.

**What it costs a player today.** Reproducing that character by hand is 23 × (1 click to open the
slot + ~12 keystrokes to search + 1 click to equip) = **46 clicks and ~280 keystrokes**, then the
tiers on top (finding 2). Reproducing it from the file would be one paste.

**Fix.** A `parseInventoryExport(text)` beside `setExport.ts`, a second `accept` on the existing file
input, and a confirmation screen listing what matched and what did not — the JSON importer's
`EnvelopeReport` already renders exactly that shape. This is the highest value-per-line item left in
the product and no competitor has it, because no competitor's game emits the file.

### 2. There is no bulk `+N`, so the flagship system is a 230-click chore — **third review**

`DESIGN.md` §2.2 calls the +0..+10 system the thing that makes "a planner that ignores this useless".
The planner does not ignore it: every slot has a correct, keyboard-operable spinbutton with
`aria-valuetext`, Shift-for-five and End-for-ten. What it has no way to do is set a *plan*.

Measured: bringing an auto-filled 23-slot set from +0 to a realistic +5 costs **115 mouse clicks**
(5 × 23); to +10 it costs **230**. The keyboard path is 23 focus moves + 23 `End` presses — but
`End` is advertised only inside a `title` tooltip on the spinbutton, so it is invisible to the
mouse user who needs it most. The ⋯ menu (`Compare with… · Export this set (JSON) · Import a set
(JSON)… · Duplicate set · Clear all slots · Delete set`) still has no "Set all to +N", which
CRITIQUE-03 #18 asked for explicitly.

**Fix.** `Set all to +N ▸` in the ⋯ menu writing `{full: n, fraction: 0}` across `gearSet.slots`, and
a "Preview at +N" already exists on both the picker and `#/items` — reuse that control's shape. Three
lines of store code.

### 3. Compare cannot act, cannot filter, and its two headline tiles disagree — the leapfrog is a report, not a decision tool

I drove a real diff: two sets differing in one slot (`Brewer's Mesh Cloak` → `Cloak of Flames`).

**a) One change buried under 22 identical rows.** The changed row sits at y≈686 in a 2,304px page,
below eight dimmed `UNCHANGED` rows. The entire screen contains **one `<button>` and three `<a>`**
(`⇄ SWAP SIDES`, two `EDIT` links, `COMPARE WITH A DIFFERENT SET…`). There is no "changed slots only"
toggle. Dimming is not filtering — CRITIQUE-03 N5, unfixed.

**b) The two headline tiles point opposite ways.** `EQUIVALENCY POINTS +16` in green sits beside
`CREDITABLE STAT GAIN −9` in red. The −9 is `STR +12 + WIS +12 + AGI −9 + DEX −9 + FR −15` — it adds
attribute points to resist points as one scalar (12 STR is not 12 FR) and it excludes HP, Mana,
Endurance and AC by construction, so the `+50 Mana` and `+3 AC` that actually moved are absent from
the tile that claims to summarise the change.

**c) The decisive number is not in any tile.** This swap moves `Attack Speed 36% → 0%`. For a
BRD/WAR/BER melee trio, losing 36% haste is the whole story of the comparison. It appears once, in
the VITALS card at y≈1653, 1,400px below the KPI row, in the same grey as `Endurance 25 → 25`.

**d) You cannot take the change.** Having decided set B's cloak is better, there is no control that
applies it. You must remember the item name, navigate to set A, open the Back picker, search, equip —
about 4 clicks and a search *per item you want to adopt*. sixtyupgrades makes you open two tabs; this
makes you open two tabs and retype.

**e) At 768px it is a 6,608px single-column scroll**, so on a tablet the two sides are never on
screen together — which is the only reason the screen exists.

**Fix.** A `Changed slots only` checkbox defaulted on when unchanged > 8; a `Take this →` button in
each changed row calling `state.equip`; rename the tile to what it sums or make it sum everything;
promote the largest absolute vitals swing into the KPI row; two columns at ≥600px.

### 4. The item browser's detail dialog withholds the verdict — **fourth review** (CRITIQUE-03 N4)

The dialog a raider reaches from a loot link renders the item window, the source line, and
`EQUIP IN MAIN SET · BACK · ANY SLOT 1 · ANY SLOT 2`. It prints **no EP, no delta, and no comparison
to what is worn** — even though the row behind it prints `91.7` and `ItemBrowser.tsx:166-171` already
computes `equipTargets`. Two clicks away, the per-slot picker gets this exactly right: I searched the
same item there and the row read `29.0 EP · −16 vs worn` with a six-chip stat delta.

**Also:** the three equip buttons are hardwired to `sets[0]`. With `Main Set` and `Main Set (copy)`
both in the library the dialog says "EQUIP IN MAIN SET" and offers no chooser, so from the item
browser you can only ever edit one arbitrary set.

**Fix.** One selector call and a span for the verdict; a `<select>` of the character's sets above the
three destination buttons.

### 5. Exaltations prints one derivable fact 24 times and wastes ~685px of every row — **fourth review** (CRITIQUE-03 #18)

Verbatim unchanged. `ExaltationsTab.tsx:99` states the rule once in the header
(`Focus +1 · Click +2 · Worn +3 · Proc +4`) and `:235` still prints `first socket at +${entry.nextUnlockTier}`
on **every one of 23 rows**. Measured at 1600px: item names end between x≈490 and x≈605, the stepper
does not begin until x≈1205. On a fresh set the tab is 23 visually identical rows carrying the item
name and nothing else — one of only three tabs on the money screen, and it is inert until someone
performs finding #2's 46 clicks.

**Fix (unchanged from last review).** `grid-template-columns: 120px 1fr auto` on `.exalt-row`; delete
the per-row note; when zero sockets are open, replace 23 rows with one empty-state card that points
at the bulk `+N` action from finding #2.

### 6. Weights is a blind control panel with an unguarded destructive button — **fourth review** (CRITIQUE-03 N6)

Measured: `/^[\d,.]+\s*EP/` matches **nothing** anywhere on the Weights tab. Editing a weight changes
nothing on screen. `DESIGN.md` §4 P0 #6 calls this "the surface that turns a database into an
advisor."

`CLEAR ALL` zeroed all 25 fields with **0 confirmation dialogs** and no undo — while every other
destructive action in the app confirms (`Delete set`, `Delete character`). I then navigated away and
found the set reading `0 EP` on the gear page, with nothing anywhere explaining why the whole
product's output had gone to zero.

**Fix.** Live set EP above the grid, updating as you type; `window.confirm` on CLEAR ALL, matching
the rest of the app.

### 7. Delay still renders as a signed bonus on both dense list surfaces — **fourth review** (CRITIQUE-02 #5 → 03 #15)

Half-fixed again, and the half that shipped is the half nobody complained about. `DLY` was removed
from `summarizeItem` (`gear.ts:124`) and from `statDeltas` (`:325`) — the doll and the delta line. But
both list surfaces still call `statVector(...).map(s => shortStatLabel + signed(s.value))` verbatim:
`ItemPicker.tsx:616-619` and `ItemBrowser.tsx:435-438`.

Driven, in the live Primary picker:

```
Monsoon, Sword of the Swiftwind   STR +20 · STA +19 · VR +10 · HASTE +46 · DMG +60 · DLY +45
                                  −200 HP  +46 HASTE  −40 AC  +38 DMG  +19 STA  −12 AGI
```

`DLY +45` is formatted identically to `HASTE +46` directly beside it. Delay is a cost. And because
the "fix" removed delay from the delta rather than converting it, the row reports `+38 DMG` while
**silently dropping the accompanying +24 delay**: Dagas 22/21 (ratio 1.048) → Monsoon 60/45 (ratio
1.333) reads as a 2.7× damage gain when the real improvement is +27% ratio. Neither ratio appears on
either surface, though the item window computes and prints it.

**Fix (unchanged).** Emit one synthetic `WEAPON` entry rendered in the doll's own form —
`60/45 dmg/dly · ratio 1.333` — and put `▲+0.29 ratio` on the delta line.

### 8. Zero live regions mount on the two screens that change the most — **fourth review** (CRITIQUE-02 #20 → 03 #8)

`grep -c aria-live src/**/*.tsx` is still **0**. `role="status"` is now up to 20 occurrences in
source, which is real progress — but I enumerated `[role="status"],[aria-live]` on the live DOM and
got **`(none)`** on the gear page, **`(none)`** in the open picker, and **`(none)`** after typing
`sword` into it (which moved the count from 418 matches). Removing an item announces nothing. The 20
nodes are on banners and dialogs that are not mounted where the changes happen.

The one thing that did land: focus after `Remove` now goes to `Ear 1: empty. Choose an item.` instead
of `<body>` — CRITIQUE-03 #5 is genuinely closed.

**Fix (unchanged).** `aria-live="polite"` on `.picker-meta`'s count and the browser's match span,
debounced; one visually-hidden polite region on the set page fed by the strings the KPI row already
computes.

### 9. The item browser still never names the character it colours against — **fourth review** (CRITIQUE-02 #17 → 03 #13)

Measured on the `.iname` elements: **59 red / 41 green** over 100 rows — the documented, deliberate
usability tint, working correctly. But `document.body.innerText` contains neither `Avenrae` nor
`BRD/WAR/BER`. There is no chip, no legend and no switcher on the page; the only green/red legend in
the product is on the landing page.

Half of this **did** get fixed and deserves credit: the table now has a real `<caption>` reading
`5,861 items, any slot, any class, any era, live content only, scored with the Melee DPS weights at
+0. Sorted by EP, descending. Showing 1 to 100.` — which is a genuinely good pattern.

The other half is verbatim. The scoring `<select>` still offers exactly the five presets and none of
the user's saved sets, so the apology line survives word for word: *"Scored against the Melee DPS
preset. Open any row for the full item, or your own set for cap-aware scoring."* Two EP scales in one
product, and the weaker one is on the page called ITEMS.

**Also, and new:** on a multiclass-first product the class filter is a single `<select>`
(`Any class / WAR / CLR / …`) with no "usable by my trio" option — CRITIQUE-03 N7, unfixed. The
predicate needed is the one already computing the 59/41 split.

### 10. Mobile scroll depth regressed — **fourth review** (CRITIQUE-02 #16 → 03 #16)

Measured first-slot-control document offsets, notice dismissed:

| width | 1600 | 1280 | 1024 | 768 | 430 | 390 | 320 |
|---|---|---|---|---|---|---|---|
| CRITIQUE-03 | 202 | 202 | 612 | 651 | 749 | 862 | — |
| **now** | 203 | 203 | 613 | 651 | **852** | **953** | 997 |

430px is **+103px worse** and 390px **+91px worse** than the last review measured; the 390px page is
now 3,515px tall (was 3,078). At 390×844 the entire first viewport is header, tab row, a 23-cell
glyph map and the top of the KPI stack — the first row a user came to edit is more than a full
viewport down.

Two things around it *did* land and should be recorded: the doll collapse moved from
`max-width: 720px` to **900px** (CRITIQUE-03 #9 closed), and horizontal page overflow is **0px at
every width including 320** (N9 closed).

`grep -c "pointer: coarse" styles.css` is still **0** — CRITIQUE-03 #17, fourth review.

### 11. The character page is half a character page

- **Name and race can never be changed.** `updateCharacter` is declared at `store.ts:52` and
  implemented at `:174` with **zero callers** — CRITIQUE-03 N3, fourth review. Race drives
  race-restricted filtering and the creation form labels it "RACE (OPTIONAL)", so the default `Unset`
  skews the pool permanently. The only remedy is DELETE CHARACTER, which destroys every attached set.
- **Sixteen class-level inputs for a three-class character.** `WARRIOR 50 … BARD 50 … BERSERKER 50`
  with thirteen inert `1`s between them, and the three that matter sit at grid positions 1, 8 and 16.
  `SHADOW KNIGHT SHD` is still the only two-line label, so its input sits ~14px below its row.
- **The set list is not here.** `CharacterDetail.tsx:58-60` renders only `sets[0]` as "Open Main Set".
  A character with five sets shows one, and the actual list lives on `#/characters`. The page that
  owns the character's identity does not own its work.

**Fix.** A name field and a race control wired to the existing action; sort the trio's classes to the
front of the levels grid (or collapse the other thirteen behind a disclosure); render
`setsForCharacter()` as a list here, the way `Characters.tsx:174` already does.

### 12. The money screen's zero state teaches nothing

A brand-new visitor who creates a character is dropped straight onto `#/set/{id}` — good, that is one
click saved — and sees 23 named-but-empty rows, a 23-cell glyph map, and seven zeroed KPI tiles. The
only prompt is inside an `aria-label` (`"Ear 1: empty. Choose an item."`), invisible to sighted users.
Nothing points at `✦ Auto-fill`, the button that turns this screen into a complete ranked plan in
**502 ms**.

This is out of character for the app: `#/characters` empty state teaches ("A character is a level, an
optional race and up to three classes. Item eligibility is the union of the trio…"), the picker's
no-results state teaches ("Try clearing filters, or allow content that is not yet live"), and the 404
teaches. The one screen the product is *for* does not.

**Fix.** One dismissible card in the doll's centre column when `slots` is empty: *"Nothing equipped
yet. Auto-fill places the best scoring item in every slot, or click any row to choose one yourself."*

### 13. Smaller, each verified

- **29 tab stops to reach Cancel** in the set-config dialog, 22 of them the always-expanded weights
  grid (11 inputs + 11 `Remove` buttons). CRITIQUE-03 N13, unfixed.
- **Item window speaks two vocabularies** — fourth review (CRITIQUE-02 #15 → 03 #14). The browser
  dialog prints `Class Warrior Paladin Ranger Shadow Knight Berserker`; the doll and picker print
  codes. `ItemWindow.tsx:131`'s `wide ?` branch survives verbatim, and `:150` still says `Weight`
  where the client says `WT`.
- **No `#/about` route** despite `DESIGN.md` §3 promising a provenance page, and no `/{ruleset}/`
  prefix despite the same section calling it a day-one decision.
- **No `document.title` per route** (grep: zero occurrences) and no skip link. In an SPA the title is
  the only label in the browser's tab strip.
- **The picker has no sort control** — EP only, on the surface used 23 times per set. (The item
  browser *does* have sortable columns with correct `aria-sort` — credit where due.)
- **The landing hero still illustrates the wrong surface.** The caption says the green/red rule
  belongs to the item browser; the picture beside it is a 23-cell paper-doll mock. CRITIQUE-03 N16,
  unfixed.
- **`50 BRD/WAR/BER` renders twice in one viewport** on the set page (header sub-line at y≈118, tab
  row at y≈164) with nothing distinguishing them. N20, unfixed.

---

## Click and keystroke counts, per workflow

Measured by driving each path. "Competitive?" is against sixtyupgrades.

| Workflow | Measured cost | Competitive? |
|---|---|---|
| **Plan a pre-raid set from scratch** | 1 click to reach creation · **4 clicks + 9 keystrokes** to create (lands directly on the set) · **1 click** to Auto-fill 23 slots in **502 ms**. Total **6 clicks + 9 keystrokes** to a complete ranked set. Manual instead: 46 clicks + ~280 keystrokes. Then tiering: **+230 clicks** (no bulk +N). | **Yes, then no.** The first 90 seconds beat the bar outright — no account, no wall, one button. The last step has no equivalent on the bar and is unshippable at 230 clicks. |
| **Evaluate a single drop mid-raid** | Via the slot picker: **2 clicks + ~15 keystrokes** → `29.0 EP · −16 vs worn` plus a six-chip delta. Via `#/items` (the path a loot link lands on): **2 clicks + ~15 keystrokes** → an item window with **no EP, no delta, no verdict**, and equip hardwired to `sets[0]`. | **Yes on one path, no on the other.** The picker beats the bar. The browser dialog is the surface a raider actually reaches and it is the one that withholds the answer. |
| **Share a set with a guild** | **2 clicks** (🔗 Share → Copy). 282-character link. Opens read-only in a clean profile with `SAVE A COPY`, zero console errors, every item, tier and weight intact. | **Better than the bar.** sixtyupgrades needs an account to persist a set; this needs nothing. Best workflow in the product. |
| **Compare two sets and decide** | **2 clicks** to open the diff (⋯ → Compare with…, or ⇄ in the set switcher). Then: 22 `UNCHANGED` rows around 1 change with no filter; two KPI tiles disagreeing (+16 EP vs −9 creditable); the decisive −36% haste 1,400px below the tiles; **no way to apply a change** — ~4 clicks + a search per item to carry it across by hand. | **Opening it: better than the bar. Using it: no.** The bar makes you open two tabs. This opens one and then makes you open the second anyway to act. |
| **Import a real character from `/outputfile inventory`** | **Impossible.** File inputs accept `application/json,.json`; the project's own Tier-0 export returns *"That file could not be read as JSON."* Manual equivalent: **46 clicks + ~280 keystrokes**, plus up to 230 more for tiers. | **N/A to the bar** (WoW emits no such file) — which is exactly why it is the biggest available win. `DESIGN.md` §6 asked for the file *in order to* support importing it. |
| **Re-plan after switching loadout** | **2 clicks** (loadout `<summary>` → pick), pickers re-rank live. But the loadout is a **character** property, so the switch silently re-lenses every other set of that character, and the compare screen can never show two different trios. See S1. | **Cheap but wrong.** The gesture beats the bar's spec switcher; the data model does not support the thing the gesture implies. |

Latency, for completeness, since it gates every count above: picker cold-open **122ms/109 matches**
(Head), **71ms/418** (Primary), **75ms/1,840** (Any Slot 1). CRITIQUE-03 F2 measured 214/206/319ms
with a 2,119ms TBT on the Any Slot; commit `ac83c44` closed it completely. Auto-fill is 502ms for 23
slots. Zero console errors and zero page errors on every route I drove.

---

## Are the EQL systems first-class or bolted on?

| System | Verdict |
|---|---|
| **Multiclass loadouts with per-class levels** | **Bolted on.** The engine is first-class — union eligibility, best-of-three proficiency, a real loadout editor, a switcher in the action bar, `50 BRD/WAR/BER` in the client's own format. The *model* is not: the loadout belongs to the character, so it cannot vary per set (S1), and the levels UI shows 16 inputs for a 3-class character with the three that matter at positions 1, 8 and 16. |
| **+0..+10 upgrades** | **First-class per item, absent as a plan.** The stepper is excellent: `role="spinbutton"`, `aria-valuetext`, arrow keys, Shift-for-five, End-for-ten, an 11-step colour ramp, a preview tier in both the picker and the browser, and the tier travels in the share link. But there is no way to express "my set at +5", which is the only form the number takes in a real player's head. 230 clicks is the current answer. |
| **The two Any Slots** | **First-class.** Present in the layout, flagged `flex`, correctly excluded from weapon crediting (`ScoreContext.weaponCounts`), ranked over a 1,840-candidate pool in 75ms, and reachable from the item browser's equip targets. No complaints. |
| **Exaltations** | **Bolted on.** Sockets are correctly derived from +N rather than looked up — that is the right architecture and the header explains it well. The tab itself is 23 identical rows, 685px of dead space each, one derivable fact printed 24 times, and it is inert until someone spends finding #2's clicks. It is a third of the money screen's tab bar carrying a fraction of its weight. |

---

## Gaps versus sixtyupgrades' feature set

**Absences that hurt:**

1. **Buffs / consumables — and it is worse here than there.** On sixtyupgrades a buffs tab is a
   convenience. Here it is load-bearing, because buffs are most of the distance between the planner's
   `STR 119/510` and the client's `STR 304/510`. Without it the cap system is dead (S2), and a player
   cannot ask the question they actually ask: *"with a Symbol and a shaman haste on me, does this
   still win the slot?"* One panel of typed offsets fixes the feature and the cap column together.
2. **Nothing to act on a comparison.** Both the compare screen and the item-browser dialog report
   without letting you commit. See findings #3 and #4.
3. **No "usable by my trio" filter** on the item browser, on a multiclass-first product.

**Correctly out of scope, and I would reject them if proposed:**

- **3D model view.** No client assets exist to render; `DESIGN.md` §4 names it a non-goal; the
  anatomical glyph figure is an honest substitute that carries slot identity without pretending.
- **Talent calculator.** EQL's analogue is invocations/stances/general abilities, and while
  `research/data/eqlmcp-eqlbuilds-{invocations,stances,general-abilities}.json` do ship in the repo,
  an AA planner is a second product. The *loadout* half of it, however, is not optional and is
  currently attached to the wrong object (S1).
- **Phase filtering.** Already present and **ahead of the bar**: an era filter, a `Live content only`
  toggle, a source filter, per-set default filters that the pickers inherit and Auto-fill now honours
  and names.
- **Autofill.** Present, 502ms, obeys the set's own filters, reports what it applied.

---

## Recurring unfixed items, named as such

Fourth consecutive review unless noted.

| Item | First raised | Status now |
|---|---|---|
| Exaltations layout, per-row note ×23, no bulk +N | 02 #19 → 03 #18 | verbatim unchanged; note count still 24 |
| Weights tab: no feedback, unconfirmed CLEAR ALL | 03 N6 | verbatim; 0 confirm dialogs, no EP on the tab |
| Items screen never names its colour context; apology line; 5 presets only | 02 #17 → 03 #13 | half fixed (caption landed), half verbatim |
| `DLY` signed on both list surfaces; no ratio; delay dropped from the delta | 02 #5 → 03 #15 | still live on `ItemPicker.tsx:616` and `ItemBrowser.tsx:435` |
| Live regions on picker/gear/items/weights | 02 #20 → 03 #8 | 0 `aria-live`; 0 mounted `role="status"` on those screens |
| Mobile scroll depth | 02 #16 → 03 #16 | **regressed** +103px at 430, +91px at 390 |
| No `(pointer: coarse)` anywhere | 02 #16 → 03 #17 | grep count 0 |
| Item window two vocabularies; `Weight` not `WT` | 02 #15 → 03 #14 | `wide ?` branch verbatim |
| Character name/race unchangeable (`updateCharacter`, 0 callers) | 03 N3 | verbatim |
| `#/items` dialog gives no upgrade verdict | 03 N4 | verbatim |
| Compare: no changed-only filter; `CREDITABLE STAT GAIN` mixes units | 03 N5 | verbatim |
| No trio filter on the browser | 03 N7 | verbatim |
| No `document.title` per route; no skip link | 03 N8 | verbatim |
| 29 tab stops in the set dialog | 03 N13 | verbatim |
| Landing hero illustrates the wrong surface | 03 N16 | verbatim |
| No `#/about`, no `/{ruleset}/` | 03 N20, `DESIGN.md` §3 | verbatim |

---

## What genuinely works

Recorded so it survives the next refactor. All of this I drove myself.

- **The share link is the best thing in the product.** 2 clicks, 282 characters, a clean profile
  opens it read-only with `SAVE A COPY`, and every item, tier, exaltation donor, per-class level and
  weight comes back intact with zero errors. `DESIGN.md` §1's "the URL is the product" is delivered.
- **The picker rebuild is now fast as well as good.** 71–122ms cold open, 1,840 candidates on an Any
  Slot at 75ms, a search box, a zone/mob/quest box, era, source, `Live content only`, `Hide No Drop`,
  a preview tier, EP ranking that honours the set's own weights, `Equipped:` context, `−16 vs worn`,
  and a no-results state that names the two fixes. CRITIQUE-03's 2,119ms Any-Slot TBT is completely
  gone.
- **Auto-fill fills 23 slots in 502ms, obeys the set's default filters, and says what it applied.**
  CRITIQUE-03 #7 fully closed, and the notice is now a fixed-position toast that auto-dismisses and
  holds on hover — `.set-header` measured at `top: 76` before and after the click. CRITIQUE-03 #3,
  three reviews running, closed.
- **The item browser table is now a real table.** `role="button"` and the row `aria-label` are gone,
  all six `<th>` carry `scope="col"`, a `<caption>` names the current filter and sort state, and the
  sortable columns expose correct `aria-sort`. CRITIQUE-03 #2, three reviews running, closed.
- **Focus after a destructive action is restored** to `"Ear 1: empty. Choose an item."`.
  CRITIQUE-03 #5 closed.
- **Compare's EP column is now honest.** `+16 · 702.7 → 718.7` — headline and subtitle on one scale,
  and the banner names the lens it actually used. CRITIQUE-03 F1/#4 closed. The 23-row slot table
  with SWAPPED/RETUNED/ADDED/REMOVED badges and five stat groups labelled `4 of 7 changed · ceiling
  510` is real, careful work; my complaints about it are about what it refuses to do, not about
  whether it is correct.
- **Horizontal overflow is gone to 320px** on every route I measured, and the doll collapse moved to
  900px. CRITIQUE-03 #9 and N9 closed.
- **Empty and error states elsewhere are exemplary.** The Characters zero state teaches the trio
  rule; the picker's no-results names both remedies; `#/nonsense/route` renders *"NOTHING HERE —
  #/nonsense/route is not a page in this planner"* with a way back; the JSON importer refuses a
  non-JSON file with a plain sentence.
- **Zero console errors and zero page errors** across every route, dialog and viewport width driven
  in this review, including a shared link opened in a cold browser profile.

---

## The one thing to build next

An importer for `/outputfile inventory`. It converts the app's worst workflow (46 clicks + 280
keystrokes + up to 230 more clicks, or "give up") into a paste; it is the only capability in this
review with no equivalent on sixtyupgrades, because no other game hands the planner a complete,
tiered, 23-slot inventory in a tab-separated file; the file format is already sitting in
`research/validation/` and `DESIGN.md` §6 asked for it by name; and it lands a real player on a real
character in one step, which is the precondition for every other finding above mattering to anyone.
