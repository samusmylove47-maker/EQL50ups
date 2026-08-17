<!-- Written by a review agent, 2026-08-17, against the re-skinned build.
     Preserved verbatim: these are findings to work from, not prose to polish. -->

I built the app, served it, and drove every flow in Chromium. Nothing in the tree was modified.

## What is genuinely good — and I checked, not assumed

**The inventory import is the best thing here and the only reason I'd pick this over a spreadsheet.** I pasted the real 983-line `research/validation/tier0-inventory-Avenrae.txt`. Preview rendered in **53 ms** (I instrumented rAF; zero frames over 100 ms — my first 5 s reading was a Playwright `fill()` artifact and I'm discarding it). It reported 21/22 worn, 12 donors, 412 collection rows skipped, told me *Djarn's Amethyst Ring* joined on item id 10366 rather than name, and named `Shadow Rage Helm +5 — line 13` as real-but-unstatted rather than scoring it zero. No other fan tool does that.

Also real: the picker is a correct ARIA listbox (`ItemPicker.tsx:366-402`, `aria-activedescendant`, Arrow/Enter — I picked an item keyboard-only), opens in **191 ms**, and shows per-stat vs-worn deltas. Share is a 281-char URL that opens read-only with *Save a copy*. Compare distinguishes `RETUNED` from `SWAPPED` and reports "creditable stat gain · nothing lost to a ceiling" — better than sixtyupgrades' own diff. Sorting the 3,533-row table by Item/Slot/Era and typing 12 characters into search produced **zero frame gaps over 100 ms**. At 390 px there is no horizontal page scroll on any screen I visited.

That's the floor. Now the holes.

## 1. The app does not boot until Google Fonts answers. Measured: 12.9 s of nothing.

`web/index.html:26-29` ships a render-blocking `<link rel="stylesheet">` to `fonts.googleapis.com`. With that host unreachable (it is, here — the verifier saw the `ERR_CONNECTION_RESET` but read it as a typography question):

| | first-paint | React mounted |
|---|---|---|
| as shipped | **12,884 ms** | 13,306 ms |
| identical build, font request aborted at once | **68 ms** | 268 ms |

At 500/1000/2000 ms into the real document: `paints: []`, `root.innerHTML.length: 0`, `styleSheets: 1`. My `page.evaluate` calls *themselves* hung — the main thread was blocked. Same build, same server, one difference.

