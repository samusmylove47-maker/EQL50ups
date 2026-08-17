# Correctness audit — do the numbers match the game?

**Scope:** the arithmetic, not the appearance. Every number this tool puts in front of a
player, from `resolveItem` through the stat panel, the EP column and the share link.

**Authority order.** `research/validation/TIER0-VALIDATION.md` (the live client) beats
`pipeline/README.md` (the shipped data) beats any community source beats any third-party
port's test fixture. That order decided two findings below, and reversed one assertion
this codebase had been treating as ground truth.

**Method.** Three passes, all reproducible:

1. **Unit** — the engine driven directly over every stat key at every tier 0–10, with
   banked fractions, negatives, zeros, absent fields, 9,999s and NaNs.
   (`src/engine/correctness.test.ts`, `character.test.ts`, `upgrade.test.ts`)
2. **Corpus** — the shipped catalog (11,249 items when this audit ran; 3,533 since the
   2026-08-17 era purge) joined to
   `research/validation/tier0-inventory-Avenrae.txt`, a live `/outputfile inventory`
   export, and pushed through the app's own loader, eligibility and ranking code.
   (`src/engine/tier0-catalog.test.ts`, `src/selectors/fidelity.test.ts`)
3. **Browser** — the built app driven in Chromium: characters created, items equipped at
   chosen tiers, the rendered stat panel read back and compared line by line against the
   client screenshots.

**State at the end of the audit:** `npx tsc --noEmit` clean, `npx vitest run` 221 passing,
`npm run build` clean, zero console errors in the browser pass.

---

## Verdict on the Tier 0 fixtures

Both fixtures reproduce **exactly**, and — the part that unit tests alone do not prove —
they reproduce *on screen*. Read out of the rendered DOM of the built app:

| Fixture | Client | Stat panel renders |
|---|---|---|
| Whitened Treant Fists +0 | 14 / 28, ratio 0.5 | `14/28`, `0.5` |
| Whitened Treant Fists +1 | 15 / 28, ratio 0.536 | `15/28`, `0.536` |
| Whitened Treant Fists +2 | 16 / 28, ratio 0.571 | `16/28`, `0.571` |
| Whitened Treant Fists +3 | 18 / 28, ratio 0.643 | `18/28`, `0.643` |
| Earthshaker +10 damage | 74 | `74/70` |
| Earthshaker +10 delay | 70 | `70` |
| Earthshaker +10 ratio | 1.057 | `1.057` |
| Earthshaker +10 Strength | 16 | `16/510` |
| Earthshaker +10 Stamina | 16 | `16/510` |
| Earthshaker +10 SV Void | 10 | `10/1000` |
| Earthshaker +10 Dexterity | *no line* (−5 shrank to 0) | `0/510`, and no Dexterity entry on the item |
| Earthshaker +10 weight | 1.6 | `1.6` |

Three of those twelve did not render correctly when the audit began: the ratio printed
`1.06`, the weight printed `1.7` (and `2` in one of the two places it appears), and the
whole Weapons block — damage, delay, both ratios — was invisible.

---

## Findings

Severity: **critical** = a wrong number a player would act on; **high** = a wrong number
in a less-travelled path, or a right number that is hidden; **medium** = a wrong ranking
or a stat silently absent; **low** = cosmetic or latent.

### 1. SV Void was counted twice — **critical** — fixed

`SV Void` is synthesised by the upgrade engine from the tier. Two catalog rows also
*print* a Void line, and `resolveItem` added the synthetic value on top of the printed
one.

| Item | Was | Now | Client-side truth |
|---|---|---|---|
| Anthemion Armbands +10 | Void 22 | Void 12 | unmeasured |
| Darkspun Shroud +10 | Void 21 | Void 11 | unmeasured |

`pipeline/README.md` "Known data problems" §6 reads both wiki pages as captures of
*already-upgraded* items — "Anthemion Armbands +2, Darkspun Shroud +1" — and their printed
Void values are exactly what the synthetic rule yields at those tiers (2 and 1). The two
numbers describe one line, not two.

