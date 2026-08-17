<!-- Written by a review agent, 2026-08-17, against the re-skinned build.
     Preserved verbatim: these are findings to work from, not prose to polish. -->

I changed no files (56 modified + `.artifacts/` untracked, all pre-existing). Here is the review.

---

# Editorial review — eqlsource.com standard vs. what the app puts on screen

I read `research/SOURCING-STANDARD.md`, then drove the built app against `vite preview` and opened real items, rather than trusting either report.

## Where it genuinely honours the standard

**Rule 4 ("never invent a number") is honoured completely, and the Shadow Rage question is a clear pass.** All six pieces are marked as unverified on every surface where a user can meet them, and each surface says something correct *for its own context* rather than repeating one string:

| Surface | What renders |
|---|---|
| `ItemBrowser.tsx:463` | `NO STAT DATA` tag; stats, era and EP columns all em-dash — verified in the running app, all six rows |
| `ItemWindow.tsx:137` | `UNSOURCED · STATS WITHHELD`, then a **Stats** heading whose body is prose in the place the numbers would have been, then the verbatim evidence string naming the export file and item id `#55601` |
| `ItemDetail.tsx:57` | Equip buttons withdrawn entirely, with the reason stated |
| `ItemPicker.tsx:519` | Names the withheld items *before* the list — "missing from this list on purpose: **Shadow Rage Helm**… Ranking it at zero would be a made-up answer" |
| `inventoryImport.ts:550` | Refuses to equip and reports per export line with the id, under a heading worded differently on purpose |

`gear.ts:315,348` keeps them out of both ranking and auto-fill. I expected this to be shallow and it is not — it is the best work in the repo, and I found less to attack here than I went looking for. `DataBanner.tsx:99-103` also puts eqlwiki attribution and a build date ("3,533 items loaded, Aug 17, 2026") on every screen, which satisfies rule 6 at the page level.

That is one of the two uncertainty classes. **The other one is unhandled, and in twelve places it is backwards.**

---

## 1. The provenance mark is inverted. This is the worst thing here.

Your question — *is a wiki stat distinguishable from a client-proven one?* — has a worse answer than "no."

`ItemWindow.tsx:88-93` renders `TIER M · CONFIRMED IN THE LIVE GAME` when `isTier0Confirmed(item.n)`. I opened both of these in the running app:

- **Orb of Tishan** shows `TIER M · CONFIRMED IN THE LIVE GAME` sitting directly on top of `DMG 7 DLY 25 RATIO 0.28 MANA +35 / Strength +9 / Stamina +9`. Every one of those numbers is a wiki scrape. `tier0-inventory-Avenrae.txt` is `Location / Name / ID / Count / Slots` — it carries **no stat values at all**. The strongest label in your vocabulary is printed over Tier 2 data with nothing between them.
- **Earthshaker** shows **no mark**. Its `DMG 37 DLY 70 STR +6 STA +6 DEX -5` is the only stat block in this project checked digit-for-digit against a live client window — `TIER0-VALIDATION.md §1`, 9 of 9 predictions exact including the synthetic SV Void.

Measured against the export and the catalog: **285** export names ship; **267** of them render no mark; **171** of those print stats. The badge fires on 18 names, **12 of which print wiki stat numbers underneath it.**

The cause is that `TIER0_LIVE_ITEMS` (`constants.ts:202-240`) is not the export — it is the 18-name *rescue list* of items that would otherwise have been quarantined for era. Its own comment says so ("the sole reason thirteen Kunark items and the Shadow Rage set are in the catalog at all"), but `ItemWindow.tsx:60` reads it as "seen in the owner's export," and the label inherits that misreading. The badge's absence therefore carries a false implicature on exactly the items with the best evidence.

**Fix:** split one concept into two. Build an `existence` set from `tier0-inventory-Avenrae.txt` itself (297 names, already in-repo) and a separate `statsVerified` set seeded with the two items in `TIER0-VALIDATION.md`. Then `standingOf` returns two independent marks — "Tier M · held in a live inventory" and "Tier M · stats read off the client" — and Earthshaker gets the one it earned.

## 2. The landing page downgrades its own best evidence — first screen, hero slot

`Landing.tsx:148` and `:207` say "the **wiki-verified** upgrade curve" and "**wiki-verified** scaling rules." Beside line 148 sits the hero product shot: an Earthshaker window at +10 reading `DMG 74 DLY 70 RATIO 1.057 / Strength +16 / Stamina +16 / Void Resist +10`. Those are the precise figures `TIER0-VALIDATION.md` confirmed against the running client. `Landing.tsx:50` even knows it — "Earthshaker's numbers are the Tier 0 sample recorded in the validation set."

So the app selected the right exemplar, printed its Tier M numbers, and labelled them Tier 2. Under your own hierarchy that is a demotion of four tiers, on the first screen, in the sentence meant to establish trust.

**Fix:** "confirmed against the live client, 9 of 9 predictions exact." You have the receipt; cite it.

## 3. `meta.dataReliability` ships to the browser and never reaches a screen

