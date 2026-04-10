/**
 * Переключатель светлой/тёмной темы на auth-страницах.
 */
import { Moon, Sun } from 'lucide-react';
import styles from '@/styles/login.module.css';

/**
 * @param {{ theme: 'dark' | 'light', onToggle: () => void }} props
 */
export function AuthThemeToggle({ theme, onToggle }) {
  const isLight = theme === 'light';
  return (
    <button
      type="button"
      className={styles.authThemeToggle}
      onClick={onToggle}
      aria-label={isLight ? 'Включить тёмную тему' : 'Включить светлую тему'}
      title={isLight ? 'Тёмная тема' : 'Светлая тема'}
    >
      {isLight ? (
        <Moon size={20} strokeWidth={2} aria-hidden />
      ) : (
        <Sun size={20} strokeWidth={2} aria-hidden />
      )}
    </button>
  );
}
