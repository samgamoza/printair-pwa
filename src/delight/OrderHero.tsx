import { Pip, type PipMood } from './Mascot';
import { ORDER_STAGES, type OrderStage } from './checks';

/**
 * The order's progress told the way a delivery app tells it: one friendly sentence and a bar that
 * fills. It restates the order's real status and nothing more — the detailed timeline, with its
 * dates, stays on the page as the record.
 */
const STAGES = ORDER_STAGES;
type Stage = OrderStage;

const LABELS: Record<Stage, string> = { CONFIRMED: 'Confirmed', IN_PRODUCTION: 'Printing', READY: 'Ready', DELIVERED: 'Delivered' };
const MOODS: Record<Stage, PipMood> = { CONFIRMED: 'fly', IN_PRODUCTION: 'carry', READY: 'carry', DELIVERED: 'cheer' };

export function OrderHero({ status, what, partner }: { status: Stage; what: string; partner: string }) {
  const at = STAGES.indexOf(status);
  const line: Record<Stage, string> = {
    CONFIRMED: `${partner} has your order. Production starts soon.`,
    IN_PRODUCTION: `${partner} is printing your ${what} right now.`,
    READY: `Your ${what} is ready. ${partner} will arrange pickup or delivery with you.`,
    DELIVERED: `Delivered! Enjoy your ${what}.`,
  };

  return (
    <section className="relative overflow-hidden rounded-4xl bg-white p-5 shadow-soft ring-1 ring-ink-900/5 sm:p-6" aria-label="Order progress">
      <div className="flex items-center gap-3">
        <Pip mood={MOODS[status]} className="h-20 w-20 shrink-0" />
        <p className="font-display text-xl font-bold leading-snug text-ink-950 sm:text-2xl">{line[status]}</p>
      </div>
      <ol className="mt-5 grid grid-cols-4 gap-1.5">
        {STAGES.map((s, i) => (
          <li key={s}>
            <span className="relative block h-2.5 overflow-hidden rounded-full bg-ink-100">
              <span className={`absolute inset-0 origin-left rounded-full bg-leaf-400 transition-transform duration-700 ${i <= at ? 'scale-x-100' : 'scale-x-0'}`} />
              {i === at && status !== 'DELIVERED' && <span className="skeleton absolute inset-0 !bg-transparent opacity-70" />}
            </span>
            <span className={`mt-1.5 block text-xs font-bold ${i <= at ? 'text-ink-950' : 'text-ink-400'}`}>{LABELS[s]}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
