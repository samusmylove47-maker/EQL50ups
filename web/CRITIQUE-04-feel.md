# CRITIQUE-04 — Interaction feel, performance, robustness, accessibility

> **Historical record — figures predate the 2026-08-17 era purge.** The catalog described here
> shipped 11,249–11,252 items with out-of-era content hidden behind a "Live content only"
> toggle. It now ships 3,533; 7,719 records are quarantined in `pipeline/quarantine.json`, and
> the toggle has been removed because it could no longer change a single row. Every count below
> was correct when measured and is not current. See `research/SOURCING-STANDARD.md`.

Adversarial review against sixtyupgrades.com, held to a 9/10 bar.
Method: production build served on `127.0.0.1:4271`, real Chromium
(`/opt/pw-browsers/chromium-1194`), every latency measured from the capture-phase
input event to the second stable animation frame after settle, with
`PerformanceObserver('longtask')` and `layout-shift` armed **before** each
interaction and CDP `Emulation.setCPUThrottlingRate: 4` applied first. Every
toggle is reported on its **first press in each direction**, never the warm
return trip.

---

## Score: **7.8 / 10**

**The planner itself is at the bar — a 1,729-candidate Any Slot picker opens in
215 ms cold and 117 ms warm at 4× throttle with zero measurable layout shift, and
I could not make it throw across 20 corrupt-storage shapes, 12 malformed share
links, 16 junk imports, 23 slot pickers and 24 rapid history steps — but the item
browser blocks the main thread 255–348 ms on *every* column sort for want of one
memo split, two dialogs drop focus to `<body>` when they close, and a single
unconfirmed click on "Clear all" silently turns off ranking across the whole set
with nothing on screen to say so.**

| Sub-score | | |
|---|---|---|
| Interaction feel | **8.0** | Picker is genuinely excellent. Docked for inert `Home`/`End`, an ambiguous `RESET`, a jump-to-page field that fights you, and a pager that vanishes. |
| Performance | **7.5** | Planner surfaces are outstanding. One whole top-nav screen — the item browser — misses the standard the rest of the app sets, by a wide margin, for an avoidable reason. |
| Robustness | **8.0** | Very hard to break. Docked for a 1.9× horizontal overflow from a 40-character name, two banners that misdiagnose the failure, and ~7 % of one-character share-link corruptions decoding silently to a *different* plan. |
| Accessibility | **7.5** | Set editor is best-in-class (88 tab stops, every one correctly named). Docked for two focus-restore failures, 100 tab stops per item-browser page, 92 buttons named only "ADD", and no live region for any async result count. |

---

## Prioritised findings

### P0 — Item browser: every column sort re-scores all 5,861 candidates

`src/screens/ItemBrowser.tsx:100–128`. One `useMemo` does both the scoring loop
and the sort, and `sort`/`dir` are in its dependency array:

```ts
const { rows, total } = useMemo(() => {
  const scored = [];
  for (const item of catalog.items) {
    …
    scored.push({ item, score: scoreItem(item, upgrade, weights).total });   // 5,861 × scoreItem
  }
  scored.sort(…);
  return { rows: scored, total: scored.length };
}, [catalog.items, matches, slot, era, liveOnly, filterContext, weights, upgrade, sort, dir]);
//                                                                          ^^^^^^^^^^^ ← re-scores
```

Measured at 4× throttle, *first press on each column*:

| | latency | longest blocking task |
|---|---|---|
| EP → Item name | 412 ms | **348 ms** |
| Item asc → desc | 340 ms | 268 ms |
| → Slot | 325 ms | 255 ms |
| → Era | 333 ms | 261 ms |
| → EP (back) | 323 ms | 262 ms |
| EP desc → asc (second press, "warm") | 344 ms | 283 ms |

There is no warm case: the second press costs the same as the first, because
nothing is cached across a sort. Unthrottled it is still a 53–90 ms block on
every header click. Neither `sort` nor `dir` is deferred, so the click is a hard
freeze, not a transition.

The picker next door already does this correctly — it ranks once and filters the
sorted array — and its own header comment explains why. This screen didn't get
the same treatment.

**Fix.** Split the memo in two:

```ts
const scored = useMemo(() => { /* filter + scoreItem loop */ },
  [catalog.items, matches, slot, era, liveOnly, filterContext, weights, upgrade]);
const rows = useMemo(() => [...scored].sort(cmp(sort, dir)), [scored, sort, dir]);
```

Sorting 5,861 pre-scored objects is single-digit milliseconds. Optionally wrap
`sortBy` in `startTransition` so even that never blocks the header.

---

### P1 — Item browser page turns block 127–196 ms, and the first paint blocks 502 ms

