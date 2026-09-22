/**
 * PrintAir "Process" design tokens.
 *
 * The identity is built on the four process inks a press actually runs:
 * cyan, magenta, yellow and key (black). `ink` is the key plate and every
 * neutral; `paper` is the stock the app is printed on. Two overprints are
 * named because they are used on their own: `grape` (cyan over magenta) and
 * `leaf` (cyan over yellow).
 *
 * @type {import('tailwindcss').Config}
 */
import plugin from 'tailwindcss/plugin.js';

/*
  Skins.

  Four palettes (ink, paper, magenta, cyan) and the two font families are CSS variables rather than
  fixed values, so a part of the page can be re-skinned by putting one class on a wrapper:

    (nothing)   "Process"  — the app's own look: press inks, Bricolage Grotesque + Figtree.
    .classic    "Classic"  — the original PrintAir website's look: warm paper, ember orange,
                             Fraunces headlines + Plus Jakarta Sans. Same layout, same components.

  Everything inside a `.classic` wrapper (including portalled sheets, which carry the class
  themselves) picks the classic values up with no other code change. See src/styles/classic.css for
  the handful of non-colour details (button gradient, headline weight, ornaments).
*/
const PROCESS = {
  white: { DEFAULT: '#ffffff' },
  ink: { 50: '#f6f5fa', 100: '#eeecf5', 200: '#dfdcea', 300: '#c5c1d6', 400: '#9893b0', 500: '#716b8c', 600: '#565070', 700: '#403b57', 800: '#2a263d', 900: '#19162a', 950: '#0f0d1a' },
  paper: { DEFAULT: '#ffffff', 50: '#ffffff', 100: '#fbfaff', 200: '#f6f5fa', 300: '#eeecf5' },
  magenta: { 50: '#fdeef7', 100: '#fcddee', 200: '#f8bcdd', 300: '#f389c3', 400: '#ed44a1', 500: '#e6017f', 600: '#bd0168', 700: '#9a0155', 800: '#7f0146', 900: '#55002f' },
  cyan: { 50: '#edf7fd', 100: '#d4edfa', 200: '#acdcf4', 300: '#6ec2ec', 400: '#2aa5e3', 500: '#0094de', 600: '#007ab7', 700: '#006496', 800: '#00547f', 900: '#003d5c' },
  sun: { 50: '#fef9e7', 100: '#fef0c2', 200: '#fce38b', 300: '#fbd451', 400: '#facb2b', 500: '#f9c101', 600: '#cfa001', 700: '#a37e01', 800: '#816401', 900: '#5a4500' },
  grape: { 50: '#f3f1ff', 100: '#e8e4ff', 200: '#d3cbff', 300: '#b3a5ff', 400: '#9078fb', 500: '#7352f2', 600: '#5d38dc', 700: '#4c2bb8', 800: '#3d2591', 900: '#2a1b63' },
  leaf: { 50: '#ebfbf1', 100: '#d1f6df', 200: '#a5ecc1', 300: '#6bdb9b', 400: '#33c274', 500: '#16a35a', 600: '#0d8348', 700: '#0d683c', 800: '#0f5232', 900: '#0b3822' },
  danger: { 50: '#fff1f1', 100: '#ffdfdf', 200: '#ffc4c4', 500: '#ef3b45', 600: '#d81f2e', 700: '#b01524' },
};

/**
 * The original website's neutrals (warm paper, warm ink) with the brand's own accents.
 *
 * Classic used to map magenta → ember orange and cyan → teal, the website's colours, which came
 * from the old orange "Air". The wordmark is now PRINT in ink and AIR in cyan, magenta, yellow —
 * there is no orange left in the brand — so Classic keeps its warmth in the neutrals and type
 * and takes the same magenta and cyan as Process. One brand, two temperatures.
 */
const CLASSIC = {
  ink: { 50: '#f7f5f2', 100: '#ebe7e0', 200: '#d6cfc3', 300: '#b8ac9a', 400: '#978873', 500: '#7d6e5b', 600: '#665847', 700: '#54483b', 800: '#463d33', 900: '#322c25', 950: '#1c1714' },
  paper: { DEFAULT: '#fefdfb', 50: '#fefdfb', 100: '#fdfbf7', 200: '#fbf8f3', 300: '#f5f0e8' },
  magenta: { 50: '#fdeef7', 100: '#fcddee', 200: '#f8bcdd', 300: '#f389c3', 400: '#ed44a1', 500: '#e6017f', 600: '#bd0168', 700: '#9a0155', 800: '#7f0146', 900: '#55002f' },
  cyan: { 50: '#edf7fd', 100: '#d4edfa', 200: '#acdcf4', 300: '#6ec2ec', 400: '#2aa5e3', 500: '#0094de', 600: '#007ab7', 700: '#006496', 800: '#00547f', 900: '#003d5c' },
};

