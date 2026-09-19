import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Field, Segmented, TextAreaField } from '@/components/ui/Field';
import { StarInput } from '@/components/ui/bits';
import { FormError } from '@/components/ui/states';
import { isValidRating } from '@/lib/validation';

/**
 * The review form both marketplaces share. The caller supplies only what
 * differs: who is being reviewed, and the call that saves it.
 */
export function ReviewFormView({
  subject,
  delivered = 'project',
  onSave,
  onSubmitted,
}: {
  /** e.g. 'partner' / 'designer' — completes "would you work with this … again". */
  subject: string;
  /** What was delivered: 'project' or 'design'. */
  delivered?: string;
  onSave: (input: { rating: number; comment?: string; wouldWorkAgain: boolean }) => Promise<unknown>;
  onSubmitted: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [wouldWorkAgain, setWouldWorkAgain] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    if (!isValidRating(rating)) {
      setError('Choose a rating from 1 to 5.');
      return;
    }
    if (wouldWorkAgain === null) {
      setError(`Let us know if you would work with this ${subject} again.`);
      return;
    }
    setSubmitting(true);
    try {
      await onSave({ rating, comment: comment || undefined, wouldWorkAgain });
      onSubmitted();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit your review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card tone="sun">
      <h2 className="text-2xl text-ink-950">Leave a review</h2>
      <p className="mt-1 text-ink-700">Your {delivered} was delivered — how was your experience?</p>

      <div className="mt-5 space-y-5">
        <StarInput value={rating} onChange={setRating} />
        <TextAreaField label="Comment (optional)" value={comment} onChange={setComment} placeholder="What went well? Anything that could improve?" />
        <Field label="Would you work with them again?">
          <Segmented
            value={wouldWorkAgain}
            onChange={setWouldWorkAgain}
            options={[
              { value: true, label: 'Yes' },
              { value: false, label: 'No' },
            ]}
          />
        </Field>
        <FormError>{error}</FormError>
        <Button onClick={handleSubmit} loading={submitting}>
          Submit review
        </Button>
      </div>
    </Card>
  );
}
