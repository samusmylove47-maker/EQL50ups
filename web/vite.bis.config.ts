/**
 * The BIS bundle — 50 Upgrades' half of the seam, as a single file.
 *
 * Session E ships `eqls-gap-engine.<sha256[:8]>.js`, a classic script that
 * defines one global. This is the symmetric artifact for the other side, built
 * to the same convention deliberately: E's own bundle contract says one file,
 * no imports, no sibling assets, not an ES module, because the pages that load
 * it are generated HTML with no bundler.
 *
 * `npm run build:bis` writes `dist-bis/eqls-50upgrades.js`;
 * `node pipeline/publish-bis.mjs` hashes it and copies it under its content
 * hash, the same way the site serves E's.
 */
import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    outDir: 'dist-bis',
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, 'src/engine/bis.ts'),
      name: 'EQLS50Upgrades',
      formats: ['iife'],
      fileName: () => 'eqls-50upgrades.js',
    },
    // No minify: this is a contract artifact and a consumer reading it to
    // understand the seam is a supported use. E's bundle is readable too.
    minify: false,
    sourcemap: false,
  },
});
