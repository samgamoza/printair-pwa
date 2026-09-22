import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Palette, ShieldCheck, Workflow, ArrowRight } from 'lucide-react';
import { MarketingHeader, MarketingFooter } from '@/components/marketing/Chrome';
import { Button } from '@/components/ui/Button';
import { ColorBar, CropMarks, RegistrationMark } from '@/components/ui/Marks';
import { useAuth } from '@/contexts/AuthContext';
import { DESIGN_SPECIALTIES } from '@/data/catalog';

/**
 * The designer front door, served at design.guma.one.
 *
 * Per the feature plan this is a route inside the existing app rather than a
 * separate build — same auth, same database, same deploy. Only the copy and
 * the call to action differ, because the audience does.
 *
 * Deliberately honest about the approval gate rather than burying it: a
 * designer who discovers after signing up that they cannot work yet is a
 * designer who leaves. The vetting is also the selling point — it is what
 * stops this being a race to the bottom on price.
 */
export default function DesignLandingPage() {
  const { openSignIn, profile } = useAuth();
  const navigate = useNavigate();
  // Applying is a page now, not a sheet.
  const openJoinDesigner = useCallback(() => navigate('/signup?role=designer'), [navigate]);
  const alreadyDesigner = profile?.role === 'designer';

  const tiles = ['bg-sun-200', 'bg-cyan-200', 'bg-magenta-200', 'bg-grape-200'];

  return (
    <div className="relative min-h-[100dvh] bg-paper-200 text-ink-900">
      <MarketingHeader />

      <main>
        <section className="relative overflow-hidden">
          <span className="pointer-events-none absolute -right-16 top-10 h-72 w-72 bg-halftone-lg bg-dots-lg text-magenta-300/60" aria-hidden="true" />
          <span className="pointer-events-none absolute -left-16 bottom-0 h-56 w-56 bg-halftone-lg bg-dots-lg text-grape-300/50" aria-hidden="true" />
          <div className="relative mx-auto max-w-4xl px-5 pb-14 pt-12 text-center sm:px-8 sm:pt-20">
            <p className="slug justify-center text-grape-700">
              <Palette className="h-3.5 w-3.5" /> For graphic designers
            </p>
            <h1 className="mt-5 text-balance text-[2.75rem] leading-[0.98] text-ink-950 sm:text-6xl lg:text-7xl">
              Design work that ends in something{' '}
              <span className="relative inline-block whitespace-nowrap">
                <span className="absolute inset-x-[-0.12em] bottom-[0.06em] top-[0.42em] -rotate-1 rounded-lg bg-magenta-300" aria-hidden="true" />
                <span className="relative">printed.</span>
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg text-ink-600">
              PrintAir customers arrive with a business need and no artwork. You pick up the ones that match what you do —
              packaging, labels, logos — and the finished file flows straight into production without you chasing anyone.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              {alreadyDesigner ? (
                <Button variant="accent" size="lg" onClick={() => navigate('/designer')} iconRight={<ArrowRight className="h-5 w-5" />}>
                  Go to your workspace
                </Button>
              ) : (
                <>
                  <Button variant="accent" size="lg" onClick={openJoinDesigner} iconRight={<ArrowRight className="h-5 w-5" />}>
                    Apply as a designer
                  </Button>
                  <Button size="lg" variant="secondary" onClick={() => openSignIn()}>
                    I already have an account
                  </Button>
                </>
              )}
            </div>
            <p className="mt-5 text-sm text-ink-500">
              Applications are reviewed by a person. Free to apply — PrintAir takes a 5% platform fee on accepted work.
            </p>
          </div>
        </section>

        <section className="bg-white py-14 lg:py-20">
          <div className="mx-auto grid max-w-6xl gap-4 px-5 sm:px-8 md:grid-cols-3">
            <Point
              tone="bg-cyan-300"
              icon={Workflow}
              title="Briefs that are already scoped"
              body="The customer has been guided through what they are printing before you see it — quantity, material, format. You are quoting design, not deciphering a request."
            />
            <Point
              tone="bg-sun-300"
              icon={ShieldCheck}
              title="Vetted, not crowded"
              body="Every designer is reviewed for print-ready output before receiving work. That is why customers trust the matches, and why you are not bidding against a hundred people."
            />
            <Point
              tone="bg-magenta-300"
              icon={Palette}
              title="It ends in production"
              body="An approved design becomes a print project in one click, on the same platform. No re-uploading, no handover email, no lost files."
            />
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-14 sm:px-8 lg:py-20">
          <p className="slug text-magenta-600">Specialties</p>
          <h2 className="mt-2 text-4xl text-ink-950 sm:text-5xl">What we match you on</h2>
          <p className="mt-3 text-ink-600">Narrow on purpose — every request here becomes a printed product.</p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {DESIGN_SPECIALTIES.map((s, i) => (
              <div key={s.id} className={`relative overflow-hidden rounded-4xl p-6 ${tiles[i % tiles.length]}`}>
                <span className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 bg-halftone bg-dots text-ink-950/10" aria-hidden="true" />
                <h3 className="text-2xl text-ink-950">{s.name}</h3>
                <p className="mt-2 text-ink-800">{s.tagline}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="px-5 pb-16 sm:px-8 lg:pb-24">
          <div className="relative mx-auto max-w-3xl overflow-hidden rounded-5xl bg-ink-950 p-8 text-center text-white sm:p-14">
            <CropMarks className="m-5 text-white/25" />
            <RegistrationMark className="mx-auto h-8 w-8 text-white/30" />
            <h2 className="mt-5 text-4xl sm:text-5xl">Apply in about two minutes</h2>
            <p className="mx-auto mt-3 max-w-md text-white/65">
              Tell us what you design and add a few samples. A reviewer looks at the work itself, not just a portfolio link.
            </p>
            <div className="mt-7 flex justify-center">
              <Button variant="accent" size="lg" onClick={alreadyDesigner ? () => navigate('/designer') : openJoinDesigner}>
                {alreadyDesigner ? 'Go to your workspace' : 'Apply as a designer'}
              </Button>
            </div>
            <ColorBar className="mt-8 justify-center" />
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}

function Point({
  icon: Icon,
  title,
  body,
  tone,
}: {
  icon: typeof Palette;
  title: string;
  body: string;
  tone: string;
}) {
  return (
    <div className="rounded-4xl bg-paper-200 p-6">
      <span className={`flex h-14 w-14 items-center justify-center rounded-2xl text-ink-950 ${tone}`}>
        <Icon className="h-7 w-7" />
      </span>
      <h3 className="mt-5 text-xl text-ink-950">{title}</h3>
      <p className="mt-2 text-ink-600">{body}</p>
    </div>
  );
}
