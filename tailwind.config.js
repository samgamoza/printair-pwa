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
  ink: { 50: '#f6f5fa', 100: '#eeecf5', 200: '#dfdcea', 300: '#c5c1d6', 400: '#9893b0', 500: '#716b8c', 600: '#565070', 700: '#403b57', 800: '#2a263d', 900: '#19162a', 950: '#0f0d1a' },
  paper: { DEFAULT: '#ffffff', 50: '#ffffff', 100: '#fbfaff', 200: '#f6f5fa', 300: '#eeecf5' },
  magenta: { 50: '#fff0f7', 100: '#ffe0ef', 200: '#ffc2e0', 300: '#ff94c8', 400: '#fb5aa9', 500: '#ee2a8b', 600: '#d6106f', 700: '#b20a5a', 800: '#8f0c4b', 900: '#5e0a33' },
  cyan: { 50: '#ebfaff', 100: '#d0f3ff', 200: '#a3e6ff', 300: '#63d4fb', 400: '#22bdf0', 500: '#08a3dc', 600: '#0683b6', 700: '#0a6890', 800: '#0f5573', 900: '#0e3a50' },
};

/** The original website's tokens, mapped onto this app's palette names. magenta → ember, cyan → teal. */
const CLASSIC = {
  ink: { 50: '#f7f5f2', 100: '#ebe7e0', 200: '#d6cfc3', 300: '#b8ac9a', 400: '#978873', 500: '#7d6e5b', 600: '#665847', 700: '#54483b', 800: '#463d33', 900: '#322c25', 950: '#1c1714' },
  paper: { DEFAULT: '#fefdfb', 50: '#fefdfb', 100: '#fdfbf7', 200: '#fbf8f3', 300: '#f5f0e8' },
  magenta: { 50: '#fff8ed', 100: '#ffedd0', 200: '#fed7a0', 300: '#fdba6b', 400: '#fc9a3c', 500: '#f57c14', 600: '#de620a', 700: '#b8490b', 800: '#93390f', 900: '#78300f' },
  cyan: { 50: '#f0fdfa', 100: '#ccfbf1', 200: '#99f6e4', 300: '#5eead4', 400: '#2dd4bf', 500: '#14b8a6', 600: '#0d9488', 700: '#0f766e', 800: '#115e59', 900: '#134e4a' },
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
      },
      colors: {
        ink: skinnable('ink'),
        paper: skinnable('paper'),
        magenta: skinnable('magenta'),
        cyan: skinnable('cyan'),
        sun: {
          50: '#fffbe6',
          100: '#fff5bf',
          200: '#ffeb85',
          300: '#ffdf47',
          400: '#ffd21f',
          500: '#f2b900',
          600: '#c98f00',
          700: '#9a6a04',
          800: '#73500a',
          900: '#4d360a',
        },
        grape: {
          50: '#f3f1ff',
          100: '#e8e4ff',
          200: '#d3cbff',
          300: '#b3a5ff',
          400: '#9078fb',
          500: '#7352f2',
          600: '#5d38dc',
          700: '#4c2bb8',
          800: '#3d2591',
          900: '#2a1b63',
        },
        leaf: {
          50: '#ebfbf1',
          100: '#d1f6df',
          200: '#a5ecc1',
          300: '#6bdb9b',
          400: '#33c274',
          500: '#16a35a',
          600: '#0d8348',
          700: '#0d683c',
          800: '#0f5232',
          900: '#0b3822',
        },
        danger: {
          50: '#fff1f1',
          100: '#ffdfdf',
          200: '#ffc4c4',
          500: '#ef3b45',
          600: '#d81f2e',
          700: '#b01524',
        },
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
        magenta: '0 14px 30px -10px rgba(238,42,139,0.55)',
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
      },
    },
  },
  plugins: [
    plugin(({ addBase }) =>
      addBase({
        ':root': { ...vars(PROCESS), '--font-display': '"Bricolage Grotesque Variable"', '--font-sans': '"Figtree Variable"' },
        '.classic': { ...vars(CLASSIC), '--font-display': '"Fraunces Variable"', '--font-sans': '"Plus Jakarta Sans Variable"' },
      }),
    ),
  ],
};
