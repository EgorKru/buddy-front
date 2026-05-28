import Link from 'next/link';
import ds from '@/design-system/primitives.module.css';
import styles from './public.module.css';

const NAV_ITEMS = [
  { href: '#use-cases-heading', label: 'Сценарии' },
  { href: '#features', label: 'Преимущества' },
  { href: '#testimonials', label: 'Отзывы' },
];

/**
 * @param {{
 *   variant?: 'marketing' | 'auth',
 *   authActionHref?: string,
 *   authActionLabel?: string,
 *   authMode?: 'login' | 'register',
 * }} props
 */
export function PublicHeader({
  variant = 'marketing',
  authActionHref = '/register',
  authActionLabel = 'Начать',
  authMode = 'login',
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
          <Link href="/login" className={authMode === 'login' ? ds.btnHeader : ds.btnGhost}>
            Войти
          </Link>
          <Link
            href={authActionHref}
            className={authMode === 'register' ? ds.btnHeader : ds.btnGhost}
          >
            {authActionLabel}
          </Link>
        </div>
      </div>
    </header>
  );
}
