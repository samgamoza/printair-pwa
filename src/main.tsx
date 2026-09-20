import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource-variable/bricolage-grotesque/wdth.css';
import '@fontsource-variable/figtree';
// The two faces of the "Classic" skin. Only the CSS is bundled; the font files download the first
// time something on screen uses them.
import '@fontsource-variable/fraunces/opsz.css';
import '@fontsource-variable/plus-jakarta-sans';
import './index.css';
import './styles/classic.css';
import { initLook } from './lib/look';

initLook();

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
