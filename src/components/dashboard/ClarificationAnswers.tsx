import { useState } from 'react';
import { MessageCircleQuestion, Send } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardTitle } from '@/components/ui/Card';
import { Avatar, Badge } from '@/components/ui/bits';
import { FormError } from '@/components/ui/states';

export type ClarificationItem = {
  id: string;
  askerName: string;
  question: string | null;
  answer: string | null;
};

/**
 * The customer's half of the clarification exchange, shared by the print and
 * design request pages.
 *
 * Both marketplaces let the responding side ask exactly one question before
 * quoting, and both told them "waiting for the customer to reply" — but no
 * screen ever let the customer reply. The API call and the RLS policy both
 * existed; only this was missing. A question that cannot be answered is worse
 * than no question feature at all, because it promises a reply that never
 * comes and stalls the quote.
 *
 * Renders nothing when there is nothing to answer, so it can sit
 * unconditionally in either page.
 */
export function ClarificationAnswers({
  items,
  onAnswer,
  askerNoun,
}: {
  items: ClarificationItem[];
  onAnswer: (id: string, answer: string) => Promise<void>;
  /** e.g. 'printing partner' / 'designer' — used in the empty and helper copy. */
  askerNoun: string;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (items.length === 0) return null;

  const unanswered = items.filter((i) => !i.answer);

  async function submit(id: string) {
    const text = (drafts[id] ?? '').trim();
    if (!text) return;
    setBusyId(id);
    setError(null);
    try {
      await onAnswer(id, text);
      setDrafts((d) => ({ ...d, [id]: '' }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send your reply.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card>
      <CardTitle
        icon={<MessageCircleQuestion className="h-5 w-5 text-grape-600" />}
        action={unanswered.length > 0 ? <Badge tone="magenta">{unanswered.length} waiting</Badge> : undefined}
      >
        Questions from {askerNoun}s
      </CardTitle>
      {unanswered.length > 0 && (
        <p className="mt-1.5 text-sm text-ink-600">
          {unanswered.length} {unanswered.length === 1 ? 'question is' : 'questions are'} waiting on you. Answering usually means a
          faster, more accurate quote.
        </p>
      )}

      {error && (
        <div className="mt-4">
          <FormError>{error}</FormError>
        </div>
      )}

      <div className="mt-5 space-y-5">
        {items.map((item) => (
          <div key={item.id}>
            {/* Their question, as a chat bubble from the left… */}
            <div className="flex items-start gap-3">
              <Avatar name={item.askerName} className="h-9 w-9 text-xs" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-ink-500">{item.askerName}</p>
                <p className="mt-1 inline-block rounded-3xl rounded-tl-md bg-ink-100 px-4 py-2.5 text-ink-900">{item.question}</p>
              </div>
            </div>

            {/* …and the reply from the right. */}
            {item.answer ? (
              <div className="mt-2.5 flex justify-end">
                <p className="max-w-[85%] rounded-3xl rounded-tr-md bg-ink-950 px-4 py-2.5 text-white">
                  <span className="sr-only">You replied: </span>
                  {item.answer}
                </p>
              </div>
            ) : (
              <div className="mt-3 pl-12">
                <textarea
                  value={drafts[item.id] ?? ''}
                  onChange={(e) => setDrafts((d) => ({ ...d, [item.id]: e.target.value }))}
                  rows={2}
                  placeholder="Your reply…"
                  aria-label={`Reply to ${item.askerName}`}
                  className="control resize-none"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-2"
                  onClick={() => submit(item.id)}
                  loading={busyId === item.id}
                  disabled={!(drafts[item.id] ?? '').trim()}
                  icon={<Send className="h-4 w-4" />}
                >
                  Send reply
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
