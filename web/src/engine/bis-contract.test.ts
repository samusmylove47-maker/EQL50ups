/**
 * The published seam identifies itself, or it is not published.
 *
 * `bis-contract.ts` says of its own version constant: *"E asserts on this
 * before reading a payload."* For a day it shipped without reaching
 * `manifest.json`, so the assertion the contract instructed a consumer to make
 * was one the consumer had no way to make — three files that could name the
 * contract's PATH and nothing about which revision the bundle implemented.
 * Grepping for the constant found one definition and zero readers.
 *
 * These tests are the strong link over a weak one. `publish-bis.mjs` is an
 * `.mjs` script and cannot import TypeScript, so it extracts the version by
 * regex; here the real constant is imported and compared. If that regex ever
 * mis-parses, or someone edits the contract without republishing, this fails
 * rather than shipping a manifest that quietly describes a different file.
 *
 * That last case is deliberate and matches how this repository already works:
 * CI does not run the pipeline, it ships the committed artifacts, so committed
 * artifacts that no longer describe their source are a defect and not a chore.
 * The fix is one command — `npm run build:bis && node pipeline/publish-bis.mjs`.
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BIS_CONTRACT_VERSION } from './bis-contract';

const MANIFEST = 'public/bis/manifest.json';
const CONTRACT = 'src/engine/bis-contract.ts';

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')) as {
  contract: string;
  contractVersion: string;
  contractSha256_8: string;
  bundle: { file: string; sha256_8: string; bytes: number };
  catalogue: { sha256_8: string; bytes: number; records: number };
};

describe('the published BIS manifest names WHICH contract, not just where', () => {
  it('carries the version the contract module actually exports', () => {
    expect(manifest.contractVersion).toBe(BIS_CONTRACT_VERSION);
  });

  /**
   * A version says what changed on purpose; a hash says whether anything
   * changed at all. The gap engine needed both because two different byte-sets
   * shipped upstream as `1.2.0` in one night and an exact-version guard could
   * not separate them. Same lesson, applied to our own half of the seam.
   */
  it('carries a hash that is the hash of these contract bytes', () => {
    const actual = createHash('sha256').update(readFileSync(CONTRACT)).digest('hex').slice(0, 8);
    expect(manifest.contractSha256_8).toBe(actual);
  });

  it('points at a contract path that exists', () => {
    expect(manifest.contract).toBe(`web/${CONTRACT}`);
    expect(readFileSync(CONTRACT, 'utf8')).toContain('export const BIS_CONTRACT_VERSION');
  });

  /** The regex in publish-bis.mjs must match the form the contract is written in. */
  it('is extractable by the pattern the publisher uses', () => {
    const m = /export const BIS_CONTRACT_VERSION\s*=\s*'([^']+)'/
      .exec(readFileSync(CONTRACT, 'utf8'));
    expect(m?.[1]).toBe(BIS_CONTRACT_VERSION);
  });
});

describe('the published artifacts describe themselves accurately', () => {
  it('records the bundle hash and size of the bundle it shipped', () => {
    const bytes = readFileSync(`public/bis/${manifest.bundle.file}`);
    expect(bytes.length).toBe(manifest.bundle.bytes);
    const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 8);
    expect(hash).toBe(manifest.bundle.sha256_8);
    // Content-addressed filename: the name must address this content.
    expect(manifest.bundle.file).toContain(manifest.bundle.sha256_8);
  });

  it('records the catalogue hash, size and record count it shipped', () => {
    const raw = readFileSync('public/bis/bis-catalog.json');
    expect(raw.length).toBe(manifest.catalogue.bytes);
    expect(createHash('sha256').update(raw).digest('hex').slice(0, 8))
      .toBe(manifest.catalogue.sha256_8);
    expect((JSON.parse(raw.toString('utf8')) as { records: unknown[] }).records)
      .toHaveLength(manifest.catalogue.records);
  });
});

/**
 * The contract's prose about the payload, checked against the payload.
 *
 * `Obtainable.difficulty`'s doc names the survey grades it read, and named one
 * that does not exist on that field while missing one that does. Prose citing a
 * command is not evidence that the command was re-run; this is.
 */
describe('the difficulty grades the contract describes', () => {
  const meta = JSON.parse(readFileSync('public/data/meta.json', 'utf8')) as {
    zones?: { surveyed?: { coverage?: Record<string, string> }[] };
  };

  it('is exactly the set the contract names, counted from the payload', () => {
    const surveyed = meta.zones?.surveyed ?? [];
    expect(surveyed.length).toBeGreaterThan(0);
    const tally: Record<string, number> = {};
    for (const zone of surveyed) {
      const grade = zone.coverage?.difficulty ?? '(absent)';
      tally[grade] = (tally[grade] ?? 0) + 1;
    }
    // The values the contract's comment now states.
    expect(Object.keys(tally).sort()).toEqual(['measured', 'none']);
    // And `sourced` is a sibling-facet value, never a difficulty one.
    expect(tally.sourced).toBeUndefined();
  });
});

/**
 * The `id` field is mostly null, on purpose, and the contract says so with a
 * figure. This pins the RELATIONSHIP rather than the figure, so it stays true
 * as the catalogue grows: whatever `meta.counts.withNumericId` says must be
 * exactly the number of published records carrying an id.
 */
describe('why currentGear cannot be keyed on the catalogue id', () => {
  it('publishes the id count it claims, and it is a small minority', () => {
    const meta = JSON.parse(readFileSync('public/data/meta.json', 'utf8')) as {
      counts?: { withNumericId?: number };
    };
    const records = (JSON.parse(readFileSync('public/bis/bis-catalog.json', 'utf8')) as {
      records: { id?: string | number | null }[];
    }).records;

    const withId = records.filter((r) => r.id != null).length;
    expect(withId).toBe(meta.counts?.withNumericId);
    // The premise of the contract's warning: most records have no id at all.
    expect(withId).toBeLessThan(records.length / 2);
  });
});
