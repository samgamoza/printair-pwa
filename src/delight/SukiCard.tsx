import { Award } from 'lucide-react';
import { sukiFor } from './suki';
import { useSay } from './prefs';

/** The customer's standing, earned by delivered orders. Recognition only — see delight/suki.ts. */
export function SukiCard({ delivered }: { delivered: number }) {
  const say = useSay();
  const { tier, next, toGo, progress } = sukiFor(delivered);
  return (
    <section className="flex items-center gap-4 rounded-4xl bg-white p-4 shadow-soft ring-1 ring-ink-900/5 sm:p-5" aria-label="Your Suki status">
      <span className={`flex h-14 w-14 shrink-0 -rotate-6 items-center justify-center rounded-2xl text-ink-950 ${tier.tint}`}>
        <Award className="h-7 w-7" strokeWidth={1.9} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-display text-xl font-bold text-ink-950">{tier.label}</span>
          <span className="text-sm text-ink-500">
            {delivered} order{delivered === 1 ? '' : 's'} delivered
          </span>
        </p>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-ink-100" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
          <span className="block h-full rounded-full bg-sun-400 transition-[width] duration-700" style={{ width: `${Math.max(6, progress * 100)}%` }} />
        </div>
        <p className="mt-1.5 text-sm text-ink-600">
          {next
            ? say(`${toGo} more to become a ${next.label}.`, `${toGo} more at ${next.label} ka na!`)
            : say('Top of the list. Salamat, Super Suki!', 'Top of the list. Salamat, Super Suki!')}
        </p>
      </div>
    </section>
  );
}