| | latency | longest task |
|---|---|---|
| First paint after navigating to `/#/items` (cold) | **715 ms** | **502 ms** |
| Page 1 → 2 (Next, first press) | 174 ms | 127 ms |
| Page 2 → 3 | 259 ms | 188 ms |
| Page 3 → 2 (Previous, first press) | 226 ms | 145 ms |

The comment at the top of the file says "a page is a `slice`, so it costs one
array copy" — the slice is indeed memoised, but *rendering* the 100 rows is not
cheap: each row builds an inline `SlotGlyph` SVG, a `statVector` join, `itemHoverProps`
and `itemNameColor`. 100 of those is a 150 ms commit at 4× throttle.

Cold load is also the heaviest in the app: `ensureAll()` on mount pulls **21 JSON
files / 6.1 MB** (the planner needs 2 files / 1.95 MB) and spends **1,142 ms** in
long tasks at 4× before the screen settles.

**Fix.** Memoise the row subtree (`React.memo` on a `<Row>` component keyed by
item+upgrade+weights), and/or drop `PAGE_SIZE` to 50 with a size control. For the
cold load, render page 1 from `items-index.json` and let `ensureAll()` upgrade the
scores in a transition rather than gating first paint on 6.1 MB.

---

### P1 — Two dialogs drop focus to `<body>` when they close

`Modal` captures the restore target in an effect:

```ts
// src/components/Modal.tsx:50
useEffect(() => {
  restoreRef.current = document.activeElement;   // ← too late
```

React applies `autoFocus` during **commit**, before effects run. Any dialog whose
body uses `autoFocus` therefore stores *its own input* as the restore target;
that node is unmounted on close, `document.body.contains(restore)` is false, and
focus falls to `<body>`. The file's own comment notices this ordering for the
focus-*in* path and misses it for the focus-*out* path.

Affected: `SetConfigDialog.tsx:221` (⚙ Edit) and `ExaltationsTab.tsx:364`
(exaltation donor picker). Reproduced on all three exits.

```
Share : opener="🔗 SHARE" onOpen="Share this set"  escapes=0  restored="🔗 SHARE"    OK
Edit  : opener="⚙ EDIT"   onOpen="Set name"(INPUT) escapes=0  restored="(body)"      FAIL
  closed via Escape → focus = BODY
  closed via Cancel → focus = BODY
  closed via Save   → focus = BODY
```

The opener button is verifiably still in the DOM after close (I tagged the node
and checked `document.body.contains`), so this is purely the wrong node being
captured.

**Fix.** Capture during render, before commit-time autofocus:

```ts
const restoreRef = useRef<Element | null>(null);
if (restoreRef.current === null) restoreRef.current = document.activeElement;
```

Everything else about the trap is correct — 0 escapes in 40 Tab presses, Escape
closes, backdrop closes, and the picker and Share dialogs restore perfectly.

---

### P1 — One click on "Clear all" silently switches ranking off, everywhere, with no warning

Weights tab → **CLEAR ALL**. No confirmation. `weights` becomes `{}`. Consequences,
all silent:

- every picker in the set ranks alphabetically — the top five of an Any Slot are
  `A Broom`, `A Crude Stein`, `A fungus eye`, `A Ghoul's Heart`, `A Gypsy Medallion`;
- every row reads `0.0 EP`, and the picker's own note still claims
  *"Ranked by EP against this set's weights, cap-aware"*;
- the doll reads `0 EP`;
- Auto-fill places **nothing** and blames the user after the fact:
  *"Auto-fill placed nothing — check that item data is loaded and your weights are
  not all zero."*

Nothing on the Weights tab, in the picker, or on the doll says the set has no
scoring lens. The same degenerate state is reachable from persistence:
`sanitizeSet` (`persistence.ts:241`) accepts `weights: {}` verbatim with no
fallback to `DEFAULT_WEIGHTS`, so any hand-edited, truncated or third-party
payload lands here too. I hit it accidentally on my first seeded set and spent a
measurement pass ranking a shovel fifth-best before noticing.

**Fix.** (a) Warn where it is true — a persistent `role="status"` strip on the
Weights tab and a replacement for the picker's "Ranked by EP…" note when
`Object.keys(weights).length === 0`. (b) Disable Auto-fill with a title
explaining why, instead of running it and reporting failure. (c) Have
`sanitizeSet` fall back to the balanced profile when the weights map ends up
empty.

---

### P2 — The item browser costs 100 Tab presses per page, with no way past

Full tab-order walk of `/#/items`: **115 stops before wrapping** — 14 chrome, then
100 `<tr tabIndex={0}>` rows, then the bottom pager and footer. Walking the whole
catalog is ~5,900 Tab presses.

