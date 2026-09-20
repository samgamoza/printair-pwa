import { useSyncExternalStore } from 'react';

/**
 * Small per-device preferences for the playful side of the app: which voice it speaks in, whether it
 * makes sounds, and light or dark. Kept in localStorage; nothing here touches the account.
 */
export type Voice = 'en' | 'taglish';
export type Theme = 'light' | 'dark';
type Prefs = { voice: Voice; sounds: boolean; theme: Theme };

const KEY = 'printair.prefs';
const DEFAULTS: Prefs = { voice: 'en', sounds: true, theme: 'light' };
const listeners = new Set<() => void>();
let cached: Prefs | null = null;

function read(): Prefs {
  if (cached) return cached;
  try {
    cached = { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Prefs>) };
  } catch {
    cached = { ...DEFAULTS };
  }
  return cached;
}

export function getPrefs(): Prefs {
  return read();
}

export function setPref<K extends keyof Prefs>(key: K, value: Prefs[K]) {
  cached = { ...read(), [key]: value };
  try {
    localStorage.setItem(KEY, JSON.stringify(cached));
  } catch {
    /* private mode: lasts until reload */
  }
  if (key === 'theme') applyTheme();
  listeners.forEach((l) => l());
}

export function usePrefs(): Prefs {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    read,
    () => DEFAULTS,
  );
}

export function applyTheme() {
  document.documentElement.classList.toggle('dark', read().theme === 'dark');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', read().theme === 'dark' ? '#14121f' : '#f6f5fa');
}

/**
 * The app's voice. English by default; Taglish is opt-in from the account menu.
 *
 * House rule: Taglish is for the friendly edges — loading, empty screens, celebrations, nudges.
 * Anything about money, errors, legal terms or an order's actual status stays in plain English in
 * both voices, so nothing important can be misread.
 */
export function useSay(): (en: string, taglish: string) => string {
  const { voice } = usePrefs();
  return (en, taglish) => (voice === 'taglish' ? taglish : en);
}
