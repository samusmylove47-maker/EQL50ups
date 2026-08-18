# EQL Upgrades

A gear planner for **EverQuest Legends**, built to the standard set by
[sixtyupgrades.com](https://sixtyupgrades.com/tbc).

Plan a set slot by slot, rank every candidate by your own stat weights, model the
`+0…+10` upgrade curve, and share the result as a link. No account, no server:
your characters live in your browser and travel as URLs.

---

## Live site

Published from `web/` by `.github/workflows/deploy.yml` on every push:

**https://samusmylove47-maker.github.io/EQL50ups/**

If that 404s, Pages has not been switched on yet — see *Enabling Pages* below.

---

## What it does

**Three classes at once.** A character is a full sixteen-class level map plus a
list of named loadouts, matching the client's own Loadouts tab. An item is usable
if any of your three classes qualifies, armour proficiency takes the best of the
three, and a level requirement is checked against the level of the class that
actually qualifies you — your Bard 50 does not pay for a Warrior-only item.

**Every item at every upgrade level.** The `+0…+10` curve is computed from base
stats, so no item data has to be collected per level. The rules were re-derived
and then validated against live-client screenshots; see *Accuracy* below.

**Twenty-three slots**, including the two EQL-specific Any Slots.

**Cap-aware scoring.** Rank items by a weight profile you control. Points that
would exceed a ceiling score nothing, so an item cannot win a slot by piling on a
stat you have already maxed. *(See the honest caveat in* Known limits *— gear
alone does not reach the ceilings.)*

**Import your real character.** Paste the output of `/outputfile inventory` and
it fills all 23 slots at their real tiers, with exaltation donors, and tells you
exactly what it could not match. Bags, bank and keyring are read and reported but
never equipped.

**Compare two sets** side by side, with a centre column showing how much of each
gain is actually creditable against the caps.

**A ranked upgrade list** at `#/upgrades`: the best item this loadout can wear in
every position, what it gains, what it quietly gives up, and where to go and get
it. Positions whose worn item cannot be scored are listed separately rather than
compared against a zero nobody measured.

**Every number says where it came from.** Each row carries its standing under
`research/SOURCING-STANDARD.md` — read off a live client, structured wiki data,
or wiki numbers no era can place — and `#/sources` sets out the whole hierarchy,
what ships, what is withheld and why, and what is known to be uncertain.

**Share a set** as a ~300-character link that reconstructs it exactly. Links
carry a checksum, so a mistyped one is refused rather than silently decoding into
a different plan.

---

## Accuracy

The upgrade maths is not inferred from community documentation — it is checked
against screenshots of the running game, recorded in
`research/validation/TIER0-VALIDATION.md`:

| Item | Level | Predicted | Client |
|---|---|---|---|
| Whitened Treant Fists | +0…+3 | 14 / 15 / 16 / 18 dmg | matches |
| Earthshaker | +10 | 74 dmg, ratio 1.057, STR/STA 16, SV Void 10, wt 1.6 | matches |
| Cloak of Flames | +7 | AC 17, HP 85, AGI/DEX 16, SV Fire 25, Haste 43% | matches |
| Bone-Clasped Girdle | +4 | AC 8, HP/Mana 105, STR/STA/DEX 11 | matches |
| Bladestopper | +6 | AC 40, HP 80, STA 24 | matches |

Two rules from the community model were **wrong** and were corrected against the
client: weight rounding, and the percentage branch, which truncates rather than
rounding half away from zero. Where the game and a third-party source disagree,
the game wins.

---

## Known limits

Stated plainly, because a planner that hides its gaps is worse than one that
does not:

- **Gear only.** Race and class base attributes are not modelled — no verified
  source for them exists. Totals are the gear contribution, which is why they do
  not match your client's Stats window, and why the stat caps are effectively
  out of reach from gear alone.
- **Item flags are unreliable.** The catalog still uses classic EverQuest's
  `NO DROP` where the client says `No Trade`, conflates Lore with Lore-Equipped,
  and barely records Placeable. Do not trust a flag filter for a loot decision.
- **Eight items in a sampled inventory exist in no wiki catalog** at all. The
  importer names them rather than guessing.
- **Some items are known to exist with no stats at all.** The Berserker planar
  set Shadow Rage is one: the player told us what it is, three of its six pieces
  are in no wiki catalog, and nothing anywhere records their numbers. They ship
  as real catalog entries flagged `statsUnknown` — never ranked, never scored,
  never auto-filled, and never shown as a row of zeroes beside items whose zeroes
  were actually measured. Inventing the numbers was rejected.
- **The wiki's Fear/Hate revamp coverage is incomplete for most classes.** It has
  full planar sets for Warrior, Shadow Knight, Paladin, Ranger and Druid, and
  scattered single pieces or nothing for the other eleven. That is a gap in the
  catalog, not proof the gear does not exist — see
  `research/validation/TIER0-PLAYER-REPORTS.md`.
- **Some quarantined content may be obtainable.** The catalog ships only
  pre-Kunark content plus what a live client export proves, because the wiki it
  is built from is partly a Project 1999 import and carries the whole
  original-EverQuest corpus. EQL's own list of Kunark and Velious items released
  early was never recovered upstream, so items the live inventory names ship by
  name — thirteen Kunark items do — and the remaining 7,719 records are
  quarantined out of the build rather than shipped and hidden. Some of those are
  probably in the game. They come back the moment a Tier 0 or Tier 1 source says
  so; they are named in `pipeline/quarantine.json` for exactly that.
- **Exaltation effects are listed, not scored.** The catalog publishes names and
  prose, no numbers. Inventing values was rejected.
- **Heroic, Spell and Skill-damage mods read 0** — the live client shows the same
  on a fully geared character, because no item grants them yet.

---

## Data

3,533 items, ~290 KiB gzipped, built by `pipeline/build.mjs` from community
wiki scrapes pinned to specific commits, plus a small, fully enumerated set of
Tier 0 corrections where the running game contradicts the wiki. Coverage against
a real inventory export: **97.3%**.

The raw scrape holds 11,252 items. 7,719 of them are content from expansions
this game does not have, or carry no era at all, and are quarantined into
`pipeline/quarantine.json` rather than shipped — see `research/SOURCING-STANDARD.md`.
What ships is pre-Kunark content, plus every item the player's own client export
proves, plus the player-confirmed Shadow Rage set. Era-less is treated as
unconfirmed, not presumed classic.

Item data derives from the **EverQuest Legends Wiki**, used under **CC BY-SA
4.0**; derived data is shared alike. EverQuest is a trademark of Daybreak Game
Company LLC. This project is unaffiliated with Daybreak or Game Jawn.

---

## Working on it

```bash
cd web
npm install
npm run dev          # local dev server
npm run build        # production build
npx vitest run       # 621 unit tests
npx playwright test  # browser tests — see BROWSER-TESTING.md first
```

Rebuild the item data after changing the pipeline:

```bash
node pipeline/build.mjs && node pipeline/verify.mjs
```

`web/BROWSER-TESTING.md` documents the pre-installed Chromium and the standing
checks every screen must pass.

### Enabling Pages

Repository **Settings → Pages → Build and deployment → Source: GitHub Actions**.
The workflow gates on typecheck and the full unit suite, so a red build never
reaches the URL.
