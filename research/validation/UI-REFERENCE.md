# UI Reference — sixtyupgrades target + EQ Legends authenticity source

Compiled from user-supplied screenshots, 2026-08-16. This is the visual and functional spec the
build must hit. Sixtyupgrades defines *structure and polish*; the EQL client defines *content and
vocabulary*.

---

## Part A — Sixtyupgrades (the bar to clear)

### A1. Gear set page — the money screen

**Header row.** Circular character portrait · character name (large, light weight) · sub-line
`70 Night Elf Priest` in grey. Vertical rule. Then the *set* identity: circular glowing set icon ·
set name · phase label in **amber/gold** · chevron for a set switcher dropdown.

**Tab row.** `GEAR · TALENTS · BUFFS` — active tab marked by a **blue underline**, inactive in grey.
Right-aligned on the same row: `🔗 Share`, `🏳 Auto-fill`, `⚙ Edit`, `⋯` overflow. Text+icon, not
buttons — quiet until needed.

**Paper doll.** Two item columns flanking a centered 3D model.
- Left column: icon on the outer left, text block right of it, left-aligned.
- Right column: mirrored — text right-aligned, icon on the outer right.
- Line 1 = item name in **quality color** (purple epic, blue rare).
- Line 2 = **the enchant, in green**; `No Enchant` in grey when absent. This subtitle line is an
  *enchant slot*, not a stat summary.
- Gem sockets render as small colored squares overlaid on the item icon's lower edge.
- Empty slots show a dim placeholder icon plus the slot name only (`Shirt`, `Tabard`).

### A2. Talents tab
Three spec trees as side-by-side cards, each with a header (spec icon, point count, name, `✕` clear)
and faded spec-themed background art. Talent icons in a grid with `0/5` counters and prerequisite
arrows. `Points left: 61` bottom-left; `Copy to Set` · `Share` · `Reset` bottom-right.

### A3. Buffs tab
Sections `SELF` / `RAID` / `SCROLLS` / `BATTLE ELIXIR` · `GUARDIAN ELIXIR` · `POTION`.
Each entry is a checkbox + small icon + name + rank in grey. RAID is a three-column grid. The elixir
and potion groups are `Choose an item` pickers rather than checkboxes.

### A4. Create Gear Set
`BASIC DETAILS` (Name · Talent Specialization · Phase) → `EQUIVALENCY POINTS` with a `?` helper and a
dashed `+ Add Point` affordance → `DEFAULT FILTERS` as a 2-column dropdown grid (Source, Raids, Armor
Type, Main Hand Type, Off Hand Type, Ranged Type, Profession Req.) → `Create` (disabled until valid).

**Design lesson:** stat weights and filters are configured at *set creation*, making every set carry
its own scoring lens. Mirror this.

### A5. Create Character
Faction columns with crested headers, gender toggle, race portraits as circular icons with a
**glowing blue ring** on the active choice, centered model preview, class row along the bottom with
unavailable classes **dimmed**. Second step: Name · Level · Realm, appearance steppers
(`◀ 4 / 9 ▶`, values in blue), `Randomize`, and `Back` / `Create`.

### A6. Visual language
Near-black grounds (roughly `#0d0d0d` page, `#1a1a1a` panels). One bright azure accent for primary
buttons, active tabs, and selection rings. Amber for phase/era labels. Uppercase condensed bold page
titles; small letter-spaced grey section labels. Pill buttons — outlined for secondary, filled for
primary. Thin vertical rules between stat columns.

### A7. Defects to avoid
Their empty-state stat panel renders `Total Avoidance  NaN%`. Zero-state must be numerically clean.

---

## Part B — EQ Legends client (the authenticity source)

### B1. Corrections to earlier research

**Heroic Mods exist.** Earlier research concluded "no heroic stats" from their absence in the item
corpus. The *item* finding stands — every value reads 0 even on a fully-geared character — but the
**stat categories are real and displayed with caps**. The planner must show them, at zero, to match
the client.

**Stat caps are displayed natively.** Attributes read `304/510`; resists read `94/1000`. This is a
gift: sixtyupgrades users complain it has no cap awareness, while EQL *shows caps in the client*, so
rendering `value / cap` is simultaneously authentic and a feature they lack.

**Void is a real sixth resist** (`SV Void 126/1000`), confirming the synthetic `SV Void: +N` granted
by item upgrades feeds a genuine resist line.

### B2. Character header format
`Avenrae` · `50 BRD/WAR/BER` · `Bristlebane`

Level, then the **three classes as slash-joined 3-letter codes**, then deity. This is the canonical
multiclass display and our header should copy it exactly.

### B3. The in-game Stats window — mirror this structure

| Group | Fields |
|---|---|
| **Vitals** | HP, Mana, Endurance, AC (`505/459 \| 493`), Attack (`422/577`), Attack Speed %, Velocity |
| **Regen** | Combat HP Regen, Combat Mana Regen, Combat End Regen |
| **Stats** | STR, STA, INT, WIS, AGI, DEX, CHA — each `value/510 +overcap` |
| **Resists** | Magic, Fire, Cold, Disease, Poison, **Void** — each `value/1000` |
| **Heroic Mods** | Accuracy `/150`, Avoidance `/100`, Combat Effects `/100`, Damage Shielding `/35`, Damage Shield Mitig `/25`, DoT Shielding `/35`, Melee Shielding `/35`, Spell Shielding `/35`, Strike Through `/35`, Stun Resist `/35` |
| **Spell Mods** | Heal Amount, Spell Damage, Clairvoyance, Luck |
| **Skill Damage Mod** | Bash `/100`, Backstab `/125`, Dragon Punch `/100`, Eagle Strike `/100`, Flying Kick `/100`, Frenzy `/125`, Kick `/100`, Round Kick `/100`, Tiger Claw `/100` |

Skill Damage Mod entries are clearly class-conditional (the sample is a Monk-skill set on a
BRD/WAR/BER character, so the list is likely universal rather than filtered).

### B4. Inventory window
Also carries: currency (Platinum/Gold/Silver/Copper), `Overall Weight 70/304`, `Equipped Weight 55`,
`Next Level %`, `Next AA %`, Bind and Origin locations, and an equipment grid laid out as icon slots.

**Weight matters** — the upgrade formula reduces item weight on a log2 curve, and the client tracks
an encumbrance total, so the planner should surface equipped weight.

### B5. Client visual language (for tooltip/item-window fidelity)
Dark stone-grey panels with beveled borders, small pixel-ish sans type, **green** for numeric values,
cyan/blue for group headers, red for destructive actions, gold for currency. Item windows use a red
gradient title bar with the item name in white. Our item tooltip should evoke this rather than WoW's.
