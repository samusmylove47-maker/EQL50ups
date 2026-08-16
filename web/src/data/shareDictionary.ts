/**
 * The share dictionary, memoised on the catalog revision.
 *
 * Rebuilding it sorts 11k names, so it must not happen on every render — and
 * it must happen again the moment a slot shard lands, because the dictionary's
 * key is a hash of the exact name list and an encoder and a decoder holding
 * different lists have to disagree loudly rather than quietly.
 */

import type { CatalogState } from './catalog';
import { buildDictionary, type ShareDictionary } from '../share/dictionary';

let cachedNames: readonly string[] | undefined;
let cached: ShareDictionary | undefined;

export function shareDictionary(catalog: CatalogState): ShareDictionary | undefined {
  const names = catalog.indexNames;
  if (!names.length) return undefined;
  if (cached && cachedNames === names) return cached;
  cached = buildDictionary(names);
  cachedNames = names;
  return cached;
}

/** Test hook: forget the memo so a fresh catalog is not shadowed by an old one. */
export function resetShareDictionary(): void {
  cachedNames = undefined;
  cached = undefined;
}
