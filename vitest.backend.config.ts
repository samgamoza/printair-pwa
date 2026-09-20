import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

// The backend suites: they sign real people up against a LOCAL Supabase stack and prove the
// security rules, the database functions and the payment flow behave. They need Docker and
// `npx supabase start`, so they are kept out of `npm test` / `npm run check`.
//   npm run test:backend      (stack already running, .env filled in)
//   npm run test:backend:ci   (starts the stack, runs, stops it)
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // local-only.ts first: it refuses to run against anything but a local stack.
    setupFiles: ['./tests/local-only.ts', './tests/setup.ts'],
    // Integration tests share one local database; running files in parallel
    // makes their data interleave unpredictably.
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
