import { useEffect, useState } from 'react';
import { PackageCheck } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge, PageHeader, Stars } from '@/components/ui/bits';
import { EmptyState, SkeletonList } from '@/components/ui/states';
import { formatDate } from '@/lib/format';
import { useAuth } from '@/contexts/AuthContext';
import { getPartnerOrders, getOrderEvents, type PartnerOrder } from '@/lib/api/orders';
import { getReviewByOrder, type ReviewRow } from '@/lib/api/reviews';
import { CATEGORIES } from '@/data/catalog';

function categoryName(id: string) {
  return CATEGORIES.find((c) => c.id === id)?.name ?? id;
}

export default function CompletedProjectsPage() {
  const { partnerProfile } = useAuth();
  const [orders, setOrders] = useState<PartnerOrder[]>([]);
  const [reviews, setReviews] = useState<Record<string, ReviewRow | null>>({});
  const [deliveredAt, setDeliveredAt] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!partnerProfile) return;
    (async () => {
      const all = await getPartnerOrders(partnerProfile.id);
      const completed = all.filter((o) => o.status === 'DELIVERED');
      setOrders(completed);
      const revByOrder: Record<string, ReviewRow | null> = {};
      const deliveredByOrder: Record<string, string> = {};
      await Promise.all(
        completed.map(async (o) => {
          revByOrder[o.id] = await getReviewByOrder(o.id);
          const events = await getOrderEvents(o.id);
          const delivered = events.find((e) => e.status === 'DELIVERED');
          if (delivered) deliveredByOrder[o.id] = delivered.created_at;
        }),
      );
      setReviews(revByOrder);
      setDeliveredAt(deliveredByOrder);
      setLoading(false);
    })();
  }, [partnerProfile]);

  const header = <PageHeader title="Completed Projects" subtitle="Delivered work and the reviews they earned." />;

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

      {orders.length === 0 ? (
        <EmptyState icon={PackageCheck} tone="cyan" title="Nothing delivered yet." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {orders.map((o) => {
            const review = reviews[o.id];
            return (
              <Card key={o.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="slug text-ink-500">{categoryName(o.project.category)}</p>
                    <h2 className="mt-1.5 text-xl text-ink-950">{o.project.title}</h2>
                  </div>
                  {deliveredAt[o.id] && <Badge tone="leaf">Delivered {formatDate(deliveredAt[o.id], true)}</Badge>}
                </div>
                {review ? (
                  <div className="mt-4 rounded-2xl bg-sun-50 px-4 py-3.5">
                    <Stars rating={review.rating} className="h-5 w-5" />
                    {review.comment && <p className="mt-2 text-ink-800">{review.comment}</p>}
                  </div>
                ) : (
                  <p className="mt-4 rounded-2xl bg-ink-50 px-4 py-3 text-sm font-medium text-ink-500">No review left yet.</p>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
