import { useCallback, useState } from 'react';
import { Ban, CheckCircle2, Users } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Avatar, Badge, PageHeader, type BadgeTone } from '@/components/ui/bits';
import { EmptyState, ErrorState, SkeletonList } from '@/components/ui/states';
import { useDialogs } from '@/components/ui/dialogs';
import { AccountStatusBadge } from '@/components/dashboard/StatusBadge';
import { listUsers, suspendAccount, reinstateAccount, ADMIN_PAGE_SIZE, type AdminProfileRow } from '@/lib/api/admin';
import { useAdminList } from './useAdminList';
import { AdminLoadingLabel, AdminPager, AdminTable, type AdminColumn } from './AdminPager';

const ROLE_TONES: Record<string, BadgeTone> = {
  customer: 'cyan',
  partner: 'sun',
  designer: 'grape',
  admin: 'magenta',
};

export default function AdminUsersPage() {
  const fetcher = useCallback((page: number, pageSize: number) => listUsers(page, pageSize), []);
  const { rows: users, count, page, setPage, loading, error, reload } = useAdminList(fetcher, ADMIN_PAGE_SIZE);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { askReason, toast } = useDialogs();

  async function handleToggle(u: AdminProfileRow) {
    const suspending = u.status === 'active';
    const reason = await askReason({
      title: suspending ? 'Suspend this account?' : 'Reinstate this account?',
      label: suspending ? 'Reason for suspending this account' : 'Reason for reinstating this account',
      confirmLabel: suspending ? 'Suspend' : 'Reinstate',
      tone: suspending ? 'danger' : undefined,
    });
    if (!reason) return;
    setBusyId(u.id);
    try {
      if (u.status === 'active') await suspendAccount(u.id, reason);
      else await reinstateAccount(u.id, reason);
      await reload();
      toast(suspending ? 'Account suspended.' : 'Account reinstated.');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not update this account.', 'error');
    } finally {
      setBusyId(null);
    }
  }

  const columns: AdminColumn<AdminProfileRow>[] = [
    {
      label: 'Name',
      primary: true,
      cell: (u) => (
        <span className="flex min-w-0 items-center gap-3">
          <Avatar name={u.full_name ?? ''} className="h-9 w-9 text-xs" />
          <span className="min-w-0 break-words">{u.full_name}</span>
        </span>
      ),
    },
    { label: 'Email', cell: (u) => <span className="break-all">{u.email}</span> },
    {
      label: 'Role',
      cell: (u) => (
        <Badge tone={ROLE_TONES[u.role] ?? 'neutral'} dot={false}>
          <span className="capitalize">{u.role}</span>
        </Badge>
      ),
    },
    { label: 'Status', cell: (u) => <AccountStatusBadge status={u.status} /> },
    {
      label: '',
      align: 'right',
      cell: (u, view) => (
        <Button
          variant={u.status === 'active' ? 'danger' : 'secondary'}
          size={view === 'table' ? 'sm' : 'md'}
          fullWidth={view === 'card'}
          onClick={() => handleToggle(u)}
          disabled={busyId === u.id}
          loading={busyId === u.id}
          icon={u.status === 'active' ? <Ban className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
        >
          {u.status === 'active' ? 'Suspend' : 'Reinstate'}
        </Button>
      ),
    },
  ];

  if (loading) {
    return (
      <div>
        <PageHeader title="Users" subtitle="Everyone with a PrintAir account." />
        <AdminLoadingLabel>Loading users…</AdminLoadingLabel>
        <SkeletonList rows={5} />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader title="Users" subtitle="Everyone with a PrintAir account." />
        <ErrorState title="Couldn't load users" message={error} onRetry={() => reload()} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Users" subtitle={`${count} accounts.`} />

      {users.length === 0 ? (
        <EmptyState icon={Users} title="No accounts yet" body="People appear here as soon as they sign up." tone="cyan" />
      ) : (
        <AdminTable caption="Users" columns={columns} rows={users} rowKey={(u) => u.id} />
      )}
      <AdminPager page={page} pageSize={ADMIN_PAGE_SIZE} count={count} onChange={setPage} />
    </div>
  );
}
