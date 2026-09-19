import { useCallback, useEffect, useState } from 'react';
import { Check, X, Flag, ChevronDown, ChevronUp, FileText, Palette, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { TextAreaField } from '@/components/ui/Field';
import { Avatar, Badge, PageHeader } from '@/components/ui/bits';
import { EmptyState, ErrorState, FormError, SkeletonList, Banner } from '@/components/ui/states';
import { InkLoader } from '@/components/ui/Marks';
import { formatDate } from '@/lib/format';
import {
  listDesignerApplications,
  listDesignerPortfolio,
  reviewDesigner,
  portfolioImageUrl,
  ADMIN_PAGE_SIZE,
  type AdminDesignerApplicationRow,
  type AdminPortfolioItemRow,
} from '@/lib/api/admin';
import { useAdminList } from './useAdminList';
import { AdminLoadingLabel, AdminPager } from './AdminPager';

/**
 * The human gate in the designer vetting model.
 *
 * PrintAir's claim is that every designer a customer can reach was reviewed by
 * a person. The automated checks below only *flag* — they never decide, and a
 * flagged application is still perfectly approvable. Their whole job is to
 * point the reviewer at what to look at first.
 *
 * Unlike the other admin pages, the reason is typed inline rather than in a
 * reason sheet. Approving a designer is the decision the vetting claim rests
 * on, and it deserves the portfolio on screen next to the text field rather
 * than a dialog covering it.
 */
export default function AdminDesignersPage() {
  const fetcher = useCallback(
    (page: number, pageSize: number) => listDesignerApplications(page, pageSize),
    [],
  );
  const { rows: applications, count, page, setPage, loading, error, reload } = useAdminList(
    fetcher,
    ADMIN_PAGE_SIZE,
  );

  const [openId, setOpenId] = useState<string | null>(null);

  if (loading) {
    return (
      <div>
        <PageHeader title="Designer applications" subtitle="The human gate: every designer is reviewed by a person." />
        <AdminLoadingLabel>Loading designer applications…</AdminLoadingLabel>
        <SkeletonList rows={4} />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader title="Designer applications" subtitle="The human gate: every designer is reviewed by a person." />
        <ErrorState title="Couldn't load designer applications" message={error} onRetry={() => reload()} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Designer applications"
        subtitle={
          count === 0
            ? 'No applications waiting for review.'
            : `${count} awaiting review, oldest first. Flags are hints — review the work itself.`
        }
      />

      <div className="space-y-3">
        {applications.map((a) => (
          <ApplicationCard
            key={a.id}
            application={a}
            open={openId === a.id}
            onToggle={() => setOpenId(openId === a.id ? null : (a.id as string))}
            onDecided={reload}
          />
        ))}
        {applications.length === 0 && (
          <EmptyState
            icon={Palette}
            title="Nothing to review."
            body="New designer applications appear here as soon as they sign up."
            tone="grape"
          />
        )}
      </div>

      <AdminPager page={page} pageSize={ADMIN_PAGE_SIZE} count={count} onChange={setPage} />
      <p className="mt-4 max-w-2xl text-sm text-ink-500">
        Approving makes a designer visible to customers and starts sending them matching work.
        Suspend an already-approved designer from the Users tab.
      </p>
    </div>
  );
}

function ApplicationCard({
  application: a,
  open,
  onToggle,
  onDecided,
}: {
  application: AdminDesignerApplicationRow;
  open: boolean;
  onToggle: () => void;
  onDecided: () => Promise<void> | void;
}) {
  const [portfolio, setPortfolio] = useState<AdminPortfolioItemRow[] | null>(null);
  const [portfolioError, setPortfolioError] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<'active' | 'rejected' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Loaded on expand rather than up front: a queue of thirty applications
  // should not fetch thirty portfolios nobody has asked to see.
  useEffect(() => {
    if (!open || portfolio !== null) return;
    let cancelled = false;
    listDesignerPortfolio(a.id as string)
      .then((items) => !cancelled && setPortfolio(items))
      .catch((e) => !cancelled && setPortfolioError(e instanceof Error ? e.message : 'Could not load portfolio.'));
    return () => {
      cancelled = true;
    };
  }, [open, portfolio, a.id]);

  async function decide(decision: 'active' | 'rejected') {
    if (!reason.trim()) {
      setActionError('Add a reason — it is recorded in the audit log.');
      return;
    }
    setBusy(decision);
    setActionError(null);
    try {
      await reviewDesigner(a.id as string, decision, reason.trim());
      await onDecided();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not record that decision.');
    } finally {
      setBusy(null);
    }
  }

  const samples = a.portfolio_count ?? 0;
  const flags = [
    a.flag_low_sample_count &&
      (samples === 0
        ? 'No portfolio samples'
        : `Only ${samples} portfolio sample${samples === 1 ? '' : 's'}`),
    a.flag_bad_format && 'Some samples are not a print-ready format',
    a.flag_low_resolution && 'Some samples are low resolution',
  ].filter(Boolean) as string[];

  return (
    <div className={`overflow-hidden rounded-3xl bg-white ring-1 transition-shadow ${open ? 'shadow-card ring-ink-900/10' : 'shadow-soft ring-ink-900/5'}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-start gap-4 p-5 text-left transition-colors hover:bg-ink-50/60"
      >
        <Avatar name={a.display_name ?? ''} />
        <div className="min-w-0 flex-1">
          <p className="break-words font-display text-lg font-bold text-ink-950">{a.display_name}</p>
          <p className="mt-0.5 text-ink-600">
            {a.city} · {(a.specialties ?? []).join(', ') || 'no specialties chosen'}
          </p>
          <p className="mt-1 text-sm text-ink-500">
            Applied {formatDate(a.applied_at, true)} · {a.portfolio_count ?? 0} sample{a.portfolio_count === 1 ? '' : 's'}
          </p>
          {flags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {flags.map((f) => (
                <Badge key={f} tone="sun" dot={false}>
                  <Flag className="h-3 w-3" /> {f}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink-100 text-ink-700">
          {open ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </span>
      </button>

      {open && (
        <div className="animate-fade-in border-t border-ink-100 p-5">
          {a.bio && <p className="whitespace-pre-line text-ink-800">{a.bio}</p>}
          {a.application_note && (
            <div className={a.bio ? 'mt-4' : ''}>
              <p className="slug text-ink-500">Application note</p>
              <p className="mt-2 whitespace-pre-line rounded-3xl rounded-tl-md bg-ink-100 px-4 py-3 text-ink-800">
                {a.application_note}
              </p>
            </div>
          )}

          <p className="slug mt-6 text-ink-500">Portfolio</p>
          {portfolioError && (
            <Banner tone="danger" className="mt-2">
              {portfolioError}
            </Banner>
          )}
          {portfolio === null && !portfolioError && (
            <p className="mt-3 flex items-center gap-3 text-sm font-medium text-ink-500">
              <InkLoader className="[&>span]:h-2 [&>span]:w-2" /> Loading samples…
            </p>
          )}
          {portfolio?.length === 0 && (
            <p className="mt-2 rounded-2xl bg-ink-50 px-4 py-3 text-sm text-ink-600">
              No samples uploaded. There is nothing here to judge print-readiness on.
            </p>
          )}
          {portfolio && portfolio.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {portfolio.map((item) => (
                <a
                  key={item.id}
                  href={portfolioImageUrl(item.storage_path)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block overflow-hidden rounded-2xl bg-ink-50 ring-1 ring-ink-900/5 transition-shadow hover:shadow-card"
                >
                  {item.mime_type?.startsWith('image/') ? (
                    <img
                      src={portfolioImageUrl(item.storage_path)}
                      alt={item.file_name}
                      loading="lazy"
                      className="aspect-[4/3] w-full rounded-2xl object-cover transition-transform group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 px-3 text-center">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-ink-600 ring-1 ring-ink-900/5">
                        <FileText className="h-5 w-5" />
                      </span>
                      <span className="line-clamp-2 break-all text-sm font-bold text-ink-900">{item.file_name}</span>
                    </div>
                  )}
                  <p className="flex items-center justify-between gap-2 px-3 py-2 text-xs font-medium text-ink-500">
                    <span className="truncate">
                      {item.width_px && item.height_px
                        ? `${item.width_px}×${item.height_px}`
                        : item.mime_type ?? 'unknown format'}
                    </span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 text-ink-400" />
                  </p>
                </a>
              ))}
            </div>
          )}

          <TextAreaField
            className="mt-6"
            label="Reason (recorded in the audit log)"
            required
            value={reason}
            onChange={setReason}
            rows={2}
            placeholder="e.g. Portfolio shows correct bleed and CMYK output on three packaging jobs."
          />

          {actionError && (
            <div className="mt-3">
              <FormError>{actionError}</FormError>
            </div>
          )}

          <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
            <Button
              variant="primary"
              onClick={() => decide('active')}
              disabled={busy !== null}
              loading={busy === 'active'}
              icon={<Check className="h-4 w-4 text-leaf-300" strokeWidth={3} />}
            >
              Approve
            </Button>
            <Button
              variant="danger"
              onClick={() => decide('rejected')}
              disabled={busy !== null}
              loading={busy === 'rejected'}
              icon={<X className="h-4 w-4" />}
            >
              Reject
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
