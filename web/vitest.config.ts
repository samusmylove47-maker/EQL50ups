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
      /*
       * So the two drift checks can actually reach eqlsource.com.
       *
       * They opt out of `jsdom` per-file (`// @vitest-environment node`) because
       * jsdom's `fetch` ignores proxy configuration; Node's own `fetch` honours
       * it, but only when asked to. Without this, egress from a test in this
       * container is refused with HTTP 403, both files take their loud-skip
       * path, and the live half of the drift checking silently never runs —
       * which is what was happening until 2026-08-18.
       *
       * Inert anywhere the environment sets no proxy, CI included: it names
       * variables to honour rather than a proxy to use, so where there is none
       * the fetch goes direct exactly as before.
       */
      env: { NODE_USE_ENV_PROXY: '1' },
    },
  }),
);
