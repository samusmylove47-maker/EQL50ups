/**
 * Per-set JSON export and import.
 *
 * Two properties are load-bearing. The round trip must be **lossless** — a
 * downstream tool that reads our file and writes it back must not quietly drop
 * an exaltation donor or a banked mote — and reading must be **total**: no
 * input throws, and everything dropped is named.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { tier } from '../engine/upgrade';
import { STATE_VERSION, emptyState } from '../state/persistence';
import { useApp } from '../state/store';
import {
  EXPORT_FORMAT, buildSetEnvelope, readEnvelope, readEnvelopeText,
  setExportFilename, summarizeReport,
} from './setExport';

function seed() {
  useApp.setState({ ...emptyState(), hydrated: true, storageStatus: 'ok' });
  const character = useApp.getState().createCharacter({
    name: 'Avenrae',
    level: 50,
    classes: ['BRD', 'WAR', 'BER'],
    race: 'Human',
  });
  const gearSet = useApp.getState().createSet(character.id, 'Raid — Tank', { AC: 2, HP: 0.5 }, {
    notes: 'Still hunting a better neck.',
    filters: { era: 'Kunark', source: 'quest', hideNoDrop: true },
  });
  useApp.getState().equip(gearSet.id, 'PRIMARY', 'Earthshaker', tier(7));
  useApp.getState().setUpgrade(gearSet.id, 'PRIMARY', { full: 7, fraction: 3 });
  useApp.getState().setExaltation(gearSet.id, 'PRIMARY', 'ornamentation', 'Glowing Mote');
  useApp.getState().setExaltation(gearSet.id, 'PRIMARY', 'focus', 'Second Donor');
  useApp.getState().equip(gearSet.id, 'ANY_2', 'Charm of Anywhere');
  return {
    character: useApp.getState().characters[0]!,
    gearSet: useApp.getState().sets.find((s) => s.id === gearSet.id)!,
  };
}

beforeEach(() => {
  useApp.setState({ ...emptyState(), hydrated: true, storageStatus: 'ok' });
});

describe('buildSetEnvelope', () => {
  it('emits exactly one set and its character, versioned and marked as a set file', () => {
    const { character, gearSet } = seed();
    const envelope = buildSetEnvelope(gearSet, character);

    expect(envelope.format).toBe(EXPORT_FORMAT);
    expect(envelope.kind).toBe('set');
    expect(envelope.version).toBe(STATE_VERSION);
    expect(envelope.sets).toHaveLength(1);
    expect(envelope.characters).toHaveLength(1);
    expect(envelope.sets[0]?.characterId).toBe(envelope.characters[0]?.id);
    expect(Date.parse(envelope.exportedAt)).not.toBeNaN();
  });

  it('still produces an importable file when the character has gone missing', () => {
    const { gearSet } = seed();
    const envelope = buildSetEnvelope(gearSet, undefined);
    const report = readEnvelope(JSON.parse(JSON.stringify(envelope)));

    expect(report.ok).toBe(true);
    expect(report.counts.sets).toBe(1);
    expect(report.envelope?.characters[0]?.name).toBe('Unknown character');
  });

  it('names the file after the set without letting a hostile name escape', () => {
    const { gearSet } = seed();
    expect(setExportFilename(gearSet)).toBe('eql-set-raid-tank.json');
    expect(setExportFilename({ ...gearSet, name: '../../etc/passwd' })).toBe('eql-set-etc-passwd.json');
    expect(setExportFilename({ ...gearSet, name: '🜲🜲🜲' })).toBe('eql-set-set.json');
  });
});

describe('round trip', () => {
  it('loses nothing: items, tiers, banked motes, donors, weights, notes, filters', () => {
    const { character, gearSet } = seed();
    const text = JSON.stringify(buildSetEnvelope(gearSet, character), null, 2);

    // A fresh library, as if the file had been opened in another browser.
    useApp.setState({ ...emptyState(), hydrated: true, storageStatus: 'ok' });
    const report = readEnvelopeText(text);
    expect(report.ok).toBe(true);
    expect(report.rejected).toEqual([]);
    expect(report.singleSet).toBe(true);

    const counts = useApp.getState().importEnvelope(report.envelope!);
    expect(counts).toEqual({ characters: 1, sets: 1 });

    const imported = useApp.getState().sets[0]!;
    expect(imported.name).toBe(gearSet.name);
    expect(imported.notes).toBe(gearSet.notes);
    expect(imported.weights).toEqual(gearSet.weights);
    expect(imported.defaultFilters).toEqual({ era: 'Kunark', source: 'quest', hideNoDrop: true });
    expect(imported.slots).toEqual(gearSet.slots);
    expect(imported.slots.PRIMARY?.upgrade).toEqual({ full: 7, fraction: 3 });
    expect(imported.slots.PRIMARY?.exaltations).toEqual({
      ornamentation: 'Glowing Mote',
      focus: 'Second Donor',
    });

    // Re-keyed, so importing the same file twice cannot overwrite anything.
    expect(imported.id).not.toBe(gearSet.id);
    expect(imported.characterId).toBe(useApp.getState().characters[0]?.id);
    expect(useApp.getState().characters[0]?.name).toBe('Avenrae');
    expect(useApp.getState().characters[0]?.race).toBe('Human');
  });

  it('survives a second lap through the exporter unchanged', () => {
    const { character, gearSet } = seed();
    const first = JSON.stringify(buildSetEnvelope(gearSet, character).sets[0]);

    useApp.setState({ ...emptyState(), hydrated: true, storageStatus: 'ok' });
    useApp.getState().importEnvelope(readEnvelopeText(
      JSON.stringify(buildSetEnvelope(gearSet, character)),
    ).envelope!);

    const again = useApp.getState().sets[0]!;
    const second = JSON.stringify(
      buildSetEnvelope(again, useApp.getState().characters[0]).sets[0],
    );
    // Ids and timestamps are the only fields allowed to move.
    const strip = (json: string) =>
      JSON.parse(json, (key, value) =>
        key === 'id' || key === 'characterId' || key === 'createdAt' || key === 'updatedAt'
          ? undefined
          : value,
      ) as unknown;
    expect(strip(second)).toEqual(strip(first));
  });
});

describe('malformed input is reported, never thrown', () => {
  const cases: Array<[string, unknown, RegExp]> = [
    ['null', null, /not a JSON object/],
    ['a bare number', 7, /not a JSON object/],
    ['an array', [1, 2, 3], /JSON array/],
    ['a foreign format', { format: 'pawn-export', characters: [], sets: [] }, /declares format/],
    ['no format at all', { characters: [], sets: [] }, /no "format" field/],
    [
      'a future schema',
      { format: EXPORT_FORMAT, version: 9999, characters: [], sets: [] },
      /newer version/,
    ],
    ['no characters array', { format: EXPORT_FORMAT, sets: [] }, /no "characters" array/],
    ['no sets array', { format: EXPORT_FORMAT, characters: [] }, /no "sets" array/],
    [
      'nothing usable inside',
      { format: EXPORT_FORMAT, version: 2, characters: [], sets: [] },
      /Nothing in that file/,
    ],
  ];

  for (const [label, input, message] of cases) {
    it(`refuses ${label} with a reason`, () => {
      const report = readEnvelope(input);
      expect(report.ok).toBe(false);
      expect(report.envelope).toBeNull();
      expect(report.errors.join(' ')).toMatch(message);
      expect(summarizeReport(report)).toMatch(message);
    });
  }

  it('refuses text that is not JSON', () => {
    const report = readEnvelopeText('<html>404</html>');
    expect(report.ok).toBe(false);
    expect(report.errors[0]).toMatch(/could not be read as JSON/);
  });

  it('imports the good part of a damaged file and names every part it dropped', () => {
    const { character, gearSet } = seed();
    const envelope = JSON.parse(JSON.stringify(buildSetEnvelope(gearSet, character))) as Record<
      string,
      unknown
    >;
    const sets = envelope.sets as Array<Record<string, unknown>>;
    const one = sets[0]!;
    const slots = one.slots as Record<string, unknown>;

    slots.HAT = { itemName: 'Not A Real Position' };
    slots.NECK = { itemName: '' };
    slots.CHEST = { itemName: 'Overcooked Breastplate', upgrade: { full: 999, fraction: 0 } };
    slots.LEGS = { itemName: 'Bad Donors', upgrade: { full: 0, fraction: 0 }, exaltations: { focus: 42 } };
    (one.weights as Record<string, unknown>).AC = 'two';
    one.defaultFilters = { era: 'Luclin', source: 'auction', hideNoDrop: 'yes' };
    sets.push({ id: 'orphan', characterId: 'nobody', name: 'Orphan', slots: {}, weights: {} });

    const report = readEnvelope(envelope);
    expect(report.ok).toBe(true);
    expect(report.counts.sets).toBe(1); // the orphan is gone

    const joined = report.rejected.join('\n');
    expect(joined).toMatch(/unknown slot "HAT"/);
    expect(joined).toMatch(/NECK had no usable item name/);
    expect(joined).toMatch(/CHEST upgrade \+999 clamped to \+10/);
    expect(joined).toMatch(/LEGS exaltation "focus" had no donor name/);
    expect(joined).toMatch(/weight AC was not a finite number/);
    expect(joined).toMatch(/unknown era "Luclin"/);
    expect(joined).toMatch(/unknown source filter "auction"/);
    expect(joined).toMatch(/hideNoDrop was not a boolean/);
    expect(joined).toMatch(/Orphan.*no matching character/);
    expect(summarizeReport(report)).toMatch(/could not be used/);

    // And what survived is genuinely usable, not a half-built object.
    const clean = report.envelope!.sets[0]!;
    expect(Object.keys(clean.slots)).not.toContain('HAT');
    expect(Object.keys(clean.slots)).not.toContain('NECK');
    expect(clean.slots.CHEST?.upgrade).toEqual({ full: 10, fraction: 0 });
    expect(clean.weights.AC).toBeUndefined();
    expect(clean.weights.HP).toBe(0.5);
    expect(clean.defaultFilters).toBeUndefined();
  });

  it('never throws, whatever it is handed', () => {
    const nasty: unknown[] = [
      undefined, '', '{', '[]', 'null', '{"format":"eql-upgrades"}',
      JSON.stringify({ format: EXPORT_FORMAT, characters: 'nope', sets: [] }),
      JSON.stringify({ format: EXPORT_FORMAT, characters: [null, 3], sets: [null, 'x', {}] }),
      JSON.stringify({ format: EXPORT_FORMAT, characters: [{ id: 'c' }], sets: [{ id: 's', characterId: 'c', slots: 5, weights: 5 }] }),
    ];
    for (const input of nasty) {
      expect(() => readEnvelopeText(String(input))).not.toThrow();
      expect(() => readEnvelope(input)).not.toThrow();
    }
  });

  it('accepts a whole-library dump too, and says it is not a single set', () => {
    seed();
    const report = readEnvelope(JSON.parse(JSON.stringify(useApp.getState().buildEnvelope())));
    expect(report.ok).toBe(true);
    expect(report.singleSet).toBe(false);
    expect(report.counts.characters).toBe(1);
    expect(summarizeReport(report)).toMatch(/Imported 1 set \(2 equipped items\) and 1 character\./);
  });
});