/**
 * Dark mode (beta). Rather than restyling every screen, the scales are turned over: what was the
 * lightest step of a colour becomes its darkest and the other way round, "white" becomes the card
 * surface and `ink` runs light-on-dark. A class that read "pale tile, dark text" in light mode reads
 * "deep tile, light text" here with no change to the component. Yellows are pushed to amber so
 * light text stays readable on them.
 */
const flip = (scale) => {
  const keys = Object.keys(scale).filter((k) => k !== 'DEFAULT');
  const out = Object.fromEntries(keys.map((k, i) => [k, scale[keys[keys.length - 1 - i]]]));
  return out;
};
const DARK = {
  white: { DEFAULT: '#1e1b2c' },
  ink: { 50: '#1b1829', 100: '#242136', 200: '#34304a', 300: '#4c4766', 400: '#7a7493', 500: '#a09bb6', 600: '#bbb7cd', 700: '#d3d0e1', 800: '#e7e5f0', 900: '#f2f1f8', 950: '#fbfafe' },
  paper: { DEFAULT: '#1e1b2c', 50: '#1e1b2c', 100: '#191626', 200: '#14121f', 300: '#242136' },
  magenta: flip(PROCESS.magenta),
  cyan: flip(PROCESS.cyan),
  grape: flip(PROCESS.grape),
  leaf: flip(PROCESS.leaf),
  sun: { 50: '#2e2208', 100: '#3d2d08', 200: '#57400a', 300: '#7a5a06', 400: '#8f6a04', 500: '#a87c00', 600: '#e0b53a', 700: '#f1cf66', 800: '#fae39a', 900: '#fff5cf' },
  danger: { 50: '#3a1518', 100: '#4b1a1f', 200: '#6b2229', 500: '#ff6b73', 600: '#ff8a90', 700: '#ffb3b7' },
};

const channels = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(' ');
const vars = (skin) =>
  Object.fromEntries(Object.entries(skin).flatMap(([name, shades]) => Object.entries(shades).map(([k, hex]) => [`--${name}-${k}`, channels(hex)])));
