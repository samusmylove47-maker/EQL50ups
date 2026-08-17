# VERIFY-04 — adversarial verification of the round-4 fix batch

> **Historical record — figures predate the 2026-08-17 era purge.** The catalog described here
> shipped 11,249–11,252 items with out-of-era content hidden behind a "Live content only"
> toggle. It now ships 3,533; 7,719 records are quarantined in `pipeline/quarantine.json`, and
> the toggle has been removed because it could no longer change a single row. Every count below
> was correct when measured and is not current. See `research/SOURCING-STANDARD.md`.

**Method.** Every number below is mine. Nothing is taken from the claims. Built
`npm run build` from the tree at `8190602`, served the `dist` output on
`127.0.0.1:4231` (later `:4233`, see *Provenance*), drove Chromium
`/opt/pw-browsers/chromium-1194` with `--no-sandbox`, and read the PNGs rather
than only querying the DOM. Store-level assertions were taken against the live
`useCatalog` store through a Vite dev server on `:4232`, not through any screen.

**Verdicts**

| | Claim | Verdict |
|---|---|---|
| A | Picker equips the highlighted item | **CONFIRMED** |
| B | Compare's cap-awareness is real | **PARTIAL** — per-slot column fixed; headline KPI still on a second scale |
| C | Auto-fill respects the set's default filters | **CONFIRMED** |
| D | Catalog duplicates are gone | **CONFIRMED** (race forced, asserted at store level) |
| E | Performance | **CONFIRMED** (post-fix numbers; "before" not verifiable) |
| F | Accessibility batch | **PARTIAL** — 3 of 5 sub-claims hold; "focus never drops to `<body>`" is **REFUTED** |
| G | Wiki markup no longer ships as data | **REFUTED** |

---

## Provenance — the tree moved under me

I started against `8190602 Strip wiki markup out of acquisition data`. While I
was measuring, two further commits landed from another session:
`dbed1f7` (a critique doc) and `681b943 Close four defects that had recurred
across three reviews`, and `web/dist` was rebuilt at 07:48:53 with a third
agent's uncommitted work in it.

Everything through 07:47 ran against **my own build of `8190602`** — that covers
claims A, B, C, D, E, G and all of F except the 400/480 px sweep. For the
remainder I extracted `HEAD` with `git archive` into a scratch tree outside the
repo, built it there, and served that on `:4233`. `681b943` touches only
`ItemPicker.tsx` (one formatter call), `ItemBrowser.tsx`, `gear.ts`,
`styles.css` and `tokens.css`; it touches **none** of `Characters.tsx`,
`setDiff.ts`, `SetCompare.tsx`, `data/catalog.ts` or `pipeline/build.mjs`, so
every finding below reproduces at current `HEAD`. The three I care most about I
re-ran explicitly against the pinned `HEAD` build and say so inline.

---

## A. The picker equips the highlighted item — **CONFIRMED**

`resolveActive()` holds the highlight as an item name and re-derives the index
during render, and `Enter` reads `rows[activeIndex]` from the same render pass —
so the two cannot disagree in the frame `Enter` fires. That holds up under
driving. Nine paths, zero console errors, zero page errors:

| # | Path | Held | After re-rank | Equipped |
|---|---|---|---|---|
| A1 | Head, ↓×4, preview +0→+10 | Platinum Tiara @ row 5 | row 3 | **Platinum Tiara** ✓ |
| A2 | Chest, Ctrl+End, +0→+10 | Tin Patched Tunic\* @ row 84 | row 84 | **Tin Patched Tunic\*** ✓ |
| A3 | Legs, PgDn×2, +0→+10 | Small Steel Greaves @ row 21 | row 29 | **Small Steel Greaves** ✓ |
| A5 | Hands, mouse hover + shift-click stepper, click row | Dark Mail Gauntlets | — | **Dark Mail Gauntlets** ✓ |
| A6 | Any Slot 1 (1,729 matches), ↓×7, +0→+10 | Imbrued Platemail Breastplate @ row 8 | row 10 | **Imbrued Platemail Breastplate** ✓ |
| A7 | Neck, preview +10 first, PgDn/↓/↑, then +10→+0 | Investigator's Badge @ row 11 | row 43 | **Investigator's Badge** ✓ |
| A8 | Wrist 1, ↓×6, tier change then **immediate** Enter (no settle) | Lustrous Russet Bracer | — | **Lustrous Russet Bracer** ✓ |
| A4b | Feet, ↓×5, then type "boots" mid-selection | Golden Efreeti Boots @ row 6 | reset to row 1 | **Indicolite Boots** = row 1 ✓ |
| A9 | Back, ↓×5, then check "Hide No Drop", immediate Enter | Hooded Black Cloak @ row 6 | reset to row 1 | **White Dragonscale Cloak** = row 1 ✓ |

