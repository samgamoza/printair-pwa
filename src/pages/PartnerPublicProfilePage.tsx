import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Clock, MapPin, SearchX, Star, ThumbsUp } from 'lucide-react';
import { PublicShell } from '@/components/shell/PublicShell';
import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Avatar, Badge, Stars, Stat } from '@/components/ui/bits';
import { EmptyState, ErrorState, PageLoader } from '@/components/ui/states';
import { ColorBar, Halftone, RegistrationMark } from '@/components/ui/Marks';
import { getPartnerPublicProfile, type PartnerDirectoryRow } from '@/lib/api/directory';
import { getProviderReviews, type ReviewRow } from '@/lib/api/reviews';
import { CATEGORIES } from '@/data/catalog';
import { useAuth } from '@/contexts/AuthContext';

const BACK = { to: '/partners', label: 'All partners' };

function categoryName(id: string) {
  return CATEGORIES.find((c) => c.id === id)?.name ?? id;
}

export default function PartnerPublicProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const [partner, setPartner] = useState<PartnerDirectoryRow | null | undefined>(undefined);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!id) return;
    setError(null);
    getPartnerPublicProfile(id)
      .then(setPartner)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load this printing partner.'));
    getProviderReviews(id)
      .then(setReviews)
      .catch(() => {
        // Reviews are secondary content on this page — a failure here shouldn't
        // block the profile itself from rendering once it has loaded.
      });
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <PublicShell back={BACK}>
        <ErrorState title="Couldn't load this printing partner" message={error} onRetry={load} />
      </PublicShell>
    );
  }

  if (partner === undefined) {
    return (
      <PublicShell back={BACK}>
        <PageLoader label="Loading…" />
      </PublicShell>
    );
  }

  if (partner === null) {
    return (
      <PublicShell back={BACK}>
        <EmptyState
          icon={SearchX}
          tone="cyan"
          title="This printing partner could not be found."
          action={<ButtonLink to="/partners">Browse all partners</ButtonLink>}
        />
      </PublicShell>
    );
  }

  return (
    <PublicShell back={BACK}>
      <section className="overflow-hidden rounded-4xl bg-white shadow-soft ring-1 ring-ink-900/5">
        <div className="relative h-24 overflow-hidden bg-cyan-300 sm:h-32">
          <Halftone className="-right-8 -top-16 h-56 w-56 rounded-full text-cyan-600/60" />
          <span className="pointer-events-none absolute -bottom-10 left-1/3 h-24 w-24 rounded-full bg-sun-300 mix-blend-multiply" aria-hidden="true" />
          <RegistrationMark className="absolute right-5 top-5 h-6 w-6 text-ink-950/40" />
          <ColorBar className="absolute bottom-4 right-5" />
        </div>

        <div className="px-5 pb-6 sm:px-8 sm:pb-8">
          <div className="relative -mt-10 flex items-end justify-between gap-4 sm:-mt-12">
            <Avatar name={partner.business_name ?? ''} square className="relative h-20 w-20 text-2xl ring-4 ring-white sm:h-24 sm:w-24 sm:text-3xl" />
            <div className="flex items-center gap-1.5 rounded-2xl bg-sun-100 px-4 py-2 ring-1 ring-sun-300">
              <Star className="h-5 w-5 fill-sun-400 text-sun-400" />
              <span className="font-display text-lg font-extrabold text-ink-950">
                {Number(partner.average_rating) > 0 ? Number(partner.average_rating).toFixed(1) : 'New'}
              </span>
              <span className="text-sm text-ink-600">({partner.review_count})</span>
            </div>
          </div>

          <h1 className="mt-4 text-balance text-3xl text-ink-950 sm:text-4xl">{partner.business_name}</h1>
          <p className="mt-1.5 flex items-center gap-1.5 text-ink-600">
            <MapPin className="h-4 w-4 shrink-0" /> {partner.city}
          </p>

          {partner.description && <p className="mt-4 max-w-2xl whitespace-pre-line leading-relaxed text-ink-700">{partner.description}</p>}

          {(partner.categories ?? []).length > 0 && (
            <div className="mt-5">
              <p className="slug text-ink-500">What they print</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(partner.categories ?? []).map((c) => (
                  <Badge key={c} tone="cyan" dot={false}>
                    {categoryName(c)}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {(partner.services ?? []).length > 0 && (
            <div className="mt-4">
              <p className="slug text-ink-500">Services</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(partner.services ?? []).map((s) => (
                  <Badge key={s} tone="neutral" dot={false}>
                    {s}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-5 rounded-3xl bg-ink-50 p-4 sm:grid-cols-3 sm:p-5">
            <Stat icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="Completed projects" value={String(partner.completed_projects)} />
            {partner.typical_turnaround_days && (
              <Stat icon={<Clock className="h-3.5 w-3.5" />} label="Typical turnaround" value={`${partner.typical_turnaround_days} days`} />
            )}
            {partner.service_areas && partner.service_areas.length > 0 && (
              <div className="col-span-2 min-w-0 sm:col-span-1">
                <Stat
                  icon={<MapPin className="h-3.5 w-3.5" />}
                  label="Service areas"
                  value={<span className="block whitespace-normal">{partner.service_areas.join(', ')}</span>}
                />
              </div>
            )}
          </div>

          {/* For people who buy printing: visitors and customers. A partner, designer or admin has no use for it. */}
          {(!profile || profile.role === 'customer') && (
            <div className="mt-6">
              <ButtonLink to="/#builder" variant="accent" size="lg" iconRight={<ArrowRight className="h-5 w-5" />} className="w-full sm:w-auto">
                Start a project
              </ButtonLink>
            </div>
          )}
        </div>
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
    </PublicShell>
  );
}
