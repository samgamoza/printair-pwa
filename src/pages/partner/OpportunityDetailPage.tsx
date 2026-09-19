import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { MessageCircleQuestion, Ban, Info, Send, SearchX, FilePenLine } from 'lucide-react';
import { OpportunityStatusBadge } from '@/components/dashboard/StatusBadge';
import { QuoteForm } from '@/components/dashboard/QuoteForm';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, CardTitle, KeyValueList } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/bits';
import { EmptyState, FormError, PageLoader } from '@/components/ui/states';
import { useDialogs } from '@/components/ui/dialogs';
import { useAuth } from '@/contexts/AuthContext';
import {
  getOpportunityDetails,
  markOpportunityViewed,
  declineOpportunity,
  askClarificationQuestion,
  type OpportunityWithProject,
} from '@/lib/api/opportunities';
import { createQuoteDraft, getMyQuote, type QuoteRow } from '@/lib/api/quotes';
import { UNSURE } from '@/lib/api/projects';
import { formatDate } from '@/lib/format';
import { CATEGORIES } from '@/data/catalog';

function categoryName(id: string) {
  return CATEGORIES.find((c) => c.id === id)?.name ?? id;
}

/** "unsure" is a stored sentinel, not something to show a person. */
function readable(value: string | null) {
  return value === UNSURE ? 'Not sure — recommend for me' : value;
}

