# Findings that live only in the code

Adopted per-repo on 2026-09-01 (Director R74, from Session D's practice). The
rule behind it, in D's words: a finding shipping only as a source comment has
not been reported — **and that is not a lapse, it is what happens when the code
is the only place a careful person writes things down.**

So this file exists to be the other place. It is not a changelog and not a
backlog. Everything here is something a reader of the product would never see,
that changes what somebody should do.

**How this list is kept honest:** every entry names the file and lines it lives
in, states what it would take to settle it, and says what it costs today. An
entry whose cost is zero and whose resolution is unknown still belongs here —
that is exactly the kind that goes quiet otherwise.

---

## 1. It is not established that this game gates *equipping* by level at all

**Lives in:** `web/src/engine/character.ts:270-296`, the `levelCheck` doc comment.

`levelCheck` refuses an item whose `rl` (required level) exceeds the character's
level. Three separate things sit under that, and none of them is an observation
of the game:

1. **The qualifying-class half is a planner inference.**
   `research/validation/TIER0-VALIDATION.md:131-133` says *"Planner consequence:
   … item level requirements **should** be checked against the level of the
   *qualifying* class."* "Should" and "consequence" — a design reading of a
   Loadouts screenshot, not a reading of an item window.

2. **The highest-of-the-qualifiers half is contradicted by our own research.**
   `research/eql-game-systems.md:279` records as *confirmed* that effective
   level is the **lowest** of the three class levels. It is about effective
   level rather than item requirements, so it is not decisive — but it points
   the other way and nobody has reconciled them.

3. **The strongest of the three, and the least discussed:** the only Tier M
   sighting of "Required Level" anywhere in this repository is on a **click
   effect** (`TIER0-VALIDATION.md:145`), not on wearing an item. **Nobody here
   has observed the game refusing to equip something on level grounds.**

Point 3 is what makes this different from the trio-level dispute the Director
has ruled on. That dispute asks *which* level an item is gated at. This asks
whether item equipping is level-gated **at all**, and no source in this tree
answers it.

**Cost today: three records.** Measured 2026-09-01, stating the file count per
R73 — **19 shard files opened**, 3,663 merged records, of which exactly **3**
carry `rl`:

```
Azarack Skin Wristwraps   rl 46
Baton of the Sky          rl 49
Refugee Shroud            rl 15
```

**What settles it:** one client capture of an item window showing a Required
Level on a *wearable* line, or a character below an item's level being refused
the equip. **What makes it urgent later rather than now:** a patch that
populates `rl` across the catalogue turns a dormant choice live on every list at
once, with no code change to notice.

**Why it is not simply fixed:** `levelCheck` is the conservative direction — it
refuses items rather than offering them — so the failure mode of being wrong is
a missing recommendation, not a bad one. Ruled by the Director (R71) to stay as
it is, documented, with the BIS gate taking the level as a caller-supplied input
instead of deriving it.

---

## 2. 35 mobs may be filed under two names, and nobody has established whether they are one mob

**Lives in:** `web/src/engine/bis.ts`, the `mobKey` doc comment, and now here.

Mob names are the key `=Lockouts` joins on — B owns *item → boss/zone*, D owns
*boss/zone → runnable this week*. Measured 2026-09-01, **19 shard files opened**,
over **2,315 distinct `src.m` strings**:

| | count | handled |
|---|---|---|
| differ from another **only by case** | **90** | **fixed** — `mobKeys` folds case |
| differ from another **only by a leading article** | **35** | **NOT fixed, and that is the finding** |

Case is safe to fold: EQ capitalises a leading article line-initially and not
mid-sentence, so the case records *where the name was written down*, not which
mob it is. Session C measured a board moving 72.2% → 86.8% on this class of
fault alone.

**The article is not safe to fold.** `"a goblin warrior"` and `"goblin warrior"`
are probably one creature — and "probably" is a claim about the game. Merging
them would be a mechanism claim, and every reversal this project logged on the
night of 31 August was a mechanism claim while not one measurement was
overturned. So they stay separate and this entry exists instead.

**Some are three-way:** `"a goblin warrior"` / `"A Goblin Warrior"` /
`"goblin warrior"`, `"The gnoll high shaman"` / `"a gnoll high shaman"` /
`"the gnoll high shaman"` — note that last one disagrees with itself about
*which* article, which is a hint the article is scraped punctuation rather than
part of the name.

**Cost today: a lookup that misses.** A consumer keying on `"goblin warrior"`
does not find items filed under `"a goblin warrior"`. It fails silently — an
upgrade the player could go and get produces no row, no badge and no reason.

**What settles it:** any source that lists a mob's canonical name — a client
target window, or the wiki's own mob page title — for two or three of the 35.
It does not need all of them; one example either way decides the rule.

---

## 3. How this file gets its next entry

The scan that produced entry 1: read every doc comment in `web/src/engine/` and
`pipeline/` that makes a claim about the *game* rather than about the code, and
ask whether that claim appears anywhere a non-developer would look — the
product, `HANDOFF.md`, or `research/`.

Most did. Tonight's engine comments — the weapon-blind profiles, the two-hander
netting, `UNCHANGED_KEYS`, the `removed from game` seam filter, the exaltation
stacking standing — are all reported in `HANDOFF.md` under the commit that
introduced them. **Entry 1 is the one that was not**, and it is the oldest.

This file is deliberately short. A list padded to look thorough is the same
failure as a count typed instead of computed.
