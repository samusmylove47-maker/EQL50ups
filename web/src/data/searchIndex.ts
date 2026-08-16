/**
 * Item name search index.
 *
 * With ~10k items a naive `filter(includes)` per keystroke is survivable but
 * wasteful, and it gets worse once scoring is layered on top. So names are
 * indexed once per catalog revision as **trigrams**: every three-character
 * window of the lowercased name maps to the items containing it. A query term
 * of three characters or more is looked up by its own first trigram, which
 * cuts the candidate set by two to three orders of magnitude before a single
 * string comparison runs; the surviving candidates are then verified with a
 * plain substring test, so matching is true substring matching rather than
 * prefix-only. Terms shorter than a trigram fall back to a linear scan, which
 * at this catalog size costs about a millisecond.
 *
 * Buckets hold `Item` references, so the result is a `Set` the ranked list can
 * test by identity while walking an already-sorted array.
 */

import type { Item } from '../engine/types';

const GRAM = 3;
const TOKEN_SPLIT = /\s+/;

function tokenize(text: string): string[] {
  return text.toLowerCase().trim().split(TOKEN_SPLIT).filter(Boolean);
}

export class SearchIndex {
  private readonly buckets = new Map<string, Item[]>();
  private readonly haystack: string[];
  private readonly items: readonly Item[];

  constructor(items: readonly Item[]) {
    this.items = items;
    this.haystack = new Array<string>(items.length);
    for (let i = 0; i < items.length; i++) {
      const name = (items[i] as Item).n.toLowerCase();
      this.haystack[i] = name;
      const seen = new Set<string>();
      for (let start = 0; start + GRAM <= name.length; start++) {
        const gram = name.slice(start, start + GRAM);
        if (seen.has(gram)) continue;
        seen.add(gram);
        const bucket = this.buckets.get(gram);
        if (bucket) bucket.push(items[i] as Item);
        else this.buckets.set(gram, [items[i] as Item]);
      }
      // Names shorter than one trigram are still findable by exact text.
      if (name.length < GRAM && name) {
        const bucket = this.buckets.get(name);
        if (bucket) bucket.push(items[i] as Item);
        else this.buckets.set(name, [items[i] as Item]);
      }
    }
  }

  private candidatesFor(term: string): Item[] {
    if (term.length >= GRAM) return this.buckets.get(term.slice(0, GRAM)) ?? [];
    // Short terms: scan, which is cheap and keeps semantics identical.
    const out: Item[] = [];
    for (let i = 0; i < this.items.length; i++) {
      if ((this.haystack[i] ?? '').includes(term)) out.push(this.items[i] as Item);
    }
    return out;
  }

  /** `null` means "no query" — every item matches. */
  search(query: string): Set<Item> | null {
    const terms = tokenize(query);
    if (!terms.length) return null;

    // Start from the most selective term so the intersection shrinks fastest.
    const plans = terms
      .map((term) => ({ term, candidates: this.candidatesFor(term) }))
      .sort((a, b) => a.candidates.length - b.candidates.length);

    const first = plans[0];
    if (!first) return null;

    const lower = new Map<Item, string>();
    let current = first.candidates.filter((item) => {
      const name = item.n.toLowerCase();
      lower.set(item, name);
      return name.includes(first.term);
    });

    for (let i = 1; i < plans.length && current.length; i++) {
      const plan = plans[i];
      if (!plan) continue;
      current = current.filter((item) => (lower.get(item) ?? item.n.toLowerCase()).includes(plan.term));
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
