/**
 * Item name search index.
 *
 * With ~10k items a naive `filter(includes)` on every keystroke is survivable
 * but wasteful, and it gets worse once scoring is layered on. So names are
 * tokenised once per catalog revision into prefix buckets: a query token is
 * looked up by its first three characters, which cuts the candidate set by
 * two to three orders of magnitude before any string comparison happens.
 *
 * Buckets hold `Item` references, so the result is a `Set` the ranked list can
 * test by identity while walking an already-sorted array.
 */

import type { Item } from '../engine/types';

const PREFIX = 3;
const TOKEN_SPLIT = /[^a-z0-9']+/;

function tokenize(text: string): string[] {
  return text.toLowerCase().split(TOKEN_SPLIT).filter(Boolean);
}

export class SearchIndex {
  private readonly buckets = new Map<string, Item[]>();
  private readonly haystack = new Map<Item, string>();

  constructor(items: readonly Item[]) {
    for (const item of items) {
      const name = item.n.toLowerCase();
      this.haystack.set(item, name);
      const seen = new Set<string>();
      for (const token of tokenize(item.n)) {
        for (let len = 1; len <= Math.min(PREFIX, token.length); len++) {
          const key = token.slice(0, len);
          if (seen.has(key)) continue;
          seen.add(key);
          const bucket = this.buckets.get(key);
          if (bucket) bucket.push(item);
          else this.buckets.set(key, [item]);
        }
      }
    }
  }

  /** `null` means "no query" — every item matches. */
  search(query: string): Set<Item> | null {
    const tokens = tokenize(query);
    if (!tokens.length) return null;

    // Start from the most selective token so the intersection shrinks fast.
    const candidateSets = tokens
      .map((token) => ({ token, bucket: this.buckets.get(token.slice(0, PREFIX)) ?? [] }))
      .sort((a, b) => a.bucket.length - b.bucket.length);

    const first = candidateSets[0];
    if (!first) return null;

    let current: Item[] = first.bucket.filter((item) =>
      (this.haystack.get(item) ?? '').includes(first.token),
    );
    for (let i = 1; i < candidateSets.length && current.length; i++) {
      const next = candidateSets[i];
      if (!next) continue;
      current = current.filter((item) => (this.haystack.get(item) ?? '').includes(next.token));
    }
    return new Set(current);
  }
}

const cache = new Map<number, SearchIndex>();

/** One index per catalog revision, rebuilt only when the catalog changes. */
export function searchIndexFor(revision: number, items: readonly Item[]): SearchIndex {
  const hit = cache.get(revision);
  if (hit) return hit;
  cache.clear();
  const index = new SearchIndex(items);
  cache.set(revision, index);
  return index;
}
