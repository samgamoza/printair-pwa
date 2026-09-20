import { lazy, Suspense, useState, useCallback, useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, Check, Clock, Cpu, MapPin, Package, Palette, Printer, ShieldCheck, TrendingUp, Users } from 'lucide-react';
import { MarketingHeader, MarketingFooter } from '@/components/marketing/Chrome';
import { Button } from '@/components/ui/Button';
import { Rail } from '@/components/ui/Rail';
import { FilterTabs } from '@/components/ui/bits';
import { ColorBar, CropMarks, RegistrationMark } from '@/components/ui/Marks';
import { InstallBanner } from '@/pwa/InstallPrompt';
import { useAuth } from '@/contexts/AuthContext';
import { isConstrained, whenIdleAndUnconstrained } from '@/pwa/connection';
import { SeasonKits } from '@/delight/SeasonKits';
import { TopPartners } from '@/delight/TopPartners';
import { ActivityPill } from '@/delight/ActivityPill';
import { DeliveredTotal } from '@/delight/DeliveredTotal';
import { CATEGORIES, INSPIRATION_ITEMS } from '@/data/catalog';

// The builder and the assistant are the two heaviest things on this page and neither is needed to
// paint it, so they arrive after: the builder on first use, the assistant once the page has settled.
const ProjectBuilder = lazy(() => import('@/components/ProjectBuilder').then((m) => ({ default: m.ProjectBuilder })));
const Assistant = lazy(() => import('@/components/Assistant').then((m) => ({ default: m.Assistant })));

/**
 * The example cards under "Inspiration" use stock photographs and sample results, so they are
 * presented as ideas to start from, not as customer stories. When real PrintAir jobs (with the
 * customer's permission) replace INSPIRATION_ITEMS in src/data/catalog.ts, set this to true and the
 * section goes back to "Made with PrintAir" with each customer's place and quote.
 */
const STORIES_ARE_REAL = false;

/** The same filters the website offers over the inspiration cards. */
const STORY_FILTERS = ['All', 'Coffee Shop', 'Bakery', 'Beauty and Skincare', 'Retail', 'Product Packaging', 'Labels and Stickers'] as const;
type StoryFilter = (typeof STORY_FILTERS)[number];

/**
 * The catalogue's photographs are 940×650; a card shows them at 352×192. Ask the image host for the
 * size actually drawn (and twice that for sharp screens) — about a fifth of the download.
 */
function sized(url: string, w: number, h: number): string {
  try {
    const u = new URL(url);
    if (!u.hostname.endsWith('pexels.com')) return url;
    u.searchParams.set('w', String(w));
    u.searchParams.set('h', String(h));
    u.searchParams.set('fit', 'crop');
    u.searchParams.set('auto', 'compress');
    return u.toString();
  } catch {
    return url;
  }
}

const TILE_TINTS = ['bg-cyan-200', 'bg-magenta-200', 'bg-sun-200', 'bg-grape-200', 'bg-leaf-200'];

const STEPS = [
  { title: 'Bring your idea', body: 'Tell us what you’re building — your coffee shop, bakery, beauty brand, or product.' },
  { title: 'We understand your business', body: 'PrintAir recognizes what your business needs — no printing terminology required.' },
  { title: 'We recommend the right approach', body: 'Get intelligent suggestions for products, materials, and finishes tailored to you.' },
  { title: 'Verified manufacturers review it', body: 'Your project is routed to the right Philippine production partners for review.' },
  { title: 'You approve', body: 'Review your tailored plan — pricing, timeline, and partner — then approve with one tap.' },
  { title: 'Production begins', body: 'Your verified partner manufactures and delivers. You track everything in one place.' },
];

const STEP_INKS = ['bg-cyan-300', 'bg-magenta-300', 'bg-sun-300', 'bg-grape-300', 'bg-leaf-300', 'bg-ink-950 text-white'];

