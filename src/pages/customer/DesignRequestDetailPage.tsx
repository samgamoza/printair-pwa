import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowRight,
  BadgePercent,
  Ban,
  CheckCircle2,
  Clock,
  ImageDown,
  MapPin,
  Pencil,
  RotateCcw,
  SearchX,
  Send,
  Wallet,
  Zap,
} from 'lucide-react';
import { DesignRequestStatusBadge, DesignProposalStatusBadge } from '@/components/dashboard/StatusBadge';
import { DesignOrderTimeline } from '@/components/dashboard/DesignOrderTimeline';
import { DesignReviewForm } from '@/components/dashboard/DesignReviewForm';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, CardTitle, KeyValueList } from '@/components/ui/Card';
import { SelectField, TextField, TextAreaField } from '@/components/ui/Field';
import { Avatar, Badge, FileRow, PageHeader, Stars, Stat } from '@/components/ui/bits';
import { EmptyState, ErrorState, FormError, PageLoader } from '@/components/ui/states';
import { InkLoader } from '@/components/ui/Marks';
import { useDialogs } from '@/components/ui/dialogs';
import {
  getDesignRequestDetails,
  updateDesignRequest,
  submitDesignRequest,
  cancelDesignRequest,
  getDesignRequestFiles,
  getBriefDownloadUrl,
  type DesignRequestRow,
  type DesignRequestFileRow,
} from '@/lib/api/designRequests';
import { getRequestProposals, type DesignProposalWithDesigner } from '@/lib/api/designProposals';
import { getRequestQuestions, answerDesignClarificationQuestion, type DesignOpportunityQuestion } from '@/lib/api/designer';
import { ClarificationAnswers } from '@/components/dashboard/ClarificationAnswers';
import {
  selectDesignProposal,
  getDesignOrderByRequest,
  getDesignOrderEvents,
  type DesignOrderRow,
  type DesignOrderStatusEventRow,
} from '@/lib/api/designOrders';
import { getDeliverables, getDeliverableDownloadUrl, reviewDeliverable, type DesignDeliverableRow } from '@/lib/api/designDeliverables';
import { getDesignReviewByOrder, type DesignReviewRow } from '@/lib/api/designReviews';
import { createDesignBookingCheckout, getDesignBookingPayment, type DesignPaymentRow } from '@/lib/api/payments';
import { createProject, uploadProjectArtwork } from '@/lib/api/projects';
import { supabase } from '@/lib/api/client';
import { formatPHP } from '@/lib/pricing';
import {
  validateDesignRequestForSubmit,
  designRequestIsEditable,
  type DesignOrderStageStatus,
  type DesignRequestStatus,
} from '@/lib/validation';
import { formatDate, peso } from '@/lib/format';
import { DESIGN_SPECIALTIES, CATEGORIES } from '@/data/catalog';

function specialtyName(id: string) {
  return DESIGN_SPECIALTIES.find((s) => s.id === id)?.name ?? id;
}

