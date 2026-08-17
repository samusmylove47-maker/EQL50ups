# CRITIQUE-01 — EQL Upgrades vs sixtyupgrades.com

> **Historical record — figures predate the 2026-08-17 era purge.** The catalog described here
> shipped 11,249–11,252 items with out-of-era content hidden behind a "Live content only"
> toggle. It now ships 3,533; 7,719 records are quarantined in `pipeline/quarantine.json`, and
> the toggle has been removed because it could no longer change a single row. Every count below
> was correct when measured and is not current. See `research/SOURCING-STANDARD.md`.

**Reviewer:** adversarial design critic · **Date:** 2026-08-16
**Build under test:** `dist/assets/index-LBOtFPhL.js`, built 21:04 UTC from the working tree
(9 files were uncommitted and one, `StatPanel.tsx`, was edited *during* this review at 21:03 —
every finding below was re-verified against the 21:04 build unless explicitly noted).
**Method:** Chromium 1194 via Playwright at 1600×1000 (plus 1280/1024/768/390), every screen and
state screenshotted and read visually. Reference: `research/validation/UI-REFERENCE.md` §A (the bar)
and §B (authenticity source).

Screenshots live under
`/tmp/claude-0/-home-user-EQL50ups/b71726cd-1814-503f-880d-c245d5982023/scratchpad/shots/`.
Paths below are relative to that directory.

---

## Overall: **4.5 / 10**

> It has sixtyupgrades' *skeleton* — correct header, correct tab row, correctly mirrored item
> columns — wrapped around a developer's debug dashboard: 22 of 23 equipped item names render in
> the same grey, there are no item icons anywhere, the centre of the money screen is a 592px hole
> where the character should be, the Characters screen ships with text literally overlapping
> button labels, and Equipped Weight silently reads `0` after every page reload.

### Sub-scores

| Dimension | Score | One-line verdict |
|---|---|---|
| **Visual design** | **4 / 10** | Structure copied faithfully, surface unfinished — monochrome item names, monogram squares instead of icons, dead space on three screens, one outright broken layout. |
| **Information architecture** | **4 / 10** | A 1,648px paper doll that never fits a screen, a stat panel that duplicates its own summary strip, a 7,728px Exaltations tab that says nothing, and an item browser with a hard 250-row ceiling. |
| **Interaction feel** | **6 / 10** | Genuinely fast (41–112ms everywhere, 23-slot auto-fill in 372ms) with a real focus ring and real picker keyboard support — undercut by 22×20px steppers, silent click failures, and no hover detail anywhere. |
| **Functional completeness** | **5 / 10** | The EP/cap/multiclass/+N core is real; the item window, set-vs-set diff, per-set export, set-creation flow, and any way to reach item #251 are all absent, and one stat is broken. |
| **Game authenticity** | **5 / 10** | `50 BRD/WAR/BER`, `/510`, `/1000`, Void, Heroic Mods and green numerics are correct and well-earned — but nothing on screen looks like EverQuest; it looks like Tailwind. |

---

## Prioritised defect list

Ranked by how much each costs the score. Every item is checkable against a named screenshot.

---

### P0 — Ship-blockers

#### 1. The Characters screen renders text on top of button labels
`V-10-character-card.png`, `V-09-characters.png`, `28-characters-filled.png`

The set row inside a character card collapses. `"Main Set"` wraps to two lines and the word **"Set"
is painted over the word "RENAME"**; `"23 equipped · 8/16/2026"` wraps to four lines and
**"equipped" is painted over "DELETE"**. Verified programmatically, not just by eye — a DOM
rect-intersection sweep of the page returns `"Main Set" OVERLAPS "RENAME"`.

This is on the screen every returning user lands on when they click CHARACTERS. It is the first
thing a sixtyupgrades user would see and the last thing they would forgive. The cause is a flex row
whose name column has no `min-width: 0` / no `flex: 1` against three inline buttons, inside a card
that is pinned to ~320px while 1,000px of the container sits empty beside it.

**Cost: enormous.** One broken layout on the home screen retroactively discredits every polished
thing elsewhere.

#### 2. Equipped Weight reads `0` after any page reload
`V-05-weight-rounding.png` (82, correct) vs `V-06-weight-after-reload.png` (0, wrong)

