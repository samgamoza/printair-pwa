import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Clock, ExternalLink, FileText, MapPin, SearchX, Star, ThumbsUp, Wallet } from 'lucide-react';
import { PublicShell } from '@/components/shell/PublicShell';
import { Button, ButtonLink } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/Card';
import { Sheet } from '@/components/ui/Sheet';
import { Avatar, Badge, Stars, Stat } from '@/components/ui/bits';
import { EmptyState, ErrorState, PageLoader } from '@/components/ui/states';
import { ColorBar, Halftone, RegistrationMark } from '@/components/ui/Marks';
import { getDesignerPublicProfile, getDesignerPublicPortfolio, type DesignerDirectoryRow } from '@/lib/api/directory';
import { getDesignerReviews, type DesignReviewRow } from '@/lib/api/designReviews';
import { portfolioUrl, type DesignerPortfolioItemRow } from '@/lib/api/designer';
import { DESIGN_SPECIALTIES } from '@/data/catalog';

const BACK = { to: '/designers', label: 'All designers' };

function specialtyName(id: string) {
  return DESIGN_SPECIALTIES.find((s) => s.id === id)?.name ?? id;
}

/**
 * The public shopfront for an approved designer — mirrors
 * PartnerPublicProfilePage, with the portfolio as the centrepiece rather than
 * an afterthought.
 *
 * This is what makes "vetted for print-ready output" checkable rather than a
 * claim: a customer comparing proposals can see the actual work before
 * committing. Without it they were choosing on name, city, and price alone.
 */