`ItemBrowser.tsx:394` reasons carefully about *not* adding a second stop per row
(200 → 100). But 100 is still the problem, and the picker's own comment states
the standard: *"As plain tab stops these rows cost 157 Tab presses to reach
Cancel"* — which is why the picker is a single-stop listbox with
`aria-activedescendant`. The two screens disagree about the same question.

Secondary: a focusable `<tr>` keeps `role="row"`; assistive tech announces a row,
not something Enter activates.

**Fix.** `role="grid"` with a roving tabindex (one stop, arrow keys move rows) —
the paper doll in this same app already does exactly this and does it well. Or,
minimally, a "Skip to page controls" link before the table.

---

### P2 — 92 buttons whose entire accessible name is "ADD"

`ExaltationsTab.tsx:276`. Each socket row renders:

```tsx
<button type="button" className="btn btn-sm" onClick={…}>
  {socket.donorName ? 'Change' : 'Add'}      // no aria-label
</button>
```

Four sockets × 23 items = up to 92 buttons named `Add`/`Change`, with the socket
label and the item name in sibling spans that are not associated with the button.
The **✕ remove** button three lines below has a perfectly good
`aria-label={\`Remove ${socket.socket.label} from ${entry.item.n}\`}` — the pattern
exists in the same JSX and just wasn't applied to the primary action.

**Fix.** `aria-label={\`${socket.donorName ? 'Change' : 'Add'} ${socket.socket.label} donor for ${entry.item.n}\`}`.

---

### P2 — Storage failures are diagnosed as "your browser is not allowing local storage"

`App.tsx:29` maps `storageStatus` to copy with an `else` that swallows two
distinct failures:

**Quota.** Filled localStorage to the byte (9 × 512 KB + 509 × 1 KB + 124 × 1 B),
then equipped an item:

```
equipped in UI: Indicolite Helm | filled slots: 1
notice: "This browser is not allowing local storage, so nothing will be
         remembered after you close the tab…"
stored slots: 0
AFTER RELOAD filled: 0            ← the edit is gone
```

The loss *is* announced (good), but with the wrong cause and no actionable
remedy. `persistence.ts` already carries the right copy — *"Your browser storage
is full… Export your sets to JSON, then remove some saved data"* — and it never
fires, most likely because `defaultStorage()` write-probes with
`storage.setItem(probe,'1')` on every call; at quota the probe throws, the
function returns `null`, and `saveState` short-circuits to `'unavailable'` before
`isQuotaError` is ever consulted.

**Future schema version.** A payload with `version: 9999` is handled *correctly*
by the engine — it is quarantined to `eqlups.state.v1.future` (verified present
and byte-intact after a subsequent edit) and the current build refuses to
sanitise it. But `LoadStatus` has a `'future'` member that `StorageWarning`
doesn't handle, so the user is told:

> "This browser is not allowing local storage, so nothing will be remembered
> after you close the tab."

which is false, and hides the one fact that matters: *your library is safe, it
was written by a newer version, reload once the new build is live.* For an app
whose own test doc says "losing a saved library is the most expensive bug this
app can ship", telling the user their browser is broken when their library is
actually intact is the wrong end of that.

**Fix.** Give `'future'` and `'quota'` their own branches in `StorageWarning`;
have `defaultStorage()` distinguish "storage absent" from "storage present but
full" (catch the probe error and check `isQuotaError` before returning `null`).

---

### P2 — A 40-character unbroken name blows the character page sideways

`/#/character/:id` only. `.page-title` has no `min-width: 0`, no
`overflow-wrap`, no truncation, and the "Open ‹set name›" primary CTA carries the
full set name and does not wrap.

| name length (single unbroken token) | 1600 px | 768 px | 390 px |
|---|---|---|---|
| 20 | ok | ok | ok |
| 40 | ok | 1100 > 768 | **730 > 390 (1.9×)** |
| 60 | 1738 > 1600 | 1638 > 768 | 1088 > 390 |
| 120 | 3353 > 1600 | 3253 > 768 | 2165 > 390 |
| 500 | 13578 > 1600 | 13478 > 768 | **8981 > 390 (23×)** |

With spaces the title wraps, but a 499-character *set* name pushes the CTA to
**4,449 px** at all three widths. `BROWSER-TESTING.md` states "No horizontal page
scroll at 1280, 1024 and 768 px wide" — this violates it. Every other screen
handles the same names correctly (the characters list and the shared-set screen
were both explicitly fixed for this; the character detail page was missed).

**Fix.** `min-width: 0; overflow-wrap: anywhere` on `.page-title`, and clamp the
CTA label with `text-overflow: ellipsis` plus a `title` attribute.

---

### P2 — ~7 % of one-character share-link corruptions decode into a *different* plan

I built a real 23-item share link (291 chars), then flipped one character at 30
evenly spaced positions:

