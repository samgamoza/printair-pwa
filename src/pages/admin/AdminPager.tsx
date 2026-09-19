import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Eye, EyeOff, ThumbsDown, ThumbsUp } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge, Stars } from '@/components/ui/bits';
import { formatDate } from '@/lib/format';

export function AdminPager({
  page,
  pageSize,
  count,
  onChange,
}: {
  page: number;
  pageSize: number;
  count: number;
  onChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  if (totalPages <= 1) return null;

  // Display only: the rows this page covers, e.g. "26–50 of 132".
  const first = page * pageSize + 1;
  const last = Math.min(count, (page + 1) * pageSize);

  return (
    <nav className="mt-5 flex flex-wrap items-center justify-between gap-3" aria-label="Pagination">
      <p className="text-sm font-medium text-ink-600">
        <span className="font-display text-base font-bold text-ink-950">
          {first}–{last}
        </span>{' '}
        of {count}
        <span className="sr-only">
          {' '}
          (page {page + 1} of {totalPages})
        </span>
      </p>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          className="max-md:min-h-11"
          disabled={page === 0}
          onClick={() => onChange(page - 1)}
          icon={<ChevronLeft className="h-4 w-4" />}
        >
          Previous
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="max-md:min-h-11"
          disabled={page + 1 >= totalPages}
          onClick={() => onChange(page + 1)}
          iconRight={<ChevronRight className="h-4 w-4" />}
        >
          Next
        </Button>
      </div>
    </nav>
  );
}

/* ---------- Shared list pattern for the admin tables ---------- */

export type AdminColumn<T> = {
  /** Column heading. Leave empty for an actions column. */
  label: string;
  /** `view` lets a cell size its controls: compact in the table, thumb-sized in a card. */
  cell: (row: T, view: 'table' | 'card') => ReactNode;
  /** The column that names the row. It becomes the heading of the phone card. */
  primary?: boolean;
  align?: 'right';
};

/**
 * One list, two renderings: a real table from `md` up, and the same rows as
 * stacked label/value cards on a phone. Columns are declared once so the two
 * can never drift apart.
 */
export function AdminTable<T>({
  columns,
  rows,
  rowKey,
  caption,
}: {
  columns: AdminColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  caption: string;
}) {
  const primary = columns.find((c) => c.primary);
  const details = columns.filter((c) => !c.primary && c.label);
  const actions = columns.filter((c) => !c.primary && !c.label);

  return (
    <>
      {/* md and up: table */}
      <div className="hidden overflow-hidden rounded-3xl bg-white shadow-soft ring-1 ring-ink-900/5 md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{caption}</caption>
            <thead className="bg-ink-50">
              <tr>
                {columns.map((c, i) => (
                  <th
                    key={c.label || `actions-${i}`}
                    scope="col"
                    className={`px-5 py-3 text-[0.68rem] font-extrabold uppercase tracking-[0.16em] text-ink-500 ${
                      c.align === 'right' ? 'text-right' : ''
                    }`}
                  >
                    {c.label || <span className="sr-only">Actions</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {rows.map((row) => (
                <tr key={rowKey(row)} className="transition-colors hover:bg-ink-50/60">
                  {columns.map((c, i) => (
                    <td
                      key={c.label || `actions-${i}`}
                      className={`px-5 py-3.5 align-middle ${c.primary ? 'font-bold text-ink-950' : 'text-ink-700'} ${
                        c.align === 'right' ? 'text-right' : ''
                      }`}
                    >
                      {c.cell(row, 'table')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* below md: the same rows as cards */}
      <ul className="space-y-3 md:hidden">
        {rows.map((row) => (
          <li key={rowKey(row)} className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-ink-900/5">
            {primary && <div className="text-lg font-bold text-ink-950">{primary.cell(row, 'card')}</div>}
            <dl className={`divide-y divide-ink-100 ${primary ? 'mt-3' : ''}`}>
              {details.map((c) => (
                <div key={c.label} className="flex items-center justify-between gap-4 py-2.5 last:pb-0">
                  <dt className="slug shrink-0 text-ink-500">{c.label}</dt>
                  <dd className="min-w-0 break-words text-right text-ink-800">{c.cell(row, 'card')}</dd>
                </div>
              ))}
            </dl>
            {actions.map((c, i) => (
              <div key={i} className="mt-4">
                {c.cell(row, 'card')}
              </div>
            ))}
          </li>
        ))}
      </ul>
    </>
  );
}

/** Screen-reader text that stands in for the old "Loading users…" line while the skeleton shows. */
export function AdminLoadingLabel({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="sr-only">
      {children}
    </p>
  );
}

/* ---------- Review card shared by the two moderation pages ---------- */

export function AdminReviewCard({
  rating,
  comment,
  about,
  wouldWorkAgain,
  createdAt,
  hidden,
  hiddenReason,
  busy,
  onModerate,
}: {
  rating: number;
  comment: string | null;
  /** Who or what the review is about, when the list knows it. */
  about?: ReactNode;
  wouldWorkAgain: boolean;
  createdAt: string;
  hidden: boolean;
  hiddenReason: string | null;
  busy: boolean;
  onModerate: () => void;
}) {
  return (
    <li className={`rounded-3xl p-5 ring-1 ${hidden ? 'bg-danger-50 ring-danger-100' : 'bg-white shadow-soft ring-ink-900/5'}`}>
      <div className={hidden ? 'opacity-60' : ''}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Stars rating={rating} className="h-5 w-5" />
          <span className="font-display text-lg font-bold text-ink-950">{rating}/5</span>
          {hidden && <Badge tone="danger">Hidden</Badge>}
          <span className="ml-auto text-sm text-ink-500">{formatDate(createdAt, true)}</span>
        </div>
        {about && <p className="mt-2 font-bold text-ink-900">{about}</p>}
        {comment ? (
          <p className="mt-3 whitespace-pre-line rounded-3xl rounded-tl-md bg-ink-100 px-4 py-3 text-ink-800">{comment}</p>
        ) : (
          <p className="mt-3 text-sm text-ink-500">No written comment.</p>
        )}
        <p className="mt-3 flex items-center gap-2 text-sm font-medium text-ink-600">
          {wouldWorkAgain ? <ThumbsUp className="h-4 w-4 text-leaf-600" /> : <ThumbsDown className="h-4 w-4 text-ink-400" />}
          {wouldWorkAgain ? 'Would work with them again' : 'Would not work with them again'}
        </p>
      </div>
      {hidden && hiddenReason && <p className="mt-3 text-sm font-medium text-danger-700">Hidden: {hiddenReason}</p>}
      <div className="mt-4 flex justify-end">
        <Button
          variant={hidden ? 'secondary' : 'danger'}
          className="max-sm:w-full"
          onClick={onModerate}
          disabled={busy}
          loading={busy}
          icon={hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        >
          {hidden ? 'Restore' : 'Hide'}
        </Button>
      </div>
    </li>
  );
}
