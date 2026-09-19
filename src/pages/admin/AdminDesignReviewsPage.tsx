import { useCallback, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { PageHeader } from '@/components/ui/bits';
import { EmptyState, ErrorState, SkeletonList } from '@/components/ui/states';
import { useDialogs } from '@/components/ui/dialogs';
import {
  listDesignReviews,
  moderateDesignReview,
  ADMIN_PAGE_SIZE,
  type AdminDesignReviewRow,
} from '@/lib/api/admin';
import { useAdminList } from './useAdminList';
import { AdminLoadingLabel, AdminPager, AdminReviewCard } from './AdminPager';

/**
 * Moderation for design reviews — the mirror of AdminReviewsPage.
 *
 * admin_moderate_design_review() existed from the day the designer schema
 * landed but had no caller, so an abusive review about a designer could not be
 * hidden while the identical review about a printing partner could. Same
 * standard on both halves of the marketplace.
 */
export default function AdminDesignReviewsPage() {
  const fetcher = useCallback((page: number, pageSize: number) => listDesignReviews(page, pageSize), []);
  const { rows: reviews, count, page, setPage, loading, error, reload } = useAdminList(fetcher, ADMIN_PAGE_SIZE);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { askReason, toast } = useDialogs();

  async function handleModerate(r: AdminDesignReviewRow) {
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
      await moderateDesignReview(r.id, hiding, reason);
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
        <PageHeader title="Design Reviews" subtitle="What customers said about their designers." />
        <AdminLoadingLabel>Loading design reviews…</AdminLoadingLabel>
        <SkeletonList rows={4} />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader title="Design Reviews" subtitle="What customers said about their designers." />
        <ErrorState title="Couldn't load design reviews" message={error} onRetry={() => reload()} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Design Reviews" subtitle={`${count} reviews. Hide clearly abusive content only.`} />

      {reviews.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No design reviews yet."
          body="Reviews of designers appear here once customers leave them."
          tone="grape"
        />
      ) : (
        <ul className="space-y-3">
          {reviews.map((r) => (
            <AdminReviewCard
              key={r.id}
              rating={r.rating}
              comment={r.comment}
              about={
                <>
                  {r.designer?.display_name ?? 'Unknown designer'}
                  {r.request?.title ? ` · ${r.request.title}` : ''}
                </>
              }
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
