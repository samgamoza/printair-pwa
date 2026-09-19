import { useState } from 'react';
import { Download, Share, PlusSquare, X } from 'lucide-react';
import { useInstall } from './install';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { LogoMark } from '@/components/ui/Marks';

/** Steps for iPhone and iPad, where the browser gives apps no install button of their own. */
export function IosInstallSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} size="sm" labelledBy="ios-install-title">
      <div className="px-6 pb-8 pt-6 sm:px-8 sm:pt-8">
        <LogoMark className="h-14 w-14" />
        <h2 id="ios-install-title" className="mt-4 text-2xl text-ink-950">
          Add PrintAir to your Home Screen
        </h2>
        <p className="mt-2 text-ink-600">It opens full-screen like any other app, and takes two taps.</p>
        <ol className="mt-6 space-y-3">
          <li className="flex items-center gap-4 rounded-2xl bg-cyan-50 p-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-cyan-700">
              <Share className="h-5 w-5" />
            </span>
            <p className="font-medium text-ink-800">
              Tap <b>Share</b> in Safari&apos;s toolbar.
            </p>
          </li>
          <li className="flex items-center gap-4 rounded-2xl bg-magenta-50 p-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-magenta-700">
              <PlusSquare className="h-5 w-5" />
            </span>
            <p className="font-medium text-ink-800">
              Choose <b>Add to Home Screen</b>, then <b>Add</b>.
            </p>
          </li>
        </ol>
        <Button fullWidth size="lg" className="mt-6" onClick={onClose}>
          Got it
        </Button>
      </div>
    </Sheet>
  );
}

/** Dismissible invitation to install. Renders nothing once installed, dismissed, or where installing isn't possible. */
export function InstallBanner({ className = '' }: { className?: string }) {
  const { shouldNudge, needsIosSteps, install, dismiss } = useInstall();
  const [iosOpen, setIosOpen] = useState(false);

  if (!shouldNudge) return <IosInstallSheet open={iosOpen} onClose={() => setIosOpen(false)} />;

  return (
    <>
      <div className={`relative flex items-center gap-3 overflow-hidden rounded-3xl bg-ink-950 p-3 pr-2 text-white ${className}`}>
        <span className="pointer-events-none absolute -right-6 -top-10 h-28 w-40 bg-halftone bg-dots text-white/15" aria-hidden="true" />
        <LogoMark className="h-11 w-11" tone="light" />
        <div className="min-w-0 flex-1">
          <p className="font-bold leading-tight">Get the PrintAir app</p>
          <p className="truncate text-sm text-white/65">One tap from your home screen. No app store.</p>
        </div>
        <Button
          variant="accent"
          size="sm"
          icon={<Download className="h-4 w-4" />}
          onClick={() => (needsIosSteps ? setIosOpen(true) : void install())}
        >
          Install
        </Button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <IosInstallSheet open={iosOpen} onClose={() => setIosOpen(false)} />
    </>
  );
}
