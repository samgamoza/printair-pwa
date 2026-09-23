/**
 * Brand marks and print-shop ornaments.
 *
 * The logo is PrintAir's own artwork, used exactly as supplied. `Logo` is the
 * owner's single lockup file — plane and PRINTAIR together, at the spacing they
 * were drawn with, which is why it is one image and not two the app has to space
 * itself. `LogoMark` is the plane alone, for the few places that show no name.
 * The full lockup with the "PRINT. DELIVERED." tagline lives in public/brand/:
 * its tagline is 7% of the artwork's height, so it needs a surface far taller
 * than a header row before it can be read. `npm run icons` cuts
 * the plane from `brand/printair-mark-source.png` into `src/assets/brand/` (what
 * the app renders) and `public/` (favicon, home-screen icons, manifest).
 *
 * The mark is drawn straight onto the surface, at full size. It used to sit on
 * a white rounded tile, which the previous navy plane needed to survive the ink
 * side rail; this artwork carries its own light glow, so it holds on both the
 * paper and the rail on its own — and reads a third larger in the same space.
 * The home-screen icons keep a white tile, which `npm run icons` adds: a phone
 * draws them on whatever wallpaper it likes.
 *
 * The artwork is imported, not referenced by a fixed path under public/, so
 * Vite gives each file a content-hashed name. A fixed name is a trap for
 * artwork: replace the file, keep the name, and every browser and installed
 * service worker keeps showing the old one from cache.
 *
 * The ornaments further down are drawn in code so they stay crisp at any size.
 */
import logoMark from '@/assets/brand/logo-mark.png';
import lockupOnLight from '@/assets/brand/lockup.png';
import lockupOnDark from '@/assets/brand/lockup-light.png';

export function PlaneGlyph({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <img
      src={logoMark}
      alt=""
      aria-hidden="true"
      draggable={false}
      decoding="async"
      className={`select-none object-contain ${className}`}
    />
  );
}

/**
 * The plane on its white tile — the app icon. `tone` is kept so callers don't
 * change; on dark backgrounds the tile drops its border, that's all.
 */
export function LogoMark({ className = 'h-10 w-10' }: { className?: string }) {
  return <PlaneGlyph className={`shrink-0 ${className}`} />;
}

export function Logo({
  className = '',
  tone = 'dark',
  size = 'h-12',
}: {
  className?: string;
  tone?: 'dark' | 'light';
  /**
   * The lockup's height. Width follows, so it can never be squashed.
   *
   * The height is the whole artwork, glow included, and the glow is roughly a
   * third of it — so PRINTAIR itself reads about a third of whatever is set
   * here. That is why these numbers are a notch larger than they look: h-12
   * puts the name at the same 16px it has always been.
   */
  size?: string;
}) {
  return (
    <img
      data-wordmark
      src={tone === 'light' ? lockupOnDark : lockupOnLight}
      alt="PrintAir"
      draggable={false}
      className={`w-auto select-none ${size} ${className}`}
    />
  );
}

/** The crosshair printers use to line up plates. Purely decorative here. */
export function RegistrationMark({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg data-ornament viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="6" />
      <path d="M12 1v22M1 12h22" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** The colour control strip from the edge of a press sheet. */
export function ColorBar({ className = '', size = 'h-2.5 w-2.5' }: { className?: string; size?: string }) {
  return (
    <span data-ornament className={`inline-flex gap-1 ${className}`} aria-hidden="true">
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
    <span data-ornament className={`pointer-events-none absolute inset-0 ${className}`} aria-hidden="true">
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