Immediately after auto-fill, the KPI tile reads `WEIGHT 82` and `Equipped Weight 82`. Reload the
same saved set and both read **`0`** — with all 23 items still equipped and HP/Mana/AC/attributes
all still correct. Sampled at 500ms, 1s, 2s, 4s and 8s after a cold load: it is `0` at every
sample and never recovers.

`engine/stats.ts:179` computes `weight: item.wt ? scaleWeight(item.wt, upgrade) : 0`, so an item
that resolves without a `wt` field contributes silently. The auto-fill path calls `ensureAll()`
(full catalog); the cold-load path resolves items from per-slot shards. The shards are not carrying
weight.

UI-REFERENCE §B4 singles this stat out: *"Weight matters … the planner should surface equipped
weight."* It surfaces it, then loses it, silently, with no error state. A number that is sometimes
right and sometimes zero is worse than no number.

#### 3. Item names are 96% monochrome — the single most recognisable sixtyupgrades trait is absent
`10-autofilled.png`, `V-07-filled-full.png`

Computed-style audit of the filled paper doll: of 23 `.slot-item` names, **22 render
`rgb(207,212,218)`** and **1 renders `rgb(185,140,232)`**. One purple item in a wall of identical
grey-white.

§A1 and §5 of the spec are unambiguous — *"Item quality colors everywhere"*, *"Line 1 = item name
in quality color (purple epic, blue rare)"*. Quality colour is *the* reason a sixtyupgrades
screenshot reads as a game screenshot rather than a table. `lib/itemStyle.ts:qualityColor()` exists
and works (the picker shows the odd blue name, the browser shows purple and green) — the doll is
just resolving nearly everything to the default tier. Either the tiering heuristic is too
conservative or the data lacks the signal; either way the marquee screen is grey.

#### 4. There are no item icons anywhere — two-letter monograms stand in
`11-slotcard-detail.png`, `V-02-picker-row-empty-slot.png`, `18-items-viewport.png`

The doll shows 38×38 rounded squares containing `BE`, `IH`, `DM`, `IH`, `AF`, `PS`, `IV`, `BC`,
`HB`, `IB`, `TB`, `IG`, `FA`, `BL`, `ER`, `DR`, `IB`, `IG`, `LS`, `BG`, `TW`, `DA`, `CS`. They
collide (`IH` = both Indicolite Helm and Ivandyr's Hoop; `IB` twice; `IG` twice) so they do not
even function as identifiers. They read as a contact-list avatar, not a game item.

Worse, the three surfaces disagree: the doll uses 38px monograms, the picker uses 22px monograms,
and the **item browser has no icon column at all**. Three renderings of the same entity in one
product.

Icons are the load-bearing element of a paper doll. Without them the left and right columns are
not a paper doll — they are two bulleted lists.

---

### P1 — Costing serious points

#### 5. The money screen has a 592px hole in the middle of it
`10-autofilled.png`, `V-07-filled-full.png`

Measured on the filled set: left column **1,313px**, right column **1,210px**, centre column
**721px**, body scrollHeight **1,648px**. The centre stat panel ends at roughly y=960 and both
flanking columns keep going to y≈1,560, leaving **~600px of pure black** framed by content on both
sides.

sixtyupgrades puts a full-height 3D character model there; that column is what makes the layout
read as a *character* rather than a *form*. Substituting a stat table is a defensible adaptation —
but the substitute is 592px too short, so the adaptation fails visually. As it stands the screen is
two lists with a hole between them, and the hole is the largest single shape on the page.

Also: the centre column is **472px, the widest of the three** (410 | 472 | 410). The app literally
centres and prioritises a spreadsheet.

#### 6. The paper doll cannot fit on a screen — by 65%
`V-07-filled-full.png`

23 slots × **104px** per filled row (54px card + 40px control footer + 10px gap) = **1,313px** in
the left column alone; total page **1,648px** at a 1000px viewport. You must scroll 1.6 screens to
see one gear set.

A paper doll's entire reason to exist is at-a-glance completeness. This one requires scrolling
past the fold to check whether your feet are equipped. Empty rows are 58px, filled rows 104px, so
the page *grows by 45%* as you fill it — the more useful the set becomes, the less of it you can
see.

#### 7. `Empty` is printed 23 times on the zero state — and the spec says not to print it at all
`06-after-create.png`, `V-01-zero-state.png`

Verified count: **23** occurrences of the word `Empty` on the zero-state gear tab. It is rendered
in a **larger, brighter** treatment than the slot label above it, so the visual hierarchy is
inverted: the placeholder shouts and the information (which slot this is) whispers.

§A1 is explicit: *"Empty slots show a dim placeholder icon plus the slot name only (`Shirt`,
`Tabard`)."* The slot name **is** the empty state. Delete the word.

