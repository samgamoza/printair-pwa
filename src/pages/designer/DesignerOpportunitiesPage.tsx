import { useEffect, useState } from 'react';
import { CalendarDays, Inbox, Lock, Wallet } from 'lucide-react';
import { DesignOpportunityStatusBadge } from '@/components/dashboard/StatusBadge';
import { LinkCard, Chevron } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/bits';
import { EmptyState, SkeletonList } from '@/components/ui/states';
import { useAuth } from '@/contexts/AuthContext';
import { getDesignerOpportunities, type DesignOpportunityWithRequest } from '@/lib/api/designer';
import { DESIGN_SPECIALTIES } from '@/data/catalog';

function specialtyName(id: string) {
  return DESIGN_SPECIALTIES.find((s) => s.id === id)?.name ?? id;
}

function budgetLabel(min: number | null, max: number | null) {
  const peso = (n: number) => `₱${n.toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;
  if (min && max) return `${peso(min)}–${peso(max)}`;
  if (min) return `From ${peso(min)}`;
  if (max) return `Up to ${peso(max)}`;
  return 'Budget flexible';
}

export default function DesignerOpportunitiesPage() {
  const { designerProfile } = useAuth();
  const [opportunities, setOpportunities] = useState<DesignOpportunityWithRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const approved = designerProfile?.status === 'active';

  useEffect(() => {
    if (!designerProfile || !approved) {
      setLoading(false);
      return;
    }
    getDesignerOpportunities(designerProfile.id)
      .then(setOpportunities)
      .catch(() => setOpportunities([]))
      .finally(() => setLoading(false));
  }, [designerProfile, approved]);

  return (
    <>
      <PageHeader title="Job Board" subtitle="Design requests matched to your specialties." />

      {loading ? (
        <SkeletonList rows={4} />
      ) : !approved ? (
        // An empty board would read as "nobody wants you". Say what is
        // actually true: there is nothing here yet because the account has
        // not been approved, so no work is being routed to it.
        <EmptyState
          icon={Lock}
          tone="grape"
          title="Your job board is locked"
          body="Your job board opens once your application is approved. No work is being routed to your account yet."
        />
      ) : opportunities.length === 0 ? (
        <EmptyState
          icon={Inbox}
          tone="magenta"
          title="No design requests yet"
          body="No design requests yet. New work matching your specialties will appear here."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {opportunities.map((o) => {
            const isNew = o.status === 'NEW';
            return (
              <LinkCard key={o.id} to={`/designer/opportunities/${o.id}`} className={isNew ? 'ring-2 ring-magenta-300' : ''}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="slug text-grape-600">
                      {isNew && <span className="h-2 w-2 rounded-full bg-magenta-500" aria-hidden="true" />}
                      {specialtyName(o.request.specialty)}
                    </p>
                    <h2 className="mt-1.5 line-clamp-2 text-xl text-ink-950">{o.request.title}</h2>
                  </div>
                  {/* The badge reads "New" until the brief has been opened. */}
                  <DesignOpportunityStatusBadge status={o.status} />
                </div>
                {o.request.description && <p className="mt-2.5 line-clamp-2 text-ink-600">{o.request.description}</p>}
                <div className={`mt-4 flex items-center gap-3 rounded-2xl px-3.5 py-3 ${isNew ? 'bg-magenta-50' : 'bg-ink-50'}`}>
                  <div className="min-w-0 flex-1 space-y-1 text-sm font-bold text-ink-800">
                    <p className="flex items-center gap-2">
                      <Wallet className="h-4 w-4 shrink-0 text-ink-400" />
                      {budgetLabel(o.request.budget_min, o.request.budget_max)}
                    </p>
                    {o.request.target_date && (
                      <p className="flex items-center gap-2 font-medium text-ink-600">
                        <CalendarDays className="h-4 w-4 shrink-0 text-ink-400" />
                        needed by {new Date(o.request.target_date).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <Chevron />
                </div>
              </LinkCard>
            );
          })}
        </div>
      )}
    </>
  );
}