```
rejected with an honest error page      : 12
console / page errors                   : 0
SILENTLY DECODED TO A DIFFERENT PLAN    : 2
  pos 117 'A'→'H' : Head slot silently emptied
  pos 126 'M'→'T' : Face slot silently emptied
```

There is no integrity check on the payload. For a product whose landing page says
"**The URL is the product**", a link that a chat client mangled by one character
can hand the reader a plan the author never built, with nothing to indicate it.
The 12 clean rejections show the error page is well written — it just isn't
reached often enough.

**Fix.** Append a 2-byte FNV-1a (or CRC-16) of the encoded body; on mismatch
route to the existing "could not be read" page. Costs ~3 base64 characters.

---

### P3 — `Home` and `End` in the picker are inert from the only place focus can be

`ItemPicker.tsx:385–394` scopes `Home`/`End` away from text fields so the caret
keeps them — reasonable in isolation. But the picker auto-focuses the search box
on open, the listbox is `tabIndex={-1}`, and every row is `tabIndex={-1}`, so
there is **nowhere else keyboard focus can go**. Verified: plain `End` from the
search box leaves `scrollTop: 0` and `activeId: picker-option-0` on a
1,729-row list; `Ctrl+End` correctly jumps to `picker-option-1728` at
`scrollTop: 127220`. Nothing in the UI mentions Ctrl. The file's own comment
claims "every candidate is reachable by scrolling or by End".

**Fix.** Let bare `Home`/`End` jump the list when the search field is empty (the
caret has nowhere to go anyway), or surface the Ctrl modifier in the picker's
hint line.

---

### P3 — "RESET" in the item-browser toolbar does not reset the filters

`ItemBrowser.tsx:322`. In a toolbar reading
`Search … | Any slot | Any class | Any era | Melee DPS weights | Preview at − +0 + | RESET | ☑ Live content only`,
a button whose entire accessible name is `RESET` resets **only the preview
tier**. Every neighbour is a filter. High-consequence misread, zero cost to fix:
`aria-label="Reset scoring preview to +0"`, and visually either move it inside the
stepper group or label it `+0`.

---

### P3 — Jump-to-page cannot be cleared, and the pager disappears below 101 results

`ItemBrowser.tsx:197–205`. `value={safePage + 1}` is fully controlled and
`onChange` navigates on every keystroke, so Backspace is inert and the caret is
restored to the end:

```
after Backspace (clear) : value="1"   Page 1 of 59     ← nothing happened
then type "5"           : value="15"  Page 15 of 59    ← wanted page 5
```

Select-all-and-type works (`Ctrl+A`, `23` → page 23), so it is not fatal, but the
obvious clear-then-type gesture lands you somewhere else. Typing `abc` yields
page 1 with no `NaN` — that part is handled.

Separately, `pageNav` renders only when `pageCount > 1`, so narrowing to ≤100
results removes both pagers — including the page readout — and shifts the whole
table up. I recorded **CLS 0.0820** on one slot-filter change during the
throttled run.

**Fix.** Buffer the field in local state and commit on blur/Enter; keep the pager
mounted (disabled) so the layout doesn't jump.

---

### P3 — No live region for any async result count

`grep` finds `role="status"` in eight components — but not in `ItemPicker` or
`ItemBrowser`, the two screens where a number changes asynchronously under the
user's fingers. Typing `crown` takes the picker from `1,729 matches` to
`9 matches` and a screen-reader user is told nothing; `Loading item data…` and the
`No matching items` empty state are equally silent. The combobox's
`aria-activedescendant` covers the *highlighted option*, not the count or the
empty state.

**Fix.** `aria-live="polite"` on the `.picker-meta` count span and the browser's
match count. The `<caption>` on the browser's table is already excellent — this is
the same idea applied to the number that changes.

---

### P3 — PageDown ×10 costs 702 ms

Ten consecutive `PageDown` presses in a 1,729-row Any Slot list: 702 ms total,
~70 ms per press, one 71 ms long task. Each press does a full `moveActive` →
`resolveActive` → re-render → `scrollToIndex` cycle at normal priority. Not a
freeze, but held-key paging visibly lags the key repeat rate.

**Fix.** Coalesce repeated arrow/page keys within a frame before committing the
new active index.

---

### P4 — Picker footer overlaps the last row at 390 px

At 390 px the modal footer bar carrying **CANCEL** sits over the bottom of the
scrolling result list (`shots/A-390-picker.png`: "Bone-Clasped Girdle" is
half-covered). The list is still scrollable so nothing is unreachable, but the
row under the button reads as clipped rather than as "scroll for more". Give
`.results` bottom padding equal to the footer height, or an opaque footer
background.

---

## Full latency table

