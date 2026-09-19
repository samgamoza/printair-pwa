import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ClipboardList, Plus } from 'lucide-react';
import { ProjectStatusBadge } from '@/components/dashboard/StatusBadge';
import { Button } from '@/components/ui/Button';
import { LinkCard, Chevron } from '@/components/ui/Card';
import { FilterTabs, PageHeader } from '@/components/ui/bits';
import { EmptyState, ErrorState, SkeletonList } from '@/components/ui/states';
import { useAuth } from '@/contexts/AuthContext';
import { getCustomerProjects, type ProjectRow } from '@/lib/api/projects';
import { getProjectQuotes } from '@/lib/api/quotes';
import { CATEGORIES } from '@/data/catalog';
import { formatDate } from '@/lib/format';
import { useCreate } from './createContext';

const FILTERS: { key: string; label: string; statuses: string[] }[] = [
  { key: 'all', label: 'All', statuses: [] },
  { key: 'draft', label: 'Draft', statuses: ['DRAFT'] },
  { key: 'open', label: 'Open for Quotes', statuses: ['OPEN_FOR_QUOTES'] },
  { key: 'active', label: 'Active', statuses: ['PROVIDER_SELECTED', 'IN_PROGRESS', 'READY'] },
  { key: 'completed', label: 'Completed', statuses: ['DELIVERED'] },
];

/** Statuses where the ball is in the customer's court, so the card is flagged. */
const NEEDS_YOU = new Set(['DRAFT', 'READY', 'DELIVERED']);

function categoryName(id: string) {
  return CATEGORIES.find((c) => c.id === id)?.name ?? id;
}

function nextAction(project: ProjectRow, quoteCount: number): string {
  switch (project.status) {
    case 'DRAFT':
      return 'Finish and submit your project';
    case 'OPEN_FOR_QUOTES':
      return quoteCount > 0 ? `Compare ${quoteCount} quotation${quoteCount === 1 ? '' : 's'}` : "We're looking for the right printing partner";
    case 'PROVIDER_SELECTED':
      return 'Waiting for your printing partner to start production';
    case 'IN_PROGRESS':
      return 'In production';
    case 'READY':
      return 'Ready — arrange delivery or pickup';
    case 'DELIVERED':
      return 'Leave a review';
    case 'CANCELLED':
      return 'Cancelled';
    default:
      return '';
  }
}

export default function ProjectsListPage() {
  const { profile } = useAuth();
  const { startProject, version } = useCreate();
  const [searchParams, setSearchParams] = useSearchParams();
  const filterKey = searchParams.get('filter') ?? 'all';
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [quoteCounts, setQuoteCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      const list = await getCustomerProjects(profile.id);
      setProjects(list);
      const openProjects = list.filter((p) => p.status === 'OPEN_FOR_QUOTES');
      const counts: Record<string, number> = {};
      await Promise.all(
        openProjects.map(async (p) => {
          // A per-row count failing must not lose the whole list.
          const quotes = await getProjectQuotes(p.id).catch(() => []);
          counts[p.id] = quotes.filter((q) => q.status === 'SUBMITTED').length;
        }),
      );
      setQuoteCounts(counts);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your projects.');
    } finally {
      // Always clears: without this a thrown fetch left the page spinning forever.
      setLoading(false);
    }
  }, [profile]);

  // `version` bumps when the project builder closes, so a new or saved project shows up at once.
  useEffect(() => {
    load();
  }, [load, version]);

  const filter = FILTERS.find((f) => f.key === filterKey) ?? FILTERS[0];
  const filtered = filter.statuses.length ? projects.filter((p) => filter.statuses.includes(p.status)) : projects;
  const firstName = profile?.full_name.split(' ')[0];

  return (
    <>
      <PageHeader
        title={firstName ? `Hi ${firstName}, what's printing?` : 'My Projects'}
        subtitle="Track every printing project from draft to delivery."
        action={
          <Button variant="accent" icon={<Plus className="h-5 w-5" strokeWidth={2.75} />} onClick={() => startProject()} className="hidden lg:inline-flex">
            New project
          </Button>
        }
      />

      <FilterTabs
        value={filter.key}
        onChange={(key) => setSearchParams(key === 'all' ? {} : { filter: key })}
        tabs={FILTERS.map((f) => ({
          key: f.key,
          label: f.label,
          count: f.statuses.length ? projects.filter((p) => f.statuses.includes(p.status)).length : undefined,
        }))}
      />

      <div className="mt-5">
        {loading ? (
          <SkeletonList rows={4} />
        ) : error ? (
          <ErrorState title="Couldn't load your projects" message={error} onRetry={load} />
        ) : filtered.length === 0 ? (
          projects.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="No projects yet"
              body="Start a guided project and we'll match you with printing partners who can make it."
              action={
                <Button variant="accent" size="lg" onClick={() => startProject()} icon={<Plus className="h-5 w-5" strokeWidth={2.75} />}>
                  Start a project
                </Button>
              }
            />
          ) : (
            <EmptyState icon={ClipboardList} tone="cyan" title={`Nothing under "${filter.label}"`} body="Try another filter to see the rest of your projects." />
          )
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {filtered.map((p) => {
              const quotes = quoteCounts[p.id] ?? 0;
              const flagged = NEEDS_YOU.has(p.status) || quotes > 0;
              return (
                <LinkCard key={p.id} to={`/dashboard/projects/${p.id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="slug text-ink-400">{categoryName(p.category)}</p>
                      <h2 className="mt-1.5 truncate text-xl text-ink-950">{p.title}</h2>
                    </div>
                    <ProjectStatusBadge status={p.status} />
                  </div>
                  <div className={`mt-4 flex items-center gap-3 rounded-2xl px-3.5 py-3 ${flagged ? 'bg-sun-100' : 'bg-ink-50'}`}>
                    <p className={`min-w-0 flex-1 text-sm font-bold ${flagged ? 'text-sun-900' : 'text-ink-700'}`}>{nextAction(p, quotes)}</p>
                    <Chevron />
                  </div>
                  <p className="mt-3 text-xs font-medium text-ink-400">Updated {formatDate(p.updated_at)}</p>
                </LinkCard>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