**Fix:** reconcile with `max`, never add. **Residual uncertainty, stated plainly:** if the
printed Void is real base data rather than capture contamination, `max` still understates
it at high tiers. Neither item appears in any Tier 0 screenshot, so this cannot currently
be settled. `max` was chosen over deleting the printed value because it discards no shipped
data, stays monotonic in the tier, and strictly reduces the error under the reading the
pipeline itself publishes. The whole stat block on these two rows is suspect for the same
reason — the AC, attributes and resists on them are probably +2/+1 values too.

Note the flip side is verified: Earthshaker carries **no** printed Void and gets exactly
`10` at +10, matching the client; Whitened Treant Fists carries no attribute or save at all
and correctly gets no Void line at any tier.

### 2. Every spelling of a resist was summed — **high** — fixed

`resolveItem` walked an alias→canonical map and **added** each match. An item carrying
`FIRE` and `SV_FIRE`, or `sv.FIRE` and `st['SV FIRE']`, resolved to two or three times its
real resist.

```
before:  { st: {'SV FIRE': 10}, sv: {FIRE: 10, SV_FIRE: 10} }  ->  Fire Resist 30
after:                                                          ->  Fire Resist 10
```

Not reachable from the catalog as it ships today (its `sv` vocabulary is a single spelling
per resist), but `data/normalize.ts` deliberately accepts several input shapes and
`catalog.ts` merges shard records over index records field by field, so a payload with two
spellings is a build away. The same bug also inflated the Void *trigger* count: one resist
under three spellings counted as three distinct fields, enough to conjure a Void line onto
an item with only one real stat.

**Fix:** a save is read once, first spelling in a fixed priority order wins.

### 3. Three stat keys were dropped on the floor — **high** — fixed

`resolveItem` did not read them at all, so they scored nothing, displayed nothing, and the
panel built to show them printed zero.

| Key | Rows | Consequence |
|---|---|---|
| `ENDUR_REGEN` | 2 | **Talisman of Kejaar Kerrath is worn in the Tier 0 inventory.** A player wearing it saw `Combat End Regen 0` against its real +2. |
| `BACKSTAB` | 11 | Eyerazzia grants Backstab 10; the Skill Damage Mod panel printed `Backstab 0/125`. |
| `ATTACK` | 2 | Never displayed anywhere; no row existed. |

The catalog spells it `ENDUR_REGEN`; the engine only knew `END_REGEN`. **Fix:** both
spellings resolve, skill modifiers feed `totals.skillMods` (which the panel already
rendered, from a map nothing ever populated), and Attack gained a vitals row and a total.
All three are now weightable in the EP editor.

**Scaling caveat, unverified:** `ATTACK` and the skill modifiers are scaled with
`scaleFlat` (base + tier), by analogy with worn haste, the only comparable stat already
modelled. No Tier 0 sample carries any of them, so **the tier behaviour of these three keys
is inferred, not confirmed.** Showing the base value is strictly better than showing zero;
the +N curve on them should not be trusted until a screenshot settles it.

### 4. Weight scaling was one step high on 7% of items — **high** — fixed

`scaleWeight` ceilinged to one decimal, and `upgrade.test.ts` asserted
`scaleWeight(3.0, tier(10)) === 0.4` with a comment claiming the client reproduces an
IEEE754 artifact. **That assertion was not Tier 0 evidence** — it came from a third-party
port's fixture relayed through a research report — and the client contradicts it.

- Earthshaker's catalog base weight is 16.
- The client shows **`Weight: 1.6`** at +10.
- `16 * (1 - 0.09 * log2(1024))` evaluates to `1.6000000000000014`; a naive one-decimal
  ceiling returns **1.7**.

In exact arithmetic the answer is exactly 1.6. Only floating-point residue promoted it. A
sweep over base weights 1–200 at every tier found **302 of 4,400 combinations** wrong,
every one by 0.1, every one upward.

**Fix:** the ceiling tolerates a 1e-9 residue. Genuine remainders are untouched — base 3.0
with 3 banked at tier 2 still ceilings 2.2420 up to 2.3. **Still inferred:** what base 3.0
at +10 actually reads in-client is unknown; the model now says 0.3.

A sweep of the other rounding sites found no comparable exposure. `excelRound` and
`scaleDamage` divide exactly-representable dyadic rationals by 10, so a true half or a true
integer is returned exactly; only `scaleWeight`, which multiplies by an inexact
`0.09 * log2(…)`, carries residue.

