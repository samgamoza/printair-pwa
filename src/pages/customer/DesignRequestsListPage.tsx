import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Palette, Plus, Wallet } from 'lucide-react';
import { DesignRequestStatusBadge } from '@/components/dashboard/StatusBadge';
import { Button } from '@/components/ui/Button';
import { LinkCard, Chevron } from '@/components/ui/Card';
import { FilterTabs, PageHeader } from '@/components/ui/bits';
import { EmptyState, ErrorState, SkeletonList } from '@/components/ui/states';
import { useAuth } from '@/contexts/AuthContext';
import { getCustomerDesignRequests, type DesignRequestRow } from '@/lib/api/designRequests';
import { getRequestProposals } from '@/lib/api/designProposals';
import { DESIGN_SPECIALTIES } from '@/data/catalog';
import { formatDate, peso } from '@/lib/format';
import { useCreate } from './createContext';

const FILTERS: { key: string; label: string; statuses: string[] }[] = [
  { key: 'all', label: 'All', statuses: [] },
  { key: 'draft', label: 'Draft', statuses: ['DRAFT'] },
  { key: 'open', label: 'Open for Proposals', statuses: ['OPEN_FOR_PROPOSALS'] },
  { key: 'active', label: 'Active', statuses: ['DESIGNER_SELECTED', 'IN_PROGRESS'] },
  { key: 'completed', label: 'Completed', statuses: ['DELIVERED'] },
];

/** Statuses where the ball is in the customer's court, so the card is flagged. */
const NEEDS_YOU = new Set(['DRAFT', 'IN_PROGRESS', 'DELIVERED']);

function specialtyName(id: string) {
  return DESIGN_SPECIALTIES.find((s) => s.id === id)?.name ?? id;
}

function nextAction(request: DesignRequestRow, proposalCount: number): string {
  switch (request.status) {
    case 'DRAFT':
      return 'Finish and post your request';
    case 'OPEN_FOR_PROPOSALS':
      return proposalCount > 0 ? `Compare ${proposalCount} proposal${proposalCount === 1 ? '' : 's'}` : "We're matching you with designers";
    case 'DESIGNER_SELECTED':
      return 'Waiting for your designer to start';
    case 'IN_PROGRESS':
      return 'Review the latest revision';
    case 'DELIVERED':
      return 'Leave a review';
    case 'CANCELLED':
      return 'Cancelled';
    default:
      return '';
  }
}

/** "₱3,000 – ₱8,000", or just the end that was given. Null when no budget was set. */
function budgetLabel(request: DesignRequestRow): string | null {
  if (!request.budget_min && !request.budget_max) return null;
  if (request.budget_min && request.budget_max) return `${peso(request.budget_min)} – ${peso(request.budget_max)}`;
  return request.budget_min ? `From ${peso(request.budget_min)}` : `Up to ${peso(request.budget_max)}`;
}

export default function DesignRequestsListPage() {
  const { profile } = useAuth();
  const { startDesign, version } = useCreate();
  const [searchParams, setSearchParams] = useSearchParams();
  const filterKey = searchParams.get('filter') ?? 'all';
  const [requests, setRequests] = useState<DesignRequestRow[]>([]);
  const [proposalCounts, setProposalCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      const list = await getCustomerDesignRequests(profile.id);
      setRequests(list);
      const openRequests = list.filter((r) => r.status === 'OPEN_FOR_PROPOSALS');
      const counts: Record<string, number> = {};
      await Promise.all(
        openRequests.map(async (r) => {
          // A per-row count failing must not lose the whole list.
          const proposals = await getRequestProposals(r.id).catch(() => []);
          counts[r.id] = proposals.filter((p) => p.status === 'SUBMITTED').length;
        }),
      );
      setProposalCounts(counts);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your design requests.');
    } finally {
      // Always clears: without this a thrown fetch left the page spinning forever.
      setLoading(false);
    }
  }, [profile]);

  // `version` bumps when the design request builder closes, so a new or saved request shows up at once.
  useEffect(() => {
    load();
  }, [load, version]);

  const filter = FILTERS.find((f) => f.key === filterKey) ?? FILTERS[0];
  const filtered = filter.statuses.length ? requests.filter((r) => filter.statuses.includes(r.status)) : requests;

  return (
    <>
      <PageHeader
        title="My Designs"
        subtitle="Commission vetted designers and flow the result straight into a print project."
        action={
          <Button variant="accent" icon={<Plus className="h-5 w-5" strokeWidth={2.75} />} onClick={() => startDesign()} className="hidden lg:inline-flex">
            New design request
          </Button>
        }
      />

      <FilterTabs
        value={filter.key}
        onChange={(key) => setSearchParams(key === 'all' ? {} : { filter: key })}
        tabs={FILTERS.map((f) => ({
          key: f.key,
          label: f.label,
          count: f.statuses.length ? requests.filter((r) => f.statuses.includes(r.status)).length : undefined,
        }))}
      />

      <div className="mt-5">
        {loading ? (
          <SkeletonList rows={4} />
        ) : error ? (
          <ErrorState title="Couldn't load your design requests" message={error} onRetry={load} />
        ) : filtered.length === 0 ? (
          requests.length === 0 ? (
            <EmptyState pip
              icon={Palette}
              tone="magenta"
              title="No design requests yet"
              body="No artwork? Commission a vetted designer and the finished file flows straight into a print project."
              action={
                <Button variant="accent" size="lg" onClick={() => startDesign()} icon={<Plus className="h-5 w-5" strokeWidth={2.75} />}>
                  Commission a designer
                </Button>
              }
            />
          ) : (
            <EmptyState icon={Palette} tone="grape" title={`Nothing under "${filter.label}"`} body="Try another filter to see the rest of your design requests." />
          )
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {filtered.map((r) => {
              const proposals = proposalCounts[r.id] ?? 0;
              const flagged = NEEDS_YOU.has(r.status) || proposals > 0;
              const budget = budgetLabel(r);
              return (
                <LinkCard key={r.id} to={`/dashboard/designs/${r.id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="slug text-grape-600">{specialtyName(r.specialty)}</p>
                      <h2 className="mt-1.5 truncate text-xl text-ink-950">{r.title}</h2>
                    </div>
                    <DesignRequestStatusBadge status={r.status} />
                  </div>
                  {budget && (
                    <p className="mt-3 flex items-center gap-1.5 text-sm font-bold text-ink-700">
                      <Wallet className="h-4 w-4 shrink-0 text-grape-500" aria-hidden="true" />
                      <span className="sr-only">Budget: </span>
                      {budget}
                    </p>
                  )}
                  <div className={`mt-4 flex items-center gap-3 rounded-2xl px-3.5 py-3 ${flagged ? 'bg-magenta-100' : 'bg-ink-50'}`}>
                    <p className={`min-w-0 flex-1 text-sm font-bold ${flagged ? 'text-magenta-900' : 'text-ink-700'}`}>{nextAction(r, proposals)}</p>
                    <Chevron />
                  </div>
                  <p className="mt-3 text-xs font-medium text-ink-400">Updated {formatDate(r.updated_at)}</p>
                </LinkCard>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
