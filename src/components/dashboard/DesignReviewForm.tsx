import { createDesignReview } from '@/lib/api/designReviews';
import { ReviewFormView } from './ReviewFormView';

/** Mirrors ReviewForm, writing to design_reviews via create_design_review(). */
export function DesignReviewForm({ orderId, onSubmitted }: { orderId: string; onSubmitted: () => void }) {
  return <ReviewFormView subject="designer" delivered="design" onSubmitted={onSubmitted} onSave={(input) => createDesignReview({ orderId, ...input })} />;
}
