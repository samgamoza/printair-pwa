import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Trophy } from 'lucide-react';
import { getPartnerDirectory, type PartnerDirectoryRow } from '@/lib/api/directory';
import { Avatar, Stars } from '@/components/ui/bits';

/**
 * The best-reviewed printing partners, straight from the public directory: real partners, real
 * ratings from delivered orders. Shows nothing until at least one partner has a review, so it can
 * never display an invented leaderboard.
 */
export function TopPartners() {
  const [rows, setRows] = useState<PartnerDirectoryRow[]>([]);

  useEffect(() => {
    let live = true;
    getPartnerDirectory()
      .then((all) => {
        if (!live) return;
        setRows(
          all
            .filter((p) => Number(p.review_count) > 0)
            .sort((a, b) => Number(b.average_rating) - Number(a.average_rating) || Number(b.review_count) - Number(a.review_count))
            .slice(0, 3),
        );
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  if (!rows.length) return null;

  return (
    <section className="mx-auto max-w-6xl px-5 pb-14 sm:px-8 lg:pb-20" aria-labelledby="top-partners-title">
      <p className="slug text-ink-500">
        <Trophy className="h-3.5 w-3.5" /> Rated by customers
      </p>
      <h2 id="top-partners-title" className="mt-2 text-3xl text-ink-950 sm:text-4xl">
        Top-rated printing partners
      </h2>
      <div className="mt-6 grid gap-3 md:grid-cols-3">
        {rows.map((p, i) => (
          <Link
            key={p.id}
            to={`/partners/${p.id}`}
            className="group relative flex items-center gap-4 rounded-4xl bg-white p-5 shadow-soft ring-1 ring-ink-900/5 transition-transform hover:-translate-y-1"
          >
            <span className="absolute right-4 top-4 font-display text-3xl font-extrabold text-ink-100">#{i + 1}</span>
            <Avatar name={p.business_name ?? 'Partner'} square className="h-14 w-14 text-lg" />
            <span className="min-w-0">
              <span className="block truncate font-display text-lg font-bold text-ink-950">{p.business_name}</span>
              <span className="mt-0.5 flex items-center gap-1 text-sm text-ink-500">
                <MapPin className="h-3.5 w-3.5" /> {p.city}
              </span>
              <span className="mt-1.5 flex items-center gap-2">
                <Stars rating={Number(p.average_rating)} className="h-4 w-4" />
                <span className="text-sm font-bold text-ink-800">{Number(p.average_rating).toFixed(1)}</span>
                <span className="text-sm text-ink-500">({p.review_count})</span>
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
