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

### You already hold both items — nothing needs to be farmed

This is the whole reason to run **Burning Affliction** rather than any other family. Both
donors are in your own inventory export, and one of them is *already socketed*:

| | Effect | Donor | Where it is | Existence | Effect name |
|---|---|---|---|---|---|
| **higher** | `Burning Affliction III` | Bone-Clasped Girdle +4 (id 11666) | **worn on the Waist, and already in its own Focus socket** — export lines 110-111 | **Tier M** — you are wearing it | **Tier M** — `sd: tier-M` |
| **lower** | `Burning Affliction II` | Serpentine Bracer +2 (id 10148) | Bank11-Slot7, and already listed under `Augmentation` — export lines 662, 838 | **Tier M** — it is in your bank | **Tier 2** — the wiki's word, not read off the client |

Both are `k: focus`, which is the kind the sourced rule is actually about.

**Read the last column before you start.** The *items* are certain — the export is the game's
own file. The *effect the Serpentine Bracer carries* is a wiki claim nobody has confirmed. If
its item window says something other than `Burning Affliction II`, that is not a failed
capture: it is a catalogue correction worth having, and you should stop and report it.

**Do not substitute `Black Tome with Silver Runes`** (id 13400, export line 862), even though
it also carries `Burning Affliction II` and you hold it. It is ENC/MAG/NEC/WIZ only, so on our
own reading of the socketing rules it would narrow its host out of your trio's classes — and
a capture that fails for that reason looks exactly like a capture that failed because the
effects do not stack.

### What to do

1. **Open the Stats window and write down `Spell Damage`, under Spell Mods, with the
   Girdle's Focus socket EMPTY.** This is the control. Screenshot it. If the Girdle is
   socketed as the export shows, empty it first — the control has to come from a state with
   neither effect in play.

2. **Socket `Burning Affliction III` back into the Girdle. Read `Spell Damage` again.**

   **Stop here and report if the number did not move.** That is not a failure — see
   *Outcome C*. It means this field does not surface a damage focus, so no number of
   screenshots of it can settle the question, and it is worth knowing before you spend the
   second donor on it.

3. **Socket `Burning Affliction II` from the Serpentine Bracer into a second worn item,
   keeping the Girdle's in place. Read `Spell Damage` a third time.**

**Which field a focus family surfaces on is itself unverified.** `Burning Affliction` is a
damage-over-time focus and `Spell Damage` is the closest field the Stats window offers
(`UI-REFERENCE.md` §B3), but nobody here has watched a focus effect move any field. That is
what step 1 is for, and it is why the control reading comes before the experiment rather than
after it.

### Fallback, only if outcome C lands

**Improved Healing**, read against `Heal Amount` instead — a heal focus against a heal field
is a better-matched pair. It is the fallback and not the first choice because **all three of
its donors are `sd: tier-2` wiki records and none carries a client-export id**: `Idol of the
Underking` (The Hole), `Emissary Mask` (Najena), `Zaharn's Coronet` (Permafrost). Nobody has
confirmed any of the three exists. A trip that comes back empty would prove nothing about
stacking, and would arrive looking like outcome E.

### What to send back

Three screenshots — control, one socketed, both socketed — each showing the **Spell Mods**
group of the Stats window. Plus the item window of each host, showing its `Focus Effect:`
line, so there is proof both were actually in place at the same time.

### What each outcome means

| | Reading | What it means | What we do |
|---|---|---|---|
| **A. They stack** | `Spell Damage` moves again on the third reading | **Our rule is wrong.** Two ranks of one family both apply. | The planner stops striking rows out. `dedupeByFamily` comes out of the effects path. |
| **B. They do not stack** | `Spell Damage` moves on the second reading and **not** on the third | **Our rule is right**, and it stops being Tier 5. | The rule is graded Tier M, the chip on the "Not counted" block comes off, and this becomes a row in `TIER0-VALIDATION.md`. |
| **C. The window cannot tell us** | `Spell Damage` does not move even with **one** socketed | **Not a failed capture and not an answer.** It means a damage focus does not surface on this field, so no number of screenshots of it will ever settle the question. | Try the **Improved Healing / `Heal Amount`** fallback above. If that field is dead too, the route is closed: keep the Tier 5 mark and settle it by parsing real casts in the log at one rank and at two. |
| **D. The game refuses the socket** | The client will not let the second donor in | **A different question answered, and a valuable one.** There is not one refused socketing on record anywhere in this repository, and `canSocket` — "same slot plus at least one shared class" — has the same Tier 5 provenance as the rule above. | Screenshot the refusal and any message. It becomes the first observation of the socketing rule. The stacking question stays open. |
| **E. The capture failed** | Could not empty or refill a socket, or could not open the window | Nothing is learned; nothing is recorded. | Say so plainly. **Do not let this arrive as outcome C** — the two look identical in a report that only says "no change". |

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
