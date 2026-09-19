import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Clock, ImagePlus, Inbox, XCircle } from 'lucide-react';
import { Chevron } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/bits';
import { PageLoader } from '@/components/ui/states';
import { useAuth } from '@/contexts/AuthContext';
import { getDesignerOpportunities, getMyPortfolio } from '@/lib/api/designer';
import { DESIGN_SPECIALTIES } from '@/data/catalog';

/**
 * Two genuinely different pages behind one route, because a designer awaiting
 * review and an approved designer need opposite things.
 *
 * Pending: no job board to show, so the page explains what happens next and
 * points at the one thing that actually moves their application forward —
 * portfolio samples. Approved: the usual dashboard.
 */
export default function DesignerHomePage() {
  const { designerProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [newOpps, setNewOpps] = useState(0);
  const [totalOpps, setTotalOpps] = useState(0);
  const [portfolioCount, setPortfolioCount] = useState(0);

  const approved = designerProfile?.status === 'active';

  useEffect(() => {
    if (!designerProfile) return;
    (async () => {
      const [portfolio, opps] = await Promise.all([
        getMyPortfolio(designerProfile.id).catch(() => []),
        approved ? getDesignerOpportunities(designerProfile.id).catch(() => []) : Promise.resolve([]),
      ]);
      setPortfolioCount(portfolio.length);
      setTotalOpps(opps.length);
      setNewOpps(opps.filter((o) => o.status === 'NEW').length);
      setLoading(false);
    })();
  }, [designerProfile, approved]);

  if (loading) return <PageLoader label="Loading your workspace…" />;

  if (!approved) {
    return <PendingReview portfolioCount={portfolioCount} status={designerProfile?.status} />;
  }

  return (
    <>
      <PageHeader
        title={`Welcome back, ${designerProfile?.display_name?.split(' ')[0] ?? 'designer'}`}
        subtitle="Design work matched to your specialties appears on your job board."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          to="/designer/opportunities"
          className="group relative overflow-hidden rounded-4xl bg-magenta-300 p-6 transition-transform duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
        >
          <span className="pointer-events-none absolute -right-6 -top-8 h-36 w-44 bg-halftone bg-dots text-magenta-600/40" aria-hidden="true" />
          <span className="relative flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-ink-950">
              <Inbox className="h-6 w-6" />
            </span>
            <span className="slug text-ink-900">Job board</span>
          </span>
          <p className="relative mt-6 font-display text-5xl font-extrabold text-ink-950">{newOpps}</p>
          <p className="relative mt-1 font-medium text-ink-800">
            {newOpps === 1 ? 'new request' : 'new requests'}
            {totalOpps > newOpps && ` · ${totalOpps} total`}
          </p>
          <span className="relative mt-5 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-ink-950 px-5 text-[0.95rem] font-bold text-white">
            Open job board <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </span>
        </Link>

        <Link
          to="/designer/profile"
          className="group relative overflow-hidden rounded-4xl bg-grape-300 p-6 transition-transform duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
        >
          <span className="pointer-events-none absolute -right-6 -top-8 h-36 w-44 bg-halftone bg-dots text-grape-600/40" aria-hidden="true" />
          <span className="relative flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-ink-950">
              <ImagePlus className="h-6 w-6" />
            </span>
            <span className="slug text-ink-900">Portfolio</span>
          </span>
          <p className="relative mt-6 font-display text-5xl font-extrabold text-ink-950">{portfolioCount}</p>
          <p className="relative mt-1 font-medium text-ink-800">{portfolioCount === 1 ? 'sample' : 'samples'} on your public profile</p>
          <span className="relative mt-5 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-ink-950 px-5 text-[0.95rem] font-bold text-white">
            Manage profile <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </span>
        </Link>
      </div>
    </>
  );
}

function PendingReview({ portfolioCount, status }: { portfolioCount: number; status?: string }) {
  const rejected = status === 'rejected' || status === 'suspended';

  return (
    <div className="mx-auto max-w-2xl">
      <div className={`relative overflow-hidden rounded-4xl px-6 py-10 text-center sm:px-10 ${rejected ? 'bg-ink-100' : 'bg-grape-100'}`}>
        <span
          className={`pointer-events-none absolute -right-8 -top-10 h-40 w-48 bg-halftone bg-dots ${rejected ? 'text-ink-400/30' : 'text-grape-500/30'}`}
          aria-hidden="true"
        />
        <span className="relative mx-auto flex h-16 w-16 -rotate-6 items-center justify-center rounded-3xl bg-white text-ink-950">
          {rejected ? <XCircle className="h-8 w-8" strokeWidth={1.75} /> : <Clock className="h-8 w-8 text-grape-600" strokeWidth={1.75} />}
        </span>
        <h1 className="relative mt-5 text-balance text-3xl text-ink-950 sm:text-4xl">
          {rejected ? 'Your application is closed' : 'Your application is with our reviewers'}
        </h1>
        <p className="relative mx-auto mt-3 max-w-md text-ink-700">
          {rejected
            ? 'See the note at the top of the page. If you think it was decided in error, contact PrintAir support.'
            : 'Every PrintAir designer is reviewed by a person before receiving work — that is what lets us tell customers each one was vetted for print-ready output. We will email you as soon as it is decided.'}
        </p>
      </div>

      {!rejected && (
        <>
          <p className="slug mt-8 text-ink-500">While you wait</p>
          <div className="mt-3 space-y-3">
            <ChecklistRow
              done={portfolioCount >= 3}
              label={
                portfolioCount >= 3
                  ? `${portfolioCount} portfolio samples added`
                  : `Add at least 3 portfolio samples (${portfolioCount} so far)`
              }
              detail="Reviewers judge print-readiness from your work — bleed, resolution, and file format. This is the single thing most likely to decide your application."
              to="/designer/profile"
            />
            <ChecklistRow
              done={false}
              label="Fill in your rates and turnaround"
              detail="Optional, but it means you can quote faster once work starts arriving."
              to="/designer/profile"
            />
          </div>
        </>
      )}
    </div>
  );
}

function ChecklistRow({
  done,
  label,
  detail,
  to,
}: {
  done: boolean;
  label: string;
  detail: string;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="group flex items-start gap-3.5 rounded-3xl bg-white p-4 shadow-soft ring-1 ring-ink-900/5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card active:scale-[0.99] sm:p-5"
    >
      {done ? (
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-leaf-100 text-leaf-700">
          <Check className="h-6 w-6" strokeWidth={2.75} />
        </span>
      ) : (
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-grape-100 text-grape-700">
          <ImagePlus className="h-5 w-5" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className={`font-bold ${done ? 'text-ink-500 line-through' : 'text-ink-950'}`}>{label}</p>
        <p className="mt-1 text-sm leading-relaxed text-ink-600">{detail}</p>
      </div>
      <span className="mt-3 shrink-0">
        <Chevron />
      </span>
    </Link>
  );
}

/** Exported for the profile page, which shows the same specialty labels. */
// eslint-disable-next-line react-refresh/only-export-components
export function specialtyName(id: string) {
  return DESIGN_SPECIALTIES.find((s) => s.id === id)?.name ?? id;
}
