import { useEffect, useState, useCallback } from 'react';
import { ChevronDown, FileText } from 'lucide-react';
import { PageHeader } from '@/components/ui/bits';
import { EmptyState, SkeletonList } from '@/components/ui/states';
import { formatDate, peso } from '@/lib/format';
import { QuoteStatusBadge } from '@/components/dashboard/StatusBadge';
import { QuoteForm } from '@/components/dashboard/QuoteForm';
import { useAuth } from '@/contexts/AuthContext';
import { getPartnerQuotes, type QuoteWithProject } from '@/lib/api/quotes';
import { CATEGORIES } from '@/data/catalog';

function categoryName(id: string) {
  return CATEGORIES.find((c) => c.id === id)?.name ?? id;
}

export default function MyQuotationsPage() {
  const { partnerProfile } = useAuth();
  const [quotes, setQuotes] = useState<QuoteWithProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!partnerProfile) return;
    setQuotes(await getPartnerQuotes(partnerProfile.id));
    setLoading(false);
  }, [partnerProfile]);

  useEffect(() => {
    load();
  }, [load]);

  const header = <PageHeader title="My Quotations" subtitle={<>Everything you&apos;ve quoted, in progress or decided.</>} />;

  if (loading) {
    return (
      <>
        {header}
        <SkeletonList rows={3} />
      </>
    );
  }

  return (
    <>
      {header}

      {quotes.length === 0 ? (
        <EmptyState icon={FileText} tone="cyan" title="No quotations yet." body="Submit one from a new opportunity." />
      ) : (
        <div className="space-y-3">
          {quotes.map((q) => {
            const open = expanded === q.id;
            return (
              <div key={q.id}>
                <button
                  type="button"
                  aria-expanded={open}
                  className={`group block w-full rounded-3xl bg-white p-5 text-left shadow-soft ring-1 transition-all duration-200 hover:shadow-card active:scale-[0.99] ${
                    open ? 'ring-2 ring-ink-950' : 'ring-ink-900/5'
                  }`}
                  onClick={() => setExpanded((e) => (e === q.id ? null : q.id))}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="slug text-ink-400">{categoryName(q.project.category)}</p>
                      <h2 className="mt-1.5 truncate text-xl text-ink-950">{q.project.title}</h2>
                    </div>
                    <QuoteStatusBadge status={q.status} />
                  </div>
                  <div className="mt-4 flex items-center gap-3 rounded-2xl bg-ink-50 px-3.5 py-3">
                    <div className="min-w-0 flex-1">
                      {q.total_price != null ? (
                        <p className="font-display text-2xl font-extrabold text-ink-950">{peso(q.total_price)}</p>
                      ) : (
                        <p className="text-sm font-bold text-ink-600">No price entered yet</p>
                      )}
                      <p className="mt-0.5 text-sm font-medium text-ink-500">Updated {formatDate(q.updated_at)}</p>
                    </div>
                    <span className="text-sm font-bold text-ink-700">{open ? 'Hide' : q.status === 'DRAFT' || q.status === 'SUBMITTED' ? 'Open' : 'Details'}</span>
                    <ChevronDown className={`h-5 w-5 shrink-0 text-ink-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                  </div>
                </button>
                {open && (
                  <div className="mt-2 animate-fade-in">
                    <QuoteForm quote={q} onChanged={load} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
