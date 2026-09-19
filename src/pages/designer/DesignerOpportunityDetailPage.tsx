import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Ban, Info, MessageCircleQuestion, PenLine, SearchX, Send } from 'lucide-react';
import { DesignOpportunityStatusBadge } from '@/components/dashboard/StatusBadge';
import { ProposalForm } from '@/components/dashboard/ProposalForm';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, CardTitle, KeyValueList } from '@/components/ui/Card';
import { FileRow, PageHeader } from '@/components/ui/bits';
import { EmptyState, FormError, PageLoader } from '@/components/ui/states';
import { useDialogs } from '@/components/ui/dialogs';
import { useAuth } from '@/contexts/AuthContext';
import {
  getDesignOpportunity,
  markDesignOpportunityViewed,
  declineDesignOpportunity,
  askDesignClarificationQuestion,
  type DesignOpportunityWithRequest,
} from '@/lib/api/designer';
import { getDesignRequestFiles, getBriefDownloadUrl, type DesignRequestFileRow } from '@/lib/api/designRequests';
import { createProposalDraft, getMyProposal, type DesignProposalRow } from '@/lib/api/designProposals';
import { DESIGN_SPECIALTIES } from '@/data/catalog';
import { formatDate, peso } from '@/lib/format';

function specialtyName(id: string) {
  return DESIGN_SPECIALTIES.find((s) => s.id === id)?.name ?? id;
}

