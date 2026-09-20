import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, MapPin, Printer, Search, SearchX } from 'lucide-react';
import { PublicShell } from '@/components/shell/PublicShell';
import { Button } from '@/components/ui/Button';
import { LinkCard, Chevron } from '@/components/ui/Card';
import { Chip, TextField } from '@/components/ui/Field';
import { Avatar, Badge, Stars } from '@/components/ui/bits';
import { EmptyState, ErrorState, SkeletonList } from '@/components/ui/states';
import { ColorBar, Halftone, RegistrationMark } from '@/components/ui/Marks';
import { getPartnerDirectory, type PartnerDirectoryRow } from '@/lib/api/directory';
import { CATEGORIES } from '@/data/catalog';

function categoryName(id: string) {
  return CATEGORIES.find((c) => c.id === id)?.name ?? id;
}

export default function PartnerDirectoryPage() {
  const [partners, setPartners] = useState<PartnerDirectoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Presentational only: both narrow the list that has already been loaded.
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('all');

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getPartnerDirectory()
      .then(setPartners)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load partners.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** Only categories somebody in the list actually offers, so no chip leads to an empty page. */
  const categoriesPresent = useMemo(() => {
    const ids = new Set<string>();
    partners.forEach((p) => (p.categories ?? []).forEach((c) => ids.add(c)));
    return [...ids].sort((a, b) => categoryName(a).localeCompare(categoryName(b)));
  }, [partners]);

  const needle = query.trim().toLowerCase();
  const shown = partners.filter((p) => {
    if (category !== 'all' && !(p.categories ?? []).includes(category)) return false;
    if (!needle) return true;
    return (p.business_name ?? '').toLowerCase().includes(needle) || (p.city ?? '').toLowerCase().includes(needle);
  });

  const clearFilters = () => {
    setQuery('');
    setCategory('all');
  };

  return (
    <PublicShell back={{ to: '/', label: 'Home' }}>
      <header className="relative overflow-hidden rounded-4xl bg-cyan-300 px-6 pb-7 pt-8 text-ink-950 sm:px-10 sm:pb-10 sm:pt-12">
        <Halftone className="-right-10 -top-10 h-56 w-56 rounded-full text-cyan-600/60 sm:h-80 sm:w-80" />
        <span className="pointer-events-none absolute -bottom-12 right-10 h-32 w-32 rounded-full bg-sun-300 mix-blend-multiply sm:h-44 sm:w-44" aria-hidden="true" />
        <RegistrationMark className="absolute right-5 top-5 h-6 w-6 text-ink-950/40" />
        <div className="relative">
          <p className="slug text-ink-950/70">
            <ColorBar /> Directory
          </p>
          <h1 className="mt-3 max-w-xl text-balance font-display text-4xl font-extrabold leading-[0.95] sm:text-6xl">
            Manufacturing Partners
          </h1>
          <p className="mt-3 max-w-md text-base font-medium text-ink-950/75 sm:text-lg">Verified printing businesses on PrintAir.</p>
          {!loading && !error && partners.length > 0 && (
            <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-ink-950 px-4 py-2 text-sm font-bold text-white">
              <Printer className="h-4 w-4" /> {partners.length} partner{partners.length === 1 ? '' : 's'}
            </p>
          )}
        </div>
      </header>

      {!loading && !error && partners.length > 0 && (
        <div className="mt-5 space-y-3">
          <TextField
            value={query}
            onChange={setQuery}
            type="search"
            icon={Search}
            placeholder="Search by business name or city"
            autoComplete="off"
            name="partner-search"
          />
          {categoriesPresent.length > 0 && (
            <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Filter by category">
              <span className="shrink-0 whitespace-nowrap">
                <Chip selected={category === 'all'} onClick={() => setCategory('all')}>
                  All
                </Chip>
              </span>
              {categoriesPresent.map((c) => (
                <span key={c} className="shrink-0 whitespace-nowrap">
                  <Chip selected={category === c} onClick={() => setCategory(c)}>
                    {categoryName(c)}
                  </Chip>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-6">
        {loading ? (
          <>
            <p className="sr-only" role="status">
              Loading partners…
            </p>
            <SkeletonList rows={4} />
          </>
        ) : error ? (
          <ErrorState title="Couldn't load partners" message={error} onRetry={load} />
        ) : partners.length === 0 ? (
          <EmptyState pip icon={Printer} tone="cyan" title="No partners have joined yet." />
        ) : shown.length === 0 ? (
          <EmptyState
            icon={SearchX}
            tone="sun"
            title="No partners match"
            body="Try a different name, city or category."
            action={
              <Button variant="secondary" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            {shown.map((p) => (
              <LinkCard key={p.id} to={`/partners/${p.id}`} className="flex flex-col">
                <div className="flex items-start gap-3.5">
                  <Avatar name={p.business_name ?? ''} square className="h-14 w-14 text-lg" />
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-lg font-bold leading-tight text-ink-950">{p.business_name}</p>
                    <p className="mt-1 flex items-center gap-1 text-sm text-ink-500">
                      <MapPin className="h-4 w-4 shrink-0" /> <span className="truncate">{p.city}</span>
                    </p>
                  </div>
                  <Chevron />
                </div>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {(p.categories ?? []).slice(0, 3).map((c) => (
                    <Badge key={c} tone="cyan" dot={false}>
                      {categoryName(c)}
                    </Badge>
                  ))}
                </div>

                <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pt-4">
                  <span className="flex items-center gap-1.5 text-sm font-bold text-ink-900">
                    {Number(p.average_rating) > 0 ? (
                      <>
                        <Stars rating={Number(p.average_rating)} />
                        {Number(p.average_rating).toFixed(1)}
                      </>
                    ) : (
                      <Badge tone="magenta">New</Badge>
                    )}
                    <span className="font-medium text-ink-400">({p.review_count})</span>
                  </span>
                  <span className="flex items-center gap-1.5 text-sm text-ink-600">
                    <CheckCircle2 className="h-4 w-4 text-leaf-500" /> {p.completed_projects} completed
                  </span>
                </div>
              </LinkCard>
            ))}
          </div>
        )}
      </div>
    </PublicShell>
  );
}
