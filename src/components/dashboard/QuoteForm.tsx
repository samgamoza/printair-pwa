import { useState } from 'react';
import { Save, Send, Ban, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardTitle } from '@/components/ui/Card';
import { TextField, TextAreaField, Switch } from '@/components/ui/Field';
import { FormError } from '@/components/ui/states';
import { useDialogs } from '@/components/ui/dialogs';
import { updateQuote, submitQuote, withdrawQuote, type QuoteRow } from '@/lib/api/quotes';
import { validateQuoteForSubmit } from '@/lib/validation';

export function QuoteForm({ quote, onChanged }: { quote: QuoteRow; onChanged: () => void }) {
  const editable = quote.status === 'DRAFT' || quote.status === 'SUBMITTED';
  const [totalPrice, setTotalPrice] = useState(quote.total_price != null ? String(quote.total_price) : '');
  const [downPaymentPct, setDownPaymentPct] = useState(quote.down_payment_pct != null ? String(quote.down_payment_pct) : '');
  const [turnaroundDays, setTurnaroundDays] = useState(quote.turnaround_days != null ? String(quote.turnaround_days) : '');
  const [estimatedCompletion, setEstimatedCompletion] = useState(quote.estimated_completion ?? '');
  const [deliveryAvailable, setDeliveryAvailable] = useState(quote.delivery_available);
  const [note, setNote] = useState(quote.note ?? '');
  const [validUntil, setValidUntil] = useState(quote.valid_until ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'save' | 'submit' | 'withdraw' | null>(null);
  const { confirm } = useDialogs();

  async function persist() {
    await updateQuote(quote.id, {
      totalPrice: totalPrice ? Number(totalPrice) : null,
      downPaymentPct: downPaymentPct ? Number(downPaymentPct) : null,
      turnaroundDays: turnaroundDays ? Number(turnaroundDays) : null,
      estimatedCompletion: estimatedCompletion || null,
      deliveryAvailable,
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
      setError(e instanceof Error ? e.message : 'Could not save your quotation.');
    } finally {
      setBusy(null);
    }
  }

  async function handleSubmit() {
    setError(null);
    const errors = validateQuoteForSubmit({
      totalPrice: totalPrice ? Number(totalPrice) : null,
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
      await submitQuote(quote.id);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit your quotation.');
    } finally {
      setBusy(null);
    }
  }

  async function handleWithdraw() {
    if (
      !(await confirm({
        title: 'Withdraw this quotation?',
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
      await withdrawQuote(quote.id);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not withdraw your quotation.');
    } finally {
      setBusy(null);
    }
  }

  if (!editable) {
    const won = quote.status === 'SELECTED';
    return (
      <Card tone={won ? 'leaf' : 'plain'} className={won ? '' : 'bg-ink-50 shadow-none'}>
        <p className={`flex items-start gap-3 font-bold ${won ? 'text-leaf-800' : 'text-ink-600'}`}>
          {won && <Trophy className="mt-0.5 h-5 w-5 shrink-0 text-leaf-600" />}
          <span>
            This quotation is {won ? 'selected — you won this project.' : quote.status.toLowerCase().replace('_', ' ') + '.'}
          </span>
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <CardTitle>{quote.status === 'DRAFT' ? 'Prepare your quotation' : 'Edit your quotation'}</CardTitle>
      <p className="mt-1.5 text-sm text-ink-600">Amounts shown are quoted in Philippine Pesos (₱). Payment happens outside PrintAir.</p>

      <div className="mt-5 space-y-5">
        <TextField
          label="Total price (₱)"
          type="number"
          inputMode="decimal"
          value={totalPrice}
          onChange={setTotalPrice}
          placeholder="18500"
        />
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Down payment (%)"
            type="number"
            inputMode="decimal"
            value={downPaymentPct}
            onChange={setDownPaymentPct}
            placeholder="50"
          />
          <TextField
            label="Turnaround (days)"
            type="number"
            inputMode="numeric"
            value={turnaroundDays}
            onChange={setTurnaroundDays}
            placeholder="12"
          />
        </div>
        <div className="grid gap-5 sm:grid-cols-2 sm:gap-3">
          <TextField label="Estimated completion" type="date" value={estimatedCompletion} onChange={setEstimatedCompletion} />
          <TextField label="Valid until" type="date" value={validUntil} onChange={setValidUntil} />
        </div>
        <div>
          <Switch checked={deliveryAvailable} onChange={(v) => setDeliveryAvailable(v)} label="Delivery available" />
          <p className="mt-1.5 text-sm text-ink-500">{deliveryAvailable ? 'Delivery available' : 'Pickup only'}</p>
        </div>
        <TextAreaField
          label="Note to customer (optional)"
          value={note}
          onChange={setNote}
          rows={2}
          placeholder="What's included, or anything the customer should know."
        />
      </div>

      <div className="mt-5 space-y-3">
        <FormError>{error}</FormError>
        <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
          <Button
            variant="accent"
            onClick={handleSubmit}
            disabled={busy !== null}
            loading={busy === 'submit'}
            icon={<Send className="h-4 w-4" />}
            className="sm:order-2"
          >
            Submit quotation
          </Button>
          <Button
            variant="secondary"
            onClick={handleSaveDraft}
            disabled={busy !== null}
            loading={busy === 'save'}
            icon={<Save className="h-4 w-4" />}
            className="sm:order-1"
          >
            Save draft
          </Button>
          {quote.status === 'SUBMITTED' && (
            <Button
              variant="danger"
              onClick={handleWithdraw}
              disabled={busy !== null}
              loading={busy === 'withdraw'}
              icon={<Ban className="h-4 w-4" />}
              className="sm:order-3"
            >
              Withdraw
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
