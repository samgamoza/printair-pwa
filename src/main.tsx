import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource-variable/bricolage-grotesque/wdth.css';
import '@fontsource-variable/figtree';
import App from './App.tsx';
import { AuthProvider } from './contexts/AuthContext';
import { DialogsProvider } from './components/ui/dialogs';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <DialogsProvider>
            <App />
          </DialogsProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);
