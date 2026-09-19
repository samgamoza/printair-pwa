import { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Ban, Clock, MapPin, Pencil, Send, Truck, Wallet, Zap, BadgePercent } from 'lucide-react';
import { ProjectStatusBadge, QuoteStatusBadge } from '@/components/dashboard/StatusBadge';
import { OrderTimeline } from '@/components/dashboard/OrderTimeline';
import { ReviewForm } from '@/components/dashboard/ReviewForm';
import { ClarificationAnswers } from '@/components/dashboard/ClarificationAnswers';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, CardTitle, KeyValueList } from '@/components/ui/Card';
import { TextField, TextAreaField } from '@/components/ui/Field';
import { Avatar, Badge, FileRow, PageHeader, Stars, Stat } from '@/components/ui/bits';
import { EmptyState, FormError, PageLoader } from '@/components/ui/states';
import { useDialogs } from '@/components/ui/dialogs';
import {
  getProjectDetails,
  updateProject,
  submitProject,
  cancelProject,
  getProjectFile,
  getArtworkDownloadUrl,
  UNSURE,
  type ProjectRow,
  type ProjectUpdate,
} from '@/lib/api/projects';
import { getProjectQuotes, type QuoteWithPartner } from '@/lib/api/quotes';
import { getProjectQuestions, answerClarificationQuestion, type OpportunityQuestion } from '@/lib/api/opportunities';
import { selectQuote, getOrderByProject, getOrderEvents, type OrderRow, type OrderStatusEventRow } from '@/lib/api/orders';
import { getReviewByOrder, type ReviewRow } from '@/lib/api/reviews';
import { createBookingCheckout, getBookingPayment, type BookingPaymentRow } from '@/lib/api/payments';
import { formatPHP } from '@/lib/pricing';
import { formatDate, peso } from '@/lib/format';
import { validateProjectForSubmit, projectIsEditable, type OrderStatus, type ProjectStatus } from '@/lib/validation';
import { CATEGORIES } from '@/data/catalog';
import { SearchX } from 'lucide-react';

