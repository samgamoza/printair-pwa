import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { SearchX, XCircle } from 'lucide-react';
import { Logo, ColorBar, InkLoader, RegistrationMark } from '@/components/ui/Marks';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/bits';
import { Banner, FormError } from '@/components/ui/states';
import {
  getBookingPayment,
  getDesignBookingPayment,
  completeMockPayment,
  type BookingPaymentRow,
  type DesignPaymentRow,
} from '@/lib/api/payments';
import { formatPHP } from '@/lib/pricing';

/**
 * Stands in for PayMongo's own hosted checkout page. Only reachable when the
 * project is deployed with PAYMONGO_MOCK=true — create-booking-checkout only
 * ever returns a /checkout/mock/... URL in that mode, and the webhook call
 * this page makes is itself rejected server-side outside mock mode (see
 * supabase/functions/paymongo-webhook/index.ts). Swapping in real PayMongo
 * keys means this page is simply never linked to again — nothing here needs
 * to change.
 */
export default function MockCheckoutPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [searchParams] = useSearchParams();
  const kind = searchParams.get('kind') === 'design' ? 'design' : 'print';
  const navigate = useNavigate();
  const [payment, setPayment] = useState<BookingPaymentRow | DesignPaymentRow | null | undefined>(undefined);
  const [busy, setBusy] = useState<'paid' | 'failed' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!orderId) return;
    setPayment(kind === 'design' ? await getDesignBookingPayment(orderId) : await getBookingPayment(orderId));
  }, [orderId, kind]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleOutcome(outcome: 'paid' | 'failed') {
    if (!orderId || !payment?.provider_checkout_id) return;
    setBusy(outcome);
    setError(null);
    try {
      await completeMockPayment(payment.provider_checkout_id, outcome, kind);
      const kindSuffix = kind === 'design' ? '&kind=design' : '';
      navigate(`/checkout/return?order=${orderId}${outcome === 'failed' ? '&cancelled=1' : ''}${kindSuffix}`, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not complete the mock payment.');
      setBusy(null);
    }
  }

  if (payment === undefined) {
    return (
      <Screen>
        <div className="flex flex-col items-center gap-4 py-16 text-ink-500">
          <InkLoader className="[&>span]:h-3.5 [&>span]:w-3.5" label="Loading checkout" />
          <p className="text-sm font-medium">Loading checkout…</p>
        </div>
      </Screen>
    );
  }

  if (!payment) {
    return (
      <Screen>
        <div className="w-full rounded-4xl bg-white px-6 py-10 text-center shadow-lift ring-1 ring-ink-900/5">
          <span className="mx-auto flex h-16 w-16 -rotate-6 items-center justify-center rounded-3xl bg-sun-200 text-ink-950">
            <SearchX className="h-8 w-8" strokeWidth={1.75} />
          </span>
          <h1 className="mt-6 text-3xl text-ink-950">Checkout not found</h1>
          <p className="mt-2 text-ink-600">This checkout session could not be found.</p>
        </div>
      </Screen>
    );
  }

  return (
    <Screen>
      <div className="w-full animate-fade-up overflow-hidden rounded-4xl bg-white shadow-lift ring-1 ring-ink-900/5">
        {/* The money moment: the amount on ink, as on the fee cards inside the app. */}
        <div className="relative overflow-hidden bg-ink-950 px-6 py-8 text-white sm:px-8">
          <span className="pointer-events-none absolute -right-6 -top-6 h-32 w-32 bg-halftone bg-dots text-white/15" aria-hidden="true" />
          <RegistrationMark className="absolute bottom-4 right-4 h-5 w-5 text-white/25" />
          <Badge tone="sun">Mock checkout — test mode</Badge>
          <p className="slug mt-6 text-white/60">You&apos;re paying</p>
          <p className="mt-2 break-words font-display text-5xl font-extrabold leading-none">{formatPHP(Number(payment.amount))}</p>
          <p className="mt-3 text-white/70">PrintAir platform fee</p>
        </div>

        <div className="space-y-5 px-5 py-6 sm:px-8 sm:py-8">
          <Banner tone="warning">
            No real payment method is charged here. This page stands in for PayMongo&apos;s hosted checkout while
            PAYMONGO_MOCK is enabled.
          </Banner>

          <FormError>{error}</FormError>

          <div className="flex flex-col gap-3">
            <Button variant="accent" size="lg" fullWidth onClick={() => handleOutcome('paid')} loading={busy === 'paid'} disabled={busy !== null}>
              Simulate successful payment
            </Button>
            <Button
              variant="secondary"
              size="lg"
              fullWidth
              onClick={() => handleOutcome('failed')}
              loading={busy === 'failed'}
              disabled={busy !== null}
              icon={<XCircle className="h-5 w-5" />}
            >
              Simulate failed payment
            </Button>
          </div>
        </div>
      </div>
    </Screen>
  );
}

/** A bare centred screen: this page is a stand-in for someone else's site, so it carries no app chrome. */
function Screen({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-paper-200 px-4 py-10">
      <span className="pointer-events-none absolute -left-10 top-10 h-56 w-56 bg-halftone-lg bg-dots-lg text-sun-300/60" aria-hidden="true" />
      <span className="pointer-events-none absolute -right-10 bottom-10 h-56 w-56 bg-halftone-lg bg-dots-lg text-magenta-300/50" aria-hidden="true" />
      <Logo className="relative" />
      <div className="relative mt-8 flex w-full max-w-md flex-col items-center">{children}</div>
      <ColorBar className="relative mt-10" />
    </div>
  );
}
