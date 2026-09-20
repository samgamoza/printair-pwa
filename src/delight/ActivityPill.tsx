import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { ago, describe, getActivity, type ActivityEvent } from './activity';
import { Pip } from './Mascot';

/**
 * One small, silent line about something real that just happened on PrintAir, then it goes away.
 *
 * Deliberately restrained: it waits before the first one, shows each for a few seconds, leaves long
 * gaps, stops after a handful, and stops for good (this visit) the moment someone closes it.
 * It makes no sound and is not announced to screen readers: it is ambience, not news for you.
 */
const FIRST_AFTER_MS = 6_000;
const SHOW_FOR_MS = 6_500;
const GAP_MS = 45_000;
const MAX_PER_VISIT = 4;
const CLOSED_KEY = 'printair.activity.closed';
/** Shared across screens, so moving from page to page never repeats one or resets the limit. */
const alreadyShown = new Set<string>();

export function ActivityPill({ inShell = false }: { inShell?: boolean }) {
  const [event, setEvent] = useState<ActivityEvent | null>(null);
  const [shown, setShown] = useState(false);
  const closed = useRef(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(CLOSED_KEY)) return;
    } catch {
      /* private window: carry on */
    }
    let timers: number[] = [];
    let live = true;
    const later = (fn: () => void, ms: number) => timers.push(window.setTimeout(fn, ms));

    void getActivity().then(({ events }) => {
      if (!live || !events.length) return;
      const queue = events.filter((e) => !alreadyShown.has(e.id));
      const next = (i: number) => {
        if (!live || closed.current || i >= queue.length || alreadyShown.size >= MAX_PER_VISIT) return;
        // Someone reading another tab gets nothing piled up for their return.
        if (document.hidden) return later(() => next(i), GAP_MS);
        alreadyShown.add(queue[i].id);
        setEvent(queue[i]);
        setShown(true);
        later(() => setShown(false), SHOW_FOR_MS);
        later(() => next(i + 1), SHOW_FOR_MS + GAP_MS);
      };
      later(() => next(0), FIRST_AFTER_MS);
    });

    return () => {
      live = false;
      timers.forEach(clearTimeout);
      timers = [];
    };
  }, []);

  if (!event) return null;

  function close() {
    closed.current = true;
    setShown(false);
    try {
      sessionStorage.setItem(CLOSED_KEY, '1');
    } catch {
      /* fine */
    }
  }

  return (
    <div
      aria-hidden={!shown}
      className={`pointer-events-none fixed inset-x-0 top-[calc(var(--sat)+4.75rem)] z-[45] flex justify-center px-4 transition-all duration-500 motion-reduce:transition-none lg:inset-x-auto lg:bottom-6 lg:top-auto lg:justify-start lg:px-0 ${
        inShell ? 'lg:left-[19.5rem]' : 'lg:left-6'
      } ${shown ? 'translate-y-0 opacity-100' : '-translate-y-3 opacity-0 lg:translate-y-3'}`}
    >
      <div className={`flex max-w-sm items-center gap-2.5 rounded-full bg-white py-1.5 pl-2 pr-1.5 shadow-lift ring-1 ring-ink-900/10 ${shown ? 'pointer-events-auto' : ''}`}>
        <Pip mood="fly" className="h-9 w-9 shrink-0" />
        <p className="min-w-0 text-sm leading-snug text-ink-900">
          <span className="font-bold">{describe(event)}</span> <span className="whitespace-nowrap text-ink-500">· {ago(event.at)}</span>
        </p>
        <button
          type="button"
          onClick={close}
          tabIndex={shown ? 0 : -1}
          aria-label="Hide activity updates"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-500 hover:bg-ink-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
