import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';

/**
 * A horizontal row of cards that scrolls sideways.
 *
 * Phones swipe it. Anything with a mouse has no way to swipe, and the scrollbar is
 * hidden on purpose, so from `sm` up the header carries previous / next buttons.
 * They move a screenful of whole cards at a time and switch themselves off at each
 * end. A soft fade on whichever side still has cards makes a clipped card read as
 * "more this way" rather than as a layout mistake.
 */
export function Rail({
  header,
  children,
  label,
  className = '',
}: {
  /** Left side of the header row: the slug and heading. */
  header: ReactNode;
  children: ReactNode;
  /** What the row holds, for screen readers: "Customer stories". */
  label: string;
  className?: string;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', measure);
      ro.disconnect();
    };
  }, [measure]);

  const page = (dir: 1 | -1) => {
    const el = scroller.current;
    if (!el) return;
    const first = el.firstElementChild as HTMLElement | null;
    const gap = parseFloat(getComputedStyle(el).columnGap || '0') || 0;
    const step = first ? first.offsetWidth + gap : el.clientWidth;
    const padding = parseFloat(getComputedStyle(el).paddingLeft || '0') * 2;
    const perPage = Math.max(1, Math.floor((el.clientWidth - padding + gap) / step));
    el.scrollBy({ left: dir * step * perPage, behavior: 'smooth' });
  };

  const arrow =
    'flex h-12 w-12 items-center justify-center rounded-full border-2 border-ink-950 bg-white text-ink-950 transition hover:bg-ink-950 hover:text-white active:scale-95 disabled:cursor-default disabled:border-ink-200 disabled:bg-transparent disabled:text-ink-300';

  return (
    <div className={className}>
      <div className="mx-auto flex max-w-6xl items-end justify-between gap-4 px-5 sm:px-8">
        <div>{header}</div>
        {(canLeft || canRight) && (
          <div className="hidden shrink-0 gap-2 sm:flex">
            <button type="button" className={arrow} onClick={() => page(-1)} disabled={!canLeft} aria-label={`Previous ${label}`}>
              <ArrowLeft className="h-5 w-5" strokeWidth={2.5} />
            </button>
            <button type="button" className={arrow} onClick={() => page(1)} disabled={!canRight} aria-label={`More ${label}`}>
              <ArrowRight className="h-5 w-5" strokeWidth={2.5} />
            </button>
          </div>
        )}
      </div>

      <div className="relative mt-8 lg:mx-auto lg:max-w-6xl">
        <div
          ref={scroller}
          role="group"
          aria-label={label}
          tabIndex={0}
          className="no-scrollbar flex snap-x snap-mandatory scroll-px-5 gap-4 overflow-x-auto px-5 pb-4 sm:scroll-px-8 sm:px-8"
        >
          {children}
        </div>
        <span
          className={`pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-paper-200 to-transparent transition-opacity duration-200 sm:w-10 ${canLeft ? 'opacity-100' : 'opacity-0'}`}
          aria-hidden="true"
        />
        <span
          className={`pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-paper-200 to-transparent transition-opacity duration-200 sm:w-10 ${canRight ? 'opacity-100' : 'opacity-0'}`}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
