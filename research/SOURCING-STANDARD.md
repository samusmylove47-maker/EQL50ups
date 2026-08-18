# The sourcing standard

This project is held to the hierarchy published at **eqlsource.com/sources**, because it
will eventually be absorbed into that site. The hierarchy is reproduced here as the
governing rule for every number this planner puts on screen.

Transcribed from the live page on 2026-08-17.

---

## The hierarchy

| Tier | Source | Standing |
|---|---|---|
| **M** | **Our own combat logs** | Strongest. First-hand instrument data: what happened, in the live game, on a dated session, to a named character, parsed rather than remembered. **Outranks every read source for what it directly measures, and generalises to nothing beyond its stated conditions.** Always published with trio, level, zone, difficulty, date and sample size. One session is a sample, not a rate. |
| **1** | **Official patch notes** | Strongest *read* source. Dated, authoritative, and they override everything below them. Anything published after a wiki page's last edit supersedes that page. |
| **2** | **Structured wiki data** | Infoboxes, NPC tables, item tables, coordinate records on eqlwiki. Machine-shaped fields that somebody entered from the live game. |
| **3** | **Named community guides** | eqprogression.com, maintained wiki user guides. Named authors, actively updated, dated. Reliable, but one person's reading of the game. |
| **4** | **Aggregators** | EQL Build Forge, EQ Legends Tools. Useful for cross-checking a number against a second pair of eyes. Each carries a snapshot date; anything older than the last patch is stale. |
| **5** | **Wiki prose** | Marked on sight. Large parts are a **Project 1999 import, sometimes word for word**. It describes a single-class game at fixed difficulty. Quoted only when marked as classic, never as Legends fact. |

> **Two systems break almost all inherited advice.** Legends characters run *three* classes at
> once, and difficulty D0–D4 changes mob behaviour rather than mob level. Any line that says
> "you need a full group of level 50s" came from a game where neither was true, and is
> unreliable in both directions.

---

## What this means for this repository

**Tier M is the player's own client output.** For this project that is:
`research/validation/tier0-inventory-Avenrae.txt` (a `/outputfile inventory` export),
the client screenshots recorded in `TIER0-VALIDATION.md`, and the owner's direct reports
in `TIER0-PLAYER-REPORTS.md`. These outrank every scraped field, and they are why the
upgrade maths was corrected twice against the game after a third-party model disagreed.

**Our item catalog is Tier 2, and it is contaminated.** The catalog is built from
`eqlwiki.com` scrapes. Tier 5 warns that large parts of that wiki are a Project 1999
import — and the item tables carry the same inheritance. The raw scrape holds
**11,252 items, of which 7,599 are content from expansions that do not exist in
EverQuest Legends** or carry no era at all: Scars of Velious (2,828), no era in any
source (2,230), Ruins of Kunark (1,438), epic quests (867), the Chardok revamp (145), the
Fear/Hate revamp (53), pages the wiki itself flags as not-in-Legends (26), and Shadows of
Luclin (12). **3,653 items survive the purge**, and a further **10 ship that were never in
the scrape at all** — see rule 7 — for **3,663 shipped in total**. The rest are quarantined, in full and by name, in
`pipeline/quarantine.json`, so restoring any of them is a table entry rather than a
re-scrape.

*(Figures read off `web/public/data/meta.json`, which the build computes. An earlier
version of this paragraph was typed by hand and went stale the first time the catalog
moved; the counts in it are now derived from the same file the site reads.)*

This was not a subtle failure. A previous session read the wiki's `FearHateRevamp` era tag,
inferred that its five sets (Legionnaire Scale, Greenmist, of the Righteous, of the Untamed,
of Harmony) were EQL-added planar class gear, and reported that inference to the owner as
**structural confirmation**. It was not confirmation of anything. FearHateRevamp is an
original-EverQuest content patch, those sets are not in the game, and the only confirmed
EQL-specific set is **Shadow Rage** — reported by the owner (Tier M) as the Berserker set
from the Planes of Fear and Hate.

An inference is never evidence. That is the whole point of the hierarchy.

---

## The rules this repository follows

1. **A Tier M observation ends the argument.** Where the game and any source disagree, the
   game wins and the source is corrected, not averaged. See `pipeline/build.mjs`'s Tier 0
   correction tables.

2. **Ship only what is confirmed in era.** An item reaches the catalog only if its era is
   pre-Kunark (`Classic`, `Fear`, `Hate`, `Paineel`, `Temple`, `Sky`) **or** it appears in
   the owner's live client export, which is Tier M proof it exists whatever the wiki says.
   Everything else is quarantined — retained in the pipeline with a report, absent from what
   ships.

3. **Era-less is not classic.** An item with no era anywhere is unconfirmed, not assumed
   in-era. It is quarantined until a Tier M or Tier 1 source places it.

4. **Never invent a number.** Where a stat is unknown, the item ships with `statsUnknown`
   and is withheld from ranking and auto-fill rather than scored as zero. Shadow Rage ships
   this way: three of its six pieces carry scraped stat blocks, but those blocks cannot be
   shown to have come from Legends rather than from original EverQuest, so none of them is
   used until the owner supplies verified numbers.

5. **Surface the tier to the user.** A player looking at a number is entitled to know
   whether it came from the game or from a wiki page of uncertain provenance. Uncertainty
   belongs on screen, not buried in a README.

6. **Date everything.** Scrapes are pinned to commits and carry a snapshot date. Anything
   older than the last patch is treated as stale, per Tier 4's rule.

7. **Tier M existence ships the item, with nothing attached.** An item can be in the game
   and in no catalog anywhere — that is what a patch produces, every time. Where a Tier M
   source *names* an item and no source *describes* it, the item ships as an
   **existence-only record**: `statsUnknown: true`, `xo: true`, an `evidence` string naming
   the file that proves it, and no slot, no class, no era and no stats. It is never ranked,
   scored or auto-filled.

   The three qualifying sources are a measured drop in `sightings.v1.json`, a name in
   `items.v1.json`, and a line in this repository's own client export. **No code change is
   required for a new item**, which is the point: the rule is general, and
   `pipeline/refresh.mjs` plus `research/PATCH-DAY.md` are how it is exercised.

   What must **not** happen is filling the blanks from the name. `Mistmoore Cudgel` is
   obviously a weapon and obviously not a hat; obvious is not observed, and this is the
   exact reasoning that once read a wiki era tag as structural confirmation of five armour
   sets that are not in the game. An empty field is a fact about the evidence and it is
   published as one.