It gets worse on the Exaltations tab, where unlocked sockets also say `Empty` (see #9) — up to 92
more.

#### 8. The KPI strip is an exact duplicate of the VITALS section 40px below it
`12-statpanel-detail.png`, `24-set-768.png`

| KPI tile | VITALS row | Same number? |
|---|---|---|
| `HP 561` | `Hit Points 561` | yes |
| `MANA 300` | `Mana 300` | yes |
| `AC 271` | `AC 271` | yes |
| `HASTE 0%` | `Attack Speed 0%` | yes |
| `WEIGHT 82` | `Equipped Weight 82` | yes |

**Five of the six VITALS rows are restated verbatim in the strip immediately above them** — and
each one is given a *different name* in the two places (`HP`/`Hit Points`, `HASTE`/`Attack Speed`,
`WEIGHT`/`Equipped Weight`). Only `Endurance` is unique to VITALS. At 768px the duplicate pair sits
130px apart in the same viewport (`24-set-768.png`) — you can read the same number twice without
moving your eyes.

Compounding it, the caveat is stated **five times** on one panel: `from gear` ×3 in the strip plus
`gear only` ×2 on the STATS and RESISTS headers.

Fix: delete the VITALS group, or delete the strip. Not both.

#### 9. The Exaltations tab is 7,728px of identical boilerplate
`16-exaltations.png`, `V-12-exalt-upgraded.png`

Verified counts on a fully-equipped, all-`+0` set:

- `Cosmetic — no effect` — **23 times**
- `Unlocks at +1/+2/+3/+4` — **92 times**
- `ORNAMENTATION` — **24 times**
- page height — **7,728px**

The tab is a single rule ("sockets unlock at +1…+4") restated 115 times. 100% of the content is
derivable from one number per slot, and that number (`+0`) is already on the Gear tab. The
`ORNAMENTATION — Cosmetic — no effect` row is structurally incapable of ever doing anything and is
rendered 23 times regardless of upgrade level (confirmed at `+5` in `V-12`).

Row labels wrap inconsistently inside a single card (`FOCUS EXALTATION` / `CLICK EXALTATION` /
`WORN EXALTATION` wrap to two lines, `PROC EXALTATION` does not), so rows are 54px and 48px
alternating. And the `ADD` button sits ~1,100px to the right of the label it belongs to.

**Also — and this is the functional half:** exaltation donors contribute no stats, so even a fully
populated version of this 7,728px page changes nothing in the stat panel. It is currently a very
long form that does not compute.

#### 10. Every item-picker row prints its stat vector twice — on exactly the rows a new user sees
`V-02-picker-row-empty-slot.png`, `08b-picker-chest-viewport.png`

```
AC +35 · Strength +15 · Stamina +15 · Dexterity +15      ← grey, label-after-value, "·" separated
+35 AC   +15 Strength   +15 Stamina   +15 Dexterity      ← green, value-before-label, space separated
```

Same four facts, twice, in **different word order and different formatting**, so the eye cannot
even pattern-match them as the same data and has to read both.

The precise diagnosis matters because it makes the fix trivial: the green line is a *delta vs the
worn item*, and with an **empty** slot the delta equals the whole vector. Equip something and it
correctly collapses to just the differences (`-9 AC`). So the duplication appears **only on empty
slots — which is the state every slot is in when a user starts planning.** The first picker any new
user opens is 97 rows, every one of them printed twice.

Two more redundancies in the same list:
- On the currently-equipped row, the app shows **both** an `EQUIPPED` tag **and** `0 vs worn` —
  comparing an item to itself.
- `LORE` and `LORE EQUIPPED` render as two separate adjacent tags on the same row.

#### 11. `ERA UNKNOWN` — a missing value styled louder than every real value
`V-02-picker-row-empty-slot.png`, `18-items-viewport.png`

A null is rendered as an **amber-outlined uppercase badge**, making it the highest-contrast element
in the row after the item name, and it is styled *identically* to real eras (`CLASSIC`, `SKY`,
`FEAR`). In the item browser it wraps to two lines and inflates row height. The app is advertising
its own data gaps in its loudest available colour, on rows that are otherwise fine.

A missing era should be absent, or grey. Reserve amber for §A6's intended job (phase/era labels
that are actually known).

