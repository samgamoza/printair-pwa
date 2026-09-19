import { Check } from 'lucide-react';
import { formatDateTime } from '@/lib/format';

export type TimelineStage = { key: string; label: string };
export type TimelineEvent = { status: string; created_at: string; note: string | null };

/**
 * Order progress. Completed stages are inked in, the current one pulses, and
 * each carries the time it happened and the note left with it.
 */
export function Timeline({ stages, currentKey, events }: { stages: TimelineStage[]; currentKey: string; events: TimelineEvent[] }) {
  const currentIdx = stages.findIndex((s) => s.key === currentKey);
  const eventByStatus = Object.fromEntries(events.map((e) => [e.status, e]));
  const inks = ['bg-sun-400', 'bg-cyan-400', 'bg-grape-400', 'bg-magenta-400', 'bg-leaf-400'];

  return (
    <ol>
      {stages.map((stage, i) => {
        const done = i <= currentIdx;
        const current = i === currentIdx;
        const last = i === stages.length - 1;
        const event = eventByStatus[stage.key];
        const ink = last ? 'bg-leaf-400' : inks[i % inks.length];
        return (
          <li key={stage.key} className="relative flex gap-4 pb-6 last:pb-0">
            {!last && (
              <span
                className={`absolute left-[15px] top-8 h-[calc(100%-2rem)] w-0.5 rounded-full ${i < currentIdx ? 'bg-ink-900' : 'bg-ink-200'}`}
                aria-hidden="true"
              />
            )}
            <span className="relative flex h-8 w-8 shrink-0 items-center justify-center">
              {current && !last && <span className={`absolute inset-0 animate-pulse-ring rounded-full ${ink}`} aria-hidden="true" />}
              <span
                className={`relative flex h-8 w-8 items-center justify-center rounded-full text-ink-950 ${
                  done ? ink : 'bg-white ring-2 ring-inset ring-ink-200'
                }`}
              >
                {done ? <Check className="h-4 w-4" strokeWidth={3} /> : <span className="text-xs font-bold text-ink-400">{i + 1}</span>}
              </span>
            </span>
            <div className="min-w-0 pt-1">
              <p className={`font-bold ${done ? 'text-ink-950' : 'text-ink-400'}`}>{stage.label}</p>
              {event && (
                <>
                  <p className="mt-0.5 text-xs font-medium text-ink-500">{formatDateTime(event.created_at)}</p>
                  {event.note && <p className="mt-2 rounded-2xl rounded-tl-md bg-ink-50 px-3.5 py-2.5 text-sm text-ink-700">{event.note}</p>}
                </>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
