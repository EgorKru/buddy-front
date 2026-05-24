import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import ds from '@/design-system/primitives.module.css';
import { PublicHeader } from '@/surface/shared';
import styles from './landing.module.css';
import { TRUST_LINE, HERO_STATS } from './landingContent';
import { UseCaseTabs } from './UseCaseTabs';
import { TrustMetrics } from './TrustMetrics';
import { FeatureRows } from './FeatureRows';
import { Testimonials } from './Testimonials';

export function LandingPage() {
  return (
    <div className={ds.surface}>
      <PublicHeader />

      <main>
        <section className={styles.hero} aria-labelledby="landing-headline">
          <div className={styles.heroInner}>
            <h1 id="landing-headline" className={styles.headline}>
              Общение команды, которое не разваливается на три сервиса
            </h1>
            <p className={styles.subheadline}>
              Pager объединяет групповые чаты, защищённые личные диалоги и голосовые созвоны.
              Сообщения приходят сразу, личное остаётся приватным, а после обрыва связи история на
              месте.
            </p>
            <div className={styles.heroActions}>
              <Link href="/register" className={ds.btnCta}>
                Начать бесплатно
                <ArrowRight size={18} strokeWidth={2.25} aria-hidden />
              </Link>
              <a href="#use-cases-heading" className={styles.heroSecondary}>
                Смотреть, как это работает
              </a>
            </div>
            <p className={styles.heroFinePrint}>Регистрация по email · без карты на старте</p>
          </div>

          <div className={styles.heroTrust}>
            <p className={styles.heroTrustLine}>{TRUST_LINE}</p>
            <ul className={styles.heroStats} aria-label="Кратко о возможностях">
              {HERO_STATS.map((stat) => (
                <li key={stat.label}>
                  <strong>{stat.value}</strong>
                  <span>{stat.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <UseCaseTabs />
        <TrustMetrics />
        <FeatureRows />
        <Testimonials />

        <section className={styles.finalCta} aria-labelledby="final-cta-heading">
          <div className={styles.finalCtaInner}>
            <h2 id="final-cta-heading" className={styles.finalCtaTitle}>
              Соберите команду в Pager за несколько минут
            </h2>
            <p className={styles.finalCtaLead}>
              Создайте аккаунт, пригласите коллег в чат или комнату — и перестаньте терять контекст
              между мессенджером и созвоном.
            </p>
            <Link href="/register" className={`${ds.btnCta} ${styles.finalCtaBtn}`}>
              Создать workspace
              <ArrowRight size={18} strokeWidth={2.25} aria-hidden />
            </Link>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={ds.container}>
          <div className={styles.footerRow}>
            <div className={styles.footerBrandBlock}>
              <span className={styles.footerBrand}>Pager</span>
              <p className={styles.footerTagline}>Сообщения, приватность и голос для команд</p>
            </div>
            <nav className={styles.footerNav} aria-label="Подвал">
              <a href="#use-cases-heading">Возможности</a>
              <a href="#features">Преимущества</a>
              <a href="#testimonials">Отзывы</a>
              <Link href="/login">Войти</Link>
              <Link href="/register">Начать</Link>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}
