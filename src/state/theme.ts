// FR-10: Light / Dark / System theme. Explicit choice persists in localStorage;
// System follows the OS preference; switching never reloads or touches stored data.
import { useEffect, useState } from 'react';

export type ThemeChoice = 'light' | 'dark' | 'system';
const KEY = 'muletrace-theme';

function resolve(choice: ThemeChoice): 'light' | 'dark' {
  if (choice !== 'system') return choice;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function applyTheme(choice: ThemeChoice) {
  document.documentElement.dataset.theme = resolve(choice);
}

export function initTheme(): ThemeChoice {
  const saved = (localStorage.getItem(KEY) as ThemeChoice | null) ?? 'system';
  applyTheme(saved);
  return saved;
}

export function useTheme(): [ThemeChoice, (c: ThemeChoice) => void] {
  const [choice, setChoice] = useState<ThemeChoice>(initTheme);
  useEffect(() => {
    applyTheme(choice);
    if (choice === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: light)');
      const onChange = () => applyTheme('system');
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    }
  }, [choice]);
  const set = (c: ThemeChoice) => {
    localStorage.setItem(KEY, c);
    setChoice(c);
  };
  return [choice, set];
}