#### 12. The item browser is a dead end: 250 rows of 5,848, inert, unreachable
`18-items-viewport.png`, `19-items-after-rowclick.png`

- Header reads **"5,848 matches · showing first 250"**. There is **no pagination, no "load more",
  no virtualisation**. Items ranked 251–5,848 are unreachable by any means except narrowing
  filters until they enter the top 250.
- 250 rows produce a **14,188px** page — 14 screens of scrolling to reach the ceiling.
- Rows are inert `<tr>` elements: `onclick=false`, `role=null`, `cursor: auto`. Verified by
  clicking — the URL does not change and nothing happens. **You cannot click an item.** No detail,
  no tooltip, no "add to set", no comparison.

This kills the #1 sixtyupgrades workflow from the spec (§6: *mid-raid drop evaluation — check a
fresh drop against your plan*). A user who just looted something searches for it here, finds it,
and then… nothing.
- It also carries a full-width apology as body copy: *"This browser scores against preset profiles.
  For scoring against your own weights and cap headroom, open a set and use its slot pickers."*
  Two incompatible EP scales in one product, with the weaker one on the page named "Items", and no
  visual distinction between the two kinds of number.

#### 13. No item tooltip or item window anywhere in the app
`14-hover-item.png`

Hovering an equipped item produces a 1px blue outline and nothing else. There is no way to see an
item's full stat block, source, flags, or effects once it is equipped — the only place item detail
exists is a picker row, so you must reopen the picker and hunt for the item you already own.

§A/§B are emphatic that this is a **P0**: spec §7 row 7 — *"Game-authentic tooltips + quality/class
colors … P0 (EQ item-window fidelity)"*; §B5 describes the target precisely (dark stone-grey
beveled panels, green numerics, **red gradient title bar**, cyan group headers). None of it exists.

This is the largest single reason the app doesn't feel like a game tool. Authenticity is trust
(spec §8.2), and the app currently has no artefact that looks like it came from EverQuest.

Related: hover and focus are rendered identically (both a blue outline), so there is no distinct
hover affordance on the doll at all.

#### 14. The `+N` stepper — the headline differentiator — is the smallest control on the page
`11-slotcard-detail.png`, `15-stepper-plus10.png`

Measured: the `−` and `+` buttons are **22×20px**. The `CLEAR` button beside them is **65×30px** —
**larger than the increment control**, and only **8px away**. So the destructive action is bigger
than, and adjacent to, the app's marquee feature.

- 22×20 is below the 24px minimum and a third of the 44px touch target.
- Glyphs are dim grey on dark grey — very low contrast.
- No typing, no drag, no shift-click, no "max". Reaching `+10` costs 10 clicks per item;
  **230 clicks to take a full set to +10.**
- The `−`/`+` buttons carry `tabindex="-1"`, so a sighted keyboard user can see two buttons they
  cannot tab to (the roving `role="spinbutton"` is a reasonable pattern, but the visible buttons
  becoming unreachable is not).
- At `+0` the value chip is grey, so a full set renders **23 identical grey `+0` chips** — the
  differentiator is pure visual noise until used, and it is repeated more times than any other
  element on the page (verified: 23 steppers, 23 `CLEAR` labels).
- Stepping reorders the stat line: `HP +35 · MANA +25 · END +25 · AC +2` at `+0` becomes
  `HP +70 · AC +12 · MANA +50 · END +50` at `+10` (sorted by magnitude), so the text you are
  reading reshuffles under the cursor while you click.

The feature is excellent and unique. Its control is an afterthought.

#### 15. Three vocabularies and four numeric precisions for the same data
`10-autofilled.png`, `18-items-viewport.png`, `17-weights.png`

**Vocabulary.** The same stat has three names depending on the surface:

| Surface | Rendering |
|---|---|
| Paper doll | `STR +15`, `MANA +25`, `END +25`, `MR +10`, `DR +10` |
| Picker & item browser | `Strength +15`, `Magic Resist +10` |
| Stat panel | `Strength`, `Mana`, `Endurance`, `Magic`, `Disease` |