The single richest provenance artifact in the project — stats confidence, flags confidence `low` with `doNotUseAsAuthoritativeFilter: true`, two `clientVerifiedContradictions`, the four named Monk fist-weapon suspects, `dmgBonus` absent, `itemIds` high-but-sparse — is downloaded by every user and read by **nothing in `web/src`**. Its only consumer is `pipeline/verify.mjs:149-154`, which asserts it exists and then no one shows it.

This is rule 5 stated as precisely as it can be stated: the uncertainty is not buried in a README, it is buried in the payload the browser already has.

**Fix:** a `/sources` route that renders `meta.dataReliability` more or less verbatim, linked from `DataBanner`. There are no screens for this today — `web/src/screens/` has no About or Sources page, and nothing in any `.tsx` links to `SOURCING-STANDARD.md`.

## 4. The app filters on a vocabulary its own metadata forbids filtering on

`ItemPicker.tsx:258` — `if (deferredHideNoDrop && item.fl.includes('NO_DROP')) continue;` — behind a **Hide No Drop** checkbox at `:489-492`, visible in `07-item-window-desktop.png`. `meta.dataReliability.flags.doNotUseAsAuthoritativeFilter` is `true`, and `NO_DROP` appears on 3,355 legacy-style pages and **0** modern-style pages, so the checkbox silently hides by page-authoring convention as much as by game rule.

Worse, the contradiction lands on your marquee item: the Earthshaker window prints `LORE MAGIC`, while the client shows *Lore Equipped, No Trade, Placeable*. That contradiction is recorded in `meta.json` and displayed nowhere. **You are printing a value you hold Tier M evidence is wrong, unmarked, on the item you put on the front page.**

**Fix:** caption the checkbox with what it actually does, and mark the two `clientVerifiedContradictions` items in `ItemWindow` where the flag row renders.

## 5. `eraUnknown` is erased at the glass

`itemStyle.ts:61-63` is the whole of it: `return item.era ? item.era : null`. It never consults `eraUnknown`. **76** items carry the flag; **40 of them print full stat blocks and take a full EP score** — Indicolite Breastplate renders `AC +35 · DEX +15 · STA +15 · STR +15` with an em dash in the ERA column, indistinguishable from any other absent field.

Rule 3 says era-less is *unconfirmed*, not merely blank. You enforce that at the pipeline gate and then discard the distinction on the way to the screen.

**Fix:** render `UNPLACED` in `--text-faint` where `eraUnknown` is set, rather than falling through to the generic dash.

## 6. Kunark items ship with no explanation on screen

Orb of Tishan renders `KUNARK` in both the era column and the window, in a catalog whose whole premise is that Kunark was purged. It is legitimate — Tier M rescue — but a player who knows the game reads it as the purge having failed, and nothing on screen corrects them.

**Fix:** where an item's era outranks `meta.era.current` but it is Tier M, print "Kunark — shipped on live-client evidence" rather than a bare era tag.

## 7. A per-item provenance field is dropped during parsing

**3,785 of 3,868** shipped rows carry `es` — `eqlwiki.available_from` (2,412), `jmoyers.eraTag` (1,366), `nathanbates.era` (4), `tier0.player-report` (3). `es` is absent from `web/src/engine/types.ts`, so `normalizeItem` discards it. The era line the user reads has a recorded source that is thrown away at parse time.

**Fix:** add `es?: string` to `Item`, carry it through `normalize.ts`, print it beneath the era in `ItemWindow`. This is the cheapest of the seven fixes and it converts an era tag from an assertion into a citation.

## 8. Smaller: an inference wired as a hard constraint

`constants.ts:250-256` documents `LEVEL_CAP = 50` as "INFERRED, not confirmed… Treated as a soft UI bound only." `NewCharacter.tsx:57` does `Math.min(LEVEL_CAP, Math.round(parsedLevel))` and both level inputs set `max={LEVEL_CAP}`. The comment says soft; the code clamps. Low impact, but it is exactly the pattern the standard exists to catch. Either allow entry above 50 with a note, or label the field "50 (assumed cap)."

One point I'll drop rather than overstate: I was going to argue the one-decimal EP column overclaims precision, but EP is a preference score computed from the user's own weights, so its resolution is a property of the arithmetic and the complaint doesn't hold. The defensible version is narrower — in `ItemBrowser`, the STATS column (sourced) and the EP column (derived) are typographically identical, so nothing tells a reader which one is a measurement.

---

## Verdict

The pipeline is honest and auditable, and the *missing-data* case is handled better than any commercial planner I know of. But the lens is what a player sees, and rule 5 — the rule this project wrote for itself — is satisfied for **6 items out of 3,533**. The other 3,527 present wiki numbers in the same typeface, with the same silence, as client-verified ones.

An absence would score around a 6. What pulls it lower is that the one provenance mechanism that exists is *inverted*: it decorates 12 wiki stat blocks with your strongest label and leaves your only client-verified stat block bare, while the landing page calls Tier M evidence "wiki-verified" and a checkbox filters on a vocabulary your own metadata declares unfit for filtering. A user who learns to trust the badge has been taught something false. That is worse than a user who was told nothing.

Everything needed to fix this is already in the repo: the export file, `TIER0-VALIDATION.md`, `meta.dataReliability`, and a populated `es` field. None of it reaches a screen.

SCORE: 5/10