A4b and A9 are the membership-changing filters, where the design deliberately
resets to row 1. I checked that the reset is honest rather than a shrug:
`aria-activedescendant` was `picker-option-0` and the highlighted row was
`picker-option-0`. For A9 I verified against `BACK.json` that the two rows above
the equipped one (`Cloak of Scales`, `Brewer's Mesh Cloak`) really are
`NO_DROP`, so `White Dragonscale Cloak` genuinely *is* the new row 1.

I also checked that the *tier* survives the trip, not just the identity. A1's
Platinum Tiara ships `st: {AC:3, HP:35, MANA:50}`; the doll after Enter reads
`AC +13 · HP +70 · MANA +100` with a `+10` badge — the +10 scaling, not the base
row. Screenshot: `A1-after.png`.

One coupling worth stating: `resolveActive` resolves by `findIndex` on the item
**name**. It is correct only while names are unique in the list, which is exactly
what claim D guarantees. A and D are not independent fixes.

## B. Compare's cap-awareness — **PARTIAL**

**The half that landed.** The per-slot EP column now agrees with the picker to
the last printed digit, in a normal slot and in an Any Slot. Same set, same
weights (`{AC:1, HP:.2, MANA:.2, STR:.5, STA:.5, AGI:.5, DEX:.5, WIS:.5,
INT:.5, CHA:.2, RATIO:20}`), read off both screens:

| Slot | Item | Compare column | Picker row |
|---|---|---|---|
| Chest | Brutish Breastplate +3 | 36.0 EP | **36.0** |
| Primary | Earthshaker +0 | 14.1 EP | **14.1** |
| Head | Platinum Tiara +0 | 20.0 EP | **20.0** |
| **Any Slot 1** | Fangol +2 | 14.5 EP | **14.5** |

The lens banner also names the right set in both directions. With A carrying no
weights: *"scored under **Beta**'s profile … **Alpha** is worth 0.0 EP under its
own. Alpha carries no weights at all…"*, and the slot-header hint switches to
"EP scored under Beta's weights". With two different non-zero profiles it names
Alpha and reports Beta at 65.0 EP under its own. Both correct.

**The half that did not.** The headline KPI is computed by `totalEp()`
(`setDiff.ts:303`), which calls `scoreItem(entry.item, entry.upgrade, weights)`
with **no `existing` and no `weaponCounts`**. So the tile and the column beneath
it are two different scales. Isolated control, two items only:

| Set A | per-slot column | KPI subtitle |
|---|---|---|
| Head: Platinum Tiara + **Primary**: Earthshaker | 20.0 + 14.1 = **34.1** | 34.1 → 0.0 ✓ |
| Head: Platinum Tiara + **Any Slot 1**: Earthshaker | 20.0 + **3.5** = **23.5** | **34.1** → 0.0 ✗ |

Move the same weapon from a hand to an Any Slot and the column drops 10.6 EP
while the headline does not move at all — 31 % of the number on a two-item set.
Re-run against the pinned `HEAD` build with a slightly narrower profile: column
20.0 + 6.0 = 26.0, KPI subtitle "36.6 → 0.0". Same 10.6 EP gap.

This is the app contradicting its own stated rule. The Any Slot picker prints,
in so many words, *"Any Slot takes any wearable item — a worn position, not a
hand, so weapon damage scores nothing here"*, and `rankSlotItems` and `sideFor`
both honour it. `totalEp` does not.

The claim's literal wording — "the KPI tile and its subtitle use one consistent
EP scale" — is true: −80.5 really is 23.5 − 104.0. It is consistent *with
itself*. It is not consistent with the twenty-three rows underneath it, which is
the thing that was broken. And the same omission means the totals are not
cap-aware either; that half is unobservable with shipped gear only because no
23-slot set reaches the 510 ceiling.

## C. Auto-fill respects the set's default filters — **CONFIRMED**

Four filter configurations, run through the real Auto-fill button, with every
placed item cross-checked by name against `public/data/items-index.json` merged
over `public/data/items/*.json`:

