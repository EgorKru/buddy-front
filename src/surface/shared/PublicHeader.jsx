import Link from 'next/link';
import ds from '@/design-system/primitives.module.css';
import styles from './public.module.css';

const NAV_ITEMS = [
  { href: '#product', label: 'Продукт' },
  { href: '#security', label: 'Безопасность' },
  { href: '#documentation', label: 'Документация' },
];

/**
 * @param {{ variant?: 'marketing' | 'auth', authActionHref?: string, authActionLabel?: string }} props
 */
export function PublicHeader({
  variant = 'marketing',
  authActionHref = '/register',
  authActionLabel = 'Начать',
}) {
  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <Link href="/" className={ds.logo}>
          <span className={ds.logoMark}>P</span>
          Pager
        </Link>

        {variant === 'marketing' ? (
          <nav className={styles.headerNav} aria-label="Основная навигация">
            {NAV_ITEMS.map((item) => (
              <a key={item.href} href={item.href}>
                {item.label}
              </a>
            ))}
          </nav>
        ) : (
          <div className={styles.headerSpacer} aria-hidden />
        )}

        <div className={styles.headerActions}>
          <Link href="/login" className={ds.btnGhost}>
            Войти
          </Link>
          <Link href={authActionHref} className={ds.btnHeader}>
            {authActionLabel}
          </Link>
        </div>
      </div>
    </header>
  );
}
