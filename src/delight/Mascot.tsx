/**
 * Pip — PrintAir's little paper plane.
 *
 * A character of its own, drawn here in code; it is not the logo and never replaces it. Pip shows up
 * only at the friendly edges of the app: while something loads, on an empty screen, when there is
 * something to celebrate, when the connection is gone. Never next to prices, payments or an order's
 * status, where the app stays businesslike.
 */
export type PipMood = 'fly' | 'nap' | 'cheer' | 'carry' | 'oops';

const NAVY = 'var(--pip-navy, #29303c)';
const ORANGE = '#f97a1f';
const ORANGE_DEEP = '#c9540d';

export function Pip({ mood = 'fly', className = 'h-24 w-24', label }: { mood?: PipMood; className?: string; label?: string }) {
  const tilt = mood === 'nap' ? 14 : mood === 'oops' ? 24 : mood === 'cheer' ? -18 : -6;
  const motion = mood === 'nap' ? 'animate-pip-breathe' : mood === 'cheer' ? 'animate-pip-hop' : mood === 'oops' ? 'animate-pip-wobble' : 'animate-pip-bob';

  return (
    <svg viewBox="0 0 120 120" className={className} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {/* speed lines / sleep / sparkles, outside the moving group so they stay put */}
      {(mood === 'fly' || mood === 'carry') && (
        <g stroke={ORANGE} strokeWidth="4" strokeLinecap="round" className="animate-pip-trail">
          <path d="M8 74h16" />
          <path d="M14 88h10" opacity=".7" />
        </g>
      )}
      {mood === 'nap' && (
        <g fill={NAVY} fontFamily="system-ui, sans-serif" fontWeight="800" className="animate-pip-zzz">
          <text x="84" y="34" fontSize="16">z</text>
          <text x="96" y="22" fontSize="12" opacity=".7">z</text>
        </g>
      )}
      {mood === 'cheer' && (
        <g fill="#ffd21f" className="animate-pip-twinkle">
          <path d="M18 26l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" />
          <path d="M98 16l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" />
          <path d="M104 78l2 4 4 2-4 2-2 4-2-4-4-2 4-2z" fill="#22bdf0" />
        </g>
      )}
      {mood === 'oops' && (
        <g fill="#c5c1d6">
          <ellipse cx="92" cy="30" rx="16" ry="9" />
          <ellipse cx="80" cy="34" rx="10" ry="7" />
        </g>
      )}

      <g className={motion} style={{ transformOrigin: '60px 62px' }}>
        <g transform={`rotate(${tilt} 60 62)`}>
          {/* body: top wing, underside, fold */}
          <path d="M104 40 22 58l28 12z" fill={NAVY} />
          <path d="M104 40 50 70l14 26z" fill={ORANGE} />
          <path d="M50 70 48 92l12-12z" fill={ORANGE_DEEP} />
          {/* face, on the navy wing */}
          {mood === 'nap' ? (
            <path d="M62 56q4 3 8 0" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" />
          ) : mood === 'oops' ? (
            <g stroke="#fff" strokeWidth="2.4" strokeLinecap="round">
              <path d="M61 52l6 5M67 52l-6 5" />
            </g>
          ) : (
            <g>
              <circle cx="65" cy="54.5" r="3.6" fill="#fff" />
              <circle cx={mood === 'cheer' ? 65.6 : 66.2} cy="54.5" r="1.7" fill={NAVY} />
            </g>
          )}
          {mood === 'cheer' && <path d="M72 60q5 3 9-1" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" />}
          {/* the parcel Pip carries */}
          {mood === 'carry' && (
            <g>
              <path d="M58 84v10" stroke={NAVY} strokeWidth="1.6" />
              <rect x="48" y="94" width="20" height="16" rx="2.5" fill="#e9c9a0" />
              <path d="M48 100h20M58 94v16" stroke="#b98f5a" strokeWidth="1.6" />
            </g>
          )}
        </g>
      </g>
    </svg>
  );
}
