/**
 * Catalog-revision-keyed name dictionary for share links.
 *
 * Item *names* are the item identity in this project (the corpus's numeric ids
 * are null for most entries, so they cannot be the wire identity). Names are
 * also, by a wide margin, the largest thing a share link carries: 23 equipped
 * items average ~25 characters each, which is two thirds of the payload.
 *
 * Interning them against the shipped catalog turns each one into a two-byte
 * index. The risk that buys is drift: if the catalog is rebuilt with items
 * added or removed, the indices shift and a link made against the old build
 * would decode to the wrong items. So the dictionary carries a `key` — a hash
 * over the exact name list it was built from — which the link records and the
 * decoder checks. A mismatch is refused outright rather than silently
 * mistranslated, and the encoder can always fall back to literal names, which
 * decode forever with no catalog at all.
 */

export interface ShareDictionary {
  /** 24-bit fingerprint of the exact name list this was built from. */
  key: number;
  names: string[];
  index: Map<string, number>;
}

/** FNV-1a, 32 bits, folded to 24 so it fits three wire bytes. */
function fingerprint(names: readonly string[]): number {
  let hash = 0x811c9dc5;
  for (const name of names) {
    for (let i = 0; i < name.length; i++) {
      hash ^= name.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    hash ^= 0x0a;
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 8) & 0xffffff;
}

/**
 * Build a dictionary from item names.
 *
 * Sorted and de-duplicated so the ordering depends only on the *set* of names,
 * not on the order the loader happened to merge shards in — otherwise a link
 * made before a slot shard loaded would not decode after it did.
 */
export function buildDictionary(names: Iterable<string>): ShareDictionary {
  const unique = [...new Set([...names].filter((n) => typeof n === 'string' && n !== ''))].sort();
  const index = new Map<string, number>();
  unique.forEach((name, i) => index.set(name.toLowerCase(), i));
  return { key: fingerprint(unique), names: unique, index };
}

export const EMPTY_DICTIONARY: ShareDictionary = buildDictionary([]);

export function lookupName(dict: ShareDictionary, name: string): number | undefined {
  return dict.index.get(name.toLowerCase());
}

export function nameAt(dict: ShareDictionary, at: number): string | undefined {
  return dict.names[at];
}
