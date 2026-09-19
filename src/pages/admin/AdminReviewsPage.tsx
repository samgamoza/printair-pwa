import { useCallback, useState } from 'react';
import { Star } from 'lucide-react';
import { PageHeader } from '@/components/ui/bits';
import { EmptyState, ErrorState, SkeletonList } from '@/components/ui/states';
import { useDialogs } from '@/components/ui/dialogs';
import { listReviews, moderateReview, ADMIN_PAGE_SIZE, type AdminReviewRow } from '@/lib/api/admin';
import { useAdminList } from './useAdminList';
import { AdminLoadingLabel, AdminPager, AdminReviewCard } from './AdminPager';

export default function AdminReviewsPage() {
  const fetcher = useCallback((page: number, pageSize: number) => listReviews(page, pageSize), []);
  const { rows: reviews, count, page, setPage, loading, error, reload } = useAdminList(fetcher, ADMIN_PAGE_SIZE);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { askReason, toast } = useDialogs();

  async function handleModerate(r: AdminReviewRow) {
    const hiding = !r.hidden;
    const reason = await askReason({
      title: hiding ? 'Hide this review?' : 'Restore this review?',
      label: hiding ? 'Reason for hiding this review' : 'Reason for restoring this review',
      confirmLabel: hiding ? 'Hide' : 'Restore',
      tone: hiding ? 'danger' : undefined,
    });
    if (!reason) return;
    setBusyId(r.id);
    try {
      await moderateReview(r.id, hiding, reason);
      await reload();
      toast(hiding ? 'Review hidden.' : 'Review restored.');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not update this review.', 'error');
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div>
        <PageHeader title="Reviews" subtitle="What customers said about their printing partners." />
        <AdminLoadingLabel>Loading reviews…</AdminLoadingLabel>
        <SkeletonList rows={4} />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader title="Reviews" subtitle="What customers said about their printing partners." />
        <ErrorState title="Couldn't load reviews" message={error} onRetry={() => reload()} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Reviews" subtitle={`${count} reviews. Hide clearly abusive content only.`} />

      {reviews.length === 0 ? (
        <EmptyState icon={Star} title="No reviews yet." body="Reviews of printing partners appear here once customers leave them." />
      ) : (
        <ul className="space-y-3">
          {reviews.map((r) => (
            <AdminReviewCard
              key={r.id}
              rating={r.rating}
              comment={r.comment}
              about="Review of a printing partner"
              wouldWorkAgain={r.would_work_again}
              createdAt={r.created_at}
              hidden={r.hidden}
              hiddenReason={r.hidden_reason}
              busy={busyId === r.id}
              onModerate={() => handleModerate(r)}
            />
          ))}
        </ul>
      )}
      <AdminPager page={page} pageSize={ADMIN_PAGE_SIZE} count={count} onChange={setPage} />
    </div>
  );
}