All figures at **4× CPU throttle** unless marked. First press in each direction.
Measurement floor (no-op click, two idle settle frames) = **60 ms** — subtract
that mentally from every row. `longtask` columns are approximate: the
`PerformanceObserver` sometimes delivers an entry from the previous interaction
into the following window.

### Picker — open

| Interaction | Latency | Longest task | CLS |
|---|---|---|---|
| Head, **cold** (shard fetch) | 350 ms | 166 ms | 0.0000 |
| Head, warm | 104 ms | — | 0.0000 |
| Primary, cold (416 candidates) | 373 ms | 184 ms | 0.0000 |
| **Any Slot, truly cold** (first picker opened, 1,729) | **215 ms** | 185 ms | 0.0000 |
| Any Slot, cold with other shards warm | 197 ms | 150 ms | 0.0000 |
| Any Slot, warm | **117 ms** | 94 ms | 0.0000 |
| Any Slot, cold, **unthrottled** | 128 ms | 114 ms | 0.0000 |
| Any Slot, warm, **unthrottled** | **28 ms** | — | 0.0000 |
| All 23 slots, cold, wall-clock range | 256–373 ms | — | — |

### Picker — search (Any Slot, 1,729 rows)

| Keystroke | Latency | Result set |
|---|---|---|
| 1 — `c` | 74 ms | 1,729 → 845 |
| 2 — `cr` | 106 ms | → 51 |
| 3 — `cro` | 136 ms | → 13 |
| 4 — `crow` | 116 ms | → 9 |
| 5 — `crown` | 75 ms | → 9 |

### Picker — filters (first press each direction)

| Interaction | Latency | Result set |
|---|---|---|
| Live content only ON → OFF | 58 ms | 1,729 → 4,530 |
| Live content only OFF → ON | 95 ms | → 1,729 |
| Live content only ON → OFF (2nd, warm) | 108 ms | — |
| Live content only OFF → ON (2nd, warm) | 87 ms | — |
| Hide No Drop OFF → ON | 90 ms | → 1,518 |
| Hide No Drop ON → OFF | 66 ms | → 1,729 |
| Era any → Classic | 86 ms | → 1,339 |
| Era Classic → any | 104 ms | → 1,729 |
| Source any → Drops | 78 ms | → 875 |
| Source Drops → any | 98 ms | → 1,729 |

No long task, and CLS **0.0000**, on every one.

### Picker — preview stepper (re-ranks 1,729) and keyboard

| Interaction | Latency |
|---|---|
| Preview +0 → +1 (1st) | 80 ms |
| Preview +1 → +2 | 77 ms |
| Preview +2 → +1 (down, 1st) | 59 ms |
| Preview `End` → +10 | 91 ms |
| Preview `Home` → +0 | 57 ms |
| ArrowDown ×1 | 74 ms |
| PageDown ×1 | 71 ms |
| **PageDown ×10 (spam)** | **702 ms** (~70 ms each) |
| `Ctrl+End` → row 1,729 | ~90 ms |
| plain `End` | **inert** (see P3) |

### Set editor

| Interaction | Latency | Longest task |
|---|---|---|
| Equip by click | 60 ms | — |
| Equip by Enter | 45 ms | — |
| Doll +N: +0 → +1 (1st) | 42 ms | — |
| Doll +N: +1 → +2 | 29 ms | — |
| Doll +N: shift-click +5 | 31 ms | — |
| Doll +N: 3 clicks → +10 | 201 ms | — |
| Tab Gear → Exaltations (1st) | 94 ms | — |
| Tab Exaltations → Weights (1st) | 64 ms | — |
| Tab Weights → Gear (1st) | 90 ms | — |
| Tab Gear → Exaltations (2nd, warm) | 66 ms | — |
| Auto-fill **cold**, 23 slots, all shards | 311 ms | 113 ms |
| Auto-fill warm, replace all 23 | 76 ms | — |
| Share dialog open (encodes 23 slots → 321-char link) | 69 ms | — |
| Compare open, 2 × 23 items | 77 ms | — |

### Item browser

| Interaction | Latency | Longest task | Unthrottled |
|---|---|---|---|
| First paint (cold nav from set editor) | **715 ms** | **502 ms** | — |
| Sort → Item name (1st) | 412 ms | **348 ms** | 124 ms / 90 ms |
| Sort Item asc → desc | 340 ms | 268 ms | — |
| Sort → Slot | 325 ms | 255 ms | 97 ms / 61 ms |
| Sort → Era | 333 ms | 261 ms | — |
| Sort → EP (back) | 323 ms | 262 ms | 93 ms / 53 ms |
| Sort EP desc → asc (2nd press) | 344 ms | 283 ms | — |
| Page 1 → 2 (Next, 1st) | 174 ms | 127 ms | 80 ms |
| Page 2 → 3 | 259 ms | 188 ms | 121 ms / 74 ms |
| Page 3 → 2 (Previous, 1st) | 226 ms | 145 ms | — |
| Search "sword" (5 chars) | 181 ms | — | — |
| Slot filter → PRIMARY | 63 ms | — | — |
| Class filter → WAR | 36 ms | — | — |
| Weights profile change | 41 ms | — | — |
| Preview stepper +0 → +1 | 57 ms | — | — |
| Live content only, each direction | 53 / 54 ms | — | — |