And the doll mixes registers *within one line*: `HP +35 · MANA +25 · END +25 · AC +2` — an
abbreviation, a full word in caps, an abbreviation, an initialism.

**Precision.** Verified across 97 picker rows: **78 EP values render with no decimal, 19 with one**
(`57.5 | 48.5 | 41.8 | 31 | 30.5 | 29.5 | 28.5 | 27.7`). In a right-aligned column whose entire
purpose is comparison, **the decimal points do not line up**. Same defect in the item browser
(`118 | 114.1 | 110.5 | … | 95 | 94 | 93.4 | 86 | 83`). Elsewhere: `Primary Ratio 0.83` (2dp),
weights `0.2 / 1 / 20` (mixed), everything else integer. Four precisions, no rule.
*(Note: a related weight defect — KPI `82.5` vs Vitals `83`, visible in `24-set-768.png` — was
fixed in the working tree at 21:03 during this review. The general precision problem is still
live.)*

**Control styles.** The same "reset" verb appears as a bare uppercase text button (`RESET`, item
browser), an outlined pill (`CLEAR ALL`, weights), and an outlined pill (`CANCEL`, picker). The
same stepper is labelled **"Rank at"** in the picker and **"Score at"** in the item browser. The
nav marks its active item with a **filled blue pill** while the tab row marks its active item with
a **blue underline** — two different active-state languages 120px apart.

#### 16. The stat panel devotes 23 rows to numbers that are structurally always zero
`14-hover-item.png` (expanded)

Fully expanded on a fully-geared character: **Heroic Mods** 10 rows all `0/xxx`, **Spell Mods** 4
rows all `0`, **Skill Damage Mod** 9 rows all `0/xxx`, plus `Attack 0` in Vitals. That is 24
permanently-zero values occupying more vertical space than every stat that actually moves.

Mirroring the client (§B3) is the right instinct and the group structure is correct — but the app
gives dead rows the same weight as live ones. Worse, Heroic Mods simultaneously displays the note
**"no item grants these yet"** *and* ten rows of nothing: it tells you there is nothing there, then
shows you the nothing. And for a BRD/WAR/BER the Skill Damage list is five Monk skills
(Dragon Punch, Eagle Strike, Flying Kick, Round Kick, Tiger Claw) at `0/100`.

Park all three behind one "show full client stat sheet" toggle, default off.

#### 17. `29/35` and `107/510` are the same glyph pattern meaning completely different things
`10-autofilled.png`

On one screen: `Fangol 29/35`, `Turmoil Warts 9/24`, `Throwing Boulder 36/35` (damage/delay,
unlabelled) sit 400px from `Strength 107/510`, `Magic 30/1000` (value/cap). Identical `n/m`
typography, opposite semantics — one is a pair of independent numbers, the other is a progress
fraction. A user reading `36/35` reasonably concludes something is over a cap.

Weapon rows also show *only* the ratio and no stats, so `AMMO — Turmoil Warts — 9/24` is the entire
content of that slot card.

And in the WEAPONS group the app prints `Primary 29/35` immediately followed by
`Primary Ratio 0.83` — the fraction and its own quotient, adjacent.

---

### P2 — Real, cheaper to fix

#### 18. 447px of dead black on the landing page — 45% of the first screen
`01-landing.png`, `V-11-landing-viewport.png`

Measured: content bottom **553px**, viewport **1000px**, and the page does not scroll
(`scrollHeight === 1000`). Nearly half the hero screen is empty. There is **no product imagery of
any kind** — no screenshot, no item art, no character, no icon. A gear planner's landing page shows
you gear. This one is four text cards and a void.

Blue is also doing five jobs at once (brand wordmark, two headline words, nav pill, primary button,
all four card headings), against §A6's discipline of *one* azure reserved for primary buttons,
active tabs and selection rings.

The footer prints `Data generated 2026-08-16T20:40:48.856Z` — a raw ISO timestamp with
milliseconds, on a consumer page. Alongside `11,249 items loaded`, which the CTA button already
says as `BROWSE ITEMS (11,249)`.

#### 19. The Weights tab is four mostly-empty cards, one of which holds a single field
`17-weights.png`

Five equal-height cards: DEFENSE (3 fields), **CASTING (1 field)**, ATTRIBUTES (7), RESISTS (6),
COMBAT (3). All are stretched to the height of ATTRIBUTES, so CASTING is a card containing one
input and ~250px of nothing. Below the cards, ~300px more dead space.

