import { useEffect, useState } from 'react';
import { CalendarDays, Inbox, Layers, MapPin } from 'lucide-react';
import { LinkCard, Chevron } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/bits';
import { EmptyState, SkeletonList } from '@/components/ui/states';
import { formatDate } from '@/lib/format';
import { OpportunityStatusBadge } from '@/components/dashboard/StatusBadge';
import { useAuth } from '@/contexts/AuthContext';
import { getPartnerOpportunities, type OpportunityWithProject } from '@/lib/api/opportunities';
import { CATEGORIES } from '@/data/catalog';

function categoryName(id: string) {
  return CATEGORIES.find((c) => c.id === id)?.name ?? id;
}

/** Presentational hint only — the status itself decides nothing here. */
function nextStep(status: string): string {
  switch (status) {
    case 'NEW':
      return 'Take a first look';
    case 'VIEWED':
      return 'Quote it or decline';
    case 'QUOTED':
      return 'See your quotation';
    case 'DECLINED':
      return 'Declined';
    default:
      return 'Open';
  }
}

export default function OpportunitiesPage() {
  const { partnerProfile } = useAuth();
  const [opportunities, setOpportunities] = useState<OpportunityWithProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!partnerProfile) return;
    getPartnerOpportunities(partnerProfile.id)
      .then(setOpportunities)
      .finally(() => setLoading(false));
  }, [partnerProfile]);

  return (
    <>
      <PageHeader title="New Opportunities" subtitle="Projects matched to your printing capabilities." />

      {loading ? (
        <SkeletonList rows={4} />
      ) : opportunities.length === 0 ? (
        <EmptyState icon={Inbox} tone="magenta" title="No opportunities yet." body="New matching projects will appear here." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {opportunities.map((o) => {
            const isNew = o.status === 'NEW';
            return (
              <LinkCard key={o.id} to={`/partner/opportunities/${o.id}`} className={isNew ? 'ring-2 ring-magenta-500' : ''}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="slug text-ink-500">
                      {isNew && (
                        <span className="relative mr-1 inline-flex h-2.5 w-2.5" aria-hidden="true">
                          <span className="absolute inset-0 animate-pulse-ring rounded-full bg-magenta-500" />
                          <span className="relative h-2.5 w-2.5 rounded-full bg-magenta-500" />
                        </span>
                      )}
                      {categoryName(o.project.category)}
                    </p>
                    <h2 className="mt-1.5 text-xl text-ink-950">{o.project.title}</h2>
                  </div>
                  <OpportunityStatusBadge status={o.status} />
                </div>
                {o.project.description && <p className="mt-2 line-clamp-2 text-ink-600">{o.project.description}</p>}
                <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-sm font-bold text-ink-700">
                  <li className="flex items-center gap-1.5">
                    <Layers className="h-4 w-4 text-ink-400" />
                    {o.project.quantity ? `${o.project.quantity} pcs` : o.project.quantity_note ?? 'Qty flexible'}
                  </li>
                  <li className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-ink-400" />
                    {o.project.delivery_city ?? 'City not specified'}
                  </li>
                  {o.project.target_date && (
                    <li className="flex items-center gap-1.5">
                      <CalendarDays className="h-4 w-4 text-ink-400" />
                      Needed by {formatDate(o.project.target_date)}
                    </li>
                  )}
                </ul>
                <div className={`mt-4 flex items-center gap-3 rounded-2xl px-3.5 py-3 ${isNew ? 'bg-magenta-50' : 'bg-ink-50'}`}>
                  <p className={`min-w-0 flex-1 text-sm font-bold ${isNew ? 'text-magenta-800' : 'text-ink-700'}`}>{nextStep(o.status)}</p>
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
