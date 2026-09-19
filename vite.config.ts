import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

/**
 * `npm run demo` (mode "demo") points the app at a pretend backend that runs inside the browser
 * tab — see src/demo/install.ts. The values are set here rather than in an env file because
 * they are not secrets and not configuration anyone should edit: the address is deliberately
 * unreachable (.invalid) and the key is a placeholder.
 */
const DEMO_ENV = {
  'import.meta.env.VITE_DEMO': JSON.stringify('1'),
  'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://demo.printair.invalid'),
  'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('demo-mode-no-real-key'),
};

export default defineConfig(({ mode }) => ({
  define: mode === 'demo' ? DEMO_ENV : {},
  plugins: [
    react(),
    VitePWA({
      // 'prompt': a new version waits for the person to tap Refresh (see src/pwa/UpdateToast.tsx)
      // rather than reloading underneath them.
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        id: '/app',
        name: 'PrintAir — Print, delivered',
        short_name: 'PrintAir',
        description:
          'Post a print or packaging project, compare quotations from verified Philippine printing partners, and track it to delivery.',
        lang: 'en-PH',
        start_url: '/app',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f6f5fa',
        theme_color: '#f6f5fa',
        categories: ['business', 'productivity', 'shopping'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          {
            name: 'Start a print project',
            short_name: 'New project',
            url: '/dashboard?new=1',
            icons: [{ src: '/icons/shortcut-new.png', sizes: '96x96', type: 'image/png' }],
          },
          {
            name: 'My projects',
            short_name: 'Projects',
            url: '/dashboard',
            icons: [{ src: '/icons/shortcut-projects.png', sizes: '96x96', type: 'image/png' }],
          },
          {
            name: 'New opportunities',
            short_name: 'Opportunities',
            url: '/partner/opportunities',
            icons: [{ src: '/icons/shortcut-opps.png', sizes: '96x96', type: 'image/png' }],
          },
        ],
      },
      workbox: {
        // The app shell: everything the build emits.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Any in-app URL opened offline falls back to the shell, which renders its own offline state.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/(rest|auth|storage|functions|realtime)\/v1\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Supabase (data, sign-in, files, edge functions) and PayMongo checkout are NEVER
            // cached. A stale quote, order status or session is worse than an honest error.
            // Matched by path as well as host, so a self-hosted Supabase behind your own domain is covered.
            urlPattern: ({ url }) =>
              /^\/(rest|auth|storage|functions|realtime)\/v1\//.test(url.pathname) ||
              url.hostname.endsWith('.supabase.co') ||
              url.hostname.endsWith('.supabase.in') ||
              url.hostname.endsWith('paymongo.com') ||
              url.hostname === '127.0.0.1' ||
              url.hostname === 'localhost',
            handler: 'NetworkOnly',
          },
          {
            // Category and story photographs: fine to keep, cheap to refresh.
            urlPattern: ({ url }) => url.hostname === 'images.pexels.com',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'printair-photos',
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  preview: {
    host: true,
    port: 4175,
    strictPort: true,
    allowedHosts: true,
  },
  server: {
    host: true,
    allowedHosts: true,
  },
}));