20 always-visible number inputs, 13 of them `0`, with no scale explanation, no normalise, no total,
and no undo on the one destructive button (`CLEAR ALL`).

§A4's lesson is explicitly called out in the reference — *"stat weights and filters are configured
at set creation, making every set carry its own scoring lens. **Mirror this.**"* It is not
mirrored: `+ New set` creates a set instantly named `Set 2` with default weights and no dialog at
all. The entire `BASIC DETAILS → EQUIVALENCY POINTS → DEFAULT FILTERS → Create` flow is missing.

#### 20. No set-vs-set comparison exists
`V-13-second-set.png`, `V-14-switcher-two-sets.png`, `V-15-overflow.png`

Verified: with two sets in the library, a regex sweep for `compar|diff|versus|vs` across the
rendered DOM returns **NONE**. The overflow menu offers Duplicate / Clear all slots / Delete. The
switcher just navigates.

Spec §7 row 18 flags this as *"P2 — **opportunity to leapfrog**"* precisely because sixtyupgrades
lacks it. Shipping without it forfeits a free win; shipping without it *and* without sixtyupgrades'
own two-tab workaround being pleasant (you must re-read 40 numbers from memory) is worse than
parity.

#### 21. No per-set JSON export
Verified: `/export/i` does not match anywhere on the set page. `EXPORT JSON` exists only on the
Characters screen and dumps the whole library.