export default function DesignRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [request, setRequest] = useState<DesignRequestRow | null | undefined>(undefined);
  const [files, setFiles] = useState<DesignRequestFileRow[]>([]);
  const [proposals, setProposals] = useState<DesignProposalWithDesigner[]>([]);
  const [order, setOrder] = useState<DesignOrderRow | null>(null);
  const [events, setEvents] = useState<DesignOrderStatusEventRow[]>([]);
  const [deliverables, setDeliverables] = useState<DesignDeliverableRow[]>([]);
  const [review, setReview] = useState<DesignReviewRow | null>(null);
  const [payment, setPayment] = useState<DesignPaymentRow | null>(null);
  const [questions, setQuestions] = useState<DesignOpportunityQuestion[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [payBusy, setPayBusy] = useState(false);
  const { confirm } = useDialogs();

  const load = useCallback(async () => {
    if (!id) return;
    let r: DesignRequestRow | null;
    try {
      r = await getDesignRequestDetails(id);
    } catch (e) {
      // Without this the page sat on "Loading request…" forever, because
      // `request` stays undefined when the fetch throws.
      setLoadError(e instanceof Error ? e.message : 'Could not load this design request.');
      setRequest(null);
      return;
    }
    setRequest(r);
    if (!r) return;

    setFiles(await getDesignRequestFiles(id).catch(() => []));

    if (r.status !== 'DRAFT') {
      setProposals(await getRequestProposals(id));
      // Secondary content: a failure here should not blank the whole page.
      setQuestions(await getRequestQuestions(id).catch(() => []));
    }

    if (['DESIGNER_SELECTED', 'IN_PROGRESS', 'DELIVERED'].includes(r.status)) {
      const ord = await getDesignOrderByRequest(id);
      setOrder(ord);
      if (ord) {
        setEvents(await getDesignOrderEvents(ord.id));
        setDeliverables(await getDeliverables(ord.id));
        if (ord.status === 'AWAITING_PAYMENT') {
          setPayment(await getDesignBookingPayment(ord.id));
        }
        if (r.status === 'DELIVERED') {
          setReview(await getDesignReviewByOrder(ord.id));
        }
      }
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (request === undefined) return <PageLoader label="Loading request…" />;

  if (request === null) {
    if (loadError) {
      return (
        <>
          <ErrorState
            title="Couldn't load this design request"
            message={loadError}
            onRetry={() => { setLoadError(null); setRequest(undefined); load(); }}
          />
          <div className="mt-4 flex justify-center">
            <ButtonLink to="/dashboard/designs" variant="ghost">
              Back to My Designs
            </ButtonLink>
          </div>
        </>
      );
    }
    return (
      <EmptyState
        icon={SearchX}
        tone="grape"
        title="We can't find that design request"
        body="This design request doesn't exist, or you don't have access to it."
        action={<ButtonLink to="/dashboard/designs">Back to My Designs</ButtonLink>}
      />
    );
  }

  async function handleSubmit() {
    setActionError(null);
    const errors = validateDesignRequestForSubmit({
      title: request!.title,
      specialty: request!.specialty,
      description: request!.description ?? '',
    });
    if (errors.length) {
      setActionError(errors[0]);
      return;
    }
    setBusy(true);
    try {
      await submitDesignRequest(request!.id);
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not post this request.');
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    const draft = request!.status === 'DRAFT';
    const ok = await confirm({
      title: draft ? 'Delete this draft?' : 'Cancel this design request?',
      body: 'This cannot be undone.',
      confirmLabel: draft ? 'Delete draft' : 'Cancel request',
      cancelLabel: 'Keep it',
      tone: 'danger',
    });
    if (!ok) return;
    setBusy(true);
    setActionError(null);
    try {
      await cancelDesignRequest(request!.id);
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not cancel this request.');
    } finally {
      setBusy(false);
    }
  }

  async function handleChoose(proposalId: string) {
    const ok = await confirm({
      title: 'Choose this designer?',
      body: 'Other proposals will no longer be available.',
      confirmLabel: 'Choose this designer',
    });
    if (!ok) return;
    setBusy(true);
    setActionError(null);
    try {
      await selectDesignProposal(proposalId);
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not select this proposal.');
    } finally {
      setBusy(false);
    }
  }

  async function handlePayNow() {
    if (!order) return;
    setPayBusy(true);
    setActionError(null);
    try {
      const { checkoutUrl } = await createDesignBookingCheckout(order.id);
      window.location.href = checkoutUrl;
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not start checkout.');
      setPayBusy(false);
    }
  }

  async function handleReviewDeliverable(deliverableId: string, approved: boolean, feedback?: string) {
    setBusy(true);
    setActionError(null);
    try {
      await reviewDeliverable(deliverableId, approved, feedback);
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not submit your review.');
    } finally {
      setBusy(false);
    }
  }

  const submittedProposals = proposals.filter((p) => p.status === 'SUBMITTED');
  const historicalProposals = proposals.filter((p) => p.status === 'NOT_SELECTED' || p.status === 'SELECTED');
  const latestDeliverable = deliverables[deliverables.length - 1] ?? null;

  const hasDesigner = request.status === 'DESIGNER_SELECTED' || request.status === 'IN_PROGRESS' || request.status === 'DELIVERED';

  return (
    <>
      <PageHeader
        back={{ to: '/dashboard/designs', label: 'My Designs' }}
        title={request.title}
        subtitle={specialtyName(request.specialty)}
        badge={<DesignRequestStatusBadge status={request.status} />}
      />

      {actionError && (
        <div className="mb-5">
          <FormError>{actionError}</FormError>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <div className="space-y-5">
          {/* What needs doing comes first; the brief it refers to sits underneath. */}
          {order && order.status === 'AWAITING_PAYMENT' && payment && (
            <BookingFeeCard payment={payment} onPay={handlePayNow} busy={payBusy} />
          )}

          {latestDeliverable?.approved && (
            <StartPrintProjectCard deliverable={latestDeliverable} navigate={navigate} />
          )}

          {order && deliverables.length > 0 && (
            <DeliverablesCard
              deliverables={deliverables}
              orderStatus={order.status}
              busy={busy}
              onReview={handleReviewDeliverable}
            />
          )}

          {order && order.status === 'DELIVERED' && !review && <DesignReviewForm orderId={order.id} onSubmitted={load} />}

          <ClarificationAnswers
            items={questions.map((q) => ({
              id: q.id,
              askerName: q.designer?.display_name ?? 'A designer',
              question: q.question,
              answer: q.answer,
            }))}
            askerNoun="designer"
            onAnswer={async (id, answer) => {
              await answerDesignClarificationQuestion(id, answer);
              await load();
            }}
          />

          {request.status === 'OPEN_FOR_PROPOSALS' && (
            <ProposalComparison proposals={submittedProposals} onChoose={handleChoose} busy={busy} />
          )}

          <RequestSummaryCard
            request={request}
            files={files}
            editable={designRequestIsEditable(request.status as DesignRequestStatus)}
            onSave={async (patch) => {
              setBusy(true);
              setActionError(null);
              try {
                await updateDesignRequest(request.id, patch);
                await load();
              } catch (e) {
                setActionError(e instanceof Error ? e.message : 'Could not save your changes.');
              } finally {
                setBusy(false);
              }
            }}
          />

          {request.status === 'DRAFT' && (
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <Button variant="accent" size="lg" onClick={handleSubmit} disabled={busy} icon={<Send className="h-5 w-5" />}>
                Post to designers
              </Button>
              <Button variant="danger" size="lg" onClick={handleCancel} disabled={busy} icon={<Ban className="h-5 w-5" />}>
                Delete draft
              </Button>
            </div>
          )}

          {request.status === 'OPEN_FOR_PROPOSALS' && (
            <Button variant="danger" onClick={handleCancel} disabled={busy} icon={<Ban className="h-5 w-5" />}>
              Cancel request
            </Button>
          )}

          {review && (
            <Card>
              <CardTitle>Your review</CardTitle>
              <div className="mt-3">
                <Stars rating={review.rating} className="h-5 w-5" />
              </div>
              {review.comment && <p className="mt-3 text-ink-700">{review.comment}</p>}
            </Card>
          )}
        </div>

        <div className="space-y-5">
          {hasDesigner && <SelectedDesignerCard proposal={proposals.find((p) => p.status === 'SELECTED') ?? null} />}

          {order && (
            <Card>
              <CardTitle>Order timeline</CardTitle>
              <div className="mt-5">
                <DesignOrderTimeline currentStatus={order.status as DesignOrderStageStatus} events={events} />
              </div>
            </Card>
          )}

          {historicalProposals.length > 0 && request.status === 'DELIVERED' && (
            <Card>
              <CardTitle>Proposal history</CardTitle>
              <ul className="mt-4 space-y-3">
                {proposals.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate font-medium text-ink-800">{p.designer?.display_name}</span>
                    <DesignProposalStatusBadge status={p.status} />
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

type EditableFields = {
  description: string;
  budget_min: string;
  budget_max: string;
  target_date: string;
  notes: string;
};

function RequestSummaryCard({
  request,
  files,
  editable,
  onSave,
}: {
  request: DesignRequestRow;
  files: DesignRequestFileRow[];
  editable: boolean;
  onSave: (patch: Partial<DesignRequestRow>) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<EditableFields>(toForm(request));
  const [saving, setSaving] = useState(false);

  function toForm(r: DesignRequestRow): EditableFields {
    return {
      description: r.description ?? '',
      budget_min: r.budget_min ? String(r.budget_min) : '',
      budget_max: r.budget_max ? String(r.budget_max) : '',
      target_date: r.target_date ?? '',
      notes: r.notes ?? '',
    };
  }

  const set = (key: keyof EditableFields) => (v: string) => setForm((f) => ({ ...f, [key]: v }));

  if (editing) {
    return (
      <Card className="ring-2 ring-ink-950">
        <CardTitle>Edit request details</CardTitle>
        <div className="mt-5 space-y-4">
          <TextAreaField label="Description" value={form.description} onChange={set('description')} rows={3} />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Budget from (₱)" type="number" inputMode="numeric" value={form.budget_min} onChange={set('budget_min')} />
            <TextField label="Budget to (₱)" type="number" inputMode="numeric" value={form.budget_max} onChange={set('budget_max')} />
          </div>
          <TextField label="Target date" type="date" value={form.target_date} onChange={set('target_date')} />
          <TextAreaField label="Notes" value={form.notes} onChange={set('notes')} rows={2} />
        </div>
        <div className="mt-5 flex gap-2.5">
          <Button
            loading={saving}
            onClick={async () => {
              setSaving(true);
              await onSave({
                description: form.description,
                budget_min: form.budget_min ? Number(form.budget_min) : null,
                budget_max: form.budget_max ? Number(form.budget_max) : null,
                target_date: form.target_date || null,
                notes: form.notes || null,
              });
              setSaving(false);
              setEditing(false);
            }}
          >
            Save changes
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setForm(toForm(request));
              setEditing(false);
            }}
          >
            Cancel
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardTitle
        action={
          editable ? (
            <Button variant="secondary" onClick={() => setEditing(true)} icon={<Pencil className="h-4 w-4" />} aria-label="Edit request details">
              Edit
            </Button>
          ) : undefined
        }
      >
        Design brief
      </CardTitle>
      <div className="mt-4">
        <KeyValueList
          rows={[
            { label: 'Description', value: request.description },
            {
              label: 'Budget',
              value: request.budget_min || request.budget_max ? `${peso(request.budget_min)} to ${peso(request.budget_max)}` : null,
            },
            { label: 'Target date', value: request.target_date ? formatDate(request.target_date, true) : null },
            { label: 'Notes', value: request.notes },
          ]}
        />
      </div>
      {files.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-sm font-bold text-ink-500">Reference files</p>
          <div className="space-y-2">
            {files.map((f) => (
              <FileLink key={f.id} file={f} />
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function FileLink({ file }: { file: DesignRequestFileRow }) {
  const [busy, setBusy] = useState(false);
  async function handleDownload() {
    setBusy(true);
    try {
      const url = await getBriefDownloadUrl(file.storage_path);
      window.open(url, '_blank');
    } finally {
      setBusy(false);
    }
  }
  return <FileRow name={file.file_name} meta="Tap to download" onDownload={handleDownload} busy={busy} />;
}

function ProposalComparison({
  proposals,
  onChoose,
  busy,
}: {
  proposals: DesignProposalWithDesigner[];
  onChoose: (id: string) => void;
  busy: boolean;
}) {
  if (proposals.length === 0) {
    return (
      <Card tone="magenta" className="relative overflow-hidden">
        <span className="pointer-events-none absolute -right-6 -top-8 h-32 w-44 bg-halftone bg-dots text-magenta-500/30" aria-hidden="true" />
        <p className="slug text-magenta-700">Matching</p>
        <h2 className="mt-2 text-2xl text-ink-950">We&apos;re matching you with the right designer.</h2>
        <p className="mt-2 text-ink-700">Proposals will land here as designers respond. There&apos;s nothing you need to do yet.</p>
      </Card>
    );
  }

  // Facts, not a verdict: the customer still chooses. With one proposal there is nothing to compare.
  const lowest = proposals.length > 1 ? Math.min(...proposals.map((p) => Number(p.price))) : null;
  const fastest = proposals.length > 1 ? Math.min(...proposals.map((p) => Number(p.turnaround_days))) : null;

  return (
    <section>
      <h2 className="mb-3 text-2xl text-ink-950">
        {proposals.length} proposal{proposals.length === 1 ? '' : 's'} received
      </h2>
      <div className="space-y-3">
        {proposals.map((p) => (
          <Card key={p.id} className="transition-shadow hover:shadow-card">
            <div className="flex items-start gap-3.5">
              <Avatar name={p.designer?.display_name ?? 'Designer'} className="h-12 w-12 text-base" />
              <div className="min-w-0 flex-1">
                <Link to={`/designers/${p.designer_id}`} className="block truncate font-display text-lg font-bold text-ink-950 hover:underline">
                  {p.designer?.display_name}
                </Link>
                <p className="flex items-center gap-1 text-sm text-ink-500">
                  <MapPin className="h-3.5 w-3.5" /> {p.designer?.city}
                </p>
              </div>
              <p className="shrink-0 font-display text-2xl font-extrabold text-ink-950">{peso(p.price)}</p>
            </div>

            {(Number(p.price) === lowest || Number(p.turnaround_days) === fastest) && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {Number(p.price) === lowest && (
                  <Badge tone="leaf" dot={false}>
                    <BadgePercent className="h-3.5 w-3.5" /> Lowest price
                  </Badge>
                )}
                {Number(p.turnaround_days) === fastest && (
                  <Badge tone="cyan" dot={false}>
                    <Zap className="h-3.5 w-3.5" /> Fastest
                  </Badge>
                )}
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 rounded-2xl bg-ink-50 p-4 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
              <Stat label="Down payment" value={`${p.down_payment_pct}%`} />
              <Stat label="Turnaround" icon={<Clock className="h-3.5 w-3.5" />} value={`${p.turnaround_days} days`} />
              <Stat label="Revisions included" value={String(p.revision_rounds_included)} />
              <Stat label="Valid until" value={formatDate(p.valid_until)} />
            </div>

            {p.note && <p className="mt-4 rounded-2xl rounded-tl-md bg-grape-50 px-4 py-3 text-ink-800">&ldquo;{p.note}&rdquo;</p>}

            <div className="mt-5 flex flex-col-reverse gap-2.5 sm:flex-row sm:items-center sm:justify-between">
              {/* Seeing the portfolio before committing is the point of vetting. */}
              <ButtonLink to={`/designers/${p.designer_id}`} variant="ghost">
                View designer profile
              </ButtonLink>
              <Button onClick={() => onChoose(p.id)} disabled={busy}>
                Choose this designer
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}

function BookingFeeCard({ payment, onPay, busy }: { payment: DesignPaymentRow; onPay: () => void; busy: boolean }) {
  const failed = payment.status === 'failed' || payment.status === 'expired';
  return (
    <Card tone="ink" className="relative overflow-hidden">
      <span className="pointer-events-none absolute -right-8 -top-10 h-40 w-52 bg-halftone bg-dots text-white/10" aria-hidden="true" />
      <p className="slug text-sun-300">
        <Wallet className="h-3.5 w-3.5" /> Platform fee required
      </p>
      <p className="relative mt-3 font-display text-5xl font-extrabold tracking-tight">{formatPHP(Number(payment.amount))}</p>
      <p className="relative mt-3 text-white/70">
        Pay PrintAir&apos;s platform fee to confirm this commission and notify your designer. This is separate from the design price,
        which is paid directly to the designer.
      </p>
      {failed && (
        <p className="relative mt-3 rounded-2xl bg-white/10 px-4 py-3 font-medium text-sun-200">
          Your last payment attempt didn&apos;t go through — you can try again.
        </p>
      )}
      <Button variant="accent" size="lg" fullWidth className="relative mt-5" onClick={onPay} loading={busy}>
        Pay now
      </Button>
    </Card>
  );
}

function SelectedDesignerCard({ proposal }: { proposal: DesignProposalWithDesigner | null }) {
  if (!proposal) return null;
  return (
    <Card tone="grape">
      <p className="slug text-grape-800">Your designer</p>
      <div className="mt-3 flex items-center gap-3.5">
        <Avatar name={proposal.designer?.display_name ?? 'Designer'} className="h-12 w-12 text-base" />
        <div className="min-w-0">
          <p className="truncate font-display text-xl font-bold text-ink-950">{proposal.designer?.display_name}</p>
          <p className="flex items-center gap-1 text-sm text-ink-600">
            <MapPin className="h-3.5 w-3.5" /> {proposal.designer?.city}
          </p>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-3 rounded-2xl bg-white/70 p-4">
        <Stat label="Price" value={peso(proposal.price)} />
        <Stat label="Down" value={`${proposal.down_payment_pct}%`} />
        <Stat label="Turnaround" value={`${proposal.turnaround_days} days`} />
      </div>
    </Card>
  );
}

function DeliverablesCard({
  deliverables,
  orderStatus,
  busy,
  onReview,
}: {
  deliverables: DesignDeliverableRow[];
  orderStatus: string;
  busy: boolean;
  onReview: (deliverableId: string, approved: boolean, feedback?: string) => void;
}) {
  const [feedback, setFeedback] = useState('');
  const [downloading, setDownloading] = useState<string | null>(null);
  const pending = deliverables.find((d) => !d.approved && d === deliverables[deliverables.length - 1]) && orderStatus === 'IN_PROGRESS'
    ? deliverables[deliverables.length - 1]
    : null;

  async function handleDownload(d: DesignDeliverableRow) {
    setDownloading(d.id);
    try {
      const url = await getDeliverableDownloadUrl(d.storage_path);
      window.open(url, '_blank');
    } finally {
      setDownloading(null);
    }
  }

  // The hero of the page while work is under way: this is where the customer looks at the design and answers.
  const live = orderStatus === 'IN_PROGRESS';

  return (
    <Card tone={live ? 'grape' : 'plain'} className="relative overflow-hidden">
      {live && <span className="pointer-events-none absolute -right-6 -top-8 h-32 w-44 bg-halftone bg-dots text-grape-500/25" aria-hidden="true" />}
      <div className="relative flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          {live && <p className="slug text-grape-700">Your design</p>}
          <h2 className={live ? 'mt-2 text-2xl text-ink-950' : 'text-lg text-ink-950'}>Deliverables</h2>
        </div>
        {pending && <Badge tone="magenta">Needs your review</Badge>}
      </div>
      <div className="relative mt-4 space-y-3">
        {[...deliverables].reverse().map((d) => (
          <div
            key={d.id}
            className={`rounded-3xl p-4 ${live ? 'bg-white shadow-soft' : 'bg-white ring-1 ring-ink-900/10'} ${
              pending?.id === d.id ? 'ring-2 ring-grape-500' : ''
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-display text-lg font-bold text-ink-950">Revision {d.revision_number}</p>
              {d.approved ? (
                <Badge tone="leaf" dot={false}>
                  <CheckCircle2 className="h-3.5 w-3.5" /> Approved
                </Badge>
              ) : (
                <span className="text-sm font-medium text-ink-500">{formatDate(d.created_at)}</span>
              )}
            </div>
            <div className="mt-3">
              <FileRow name={d.file_name} meta="Tap to download" onDownload={() => handleDownload(d)} busy={downloading === d.id} />
            </div>
            {d.customer_feedback && (
              <div className="mt-3 flex justify-end">
                <p className="max-w-[90%] rounded-3xl rounded-tr-md bg-ink-950 px-4 py-2.5 text-white">
                  <span className="sr-only">Your feedback: </span>
                  &ldquo;{d.customer_feedback}&rdquo;
                </p>
              </div>
            )}

            {pending?.id === d.id && (
              <div className="mt-4 space-y-4 border-t border-ink-100 pt-4">
                <TextAreaField
                  label="Need changes?"
                  value={feedback}
                  onChange={setFeedback}
                  rows={3}
                  placeholder="If you need changes, describe them here."
                />
                <div className="flex flex-col gap-2.5 sm:flex-row">
                  <Button disabled={busy} onClick={() => onReview(d.id, true)} icon={<CheckCircle2 className="h-5 w-5" />}>
                    Approve
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={busy || !feedback.trim()}
                    onClick={() => onReview(d.id, false, feedback.trim())}
                    icon={<RotateCcw className="h-5 w-5" />}
                  >
                    Request a revision
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

/**
 * The handoff (feature plan section 3.7 / decision #7) — the actual point of
 * the whole feature. Downloads the approved deliverable and re-uploads it as
 * the artwork for a brand-new print project draft, so the customer never
 * re-uploads anything themselves. A print category is required that a
 * design request has no equivalent field for, so it's asked here, inline,
 * rather than forcing a detour through the full print Project Builder.
 */
function StartPrintProjectCard({
  deliverable,
  navigate,
}: {
  deliverable: DesignDeliverableRow;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [category, setCategory] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStart() {
    if (!category) {
      setError('Choose a print category first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) throw new Error('Not signed in.');

      const url = await getDeliverableDownloadUrl(deliverable.storage_path);
      const res = await fetch(url);
      if (!res.ok) throw new Error('Could not download the approved design file.');
      const blob = await res.blob();
      const file = new File([blob], deliverable.file_name, { type: deliverable.mime_type ?? blob.type });

      const project = await createProject({
        customerId: userId,
        title: 'Print job from approved design',
        category,
        description: 'Artwork carried over from an approved PrintAir design commission — ready for quoting.',
      });
      await uploadProjectArtwork(project.id, userId, file);
      navigate(`/dashboard/projects/${project.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start a print project from this design.');
      setBusy(false);
    }
  }

  return (
    <Card tone="magenta" className="relative overflow-hidden">
      <span className="pointer-events-none absolute -right-6 -top-8 h-32 w-44 bg-halftone bg-dots text-magenta-500/30" aria-hidden="true" />
      <div className="relative flex items-center gap-3.5">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-magenta-600">
          <ImageDown className="h-6 w-6" />
        </span>
        <h2 className="text-2xl text-ink-950">Ready to print</h2>
      </div>
      <p className="relative mt-3 text-ink-700">
        Start a print project pre-filled with this artwork — no re-uploading, no leaving PrintAir.
      </p>

      {!expanded ? (
        <Button
          variant="accent"
          size="lg"
          fullWidth
          className="relative mt-5 !whitespace-normal py-3 leading-tight"
          onClick={() => setExpanded(true)}
          iconRight={<ArrowRight className="h-5 w-5 shrink-0" />}
        >
          Start a print project from this design
        </Button>
      ) : (
        <div className="relative mt-5 space-y-4">
          <SelectField label="What is this being printed as?" value={category} onChange={setCategory}>
            <option value="">Choose a category…</option>
            {CATEGORIES.filter((c) => !c.isSpecial).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </SelectField>
          <FormError>{error}</FormError>
          <Button
            variant="accent"
            size="lg"
            fullWidth
            onClick={handleStart}
            disabled={busy}
            icon={busy ? <InkLoader tone="current" label="Creating project" className="[&>span]:h-2 [&>span]:w-2" /> : undefined}
          >
            {busy ? 'Creating project…' : 'Create print project'}
          </Button>
        </div>
      )}
    </Card>
  );
}
