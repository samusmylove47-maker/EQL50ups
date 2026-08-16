# Tier 0 Validation — live client vs. documented model

Source: in-game screenshots + `/outputfile inventory` (character Avenrae, Rivervale), 2026-08-16.
This is **Tier 0** evidence: the game itself. It supersedes all wiki/community sources.

## 1. The +N upgrade formula is CONFIRMED — 9 of 9 predictions exact

Damage rule under test: `dmg(N) = base + floor(base × N / 10)`; delay never scales.

### Whitened Treant Fists (base DMG 14, Delay 28)
| Level | Predicted DMG | Observed | Predicted ratio | Observed | |
|---|---|---|---|---|---|
| +0 | 14 | 14 | 0.500 | 0.5 | MATCH |
| +1 | 15 | 15 | 0.536 | 0.536 | MATCH |
| +2 | 16 | 16 | 0.571 | 0.571 | MATCH |
| +3 | 18 | 18 | 0.643 | 0.643 | MATCH |

**The apparent non-linearity (+1, +1, +2) is the floor function**, not evidence against the model.
`floor(14×1/10)=1`, `floor(14×2/10)=2`, `floor(14×3/10)=4`. Uneven steps are the predicted behavior.

### Earthshaker (base DMG 37, Delay 70) observed at +10
| Field | Predicted | Observed | |
|---|---|---|---|
| Base Dmg | 74 | 74 | MATCH |
| Delay | 70 (never scales) | 70 | MATCH |
| Ratio | 1.057 | 1.057 | MATCH |
| Dmg Bon | 50 (unchanged category) | 50 | MATCH |
| Strength (base 6, `≤10 → base+full`) | 16 | 16 | MATCH |
| Stamina (base 6) | 16 | 16 | MATCH |
| SV Void (synthetic, `= full`, ≥2 attrs) | 10 | 10 | MATCH |

The synthetic `SV Void` line — a rule that exists in no prose documentation and was recovered only
from the wiki's calculator source — appears exactly as predicted. That is strong evidence the whole
model is correct, not coincidence.

**Conclusion: +N scaling is fully computable from base stats. No per-level data collection is
required, ever. It ships as a core feature.**

## 2. Exaltation socket ladder CONFIRMED, with numeric slot IDs recovered

The inventory export numbers exaltation sub-slots. Whitened Treant Fists at +0/+1/+2/+3 shows
sub-slots appearing one per level:

| Item level | Sub-slots present | Unlocked | Type (per item window order) |
|---|---|---|---|
| +0 | Slot2 | — | Ornamentation |
| +1 | Slot2, Slot7 | Slot7 | Focus |
| +2 | + Slot8 | Slot8 | Click |
| +3 | + Slot9 | Slot9 | Worn |
| +4 | + Slot10 | Slot10 | Proc |

Corroborated by the Earthshaker +10 window listing exactly five rows in order: Ornamentation, Focus
Exaltation, Click Exaltation, Worn Exaltation, Proc Exaltation. Ornamentation uses Slot1 on some
item types and Slot2 on others.

**Sockets are derived from item level — confirmed. Nothing per-item to look up.**

## 3. Slot vocabulary CONFIRMED (21 worn positions)

`Any Slot ×2`, `Ear ×2`, `Wrist ×2`, `Fingers ×2`, and one each of Head, Face, Neck, Shoulders,
Arms, Back, Range, Hands, Primary, Secondary, Chest, Legs, Feet, Waist, Ammo.

**The two "Any Slot" positions are real and confirmed in a live inventory** (holding Nautilus
Shield +6 and Bladestopper +6).

## 4. The export format is machine-readable — import feature is viable

Tab-separated `Location / Name / ID / Count / Slots`. Names carry the `+N` suffix; exaltations appear
as `<Source Item> (Exaltation)` in numbered sub-slots; **numeric item IDs are present**, so joins to
the item catalog can key on ID rather than fuzzy name matching. A `KeyRing` section lists
Augmentation (exaltation) and Equipment collections.

This makes "paste your inventory, get your character" a realistic P1 feature.

---

# Round 2 — three more client screenshots (2026-08-16)

Cloak of Flames +7, Bone-Clasped Girdle +4, Bladestopper +6, plus the Loadouts tab.

