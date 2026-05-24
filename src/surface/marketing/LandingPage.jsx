import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import ds from '@/design-system/primitives.module.css';
import { PublicHeader } from '@/surface/shared';
import styles from './landing.module.css';
import { HeroComposition } from './HeroComposition';

const TRUST_ITEMS = [
  'Безопасные сообщения',
  'Шифрование в личке',
  'Голосовые комнаты',
  'Контекст сохраняется',
];

const PILLARS = [
  {
    title: 'Личные переписки остаются приватными',
    body: 'Текст в диалогах 1:1 шифруется на клиенте. Сервер видит только шифротекст.',
  },
  {
    title: 'Командные каналы синхронны',
    body: 'Доставка в реальном времени, индикатор набора и синхронизация после reconnect.',
  },
  {
    title: 'Звонки без выхода из треда',
    body: 'Откройте голосовую комнату из переписки и вернитесь в тот же контекст.',
  },
];

export function LandingPage() {
  return (
    <div className={ds.surface}>
      <PublicHeader />

      <main>
        <section className={styles.hero} aria-labelledby="landing-headline">
          <h1 id="landing-headline" className={styles.headline}>
            Безопасные сообщения и звонки
            <span className={styles.headlineBreak}> для сфокусированных команд</span>
          </h1>
          <p className={styles.subheadline}>
            Общайтесь в реальном времени, переподключайтесь без потери контекста и сохраняйте
            приватность личных диалогов.
          </p>
          <Link href="/register" className={ds.btnCta}>
            Начать
            <ArrowRight size={18} strokeWidth={2.25} aria-hidden />
          </Link>
        </section>

        <section id="product" className={styles.showcase} aria-label="Превью продукта">
          <div className={styles.trustStrip}>
            <p className={styles.trustLabel}>Один workspace для сфокусированного общения</p>
            <ul className={styles.trustList}>
              {TRUST_ITEMS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <HeroComposition />
        </section>

        <section id="security" className={styles.narrative}>
          <div className={ds.container}>
            <div className={styles.narrativeIntro}>
              <p className={styles.eyebrow}>Безопасность</p>
              <h2 className={styles.sectionTitle}>Приватность и непрерывность по умолчанию</h2>
              <p className={styles.sectionLead}>
                Pager структурирует общение: приватные direct-маршруты, надёжная доставка и
                восстановление, которое сохраняет тред, а не сбрасывает его.
              </p>
            </div>
            <ul className={styles.pillarList}>
              {PILLARS.map((pillar) => (
                <li key={pillar.title} className={styles.pillarItem}>
                  <h3>{pillar.title}</h3>
                  <p>{pillar.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="documentation" className={styles.docsBand}>
          <div className={styles.docsInner}>
            <h2 className={styles.docsTitle}>Откройте workspace команды</h2>
            <p className={styles.docsLead}>
              Сообщения, приватные direct-маршруты и голос — в одном спокойном интерфейсе.
            </p>
            <Link href="/register" className={ds.btnCta}>
              Начать
              <ArrowRight size={18} strokeWidth={2.25} aria-hidden />
            </Link>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={ds.container}>
          <div className={styles.footerRow}>
            <span className={styles.footerBrand}>Pager</span>
            <nav className={styles.footerNav} aria-label="Подвал">
              <Link href="/login">Войти</Link>
              <Link href="/register">Начать</Link>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}
