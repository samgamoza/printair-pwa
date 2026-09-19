import { createReview } from '@/lib/api/reviews';
import { ReviewFormView } from './ReviewFormView';

export function ReviewForm({ orderId, onSubmitted }: { orderId: string; onSubmitted: () => void }) {
  return <ReviewFormView subject="partner" onSubmitted={onSubmitted} onSave={(input) => createReview({ orderId, ...input })} />;
}
