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
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Bricolage Grotesque Variable"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['"Figtree Variable"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        ink: {
          50: '#f6f5fa',
          100: '#eeecf5',
          200: '#dfdcea',
          300: '#c5c1d6',
          400: '#9893b0',
          500: '#716b8c',
          600: '#565070',
          700: '#403b57',
          800: '#2a263d',
          900: '#19162a',
          950: '#0f0d1a',
        },
        paper: {
          DEFAULT: '#ffffff',
          50: '#ffffff',
          100: '#fbfaff',
          200: '#f6f5fa',
          300: '#eeecf5',
        },
        magenta: {
          50: '#fff0f7',
          100: '#ffe0ef',
          200: '#ffc2e0',
          300: '#ff94c8',
          400: '#fb5aa9',
          500: '#ee2a8b',
          600: '#d6106f',
          700: '#b20a5a',
          800: '#8f0c4b',
          900: '#5e0a33',
        },
        cyan: {
          50: '#ebfaff',
          100: '#d0f3ff',
          200: '#a3e6ff',
          300: '#63d4fb',
          400: '#22bdf0',
          500: '#08a3dc',
          600: '#0683b6',
          700: '#0a6890',
          800: '#0f5573',
          900: '#0e3a50',
        },
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
  plugins: [],
};
