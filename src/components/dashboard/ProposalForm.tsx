import { useState } from 'react';
import { Ban, Save, Send, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardTitle } from '@/components/ui/Card';
import { TextField, TextAreaField } from '@/components/ui/Field';
import { FormError } from '@/components/ui/states';
import { useDialogs } from '@/components/ui/dialogs';
import { updateProposal, submitProposal, withdrawProposal, type DesignProposalRow } from '@/lib/api/designProposals';
import { validateProposalForSubmit } from '@/lib/validation';

/** Mirrors QuoteForm, with a revision-rounds field quotes have no equivalent of. */
export function ProposalForm({ proposal, onChanged }: { proposal: DesignProposalRow; onChanged: () => void }) {
  const editable = proposal.status === 'DRAFT' || proposal.status === 'SUBMITTED';
  const [price, setPrice] = useState(proposal.price != null ? String(proposal.price) : '');
  const [downPaymentPct, setDownPaymentPct] = useState(proposal.down_payment_pct != null ? String(proposal.down_payment_pct) : '');
  const [turnaroundDays, setTurnaroundDays] = useState(proposal.turnaround_days != null ? String(proposal.turnaround_days) : '');
  const [revisionRounds, setRevisionRounds] = useState(String(proposal.revision_rounds_included));
  const [note, setNote] = useState(proposal.note ?? '');
  const [validUntil, setValidUntil] = useState(proposal.valid_until ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'save' | 'submit' | 'withdraw' | null>(null);
  const { confirm } = useDialogs();

  async function persist() {
    await updateProposal(proposal.id, {
      price: price ? Number(price) : null,
      downPaymentPct: downPaymentPct ? Number(downPaymentPct) : null,
      turnaroundDays: turnaroundDays ? Number(turnaroundDays) : null,
      revisionRoundsIncluded: revisionRounds ? Number(revisionRounds) : undefined,
      note: note || null,
      validUntil: validUntil || null,
    });
  }

  async function handleSaveDraft() {
    setError(null);
    setBusy('save');
    try {
      await persist();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your proposal.');
    } finally {
      setBusy(null);
    }
  }

  async function handleSubmit() {
    setError(null);
    const errors = validateProposalForSubmit({
      price: price ? Number(price) : null,
      downPaymentPct: downPaymentPct ? Number(downPaymentPct) : null,
      turnaroundDays: turnaroundDays ? Number(turnaroundDays) : null,
      validUntil: validUntil || null,
    });
    if (errors.length) {
      setError(errors[0]);
      return;
    }
    setBusy('submit');
    try {
      await persist();
      await submitProposal(proposal.id);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit your proposal.');
    } finally {
      setBusy(null);
    }
  }

  async function handleWithdraw() {
    if (
      !(await confirm({
        title: 'Withdraw this proposal?',
        body: 'The customer will no longer see it.',
        confirmLabel: 'Withdraw',
        cancelLabel: 'Keep it',
        tone: 'danger',
      }))
    )
      return;
    setBusy('withdraw');
    setError(null);
    try {
      await withdrawProposal(proposal.id);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not withdraw your proposal.');
    } finally {
      setBusy(null);
    }
  }

  if (!editable) {
    const won = proposal.status === 'SELECTED';
    return (
      <Card tone={won ? 'leaf' : 'plain'}>
        <p className={`flex items-start gap-3 font-medium ${won ? 'text-leaf-800' : 'text-ink-700'}`}>
          {won && (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-leaf-700">
              <Trophy className="h-5 w-5" />
            </span>
          )}
          <span className={won ? 'mt-2' : ''}>
            This proposal is {proposal.status === 'SELECTED' ? 'selected — you won this commission.' : proposal.status.toLowerCase().replace('_', ' ') + '.'}
          </span>
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <CardTitle>{proposal.status === 'DRAFT' ? 'Prepare your proposal' : 'Edit your proposal'}</CardTitle>
      <p className="mt-1.5 text-sm text-ink-600">Amounts shown are quoted in Philippine Pesos (₱). Payment happens through PrintAir.</p>

      <div className="mt-5 space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField label="Price (₱)" type="number" inputMode="decimal" value={price} onChange={setPrice} placeholder="8500" />
          <TextField label="Down payment (%)" type="number" inputMode="decimal" value={downPaymentPct} onChange={setDownPaymentPct} placeholder="50" />
          <TextField label="Turnaround (days)" type="number" inputMode="numeric" value={turnaroundDays} onChange={setTurnaroundDays} placeholder="5" />
          <TextField label="Revision rounds included" type="number" inputMode="numeric" value={revisionRounds} onChange={setRevisionRounds} placeholder="2" />
          <TextField label="Valid until" type="date" value={validUntil} onChange={setValidUntil} />
        </div>

        <TextAreaField
          label="Note to customer (optional)"
          value={note}
          onChange={setNote}
          rows={3}
          placeholder="What's included, your process, or anything the customer should know."
        />

        <FormError>{error}</FormError>

        <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
          <Button variant="accent" onClick={handleSubmit} loading={busy === 'submit'} disabled={busy !== null} icon={<Send className="h-4 w-4" />}>
            Submit proposal
          </Button>
          <Button variant="secondary" onClick={handleSaveDraft} loading={busy === 'save'} disabled={busy !== null} icon={<Save className="h-4 w-4" />}>
            Save draft
          </Button>
          {proposal.status === 'SUBMITTED' && (
            <Button variant="danger" onClick={handleWithdraw} loading={busy === 'withdraw'} disabled={busy !== null} icon={<Ban className="h-4 w-4" />}>
              Withdraw
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
