import { useCallback, useEffect, useState } from 'react';
import { Hourglass, Package, PackageCheck } from 'lucide-react';
import { DesignOrderStatusBadge } from '@/components/dashboard/StatusBadge';
import { DesignOrderTimeline } from '@/components/dashboard/DesignOrderTimeline';
import { Card } from '@/components/ui/Card';
import { Dropzone } from '@/components/ui/Dropzone';
import { FileRow, FilterTabs, PageHeader, Stars } from '@/components/ui/bits';
import { Banner, EmptyState, ErrorState, FormError, SkeletonList } from '@/components/ui/states';
import { useAuth } from '@/contexts/AuthContext';
import { getDesignerOrders, getDesignOrderEvents, type DesignerOrder, type DesignOrderStatusEventRow } from '@/lib/api/designOrders';
import {
  getDeliverables,
  getDeliverableDownloadUrl,
  uploadDesignDeliverable,
  validateDeliverableFile,
  type DesignDeliverableRow,
} from '@/lib/api/designDeliverables';
import { getDesignReviewByOrder, type DesignReviewRow } from '@/lib/api/designReviews';
import type { DesignOrderStageStatus } from '@/lib/validation';
import { DESIGN_SPECIALTIES } from '@/data/catalog';
import { formatBytes } from '@/lib/format';

function specialtyName(id: string) {
  return DESIGN_SPECIALTIES.find((s) => s.id === id)?.name ?? id;
}

