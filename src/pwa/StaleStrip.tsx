import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { History, RefreshCw } from 'lucide-react';
import { clearLastSeenNotice, useLastSeen } from './lastSeen';
import { useOnline } from './useOnline';

function when(savedAt: number): string {
  const d = new Date(savedAt);
  const time = d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return `today, ${time}`;
  const yesterday = new Date(today.getTime() - 86_400_000);
  if (d.toDateString() === yesterday.toDateString()) return `yesterday, ${time}`;
  return `${d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}, ${time}`;
}

/**
 * Says so whenever something on screen came from the device's saved copy rather than the server
 * (see lastSeen.ts), and offers a refresh once the real answer has arrived. Renders nothing the rest
 * of the time.
 */
export function StaleStrip() {
  const { oldest, fresher } = useLastSeen();
  const online = useOnline();
  const { key } = useLocation();

  // A new screen starts clean. Layout effects run before the page's own effects ask for data.
  useLayoutEffect(() => {
    clearLastSeenNotice();
  }, [key]);

  if (oldest === null) return null;

  return (
    <div className="bottom-tabbar pointer-events-none fixed inset-x-0 z-[95] mb-7 flex justify-center px-4 lg:bottom-6 lg:mb-0" role="status">
      <div className="pointer-events-auto flex max-w-md animate-toast-in items-center gap-3 rounded-full bg-ink-950 py-2 pl-4 pr-2 text-sm text-white shadow-lift">
        <History className="h-4 w-4 shrink-0 text-sun-300" />
        <span className="min-w-0 leading-snug">
          {fresher ? 'Newer information is ready.' : online ? 'Weak connection. ' : ''}
          {!fresher && <>Showing what was saved {when(oldest)}.</>}
        </span>
        {fresher ? (
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full bg-white px-3.5 font-bold text-ink-950 active:scale-95"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        ) : (
          <span className="w-2" />
        )}
      </div>
    </div>
  );
}
