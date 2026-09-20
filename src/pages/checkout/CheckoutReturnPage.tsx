import { celebrate } from '@/delight/effects';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, SearchX, X } from 'lucide-react';
import { Logo, ColorBar, InkLoader } from '@/components/ui/Marks';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/api/client';
import { getBookingPayment, getDesignBookingPayment } from '@/lib/api/payments';

type Outcome = 'checking' | 'paid' | 'not-paid' | 'not-found';

const POLL_ATTEMPTS = 6;
const POLL_INTERVAL_MS = 1500;

/**
 * Where PayMongo (or the mock checkout page) redirects the browser back to
 * after a checkout attempt. A real webhook delivery can lag slightly behind
 * the browser redirect, so this briefly polls booking_payments rather than
 * trusting the redirect alone to mean "paid".
 */
export default function CheckoutReturnPage() {
  const [params] = useSearchParams();
  const orderId = params.get('order');
  const cancelled = params.get('cancelled') === '1';
  const kind = params.get('kind') === 'design' ? 'design' : 'print';
  const [outcome, setOutcome] = useState<Outcome>('checking');
  const [linkedId, setLinkedId] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) {
      setOutcome('not-found');
      return;
    }
    const id = orderId;
    let cancelledEffect = false;

    async function poll() {
      if (kind === 'design') {
        const { data: order } = await supabase.from('design_orders').select('request_id').eq('id', id).maybeSingle();
        if (order) setLinkedId(order.request_id);
      } else {
        const { data: order } = await supabase.from('orders').select('project_id').eq('id', id).maybeSingle();
        if (order) setLinkedId(order.project_id);
      }

      if (cancelled) {
        setOutcome('not-paid');
        return;
      }

      for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt++) {
        if (cancelledEffect) return;
        const payment = kind === 'design' ? await getDesignBookingPayment(id) : await getBookingPayment(id);
        if (payment?.status === 'paid') {
          setOutcome('paid');
          celebrate();
          return;
        }
        if (payment?.status === 'failed' || payment?.status === 'expired') {
          setOutcome('not-paid');
          return;
        }
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      }
      // Still pending after polling — not necessarily failed, the webhook may
      // just be slow. Let the customer head back rather than hang here.
      setOutcome('not-paid');
    }

    poll();
    return () => {
      cancelledEffect = true;
    };
  }, [orderId, cancelled, kind]);

  const backHref = linkedId ? (kind === 'design' ? `/dashboard/designs/${linkedId}` : `/dashboard/projects/${linkedId}`) : '/dashboard';

  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-paper-200 px-4 py-10">
      <span className="pointer-events-none absolute -left-10 top-10 h-56 w-56 bg-halftone-lg bg-dots-lg text-cyan-300/50" aria-hidden="true" />
      <span className="pointer-events-none absolute -right-10 bottom-10 h-56 w-56 bg-halftone-lg bg-dots-lg text-leaf-300/60" aria-hidden="true" />

      <Logo className="relative" />

      <div className="relative mt-8 w-full max-w-md rounded-4xl bg-white px-6 py-10 text-center shadow-lift ring-1 ring-ink-900/5 sm:px-8 sm:py-12">
        {outcome === 'checking' && (
          <div className="animate-fade-in" aria-live="polite">
            <div className="flex h-20 items-center justify-center">
              <InkLoader className="[&>span]:h-4 [&>span]:w-4" label="Confirming your payment" />
            </div>
            <h1 className="mt-6 text-3xl text-ink-950">Confirming your payment…</h1>
            <p className="mt-2 text-ink-600">This only takes a moment.</p>
          </div>
        )}

        {outcome === 'paid' && (
          <div className="animate-fade-up">
            <span className="relative mx-auto flex h-20 w-20 items-center justify-center">
              <span className="absolute inset-0 animate-pulse-ring rounded-full bg-leaf-300" aria-hidden="true" />
              <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-leaf-400 text-ink-950">
                <Check className="h-9 w-9" strokeWidth={3} />
              </span>
            </span>
            <h1 className="mt-6 text-3xl text-ink-950">Platform fee received</h1>
            <p className="mt-2 text-ink-600">
              {kind === 'design'
                ? 'Your commission is confirmed. The designer has been notified.'
                : 'Your order is confirmed. The printing partner has been notified.'}
            </p>
            <Button variant="primary" size="lg" fullWidth className="mt-7" onClick={() => (window.location.href = backHref)}>
              {kind === 'design' ? 'Go to my design request' : 'Go to my project'}
            </Button>
          </div>
        )}

        {outcome === 'not-paid' && (
          <div className="animate-fade-up">
            <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-danger-100 text-danger-600">
              <X className="h-9 w-9" strokeWidth={3} />
            </span>
            <h1 className="mt-6 text-3xl text-ink-950">{cancelled ? 'Payment cancelled' : 'Payment not completed'}</h1>
            <p className="mt-2 text-ink-600">No charge was made. You can try again from the same page.</p>
            <Button variant="primary" size="lg" fullWidth className="mt-7" onClick={() => (window.location.href = backHref)}>
              {kind === 'design' ? 'Back to my design request' : 'Back to my project'}
            </Button>
          </div>
        )}

        {outcome === 'not-found' && (
          <div className="animate-fade-up">
            <span className="mx-auto flex h-16 w-16 -rotate-6 items-center justify-center rounded-3xl bg-sun-200 text-ink-950">
              <SearchX className="h-8 w-8" strokeWidth={1.75} />
            </span>
            <h1 className="mt-6 text-3xl text-ink-950">Something went wrong</h1>
            <p className="mt-2 text-ink-600">We couldn&apos;t find that checkout session.</p>
            <Link
              to="/dashboard"
              className="mt-5 inline-flex min-h-11 items-center rounded-full px-4 font-bold text-magenta-700 transition-colors hover:bg-magenta-50 active:scale-95"
            >
              Back to my projects
            </Link>
          </div>
        )}
      </div>

      <ColorBar className="relative mt-10" />
    </div>
  );
}
