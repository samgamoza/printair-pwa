import { useState, type ReactNode } from 'react';
import { Check, Download, Info, MonitorDown, MoreVertical, PlusSquare, Share, Smartphone, X, type LucideIcon } from 'lucide-react';
import { useInstall, type InstallRoute } from './install';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { LogoMark } from '@/components/ui/Marks';

const STEP_TINTS = [
  { row: 'bg-cyan-50', icon: 'text-cyan-700' },
  { row: 'bg-magenta-50', icon: 'text-magenta-700' },
];

/** Written steps for browsers that give a site no install button of its own. */
const STEPS: Record<Exclude<InstallRoute, 'prompt'>, { icon: LucideIcon; text: ReactNode }[]> = {
  ios: [
    { icon: Share, text: <>Tap <b>Share</b> in your browser&apos;s toolbar.</> },
    { icon: PlusSquare, text: <>Choose <b>Add to Home Screen</b>, then <b>Add</b>.</> },
  ],
  android: [
    { icon: MoreVertical, text: <>Tap the <b>⋮ menu</b> at the top of your browser.</> },
    { icon: Download, text: <>Choose <b>Install app</b> (some browsers say <b>Add to Home screen</b>).</> },
  ],
  desktop: [
    { icon: MonitorDown, text: <>Click the <b>install icon</b> at the right end of the address bar — or open the browser menu and choose <b>Install PrintAir</b>.</> },
    { icon: Smartphone, text: <>On a phone instead? Open this same address there and tap <b>Get the app</b>.</> },
  ],
};

const BENEFITS = ['Opens from your home screen, full-screen', 'No app store, no big download', 'Always the latest version'];

/**
 * The one place that explains how to get PrintAir as an app. Where the browser
 * allows it, that is a single button. Everywhere else it is the two steps for
 * that device, so the offer never has to be hidden.
 */
export function InstallSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { how, install } = useInstall();
  const [busy, setBusy] = useState(false);

  return (
    <Sheet open={open} onClose={onClose} size="sm" labelledBy="install-title">
      <div className="px-6 pb-8 pt-6 sm:px-8 sm:pt-8">
        <LogoMark className="h-14 w-14" />
        <h2 id="install-title" className="mt-4 text-2xl text-ink-950">
          {how === 'prompt' ? 'Install PrintAir' : how === 'desktop' ? 'Get PrintAir as an app' : 'Add PrintAir to your Home Screen'}
        </h2>

        {how === 'prompt' ? (
          <>
            <p className="mt-2 text-ink-600">It installs straight from here in a few seconds.</p>
            <ul className="mt-5 space-y-2.5">
              {BENEFITS.map((b) => (
                <li key={b} className="flex items-center gap-3 font-medium text-ink-800">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-leaf-400 text-ink-950">
                    <Check className="h-3.5 w-3.5" strokeWidth={3.5} />
                  </span>
                  {b}
                </li>
              ))}
            </ul>
            <Button
              variant="accent"
              fullWidth
              size="lg"
              className="mt-6"
              loading={busy}
              icon={<Download className="h-5 w-5" />}
              onClick={async () => {
                setBusy(true);
                try {
                  if (await install()) onClose();
                } finally {
                  setBusy(false);
                }
              }}
            >
              Install now
            </Button>
            <Button variant="ghost" fullWidth className="mt-2" onClick={onClose}>
              Not now
            </Button>
          </>
        ) : (
          <>
            <p className="mt-2 text-ink-600">
              It opens full-screen like any other app — no app store needed. {how === 'desktop' ? 'Here’s how:' : 'It takes two taps:'}
            </p>
            {import.meta.env.DEV && (
              <p className="mt-5 flex gap-2.5 rounded-2xl bg-sun-100 p-4 text-sm text-ink-800">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  You&apos;re on the preview running on this computer, where installing is switched off. The install option appears once
                  PrintAir is live on its own https address.
                </span>
              </p>
            )}
            <ol className="mt-5 space-y-3">
              {STEPS[how].map((s, i) => (
                <li key={i} className={`flex items-center gap-4 rounded-2xl p-4 ${STEP_TINTS[i % STEP_TINTS.length].row}`}>
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white ${STEP_TINTS[i % STEP_TINTS.length].icon}`}>
                    <s.icon className="h-5 w-5" />
                  </span>
                  <p className="font-medium text-ink-800">{s.text}</p>
                </li>
              ))}
            </ol>
            {how === 'desktop' && (
              <p className="mt-4 break-all rounded-2xl bg-ink-50 px-4 py-3 text-center font-display text-lg font-bold text-ink-950">
                {window.location.host}
              </p>
            )}
            <Button fullWidth size="lg" className="mt-6" onClick={onClose}>
              Got it
            </Button>
          </>
        )}
      </div>
    </Sheet>
  );
}

/**
 * A "Get the app" control for headers, footers and menus. Looks like whatever
 * `className` says; opens the browser's install dialog when there is one and
 * the steps when there isn't. Renders nothing inside the installed app.
 */
export function GetAppButton({ className = '', children }: { className?: string; children?: ReactNode }) {
  const { available, how, install } = useInstall();
  const [open, setOpen] = useState(false);
  if (!available) return null;
  return (
    <>
      <button type="button" className={className} onClick={() => (how === 'prompt' ? void install() : setOpen(true))}>
        {children ?? (
          <>
            <Download className="h-4 w-4" /> Get the app
          </>
        )}
      </button>
      <InstallSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/** Dismissible invitation to install. Renders nothing once installed or dismissed. */
export function InstallBanner({ className = '' }: { className?: string }) {
  const { shouldNudge, how, install, dismiss } = useInstall();
  const [open, setOpen] = useState(false);

  if (!shouldNudge) return <InstallSheet open={open} onClose={() => setOpen(false)} />;

  return (
    <>
      <div className={`relative flex items-center gap-3 overflow-hidden rounded-3xl bg-ink-950 p-3 pr-2 text-white ${className}`}>
        <span className="pointer-events-none absolute -right-6 -top-10 h-28 w-40 bg-halftone bg-dots text-white/15" aria-hidden="true" />
        <LogoMark className="h-11 w-11" tone="light" />
        <div className="min-w-0 flex-1">
          <p className="font-bold leading-tight">Get the PrintAir app</p>
          <p className="truncate text-sm text-white/65">One tap from your home screen. No app store.</p>
        </div>
        <Button variant="accent" size="sm" icon={<Download className="h-4 w-4" />} onClick={() => (how === 'prompt' ? void install() : setOpen(true))}>
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
      <InstallSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