export default function DesignerOrdersPage() {
  const { designerProfile } = useAuth();
  const [orders, setOrders] = useState<DesignerOrder[]>([]);
  const [events, setEvents] = useState<Record<string, DesignOrderStatusEventRow[]>>({});
  const [deliverables, setDeliverables] = useState<Record<string, DesignDeliverableRow[]>>({});
  const [reviews, setReviews] = useState<Record<string, DesignReviewRow | null>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'active' | 'completed'>('active');

  const load = useCallback(async () => {
    if (!designerProfile) return;
    setLoadError(null);
    try {
      const all = await getDesignerOrders(designerProfile.id);
      setOrders(all);
      const evByOrder: Record<string, DesignOrderStatusEventRow[]> = {};
      const delByOrder: Record<string, DesignDeliverableRow[]> = {};
      const revByOrder: Record<string, DesignReviewRow | null> = {};
      await Promise.all(
        all.map(async (o) => {
          // Per-order detail is supporting content — one failing must not take
          // the whole list down with it.
          evByOrder[o.id] = await getDesignOrderEvents(o.id).catch(() => []);
          delByOrder[o.id] = await getDeliverables(o.id).catch(() => []);
          if (o.status === 'DELIVERED') {
            revByOrder[o.id] = await getDesignReviewByOrder(o.id).catch(() => null);
          }
        }),
      );
      setEvents(evByOrder);
      setDeliverables(delByOrder);
      setReviews(revByOrder);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load your commissions.');
    } finally {
      // Always clears: a throw used to leave this spinning forever.
      setLoading(false);
    }
  }, [designerProfile]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <>
        <PageHeader title="My Orders" subtitle="Commissions you won — upload revisions and track delivery." />
        <SkeletonList rows={3} />
      </>
    );
  }

  const active = orders.filter((o) => o.status !== 'DELIVERED');
  const completed = orders.filter((o) => o.status === 'DELIVERED');
  const shown = filter === 'active' ? active : completed;

  return (
    <>
      <PageHeader title="My Orders" subtitle="Commissions you won — upload revisions and track delivery." />

      {loadError && (
        <div className="mb-5">
          <ErrorState title="Couldn't load your commissions" message={loadError} onRetry={load} />
        </div>
      )}

      <FilterTabs
        value={filter}
        onChange={setFilter}
        tabs={[
          { key: 'active', label: 'Active', count: active.length },
          { key: 'completed', label: 'Completed', count: completed.length },
        ]}
      />

      <div className="mt-5">
        {shown.length === 0 ? (
          <EmptyState pip
            icon={filter === 'active' ? Package : PackageCheck}
            tone={filter === 'active' ? 'grape' : 'magenta'}
            title={filter === 'active' ? 'No active commissions right now.' : 'Nothing delivered yet.'}
          />
        ) : (
          <div className="grid items-start gap-5 lg:grid-cols-2">
            {shown.map((o) => (
              <OrderCard
                key={o.id}
                order={o}
                events={events[o.id] ?? []}
                deliverables={deliverables[o.id] ?? []}
                review={reviews[o.id]}
                onChanged={load}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function OrderCard({
  order,
  events,
  deliverables,
  review,
  onChanged,
}: {
  order: DesignerOrder;
  events: DesignOrderStatusEventRow[];
  deliverables: DesignDeliverableRow[];
  review: DesignReviewRow | null | undefined;
  onChanged: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const canUpload = order.status === 'CONFIRMED' || order.status === 'IN_PROGRESS';
  const latest = deliverables[deliverables.length - 1] ?? null;
  const awaitingCustomer = latest && !latest.approved && order.status === 'IN_PROGRESS';

  async function handleUpload(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    const problem = validateDeliverableFile(file);
    if (problem) {
      setError(problem);
      return;
    }
    setUploading(true);
    setError(null);
    try {
      await uploadDesignDeliverable(order.id, file);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not upload that file.');
    } finally {
      setUploading(false);
      // No input to reset here: the Dropzone clears its own, so the same file can be picked again.
    }
  }

  async function handleDownload(d: DesignDeliverableRow) {
    setDownloading(d.id);
    try {
      const url = await getDeliverableDownloadUrl(d.storage_path);
      window.open(url, '_blank');
    } finally {
      setDownloading(null);
    }
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="slug text-grape-600">{specialtyName(order.request.specialty)}</p>
          <h2 className="mt-1.5 text-xl text-ink-950">{order.request.title}</h2>
        </div>
        <DesignOrderStatusBadge status={order.status} />
      </div>

      {order.status === 'AWAITING_PAYMENT' && (
        <Banner tone="warning" className="mt-4">
          Waiting for the customer&apos;s platform fee payment before you can start.
        </Banner>
      )}

      <div className="mt-5">
        <DesignOrderTimeline currentStatus={order.status as DesignOrderStageStatus} events={events} />
      </div>

      {deliverables.length > 0 && (
        <div className="mt-5 border-t border-ink-100 pt-5">
          <p className="slug text-ink-500">Revisions</p>
          <div className="mt-2.5 space-y-2">
            {[...deliverables].reverse().map((d) => (
              <FileRow
                key={d.id}
                name={`Rev ${d.revision_number} — ${d.file_name}`}
                meta={
                  <>
                    <span className={`font-bold ${d.approved ? 'text-leaf-700' : 'text-ink-500'}`}>{d.approved ? 'Approved' : 'Pending review'}</span>
                    {d.size_bytes ? ` · ${formatBytes(d.size_bytes)}` : ''}
                  </>
                }
                onDownload={() => handleDownload(d)}
                busy={downloading === d.id}
              />
            ))}
          </div>
          {latest?.customer_feedback && !latest.approved && (
            // The customer's words, as a chat bubble from the left.
            <div className="mt-4">
              <p className="text-xs font-bold text-ink-500">Customer feedback:</p>
              <p className="mt-1 inline-block max-w-[92%] whitespace-pre-line rounded-3xl rounded-tl-md bg-sun-100 px-4 py-2.5 text-sun-900">
                {latest.customer_feedback}
              </p>
            </div>
          )}
        </div>
      )}

      {canUpload && (
        <div className="mt-5 border-t border-ink-100 pt-5">
          {awaitingCustomer ? (
            <p className="flex items-center gap-2.5 rounded-2xl bg-grape-50 px-4 py-3 text-sm font-medium text-grape-900">
              <Hourglass className="h-4 w-4 shrink-0 text-grape-600" />
              Waiting for the customer to review the latest revision.
            </p>
          ) : (
            <Dropzone
              onFiles={handleUpload}
              accept=".pdf,.jpg,.jpeg,.png,.ai,.eps,.zip"
              title={deliverables.length === 0 ? 'Upload first deliverable' : 'Upload next revision'}
              hint="PDF, JPG, PNG, AI, EPS or ZIP — up to 50MB"
              busy={uploading}
              tone="magenta"
            />
          )}
          {error && (
            <div className="mt-3">
              <FormError>{error}</FormError>
            </div>
          )}
        </div>
      )}

      {order.status === 'DELIVERED' && (
        <div className="mt-5 border-t border-ink-100 pt-5">
          {review ? (
            <>
              <Stars rating={review.rating} className="h-5 w-5" />
              {review.comment && <p className="mt-2 text-ink-700">{review.comment}</p>}
            </>
          ) : (
            <p className="text-sm text-ink-500">No review left yet.</p>
          )}
        </div>
      )}
    </Card>
  );
}
