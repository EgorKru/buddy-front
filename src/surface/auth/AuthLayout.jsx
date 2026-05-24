import Link from 'next/link';
import ds from '@/design-system/primitives.module.css';
import styles from './auth.module.css';

/**
 * @param {{ title: string, subtitle: string, children: import('react').ReactNode }} props
 */
export function AuthLayout({ title, subtitle, children }) {
  return (
    <div className={ds.surface}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/" className={ds.logo}>
            <span className={ds.logoMark}>P</span>
            Pager
          </Link>
          <div className={styles.headerActions}>
            <Link href="/" className={ds.btnGhost}>
              Home
            </Link>
            <Link href="/register" className={ds.btnHeader}>
              Get started
            </Link>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.card}>
          <div className={styles.cardIntro}>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
