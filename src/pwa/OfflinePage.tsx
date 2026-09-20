import { Button } from '@/components/ui/Button';
import { Logo, ColorBar } from '@/components/ui/Marks';
import { Pip } from '@/delight/Mascot';
import { useSay } from '@/delight/prefs';

/** Shown when a page is opened with no connection and nothing cached to fall back on. */
export default function OfflinePage() {
  const say = useSay();
  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-paper-200 px-6 text-center">
      <span className="pointer-events-none absolute -left-10 top-10 h-56 w-56 bg-halftone-lg bg-dots-lg text-cyan-300/50" aria-hidden="true" />
      <span className="pointer-events-none absolute -right-10 bottom-10 h-56 w-56 bg-halftone-lg bg-dots-lg text-magenta-300/50" aria-hidden="true" />
      <Logo />
      <Pip mood="oops" className="mt-10 h-32 w-32" />
      <h1 className="mt-4 text-4xl text-ink-950">{say("You're offline", 'Oops, walang signal')}</h1>
      <p className="mt-3 max-w-sm text-ink-600">
        PrintAir needs a connection to load your projects and quotes. Nothing you&apos;ve saved is lost — it&apos;s all waiting for you.
      </p>
      <Button size="lg" className="mt-8" onClick={() => window.location.reload()}>
        Try again
      </Button>
      <ColorBar className="mt-12" />
    </div>
  );
}
