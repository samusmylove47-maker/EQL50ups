/**
 * Re-grade the exaltation socket ladder against the one export cited as its evidence.
 *
 * The export is TAB-delimited with CRLF line endings, and — this is what makes the test
 * meaningful — it prints a child row for every sub-slot that EXISTS, naming it `Empty`
 * when nothing is in it. So the set of `<Location>-Slot<N>` rows under an item is the set
 * of sockets the client believes that item has, independent of what is socketed in them.
 *
 * Therefore, for a `+N` item:
 *   - a predicted socket with NO row at all contradicts the ladder;
 *   - a socket row present below its unlockTier contradicts the ladder.
 * Neither is softened by "the player just hasn't filled it".
 *
 * Parsing has to be POSITIONAL, not keyed by location, for two reasons:
 *   - locations repeat (`Ear`, `Wrist`, `Fingers`, `Any Slot` twice each; `Equipment` 77
 *     times), so a Map keyed by location silently keeps only the last row;
 *   - a row can be both a child and a host — `Bank1-Slot3` is an item inside the bank AND
 *     the parent of `Bank1-Slot3-Slot7`. There are 370 such grandchild rows.
 * Depth is the count of `-Slot<N>` suffixes; each row attaches to the most recent
 * preceding row one level shallower.
 *
 * Keyring sections (`Equipment`, `Activated`, `Augmentation`, `KeyRing`) are excluded:
 * they are a flat collection list with no sub-slot rows at all, so scoring them against
 * the ladder would manufacture ~78 false counterexamples out of rows the client never
 * claimed were sockets. They are counted and reported separately.
 *
 * Run: node ladder-audit.mjs
 */
import { readFileSync } from 'node:fs';

import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const EXPORT = join(HERE, 'tier0-inventory.txt');
const ITEMS = join(REPO, 'web', 'public', 'data', 'items');

// Mirrors EXALTATION_LADDER in web/src/engine/exaltation.ts (kind, unlockTier, exportSlot).
const LADDER = [
  { kind: 'ornamentation', unlockTier: 0, exportSlot: 2 },
  { kind: 'focus', unlockTier: 1, exportSlot: 7 },
  { kind: 'click', unlockTier: 2, exportSlot: 8 },
  { kind: 'worn', unlockTier: 3, exportSlot: 9 },
  { kind: 'proc', unlockTier: 4, exportSlot: 10 },
];
// inventoryImport.ts accepts Slot1 as ornamentation too.
const ORNAMENT_SLOTS = new Set([1, 2]);
const KEYRING = /^(keyring|augmentation|activated|equipment)$/i;

const lines = readFileSync(EXPORT, 'utf8').split(/\r?\n/);

/** One row per line, linked to its parent by position. */
const nodes = [];
const openAtDepth = []; // depth -> index of the most recent node at that depth

for (const line of lines) {
  if (!line.trim()) continue;
  const cols = line.split('\t');
  if (cols.length < 2) continue;
  const location = cols[0].trim();
  const name = cols[1].trim();
  if (location === 'Location') continue;

  const suffixes = [...location.matchAll(/-Slot(\d+)/g)];
  const depth = suffixes.length;
  const slot = depth ? Number(suffixes[depth - 1][1]) : null;
  const root = location.split('-Slot')[0];

  const node = { location, root, name, depth, slot, children: [] };
  const index = nodes.push(node) - 1;
  if (depth > 0) {
    const parent = openAtDepth[depth - 1];
    if (parent !== undefined) nodes[parent].children.push(index);
  }
  openAtDepth[depth] = index;
  openAtDepth.length = depth + 1; // a shallower row closes everything below it
}

let early = 0;
let missing = 0;
let noOrnament = 0;
let keyringSkipped = 0;
let hostCount = 0;
const missingRows = [];
const earlyRows = [];