### 5. Equipped weight depended on the order slots were summed in — **medium** — fixed

Adding one-decimal weights as floats gave `36.10000000000001` in one order and `36.1` in
the other, so two structurally identical sets compared unequal. **Fix:** the running total
is kept in tenths. The displayed value never differed, but the invariant it broke — same
set, same number — is the one this tool exists to hold.

### 6. Cap-aware scoring charged penalties it did not credit — **medium** — fixed

Gains were credited only up to the 510/1000 ceiling, correctly. Losses were charged in
full, regardless of the ceiling — so a −20 Strength item cost 20 points to a character
already 90 over the cap, where the real cost is zero.

**Fix:** `creditable` now measures the movement of the *capped* total,
`min(already + amount, cap) − min(already, cap)`, which is exact in both directions and
handles the partial case (a −30 that crosses back under the ceiling costs only the part
below it).

### 7. EP paid for weapons in positions that do not wield them — **medium** — fixed

`computeTotals` reports a weapon only from Primary and Secondary. `scoreItem` credited
`RATIO` and `DMG` for **any** position, so the two "Any Slot" pickers ranked weapons by a
ratio the stat panel then refused to show. Score and panel contradicted each other.

**Fix:** scoring is position-aware; the ranking selector disables weapon terms for `ANY`.
An Any-Slot item still scores everything else it carries. **Reasoning, not evidence:** an
Any Slot is a worn position, distinct from Primary and Secondary in the client's own
inventory export, and melee comes from the two hands. If Any-Slot weapons do in fact swing,
this makes an Any-Slot ranking conservative rather than wrong — and the two sides now agree
either way, which they did not before.

### 8. The "Rank at +N" preview did not survive the click — **high** — fixed

The picker scored, previewed and displayed every row at the chosen preview tier, then
equipped the item at **+0** (or at whatever tier the previous occupant held). A player who
set "Rank at +7", read `340 EP` and a full +7 stat line, and clicked, got something else.

**Fix:** the preview tier rides through to the equip. Verified in the browser: preview +10
on Earthshaker equips at +10 and the panel reads the +10 numbers.

### 9. The whole Weapons panel was invisible — **high** — fixed

The stat panel's collapsible groups seeded their open state from a prop with `useState`.
`Weapons` is open only when a weapon is equipped — which happens *after* the panel mounts —
so the state was captured as `false` and never re-read. Damage, delay and both ratios were
hidden for the entire session, on every set, from the moment the panel first rendered
empty.

**Fix:** the group follows the prop until the reader toggles it themselves.

### 10. Equipped weight printed two different numbers — **medium** — fixed

The header tile rendered `1.7` and the vitals row rendered `2` for the same quantity: the
row passed a decimal through an integer formatter. **Fix:** one decimal in both places.

### 11. The ratio printed fewer digits than the client — **medium** — fixed

`1.06` where the client prints `1.057`. The panel exists to be compared against the game
line by line, and two decimals broke that. Three decimals with trailing zeros trimmed
reproduces **all five** Tier 0 ratio samples exactly, including the client's bare `0.5`.

### 12. A race restriction depended on a field it does not depend on — **low** — fixed

`canUseRace` refused an item restricted to `NONE` when the character had a race set, and
allowed it when they did not. 19 worn catalog rows carry `["NONE"]`. The "don't narrow on
an unset race" rule is about *lists*; a list that excludes everyone excludes everyone.

### 13. Era gating hid 13 items the live client is holding — **high** — fixed

`pipeline/README.md` records that EQL's `ERA_OVERRIDE` list — Kunark and Velious content
released early — was never recovered, so everything tagged after Sky is gated out wholesale
and some of it is wrong. The Tier 0 export settles 13 of them: the character **possesses
each one in the running game**.

```
Batskull Earring          Gold Plated Koshigatana   Selo`s Drums of the March
Crystalline Spear         Hamed's Ring of Tears     Tobrin's Mystical Eyepatch
Dragon Bone Bracelet      Hierophant`s Crook        Warhammer of Divine Grace
Gauntlets of Fiery Might  McVaxius` Horn of War     White Satin Gloves
                          Orb of Tishan