export default function OpportunityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { partnerProfile } = useAuth();
  const [opp, setOpp] = useState<OpportunityWithProject | null | undefined>(undefined);
  const [quote, setQuote] = useState<QuoteRow | null>(null);
  const [question, setQuestion] = useState('');
  const [askingQuestion, setAskingQuestion] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { confirm } = useDialogs();

  const load = useCallback(async () => {
    if (!id || !partnerProfile) return;
    const o = await getOpportunityDetails(id);
    setOpp(o);
    if (o) {
      const q = await getMyQuote(o.project_id, partnerProfile.id);
      setQuote(q);
      if (o.status === 'NEW') await markOpportunityViewed(o.id);
    }
  }, [id, partnerProfile]);

  useEffect(() => {
    load();
  }, [load]);

  if (opp === undefined) return <PageLoader label="Loading opportunity…" />;

  if (opp === null) {
    return (
      <EmptyState
        icon={SearchX}
        tone="grape"
        title="This opportunity is no longer available."
        action={<ButtonLink to="/partner/opportunities">Back to opportunities</ButtonLink>}
      />
    );
  }

  const p = opp.project;

  async function handleDecline() {
    if (
      !(await confirm({
        title: 'Decline this opportunity?',
        body: 'You can still change your mind and quote later, unless the project closes.',
        confirmLabel: 'Decline',
        cancelLabel: 'Keep it',
        tone: 'danger',
      }))
    )
      return;
    setBusy(true);
    try {
      await declineOpportunity(opp!.id);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function handleAsk() {
    if (!question.trim()) return;
    setAskingQuestion(true);
    setError(null);
    try {
      await askClarificationQuestion(opp!.id, question.trim());
      await load();
    } catch {
      setError('Could not send your question. Please try again.');
    } finally {
      setAskingQuestion(false);
    }
  }

  async function handleStartQuote() {
    if (!partnerProfile) return;
    setBusy(true);
    setError(null);
    try {
      const q = await createQuoteDraft({ projectId: p.id, partnerId: partnerProfile.id });
      setQuote(q);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start a quotation.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        back={{ to: '/partner/opportunities', label: 'New Opportunities' }}
        title={p.title}
        subtitle={categoryName(p.category)}
        badge={<OpportunityStatusBadge status={opp.status} />}
      />

      {/* One column on a phone, in reading order: the brief, a question if you have one, then your price.
          From lg the question moves to the side so the brief and the quotation sit together. */}
      <div className="grid items-start gap-5 lg:grid-cols-[1.35fr_1fr]">
        <Card className="lg:col-start-1 lg:row-start-1">
          <CardTitle>Project brief</CardTitle>
          <div className="mt-4">
            <KeyValueList
              rows={[
                { label: 'Description', value: p.description },
                { label: 'Quantity', value: p.quantity ? p.quantity.toLocaleString('en-PH') : p.quantity_note },
                { label: 'Size / dimensions', value: readable(p.size_spec) },
                { label: 'Material preference', value: readable(p.material_pref) },
                { label: 'Finishing preference', value: readable(p.finishing_pref) },
                { label: 'Target date', value: p.target_date ? formatDate(p.target_date, true) : null },
                { label: 'Delivery city', value: p.delivery_city },
                { label: 'Notes', value: p.notes },
              ]}
            />
          </div>
          <div className="mt-4 flex items-start gap-2.5 rounded-2xl bg-ink-50 px-4 py-3 text-sm text-ink-600">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
            If the customer attached reference artwork, it becomes available for download once you&apos;re selected.
          </div>
        </Card>

        <Card className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <CardTitle icon={<MessageCircleQuestion className="h-5 w-5 text-grape-600" />}>Ask one clarification question</CardTitle>
          {opp.question ? (
            <div className="mt-5">
              {/* Your question, from the right… */}
              <div className="flex flex-col items-end">
                <p className="text-xs font-bold text-ink-500">You asked:</p>
                <p className="mt-1 max-w-[85%] rounded-3xl rounded-tr-md bg-ink-950 px-4 py-2.5 text-white">{opp.question}</p>
              </div>
              {/* …and the customer's side from the left. */}
              {opp.answer ? (
                <div className="mt-3">
                  <p className="text-xs font-bold text-ink-500">Customer replied:</p>
                  <p className="mt-1 inline-block max-w-[85%] rounded-3xl rounded-tl-md bg-ink-100 px-4 py-2.5 text-ink-900">{opp.answer}</p>
                </div>
              ) : (
                <div className="mt-3 flex items-center gap-2.5">
                  <span className="inline-flex items-center gap-1 rounded-3xl rounded-tl-md bg-ink-100 px-4 py-3.5" aria-hidden="true">
                    <span className="h-1.5 w-1.5 rounded-full bg-ink-400" />
                    <span className="h-1.5 w-1.5 rounded-full bg-ink-300" />
                    <span className="h-1.5 w-1.5 rounded-full bg-ink-300" />
                  </span>
                  <p className="text-sm font-medium text-ink-500">Waiting for the customer to reply.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-4">
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                rows={2}
                placeholder="e.g. Should the box have a matte or glossy finish?"
                aria-label="Your clarification question"
                className="control resize-none"
              />
              <Button
                variant="secondary"
                className="mt-3"
                onClick={handleAsk}
                loading={askingQuestion}
                disabled={askingQuestion || !question.trim()}
                icon={<Send className="h-4 w-4" />}
              >
                Send question
              </Button>
            </div>
          )}
        </Card>

        <div className="space-y-5 lg:col-start-1 lg:row-start-2">
          <FormError>{error}</FormError>

          {opp.status !== 'DECLINED' &&
            (!quote ? (
              <Card tone="sun" className="relative overflow-hidden">
                <span className="pointer-events-none absolute -right-6 -top-8 h-32 w-44 bg-halftone bg-dots text-sun-500/40" aria-hidden="true" />
                <p className="slug relative text-sun-800">Your move</p>
                <h2 className="relative mt-2 text-2xl text-ink-950">Want this job?</h2>
                <div className="relative mt-5 flex flex-col gap-2.5 sm:flex-row">
                  <Button variant="primary" size="lg" onClick={handleStartQuote} loading={busy} icon={<FilePenLine className="h-5 w-5" />}>
                    Submit Quotation
                  </Button>
                  <Button variant="danger" size="lg" onClick={handleDecline} disabled={busy} icon={<Ban className="h-5 w-5" />}>
                    Decline
                  </Button>
                </div>
              </Card>
            ) : (
              <QuoteForm quote={quote} onChanged={load} />
            ))}
        </div>
      </div>
    </>
  );
}
