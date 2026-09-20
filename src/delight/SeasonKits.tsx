import { ArrowRight, CalendarClock } from 'lucide-react';
import { activeKits } from './seasons';
import { useSay } from './prefs';

/**
 * "In season now": the busy printing dates coming up, each with how long is left to order in time.
 * Renders nothing when no season's window is open, so it never shows a stale or empty shelf.
 */
export function SeasonKits({ onPick, compact = false }: { onPick: (categoryId: string) => void; compact?: boolean }) {
  const say = useSay();
  const kits = activeKits().slice(0, compact ? 2 : 3);
  if (!kits.length) return null;

  return (
    <section aria-label="In season now">
      <p className="slug text-ink-500">
        <CalendarClock className="h-3.5 w-3.5" /> {say('In season now', 'In season now, mga ka-negosyo')}
      </p>
      {!compact && (
        <h2 className="mt-2 text-3xl text-ink-950 sm:text-4xl">
          Print ahead of the rush
        </h2>
      )}
      <div className={`mt-4 grid gap-3 ${compact ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
        {kits.map((kit) => {
          const urgent = kit.daysLeft <= 14;
          const left = kit.daysLeft === 0 ? 'Last day to order' : `${kit.daysLeft} day${kit.daysLeft === 1 ? '' : 's'} left to order`;
          // On a dashboard the person's own projects come first, so a kit is one slim row there.
          if (compact)
            return (
              <button
                key={kit.id}
                type="button"
                onClick={() => onPick(kit.categoryId)}
                className={`group flex min-h-16 items-center gap-3 rounded-3xl px-4 py-3 text-left text-ink-950 transition-transform active:scale-[0.98] ${kit.tint}`}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-xl" aria-hidden="true">
                  {kit.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-base font-bold leading-tight">{say(kit.name, kit.taglish)}</span>
                  <span className="block text-sm text-ink-700">{left}</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-1" />
              </button>
            );
          return (
            <button
              key={kit.id}
              type="button"
              data-option
              onClick={() => onPick(kit.categoryId)}
              className={`group relative flex flex-col overflow-hidden rounded-4xl p-5 text-left text-ink-950 transition-transform duration-200 hover:-translate-y-1 active:scale-[0.98] ${kit.tint}`}
            >
              <span className="flex items-center justify-between gap-3">
                <span data-option-icon className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-2xl" aria-hidden="true">
                  {kit.emoji}
                </span>
                <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${urgent ? 'bg-ink-950 text-white' : 'bg-white text-ink-950'}`}>
                  {left}
                </span>
              </span>
              <span className="mt-4 font-display text-xl font-bold leading-tight">{say(kit.name, kit.taglish)}</span>
              <span data-option-sub className="mt-1 text-sm text-ink-700">
                {kit.blurb}
              </span>
              <span className="mt-4 flex items-center gap-1 text-sm font-bold">
                Order by {kit.orderByDate.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })} to arrive on time
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
