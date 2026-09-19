import { useEffect, useState, useSyncExternalStore } from 'react';

/**
 * Install support.
 *
 * Chrome, Edge and Android fire `beforeinstallprompt` once, early, and only
 * let the saved event be used from a tap — so it is captured here at module
 * load, before any component has mounted, and shared through a tiny store.
 * Safari on iPhone and iPad never fires it; there the only route is
 * Share → Add to Home Screen, so the UI shows instructions instead.
 */

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    notify();
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari's own flag for "launched from the home screen".
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
  return ios && !/CriOS|FxiOS|EdgiOS/.test(ua);
}

const DISMISS_KEY = 'printair.install.dismissed';

export function useInstall() {
  const canPrompt = useSyncExternalStore(
    subscribe,
    () => deferred !== null,
    () => false,
  );
  const [installed, setInstalled] = useState(isStandalone);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const onInstalled = () => setInstalled(true);
    window.addEventListener('appinstalled', onInstalled);
    return () => window.removeEventListener('appinstalled', onInstalled);
  }, []);

  const ios = isIosSafari();

  return {
    /** True when there is something useful to offer: a native prompt, or iOS instructions. */
    available: !installed && (canPrompt || ios),
    /** True when the banner should show unprompted (the account menu ignores this). */
    shouldNudge: !installed && !dismissed && (canPrompt || ios),
    needsIosSteps: ios && !canPrompt,
    installed,
    async install(): Promise<boolean> {
      if (!deferred) return false;
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      deferred = null;
      notify();
      return outcome === 'accepted';
    },
    dismiss() {
      setDismissed(true);
      try {
        localStorage.setItem(DISMISS_KEY, '1');
      } catch {
        /* private mode: the banner simply returns next visit */
      }
    },
  };
}
