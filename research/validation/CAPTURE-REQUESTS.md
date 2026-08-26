# Capture requests

Instructions for the player, written to be executed without interpretation.

One request per section. Each names the exact steps, the exact reading to take, and — the
part that matters most — **what every possible outcome looks like, including the ones that
are not the answer we expect**. An absence must never come back looking like a botched
capture, and a botched capture must never come back looking like an absence.

Results are logged in `TIER0-PLAYER-REPORTS.md` and, where they change a rule, in
`TIER0-VALIDATION.md`.

---

## §1 — Do two same-family exaltations stack?

**Why this one.** The planner strikes effects off a player's set on this rule and says
*"does not count"* to their face. Its whole provenance is one community author's reading of
a wiki page, in a project file that elsewhere says **"Use jmoyers. Do not use Thiole's
math."** about that same author. It is also exactly how classic EverQuest's focus effects
worked, which is corroboration by inheritance rather than by observation. Nobody has watched
the game do it. The rule is `EXALTATION_STACKING` in `web/src/engine/exaltation.ts`.

### What to do

1. **Get two exaltation donors from one family.** The family that needs the fewest items is
   **Improved Healing** — a focus effect, which is the kind the rule is actually about:

   | Effect | Donor item | Donor slot | Donor classes |
   |---|---|---|---|
   | `Improved Healing III` | Idol of the Underking | Range / Primary / Secondary | ALL |
   | `Improved Healing I` | Emissary Mask | Face | WAR, BRD, CLR, PAL, SHD |
   | `Improved Healing I` | Zaharn's Coronet | Head | CLR, DRU, SHM |

   Any two of those three will do; `Idol of the Underking` plus either of the other two gives
   a rank III against a rank I, which is the case the planner most often strikes out.

2. **Open the Stats window and write down `Heal Amount`, under Spell Mods, with neither
   exaltation socketed.** This is the baseline. Screenshot it.

3. **Socket `Improved Healing III` into one worn item. Read `Heal Amount` again.**

   **Stop here and report if the number did not move.** That is not a failure — see
   *Outcome C* below. It means this field does not reflect focus effects and the whole route
   is wrong, which is worth knowing before you spend a second item on it.

4. **Socket `Improved Healing I` into a second worn item, keeping the first in place. Read
   `Heal Amount` a third time.**

### What to send back

Three screenshots — baseline, one socketed, both socketed — each showing the **Spell Mods**
group of the Stats window. Plus the item window of each host, showing its `Focus Effect:`
line, so there is proof both were actually in place at the same time.

### What each outcome means

| | Reading | What it means | What we do |
|---|---|---|---|
| **A. They stack** | Heal Amount moves again on the third reading | **Our rule is wrong.** Two ranks of one family both apply. | The planner stops striking rows out. `dedupeByFamily` comes out of the effects path. |
| **B. They do not stack** | Heal Amount moves on the second reading and **not** on the third | **Our rule is right**, and it stops being Tier 5. | The rule is graded Tier M, the chip on the "Not counted" block comes off, and this becomes a row in `TIER0-VALIDATION.md`. |
| **C. The window cannot tell us** | Heal Amount does not move even with **one** socketed | **Not a failed capture and not an answer.** It means focus effects do not surface on this field, so no number of screenshots of it will ever settle the question. | We record the route as closed, keep the Tier 5 mark, and design a different reading — most likely parsing an actual heal in the log at one rank and at two. |
| **D. The game refuses the socket** | The client will not let the second donor in | **A different question answered, and a valuable one.** There is not one refused socketing on record anywhere in this repository, and `canSocket` — "same slot plus at least one shared class" — has the same Tier 5 provenance as the rule above. | Screenshot the refusal and any message. It becomes the first observation of the socketing rule. The stacking question stays open. |
| **E. The capture failed** | Could not obtain the items, or could not open the window | Nothing is learned; nothing is recorded. | Say so plainly. **Do not let this arrive as outcome C** — the two look identical in a report that only says "no change". |

**The distinction between C and E is the whole reason this section is written out.** C is a
finding about the game and closes a route. E is a thing that did not happen. A report that
says only *"nothing moved"* cannot be told apart from either, and would be filed as evidence
when it is not.

### What this does not settle

Whether the rule extends across socket *kinds*. The sourced sentence is about focus effects;
our code pools focus, click, worn and proc into one family check, so a worn effect and a
focus effect of one family currently compete. This capture answers the focus case only. If
outcome B lands, the cross-kind widening is still unsourced and stays marked.

---

## Queued, not yet written up

- **Haste stacking and the haste cap.** `HASTE_STACKING` and `HASTE_PROVENANCE` in
  `web/src/engine/stats.ts` each already carry a `settle:` line naming the screenshot that
  would end them: an Attack Speed reading with two hasted items worn beside the same reading
  with one, and an item's haste line beside the Attack Speed reading on a character wearing
  nothing else hasted. Both are one screenshot each and neither has been written out to this
  file's standard yet.
