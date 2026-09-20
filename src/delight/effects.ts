import { getPrefs } from './prefs';

/**
 * The three small rewards: a burst of confetti, a short chime, a tap of vibration. Used only on
 * moments that deserve it (a project sent, a fee paid, an order delivered, a new quotation). All of
 * it is skipped for people who ask their device for reduced motion, and sounds can be switched off
 * in the account menu. Nothing here is loaded from the network: the chime is synthesised.
 */

const calm = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const INKS = ['#22bdf0', '#ee2a8b', '#ffd21f', '#7352f2', '#33c274', '#f97a1f'];

export function confetti(pieces = 70) {
  if (calm()) return;
  const layer = document.createElement('div');
  layer.setAttribute('aria-hidden', 'true');
  layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:200;overflow:hidden';
  for (let i = 0; i < pieces; i++) {
    const p = document.createElement('span');
    const size = 6 + Math.random() * 8;
    const x = Math.random() * 100;
    const drift = (Math.random() - 0.5) * 240;
    const fall = 70 + Math.random() * 40;
    const spin = (Math.random() - 0.5) * 1080;
    p.style.cssText = `position:absolute;top:-16px;left:${x}vw;width:${size}px;height:${size * (Math.random() > 0.5 ? 1 : 0.45)}px;background:${INKS[i % INKS.length]};border-radius:${Math.random() > 0.6 ? '50%' : '2px'}`;
    p.animate(
      [
        { transform: 'translate3d(0,0,0) rotate(0deg)', opacity: 1 },
        { transform: `translate3d(${drift}px,${fall}vh,0) rotate(${spin}deg)`, opacity: 0.9, offset: 0.85 },
        { transform: `translate3d(${drift * 1.1}px,${fall + 12}vh,0) rotate(${spin}deg)`, opacity: 0 },
      ],
      { duration: 1600 + Math.random() * 1400, delay: Math.random() * 350, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' },
    );
    layer.appendChild(p);
  }
  document.body.appendChild(layer);
  window.setTimeout(() => layer.remove(), 3600);
}

let audio: AudioContext | null = null;

/** `good`: two rising notes (paid, delivered, sent). `ping`: one soft note (something new arrived). */
export function chime(kind: 'good' | 'ping' = 'good') {
  if (!getPrefs().sounds) return;
  try {
    const Ctx = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audio ??= new Ctx();
    const ctx = audio;
    if (ctx.state === 'suspended') void ctx.resume();
    const notes = kind === 'good' ? [659.25, 987.77] : [880];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.13;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.55);
    });
  } catch {
    /* no audio on this device: fine */
  }
}

export function buzz(pattern: number | number[] = 18) {
  if (!getPrefs().sounds) return;
  // Browsers only allow this after the person has tapped something; asking earlier just logs a complaint.
  const active = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
  if (active && !active.hasBeenActive) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* not supported (iPhone): fine */
  }
}

/** The full treatment for a big moment. */
export function celebrate() {
  confetti();
  chime('good');
  buzz([16, 40, 24]);
}

/**
 * Runs `effect` the first time `key` is seen on this device, and never again. For moments that are
 * discovered by opening a screen ("your order was delivered") rather than caused by a tap.
 */
export function once(key: string, effect: () => void) {
  const k = `printair.seen.${key}`;
  try {
    if (localStorage.getItem(k)) return;
    localStorage.setItem(k, '1');
  } catch {
    return;
  }
  effect();
}
