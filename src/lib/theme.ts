const THEME_KEY = 'dc-theme';

export type Theme = 'dark' | 'light';

export function getTheme(): Theme {
  return (localStorage.getItem(THEME_KEY) as Theme) ?? 'dark';
}

export function setTheme(theme: Theme): void {
  localStorage.setItem(THEME_KEY, theme);
  if (theme === 'light') {
    document.documentElement.dataset.theme = 'light';
  } else {
    delete document.documentElement.dataset.theme;
  }
}

export function toggleTheme(): Theme {
  const next: Theme = getTheme() === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}