export default function DesignerPublicProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [designer, setDesigner] = useState<DesignerDirectoryRow | null | undefined>(undefined);
  const [portfolio, setPortfolio] = useState<DesignerPortfolioItemRow[]>([]);
  const [reviews, setReviews] = useState<DesignReviewRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Presentational only: the sample currently enlarged in the lightbox.
  const [lightbox, setLightbox] = useState<DesignerPortfolioItemRow | null>(null);

  const load = useCallback(() => {
    if (!id) return;
    setError(null);
    getDesignerPublicProfile(id)
      .then(setDesigner)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load this designer.'));
    // Portfolio and reviews are secondary — a failure in either should not stop
    // the profile itself rendering, same reasoning as the partner page.
    getDesignerPublicPortfolio(id).then(setPortfolio).catch(() => {});
    getDesignerReviews(id).then(setReviews).catch(() => {});
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <PublicShell back={BACK}>
        <ErrorState title="Couldn't load this designer" message={error} onRetry={load} />
      </PublicShell>
    );
  }

  if (designer === undefined) {
    return (
      <PublicShell back={BACK}>
        <PageLoader label="Loading…" />
      </PublicShell>
    );
  }

  if (designer === null) {
    return (
      <PublicShell back={BACK}>
        <EmptyState
          icon={SearchX}
          tone="grape"
          title="This designer could not be found."
          action={<ButtonLink to="/designers">Browse all designers</ButtonLink>}
        />
      </PublicShell>
    );
  }

  const rate =
    designer.rate_min && designer.rate_max
      ? `₱${Number(designer.rate_min).toLocaleString('en-PH')}–₱${Number(designer.rate_max).toLocaleString('en-PH')}`
      : designer.rate_min
        ? `From ₱${Number(designer.rate_min).toLocaleString('en-PH')}`
        : null;

  return (
    <PublicShell back={BACK}>
      <section className="overflow-hidden rounded-4xl bg-white shadow-soft ring-1 ring-ink-900/5">
        <div className="relative h-24 overflow-hidden bg-grape-600 sm:h-32">
          <Halftone className="-right-8 -top-16 h-56 w-56 rounded-full text-magenta-400/70" />
          <span className="pointer-events-none absolute -bottom-12 left-1/3 h-28 w-28 rounded-full bg-magenta-500/80" aria-hidden="true" />
          <RegistrationMark className="absolute right-5 top-5 h-6 w-6 text-white/50" />
          <ColorBar className="absolute bottom-4 right-5" />
        </div>

        <div className="px-5 pb-6 sm:px-8 sm:pb-8">
          <div className="relative -mt-10 flex items-end justify-between gap-4 sm:-mt-12">
            <Avatar name={designer.display_name ?? ''} className="relative h-20 w-20 text-2xl ring-4 ring-white sm:h-24 sm:w-24 sm:text-3xl" />
            <div className="flex items-center gap-1.5 rounded-2xl bg-sun-100 px-4 py-2 ring-1 ring-sun-300">
              <Star className="h-5 w-5 fill-sun-400 text-sun-400" />
              <span className="font-display text-lg font-extrabold text-ink-950">
                {Number(designer.average_rating) > 0 ? Number(designer.average_rating).toFixed(1) : 'New'}
              </span>
              <span className="text-sm text-ink-600">({designer.review_count})</span>
            </div>
          </div>

          <h1 className="mt-4 text-balance text-3xl text-ink-950 sm:text-4xl">{designer.display_name}</h1>
          <p className="mt-1.5 flex items-center gap-1.5 text-ink-600">
            <MapPin className="h-4 w-4 shrink-0" /> {designer.city}
          </p>

          {designer.bio && <p className="mt-4 max-w-2xl whitespace-pre-line leading-relaxed text-ink-700">{designer.bio}</p>}

          <div className="mt-5 flex flex-wrap gap-2">
            {(designer.specialties ?? []).map((s) => (
              <Badge key={s} tone="grape" dot={false}>
                {specialtyName(s)}
              </Badge>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-5 rounded-3xl bg-grape-50 p-4 sm:grid-cols-3 sm:p-5">
            <Stat icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="Completed commissions" value={String(designer.completed_orders ?? 0)} />
            {designer.typical_turnaround_days && (
              <Stat icon={<Clock className="h-3.5 w-3.5" />} label="Typical turnaround" value={`${designer.typical_turnaround_days} days`} />
            )}
            {rate && (
              <div className="col-span-2 min-w-0 sm:col-span-1">
                <Stat icon={<Wallet className="h-3.5 w-3.5" />} label="Typical rate" value={rate} />
              </div>
            )}
          </div>

          <div className="mt-6">
            <RequestDesignButton />
          </div>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="flex items-center gap-2.5 text-2xl text-ink-950">
          Portfolio
          {portfolio.length > 0 && (
            <span className="rounded-full bg-grape-100 px-2.5 py-0.5 font-sans text-sm font-bold text-grape-800">{portfolio.length}</span>
          )}
        </h2>
        {portfolio.length === 0 ? (
          <p className="mt-3 text-ink-500">No samples published yet.</p>
        ) : (
          <div className="mt-4 columns-2 gap-3 sm:columns-3 sm:gap-4">
            {portfolio.map((item) =>
              item.mime_type?.startsWith('image/') ? (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setLightbox(item)}
                  aria-label={`View ${item.caption ?? item.file_name}`}
                  className="group relative mb-3 block w-full break-inside-avoid overflow-hidden rounded-3xl bg-ink-100 shadow-soft ring-1 ring-ink-900/5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card active:scale-[0.99] sm:mb-4"
                >
                  <img
                    src={portfolioUrl(item.storage_path)}
                    alt={item.caption ?? item.file_name}
                    loading="lazy"
                    width={item.width_px ?? undefined}
                    height={item.height_px ?? undefined}
                    className="h-auto min-h-28 w-full object-cover"
                  />
                  {item.caption && (
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-950/85 via-ink-950/50 to-transparent px-3.5 pb-3 pt-10 text-left text-sm font-bold leading-snug text-white">
                      <span className="line-clamp-2">{item.caption}</span>
                    </span>
                  )}
                </button>
              ) : (
                <a
                  key={item.id}
                  href={portfolioUrl(item.storage_path)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group mb-3 flex min-h-44 w-full break-inside-avoid flex-col justify-between gap-4 rounded-3xl bg-grape-50 p-4 ring-1 ring-grape-200/70 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card active:scale-[0.99] sm:mb-4"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-grape-700 ring-1 ring-grape-200/70">
                    <FileText className="h-6 w-6" />
                  </span>
                  <span className="min-w-0">
                    <span className="block break-words text-sm font-bold text-ink-950">{item.file_name}</span>
                    {item.caption && <span className="mt-1 line-clamp-2 block text-sm text-ink-600">{item.caption}</span>}
                    <span className="mt-2 flex items-center gap-1 text-sm font-bold text-grape-700">
                      Open file <ExternalLink className="h-4 w-4" />
                    </span>
                  </span>
                </a>
              ),
            )}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="flex items-center gap-2.5 text-2xl text-ink-950">
          Reviews
          {reviews.length > 0 && <span className="rounded-full bg-ink-100 px-2.5 py-0.5 font-sans text-sm font-bold text-ink-600">{reviews.length}</span>}
        </h2>
        {reviews.length === 0 ? (
          <p className="mt-3 text-ink-500">No reviews yet.</p>
        ) : (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {reviews.map((r) => (
              <Card key={r.id}>
                <div className="flex items-center justify-between gap-3">
                  <Stars rating={r.rating} className="h-5 w-5" />
                  <span className="text-sm text-ink-500">
                    {new Date(r.created_at).toLocaleDateString('en-PH', { month: 'short', year: 'numeric' })}
                  </span>
                </div>
                {r.comment && <p className="mt-3 whitespace-pre-line text-ink-800">{r.comment}</p>}
                {r.would_work_again && (
                  <p className="mt-3 flex items-center gap-1.5 text-sm font-bold text-leaf-700">
                    <ThumbsUp className="h-4 w-4" /> Would work with them again
                  </p>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>

      <Sheet open={lightbox !== null} onClose={() => setLightbox(null)} size="xl" labelledBy="portfolio-lightbox-title">
        {lightbox && (
          <div className="p-5 sm:p-8">
            <h2 id="portfolio-lightbox-title" className="pr-12 text-xl text-ink-950">
              {lightbox.caption ?? lightbox.file_name}
            </h2>
            <p className="mt-1 text-sm text-ink-500">Sample by {designer.display_name}</p>
            <div className="mt-4 overflow-hidden rounded-3xl bg-ink-50">
              <img
                src={portfolioUrl(lightbox.storage_path)}
                alt={lightbox.caption ?? lightbox.file_name}
                className="mx-auto max-h-[68dvh] w-auto max-w-full object-contain"
              />
            </div>
            <a
              href={portfolioUrl(lightbox.storage_path)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-full px-1 text-sm font-bold text-magenta-700 hover:text-magenta-800"
            >
              Open full size <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        )}
      </Sheet>
    </PublicShell>
  );
}

/**
 * Customers go straight to the design request form. A visitor is asked to sign in first (sending
 * them to a protected page would bounce them home and drop the request). Partners, designers and
 * admins cannot commission work, so they are not offered it.
 */
function RequestDesignButton() {
  const { session, profile, openSignIn } = useAuth();
  const navigate = useNavigate();
  if (session && profile && profile.role !== 'customer') return null;
  return (
    <Button
      variant="accent"
      size="lg"
      iconRight={<ArrowRight className="h-5 w-5" />}
      className="w-full sm:w-auto"
      onClick={() => (session ? navigate('/dashboard/designs?new=1') : openSignIn())}
    >
      Request a design
    </Button>
  );
}
