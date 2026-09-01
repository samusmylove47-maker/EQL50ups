# How long is a share URL, and does it still work in December?

Measured 1 Sep 2026 for the Tuesday relaunch, against the shipped catalogue and the repository's
own `/outputfile inventory` export (`tier0-inventory-Avenrae.txt`), using the codec that ships —
`web/src/share/codec.ts` at `SHARE_VERSION = 3`. Every figure below is encoded, not estimated, and
every case was round-tripped before its length was believed.

## The headline

**A fully-geared character — all 23 positions filled, every item at +10 — encodes to a 351-character
URL.**

```
  case                slots   payload (interned)   payload (names)   FULL URL
  real import          21            290                 1112          337
  all 23 @ +10         23            304                 1146          351
  worst-case names     23            242                 1154          289
  origin used: https://eqlsource.com/tools/50-upgrades  (39 of those characters)
```

Of the 304-byte payload, **gear is 268 and everything else — character, weights, set name — costs
36**. Name interning is a 3.8x lever: 304 against 1,146.

For scale, the app's own share dialog warns above 900 characters, on the grounds that some chat
clients wrap or truncate. **351 is comfortably inside that**, and the fragment is never transmitted.

## The version marker is already there, and it refuses rather than guesses

`SHARE_VERSION` is 3 and it is the first byte of the payload. A payload whose version byte is
replaced decodes to **`null`** — refused, not read hopefully.

## But the permanence question has a different answer, and it is the one that decides the design

The interned link is small because it stores an INDEX into a dictionary built from the shipped
catalogue's own name list. That list changes on patch day. Measured by encoding a link, then
decoding it against a dictionary built from a catalogue with two new items added:

```
  interned link, same dictionary        -> decodes
  interned link, PATCHED dictionary     -> REFUSED (null)
  interned link, no dictionary          -> REFUSED (null)
  name-carrying link, no dictionary     -> decodes
  name-carrying link, patched dictionary-> decodes, and names the same items
```

**Nothing ever mis-decodes.** The v3 checksum turns a dictionary shift into a refusal rather than
into somebody else's gear, which is the correct failure and worth keeping. But the consequence
stands: **a 351-character interned link posted in October is dead after the next patch, while a
1,185-character name-carrying link survives it and still names the same items.**

That is the "new code reading an old artifact" shape, live in the mechanism a permanent link would
be built on.

## Item IDs would solve both — and 91.6% of the catalogue does not have one

Item IDs are stable across patches where dictionary indices are not, so an ID-keyed payload would be
both small and permanent. **The catalogue cannot currently supply them.**

```
  items-index.json   3,663 rows   299 with a numeric id   3,364 null
  all shard files    4,004 rows   336 with a numeric id   ->  8.4% have one
  id range 1,069 .. 177,931  (18 bits)
```

**Corroborated by a different KIND of instrument, not merely a second file.** My first two counts
were the same instrument — `typeof id === "number"` over parsed JSON — run over two files, which
`R259` names exactly: *"corroboration requires a different kind of instrument, not a different
author."* Re-checked three more ways:

```
  my scan of items-index.json                          299
  the app's own itemIdIndex(), built by shipped code   299
  the pipeline's published meta.counts.withNumericId   299
  the UPSTREAM name->id table, items.v1.json           257 rows
```

**And the pipeline already publishes the reason, which is the part that decides whether "populate
the ids" is even a task:**

> `meta.provenance.itemIds.note` — *"Only 299 of 3663 items have a numeric id; they come from a
> live client export, not from any wiki source."*

**Item IDs cannot be scraped.** They exist only for items a player has actually held and exported.
The upstream table is 257 pairs; the ceiling on an ID-keyed wire format is therefore not a
data-cleanup task but a function of how many inventory dumps the project collects. The codec does
not read `id` at all today — it is name-keyed throughout.

**If every item carried an ID**, 23 slots at 5 bits of position + 18 of id + 4 of tier, plus a
version byte, packs to 79 bytes — **108 base64url characters, a 155-character URL**. That is a
calculation over a format that does not exist yet, not a measurement of shipped code, and it is
gated entirely on populating `id`.

## What this means for Tuesday

1. **A link is a viable mechanism today at 351 characters**, if it is accepted that a link stops
   working when the catalogue changes.
2. **If links must be permanent, they cannot be interned against the catalogue.** Either carry names
   in full at ~1,185 characters, or populate item IDs first and key on those.
3. Whichever is chosen, the failure mode is already right: it refuses rather than showing the wrong
   gear.