| `defaultFilters` | placed | era violations | NO_DROP violations | source violations |
|---|---|---|---|---|
| `{era:'Sky', hideNoDrop:true}` | 10 | 0 | 0 | — |
| `{era:'Classic', hideNoDrop:true}` | 23 | 0 | 0 | — |
| `{source:'quest'}` | 23 | — | — | 0 |
| `{source:'vendor', hideNoDrop:true}` | 20 | — | 0 | 0 |

**0 violations out of 76 placements.** The pickers on the same screen open with
the same three filters (read off the live `<select>` and checkbox values), so
the two surfaces agree.

The notices are honest and name what was applied:

- `Auto-fill placed 10 items (Sky era, No Drop hidden) · 13 slots had no match: Ear 1, Ear 2, Head, Face, Shoulders, Arms, Back, Wrist 2, Hands, Chest, Legs, Feet, Ammo.`
- `Auto-fill placed 20 items (Vendor only, No Drop hidden) · 3 slots had no match: Ear 2, Fingers 1, Fingers 2.`
- With an unreachable era: `Auto-fill placed nothing (Chardok Revamp era). Every candidate was excluded by this set's filters — widen them in Edit, or clear them for this run.`
- With no filters: `Auto-fill placed 23 items.` — no parenthetical, correctly.

Minor: `excludedByFilters` is computed for every run but only surfaced in the
"placed nothing" branch. In the 10-of-23 Sky run the notice cannot tell you
which of the 13 empty slots the *filters* emptied versus which had nothing
worth scoring. Not a defect against the claim, but the information is already
in hand and thrown away.

## D. Catalog duplicates — **CONFIRMED**

First, the shipped data really does set the trap: the 19 shards hold **12,376
rows** for **11,249 distinct names** — 1,127 items ship in more than one shard —
and the index holds exactly 11,249. So 12,376 was reachable and 11,249 is the
right answer.

Asserted at the **store**, not through the item browser. I delayed
`items-index.json` by 6 s via request interception so the shards win the race,
called `useCatalog.getState().ensureAll()` directly, and probed while
`indexNames.length === 0` (proof the index had not landed):

```
D1  status=ready  revision=1  indexNames=0   ← shards only, index still in flight
    items.length            11249
    new Set(names).size     11249     ← items.length === Set(names).size ✓
    byName.size             11249
    duplicate lowercased names   0
    per-slot bucket duplicates   {}   (all 19 buckets)
    shards ready                 19
```

Same assertion holds with no delay (`D2`) and with the index alone and no
`ensureAll` (`D3`). The claim stands.

**But the adjacent race is live and it loses data — see R1.**

## E. Performance — **CONFIRMED** (post-fix half)

`Emulation.setCPUThrottlingRate {rate: 4}` via CDP, a
`PerformanceObserver({entryTypes:['longtask']})` installed in an init script
before any interaction, buffer cleared immediately before each press. TBT is
`Σ max(0, duration − 50)`.

**Any Slot cold open** (index loaded, shards not; click → `ensureAll` → 1,729
matches), three fresh browsers:

| run | long tasks | TBT | longest task | first rows painted |
|---|---|---|---|---|
| 1 | 3 | **725 ms** | 397 ms | 1,744 ms |
| 2 | 3 | **756 ms** | 487 ms | 1,502 ms |
| 3 | 3 | **647 ms** | 412 ms | 1,535 ms |

3 tasks, mean TBT 709 ms. The claimed shape (~3 tasks / ~700 ms) is what I
measure. I cannot verify the 21-task / 2,596 ms "before" without rebuilding a
prior tree, so I am confirming the post-fix number only.

**"Live content only", FIRST press in each direction** (Any Slot, fully settled
first, no toggle-and-back):

| direction | tasks | TBT | longest | result |
|---|---|---|---|---|
| checked → unchecked (1st) | 1 | **0–1 ms** | 50–51 ms | 1,729 → 4,530 matches |
| unchecked → checked (1st) | 0 | **0 ms** | — | 4,530 → 1,729 matches |

Three runs, identical. The 194 ms is gone in both directions, not just on the
warm return leg. Moving `liveOnly` out of the rank cache key and into the `rows`
filter did what it says.

First press of every other picker control, same conditions, for context:

| control | tasks | TBT | longest |
|---|---|---|---|
| Hide No Drop | 1 | 0 ms | 50 ms |
| era → Classic | 0 | 0 ms | — |
| source → Drops | 0 | 0 ms | — |
| preview tier +1 | 1 | 73 ms | 123 ms |
| type "sword" | 1 | 26 ms | 76 ms |

