import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Inbox, FileText, Package, PackageOpen, ArrowRight, type LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { PageHeader, Stars } from '@/components/ui/bits';
import { PageLoader } from '@/components/ui/states';
import { useAuth } from '@/contexts/AuthContext';
import { getPartnerOpportunities } from '@/lib/api/opportunities';
import { getPartnerQuotes } from '@/lib/api/quotes';
import { getPartnerOrders } from '@/lib/api/orders';
import { getProviderReviews, type ReviewRow } from '@/lib/api/reviews';

export default function PartnerHomePage() {
  const { partnerProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [newOpps, setNewOpps] = useState(0);
  const [awaitingDecision, setAwaitingDecision] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [readyToUpdate, setReadyToUpdate] = useState(0);
  const [recentReviews, setRecentReviews] = useState<ReviewRow[]>([]);

  useEffect(() => {
    if (!partnerProfile) return;
    (async () => {
      const [opps, quotes, orders, reviews] = await Promise.all([
        getPartnerOpportunities(partnerProfile.id),
        getPartnerQuotes(partnerProfile.id),
        getPartnerOrders(partnerProfile.id),
        getProviderReviews(partnerProfile.id),
      ]);
      setNewOpps(opps.filter((o) => o.status === 'NEW').length);
      setAwaitingDecision(quotes.filter((q) => q.status === 'SUBMITTED').length);
      setActiveCount(orders.filter((o) => o.status !== 'DELIVERED').length);
      setReadyToUpdate(orders.filter((o) => o.status === 'CONFIRMED' || o.status === 'IN_PRODUCTION').length);
      setRecentReviews(reviews.slice(0, 3));
      setLoading(false);
    })();
  }, [partnerProfile]);

  if (loading) return <PageLoader label="Loading your dashboard…" />;

  return (
    <>
      <PageHeader title="What should I work on next?" subtitle={<>Welcome back, {partnerProfile?.business_name}.</>} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <ActionCard
          icon={Inbox}
          count={newOpps}
          title="New opportunities"
          body="Matching projects waiting for your first look."
          to="/partner/opportunities"
          tone="sun"
        />
        <ActionCard
          icon={FileText}
          count={awaitingDecision}
          title="Quotations awaiting decision"
          body="Sent to customers, waiting on their choice."
          to="/partner/quotes"
          tone="cyan"
        />
        <ActionCard
          icon={PackageOpen}
          count={readyToUpdate}
          title="Projects ready for a status update"
          body="Move these forward so customers see progress."
          to="/partner/projects"
          tone="magenta"
        />
        <ActionCard
          icon={Package}
          count={activeCount}
          title="Active projects"
          body="Everything currently in motion."
          to="/partner/projects"
          tone="grape"
        />
      </div>

      <section className="mt-10">
        <h2 className="text-2xl text-ink-950">Recent reviews</h2>
        {recentReviews.length === 0 ? (
          <p className="mt-2 text-ink-600">No reviews yet — they&apos;ll appear here once projects are delivered.</p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recentReviews.map((r) => (
              <Card key={r.id}>
                <Stars rating={r.rating} className="h-5 w-5" />
                {r.comment && <p className="mt-3 text-ink-700">{r.comment}</p>}
              </Card>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

type TileTone = 'sun' | 'cyan' | 'magenta' | 'grape';

const TILE: Record<TileTone, { bg: string; dots: string }> = {
  sun: { bg: 'bg-sun-300', dots: 'text-sun-600/40' },
  cyan: { bg: 'bg-cyan-300', dots: 'text-cyan-600/40' },
  magenta: { bg: 'bg-magenta-300', dots: 'text-magenta-600/40' },
  grape: { bg: 'bg-grape-300', dots: 'text-grape-600/40' },
};

function ActionCard({
  icon: Icon,
  count,
  title,
  body,
  to,
  tone,
}: {
  icon: LucideIcon;
  count: number;
  title: string;
  body: string;
  to: string;
  tone: TileTone;
}) {
  const t = TILE[tone];
  return (
    <Link
      to={to}
      className={`group relative flex min-h-[11.5rem] flex-col overflow-hidden rounded-4xl p-4 text-ink-950 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card active:scale-[0.98] sm:p-6 ${t.bg}`}
    >
      <span className={`pointer-events-none absolute -right-6 -top-8 h-32 w-40 bg-halftone bg-dots ${t.dots}`} aria-hidden="true" />
      <span className="relative flex items-start justify-between gap-2">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white">
          <Icon className="h-5 w-5" />
        </span>
        <ArrowRight className="mt-1 h-5 w-5 shrink-0 transition-transform group-hover:translate-x-1" />
      </span>
      <span className="relative mt-auto block pt-4 font-display text-5xl font-extrabold leading-none tracking-tight">{count}</span>
      <span className="relative mt-2 block font-bold leading-snug">{title}</span>
      <span className="relative mt-1 block text-sm font-medium text-ink-800">{body}</span>
    </Link>
  );
}
