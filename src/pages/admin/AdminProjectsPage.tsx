import { useCallback } from 'react';
import { FolderKanban } from 'lucide-react';
import { Avatar, PageHeader } from '@/components/ui/bits';
import { EmptyState, ErrorState, SkeletonList } from '@/components/ui/states';
import { ProjectStatusBadge } from '@/components/dashboard/StatusBadge';
import { listProjects, ADMIN_PAGE_SIZE, type AdminProjectRow } from '@/lib/api/admin';
import { CATEGORIES } from '@/data/catalog';
import { useAdminList } from './useAdminList';
import { AdminLoadingLabel, AdminPager, AdminTable, type AdminColumn } from './AdminPager';

function categoryName(id: string) {
  return CATEGORIES.find((c) => c.id === id)?.name ?? id;
}

const COLUMNS: AdminColumn<AdminProjectRow>[] = [
  { label: 'Title', primary: true, cell: (p) => <span className="break-words">{p.title}</span> },
  { label: 'Category', cell: (p) => categoryName(p.category) },
  {
    label: 'Customer',
    cell: (p, view) =>
      p.customer ? (
        <span className={`flex min-w-0 items-center gap-3 ${view === 'card' ? 'flex-row-reverse text-right' : ''}`}>
          <Avatar name={p.customer.full_name ?? ''} className="h-9 w-9 text-xs" />
          <span className="min-w-0">
            <span className="block font-bold text-ink-900">{p.customer.full_name ?? '—'}</span>
            {p.customer.email && <span className="block break-all text-ink-500">{p.customer.email}</span>}
          </span>
        </span>
      ) : (
        '—'
      ),
  },
  { label: 'Status', cell: (p) => <ProjectStatusBadge status={p.status} /> },
];

export default function AdminProjectsPage() {
  const fetcher = useCallback((page: number, pageSize: number) => listProjects(page, pageSize), []);
  const { rows: projects, count, page, setPage, loading, error, reload } = useAdminList(fetcher, ADMIN_PAGE_SIZE);

  if (loading) {
    return (
      <div>
        <PageHeader title="Projects" subtitle="Every print project, newest first." />
        <AdminLoadingLabel>Loading projects…</AdminLoadingLabel>
        <SkeletonList rows={5} />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader title="Projects" subtitle="Every print project, newest first." />
        <ErrorState title="Couldn't load projects" message={error} onRetry={() => reload()} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Projects" subtitle={`${count} projects across all customers.`} />

      {projects.length === 0 ? (
        <EmptyState icon={FolderKanban} title="No projects yet" body="Projects appear here as soon as a customer starts one." tone="cyan" />
      ) : (
        <AdminTable caption="Projects" columns={COLUMNS} rows={projects} rowKey={(p) => p.id} />
      )}
      <AdminPager page={page} pageSize={ADMIN_PAGE_SIZE} count={count} onChange={setPage} />
    </div>
  );
}