## F. Accessibility batch — **PARTIAL** (3 of 5)

### F1. Item-browser rows expose all six columns — **CONFIRMED**

Read from the accessibility tree via `Accessibility.getPartialAXTree` and
`queryAXTree`, not from the DOM. The `<tr>` resolves as `role: row`, `name: ""`
— correctly nameless, so nothing replaces its contents — with **six** `cell`
nodes, none ignored:

```
"Golden Sash of Tranquility" | "WAIST" | "MNK"
| "AC +5 · STR +15 · AGI +15 · DEX +15 · HASTE +41" | "SKY" | "118.0"
```

which is character-for-character the visible `<td>` text. Fixed.

### F2. Focus never drops to `<body>` after a destructive action — **REFUTED**

Nine destructive controls, each in a **fresh browser context** with keyboard
activation so `:focus-visible` is genuine:

| action | focus lands on |
|---|---|
| Delete a set — **Characters screen** | **`<body>`** ✗ |
| Delete a set — Characters screen, mouse | **`<body>`** ✗ |
| Delete a character | `<h1 class="page-title">` ✓ |
| Clear one slot — paper doll | the slot button, now "Head: empty" ✓ |
| Clear slot — from inside the picker | the slot button ✓ |
| Escape out of the picker | the slot button that opened it ✓ |
| Delete set — from the set editor | `<h1 class="page-title">` ✓ |
| Clear all slots (⋯ menu) | `<summary aria-label="More set actions">` ✓ |
| **Dismiss the notice toast** | **`<body>`** ✗ |
| **Delete a loadout** (character screen) | **`<body>`** ✗ |

Three counterexamples. The first is the one the batch specifically claimed:
`768c1be`'s own message says *"Completes the destructive-control assertion:
every control in the app that destroys something is now checked, including the
two that navigate."* It is not complete. `Characters.tsx` restores focus in two
places — a mount-time `useEffect` (which only helps the *navigating* delete,
because that remounts the screen) and an explicit `titleRef.current?.focus()`
inside the **Delete character** handler. The **Delete set** handler at
`Characters.tsx:216-224` has neither:

```tsx
onClick={() => {
  if (window.confirm(`Delete set "${gearSet.name}"?`)) deleteSet(gearSet.id);
}}
```

The `<li>` carrying that button unmounts and focus falls to `<body>`. Verified
the deletion actually happened (the set name went from 1 occurrence to 0), and
re-confirmed against the pinned `HEAD` build: *deleted = true, focus lands on
BODY*.

The loadout delete is the same shape on `CharacterDetail` — I watched "Main"
disappear from the loadout list and focus land on `<body>`
(`F2-char-after.png`).

### F3. Every focusable control has a visible focus ring — **CONFIRMED**

Not a computed-style check — a **pixel** check. Walked the whole tab order (Tab
until it wraps), and for each stop screenshotted its bounding box + 6 px padding
focused, blurred it, screenshotted again, and compared SHA-1. An unchanged
region means an invisible indicator.

| surface | tab stops | stops with no pixel change |
|---|---|---|
| Landing | 8 | 0 |
| Characters | 20 | 0 |
| Set editor · gear | 40 | 0 |
| Set editor · weights | 38 | 0 |
| Item browser | 30 | 0 |
| Compare | 8 | 0 |
| Picker modal | 10 | 0 |
| Share dialog | 3 | 0 |
| Edit dialog | 16 | 0 |

**173 stops, none silent.** That includes all 8 `<summary>` elements reachable
on the set editor — *Switch set, Switch loadout, More set actions, Weapons,
Regen, Stats, Resists, Full client stat sheet*. Worth noting the mechanism
differs by control: `styles.css:438` sets `outline: none` on
`input/select/textarea` and signals focus with a border-colour swap to
`--accent` instead. It is visible (it changes pixels), but it is a border, not
the 2 px ring the rest of the app uses — so "every control has a focus **ring**"
is loose. The requirement it exists for is met.

### F4/F5. No clipping 1600→360, no overflow at 320 — **PARTIAL**

Eight routes × fifteen widths (1600, 1440, 1280, 1024, 900, 820, 768, 640, 560,
480, 414, 390, 375, 360, **320**), measuring
`documentElement.scrollWidth − clientWidth` and hunting elements with
`overflow: hidden|clip` whose content exceeds their box.