Spec §4 and §8.7 make the export string a moat (WowSims / Sharpie's Gear Judge adopted
sixtyupgrades' format). "Export *this set*" is the unit downstream tools want.

#### 22. Share links are 1,348 characters
`20-share-modal.png`

At `+0`, no exaltations, one set: **1,348 characters**, and the modal reports this as a plain fact
(`1348 characters.`) with no indication it's a problem. sixtyupgrades ships
`sixtyupgrades.com/set/jrNhws7xF4oNJyij7sWcG4` — **22 characters**.

Spec §8.3: *"The URL is the product."* A 1.3KB base64 blob pasted into Discord is a wall of
gibberish that many clients will truncate or refuse to linkify, and it will grow with upgrades and
donors. The "no server" constraint is a real and defensible choice — but then compress hard
(slot-indexed varint + item IDs rather than names) and show the length only when it becomes a risk.

#### 23. Horizontal overflow at 390px
`V-16-mobile-390.png`

`scrollWidth 440` vs `clientWidth 390` — a 50px overflow. Culprit identified: the top-bar `<nav>`
is 272px wide with its right edge at 440 and neither wraps nor collapses. 1280/1024/768 are clean
(per `BROWSER-TESTING.md`), but phones are not.

Also at 768px and below the stat panel stacks **above** all gear (`24-set-768.png`), so a tablet
user scrolls ~800px of stat table before reaching the first slot they came to edit.

#### 24. Silent failure when picking a fourth class
`05-newchar-fourth-class.png`

With three classes selected, clicking a fourth does nothing — no message, no shake, no tooltip, no
disabled cursor. The other 13 chips dim uniformly, which reads as decoration rather than as "these
are unavailable". A click that does nothing and says nothing is the worst possible response.

Also on that screen: the row pitch jumps when you select, because `PRIMARY`/`SECOND`/`THIRD` labels
appear only under chosen chips, and `Shadow Knight` is the only two-line label — so the grid
reflows as you click. And the ordinals are inconsistent: `PRIMARY` (adjective) / `SECOND` /
`THIRD` (ordinals).

#### 25. Smaller redundancies and leaks

- **Characters list prints the class trio twice, adjacently:** `50 BRD/WAR/BER` then
  `Bard · Warrior · Berserker` (`28-characters-filled.png`).
- **Two `DELETE`s on one card** — set-delete and `DELETE CHARACTER` — distinguished only by
  position, and one is hidden under overlapping text (see #1).
- **Unlabelled US date** `8/16/2026` with no indication whether it's created or modified.
- **`ANY SLOT 1 [EQL]`** — the badge on the app's own differentiator is the app's own name, which
  carries no meaning to a user. In `innerText` it concatenates as `ANY SLOT 1EQL` (missing space).
- **Dashed amber borders on filled Any Slots** (`10-autofilled.png`) — dashed borders universally
  read as *empty / dropzone / invalid*. Using them for the most valuable filled slots in the set
  makes the two best items on screen look like validation errors.
- **Read-only shared sets still render 23 disabled steppers** (`29-shared-set.png`) — dead controls
  a viewer can never use.
- **`Auto-fill placed 23 items.`** notice has no dismiss and shifts the entire page down 60px.
- **The picker footer's only button is `CANCEL`.** There is no primary action; a static help line
  (`Ranked by EP against this set's weights, cap-aware.`) occupies a permanent 40px bar.
- **The picker's second checkbox (`Hide No Drop`) wraps to a second row alone**, orphaned at the
  far left, next to its sibling `Live content only` which stayed on row one.
- **The stat panel's 3-column grid orphans a lone cell** in Vitals, Weapons (`Secondary Ratio`),
  Stats (`Charisma`) and Spell Mods (`Luck`) — a fixed 3-col grid applied blindly to 4-, 6-, 7-,
  9- and 10-item lists.
- **`Damage Shield Mitig`** — truncated to save a line, then wraps to two lines anyway.
- **`🏳` (white flag) as the Auto-fill icon** — the surrender emoji for the "build my set" action.

---

## What it would take to reach 9/10

Ordered. Each step is worth more than the one below it.

**Stage 1 — stop the bleeding (nothing else counts until these are done)**
1. Fix the Characters card overlap (#1). `min-width: 0` on the name column, buttons in their own
   flex track, card grid `repeat(auto-fill, minmax(360px, 1fr))`.
2. Fix Equipped Weight → 0 on reload (#2). Carry `wt` in the per-slot shards; add a test that loads
   a persisted set cold and asserts every KPI is non-zero.
3. Add a `NaN`/`0`-regression sweep to the standing checks in `BROWSER-TESTING.md`: cold-load a
   saved set and diff the stat panel against the post-auto-fill panel. These two must never differ.

**Stage 2 — make it look like a game tool, not a dashboard**
4. Ship item icons. Even a 40×40 sprite sheet keyed by slot+tier beats monograms, and it turns the
   two columns into an actual paper doll (#4). Use the same icon at the same size on the doll, the
   picker, **and** the item browser.
5. Get quality colour onto every item name (#3). Audit the tiering so the doll isn't 96% grey; if
   the data can't support six tiers, ship three and make them obvious.
6. Build the EQ item window (#13): red gradient title bar, item name in white, green numerics, cyan
   group headers, beveled stone-grey panel. Bind it to hover on the doll, hover in the picker, and
   click in the item browser. This one artefact does more for authenticity than every other item on
   this list combined.
7. Kill `ERA UNKNOWN` as a badge (#11) and reserve amber for real era/phase labels — including the
   phase label missing from the set header (§A1).

**Stage 3 — fix the money screen's shape**
8. Fill the 592px centre void (#5). Options in order of preference: (a) a slot-grid character
   silhouette echoing the client's inventory window (§B4) with the stat panel below it; (b) make
   the centre column sticky and let it scroll independently; (c) move the stat panel to a
   right-hand rail and let the two item columns claim the width. Do **not** leave a hole.
9. Get the doll under one viewport (#6). Delete the per-slot control footer — move `+N` inline into
   the card (a compact chip on the icon corner) and `CLEAR` into hover/context. Target ≤56px per
   filled row → 23 rows ≈ 700px, fits.
10. Delete the word `Empty` (#7) — the slot name is the empty state.
11. Delete either the KPI strip or the VITALS group (#8), and say "gear only" **once**.
12. Park Heroic Mods / Spell Mods / Skill Damage Mod behind one "full client stat sheet" toggle,
    default off (#16).

**Stage 4 — redundancy and consistency pass**
13. Suppress the delta line when the slot is empty (#10) — a two-line change that removes a
    duplicate from every row of the first list a user ever opens. Also suppress `0 vs worn` on the
    equipped row, and collapse `LORE` + `LORE EQUIPPED`.
14. Rewrite the Exaltations tab (#9): one card per **unlocked** socket, not 5 rows × 23 slots.
    Collapse locked slots to a single line (`+0 — sockets unlock at +1`). Delete the
    `ORNAMENTATION` row until it does something. Target: under 1,200px on a fresh set instead of
    7,728px. And make donors contribute stats, or remove the donor UI until they do.
15. Pick **one** stat vocabulary and one abbreviation table, and use it on the doll, the picker,
    the browser and the panel (#15).
16. Pick **one** numeric policy: EP always 1dp, ratio 2dp, everything else integer, decimal points
    aligned in every right-aligned column (#15).
17. Unify control styles: one reset treatment, one active-state language (underline **or** pill,
    not both), one name for the preview stepper (#15).
18. Disambiguate `29/35` from `107/510` (#17) — label weapons `29 dmg / 35 dly` or drop the ratio
    row that restates the quotient.

**Stage 5 — close the functional gaps**
19. Make the item browser work (#12): virtualised list or pagination so all 5,848 are reachable,
    clickable rows that open the item window, and a "compare against my set" action. Then delete
    the apology paragraph by scoring against the active set's weights.
20. Enlarge the `+N` stepper to ≥28×28 with a legible glyph, add shift-click for +5 / a `MAX`
    affordance, keep the value chip coloured at every tier so the feature is visible at rest, and
    stop reordering the stat line as it changes (#14).
21. Add a set-creation dialog carrying name, weights preset and default filters (§A4, #19), and a
    set-vs-set diff column (#20) — the leapfrog the spec explicitly points at.
22. Add per-set JSON export with a versioned schema (#21).
23. Compress share links toward ~100 chars (#22).
24. Fix the 390px nav overflow and put gear above stats in the stacked layout (#23).
25. Give the fourth-class click a response (#24), and stabilise the chip grid so it doesn't reflow
    on selection.

---

## What genuinely works

Credible criticism has to name the good parts, and there are real ones.

- **Speed is the brand, and this hits it.** Measured on the 21:04 build: picker open **72ms** warm
  / 203ms cold-shard, search settle **112ms**, equip → doll updated **53ms**, `+1` → full stat
  recompute **41ms**, tab switch **84ms**, and **auto-fill of all 23 slots in 372ms**. Spec §8.1
  says every piece of sixtyupgrades praise mentions smoothness — this is the one dimension where
  the app is genuinely at parity, and the memoised rank-then-filter design in `ItemPicker.tsx` is
  the reason. Don't regress it.
- **Zero console errors and zero page errors** across every screen, state and viewport I exercised,
  and no `NaN` / `undefined` / `[object Object]` anywhere — including the empty state, which is the
  exact defect §A7 warns about in sixtyupgrades itself. The zero-state is numerically clean.
- **The multiclass header is perfect.** `Avenrae` / `50 BRD/WAR/BER` reproduces §B2 exactly, and
  the class picker's glowing blue selection rings with `PRIMARY`/`SECOND`/`THIRD` ordinals
  (`05-newchar-fourth-class.png`) are the best-looking control in the app — genuinely close to
  §A5's race portraits.
- **Cap-aware display is done right and is a real advantage.** `107/510` with the value in green
  and `/510` dimmed, `0/1000` fully greyed, plus an over-cap indicator — this is simultaneously
  authentic to the client (§B1) and the thing sixtyupgrades users complain is missing. Void is
  present as a sixth resist. This is the app's best idea, well executed.
- **The header and tab row are faithful.** Circular avatar, name, grey sub-line, vertical rule,
  glowing set icon, set switcher chevron, `GEAR · EXALTATIONS · WEIGHTS` with a blue underline, and
  quiet text-and-icon actions right-aligned on the same row — §A1 reproduced closely.
- **Column mirroring is correct.** Left column icon-outward/text-inward, right column mirrored with
  right-aligned text — exactly §A1. The structure is right even though the contents aren't.
- **Keyboard support in the picker is better than it had to be**: ↑/↓, PgUp/PgDn, Home/End, Enter
  to equip, proper `role="listbox"`/`aria-activedescendant`, and focus that lands in the search box
  on open.
- **Tab order across the set page is clean and logical** — brand → nav → set switcher → three tabs
  → four actions → first slot, with a clearly visible **2px `rgb(59,159,232)` focus outline**.
- **The item browser's table is the best-composed screen in the app** (`18-items-viewport.png`):
  real columns, quality colour actually visible, era in amber, EP right-aligned. It's inert and
  capped, but the layout is the closest thing here to sixtyupgrades' density and discipline.
- **The honesty is admirable and should survive the redesign** — "gear only", "no item grants these
  yet", the unverified-race-attributes note, the CC BY-SA attribution. Keep the candour; just stop
  spending prime screen real estate on it.
