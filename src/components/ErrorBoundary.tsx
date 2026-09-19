import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * Last line of defence. An installed app has no address bar or reload button, so an unexpected
 * crash must never leave a blank screen — it shows a way out instead.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('PrintAir crashed while rendering:', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-paper-200 px-6 text-center">
        <span className="flex h-20 w-20 -rotate-6 items-center justify-center rounded-4xl bg-magenta-200 font-display text-4xl font-extrabold text-ink-950">
          !
        </span>
        <h1 className="mt-6 text-4xl text-ink-950">Something went wrong</h1>
        <p className="mt-3 max-w-sm text-ink-600">That&apos;s on us, not you. Nothing you saved has been lost. Reloading usually fixes it.</p>
        <div className="mt-8 flex flex-col gap-2.5 sm:flex-row">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex min-h-14 items-center justify-center rounded-full bg-ink-950 px-7 font-bold text-white active:scale-[0.97]"
          >
            Reload PrintAir
          </button>
          <a
            href="/app"
            className="inline-flex min-h-14 items-center justify-center rounded-full bg-white px-7 font-bold text-ink-950 ring-2 ring-inset ring-ink-200"
          >
            Go to my workspace
          </a>
        </div>
      </div>
    );
  }
}
