import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';
import { readFileSync } from 'node:fs';

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

/**
 * Facebook, Messenger, Viber and friends only show a link's picture when its address is complete
 * (https://…), and a static page can't know its own address. Set VITE_APP_URL on the host and the
 * share tags in index.html get it; leave it unset and they fall back to relative paths.
 */
function appUrl(url: string): Plugin {
  return {
    name: 'printair-app-url',
    buildStart() {
      // A nudge, not a failure: the legal pages ship with a visible "Draft" notice until someone signs them off.
      if (/reviewed:\s*false/.test(readFileSync(new URL('./src/data/legal.ts', import.meta.url), 'utf8'))) {
        this.warn('Privacy Policy and Terms are still marked as drafts — see src/data/legal.ts before launch.');
      }
    },
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        // The app proper is loaded by a dynamic import (so demo mode can step in first), which hides
        // it from the browser until the entry script has run. Announcing those files, and the three
        // fonts every screen uses (body, headline, and the wordmark's own face), lets them download
        // alongside the entry script instead of after it — the logo is on screen from first paint.
        const files = Object.keys(ctx.bundle ?? {});
        const pick = (re: RegExp) => files.filter((f) => re.test(f));
        const tags = [
          ...pick(/assets\/(App|AuthContext|dialogs)-[\w-]+\.js$/).map((f) => ({
            tag: 'link',
            attrs: { rel: 'modulepreload', href: `/${f}`, crossorigin: true },
            injectTo: 'head' as const,
          })),
          ...pick(/assets\/(bricolage-grotesque-latin-wdth-normal|figtree-latin-wght-normal|unbounded-latin-wght-normal)-[\w-]+\.woff2$/).map((f) => ({
            tag: 'link',
            attrs: { rel: 'preload', as: 'font', type: 'font/woff2', href: `/${f}`, crossorigin: true },
            injectTo: 'head' as const,
          })),
        ];
        return { html: html.replaceAll('__APP_URL__', url.replace(/\/+$/, '')), tags };
      },
    },
  };
}

export default defineConfig(({ mode }) => ({
  define: mode === 'demo' ? DEMO_ENV : {},
  plugins: [
    react(),
    appUrl(loadEnv(mode, process.cwd(), 'VITE_').VITE_APP_URL ?? ''),
    VitePWA({
      // 'prompt': a new version waits for the person to tap Refresh (see src/pwa/UpdateToast.tsx)
      // rather than reloading underneath them.
      registerType: 'prompt',
      includeAssets: ['logo-mark.png', 'apple-touch-icon.png'],
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
        // Installing the app downloads everything listed above in the background — on a weak
        // connection that competes with the person's first screens. So only what is needed to run
        // is precached: the Latin cut of each font (Filipino and English need nothing else; the
        // other alphabets are fetched and kept the first time a page actually uses them), and not
        // the link-preview picture or the home-screen icons, which the phone and social networks fetch
        // for themselves and the running app never draws.
        globIgnores: ['**/*-{latin-ext,vietnamese,cyrillic,cyrillic-ext,greek,greek-ext}-*.woff2', 'share-card.png', 'icons/**', 'brand/lockup*.png'],
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
            // Font cuts left out of the precache above: kept for good once used (their names are hashed).
            urlPattern: ({ url, sameOrigin }) => sameOrigin && /\/assets\/.*\.woff2$/.test(url.pathname),
            handler: 'CacheFirst',
            options: { cacheName: 'printair-fonts', expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 } },
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
  // lucide-react is deliberately NOT excluded from pre-bundling (the original project excluded
  // it). Left unbundled, the dev server serves every icon as its own file, and ad blockers refuse
  // some of them by name (fingerprint.js, among others), which takes the whole app down with
  // "Failed to fetch dynamically imported module". Pre-bundled, the icons arrive as one file.
  optimizeDeps: {
    include: ['lucide-react'],
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
