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

## §2 — Can a class with no dual wield equip a weapon in Secondary?

**Why this one.** The planner deliberately does **not** check it, and that decision needs
settling in one direction or the other. Classic EverQuest gated Dual Wield by class and the
obvious move is to carry the table over; Session E audited that and ruled against it — the rule
is unmeasured on Legends, absent from 138 logs, and eqlwiki's Dual Wield section presumes it
without stating it. So today the app shows every offhand weapon to every trio and marks the
class rule Tier 5 (`DUAL_WIELD_STANDING` in `web/src/engine/character.ts`).

**Both answers are useful.** If the game refuses, we gain a gate we currently decline to build.
If it allows, a rule everybody carries over from 1999 is retired with evidence. There is no
outcome here that leaves us where we started.

### What to do

1. **Pick a character whose classes are all "cannot dual wield" under the classic table** — a
   pure caster trio is cleanest. Wizard, Magician, Enchanter, Necromancer, Cleric and Druid are
   all non-dual-wield in classic.
2. **Get any weapon that lists Secondary in its slot line.** It does not need to be good; it
   needs to be a weapon rather than a shield, because holding a shield is not dual wielding.
   Anything with a DMG and DLY line and `Secondary` among its slots will do.
3. **Equip your main hand first**, so the offhand is the only question being asked.
4. **Try to put the weapon in the Secondary slot.** Screenshot what happens.

### What to send back

The character window showing the class line, the item window showing its slot line, and the
result — the weapon sitting in Secondary, or the client's refusal and any message it prints.

### What each outcome means

| | Reading | What it means | What we do |
|---|---|---|---|
| **A. It goes in** | The weapon sits in Secondary and stays there after a zone or relog | **The classic class rule does not apply on Legends.** | The Tier 5 mark comes off, `DUAL_WIELD_STANDING` is retired, and this becomes a row in `TIER0-VALIDATION.md`. The planner is already correct and stays as it is. |
| **B. It is refused** | The client will not place it, or places and then rejects it | **The class rule is real.** | The gate gets built — and it gets built from what the client refused, not from the classic table, because *which* classes are gated is a second question this capture does not answer. |
| **C. It goes in but does not swing** | It sits in the slot; the combat log shows no offhand attacks | **Both rules are partly right**, and the distinction is equip-versus-attack. | The mark stays, reworded: the item is equippable and the attack is not modelled. This is the outcome the planner already describes most accurately. |
| **D. No such character or weapon to hand** | Could not assemble the test | Nothing is learned. | Say so. **Do not let this arrive as outcome B** — "I could not equip it" and "the game refused it" are the same sentence in English and opposite findings. |

**B and D are the pair to keep apart here**, the way C and E are in §1. A refusal by the game
and a failure to run the test both end with the weapon not in the slot.

### What this does not settle

**Which** classes are gated, if any are. This capture asks one character one question. A gate
built from one refusal would be a classic table wearing one observation as a hat, which is the
fault the mark exists to prevent — so outcome B licenses building a gate, not copying one.

---

## §3 — Where does total haste stop counting?

**Why this one.** Every capped stat on the planner's stat sheet prints a denominator read off
the client — attributes `/510`, saves `/1000`, the heroic mods their own. **Attack Speed prints
a bare number**, because our one source names a cap we have never measured and cannot model
without inventing a curve:

> *Total haste capped ~50% below L30, ~75% at L50; only the highest worn-haste item counts;
> item/spell/song haste of different types stack.* — eqltools/eqlwiki Haste Guide, Tier 5

23 catalogue items carry haste, and at +10 a haste belt is the single largest EP any item can
earn under the Melee DPS profile — larger than the best weapon in the game. If the third clause
is right and item, spell and song haste share one ceiling, a trio with a Bard, Shaman or
Enchanter may be at that ceiling before equipping anything, and all 23 are ranked as if their
full figure lands.

### What to do

1. **Open the Stats window with no haste at all** — nothing hasted worn, no haste song or spell
   running — and write down **Attack Speed**. This is the control.
2. **Equip one hasted item. Read Attack Speed again.** This establishes the units: whether the
   panel moves by the item's own number or by something else.
3. **Equip a second hasted item with a different figure. Read again.** (This also settles
   `HASTE_STACKING`, which is the same capture doing double duty.)
4. **Have a haste song or spell put on you, keeping the worn items. Read a fourth time.**

**Stop and report at any step where the number does not move**, noting which step. A reading
that stops moving *is* the finding — that is where the ceiling is.

### What to send back

Four Attack Speed readings with the state beside each, and the item window of each hasted item
showing its haste line. Your level, because the cap is said to be level-scaled and a reading
without it cannot be placed on the curve.

### What each outcome means

| | Reading | What it means | What we do |
|---|---|---|---|
| **A. It keeps climbing** | Every step raises Attack Speed, song included | **No ceiling was reached at your level**, which bounds the cap from below rather than locating it. | Record the highest total reached as a floor. The mark stays — a cap we have not hit is still a cap we cannot draw. |
| **B. It stops** | One step adds nothing, later steps add nothing | **The ceiling is found at your level.** | The figure and your level become a Tier M point on the curve. One point is not a curve — the mark narrows rather than coming off. |
| **C. Worn stacks but song does not, or vice versa** | Step 3 moves, step 4 does not (or the reverse) | **The "different types stack" clause is wrong**, which is a separate finding from the cap and arguably a bigger one. | The clause is retired with evidence and the scorer's assumptions about song haste change. |
| **D. Only the largest worn item ever counts** | Step 3 adds nothing, and swapping to a larger item does move it | **`HASTE_STACKING` is confirmed** and stops being Tier 5. | That mark comes off. The cap question stays open. |
| **E. The capture failed** | Could not obtain two hasted items, or no caster to hand | Nothing is learned. | Say so. **Do not let this arrive as outcome B** — "I could not add more haste" and "more haste stopped helping" are the same sentence in English and opposite findings. |

**B and E are the pair to keep apart**, as in §1 and §2: a ceiling and a failure to test both end
with a number that did not move.

### What this does not settle

**The curve.** One character at one level gives one point. The source claims the cap scales with
level — ~50% below 30, ~75% at 50 — and a single reading cannot distinguish a scaling cap from a
flat one. Two characters at different levels would; so would one character measured before and
after levelling.

---

## Queued, not yet written up

- **Haste stacking and the haste cap.** `HASTE_STACKING` and `HASTE_PROVENANCE` in
  `web/src/engine/stats.ts` each already carry a `settle:` line naming the screenshot that
  would end them: an Attack Speed reading with two hasted items worn beside the same reading
  with one, and an item's haste line beside the Attack Speed reading on a character wearing
  nothing else hasted. Both are one screenshot each and neither has been written out to this
  file's standard yet.
