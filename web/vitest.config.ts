/// <reference types="vitest/config" />
import { defineConfig, mergeConfig } from 'vite';
import viteConfig from './vite.config.ts';

/**
 * Tests run against a jsdom window because the screen smoke tests render the
 * app shell, which reads `window.location.hash` for routing. Engine and codec
 * tests are environment-agnostic and unaffected.
 */
export default mergeConfig(
  viteConfig,
  defineConfig({
    /*
     * The repository root, so a test may load a pipeline script directly.
     *
     * `src/data/patch-day.test.ts` exercises `pipeline/refresh.mjs` — the
     * patch-day diff engine — against a simulated patch. Without this, the
     * module runner refuses any path above `web/` and the engine that decides
     * what a patch admits to the catalog is the one thing with no test on it.
     * Test-time only: `vite.config.ts` is untouched, so the production build
     * still cannot reach outside `web/`.
     */
    server: { fs: { allow: ['..'] } },
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{ts,tsx}'],
    },
  }),
);