function categoryName(id: string) {
  return CATEGORIES.find((c) => c.id === id)?.name ?? id;
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [project, setProject] = useState<ProjectRow | null | undefined>(undefined);
  const [quotes, setQuotes] = useState<QuoteWithPartner[]>([]);
  const [order, setOrder] = useState<OrderRow | null>(null);
  const [events, setEvents] = useState<OrderStatusEventRow[]>([]);
  const [review, setReview] = useState<ReviewRow | null>(null);
  const [bookingPayment, setBookingPayment] = useState<BookingPaymentRow | null>(null);
  const [artworkName, setArtworkName] = useState<string | null>(null);
  const [artworkPath, setArtworkPath] = useState<string | null>(null);
  const [questions, setQuestions] = useState<OpportunityQuestion[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [payBusy, setPayBusy] = useState(false);
  const { confirm } = useDialogs();

  const load = useCallback(async () => {
    if (!id) return;
    const p = await getProjectDetails(id);
    setProject(p);
    if (!p) return;

    if (p.status !== 'DRAFT') {
      const q = await getProjectQuotes(id);
      setQuotes(q);
      // Secondary content: a failure here should not blank the whole page.
      setQuestions(await getProjectQuestions(id).catch(() => []));
    }

    const file = await getProjectFile(id);
    setArtworkName(file?.file_name ?? null);
    setArtworkPath(file?.storage_path ?? null);

    if (['PROVIDER_SELECTED', 'IN_PROGRESS', 'READY', 'DELIVERED'].includes(p.status)) {
      const ord = await getOrderByProject(id);
      setOrder(ord);
      if (ord) {
        setEvents(await getOrderEvents(ord.id));
        if (ord.status === 'AWAITING_PAYMENT') {
          setBookingPayment(await getBookingPayment(ord.id));
        }
        if (p.status === 'DELIVERED') {
          setReview(await getReviewByOrder(ord.id));
        }
      }
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (project === undefined) return <PageLoader label="Loading project…" />;

  if (project === null) {
    return (
      <EmptyState
        icon={SearchX}
        tone="grape"
        title="We can't find that project"
        body="This project doesn't exist, or you don't have access to it."
        action={<ButtonLink to="/dashboard">Back to My Projects</ButtonLink>}
      />
    );
  }

  async function handleSubmit() {
    setActionError(null);
    const errors = validateProjectForSubmit({
      title: project!.title,
      category: project!.category,
      description: project!.description ?? '',
      deliveryCity: project!.delivery_city ?? '',
    });
    if (errors.length) {
      setActionError(errors[0]);
      return;
    }
    setBusy(true);
    try {
      await submitProject(project!.id);
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not submit this project.');
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    const draft = project!.status === 'DRAFT';
    const ok = await confirm({
      title: draft ? 'Delete this draft?' : 'Cancel this project?',
      body: 'This cannot be undone.',
      confirmLabel: draft ? 'Delete draft' : 'Cancel project',
      cancelLabel: 'Keep it',
      tone: 'danger',
    });
    if (!ok) return;
    setBusy(true);
    setActionError(null);
    try {
      await cancelProject(project!.id);
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not cancel this project.');
    } finally {
      setBusy(false);
    }
  }

  async function handleChoose(quoteId: string) {
    const ok = await confirm({
      title: 'Choose this printing partner?',
      body: 'Other quotations will no longer be available.',
      confirmLabel: 'Choose this provider',
    });
    if (!ok) return;
    setBusy(true);
    setActionError(null);
    try {
      await selectQuote(quoteId);
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not select this quotation.');
    } finally {
      setBusy(false);
    }
  }

  async function handlePayNow() {
    if (!order) return;
    setPayBusy(true);
    setActionError(null);
    try {
      const { checkoutUrl } = await createBookingCheckout(order.id);
      window.location.href = checkoutUrl;
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not start checkout.');
      setPayBusy(false);
    }
  }

  async function handleDownloadArtwork() {
    if (!artworkPath) return;
    const url = await getArtworkDownloadUrl(artworkPath);
    window.open(url, '_blank');
  }

  const submittedQuotes = quotes.filter((q) => q.status === 'SUBMITTED');
  const historicalQuotes = quotes.filter((q) => q.status === 'NOT_SELECTED' || q.status === 'SELECTED');
  const hasProvider = ['PROVIDER_SELECTED', 'IN_PROGRESS', 'READY', 'DELIVERED'].includes(project.status);

  return (
    <>
      <PageHeader
        back={{ to: '/dashboard', label: 'My Projects' }}
        title={project.title}
        subtitle={categoryName(project.category)}
        badge={<ProjectStatusBadge status={project.status} />}
      />

      {actionError && (
        <div className="mb-5">
          <FormError>{actionError}</FormError>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <div className="space-y-5">
          {/* What needs doing comes first; the brief it refers to sits underneath. */}
          {order && order.status === 'AWAITING_PAYMENT' && bookingPayment && (
            <BookingFeeCard payment={bookingPayment} onPay={handlePayNow} busy={payBusy} />
          )}

          {order && order.status === 'DELIVERED' && !review && <ReviewForm orderId={order.id} onSubmitted={load} />}

          <ClarificationAnswers
            items={questions.map((q) => ({
              id: q.id,
              askerName: q.partner?.business_name ?? 'A printing partner',
              question: q.question,
              answer: q.answer,
            }))}
            askerNoun="printing partner"
            onAnswer={async (id, answer) => {
              await answerClarificationQuestion(id, answer);
              await load();
            }}
          />

          {project.status === 'OPEN_FOR_QUOTES' && <QuoteComparison quotes={submittedQuotes} onChoose={handleChoose} busy={busy} />}

          <ProjectSummaryCard
            project={project}
            artworkName={artworkName}
            onDownloadArtwork={handleDownloadArtwork}
            editable={projectIsEditable(project.status as ProjectStatus)}
            onSave={async (patch) => {
              setBusy(true);
              setActionError(null);
              try {
                await updateProject(project.id, patch);
                await load();
              } catch (e) {
                setActionError(e instanceof Error ? e.message : 'Could not save your changes.');
              } finally {
                setBusy(false);
              }
            }}
          />

          {project.status === 'DRAFT' && (
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <Button variant="accent" size="lg" onClick={handleSubmit} disabled={busy} icon={<Send className="h-5 w-5" />}>
                Send to printing partners
              </Button>
              <Button variant="danger" size="lg" onClick={handleCancel} disabled={busy} icon={<Ban className="h-5 w-5" />}>
                Delete draft
              </Button>
            </div>
          )}

          {project.status === 'OPEN_FOR_QUOTES' && (
            <Button variant="danger" onClick={handleCancel} disabled={busy} icon={<Ban className="h-5 w-5" />}>
              Cancel project
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
          {hasProvider && <SelectedProviderCard quote={quotes.find((q) => q.status === 'SELECTED') ?? null} />}

          {order && (
            <Card>
              <CardTitle>Order timeline</CardTitle>
              <div className="mt-5">
                <OrderTimeline currentStatus={order.status as OrderStatus} events={events} />
              </div>
            </Card>
          )}

          {historicalQuotes.length > 0 && project.status === 'DELIVERED' && (
            <Card>
              <CardTitle>Quotation history</CardTitle>
              <ul className="mt-4 space-y-3">
                {quotes.map((q) => (
                  <li key={q.id} className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate font-medium text-ink-800">{q.partner?.business_name}</span>
                    <QuoteStatusBadge status={q.status} />
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
  quantity: string;
  size_spec: string;
  material_pref: string;
  finishing_pref: string;
  target_date: string;
  delivery_city: string;
  notes: string;
};

/** "unsure" is a stored sentinel, not something to show a person. */
function readable(value: string | null) {
  return value === UNSURE ? "Not sure — recommend for me" : value;
}

function ProjectSummaryCard({
  project,
  artworkName,
  onDownloadArtwork,
  editable,
  onSave,
}: {
  project: ProjectRow;
  artworkName: string | null;
  onDownloadArtwork: () => void;
  editable: boolean;
  onSave: (patch: Partial<ProjectUpdate>) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<EditableFields>(toForm(project));
  const [saving, setSaving] = useState(false);

  function toForm(p: ProjectRow): EditableFields {
    return {
      description: p.description ?? '',
      quantity: p.quantity ? String(p.quantity) : '',
      size_spec: p.size_spec ?? '',
      material_pref: p.material_pref ?? '',
      finishing_pref: p.finishing_pref ?? '',
      target_date: p.target_date ?? '',
      delivery_city: p.delivery_city ?? '',
      notes: p.notes ?? '',
    };
  }

  const set = (key: keyof EditableFields) => (v: string) => setForm((f) => ({ ...f, [key]: v }));

  if (editing) {
    return (
      <Card className="ring-2 ring-ink-950">
        <CardTitle>Edit project details</CardTitle>
        <div className="mt-5 space-y-4">
          <TextAreaField label="Description" value={form.description} onChange={set('description')} rows={3} />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Quantity" type="number" inputMode="numeric" value={form.quantity} onChange={set('quantity')} />
            <TextField label="Target date" type="date" value={form.target_date} onChange={set('target_date')} />
          </div>
          <TextField label="Size / dimensions" value={form.size_spec} onChange={set('size_spec')} />
          <TextField label="Material preference" value={form.material_pref} onChange={set('material_pref')} />
          <TextField label="Finishing preference" value={form.finishing_pref} onChange={set('finishing_pref')} />
          <TextField label="Delivery city" value={form.delivery_city} onChange={set('delivery_city')} />
          <TextAreaField label="Notes" value={form.notes} onChange={set('notes')} rows={2} />
        </div>
        <div className="mt-5 flex gap-2.5">
          <Button
            loading={saving}
            onClick={async () => {
              setSaving(true);
              await onSave({
                description: form.description,
                quantity: form.quantity ? Number(form.quantity) : null,
                size_spec: form.size_spec || null,
                material_pref: form.material_pref || null,
                finishing_pref: form.finishing_pref || null,
                target_date: form.target_date || null,
                delivery_city: form.delivery_city,
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
              setForm(toForm(project));
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
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)} icon={<Pencil className="h-4 w-4" />}>
              Edit
            </Button>
          ) : undefined
        }
      >
        Project brief
      </CardTitle>
      <div className="mt-4">
        <KeyValueList
          rows={[
            { label: 'Description', value: project.description },
            { label: 'Quantity', value: project.quantity ? project.quantity.toLocaleString('en-PH') : project.quantity_note },
            { label: 'Size / dimensions', value: readable(project.size_spec) },
            { label: 'Material preference', value: readable(project.material_pref) },
            { label: 'Finishing preference', value: readable(project.finishing_pref) },
            { label: 'Target date', value: project.target_date ? formatDate(project.target_date, true) : null },
            { label: 'Delivery city', value: project.delivery_city },
            { label: 'Notes', value: project.notes },
          ]}
        />
      </div>
      {artworkName && (
        <div className="mt-4">
          <p className="mb-2 text-sm font-bold text-ink-500">Artwork</p>
          <FileRow name={artworkName} meta="Tap to download" onDownload={onDownloadArtwork} />
        </div>
      )}
    </Card>
  );
}

function QuoteComparison({
  quotes,
  onChoose,
  busy,
}: {
  quotes: QuoteWithPartner[];
  onChoose: (id: string) => void;
  busy: boolean;
}) {
  if (quotes.length === 0) {
    return (
      <Card tone="cyan" className="relative overflow-hidden">
        <span className="pointer-events-none absolute -right-6 -top-8 h-32 w-44 bg-halftone bg-dots text-cyan-500/30" aria-hidden="true" />
        <p className="slug text-cyan-700">Matching</p>
        <h2 className="mt-2 text-2xl text-ink-950">We&apos;re looking for the right printing partner.</h2>
        <p className="mt-2 text-ink-700">Quotations will land here as partners respond. There&apos;s nothing you need to do yet.</p>
      </Card>
    );
  }

  // Facts, not a verdict: the customer still chooses. With one quote there is nothing to compare.
  const lowest = quotes.length > 1 ? Math.min(...quotes.map((q) => Number(q.total_price))) : null;
  const fastest = quotes.length > 1 ? Math.min(...quotes.map((q) => Number(q.turnaround_days))) : null;

  return (
    <section>
      <h2 className="mb-3 text-2xl text-ink-950">
        {quotes.length} quotation{quotes.length === 1 ? '' : 's'} received
      </h2>
      <div className="space-y-3">
        {quotes.map((q) => (
          <Card key={q.id} className="transition-shadow hover:shadow-card">
            <div className="flex items-start gap-3.5">
              <Avatar name={q.partner?.business_name ?? 'Partner'} square className="h-12 w-12 text-base" />
              <div className="min-w-0 flex-1">
                <Link to={`/partners/${q.partner_id}`} className="block truncate font-display text-lg font-bold text-ink-950 hover:underline">
                  {q.partner?.business_name}
                </Link>
                <p className="flex items-center gap-1 text-sm text-ink-500">
                  <MapPin className="h-3.5 w-3.5" /> {q.partner?.city}
                </p>
              </div>
              <p className="shrink-0 font-display text-2xl font-extrabold text-ink-950">{peso(q.total_price)}</p>
            </div>

            {(Number(q.total_price) === lowest || Number(q.turnaround_days) === fastest) && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {Number(q.total_price) === lowest && (
                  <Badge tone="leaf" dot={false}>
                    <BadgePercent className="h-3.5 w-3.5" /> Lowest price
                  </Badge>
                )}
                {Number(q.turnaround_days) === fastest && (
                  <Badge tone="cyan" dot={false}>
                    <Zap className="h-3.5 w-3.5" /> Fastest
                  </Badge>
                )}
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 rounded-2xl bg-ink-50 p-4 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
              <Stat label="Down payment" value={`${q.down_payment_pct}%`} />
              <Stat label="Turnaround" icon={<Clock className="h-3.5 w-3.5" />} value={`${q.turnaround_days} days`} />
              <Stat label="Est. completion" value={formatDate(q.estimated_completion)} />
              <Stat label="Delivery" icon={<Truck className="h-3.5 w-3.5" />} value={q.delivery_available ? 'Available' : 'Pickup only'} />
            </div>

            {q.note && <p className="mt-4 rounded-2xl rounded-tl-md bg-sun-50 px-4 py-3 text-ink-800">&ldquo;{q.note}&rdquo;</p>}

            <div className="mt-5 flex flex-col-reverse gap-2.5 sm:flex-row sm:items-center sm:justify-between">
              <ButtonLink to={`/partners/${q.partner_id}`} variant="ghost">
                View provider profile
              </ButtonLink>
              <Button onClick={() => onChoose(q.id)} disabled={busy}>
                Choose this provider
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}

function BookingFeeCard({
  payment,
  onPay,
  busy,
}: {
  payment: BookingPaymentRow;
  onPay: () => void;
  busy: boolean;
}) {
  const failed = payment.status === 'failed' || payment.status === 'expired';
  return (
    <Card tone="ink" className="relative overflow-hidden">
      <span className="pointer-events-none absolute -right-8 -top-10 h-40 w-52 bg-halftone bg-dots text-white/10" aria-hidden="true" />
      <p className="slug text-sun-300">
        <Wallet className="h-3.5 w-3.5" /> Platform fee required
      </p>
      <p className="relative mt-3 font-display text-5xl font-extrabold tracking-tight">{formatPHP(Number(payment.amount))}</p>
      <p className="relative mt-3 text-white/70">
        Pay PrintAir&apos;s platform fee to confirm this order and notify your printing partner. This is separate from the job price,
        which is paid directly to the partner.
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

function SelectedProviderCard({ quote }: { quote: QuoteWithPartner | null }) {
  if (!quote) return null;
  return (
    <Card tone="cyan">
      <p className="slug text-cyan-800">Your printing partner</p>
      <div className="mt-3 flex items-center gap-3.5">
        <Avatar name={quote.partner?.business_name ?? 'Partner'} square className="h-12 w-12 text-base" />
        <div className="min-w-0">
          <Link to={`/partners/${quote.partner_id}`} className="block truncate font-display text-xl font-bold text-ink-950 hover:underline">
            {quote.partner?.business_name}
          </Link>
          <p className="flex items-center gap-1 text-sm text-ink-600">
            <MapPin className="h-3.5 w-3.5" /> {quote.partner?.city}
          </p>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-3 rounded-2xl bg-white/70 p-4">
        <Stat label="Price" value={peso(quote.total_price)} />
        <Stat label="Down" value={`${quote.down_payment_pct}%`} />
        <Stat label="Turnaround" value={`${quote.turnaround_days}d`} />
      </div>
    </Card>
  );
}
