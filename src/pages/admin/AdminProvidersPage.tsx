import { useCallback } from 'react';
import { Building2 } from 'lucide-react';
import { Avatar, PageHeader } from '@/components/ui/bits';
import { EmptyState, ErrorState, SkeletonList } from '@/components/ui/states';
import { AccountStatusBadge } from '@/components/dashboard/StatusBadge';
import { listProviders, ADMIN_PAGE_SIZE, type AdminPartnerRow } from '@/lib/api/admin';
import { useAdminList } from './useAdminList';
import { AdminLoadingLabel, AdminPager, AdminTable, type AdminColumn } from './AdminPager';

const COLUMNS: AdminColumn<AdminPartnerRow>[] = [
  {
    label: 'Business',
    primary: true,
    cell: (p) => (
      <span className="flex min-w-0 items-center gap-3">
        <Avatar name={p.business_name ?? ''} square className="h-9 w-9 text-xs" />
        <span className="min-w-0 break-words">{p.business_name}</span>
      </span>
    ),
  },
  { label: 'Contact', cell: (p) => p.contact_name },
  { label: 'City', cell: (p) => p.city },
  { label: 'Status', cell: (p) => <AccountStatusBadge status={p.status} /> },
];

export default function AdminProvidersPage() {
  const fetcher = useCallback((page: number, pageSize: number) => listProviders(page, pageSize), []);
  const { rows: providers, count, page, setPage, loading, error, reload } = useAdminList(fetcher, ADMIN_PAGE_SIZE);

  if (loading) {
    return (
      <div>
        <PageHeader title="Providers" subtitle="The printing partners on PrintAir." />
        <AdminLoadingLabel>Loading providers…</AdminLoadingLabel>
        <SkeletonList rows={5} />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader title="Providers" subtitle="The printing partners on PrintAir." />
        <ErrorState title="Couldn't load providers" message={error} onRetry={() => reload()} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Providers" subtitle={`${count} printing partners.`} />

      {providers.length === 0 ? (
        <EmptyState icon={Building2} title="No printing partners yet" body="Partners appear here once they register their business." />
      ) : (
        <AdminTable caption="Providers" columns={COLUMNS} rows={providers} rowKey={(p) => p.id} />
      )}
      <AdminPager page={page} pageSize={ADMIN_PAGE_SIZE} count={count} onChange={setPage} />
      <p className="mt-4 text-sm text-ink-500">Suspend a provider's account from the Users tab.</p>
    </div>
  );
}
