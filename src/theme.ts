// The color theme: the learner's choice on this device, applied to the page.
import { getItem, setItem } from './core/storage';

export type Theme = 'system' | 'light' | 'dark';
const THEME_KEY = 'cs231n.theme';

export function savedTheme(): Theme {
  const t = getItem(THEME_KEY);
  return t === 'light' || t === 'dark' ? t : 'system';
}

export function applyTheme(t: Theme = savedTheme()): void {
  if (t === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
}

export function setTheme(t: Theme): void {
  setItem(THEME_KEY, t === 'system' ? null : t);
  applyTheme(t);
}