The comment above that tag says `display=swap` means "the page must be readable from the first paint on a network that never delivers them." `display=swap` governs the font-face swap; it does not make the stylesheet non-blocking. The file asserts the opposite of what it does. For an app whose landing copy is *"No account, no server: your sets live in this browser"*, a hard third-party gate on boot is the wrong dependency to own — and anyone on a network that null-routes that host (corporate proxy, uBlock's font-blocking list, China) gets the blank page, not the fallback stack. Fix: self-host the four families under `web/public/fonts/`, or `media="print" onload="this.media='all'"`.

## 2. Searching for a purged item blames the user. This is the one that closes the tab.

Item browser, no filters set, search `Ragebringer`:

> **NOTHING MATCHES** — Loosen a filter — a narrower search, slot, class or era than the catalog holds.

Same for `Jade Mace`, `Wurmslayer`. There is no filter to loosen. Those items are absent because this project deliberately quarantined 7,719 records — the decision it documents at length in `research/SOURCING-STANDARD.md` and keeps a complete named list of in `pipeline/quarantine.json`, with a `why` on every row (`Ragebringer → era:Epic Quests`, `Jade Mace → era:Kunark`).

So the project's single best decision is invisible at the only moment a player ever meets it, and the copy in `src/screens/ItemBrowser.tsx` implies they mistyped. Ship a name→reason map (a few tens of KB gzipped, or just the stat-bearing subset) and when a zero-result query hits a quarantined name, say so: *"Ragebringer is on the wiki but not in EverQuest Legends — Epic Quest content, which this server does not have."* That converts the worst dead end in the app into its most trust-building screen.

## 3. The browser equips items the loadout cannot wear, and the stat sheet counts them.

`#/items` → click *Golden Sash of Tranquility* (Monk-only). The dialog prints **"THIS LOADOUT CANNOT EQUIP IT"** and then, four lines below, offers **EQUIP IN MAIN SET → WAIST / ANY SLOT 1 / ANY SLOT 2**. I clicked Waist. No warning, no confirm. In the set: `HP 486 · AC 291 · ATK SPEED 41%`, 28 EP — the haste on an item this trio can never wear, folded into the headline numbers. `WARNINGS on page: []`.

The doll *does* tint the name red (`rgb(200,100,84)`, correct per `src/lib/itemStyle.ts`) — credit. But the `title` attribute on `.slot-item` is the item name, `usabilityNote()` is never used there, and there is no legend on the gear tab (the green/red legend exists only on `Landing.tsx`). So one red word among twenty-two cream ones, unexplained, is the entire signal — colour-only, which is also a WCAG 1.4.1 failure. Meanwhile the *picker* correctly refuses to offer it (38 EAR matches, all legal). Two surfaces, two rules.

Fix in `src/screens/ItemBrowser.tsx:204` — drop the equip buttons when `usabilityOf(detail, colorContext) === 'blocked'`, or confirm; and give `SlotCard` a text chip plus exclude it from totals or asterisk them.

## 4. Two different numbers called "EP", one screen apart

Same item, same +0, same character:

- Picker on the Primary slot: **Dagas 53.0 EP** ("Ranked by EP against this set's weights, cap-aware")
- Item browser: **Dagas 41.0 EP**

Because `ItemBrowser.tsx:61` hardcodes `useState(PRESET_PROFILES[0]?.id)` — *Melee DPS* — and never consults the set. I stepped every profile: Melee DPS 41.0 / Tank 92.4 / Caster 14.0 / Healer 20.0 / **Balanced 53.0**. Balanced is my set's actual profile. The page already computes `targetSet` for the equip buttons; it just doesn't use its weights. Add "This set's weights" as the default option. A 2.2× spread on the tool's only ranking metric, unreconciled, is how a tool loses a user's trust permanently.

Related default: with a WAR/BRD/BER character present, `Filter by class` still opens on **Any class**, so the #1 row by EP is a Monk item and **5 of the top 8 rows render red**.

## 5. There is no upgrades list — the reason people open sixtyupgrades

`autoFill` in `src/selectors/gear.ts:587` already ranks the best item for all 23 slots. The only exposure is one destructive button that applies all of them. There is no screen that answers *"where is my biggest gain, and what do I go farm?"* — the question a gear planner exists to answer. The data is computed and thrown away. A ranked "top 10 upgrades: slot, item, +EP, source zone/mob, [Equip]" list is a view over machinery that already exists, and it is the single highest-value thing missing.

## 6. Destructive actions are inconsistent about asking

⋯ menu → **Clear all slots**: 23 items → 0. `native dialogs shown: []`, no undo control on the page, Ctrl+Z does nothing. *Delete set* two rows below it does confirm. Bulk upgrade has a proper `REVERT` (`BulkUpgrade.tsx:115`). Auto-fill asks — via `window.confirm` (`SetEditor.tsx:144`), a native OS dialog in a tool this carefully styled — but offers no undo either. `state/store.ts:43` says there's no general undo by design; fine, but then the 23-slot wipe needs the same confirm the single-set delete gets.

## 7. Back after creating a character makes a duplicate character

`src/screens/NewCharacter.tsx:72` is `navigate(href.set(gearSet.id))` with no `{ replace: true }`, though the router supports it. Create *Critic* → land on the set → press Back → you're on `#/character/new` with the form **blank** (no sign you already did this) → fill it → two identical `Critic · 50 WAR/BRD/BER` cards in `#/characters`, each with a *Main Set*, no created-at, nothing to tell them apart. On a phone, Back is the primary gesture. One-line fix, plus a duplicate-name warning.

## 8. Smaller, all observed

- **The character's name is not a link.** On `#/characters` the only route to the character page is the small blue *"1 loadout · per-class levels"*. Anchor dump confirms no `<a>` wrapping "Critic". The biggest text on the card is inert.
- **Weights tab has no anchor and no preview.** 25 bare number boxes (`AC 1`, `Weapon Ratio 20`) with one line of prose about the *preset*, nothing about the scale, and no indication that AC=1 is the unit EP is denominated in. Changing a weight shows no effect until you navigate to Gear. This is the lever that drives ranking and auto-fill and it's the least explained screen in the app.
- **Exaltations at +10 is 6,384 px of 92 near-identical `— / ADD` rows.** No filter, no bulk-apply, no "sockets I can actually fill". At +0 it's 23 rows of *"first socket at +1"* — a whole tab that does nothing until you use a different tab.
- **The import's excluded slot goes silent.** After the Shadow Rage Helm exclusion, Head renders exactly like a never-filled slot. The explanation lives only in the dismissible notice; dismiss it and you have an unexplained hole in a set you just imported from the game.
- **Item browser is paginated — "Page 1 of 36"** with a *Jump to page* number input, on a 4,252 px page. `src/lib/useVirtualList.ts` exists and is used by the picker; the browser doesn't use it.
- **Mobile item table is 1,337 px inside a 364 px container with no sticky first column** (`position: sticky` appears twice in `styles.css`, both `top`, neither `left`), so reading a stat scrolls the name off-screen.
- **Compare defaults the set you're editing to BASELINE.** From my +5 copy, "Compare with…" produced **-361.8 EP** — my improved set reported as a loss. *Swap sides* fixes it in one click; the default is still backwards from intent.

## Verdict

The engine and the data discipline are better than the product wrapped around them. The import, the picker deltas, the compare screen and the sourcing standard are the work of someone who cares; the perf is clean and the a11y in the picker is better than most commercial tools. But a demanding sixtyupgrades user hits at least four of these in one session: they load it on a locked-down network and stare at nothing, they search for their epic and get told to loosen a nonexistent filter, they see the same sword priced at 53 and 41 EP on two screens, and they never find the upgrades list they came for. Two of those are trust bugs, and trust is the only currency a planner has.

Six of the eight top findings are ten-line fixes in files I've named. The seventh — the upgrades list — is a view over code that already runs. That's the gap between this and an 8.

SCORE: 6/10