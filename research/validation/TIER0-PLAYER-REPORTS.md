# Tier 0 player reports

**Tier 0 is the running game.** The project's sourcing model (`research/eql-game-systems.md`)
ranks official patch notes as Tier 1 and community wikis below that; the game itself sits above
both. A statement from the player who is logged into EverQuest Legends is Tier 0 evidence, on the
same footing as a client screenshot or an `/outputfile` export, and it supersedes every wiki page.

This file is the log of such reports, what each one changed, and — just as importantly — what each
one was **not** allowed to change. Every correction the pipeline applies on this authority lives in
the `TIER0_CORRECTIONS` and `TIER0_KNOWN_ITEMS` tables at the top of `pipeline/build.mjs`, and is
re-asserted independently by `pipeline/verify.mjs` §9b so a table that stops matching the catalog
fails the build instead of quietly doing nothing.

---

## 2026-08-17 — Shadow Rage is the Berserker planar set

> "Shadow rage is the berserker set from plane of fear and plane of hate that was added for EQ
> legends, to be in line with the other planar class gear sets."

### Why this is credible, structurally

The catalog has an era called `FearHateRevamp` holding exactly the planar class sets EQL added to
the Planes of Fear and Hate. Before this report it held 53 items and five complete class sets:

| Set | Class | Pieces |
|---|---|---|
| Legionnaire Scale | WAR | 8 — Helm, Breastplate, Vambraces, Bracers, Gauntlets, Greaves, Boots, Pauldron |
| Greenmist | SHD | 7 — Helm, Mask, Breastplate, Vambraces, Bracer, Greaves, Boots |
| … of the Righteous | PAL | 7 — Helm, Breastplate, Vambraces, Bracer, Gauntlets, Greaves, Boots |
| … of the Untamed | RNG | 7 — Helm, Breastplate, Vambraces, Bracer, Gauntlets, Greaves, Boots |
| … of Harmony | DRU | 7 — Crown, Hauberk, Vambraces, Wristguard, Gloves, Greaves, Sandals |

Shadow Rage is the Berserker sibling, and it fits the pattern exactly: BER-only, one piece per
armour slot, and named in the same style. The wiki simply never scraped it as a set — it had three
of the pieces on unrelated pages and no era on two of them.

The player also **holds five of the six pieces in a live client export**
(`tier0-inventory-Avenrae.txt`): the Helm is worn on the head, and the Gloves, Sleeves, Wristguard
and Boots are in bank slot 15.

### What changed

**1. Era corrected on the three pieces the wiki already had.**

