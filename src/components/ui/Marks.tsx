/**
 * Brand marks and print-shop ornaments.
 *
 * Everything here is drawn in code so it stays crisp at any size and works
 * offline. The plane keeps PrintAir's paper-plane idea but is rebuilt from
 * the process inks: a cyan wing, a magenta wing, and the fold where they
 * "overprint" into grape, trailed by two yellow speed marks.
 */

const PLANE_PATHS = {
  upper: '44,4 3,21 19,28',
  lower: '44,4 19,28 27,45',
  fold: '19,28 18,41 24.6,34.2',
};

export function PlaneGlyph({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <polygon points={PLANE_PATHS.upper} fill="#22bdf0" />
      <polygon points={PLANE_PATHS.lower} fill="#ee2a8b" />
      <polygon points={PLANE_PATHS.fold} fill="#5d38dc" />
      <rect x="2" y="33.5" width="10" height="3.6" rx="1.8" fill="#ffd21f" transform="rotate(-38 7 35.3)" />
      <rect x="7" y="40" width="7" height="3.6" rx="1.8" fill="#ffd21f" transform="rotate(-38 10.5 41.8)" />
    </svg>
  );
}

/** The plane on an ink tile — the app icon. `tone="light"` flips the tile to white for dark backgrounds. */
export function LogoMark({ className = 'h-10 w-10', tone = 'dark' }: { className?: string; tone?: 'dark' | 'light' }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-[28%] shadow-soft ${
        tone === 'light' ? 'bg-white' : 'bg-ink-950'
      } ${className}`}
    >
      <PlaneGlyph className="h-[68%] w-[68%]" />
    </span>
  );
}

export function Logo({
  className = '',
  tone = 'dark',
  markClassName = 'h-9 w-9',
}: {
  className?: string;
  tone?: 'dark' | 'light';
  markClassName?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark className={markClassName} tone={tone} />
      <span
        className={`font-display text-[1.35rem] font-extrabold leading-none tracking-tight ${
          tone === 'light' ? 'text-white' : 'text-ink-950'
        }`}
        style={{ fontVariationSettings: "'wdth' 88" }}
      >
        Print<span className="text-magenta-500">Air</span>
      </span>
    </span>
  );
}

/** The crosshair printers use to line up plates. Purely decorative here. */
export function RegistrationMark({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="6" />
      <path d="M12 1v22M1 12h22" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** The colour control strip from the edge of a press sheet. */
export function ColorBar({ className = '', size = 'h-2.5 w-2.5' }: { className?: string; size?: string }) {
  return (
    <span className={`inline-flex gap-1 ${className}`} aria-hidden="true">
      <span className={`${size} rounded-[3px] bg-cyan-400`} />
      <span className={`${size} rounded-[3px] bg-magenta-500`} />
      <span className={`${size} rounded-[3px] bg-sun-400`} />
      <span className={`${size} rounded-[3px] bg-ink-950`} />
    </span>
  );
}

/** Corner crop marks around a block, as on an untrimmed proof. */
export function CropMarks({ className = 'text-ink-300' }: { className?: string }) {
  const arm = 'absolute h-3 w-3 border-current';
  return (
    <span className={`pointer-events-none absolute inset-0 ${className}`} aria-hidden="true">
      <span className={`${arm} -left-1.5 -top-1.5 border-b border-r`} />
      <span className={`${arm} -right-1.5 -top-1.5 border-b border-l`} />
      <span className={`${arm} -bottom-1.5 -left-1.5 border-r border-t`} />
      <span className={`${arm} -bottom-1.5 -right-1.5 border-l border-t`} />
    </span>
  );
}

/** A field of halftone dots. Set the ink with a text colour class. */
export function Halftone({ className = '' }: { className?: string }) {
  return <span className={`pointer-events-none absolute bg-halftone bg-dots ${className}`} aria-hidden="true" />;
}

/** Loading indicator: the four inks laying down one after another. */
export function InkLoader({
  className = '',
  label = 'Loading',
  tone = 'process',
}: {
  className?: string;
  label?: string;
  /** `current` paints all four dots in the surrounding text colour, for use inside buttons. */
  tone?: 'process' | 'current';
}) {
  const dots =
    tone === 'current'
      ? ['bg-current', 'bg-current opacity-90', 'bg-current opacity-80', 'bg-current opacity-70']
      : ['bg-cyan-400', 'bg-magenta-500', 'bg-sun-400', 'bg-ink-900'];
  return (
    <span role="status" aria-label={label} className={`inline-flex items-center gap-1.5 ${className}`}>
      {dots.map((c, i) => (
        <span key={i} className={`h-2.5 w-2.5 animate-ink rounded-full ${c}`} style={{ animationDelay: `${i * 0.14}s` }} />
      ))}
    </span>
  );
}
