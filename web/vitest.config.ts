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
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{ts,tsx}'],
    },
  }),
);