### Cold load (4× throttle, empty cache)

| Route | first render | FCP | long tasks (top 4) | total blocking | JSON |
|---|---|---|---|---|---|
| `/` landing | 558 ms | 516 ms | 248, 108, 91, 71 | 518 ms | 2 files / 1.95 MB |
| `/#/set/:id` | 866 ms | 660 ms | 327, 185, 129, 90 | 796 ms | 2 files / 1.95 MB |
| `/#/items` | 439 ms | 452 ms | **458**, 295, 126, 109 | **1,142 ms** | **21 files / 6.1 MB** |

---

## Jank hunt

- **Layout shift: essentially zero.** CLS `0.0000` on every picker open, every
  filter toggle, every preview step, every equip, every tab switch, auto-fill,
  share, and compare. The one non-zero reading I recorded was **0.0820** on an
  item-browser slot-filter change, traceable to the top pager unmounting when
  results drop to ≤100 (P3).
- **Nothing moves under the pointer.** `useVirtualList` compensates measurement
  corrections that land *above* the viewport by adjusting `scrollTop`, and sets
  `overflow-anchor: none` so Chrome doesn't fight it. Verified by paging 25
  screens down: content never jumped.
- **No sticky hover.** `pointerMoved()` correctly ignores the synthetic pointer
  event Chromium fires after a scroll, so scrolling under a stationary cursor
  neither pops an item window nor steals the arrow-key highlight.
- **No scroll hijacking on the page.** `goTo()` calls `tableRef.scrollIntoView()`
  on a page turn, which is the expected behaviour for pagination and is instant
  rather than smooth.
- **Transitions are tight**: 0.10–0.18 s throughout, and
  `prefers-reduced-motion` is honoured twice (`styles.css:2763`,
  `tokens.css:207`).
- **Hover cards do not go stale on recycled rows** — the specific hazard I was
  sent to find. Tested three ways on the virtual list:

  | | result |
  |---|---|
  | hover row 3, then preview +0 → +5 (full re-rank) | card **dismissed**; no stale item, no stale tier |
  | hover row 3, then toggle Hide No Drop (membership change) | card **dismissed** |
  | hover row 3, then wheel-scroll 600 px | card **dismissed** |

  The layer drops on capture-phase `scroll` and on `resize`, and polls
  `anchor.isConnected` every 200 ms for anchors removed without a
  `pointerleave`. This is the correct set of guards.

---

## The virtualised picker, specifically

Everything I was told to hunt for, on a 1,729-row Any Slot:

| Check | Result |
|---|---|
| Scrollbar height honesty | `scrollHeight` 127,912 → 125,131 over 25 page-downs: **−2.1 % drift** as estimates are replaced by measurements. Inherent to variable-height windowing, corrections land below the viewport so no content jumps. Acceptable. |
| Reaching the true bottom | `scrollTop = scrollHeight` twice settles at 127,220 with `lastId = picker-option-1728` and `lastBottom == scrollHeight`. **No dead space, no phantom tail.** |
| Keyboard paging onto unrendered rows | `PageDown` ×10 → `picker-option-111` mounted, in view, highlighted. Never landed on a missing node. |
| `aria-activedescendant` pointing at nothing | **Never.** Checked at `scrollTop` 0, 7,326, 40,000, 60,000 and 127,220 — the `pinned` row keeps the active option mounted, `document.getElementById(ad)` resolved every time. At `scrollTop 60000` the mounted set was `[4, 836…859]` — the pinned row correctly out-of-band. |
| Scroll position after a filter change | Resets to `scrollTop 0`, `activeIndex 0`, canvas rebuilt to 109,723. Correct: membership changed, the old position is meaningless. |
| Active row surviving a re-rank | ArrowDown ×4 → `A Shovel` at index 4; five preview steps (full re-sort) → still `A Shovel`, still index 4, `aria-activedescendant` in step. **The identity-not-row-number design works.** |
| Resize mid-scroll | 1600×1000 → 600×500 → back: rows remount, `scrollHeight` stable within 26 px, no errors, no overflow. |

This is the strongest part of the codebase and it holds up under everything I
threw at it.

---

## Everything I tried to break