**No horizontal page scroll on any route at any width, 1600 down to 320.**
Repeated with each overlay open in isolation — picker (Head), picker (Any Slot,
1,729 rows), set switcher, loadout menu, ⋯ menu, share dialog, edit dialog — at
320 and 360: **all 14 combinations clean**. F5 holds. Screenshots read, not just
measured: `F4-set-gear-320.png`, `F4-items-320.png`, `F4-compare-320.png`.

Two things the absolute wording does not survive:

1. **480 px, set switcher open: 67 px of horizontal page scroll.** The
   `.menu-body` runs from x=357 to x=547 in a 480 px viewport, and the `⇄`
   compare button on the Beta row is cut off the right edge —
   `F6-480-set_switcher_menu.png`, and you can see the truncation. 480 is inside
   "1600 down to 360". This predates the batch (the `⇄` button arrived in
   `4937df5`) but the batch added responsive assertions that did not catch it.
2. `TD.cell-stats` is `text-overflow: ellipsis` and is truncating **at 1600**,
   by 12–56 px on four of the first ten rows. Deliberate — the full vector is in
   the item window — but it means "no text clips at any width" is not literally
   true even at desktop width.

## G. Wiki markup no longer ships as data — **REFUTED**

Scanned all **54,734** acquisition strings across `items-index.json` and the 19
shards (`src.z`, `src.m`, `src.q`, `src.v`). **18 still carry wiki markup:**

| pattern | count | example |
|---|---|---|
| `'''bold'''` | 13 | `Fungus Covered Great Staff` → `'''No Longer Drops'''` |
| external `[url text]` | 2 | `Goblin Gazughi Ring` → `See [https://everquest.allakhazam.com/db/item.html?item=1653#m6221397764320535552 these comments] on Alla.` |
| leading table pipe | 2 | `Goblin Backstabber` → `\|Description: Drops off random goblins in Droga` |
| **HTML comment** | 1 | `Evergreen Leaf` → `<!-- Location is adaptive and will switch between Greater Faydark Map and Kelethin Map depending on Loc. Leave as Greater Faydark -->` |

The narrow sub-claims are nearly true — zero `{{templates}}`, zero `[[links]]`,
and the one surviving HTML construct is a comment rather than an element tag.
But the headline claim, "acquisition text is sanitised", is not.

The escape hatch is visible in `pipeline/build.mjs:1202`:
`.replace(/<[^>]{0,80}>/g, ' ')` — bounded to 80 characters, and the Evergreen
Leaf comment is 129. There is no rule at all for `'''`, for `[url text]`, or for
a leading `|`.

And it renders. Opened the Fingers 1 picker, unchecked "Live content only",
searched *Gazughi*, and read the row (`G-wikilink.png`):

> **Goblin Gazughi Ring** `KUNARK` `NOT LIVE` `MAGIC`
> AC +1 · MR +5
> `It may take a while to get this to drop. See [https://everquest.allakhazam.com/db/item.html?item=1653#m6221397764320535552 these comments] on Alla., …`

A 60-character raw URL inside square brackets, on the source line of a shipping
picker row. The Primary picker likewise renders
`'''No Longer Drops''', Old Sebilis` for `Fungus Covered Great Staff`.

---

## Regressions and collateral

### R1 — the index load wipes every shard's detail (data loss, realistic)

Found while forcing D's race. `load()` (`catalog.ts:339`) does a wholesale
`set({ items, ...indexItems(items) })`. If any shard has already merged, that
replacement **discards it**, and `shards[slot]` still reads `'ready'` so
`ensureSlot` refuses to re-fetch. The catalog is permanently degraded for the
session.

Store-level, index delayed 6 s:

| | `items` | `src` | `fx` | `rl` | shards "ready" |
|---|---|---|---|---|---|
| after `ensureAll`, before the index | 11,249 | **8,188** | **1,583** | **5** | 19 |
| after the index lands | 11,249 | **0** | **0** | **0** | 19 |
| after calling `ensureSlot('HEAD')` again | 11,249 | 0 | 0 | 0 | 19 |

Not a synthetic race. `items-index.json` is 1.99 MB; `HEAD.json` is 63 KB.
On CDP-throttled **1.5 Mbps**, no request stubbing at all — load the set editor,
click Head:

```
EARLY (shard merged, index still downloading): 18 rows, source line present
    "Platinum Tiara … Lower Guk · a froglok tactician"
LATE  (index landed):                          18 rows, 0 source lines anywhere
```

