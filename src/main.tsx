import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource-variable/bricolage-grotesque/wdth.css';
import '@fontsource-variable/figtree';
// The two faces of the "Classic" skin. Only the CSS is bundled; the font files download the first
// time something on screen uses them.
import '@fontsource-variable/fraunces/opsz.css';
import '@fontsource-variable/plus-jakarta-sans';
// The "PrintAir" wordmark's own typeface (Marks.tsx). Fixed across both skins on purpose — a
// logotype is a piece of brand identity, not a themable surface, so it doesn't switch with Classic.
import '@fontsource-variable/unbounded';
import './index.css';
import './styles/classic.css';
import { initLook } from './lib/look';
import { applyTheme } from './delight/prefs';

initLook();
applyTheme();

/**
 * The app is imported dynamically so that, in demo mode, the pretend backend is in place before
 * the Supabase client (created the moment the API layer loads) makes its first request.
 */
async function start() {
  const demo = import.meta.env.VITE_DEMO === '1';
  let DemoSwitcher: (() => JSX.Element) | null = null;
  if (demo) {
    // Another project may have left a service worker on this localhost address; it would serve
    // that project's cached pages in place of this app. Demo mode never needs one, so clear them.
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations().catch(() => []);
      await Promise.all(registrations.map((r) => r.unregister()));
    }
    const [{ installDemoBackend }, switcher] = await Promise.all([import('./demo/install'), import('./demo/DemoSwitcher')]);
    installDemoBackend();
    DemoSwitcher = switcher.DemoSwitcher;
  } else {
    // Weak or no connection: fall back to what this person last saw, and say so. Has to be in place
    // before the Supabase client is created, like the demo backend above. (Demo mode has no network
    // to lose, so it doesn't need it.)
    const { installLastSeen, keepStorage } = await import('./pwa/lastSeen');
    installLastSeen(import.meta.env.VITE_SUPABASE_URL as string);
    keepStorage();
  }

  const [{ default: App }, { AuthProvider }, { DialogsProvider }, { ErrorBoundary }] = await Promise.all([
    import('./App.tsx'),
    import('./contexts/AuthContext'),
    import('./components/ui/dialogs'),
    import('./components/ErrorBoundary'),
  ]);

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <BrowserRouter>
          <AuthProvider>
            <DialogsProvider>
              <App />
              {DemoSwitcher && <DemoSwitcher />}
            </DialogsProvider>
          </AuthProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </StrictMode>,
  );
}

start().catch((error: unknown) => {
  console.error('PrintAir failed to start:', error);
  (window as Window & { __printairBootError?: (m: unknown) => void }).__printairBootError?.(error instanceof Error ? error.message : error);
});
