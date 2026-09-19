import { useCallback } from 'react';
import { FileText } from 'lucide-react';
import { PageHeader } from '@/components/ui/bits';
import { EmptyState, ErrorState, SkeletonList } from '@/components/ui/states';
import { QuoteStatusBadge } from '@/components/dashboard/StatusBadge';
import { listQuotes, ADMIN_PAGE_SIZE, type AdminQuoteRow } from '@/lib/api/admin';
import { formatDate, peso } from '@/lib/format';
import { useAdminList } from './useAdminList';
import { AdminLoadingLabel, AdminPager, AdminTable, type AdminColumn } from './AdminPager';

const COLUMNS: AdminColumn<AdminQuoteRow>[] = [
  { label: 'Project', primary: true, cell: (q) => <span className="break-words">{q.project?.title ?? '—'}</span> },
  { label: 'Partner', cell: (q) => q.partner?.business_name ?? '—' },
  {
    label: 'Price',
    cell: (q) => <span className="font-display font-bold text-ink-950">{peso(q.total_price)}</span>,
  },
  { label: 'Turnaround', cell: (q) => (q.turnaround_days ? `${q.turnaround_days} days` : '—') },
  { label: 'Status', cell: (q) => <QuoteStatusBadge status={q.status} /> },
  { label: 'Submitted', cell: (q) => <span className="text-ink-500">{formatDate(q.submitted_at)}</span> },
];

export default function AdminQuotesPage() {
  const fetcher = useCallback((page: number, pageSize: number) => listQuotes(page, pageSize), []);
  const { rows: quotes, count, page, setPage, loading, error, reload } = useAdminList(fetcher, ADMIN_PAGE_SIZE);

  if (loading) {
    return (
      <div>
        <PageHeader title="Quotes" subtitle="PrintAir does not set or edit provider prices — this view is read-only." />
        <AdminLoadingLabel>Loading quotes…</AdminLoadingLabel>
        <SkeletonList rows={5} />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader title="Quotes" subtitle="PrintAir does not set or edit provider prices — this view is read-only." />
        <ErrorState title="Couldn't load quotes" message={error} onRetry={() => reload()} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Quotes"
        subtitle={`${count} quotations. PrintAir does not set or edit provider prices — this view is read-only.`}
      />

      {quotes.length === 0 ? (
        <EmptyState icon={FileText} title="No quotations yet" body="Quotes appear here as soon as a printing partner submits one." tone="grape" />
      ) : (
        <AdminTable caption="Quotes" columns={COLUMNS} rows={quotes} rowKey={(q) => q.id} />
      )}
      <AdminPager page={page} pageSize={ADMIN_PAGE_SIZE} count={count} onChange={setPage} />
    </div>
  );
}