export default function DesignerOpportunityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { designerProfile } = useAuth();
  const [opp, setOpp] = useState<DesignOpportunityWithRequest | null | undefined>(undefined);
  const [files, setFiles] = useState<DesignRequestFileRow[]>([]);
  const [proposal, setProposal] = useState<DesignProposalRow | null>(null);
  const [question, setQuestion] = useState('');
  const [askingQuestion, setAskingQuestion] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { confirm } = useDialogs();

  const load = useCallback(async () => {
    if (!id || !designerProfile) return;
    let o: DesignOpportunityWithRequest | null;
    try {
      o = await getDesignOpportunity(id);
    } catch {
      // Otherwise the page sits on "Loading opportunity…" indefinitely.
      setOpp(null);
      return;
    }
    setOpp(o);
    if (o) {
      setFiles(await getDesignRequestFiles(o.request_id).catch(() => []));
      const p = await getMyProposal(o.request_id, designerProfile.id).catch(() => null);
      setProposal(p);
      // Best-effort: failing to flip NEW -> VIEWED must not break the page.
      if (o.status === 'NEW') await markDesignOpportunityViewed(o.id).catch(() => {});
    }
  }, [id, designerProfile]);

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
        action={<ButtonLink to="/designer/opportunities">Back to Job Board</ButtonLink>}
      />
    );
  }

  const r = opp.request;

  async function handleDecline() {
    if (
      !(await confirm({
        title: 'Decline this opportunity?',
        body: 'You can still change your mind and propose later, unless the request closes.',
        confirmLabel: 'Decline',
        cancelLabel: 'Keep it',
        tone: 'danger',
      }))
    )
      return;
    setBusy(true);
    try {
      await declineDesignOpportunity(opp!.id);
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
      await askDesignClarificationQuestion(opp!.id, question.trim());
      await load();
    } catch {
      setError('Could not send your question. Please try again.');
    } finally {
      setAskingQuestion(false);
    }
  }

  async function handleStartProposal() {
    if (!designerProfile) return;
    setBusy(true);
    setError(null);
    try {
      const p = await createProposalDraft({ requestId: r.id, designerId: designerProfile.id });
      setProposal(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start a proposal.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        back={{ to: '/designer/opportunities', label: 'Job Board' }}
        title={r.title}
        subtitle={specialtyName(r.specialty)}
        badge={<DesignOpportunityStatusBadge status={opp.status} />}
      />

      {/* On a phone the question sits between the brief and the proposal; from `lg` it moves to the side column. */}
      <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <Card className="lg:col-start-1">
          <CardTitle>The brief</CardTitle>
          <div className="mt-4">
            <KeyValueList
              rows={[
                { label: 'Description', value: r.description },
                {
                  label: 'Budget',
                  value: r.budget_min || r.budget_max ? `${peso(r.budget_min)} to ${peso(r.budget_max)}` : null,
                },
                { label: 'Target date', value: r.target_date ? formatDate(r.target_date, true) : null },
                { label: 'Notes', value: r.notes },
              ]}
            />
          </div>

          {files.length > 0 && (
            <div className="mt-5">
              <p className="slug text-ink-500">Reference files</p>
              <div className="mt-2.5 space-y-2">
                {files.map((f) => (
                  <BriefFileLink key={f.id} file={f} />
                ))}
              </div>
            </div>
          )}

          <div className="mt-5 flex items-start gap-2.5 rounded-2xl bg-grape-50 px-4 py-3 text-sm text-grape-900">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-grape-600" />
            Every designer who receives this opportunity can see the same brief and references above.
          </div>
        </Card>

        <Card className="self-start lg:col-start-2 lg:row-span-2">
          <CardTitle icon={<MessageCircleQuestion className="h-5 w-5 text-grape-600" />}>Ask one clarification question</CardTitle>
          {opp.question ? (
            <div className="mt-4 space-y-3">
              {/* Your question from the right… */}
              <div className="flex flex-col items-end">
                <p className="text-xs font-bold text-ink-500">You asked:</p>
                <p className="mt-1 max-w-[90%] rounded-3xl rounded-tr-md bg-ink-950 px-4 py-2.5 text-white">{opp.question}</p>
              </div>
              {/* …and the customer's reply from the left. */}
              {opp.answer ? (
                <div className="flex flex-col items-start">
                  <p className="text-xs font-bold text-ink-500">Customer replied:</p>
                  <p className="mt-1 max-w-[90%] rounded-3xl rounded-tl-md bg-ink-100 px-4 py-2.5 text-ink-900">{opp.answer}</p>
                </div>
              ) : (
                <p className="inline-flex items-center gap-2 rounded-3xl rounded-tl-md bg-ink-50 px-4 py-2.5 text-sm font-medium text-ink-500">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-grape-400" aria-hidden="true" />
                  Waiting for the customer to reply.
                </p>
              )}
            </div>
          ) : (
            <>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                rows={3}
                placeholder="e.g. Do you have brand colors already, or is that open?"
                aria-label="Your clarification question"
                className="control mt-4 resize-none"
              />
              <Button
                variant="secondary"
                className="mt-3"
                onClick={handleAsk}
                loading={askingQuestion}
                disabled={!question.trim()}
                icon={<Send className="h-4 w-4" />}
              >
                Send question
              </Button>
            </>
          )}
        </Card>

        {(opp.status !== 'DECLINED' || error) && (
          <div className="space-y-5 lg:col-start-1">
            {opp.status !== 'DECLINED' && (
              <div>
                {!proposal ? (
                  <div className="flex flex-col gap-2.5 sm:flex-row">
                    <Button variant="primary" size="lg" onClick={handleStartProposal} loading={busy} icon={<PenLine className="h-5 w-5" />}>
                      Submit Proposal
                    </Button>
                    <Button variant="danger" size="lg" onClick={handleDecline} disabled={busy} icon={<Ban className="h-5 w-5" />}>
                      Decline
                    </Button>
                  </div>
                ) : (
                  <ProposalForm proposal={proposal} onChanged={load} />
                )}
              </div>
            )}

            <FormError>{error}</FormError>
          </div>
        )}
      </div>
    </>
  );
}

function BriefFileLink({ file }: { file: DesignRequestFileRow }) {
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
  return <FileRow name={file.file_name} size={file.size_bytes} onDownload={handleDownload} busy={busy} />;
}