const PARTNER_BENEFITS = [
  { icon: TrendingUp, title: 'Production-ready work', body: 'Receive qualified jobs — specs already figured out, ready to run on your machines.' },
  { icon: Cpu, title: 'Higher utilization', body: 'Fill idle machine time with matched work that fits your schedule.' },
  { icon: ShieldCheck, title: 'No price fishing', body: 'Customers come through PrintAir — no tire-kickers, no haggling, no cold leads.' },
  { icon: Users, title: 'Build your reputation', body: 'Every delivered project earns a public review that grows your standing on PrintAir.' },
];

/** Success stories name their category in words; the builder wants its id. */
function categoryIdFor(name: string): string | undefined {
  const wanted = name.toLowerCase();
  return CATEGORIES.find((c) => c.name.toLowerCase().startsWith(wanted) || wanted.startsWith(c.name.toLowerCase().split(' ')[0]))?.id;
}

export default function LandingPage() {
  const { openJoinPartner, profile } = useAuth();
  const [builderOpen, setBuilderOpen] = useState(false);
  const [initialCategory, setInitialCategory] = useState<string | null>(null);
  const [storyFilter, setStoryFilter] = useState<StoryFilter>('All');
  const stories = useMemo(
    () => (storyFilter === 'All' ? INSPIRATION_ITEMS : INSPIRATION_ITEMS.filter((i) => i.category === storyFilter)),
    [storyFilter],
  );
  const [builderWanted, setBuilderWanted] = useState(false);
  const [lean] = useState(isConstrained);
  const [assistantReady, setAssistantReady] = useState(false);
  const { hash, key: navKey } = useLocation();

  // In-app links such as Help ("/#how") arrive by client-side navigation, which never scrolls
  // to an anchor on its own.
  useEffect(() => {
    if (!hash) return;
    const t = window.setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    return () => window.clearTimeout(t);
    // navKey: tapping the same link again (Help, while already on /#how) should scroll again.
  }, [hash, navKey]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setAssistantReady(true);
      // Warm the builder too, so the first tap on "Start a project" doesn't wait on the network —
      // unless the connection is one where downloading ahead of need would only get in the way.
      whenIdleAndUnconstrained(() => void import('@/components/ProjectBuilder'));
    }, 1500);
    return () => window.clearTimeout(t);
  }, []);

  const openBuilder = useCallback((categoryId?: string) => {
    setInitialCategory(categoryId ?? null);
    setBuilderWanted(true);
    setBuilderOpen(true);
  }, []);

  const closeBuilder = useCallback(() => {
    setBuilderOpen(false);
    setInitialCategory(null);
  }, []);

  return (
    <div className="relative min-h-[100dvh] bg-paper-200 text-ink-900">
      <MarketingHeader />

      <main>
        {/* ---------- Hero ---------- */}
        <section className="relative overflow-hidden">
          <span className="pointer-events-none absolute -right-20 -top-10 h-64 w-64 bg-halftone-lg bg-dots-lg text-cyan-300/70 lg:left-[-4rem] lg:right-auto lg:top-24 lg:h-72 lg:w-72" aria-hidden="true" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 pb-8 pt-10 sm:px-8 lg:grid-cols-[1.1fr_1fr] lg:pb-10 lg:pt-14">
            <div>
              <p className="slug text-ink-600">
                <ColorBar /> Your AI printing partner · Philippines
              </p>
              <h1 className="mt-5 text-balance text-[2.9rem] leading-[0.98] text-ink-950 sm:text-6xl lg:text-7xl">
                Bring your idea. We&apos;ll work out the{' '}
                <span className="relative inline-block whitespace-nowrap">
                  <span className="absolute inset-x-[-0.12em] bottom-[0.06em] top-[0.42em] -rotate-1 rounded-lg bg-sun-300" aria-hidden="true" />
                  <span className="relative">printing.</span>
                </span>
              </h1>
              <p className="mt-6 max-w-xl text-lg text-ink-600">
                PrintAir guides you from business idea to professionally manufactured print products — with intelligent
                recommendations and trusted production partners at every step.
              </p>
              {/* No buttons here on purpose: the two doors directly below are the hero's call to action.
                  A "Start a project" button a thumb's width above a "Start my project" card was the same
                  choice offered twice. */}
              <ul className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-sm font-bold text-ink-700">
                {['Free to post', 'Compare real quotations', 'Track to delivery'].map((t) => (
                  <li key={t} className="flex items-center gap-1.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-leaf-400 text-ink-950">
                      <Check className="h-3 w-3" strokeWidth={3.5} />
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>

            {/* Phones go straight from the pitch to the two doors; the illustration would only push them down. */}
            <div className="hidden lg:block">
              <HeroArt lean={lean} />
            </div>
          </div>
        </section>

        {/* ---------- Two ways in ---------- */}
        {/* Straight under the hero: a visitor says which side of the marketplace they are on and goes
            down that side's own onboarding. Hidden for a signed-in partner, designer or admin, who
            already chose. */}
        {(!profile || profile.role === 'customer') && (
          <section id="start" aria-labelledby="start-title" className="mx-auto max-w-6xl scroll-mt-20 px-5 pb-12 sm:px-8 lg:pb-16">
            <p className="slug text-ink-500">Get started</p>
            <h2 id="start-title" className="mt-2 text-3xl text-ink-950 sm:text-4xl">
              What brings you to PrintAir?
            </h2>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <button
                type="button"
                onClick={() => openBuilder()}
                className="group relative flex flex-col overflow-hidden rounded-5xl bg-magenta-100 p-6 text-left transition-transform duration-200 hover:-translate-y-1 active:scale-[0.99] sm:p-8"
              >
                <span className="pointer-events-none absolute -right-8 -top-8 h-40 w-52 bg-halftone-lg bg-dots-lg text-magenta-500/25" aria-hidden="true" />
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-ink-950 shadow-soft">
                  <Package className="h-7 w-7" strokeWidth={1.9} />
                </span>
                <span className="slug mt-6 text-magenta-700">I need something printed</span>
                <span className="mt-2 font-display text-2xl font-bold leading-tight text-ink-950 sm:text-3xl">Start a guided print or packaging project</span>
                <span className="mt-3 max-w-md text-ink-700">
                  Answer a few simple questions. Verified printing partners send you quotations to compare. No printing knowledge needed.
                </span>
                <ul className="mb-7 mt-5 space-y-2 text-sm font-bold text-ink-800">
                  {['A few quick questions, no jargon', 'Quotations from verified partners', 'You choose, then track it to delivery'].map((t) => (
                    <li key={t} className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-magenta-700">
                        <Check className="h-3 w-3" strokeWidth={3.5} />
                      </span>
                      {t}
                    </li>
                  ))}
                </ul>
                <span
                  data-variant="accent"
                  className="mt-auto inline-flex min-h-14 items-center justify-center gap-2 self-start rounded-full bg-magenta-600 px-7 font-bold text-white shadow-magenta transition-colors group-hover:bg-magenta-700 max-sm:w-full"
                >
                  Start my project <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                </span>
              </button>

              <button
                type="button"
                onClick={openJoinPartner}
                className="group relative flex flex-col overflow-hidden rounded-5xl bg-ink-950 p-6 text-left text-white transition-transform duration-200 hover:-translate-y-1 active:scale-[0.99] sm:p-8"
              >
                <span className="pointer-events-none absolute -right-8 -top-8 h-40 w-52 bg-halftone-lg bg-dots-lg text-white/10" aria-hidden="true" />
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-sun-300">
                  <Printer className="h-7 w-7" strokeWidth={1.9} />
                </span>
                <span className="slug mt-6 text-sun-300">I run a printing business</span>
                <span className="mt-2 font-display text-2xl font-bold leading-tight sm:text-3xl">Join as a verified PrintAir partner</span>
                <span className="mt-3 max-w-md text-white/70">
                  Receive production-ready jobs that fit your machines and schedule. Quote only the ones you want.
                </span>
                <ul className="mb-7 mt-5 space-y-2 text-sm font-bold text-white/90">
                  {['Free to join', 'Qualified jobs, no price fishing', 'Reviews that build your reputation'].map((t) => (
                    <li key={t} className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sun-400 text-ink-950">
                        <Check className="h-3 w-3" strokeWidth={3.5} />
                      </span>
                      {t}
                    </li>
                  ))}
                </ul>
                <span
                  data-variant="light"
                  className="mt-auto inline-flex min-h-14 items-center justify-center gap-2 self-start rounded-full bg-white px-7 font-bold text-ink-950 transition-colors group-hover:bg-sun-300 max-sm:w-full"
                >
                  Become a partner <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                </span>
              </button>
            </div>
            <p className="mt-4 text-sm text-ink-600">
              A graphic designer?{' '}
              <Link to="/design" className="font-bold text-ink-950 underline underline-offset-4 hover:text-magenta-700">
                Apply to take design commissions
              </Link>
            </p>
          </section>
        )}

        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <InstallBanner />
        </div>

        {/* ---------- In season ---------- */}
        <div className="mx-auto max-w-6xl px-5 pt-12 sm:px-8 lg:pt-16 [&:empty]:hidden">
          <SeasonKits onPick={(categoryId) => openBuilder(categoryId)} />
        </div>

        {/* ---------- Categories ---------- */}
        <section id="builder" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-14 sm:px-8 lg:py-20">
          <p className="slug text-magenta-600">Project builder</p>
          <h2 className="mt-2 text-4xl text-ink-950 sm:text-5xl">What are you making?</h2>
          <p className="mt-3 max-w-xl text-ink-600">Pick the closest match. Six quick questions later, printing partners are quoting.</p>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {CATEGORIES.map((cat, i) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => openBuilder(cat.id)}
                className={`group relative flex min-h-[10.5rem] flex-col overflow-hidden rounded-4xl p-5 text-left transition-transform duration-200 hover:-translate-y-1 active:scale-[0.97] ${
                  cat.isSpecial ? 'bg-ink-950 text-white' : `${TILE_TINTS[i % TILE_TINTS.length]} text-ink-950`
                }`}
              >
                <span
                  className={`pointer-events-none absolute -right-6 -top-6 h-28 w-28 bg-halftone bg-dots ${cat.isSpecial ? 'text-white/15' : 'text-ink-950/10'}`}
                  aria-hidden="true"
                />
                <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${cat.isSpecial ? 'bg-white/10' : 'bg-white'}`}>
                  <cat.icon className="h-6 w-6" strokeWidth={1.9} />
                </span>
                <span className="mt-auto pt-5 font-display text-xl font-bold leading-tight">{cat.name}</span>
                <span className={`mt-1 flex items-center gap-1 text-sm font-bold ${cat.isSpecial ? 'text-sun-300' : 'text-ink-700'}`}>
                  Start <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* ---------- How it works ---------- */}
        <section id="how" className="scroll-mt-20 bg-white py-14 lg:py-20">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <p className="slug text-cyan-700">How it works</p>
            <h2 className="mt-2 max-w-2xl text-4xl text-ink-950 sm:text-5xl">
              From idea to finished print, <span className="text-ink-500">guided at every step.</span>
            </h2>
            <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {STEPS.map((s, i) => (
                <li key={s.title} className="rounded-4xl bg-paper-200 p-6">
                  <span className={`flex h-14 w-14 items-center justify-center rounded-2xl font-display text-2xl font-extrabold ${STEP_INKS[i]}`}>
                    {i + 1}
                  </span>
                  <h3 className="mt-5 text-xl text-ink-950">{s.title}</h3>
                  <p className="mt-2 text-ink-600">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ---------- Stories ---------- */}
        <section id="inspiration" className="scroll-mt-20 py-14 lg:py-20">
          <Rail
            key={storyFilter}
            label={STORIES_ARE_REAL ? 'customer stories' : 'ideas'}
            below={<FilterTabs value={storyFilter} onChange={setStoryFilter} tabs={STORY_FILTERS.map((f) => ({ key: f, label: f }))} />}
            header={
              <>
                <p className="slug text-grape-600">Inspiration</p>
                <h2 className="mt-2 text-4xl text-ink-950 sm:text-5xl">{STORIES_ARE_REAL ? 'Made with PrintAir' : 'Ideas to start from'}</h2>
                {!STORIES_ARE_REAL && <p className="mt-3 max-w-xl text-ink-600">Typical sets for businesses like yours. Pick one and make it your own.</p>}
              </>
            }
          >
            {stories.map((item, i) => (
              <article
                key={item.title}
                className="flex w-[19rem] shrink-0 snap-start flex-col overflow-hidden rounded-4xl bg-white shadow-soft ring-1 ring-ink-900/5 sm:w-[22rem]"
              >
                <div className={`relative h-48 ${TILE_TINTS[i % TILE_TINTS.length]}`}>
                  <span className="pointer-events-none absolute inset-0 bg-halftone bg-dots text-ink-950/10" aria-hidden="true" />
                  {/* Decorative, so skipped entirely on a data-saving or 2G connection: the tinted tile stands in. */}
                  {!lean && (
                  <img
                    src={sized(item.image, 360, 200)}
                    srcSet={`${sized(item.image, 360, 200)} 1x, ${sized(item.image, 720, 400)} 2x`}
                    alt=""
                    width={360}
                    height={200}
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 h-full w-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                  )}
                  <span className="absolute left-4 top-4 rounded-full bg-white px-3 py-1 text-xs font-extrabold text-ink-950">{item.category}</span>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="text-xl text-ink-950">{item.title}</h3>
                  <p className="mt-1 flex items-center gap-1 text-sm text-ink-500">
                    {STORIES_ARE_REAL ? (
                      <>
                        <MapPin className="h-3.5 w-3.5" /> {item.location}
                      </>
                    ) : (
                      <>For: {item.location.split(',')[0].toLowerCase()}</>
                    )}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {item.items.map((x) => (
                      <span key={x} className="rounded-full bg-ink-100 px-2.5 py-1 text-xs font-bold text-ink-700">
                        {x}
                      </span>
                    ))}
                  </div>
                  {STORIES_ARE_REAL ? (
                    <p className="mt-4 flex-1 rounded-2xl rounded-tl-md bg-sun-50 px-4 py-3 text-ink-800">&ldquo;{item.result}&rdquo;</p>
                  ) : (
                    <span className="flex-1" />
                  )}
                  <Button variant="secondary" className="mt-4" onClick={() => openBuilder(categoryIdFor(item.category))} iconRight={<ArrowRight className="h-4 w-4" />}>
                    Start something like this
                  </Button>
                </div>
              </article>
            ))}
          </Rail>
        </section>

        <DeliveredTotal />
        <TopPartners />

        {/* ---------- Two doors ---------- */}
        <section id="partners" className="mx-auto max-w-6xl scroll-mt-20 px-5 pb-14 sm:px-8 lg:pb-20">
          <div className="grid gap-4 md:grid-cols-2">
            <Link to="/partners" className="group relative overflow-hidden rounded-5xl bg-cyan-300 p-7 transition-transform hover:-translate-y-1 sm:p-9">
              <span className="pointer-events-none absolute -right-8 -top-8 h-44 w-56 bg-halftone-lg bg-dots-lg text-cyan-600/30" aria-hidden="true" />
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-ink-950">
                <Printer className="h-7 w-7" />
              </span>
              <h2 className="mt-8 text-3xl text-ink-950 sm:text-4xl">Verified manufacturing partners</h2>
              <p className="mt-3 max-w-md text-ink-800">
                We match your project to partners based on outcomes — not just machinery. Every partner is vetted for quality,
                capacity, and reliability.
              </p>
              <span className="mt-6 inline-flex items-center gap-2 font-bold text-ink-950">
                View all manufacturing partners <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
            <Link to="/designers" className="group relative overflow-hidden rounded-5xl bg-magenta-300 p-7 transition-transform hover:-translate-y-1 sm:p-9">
              <span className="pointer-events-none absolute -right-8 -top-8 h-44 w-56 bg-halftone-lg bg-dots-lg text-magenta-600/30" aria-hidden="true" />
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-ink-950">
                <Palette className="h-7 w-7" />
              </span>
              <h2 className="mt-8 text-3xl text-ink-950 sm:text-4xl">Need a design first?</h2>
              <p className="mt-3 max-w-md text-ink-800">
                Commission a vetted designer for a logo, label or packaging. The approved file flows straight into a print
                project — no re-uploading.
              </p>
              <span className="mt-6 inline-flex items-center gap-2 font-bold text-ink-950">
                Browse designers <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          </div>
        </section>

        {/* ---------- For print shops ---------- */}
        <section id="providers" className="scroll-mt-20 px-5 pb-16 sm:px-8 lg:pb-24">
          <div className="relative mx-auto max-w-6xl overflow-hidden rounded-5xl bg-ink-950 p-7 text-white sm:p-12">
            <span className="pointer-events-none absolute -bottom-16 -left-10 h-72 w-72 bg-halftone-lg bg-dots-lg text-white/[0.07]" aria-hidden="true" />
            <RegistrationMark className="absolute right-6 top-6 h-7 w-7 text-white/25" />
            <div className="relative grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-center">
              <div>
                <p className="slug text-sun-300">For printing businesses</p>
                <h2 className="mt-3 text-4xl sm:text-5xl">
                  You know manufacturing. <span className="text-white/45">We bring the customers.</span>
                </h2>
                <p className="mt-4 max-w-lg text-white/65">
                  No cold selling. No price fishing. No repetitive quotations. No explaining CMYK fifty times. Just
                  production-ready work, matched to your machines and capacity.
                </p>
                <Button variant="accent" size="lg" className="mt-7" onClick={openJoinPartner} iconRight={<ArrowRight className="h-5 w-5" />}>
                  Join as a Printing Partner
                </Button>
                <p className="mt-3 flex items-center gap-1.5 text-sm text-white/50">
                  <Clock className="h-4 w-4" /> Free to join · Set up your workspace in under a minute
                </p>
              </div>
              <ul className="grid gap-3 sm:grid-cols-2">
                {PARTNER_BENEFITS.map((b) => (
                  <li key={b.title} className="rounded-3xl bg-white/[0.07] p-5">
                    <b.icon className="h-6 w-6 text-sun-300" />
                    <h3 className="mt-3 text-lg">{b.title}</h3>
                    <p className="mt-1.5 text-sm text-white/60">{b.body}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />

      <Suspense fallback={null}>
        {builderWanted && <ProjectBuilder open={builderOpen} onClose={closeBuilder} initialCategoryId={initialCategory} />}
        <ActivityPill />
        {assistantReady && <Assistant onOpenBuilder={openBuilder} onOpenProvider={openJoinPartner} />}
      </Suspense>
    </div>
  );
}

/**
 * Three plates of ink laid over each other — where they overlap they
 * multiply into a third colour, exactly as on press — with a sample of what
 * the app actually shows you on top.
 */
/**
 * Three real photographs of print work, stacked and drifting like proofs on a table — the website's
 * hero idea, in this design's hand: each sits on an ink-coloured plate that peeks out behind it, the
 * way a sheet looks when one colour prints slightly out of register. The quotation card and the
 * status chip float on top, so the picture tells the whole story: on press, checked, packed, tracked.
 *
 * Stock photos (Pexels), decoration only: nothing here claims to be a customer's job. Swap in real
 * partner photos when there are some. Phones never see this block, so they are handed a 1-pixel
 * image instead of the photo; on a data-saver connection only the ink plates are drawn.
 */
const HERO_PHOTOS = [
  { id: '9550363', alt: 'Printed sheets running through an offset press', box: 'right-0 top-[3%] h-[62%] w-[64%]', plate: 'bg-magenta-300', tilt: '3deg', delay: '', w: 640, h: 620 },
  { id: '6620970', alt: 'Hands checking freshly printed sheets beside a press', box: 'left-0 top-0 h-[40%] w-[42%]', plate: 'bg-cyan-300', tilt: '-6deg', delay: '[animation-delay:-2s]', w: 420, h: 400 },
  { id: '31651848', alt: 'Finished printed boxes, packed', box: 'bottom-[3%] left-[3%] h-[36%] w-[46%]', plate: 'bg-sun-300', tilt: '-2deg', delay: '[animation-delay:-4s]', w: 460, h: 360 },
] as const;
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

function HeroArt({ lean }: { lean: boolean }) {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-lg">
      <CropMarks className="text-ink-300" />
      <RegistrationMark className="absolute right-1 top-0 h-7 w-7 text-ink-400" />

      {HERO_PHOTOS.map((p) => {
        const url = `https://images.pexels.com/photos/${p.id}/pexels-photo-${p.id}.jpeg`;
        return (
          <div key={p.id} className={`absolute animate-float ${p.box} ${p.delay}`} style={{ '--tilt': p.tilt } as React.CSSProperties}>
            <span className={`absolute inset-0 translate-x-2.5 translate-y-2.5 rounded-[1.75rem] ${p.plate}`} aria-hidden="true" />
            {lean ? (
              <span className={`absolute inset-0 rounded-[1.75rem] ${p.plate} opacity-60`} aria-hidden="true" />
            ) : (
              <picture>
                <source media="(max-width: 1023px)" srcSet={BLANK} />
                <img
                  src={sized(url, p.w, p.h)}
                  srcSet={`${sized(url, p.w, p.h)} 1x, ${sized(url, p.w * 2, p.h * 2)} 2x`}
                  alt={p.alt}
                  decoding="async"
                  className="absolute inset-0 h-full w-full rounded-[1.75rem] border-4 border-[#fff] bg-ink-100 object-cover shadow-lift"
                />
              </picture>
            )}
          </div>
        );
      })}

      <div className="absolute bottom-[2%] right-[-1%] w-[58%] rounded-3xl bg-white p-3.5 shadow-lift ring-1 ring-ink-900/5" aria-hidden="true">
        <div className="flex items-center justify-between gap-2">
          <p className="slug text-ink-500">Coffee shop</p>
          <span className="rounded-full bg-sun-200 px-2.5 py-1 text-xs font-extrabold text-sun-900">3 quotations</span>
        </div>
        <p className="mt-1 font-display text-lg font-bold leading-tight text-ink-950">Kraft cup sleeves</p>
        <p className="text-xs text-ink-500">1,000 pcs · Pasig City</p>
        <div className="mt-2.5 space-y-1.5">
          {[
            { name: 'Manila Offset Press', price: '₱18,500', days: '12 days', ink: 'bg-cyan-300' },
            { name: 'Davao Digital Print', price: '₱19,200', days: '7 days', ink: 'bg-magenta-300' },
          ].map((q) => (
            <div key={q.name} className="flex items-center gap-2.5 rounded-2xl bg-ink-50 p-2">
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl font-display text-sm font-extrabold text-ink-950 ${q.ink}`}>{q.name[0]}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.8125rem] font-bold text-ink-900">{q.name}</p>
                <p className="text-xs text-ink-500">{q.days}</p>
              </div>
              <p className="font-display text-base font-extrabold text-ink-950">{q.price}</p>
            </div>
          ))}
        </div>
      </div>

      <div
        className="absolute right-[-2%] top-[9%] flex animate-float items-center gap-2.5 rounded-full bg-ink-950 py-2 pl-2.5 pr-4 text-white shadow-lift [animation-delay:-1s]"
        style={{ '--tilt': '0deg' } as React.CSSProperties}
        aria-hidden="true"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-leaf-400 text-ink-950">
          <Check className="h-4 w-4" strokeWidth={3.5} />
        </span>
        <span className="text-sm font-bold">In production</span>
      </div>
    </div>
  );
}