Zero console errors, zero page errors, zero `NaN` / `undefined` / `[object Object]`
in `document.body.innerText`, and zero corrupted saved state across **all** of the
following.

**Corrupt `localStorage` (20 payloads × 5 routes each)** — empty string,
whitespace, `{oh no`, half-truncated valid JSON, `null`, `[1,2,3]`, `42`,
`"hello"`, objects where `characters`/`sets` aren't arrays, arrays of `null`,
`version: 9999`, `version: -1`, string-`NaN` levels, 200-deep nesting,
`__proto__` and `constructor.prototype` pollution, a set pointing at a
nonexistent character with `upgrade: {full:99, fraction:-3}`, a 4 MB value, and
`slots` as an array. **All clean.**

**The corrupt value is not destroyed on a visit** — verified byte-identical after
loading `/#/characters`, and quarantined to `eqlups.state.v1.corrupt` /
`.future`. The v1 → v2 migration in `BROWSER-TESTING.md` passes exactly as
specified: `Legacy 47 PAL/WAR`, set intact, stored payload comes back
`version: 2`.

**Malformed share links (12)** — empty, garbage, half-truncated, one character
short, valid-base64-junk-bytes, 200 KB, `%E0%A4%A`, `<script>alert(1)</script>`,
`%00%00%00`, emoji, RTL override. All produce the correct error page. *(The
one-character-flip integrity gap is P2 above.)*

**Pathological names (13)** applied to character, loadout, set and notes, then
round-tripped through a share link: emoji, 500 chars, `<script>`, quotes and
backslashes, RTL override, CJK, zalgo, newlines/tabs, whitespace-only, `null`,
embedded JSON, combining accents, zero-width spaces. All render, all survive the
round trip, no XSS. *(The 500-char case is the P2 overflow, on one screen.)*

**Junk imports (16 files)** — empty, malformed JSON, bare array, `null` members,
no `format` field, 6 MB, random binary as `.png`, plain text, 400-deep nesting,
`__proto__` pollution; plus five files with a *valid* `format: "eql-upgrades"`
carrying RTL names, 300-char loadout names, `classes: ["WAR","WAR","NOPE",null,123]`,
`activeLoadoutId` pointing nowhere, a 600-char set name, `<img src=x onerror=…>`
as an item name, `upgrade: {full:"NaN", fraction:"x"}`, `weights: {AC:1e308,
HP:-1e308, XX:"str", YY:null}`, a bogus slot key, a 100 KB id, 3,000 characters,
and duplicate ids. Every one is rejected or repaired with an accurate message —
the hostile file reports *"Imported 1 character and 1 set (2 equipped items).
5 things in the file could not be used."* Duplicate ids are remapped
(`char_8a30d065`, `char_075574fb`). No XSS fired.

**Spam** — 60 alternating +/− stepper clicks (2,577 ms) ended at exactly `+0`
with 23 slots still stored; 40 rapid Live-content-only toggles (3,278 ms) ended
checked with the correct 1,729 count.

**All 23 slot pickers** opened cold in 256–373 ms with plausible counts
(Ear 47, Head 102, Neck 141, Primary 416, Secondary 362, Any Slot 1,729) and no
bad tokens.

