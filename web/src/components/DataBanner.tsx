/**
 * Catalog status banner.
 *
 * The item data is produced by a separate pipeline and may simply not be there
 * yet. That is a normal state, not a crash: the planner still runs, the doll
 * still works, and this strip explains exactly what is missing and what the
 * fixture button will do instead.
 */

import { ATTRIBUTION } from '../engine/constants';
import { useCatalog } from '../data/catalog';
import { FIXTURE_NOTICE } from '../data/fixture';
import { count } from '../lib/format';


export function DataBanner() {
  const status = useCatalog((s) => s.status);
  const error = useCatalog((s) => s.error);
  const items = useCatalog((s) => s.items.length);
  const usingFixture = useCatalog((s) => s.usingFixture);
  const loadFixture = useCatalog((s) => s.loadFixture);

  if (usingFixture) {
    return (
      <div className="notice notice-warn" role="status">
        <span>
          <strong>Fixture data.</strong> {FIXTURE_NOTICE}
        </span>
      </div>
    );
  }

  if (status === 'missing') {
    return (
      <div className="notice notice-warn" role="status">
        <span>
          <strong>No item catalog published yet.</strong> The planner expects{' '}
          <code>data/items-index.json</code> and per-slot shards under <code>data/items/</code>. Until
          the data pipeline publishes them, slots will have nothing to offer. Everything else —
          characters, sets, upgrade levels, weights, share links — works now.
        </span>
        <button type="button" className="btn btn-sm" onClick={loadFixture}>
          Load fixture items
        </button>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="notice notice-bad" role="alert">
        <span>
          <strong>Item data failed to load.</strong> {error ?? 'Unknown error.'}
        </span>
        <button type="button" className="btn btn-sm" onClick={loadFixture}>
          Load fixture items
        </button>
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div className="notice" role="status">
        <span>Loading item catalog…</span>
      </div>
    );
  }

  if (status === 'ready' && items === 0) {
    return (
      <div className="notice notice-warn" role="status">
        <span>The catalog loaded but contains no usable items.</span>
      </div>
    );
  }

  return null;
}

/**
 * A raw ISO timestamp with milliseconds is a build artefact, not a fact a
 * player wants on a consumer page. And the item count is already on the CTA
 * that goes to the browser, so the footer stops repeating it.
 */
function generatedOn(iso: string | undefined): string | null {
  if (!iso) return null;
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return null;
  return when.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function CatalogFootnote() {
  const meta = useCatalog((s) => s.meta);
  const items = useCatalog((s) => s.items.length);
  const generated = generatedOn(meta?.generated);
  return (
    <>
      <span>{meta?.attribution ?? ATTRIBUTION}</span>
      {items ? (
        <span>
          {count(items)} items loaded{generated ? `, ${generated}` : ''}
        </span>
      ) : null}
    </>
  );
}