for (const node of nodes) {
  const plus = /\s\+(\d+)$/.exec(node.name);
  if (!plus) continue;
  if (KEYRING.test(node.root)) { keyringSkipped += 1; continue; }
  const tier = Number(plus[1]);
  hostCount += 1;

  const shownKinds = new Set();
  for (const childIndex of node.children) {
    const slot = nodes[childIndex].slot;
    if (ORNAMENT_SLOTS.has(slot)) { shownKinds.add('ornamentation'); continue; }
    const socket = LADDER.find((s) => s.exportSlot === slot);
    if (socket) shownKinds.add(socket.kind);
  }
  if (!shownKinds.has('ornamentation')) noOrnament += 1;

  const lacking = [];
  for (const socket of LADDER) {
    const predicted = tier >= socket.unlockTier;
    const present = shownKinds.has(socket.kind);
    if (present && !predicted) {
      early += 1;
      earlyRows.push(`${node.name} (+${tier}) has ${socket.kind}, ladder says +${socket.unlockTier}`);
    }
    // Ornamentation is cosmetic and separately known to be inconsistently
    // numbered; it is counted on its own line, not as a ladder counterexample.
    if (predicted && !present && socket.kind !== 'ornamentation') lacking.push(socket.kind);
  }
  if (lacking.length) {
    missing += 1;
    missingRows.push(
      `${node.name.padEnd(44)} +${String(tier).padEnd(2)} [${node.location}] no ${lacking.join(', ')} row`,
    );
  }
}

console.log(`rows parsed: ${nodes.length}`);
console.log(`+N items scored against the ladder: ${hostCount}`);
console.log(`  ...with a socket row EARLIER than the ladder predicts: ${early}`);
console.log(`  ...with NO row for a predicted non-cosmetic socket:    ${missing}`);
console.log(`  ...with no ornamentation row at all (Slot1 or Slot2):  ${noOrnament}`);
console.log(`+N items in keyring sections, not scored:               ${keyringSkipped}`);
console.log('');
for (const row of earlyRows) console.log(`EARLY   ${row}`);
for (const row of missingRows) console.log(`MISSING ${row}`);

/* ------------------------------------------------------------------------- *
 * Does a native click effect explain the nine?
 *
 * The obvious hypothesis is that an item with its own click cannot also take a
 * click exaltation. Cross-tabulating the export against the shipped catalog
 * settles it in both directions, which is why both cells of each row are
 * printed rather than only the confirming one.
 * ------------------------------------------------------------------------- */

const hasNativeClick = new Map();
for (const file of readdirSync(ITEMS)) {
  const parsed = JSON.parse(readFileSync(join(ITEMS, file), 'utf8'));
  for (const item of Array.isArray(parsed) ? parsed : (parsed.items ?? [])) {
    const key = (item.n ?? '').toLowerCase();
    const native = (item.fx ?? []).some((fx) => fx.k === 'click');
    hasNativeClick.set(key, (hasNativeClick.get(key) ?? false) || native);
  }
}

const cells = { 'click/slot8': 0, 'click/none': 0, 'plain/slot8': 0, 'plain/none': 0 };
const clickWithSocket = [];
let unresolved = 0;

for (const node of nodes) {
  const plus = /\s\+(\d+)$/.exec(node.name);
  if (!plus || KEYRING.test(node.root)) continue;
  if (Number(plus[1]) < 2) continue; // the ladder only predicts click from +2
  const base = node.name.replace(/\s\+\d+$/, '').toLowerCase();
  if (!hasNativeClick.has(base)) { unresolved += 1; continue; }
  const native = hasNativeClick.get(base);
  const socket = node.children.some((i) => nodes[i].slot === 8);
  cells[`${native ? 'click' : 'plain'}/${socket ? 'slot8' : 'none'}`] += 1;
  if (native && socket) clickWithSocket.push(`${node.name} [${node.location}]`);
}

console.log('\n+N items at tier >= 2, resolved against the shipped catalog:');
console.log(`  native click, HAS click socket : ${cells['click/slot8']}`);
console.log(`  native click, NO  click socket : ${cells['click/none']}`);
console.log(`  no click,     HAS click socket : ${cells['plain/slot8']}`);
console.log(`  no click,     NO  click socket : ${cells['plain/none']}`);
console.log(`  name not resolved in catalog   : ${unresolved}`);
console.log('\nnative click yet the socket is present anyway:');
for (const row of clickWithSocket) console.log(`  ${row}`);