```

**Hamed's Ring of Tears is worn on a finger.** `Tobrin's Mystical Eyepatch` and
`Selo`s Drums of the March` are socketed as exaltations into worn gear. With "Live content
only" on — the default — the picker offered none of them.

**Fix:** `TIER0_LIVE_ITEMS` in `engine/constants.ts`, consulted at the time by `isLive`.
Every entry is a name **observed in a client export**. Nothing is inferred from an item's
era, zone or neighbours; the list is extended the same way or not at all.

**Updated 2026-08-17.** `isLive` is gone. The same list is now read by `pipeline/build.mjs`,
where it decides whether an out-of-era record is *shipped at all* rather than whether a
shipped record is *displayed*. Those 13 Kunark-tagged items are in the catalog for exactly
this reason and no other.

---

## Checks that passed unchanged

| Check | Method | Result |
|---|---|---|
| Worn haste takes the highest, never sums | two haste items, and the same at different tiers | 21 + 40 → 40; 40@+5 vs 21@+0 → 45. Compares *upgraded* values, correctly |
| Doubled slots count once per position | one vs two identical rings; browser | 10 STR → 20 STR; in-browser 49 HP → 98 HP |
| Clearing a slot removes its whole contribution | store, selector and browser | identical to never having equipped it; identical to `excludePosition` |
| Both Any Slots are real positions | 23 positions built and rendered | `EAR_1 EAR_2 … ANY_1 ANY_2` |
| Exaltation donors do not double-count | donors are names only; contribute no stats | **no double count** — see the caveat below |
| Aggregation is order-independent | forward vs reversed entry list | identical after finding 5 |
| Share round trip | complex set: 23 positions, banked fractions, +0 and +10, donors, notes | byte-identical totals, and re-encoding is idempotent |
| Persistence round trip | sanitiser, and JSON storage | byte-identical totals |
| Browser share + reload | link opened in a fresh view, then a cold reload | byte-identical panel, weight survives |
| Ranking determinism | same inputs twice; ties | identical order; ties break by name |
| Ranking isolation | unrelated slot changes far from any cap | scores unchanged; they move only when a ceiling is actually reached |
| Every candidate scores finite, sorted | all 19 slots, whole catalog, tier 6 | no NaN, order verified descending |
| Robustness | absent `st`/`sv`, zeros, negatives at every tier, 9,999, 1e9, NaN | no NaN escapes; penalties never invert; positives never decrease with tier |
| Unknown-era items stay visible | 2,414 rows with `eraUnknown` | all live, deliberately — **superseded 2026-08-17**: era-less is now treated as unconfirmed and quarantined; 76 such rows ship, each vouched for by the live export or the player |
| ~~Era toggle works~~ | ~~live-only vs all, same slot~~ | ~~all ⊃ live; every live row passes `isLive`~~ — **superseded 2026-08-17**: out-of-era content is quarantined in the pipeline, so `all == live` for every slot. `isLive` and the toggle it drove have been removed; `src/engine/tier0-catalog.test.ts` now asserts the purge invariant (`av === true` on every shipped item) in their place |
| No NaN / undefined / `[object Object]` on screen | full `body.innerText` sweep | clean, zero console errors |

---

## Tier 0 inventory eligibility

The export's **22 filled worn positions** are the strong test: the game itself let a
level 50 BRD/WAR/BER equip every one, so the picker must offer all of them.

| | |
|---|---|
| Worn positions in the export | 22 (including both Any Slots) |
| Present in the catalog | 21 / 22 |
| Filed under the slot the client used | 21 / 21 |
| Passed class + race eligibility | 21 / 21 |
| Shown as live (not era-gated) | 21 / 21 — **was 20 / 21** |
| **Offered by the picker for its own position** | **21 / 21 = 100%** of the items that exist in the catalog |

The one absentee is **Shadow Rage Helm**, which exists in no wiki scrape at all —
`pipeline/README.md` lists it among 11 known-missing live items. That is an upstream data
gap, not a planner defect, and there is nothing in `web/src/` that could fix it.

**Correcting the brief's premise.** "Every item in that file is one they can actually
equip" holds for the worn block and **not** for the rest of the file, so the audit does not
assert it there:

- The bags and bank hold gems, food, spell components, bags and keys — `Bone Chips`,
  `Blue Diamond`, `Backpack` — which are not equipment at all.
- The **`Equipment` key-ring is a collection, not a wardrobe.** Of its 102 distinct
  entries, 60 are restricted to classes this character does not have: `Ethereal Mist`
  (Cleric), `Valorium` (Paladin), `Umbral Platemail` (Shadow Knight), `Ton Po's Shoulder
  Wraps` (Monk), `Bracelet of Quiescence` (Enchanter). Those restrictions are correct, and
  a Bard/Warrior/Berserker cannot wear any of them. Treating that list as an equippability
  oracle would have driven a "fix" that broke class filtering for everyone.

Of the same key-ring, 4 were era-gated before this audit and are among the 13 now
un-gated; 1 (`Griffon Wing Spaulders`) is a known catalog spelling drift.

---

## Known-wrong, deliberately not changed

Each of these would need a guess to "fix", and guessing is the failure this project is
built to avoid.

1. **Exaltation donors contribute no stats.** A socketed worn or proc exaltation transfers
   a spell effect; no shipped data says what that effect *does* numerically. The tool
   records the donor and adds nothing. This is not a double count — it is an absence, and
   the Exaltations tab should say so rather than implying the sockets feed the panel.
2. **The `>10` branch of `scalePrimary` is not Tier 0 confirmed.** Earthshaker's STR 6 and
   STA 6 exercise only the `base <= 10` branch. Every attribute, AC, HP, MANA and save above
   10 — the overwhelming majority of the catalog — scales by a percentage rule that no
   client screenshot has yet checked.
3. **`scaleFlat` is not Tier 0 confirmed either**, for haste, the regens, Attack or the
   skill modifiers.
4. **Item flags are low confidence.** `meta.dataReliability.flags.doNotUseAsAuthoritativeFilter`
   is `true`, and the picker still offers a "Hide No Drop" checkbox that filters on
   `NO_DROP`. The client calls that flag `No Trade` on at least one item the catalog flags
   `NO_DROP`, so this filter is not trustworthy for loot decisions and should be labelled
   as such.
5. **Monk fist weapons carry the wrong skill upstream.** Whitened Treant Fists reads
   `Hand to Hand` in the client, `1H Blunt` in every scrape. 16 suspects are enumerated in
   `meta.dataReliability.weaponSkill.suspects` and none is rewritten.
6. **`Dmg Bon` is absent.** The client shows it (13 on the Fists, 50 on Earthshaker);
   no source carries it per item and it is probably derived from level and weapon type.
7. **8 items ship as `["ALL"]` because their exclusion list was unrecoverable**, so they
   are offered to classes that cannot use them. Upstream; not inventable here.
8. **The `ERA_OVERRIDE` list is still incomplete.** 13 items are now shipped on client
   evidence. Others are certainly still wrongly excluded; only more client evidence can
   name them. **Updated 2026-08-17:** there is no escape hatch any more. The "Live content
   only" toggle was removed along with the gate it drove, because the pipeline now
   quarantines out-of-era records instead of shipping them hidden. The recourse is
   `pipeline/quarantine.json`, which names all 7,719 withheld records so any of them can be
   restored on evidence.

---

## What could not be verified

Stated explicitly, because an unverified claim presented as verified is the defect this
audit exists to catch.

- **Anthemion Armbands and Darkspun Shroud have no client screenshot.** The Void
  reconciliation in finding 1 is reasoned from the pipeline's own reading of those two wiki
  pages, not measured.
- **No client sample exercises the `>10` percentage branch, `scaleFlat`, Attack, the skill
  modifiers, or any weight other than Earthshaker's.** Findings 3 and 4 fix what the client
  does say and leave the rest inferred.
- **Whether a weapon in an Any Slot swings is unknown.** Finding 7 makes the two sides
  agree; it does not prove which side the game is on.
- **Whether `NO_DROP` and `NO_TRADE` are one restriction is unresolved** — strong inference
  upstream, two client samples, not proof.
- **Base 3.0 at +10 in-client is unknown.** The third-party fixture said 0.4, the corrected
  model says 0.3, and only Earthshaker's 1.6 is measured.
