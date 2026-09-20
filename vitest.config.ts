import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

// The fast unit tests: pure client-side helpers, no network. The backend suites that exercise
// row-level security against a local Supabase stack have their own config, vitest.backend.config.ts.
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // The API client refuses to load without these; no test here makes a network call.
    env: { VITE_SUPABASE_URL: 'http://127.0.0.1:54321', VITE_SUPABASE_ANON_KEY: 'test-anon-key' },
  },
});