**Deep links to nonexistent ids (11)** — `/#/set/nope`, `/#/character/nope`,
`/#/set/nope/weights`, `/#/set/nope/exaltations`, `/#/compare/a/b`, `/#/garbage`,
`/#/items/999`, `/#/set/`, `/#/set/%00`, `/#/set/<img src=x>`. All land on a
helpful screen; the set one even guesses the likely cause ("if you followed a
share link, it may have been truncated — share links live under `#/share/…`").

**24 rapid history steps** (12 back, 12 forward across 6 routes) — settled on the
right route, no errors, `sets=1 slots=23` intact.

**Resize mid-interaction** — shrunk to 600×500 and back to 1600×1000 with the
picker open and scrolled. No errors, no overflow, list rebuilt correctly.

### The two things I did break

1. **Horizontal overflow on `/#/character/:id`** — a 40-character unbroken name
   gives `scrollWidth 730` against a 390 px viewport (1.9×); 500 characters gives
   `8981` (23×). Steps: seed a character whose `name` is `'N'.repeat(40)`, open
   `/#/character/char_test` at 390 px. This is the only violation of
   `BROWSER-TESTING.md`'s "no horizontal page scroll" rule I found.

2. **A silently different plan from a corrupted share link** — build a 23-item
   set, copy the share link, replace character 117 (`A` → `H`), open it: the
   page renders happily with the **Head slot empty**. 2 of 30 single-character
   corruptions did this; the other 28 either round-tripped identically or were
   correctly rejected.

Neither throws, neither corrupts saved state, neither renders a bad token. I
could not achieve a crash, a data-loss-on-load, or a `NaN` anywhere.

---

## Accessibility, walked not sampled

Full tab-order traversal of every screen, at 1600, 768 and 390 px, checking each
stop for an accessible name, a focus indicator, and whether that indicator
survives its `overflow: hidden` ancestors.

| Screen | Tab stops | Verdict |
|---|---|---|
| Landing | 10 | every stop named, ring visible |
| Characters | 17 | every stop named |
| New character | 26 | every stop named; class grid is 16 real buttons |
| Character detail | 26 | all 16 class-level inputs individually named ("Warrior level" … "Berserker level") |
| Set editor, empty | 42 | every stop named |
| **Set editor, 23 equipped** | **88** | every stop named, including 23 `"‹item› upgrade level"` spinbuttons and 23 `"Remove ‹item› from ‹slot›"` buttons |
| Set exaltations | 13 (+ 92 unnamed `ADD`) | see P2 |
| Set weights | 40 | all 25 weight inputs named by stat |
| Item browser | **115** | see P2 |
| Compare | 10 | every stop named |
| Picker dialog | 11, trapped | see below |

**What is right, and it is a lot:**

- **Focus trap verified, not assumed.** 40 consecutive Tab presses inside the
  picker: **0 escapes**. Shift-Tab wraps correctly to Cancel → Clear slot → Hide
  No Drop.
- **Escape closes and restores** on the picker (`Head: Indicolite Helm. Change
  item.` regained focus) and on Share.
- **Destructive actions do not drop focus.** Activating
  `"Remove Black Sapphire Electrum Earring from Ear 1"` lands focus on
  `"Ear 1: empty. Choose an item."` — the same control, correctly relabelled.
- **The paper doll implements a real roving tabindex.** One tab stop; Arrow
  keys, `Home` and `End` move between all 23 cells, each announcing
  `"‹slot›, ‹item or empty›"`. This is the pattern the item browser needs.
- **The picker is a correct combobox/listbox**: one tab stop, `aria-expanded`,
  `aria-controls`, `aria-activedescendant`, rows carrying `role="option"`,
  `aria-selected`, `aria-setsize` and `aria-posinset`, all `tabIndex={-1}`.
- **Focus rings survive their clipping ancestor.** My walker flagged
  `.topbar nav { overflow: hidden }` as clipping the 2 px outline on the three
  nav links; on inspection the app already ships
  `.topbar nav a:focus-visible { box-shadow: inset 0 0 0 2px var(--accent) }`
  precisely for this, and the screenshot confirms a complete, unclipped ring.
  Correctly anticipated.
- **The item browser's `<caption>`** — a visually-hidden sentence naming the
  table's current filter state — is a genuinely thoughtful touch most planners
  don't bother with.
- **Reduced motion** honoured; **no horizontal page scroll** at 390/768/1024/1280
  on any screen with normal names; the wide item table scrolls inside its own
  `.table-wrap` rather than pushing the page; **one** sub-24 px hit target
  app-wide, and it is the `sr-only` file input.

**What is wrong:** the four items at P1–P3 above — focus dropped to `<body>` from
two dialogs, 100 tab stops per item-browser page, 92 buttons named `ADD`, and no
live region for any async count.

---

## What genuinely works

- **The picker is the product, and it is fast.** 1,729 candidates, uncapped,
  windowed, opening in 117 ms warm at 4× throttle and 28 ms unthrottled, with
  every filter under 110 ms and zero layout shift. Against sixtyupgrades' reputation
  for speed, this specific surface holds its own.
- **`useVirtualList` is careful, well-reasoned work** and survived every windowing
  attack in the brief — honest scrollbar, no dead space, no phantom
  `aria-activedescendant`, correct scroll reset, and a highlight that follows the
  *item* through a re-rank rather than sitting on a row number.
- **Robustness is the strongest dimension.** Roughly 100 hostile inputs across
  storage, links, imports, names, routes and history produced not one thrown
  error, not one bad token, not one lost byte of saved state — and the quarantine
  of unreadable payloads under a sibling key is more care than this class of app
  usually takes.
- **The set editor's accessibility is exemplary**: 88 tab stops, every one
  carrying a name that says both what it does and what it does it to.
- **The error copy is unusually good** where it is correct — the truncated-share-link
  page guesses the cause, the import reporter counts what it could not use, the
  auto-fill toast holds itself open while you are reading it.
- **The paper doll's roving tabindex and the picker's listbox pattern** are both
  textbook, and both are rarer in shipped software than they should be.

The gap to 9 is not architectural. It is one memo split in `ItemBrowser`, one
line moved in `Modal`, an `aria-label` template, a roving tabindex on the browser
table, two `else` branches in `StorageWarning`, and a warning where the weights
map is empty.
