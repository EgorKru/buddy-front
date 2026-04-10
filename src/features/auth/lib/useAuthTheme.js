/**
 * Тема страниц входа/регистрации: dark | light, хранится в localStorage.
 */
import { useCallback, useEffect, useState } from 'react';

export const AUTH_THEME_STORAGE_KEY = 'pager-auth-theme';

/** @returns {'dark' | 'light'} */
function readStoredTheme() {
  if (typeof window === 'undefined') return 'dark';
  try {
    const v = localStorage.getItem(AUTH_THEME_STORAGE_KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {
    /* ignore */
  }
  return 'dark';
}

export function useAuthTheme() {
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    setTheme(readStoredTheme());
  }, []);

  const setThemePersist = useCallback((next) => {
    const v = next === 'light' ? 'light' : 'dark';
    setTheme(v);
    try {
      localStorage.setItem(AUTH_THEME_STORAGE_KEY, v);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setThemePersist(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setThemePersist]);

  return { theme, setTheme: setThemePersist, toggleTheme };
}
