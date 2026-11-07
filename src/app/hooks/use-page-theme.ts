'use client';

import * as React from 'react';
import type { Theme } from '@/components/ikas/theme-switch';

const STORAGE_KEY = 'nostok-theme';

/** Follows the `dark` class on <html> so every switch on the page stays in sync. */
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => observer.disconnect();
}

const getSnapshot = (): Theme =>
  document.documentElement.classList.contains('dark') ? 'dark' : 'light';

const getServerSnapshot = (): Theme => 'light';

/**
 * Current appearance and its setter. The stored preference is applied before
 * first paint by the inline script in the root layout; this hook only reads the
 * `dark` class and persists toggles.
 */
export function usePageTheme() {
  const theme = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setTheme = React.useCallback((next: Theme) => {
    document.documentElement.classList.toggle('dark', next === 'dark');
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage unavailable (private mode); the class still applies for this page.
    }
  }, []);

  return [theme, setTheme] as const;
}