const skinnable = (name) => Object.fromEntries(Object.keys(PROCESS[name]).map((k) => [k, `rgb(var(--${name}-${k}) / <alpha-value>)`]));

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        // The "PrintAir" wordmark only (Marks.tsx). Not swapped by `.classic`: see --font-wordmark below.
        wordmark: ['var(--font-wordmark)', 'var(--font-display)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        white: 'rgb(var(--white-DEFAULT) / <alpha-value>)',
        ink: skinnable('ink'),
        paper: skinnable('paper'),
        magenta: skinnable('magenta'),
        cyan: skinnable('cyan'),
        sun: skinnable('sun'),
        grape: skinnable('grape'),
        leaf: skinnable('leaf'),
        danger: skinnable('danger'),
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(25,22,42,0.04), 0 6px 20px -8px rgba(25,22,42,0.10)',
        card: '0 1px 2px rgba(25,22,42,0.05), 0 14px 36px -14px rgba(25,22,42,0.18)',
        lift: '0 28px 70px -20px rgba(25,22,42,0.38), 0 10px 26px -10px rgba(25,22,42,0.16)',
        pop: '0 10px 0 -4px rgba(25,22,42,0.10)',
        magenta: '0 14px 30px -10px rgba(230,1,127,0.55)',
        nav: '0 -8px 30px -12px rgba(25,22,42,0.18)',
      },
      backgroundImage: {
        halftone: 'radial-gradient(circle at center, currentColor 1.2px, transparent 1.6px)',
        'halftone-lg': 'radial-gradient(circle at center, currentColor 2px, transparent 2.6px)',
      },
      backgroundSize: {
        dots: '12px 12px',
        'dots-lg': '18px 18px',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'sheet-up': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        'pop-in': {
          from: { opacity: '0', transform: 'scale(0.94) translateY(8px)' },
          to: { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        'toast-in': {
          from: { opacity: '0', transform: 'translateY(16px) scale(0.96)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        ink: {
          '0%, 80%, 100%': { transform: 'scale(0.55)', opacity: '0.45' },
          '40%': { transform: 'scale(1)', opacity: '1' },
        },
        shimmer: {
          from: { backgroundPosition: '200% 0' },
          to: { backgroundPosition: '-200% 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0) rotate(var(--tilt, 0deg))' },
          '50%': { transform: 'translateY(-10px) rotate(var(--tilt, 0deg))' },
        },
        'pulse-ring': {
          from: { transform: 'scale(0.9)', opacity: '0.7' },
          to: { transform: 'scale(1.9)', opacity: '0' },
        },
        marquee: {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
        'pip-bob': { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-7px)' } },
        'pip-hop': {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
          '35%': { transform: 'translateY(-16px) rotate(-8deg)' },
          '60%': { transform: 'translateY(0) rotate(4deg)' },
        },
        'pip-breathe': { '0%, 100%': { transform: 'scale(1)' }, '50%': { transform: 'scale(1.035)' } },
        'pip-wobble': { '0%, 100%': { transform: 'rotate(-3deg)' }, '50%': { transform: 'rotate(4deg)' } },
        'pip-trail': { '0%, 100%': { opacity: '0.25', transform: 'translateX(4px)' }, '50%': { opacity: '1', transform: 'translateX(-3px)' } },
        'pip-zzz': { '0%': { opacity: '0', transform: 'translateY(6px)' }, '40%': { opacity: '1' }, '100%': { opacity: '0', transform: 'translateY(-8px)' } },
        'pip-twinkle': { '0%, 100%': { opacity: '0.35', transform: 'scale(0.9)' }, '50%': { opacity: '1', transform: 'scale(1.08)' } },
        confetti: {
          '0%': { transform: 'translateY(0) rotate(0deg)', opacity: '1' },
          '100%': { transform: 'translateY(140px) rotate(320deg)', opacity: '0' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.25s ease-out both',
        'fade-up': 'fade-up 0.5s cubic-bezier(0.22,1,0.36,1) both',
        'sheet-up': 'sheet-up 0.38s cubic-bezier(0.22,1,0.36,1) both',
        'pop-in': 'pop-in 0.3s cubic-bezier(0.22,1,0.36,1) both',
        'toast-in': 'toast-in 0.3s cubic-bezier(0.22,1,0.36,1) both',
        ink: 'ink 1.1s ease-in-out infinite',
        shimmer: 'shimmer 1.6s linear infinite',
        float: 'float 6s ease-in-out infinite',
        'pulse-ring': 'pulse-ring 1.8s ease-out infinite',
        marquee: 'marquee 36s linear infinite',
        confetti: 'confetti 1.4s ease-in forwards',
        'pip-bob': 'pip-bob 2.4s ease-in-out infinite',
        'pip-hop': 'pip-hop 1.1s cubic-bezier(.3,.7,.3,1) infinite',
        'pip-breathe': 'pip-breathe 3.2s ease-in-out infinite',
        'pip-wobble': 'pip-wobble 1.8s ease-in-out infinite',
        'pip-trail': 'pip-trail 1.2s ease-in-out infinite',
        'pip-zzz': 'pip-zzz 2.6s ease-in-out infinite',
        'pip-twinkle': 'pip-twinkle 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [
    plugin(({ addBase }) =>
      addBase({
        // '--font-wordmark' is set once here, never inside '.classic': the "PrintAir" logotype is
        // fixed brand identity, not a themable surface, so it stays the same face in every skin.
        ':root': {
          ...vars(PROCESS),
          '--font-display': '"Bricolage Grotesque Variable"',
          '--font-sans': '"Figtree Variable"',
          '--font-wordmark': '"Unbounded Variable"',
        },
        '.classic': { ...vars(CLASSIC), '--font-display': '"Fraunces Variable"', '--font-sans': '"Plus Jakarta Sans Variable"' },
        // After .classic on purpose: with both on, dark wins the colours and Classic keeps its fonts.
        '.dark, .dark .classic': { ...vars(DARK), 'color-scheme': 'dark', '--pip-navy': '#6b7488' },
      }),
    ),
  ],
};
