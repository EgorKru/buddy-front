import Link from 'next/link';
import { Menu, Settings, LogOut } from 'lucide-react';
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
  const displayName = user?.displayName || user?.username || 'User';

  return (
    <div className={ds.surface}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.headerLeft}>
            <button
              type="button"
              className={styles.menuBtn}
              onClick={onMenuClick}
              aria-label="Open conversations"
            >
              <Menu size={20} />
            </button>
            <Link href="/app" className={ds.logo}>
              <span className={ds.logoMark}>P</span>
              Pager
            </Link>
          </div>
          <div className={styles.headerRight}>
            <span className={styles.greeting}>Hello, {displayName}</span>
            <Link href="/settings" className={styles.iconLink}>
              <Settings size={18} />
              Settings
            </Link>
            <button type="button" className={styles.iconLink} onClick={onLogout}>
              <LogOut size={18} />
              Log out
            </button>
          </div>
        </div>
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