| Item | Was | Now |
|---|---|---|
| Shadow Rage Leggings (LEGS) | `era: Classic` | `era: FearHateRevamp` |
| Shadow Rage Sleeves (ARMS, #55603) | no era anywhere, `eraUnknown: true` | `era: FearHateRevamp` |
| Shadow Rage Wristguard (WRIST, #55604) | no era anywhere, `eraUnknown: true` | `era: FearHateRevamp` |

Their stats, flags, weights and icons are untouched — the wiki's numbers, exactly as they were.

**2. Three pieces added that no wiki catalog has ever carried.**

| Item | Slot | Item id | Evidence for each field |
|---|---|---|---|
| Shadow Rage Helm | HEAD | 55601 | name + id read off the export; slot from the name and from every sibling set having a head piece; class and era from the report |
| Shadow Rage Gloves | HANDS | 55605 | as above |
| Shadow Rage Boots | FEET | 55607 | as above |

**They carry no stats, no weight, no size, no flags and no icon**, because nothing observed any of
those. They ship with `statsUnknown: true` and an `evidence` string naming what proves they exist.
See "Representing a known item with no stats" below.

**3. The six pieces were un-gated.**

`FearHateRevamp` ranks *after* `Sky` in the era chronology, so tagging the set with its real era
gated it out as "not yet live" — while the player is wearing the helm. The six pieces are therefore
listed in `TIER0_LIVE_ITEMS` (`web/src/engine/constants.ts`), the existing mechanism for "the era
gate hides this and a live client demonstrably holds it". Five are there because they appear in the
export; `Shadow Rage Leggings` is there because the report says Shadow Rage is one set, and it is
quarantined in a separate, separately-documented list in that file so the weaker evidence is
visible rather than blended in.

### What deliberately did **not** change

- **The other 53 `FearHateRevamp` items are still gated out.** One set being live is not proof the
  era is. Un-gating 53 items on that inference is precisely the move this project exists to refuse.
  It is, however, now an open question worth resolving — see below.
- **No stat, flag, weight or icon was invented for the three new records.** A zero is a measurement;
  an absent value is not.
- **No seventh Shadow Rage piece was added.** Every sibling set has a chest piece, so one very
  probably exists — but no source names it and no export contains it, so the catalog says nothing
  about it. A guessed name would be a fabricated item.

---

## Finding: the wiki's `FearHateRevamp` coverage is class-incomplete

The Shadow Rage gap is not a one-off. Measuring the era's 59 items by *class-exclusive armour*
shows the wiki has full sets for five classes and almost nothing for the rest:

| Class | Class-exclusive armour pieces in `FearHateRevamp` |
|---|---|
| WAR | **8** (Legionnaire Scale — a complete set) |
| SHD | **7** (Greenmist) |
| PAL | **7** (of the Righteous) |
| RNG | **7** (of the Untamed) |
| DRU | **7** (of Harmony) |
| BER | **6** (Shadow Rage — recovered by this report, and probably still missing a chest piece) |
| BRD | 1 (Songshawl, shoulders) |
| CLR, ENC, MAG, MNK, NEC, ROG, SHM, WIZ, BST | **0** |

The remaining items of the era are shared-class jewellery and weapons.

**This is a catalog coverage gap, not evidence that the missing sets do not exist.** The reasoning
is the same one that recovered Shadow Rage: EQL added these sets "to be in line with the other
planar class gear sets", the pattern is one set per class, and the only class we have independent
Tier 0 evidence for outside the five scraped sets turned out to have a set the wiki had never
recorded as one. Nine classes showing zero planar armour in a revamp explicitly built around class
sets is far more likely to be an incomplete scrape than a design decision.

Nothing is added on the strength of that reasoning. It is written down so that:

- a zero result in a picker for, say, a Rogue looking at Fear and Hate is read as "we do not have
  this data" rather than "this content does not exist";
- the next player report or client export can be checked against it directly.

### Open question for the next Tier 0 sample

**Is the whole `FearHateRevamp` era live?** The player possesses six items from it, which means at
least part of it is obtainable now. If the era is live in full, 53 items are currently hidden behind
the "Live content only" filter for no reason. Resolving it needs either a patch note, or a client
sighting of a `FearHateRevamp` item outside the Shadow Rage set — a Legionnaire Scale or Greenmist
piece would settle it. Until then the era gate stands and only the observed items are un-gated.

---

## Representing a known item with no stats

The three added pieces needed a shape for "this is real and we have no numbers for it", which the
catalog had no concept of. `eraUnknown` was the closest existing idea — a positive assertion that a
specific field is *missing*, as opposed to absent — and the new marker is deliberately its twin:

```jsonc
{
  "id": 55601,
  "n": "Shadow Rage Helm",
  "sl": ["HEAD"],
  "cl": ["BER"],
  "era": "FearHateRevamp",
  "av": false,
  "statsUnknown": true,      // no source carries this item's stats
  "evidence": "Confirmed to exist: worn in the Head position of the live client …"
}
```

`statsUnknown` is **not** the same as having no stats. Thousands of ordinary records — food,
containers, tradeskill components, quest turn-ins — carry an empty `st` and are completely
described that way. `statsUnknown` says the data is missing, and it is the flag every consumer
checks before deciding whether an item may be compared with another.

Consequences, enforced in code and pinned by tests:

- **`rankSlotItems` refuses them.** Every scorer reads an absent stat as zero, which is correct for
  an item that has none and a fabrication for one nobody recorded. Withheld at the ranking rather
  than at each surface, so Auto-fill and every future consumer inherit the refusal.
- **Auto-fill therefore never places one**, even into a slot with no other candidate.
- **The picker names them underneath the list** instead of silently dropping them
  (`unstattedForSlot`): a player searching for the helm on their own head deserves better than
  "No matching items".
- **The item browser lists them with `—` in the EP column**, never a `0.0` among real scores.
- **The item window says so in words**, in the place the numbers would have been, and prints the
  evidence.
- **The importer reports them as their own category**, distinct from "no such item", and does not
  equip them: a filled slot contributing nothing would show a complete-looking set totalling as
  though the slot were empty.