Screenshots `race-early.png` / `race-late.png` — the whole grey source column
vanishes. Re-confirmed on the pinned `HEAD` build: 13 source lines → **0**.

What is lost: `src` (every zone/mob/quest line and therefore the zone filter),
`fx` (focus effects in the item window), `sz`, and `rl` — **required level,
which gates `canUse` eligibility**. On a slow connection this app silently stops
enforcing level requirements and stops telling you where anything drops.

### R2 — `npm test` is red at `HEAD`

`src/engine/ep-scorer.test.ts > rankScorer > returns exactly what scoreItem
totals, for every shipped item at every tier` **fails 3 runs out of 3** on a
pristine `HEAD` build — by timeout, not assertion.

It compares 8 profiles × 5 tiers × 11,249 items ≈ 450,000 `scoreItem` calls.
Alone it takes **3,309 ms** against vitest's 5,000 ms default; inside a full
36-file parallel run it exceeds the budget every time.

This matters more than an ordinary flake. The test was added by this batch
(`ac83c44`), and `ep.ts:129` leans on it in prose: *"The order is load-bearing:
it makes the running sum float-identical to `scoreItem`'s, which `ep.test`
asserts item for item across the shipped catalog **so the two can never
drift**."* The guard that sentence points at does not run to completion. The fast
ranker and `scoreItem` are currently unguarded.

(Separately, `src/lib/inventoryImport.test.ts` fails 3 tests, but that file is
untracked WIP from a concurrent session, not this batch. I report it only so
nobody mistakes it for a batch regression.)

### R3 — clean on every standing check

For balance, what did *not* break. Ten routes, fresh context each:

```
ok  #/                          errors=0  junk=[]
ok  #/characters                errors=0  junk=[]
ok  #/character/c1              errors=0  junk=[]
ok  #/character/new             errors=0  junk=[]
ok  #/set/set_a                 errors=0  junk=[]
ok  #/set/set_a/exaltations     errors=0  junk=[]
ok  #/set/set_a/weights         errors=0  junk=[]
ok  #/set/set_a/compare/set_b   errors=0  junk=[]
ok  #/items                     errors=0  junk=[]
ok  #/nope                      errors=0  junk=[]
```

Zero console errors and zero page errors across every interaction in this
document — roughly 60 browser sessions. No `NaN`, `undefined`, `[object Object]`
or `Infinity` in any rendered body text.

The v1→v2 migration standing check passes: seeded a `version: 1` payload
(`{level: 44, classes: ['WAR','ROG','BRD']}`), reloaded, header reads
**`44 WAR/ROG/BRD · Dwarf`**, the set survives with its `HEAD` slot intact, and
the stored payload comes back as `version: 2`.

---

## Score: **6 / 10**

Four of seven claims are real, and one of them is the CRITICAL one — the picker
now equips what is highlighted through nine separate paths including the two
races (immediate-Enter after a tier change, immediate-Enter after a filter
toggle) that the naive fix would have failed. C is airtight: 76 placements, zero
violations, checked against the shipped bytes. D is right and I could not break
it even with the race forced. E reproduces to within 8 % of the claimed figure
and holds in *both* toggle directions, which is the part a lazy benchmark would
have faked.

What costs the other four points is the shape of the misses, not the count. Two
of the three failures are claims stated as absolutes — "focus **never** drops to
`<body>`", "**no** zone/mob/quest string contains…" — and both die to a single
counterexample found in the first place I looked. `768b1be`'s commit message
asserts the destructive-control audit is *complete*; the Delete button on the
Characters screen, twelve lines from the Delete-character button that *was*
fixed, drops focus to `<body>`. That is the same failure mode the previous round
was pulled up for.

B is the most expensive. The per-slot column was genuinely fixed and the fix is
exact to the last digit — but the fix stopped at `sideFor` and never reached
`totalEp`, so the screen still carries two EP scales, and the headline number is
the one on the wrong scale. "An item scores identically in both" is true; "the
compare screen agrees with itself" is not.

And R1 is the finding I would fix before any of the above. Verifying D's race
turned up a worse one three lines away: on any connection where a 63 KB shard
beats a 1.99 MB index — which is the *normal* ordering on a slow link — the app
throws away 8,188 acquisition records, 1,583 focus effects and every required
level, marks the shards done so they can never be refetched, and says nothing.
The batch went looking for duplicate rows in this exact code path and did not
look at what happens when the other side of the race wins.
