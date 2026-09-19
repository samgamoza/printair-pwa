import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

// Only the pure client-side helpers are tested here. The end-to-end suites that
// exercise row-level security live with the backend, in the original repo.
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
