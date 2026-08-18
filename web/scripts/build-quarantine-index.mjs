/**
 * Ship the quarantine decision to the player.
 *
 * `pipeline/quarantine.json` is the record of the project's largest editorial
 * decision: 7,719 of the wiki's 11,252 item records are content EverQuest
 * Legends does not have, and they are withheld by name with a reason each. That
 * file is 1.1 MB and carries fields — key, era, slots — the browser does not
 * need to answer the one question a player ever asks it: *"I searched for my
 * epic and got nothing. Why?"*
 *
 * This reduces it to the two facts that answer that: the name, and which of the
 * eight rules withheld it. Names are grouped under a reason code so the reason
 * string is stored once rather than 7,719 times, and the prose that explains
 * each code lives here, next to the rule it paraphrases, rather than in the
 * component that renders it.
 *
 *   node web/scripts/build-quarantine-index.mjs
 *
 * The output is committed, and `src/data/quarantine.test.ts` fails if it drifts
 * from `pipeline/quarantine.json`, so a rebuilt pipeline cannot leave the app
 * explaining an item the pipeline has since restored.
 *
 * This script does not read or write anything the pipeline owns except as
 * input; it never edits `pipeline/`.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const SOURCE = resolve(HERE, '../../pipeline/quarantine.json');
export const OUTPUT = resolve(HERE, '../public/quarantine.json');

/**
 * One line of prose per `why` the pipeline emits.
 *
 * Each is a paraphrase of `research/SOURCING-STANDARD.md`, and each is written
 * to claim exactly what that document claims and no more. The era rules assert
 * the expansion is absent from this server, because that is the standard's
 * stated position ("content from expansions that do not exist in EverQuest
 * Legends"). The era-less rule asserts nothing of the kind — rule 3 says an
 * unplaced item is *unconfirmed*, not absent — and the copy says so, because a
 * player told "this does not exist" about an item that might is exactly the
 * failure this whole screen is being built to end.
 */
const REASONS = {
  'era:Kunark': {
    code: 'kunark',
    title: 'Ruins of Kunark',
    line: 'It is Ruins of Kunark content. EverQuest Legends does not have that expansion, so the item is held out of the catalog rather than offered as something you could go and get.',
  },
  'era:Velious': {
    code: 'velious',
    title: 'Scars of Velious',
    line: 'It is Scars of Velious content. EverQuest Legends does not have that expansion, so the item is held out of the catalog rather than offered as something you could go and get.',
  },
  'era:Luclin': {
    code: 'luclin',
    title: 'Shadows of Luclin',
    line: 'It is Shadows of Luclin content. EverQuest Legends does not have that expansion, so the item is held out of the catalog rather than offered as something you could go and get.',
  },
  'era:Epic Quests': {
    code: 'epic',
    title: 'Epic quests',
    line: 'It is Epic Quest content, and this server does not have the epic quests. The wiki carries the page because large parts of it are a Project 1999 import describing original EverQuest, not this game.',
  },
  'era:Chardok Revamp': {
    code: 'chardok',
    title: 'Chardok revamp',
    line: 'It comes from the Chardok revamp, a later original-EverQuest content patch this server does not have.',
  },
  'era:FearHateRevamp': {
    code: 'fear-hate-revamp',
    title: 'Fear/Hate revamp',
    line: 'It comes from the Fear/Hate revamp, a later original-EverQuest content patch this server does not have. Its five armour sets were once mistaken here for EQL planar gear; the only planar set a player has actually confirmed is Shadow Rage, which does ship.',
  },
  'wiki flags non_legends': {
    code: 'flagged-not-legends',
    title: 'Flagged not-in-Legends',
    line: 'The wiki page for it is itself flagged as not present in EverQuest Legends.',
  },
  'no era in any source': {
    code: 'era-unplaced',
    title: 'Era unplaced',
    line: 'No source places it in any era. An item nobody can place is treated as unconfirmed rather than assumed classic, so it waits for a patch note or a first-hand sighting to place it. That is a gap in the evidence, not proof the game lacks it — if you are holding one, it belongs in the catalog and the export importer will say so.',
  },
};

/** Build the shipped index from a parsed `pipeline/quarantine.json`. */
export function buildQuarantineIndex(raw) {
  const items = Array.isArray(raw?.items) ? raw.items : [];
  const names = {};
  const reasons = {};
  const unknown = new Set();
  let written = 0;

  for (const entry of items) {
    const name = typeof entry?.n === 'string' ? entry.n.trim() : '';
    const why = typeof entry?.why === 'string' ? entry.why : '';
    if (!name) continue;
    const reason = REASONS[why];
    if (!reason) {
      unknown.add(why);
      continue;
    }
    if (!reasons[reason.code]) {
      reasons[reason.code] = { why, title: reason.title, line: reason.line };
      names[reason.code] = [];
    }
    names[reason.code].push(name);
    written += 1;
  }

  if (unknown.size) {
    throw new Error(
      `quarantine.json carries reasons this script has no copy for: ${[...unknown].join(', ')}. ` +
        'Add them to REASONS rather than dropping them — an unexplained absence is the bug.',
    );
  }

  for (const list of Object.values(names)) list.sort((a, b) => a.localeCompare(b));

  const counts = raw?.counts ?? {};
  return {
    source: 'pipeline/quarantine.json',
    rule: typeof raw?.rule === 'string' ? raw.rule : '',
    counts: {
      scraped: Number(counts.before) || 0,
      shipped: Number(counts.shipped) || 0,
      quarantined: Number(counts.quarantined) || 0,
      explained: written,
    },
    reasons,
    names,
  };
}

function main() {
  const raw = JSON.parse(readFileSync(SOURCE, 'utf8'));
  const index = buildQuarantineIndex(raw);
  const json = `${JSON.stringify(index)}\n`;
  writeFileSync(OUTPUT, json);
  const kb = (Buffer.byteLength(json) / 1024).toFixed(1);
  process.stdout.write(
    `${OUTPUT}: ${index.counts.explained} names, ${Object.keys(index.reasons).length} reasons, ${kb} KB\n`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main();
}
