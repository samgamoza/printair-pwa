import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';

/**
 * Registers the service worker and, when a new version has finished
 * downloading, asks before switching to it. Swapping silently could reload
 * the page under someone halfway through a quote.
 */
export function UpdateToast() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // An installed app can stay open for days; look for a new version hourly.
      if (registration) window.setInterval(() => void registration.update(), 60 * 60 * 1000);
    },
  });

  if (!needRefresh) return null;

  return (
    <div className="fixed inset-x-0 z-[110] flex justify-center px-4 bottom-[calc(var(--sab)+5.75rem)] lg:bottom-6" role="status">
      <div className="flex w-full max-w-md animate-toast-in items-center gap-3 rounded-3xl bg-ink-950 p-3 pl-5 text-white shadow-lift">
        <p className="min-w-0 flex-1 font-bold">A new version of PrintAir is ready.</p>
        <button
          type="button"
          onClick={() => void updateServiceWorker(true)}
          className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full bg-sun-400 px-4 text-sm font-extrabold text-ink-950 active:scale-95"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
        <button
          type="button"
          aria-label="Later"
          onClick={() => setNeedRefresh(false)}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/60 hover:bg-white/10"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
