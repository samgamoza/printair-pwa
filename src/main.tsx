import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource-variable/bricolage-grotesque/wdth.css';
import '@fontsource-variable/figtree';
import './index.css';

/**
 * The app is imported dynamically so that, in demo mode, the pretend backend is in place before
 * the Supabase client (created the moment the API layer loads) makes its first request.
 */
async function start() {
  const demo = import.meta.env.VITE_DEMO === '1';
  let DemoSwitcher: (() => JSX.Element) | null = null;
  if (demo) {
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

void start();
