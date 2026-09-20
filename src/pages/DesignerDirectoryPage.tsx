import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Images, MapPin, Palette, Search, SearchX, Star, Wallet } from 'lucide-react';
import { PublicShell } from '@/components/shell/PublicShell';
import { Button } from '@/components/ui/Button';
import { LinkCard, Chevron } from '@/components/ui/Card';
import { Chip, TextField } from '@/components/ui/Field';
import { Avatar, Badge } from '@/components/ui/bits';
import { EmptyState, ErrorState, SkeletonList } from '@/components/ui/states';
import { ColorBar, Halftone, RegistrationMark } from '@/components/ui/Marks';
import { getDesignerDirectory, type DesignerDirectoryRow } from '@/lib/api/directory';
import { DESIGN_SPECIALTIES } from '@/data/catalog';
import { peso } from '@/lib/format';

function specialtyName(id: string) {
  return DESIGN_SPECIALTIES.find((s) => s.id === id)?.name ?? id;
}

/** Public list of approved designers — mirrors PartnerDirectoryPage. */
export default function DesignerDirectoryPage() {
  const [designers, setDesigners] = useState<DesignerDirectoryRow[]>([]);
  const [specialty, setSpecialty] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Presentational only: narrows the list that has already been loaded.
  const [query, setQuery] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getDesignerDirectory()
      .then(setDesigners)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load designers.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const bySpecialty =
    specialty === 'all' ? designers : designers.filter((d) => (d.specialties ?? []).includes(specialty));

  const needle = query.trim().toLowerCase();
  const shown = needle
    ? bySpecialty.filter(
        (d) => (d.display_name ?? '').toLowerCase().includes(needle) || (d.city ?? '').toLowerCase().includes(needle),
      )
    : bySpecialty;

  const clearFilters = () => {
    setQuery('');
    setSpecialty('all');
  };

  return (
    <PublicShell back={{ to: '/', label: 'Home' }}>
      <header className="relative overflow-hidden rounded-4xl bg-grape-600 px-6 pb-7 pt-8 text-white sm:px-10 sm:pb-10 sm:pt-12">
        <Halftone className="-right-10 -top-10 h-56 w-56 rounded-full text-magenta-400/70 sm:h-80 sm:w-80" />
        <span className="pointer-events-none absolute -bottom-14 right-8 h-36 w-36 rounded-full bg-magenta-500/80 sm:h-48 sm:w-48" aria-hidden="true" />
        <RegistrationMark className="absolute right-5 top-5 h-6 w-6 text-white/50" />
        <div className="relative">
          <p className="slug text-white/80">
            <ColorBar /> Directory
          </p>
          <h1 className="mt-3 text-balance font-display text-5xl font-extrabold leading-[0.95] text-white sm:text-7xl">Designers</h1>
          <p className="mt-3 max-w-2xl text-base font-medium text-white/85 sm:text-lg">
            Freelance designers vetted for print-ready output — correct bleed, resolution, and file
            formats — so the artwork you commission can go straight into production.
          </p>
          {!loading && !error && designers.length > 0 && (
            <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-grape-800">
              <Palette className="h-4 w-4" /> {designers.length} designer{designers.length === 1 ? '' : 's'}
            </p>
          )}
        </div>
      </header>

      <div className="mt-5 space-y-3">
        <TextField
          value={query}
          onChange={setQuery}
          type="search"
          icon={Search}
          placeholder="Search by name or city"
          autoComplete="off"
          name="designer-search"
        />
        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Filter by specialty">
          {[{ id: 'all', name: 'All' }, ...DESIGN_SPECIALTIES].map((s) => (
            <span key={s.id} className="shrink-0 whitespace-nowrap">
              <Chip selected={specialty === s.id} onClick={() => setSpecialty(s.id)}>
                {s.name}
              </Chip>
            </span>
          ))}
        </div>
      </div>

      <div className="mt-6">
        {loading ? (
          <>
            <p className="sr-only" role="status">
              Loading designers…
            </p>
            <SkeletonList rows={4} />
          </>
        ) : error ? (
          <ErrorState title="Couldn't load designers" message={error} onRetry={load} />
        ) : shown.length === 0 ? (
          designers.length === 0 ? (
            <EmptyState pip icon={Palette} tone="grape" title="No designers have been approved yet." body="Check back soon." />
          ) : needle ? (
            <EmptyState
              icon={SearchX}
              tone="magenta"
              title="No designers match"
              body="Try a different name, city or specialty."
              action={
                <Button variant="secondary" onClick={clearFilters}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={SearchX}
              tone="magenta"
              title="No designers match that specialty yet."
              action={
                <Button variant="secondary" onClick={clearFilters}>
                  Show all designers
                </Button>
              }
            />
          )
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            {shown.map((d) => {
              const rateRange =
                d.rate_min && d.rate_max ? `${peso(d.rate_min)}–${peso(d.rate_max)}` : d.rate_min ? `From ${peso(d.rate_min)}` : null;
              return (
                <LinkCard key={d.id} to={`/designers/${d.id}`} className="flex flex-col hover:ring-grape-300">
                  <div className="flex items-start gap-3.5">
                    <Avatar name={d.display_name ?? ''} className="h-14 w-14 text-lg" />
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-lg font-bold leading-tight text-ink-950">{d.display_name}</p>
                      <p className="mt-1 flex items-center gap-1 text-sm text-ink-500">
                        <MapPin className="h-4 w-4 shrink-0" /> <span className="truncate">{d.city}</span>
                      </p>
                    </div>
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-sun-100 px-2.5 py-1 text-sm font-extrabold text-ink-950">
                      <Star className="h-4 w-4 fill-sun-400 text-sun-400" />
                      {Number(d.average_rating) > 0 ? Number(d.average_rating).toFixed(1) : 'New'}
                    </span>
                  </div>

                  {d.bio && <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-ink-600">{d.bio}</p>}

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(d.specialties ?? []).slice(0, 3).map((s) => (
                      <Badge key={s} tone="grape" dot={false}>
                        {specialtyName(s)}
                      </Badge>
                    ))}
                  </div>

                  <div className="mt-auto pt-4">
                    <div className="flex items-center justify-between gap-3 rounded-2xl bg-grape-50 px-3.5 py-2.5">
                      <span className="flex min-w-0 items-center gap-1.5 text-sm font-bold text-grape-800">
                        <Wallet className="h-4 w-4 shrink-0" />
                        <span className="truncate">{rateRange ?? 'Rate on request'}</span>
                      </span>
                      <Chevron />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-600">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-leaf-500" /> {d.completed_orders ?? 0} completed
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Images className="h-4 w-4 text-ink-400" /> {d.portfolio_count ?? 0} sample
                        {(d.portfolio_count ?? 0) === 1 ? '' : 's'}
                      </span>
                    </div>
                  </div>
                </LinkCard>
              );
            })}
          </div>
        )}
      </div>
    </PublicShell>
  );
}
