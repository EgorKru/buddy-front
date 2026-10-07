import Link from 'next/link';
import { Menu, Settings, LogOut, ShieldCheck } from 'lucide-react';
import ds from '@/design-system/primitives.module.css';
import styles from './appShell.module.css';

/**
 * @param {{
 *   user: { displayName?: string, username?: string },
 *   onLogout: () => void,
 *   onMenuClick: () => void,
 *   children: import('react').ReactNode,
 * }} props
 */
export function AppShell({ user, onLogout, onMenuClick, children }) {
  const displayName = user?.displayName || user?.username || 'Пользователь';
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return (
    <div className={`${ds.surface} ${styles.shell}`}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.headerLeft}>
            <button
              type="button"
              className={styles.menuBtn}
              onClick={onMenuClick}
              aria-label="Открыть список чатов"
            >
              <Menu size={20} />
            </button>
            <Link href="/app" className={ds.logo}>
              <span className={ds.logoMark}>P</span>
              Pager
            </Link>
          </div>
          <div className={styles.headerRight}>
            <div className={styles.healthPill} title="Локальные сервисы доступны">
              <ShieldCheck size={15} aria-hidden />
              <span>Система готова</span>
            </div>
            <div className={styles.userBadge} title={displayName}>
              <span className={styles.userAvatar} aria-hidden>
                {initials || 'P'}
              </span>
              <span className={styles.greeting}>{displayName}</span>
            </div>
            <Link href="/settings" className={styles.iconLink} aria-label="Настройки">
              <Settings size={18} />
              <span className={styles.actionLabel}>Настройки</span>
            </Link>
            <button type="button" className={styles.iconLink} onClick={onLogout} aria-label="Выйти">
              <LogOut size={18} />
              <span className={styles.actionLabel}>Выйти</span>
            </button>
          </div>
        </div>
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
