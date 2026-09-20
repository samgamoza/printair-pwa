import { useSyncExternalStore } from 'react';

/**
 * Which look the app wears. (Ours — not part of the data layer carried over from the website.)
 *
 *  - `mixed`   (default) the app's own "Process" look, with the original website's "Classic" look
 *              on the three guided flows the owner likes it for: signing up, joining as a printing
 *              partner or designer, and building a print project.
 *  - `process` Process everywhere.
 *  - `classic` Classic everywhere.
 *
 * The choice is only offered in demo mode (the yellow Demo button), so the two can be compared side
 * by side. Whatever ends up being chosen becomes the default here and the switch can go.
 */
export type Look = 'mixed' | 'process' | 'classic';

const KEY = 'printair.look';
const listeners = new Set<() => void>();

function read(): Look {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'process' || v === 'classic' ? v : 'mixed';
  } catch {
    return 'mixed';
  }
}

function apply(look: Look) {
  document.documentElement.classList.toggle('classic', look === 'classic');
}

export function setLook(look: Look) {
  try {
    localStorage.setItem(KEY, look);
  } catch {
    /* private mode: the choice lasts until reload */
  }
  apply(look);
  listeners.forEach((l) => l());
}

/** Call once at startup so "Classic everywhere" survives a reload. */
export function initLook() {
  apply(read());
}

export function useLook(): Look {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    read,
    () => 'mixed',
  );
}

/** Class for the wrapper of a guided flow: classic unless the owner switched to Process everywhere. */
export function useFlowSkin(): string {
  return useLook() === 'process' ? '' : 'classic';
}
