import { useCallback, useEffect, useState } from 'react';
import { Package, ArrowRight } from 'lucide-react';
import { OrderStatusBadge } from '@/components/dashboard/StatusBadge';
import { OrderTimeline } from '@/components/dashboard/OrderTimeline';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FileRow, PageHeader } from '@/components/ui/bits';
import { Banner, EmptyState, FormError, SkeletonList } from '@/components/ui/states';
import { useDialogs } from '@/components/ui/dialogs';
import { useAuth } from '@/contexts/AuthContext';
import { getPartnerOrders, updateOrderStatus, getOrderEvents, type PartnerOrder, type OrderStatusEventRow } from '@/lib/api/orders';
import { getProjectFile, getArtworkDownloadUrl } from '@/lib/api/projects';
import { nextOrderStatus, type OrderStatus } from '@/lib/validation';
import { CATEGORIES } from '@/data/catalog';

function categoryName(id: string) {
  return CATEGORIES.find((c) => c.id === id)?.name ?? id;
}

type ProjectFile = Awaited<ReturnType<typeof getProjectFile>>;

const STAGE_LABEL: Record<OrderStatus, string> = {
  AWAITING_PAYMENT: 'Confirmed', // never rendered as a button — advancing out of this stage is webhook-only, see below
  CONFIRMED: 'In Production',
  IN_PRODUCTION: 'Ready',
  READY: 'Delivered',
  DELIVERED: 'Delivered',
};

export default function ActiveProjectsPage() {
  const { partnerProfile } = useAuth();
  const [orders, setOrders] = useState<PartnerOrder[]>([]);
  const [events, setEvents] = useState<Record<string, OrderStatusEventRow[]>>({});
  // The customer's artwork per order. Partners could already read it once selected, but no screen offered it.
  const [files, setFiles] = useState<Record<string, ProjectFile>>({});
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const { toast } = useDialogs();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!partnerProfile) return;
    const all = await getPartnerOrders(partnerProfile.id);
    const active = all.filter((o) => o.status !== 'DELIVERED');
    setOrders(active);
    const evByOrder: Record<string, OrderStatusEventRow[]> = {};
    const fileByOrder: Record<string, ProjectFile> = {};
    await Promise.all(
      active.map(async (o) => {
        // Artwork is optional extra: a failed lookup must never take the page down with it.
        const [ev, file] = await Promise.all([getOrderEvents(o.id), getProjectFile(o.project_id).catch(() => null)]);
        evByOrder[o.id] = ev;
        fileByOrder[o.id] = file;
      }),
    );
    setEvents(evByOrder);
    setFiles(fileByOrder);
    setLoading(false);
  }, [partnerProfile]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAdvance(orderId: string, current: OrderStatus) {
    const next = nextOrderStatus(current);
    if (!next) return;
    setBusyId(orderId);
    setError(null);
    try {
      await updateOrderStatus(orderId, next, notes[orderId] || undefined);
      setNotes((n) => ({ ...n, [orderId]: '' }));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update this project.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDownloadArtwork(orderId: string, storagePath: string) {
    setDownloadingId(orderId);
    try {
      const url = await getArtworkDownloadUrl(storagePath);
      window.open(url, '_blank');
    } catch {
      toast('Could not open the artwork. Please try again.', 'error');
    } finally {
      setDownloadingId(null);
    }
  }

  const header = <PageHeader title="Active Projects" subtitle="Projects you won — keep customers updated as you go." />;

  if (loading) {
    return (
      <>
        {header}
        <SkeletonList rows={2} />
      </>
    );
  }

  return (
    <>
      {header}

      {error && (
        <div className="mb-5">
          <FormError>{error}</FormError>
        </div>
      )}

      {orders.length === 0 ? (
        <EmptyState icon={Package} tone="grape" title="No active projects right now." />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {orders.map((o) => {
            const next = nextOrderStatus(o.status as OrderStatus);
            const file = files[o.id];
            return (
              <Card key={o.id} className="flex flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="slug text-ink-400">{categoryName(o.project.category)}</p>
                    <h2 className="mt-1.5 text-xl text-ink-950">{o.project.title}</h2>
                  </div>
                  <OrderStatusBadge status={o.status} />
                </div>

                <div className="mt-5">
                  <OrderTimeline currentStatus={o.status as OrderStatus} events={events[o.id] ?? []} />
                </div>

                {file && (
                  <div className="mt-5">
                    <p className="mb-2 text-sm font-bold text-ink-500">Customer&apos;s artwork</p>
                    <FileRow
                      name={file.file_name}
                      meta="Tap to download"
                      onDownload={() => handleDownloadArtwork(o.id, file.storage_path)}
                      busy={downloadingId === o.id}
                    />
                  </div>
                )}

                {o.status === 'AWAITING_PAYMENT' ? (
                  <Banner tone="warning" className="mt-5">
                    Waiting for the customer&apos;s platform fee payment before you can start.
                  </Banner>
                ) : (
                  next && (
                    <div className="mt-auto pt-5">
                      <div className="border-t border-ink-100 pt-5">
                        <input
                          value={notes[o.id] ?? ''}
                          onChange={(e) => setNotes((n) => ({ ...n, [o.id]: e.target.value }))}
                          placeholder="Optional note for this update"
                          aria-label="Optional note for this update"
                          className="control"
                        />
                        <Button
                          variant="primary"
                          size="lg"
                          fullWidth
                          className="mt-3"
                          onClick={() => handleAdvance(o.id, o.status as OrderStatus)}
                          loading={busyId === o.id}
                          iconRight={<ArrowRight className="h-5 w-5" />}
                        >
                          {`Mark as ${STAGE_LABEL[o.status as OrderStatus]}`}
                        </Button>
                      </div>
                    </div>
                  )
                )}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