## 5. The percentage branch TRUNCATES — a correction

Fourteen new data points. Thirteen agree under either rounding rule; exactly one
discriminates, and it overturns the model:

| Item | Stat | Base | +N | half-away-from-zero | truncate | **CLIENT** |
|---|---|---|---|---|---|---|
| Cloak of Flames | SV Fire | 15 | 7 | 26 | 25 | **25** |

`15 + 10.5` — the client floors it. `scalePrimary`'s percentage branch is
therefore `base + floor(base × effective / 10)`, identical in form to the weapon
damage rule.

This is the **second** arithmetic error inherited from the same third-party
model (the first being weight, which ceilinged floating-point residue up a
step). Its arithmetic is no longer trusted anywhere the client can speak.

All other new values confirm the existing model:

| Item | Stat | Base | +N | Predicted | Client |
|---|---|---|---|---|---|
| Cloak of Flames | AC | 10 | 7 | 17 | 17 |
| Cloak of Flames | HP | 50 | 7 | 85 | 85 |
| Cloak of Flames | AGI / DEX | 9 | 7 | 16 | 16 |
| Cloak of Flames | Haste (flat) | 36 | 7 | 43 | 43 |
| Cloak of Flames | SV Void | — | 7 | 7 | 7 |
| Bone-Clasped Girdle | AC | 4 | 4 | 8 | 8 |
| Bone-Clasped Girdle | HP / Mana | 75 | 4 | 105 | 105 |
| Bone-Clasped Girdle | STR / STA / DEX | 7 | 4 | 11 | 11 |
| Bladestopper | AC | 25 | 6 | 40 | 40 |
| Bladestopper | HP | 50 | 6 | 80 | 80 |
| Bladestopper | STA | 15 | 6 | 24 | 24 |

**`scaleFlat` is now confirmed** (Haste 36 → 43), and the `>10` branch is
confirmed on HP, Mana, AC and saves. Both were listed as unverified.

## 6. Characters have PER-CLASS LEVELS and MULTIPLE LOADOUTS

The Loadouts tab shows a model materially different from the one built:

- **Per-class levels are tracked independently.** The sampled character reads
  Bard 50, Berserker 50, Warrior 50, Monk 36, Druid 36, Shadow Knight 36,
  Paladin 21, Magician 11, and 10 for the rest. A character levels *every*
  class, not just the active trio.
- **A character stores several loadouts**, each a Race + Primary Class +
  two Secondary Classes, selectable from a numbered list. The sample holds
  three: Bard/(Shadow-Knight, Druid), Warrior/(Paladin, Berserker), and the
  active Bard/(Warrior, Berserker).
- `Loadout Swapping Available: No` appears as a gated state.

**Planner consequence:** a character is not one trio at one level. It is a set
of per-class levels plus a collection of named loadouts. Item level
requirements should be checked against the level of the *qualifying* class.

## 7. Exaltation display, and an unresolved socket count

The client names the donor item and the resulting effect separately:

```
Focus Exaltation: Lute of the Gypsy Princess (Exaltation)
Click Exaltation: Bladestopper (Exaltation)
3 empty slots
Focus Effect: String Resonance 11
Click Effect: Rune IV (Must Equip)
  Cast Time: Instant · Required Level: 40 · Cooldown: 600 seconds
```

This confirms **donors carry real effects onto the host**, and that a Bard
instrument modifier (`String Resonance 11`) transfers — the user's stated
requirement.

**Unresolved:** the "N empty slots" counts do not fit the assumed five-socket
ladder.

| Item | Level | Filled | "empty slots" | Implied total |
|---|---|---|---|---|
| Bone-Clasped Girdle | +4 | 1 | 3 | 4 |
| Bladestopper | +6 | 2 | 3 | 5 |
| Earthshaker | +10 | 0 | (lists 5 rows) | 5 |

A +4 item showing four sockets and a +6 showing five means either an extra
socket unlocks between +4 and +6, or Ornamentation is counted inconsistently,
or shields differ. **Do not model socket counts beyond "derive from tier" until
this is settled** — a screenshot of a +5 item, and of any +4 and +6 shield,
would resolve it.
