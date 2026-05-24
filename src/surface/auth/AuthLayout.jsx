import ds from '@/design-system/primitives.module.css';
import { PublicHeader } from '@/surface/shared';
import styles from './auth.module.css';

const BRAND_POINTS = [
  'Приватные direct-маршруты с шифрованием на клиенте',
  'Один тред для командных каналов и голоса',
  'Синхронизация после reconnect сохраняет контекст',
];

/**
 * @param {{
 *   mode: 'login' | 'register',
 *   title: string,
 *   subtitle: string,
 *   children: import('react').ReactNode,
 * }} props
 */
export function AuthLayout({ mode, title, subtitle, children }) {
  const alternateHref = mode === 'login' ? '/register' : '/login';
  const alternateLabel = mode === 'login' ? 'Начать' : 'Войти';

  return (
    <div className={ds.surface}>
      <PublicHeader
        variant="auth"
        authActionHref={alternateHref}
        authActionLabel={alternateLabel}
      />

      <div className={styles.shell}>
        <aside className={styles.brandAside} aria-label="О продукте Pager">
          <p className={styles.brandEyebrow}>Workspace Pager</p>
          <h2 className={styles.brandTitle}>Общение для фокуса, приватности и непрерывности</h2>
          <ul className={styles.brandList}>
            {BRAND_POINTS.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </aside>

        <main className={styles.formArea}>
          <div className={styles.card}>
            <div className={styles.cardIntro}>
              <h1>{title}</h1>
              <p>{subtitle}</p>
            </div>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
