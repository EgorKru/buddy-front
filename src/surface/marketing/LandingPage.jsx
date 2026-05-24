import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import ds from '@/design-system/primitives.module.css';
import styles from './landing.module.css';
import { HeroComposition } from './HeroComposition';

const TRUST_ITEMS = ['WebSocket delivery', 'Encrypted direct', 'Voice rooms', 'Session sync'];

export function LandingPage() {
  return (
    <div className={ds.surface}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/" className={ds.logo}>
            <span className={ds.logoMark}>P</span>
            Pager
          </Link>

          <nav className={styles.headerNav} aria-label="Primary">
            <a href="#product">Product</a>
            <a href="#security">Security</a>
            <a href="#documentation">Documentation</a>
          </nav>

          <div className={styles.headerActions}>
            <Link href="/login" className={ds.btnGhost}>
              Log in
            </Link>
            <Link href="/register" className={ds.btnHeader}>
              Get started
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className={styles.hero} aria-labelledby="landing-headline">
          <div className={styles.heroInner}>
            <h1 id="landing-headline" className={styles.headline}>
              Secure messaging and calls for focused teams
            </h1>
            <p className={styles.subheadline}>
              Chat in real time, reconnect without losing context, and keep direct conversations
              private.
            </p>
            <Link href="/register" className={`${ds.btnCta} ${styles.heroCta}`}>
              Get started
              <ArrowRight size={18} strokeWidth={2.25} aria-hidden />
            </Link>
          </div>
        </section>

        <section id="product" className={styles.showcase} aria-label="Product preview">
          <div className={styles.trustStrip}>
            <p className={styles.trustLabel}>Built for focused teams</p>
            <ul className={styles.trustList}>
              {TRUST_ITEMS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <HeroComposition />
        </section>

        <section id="security" className={styles.narrative}>
          <div className={styles.container}>
            <div className={styles.narrativeIntro}>
              <p className={styles.eyebrow}>Security</p>
              <h2 className={styles.sectionTitle}>
                Private channels, reliable delivery, clear recovery
              </h2>
              <p className={styles.sectionLead}>
                Direct conversations stay encrypted on the client. Team channels use structured
                auth, refresh rotation, and reconnect sync so context is never lost after a drop.
              </p>
            </div>
            <div className={styles.narrativeGrid}>
              <article className={styles.narrativeCard}>
                <h3>Encrypted direct</h3>
                <p>Client-side encryption for 1:1 text. Server stores ciphertext only.</p>
              </article>
              <article className={styles.narrativeCard}>
                <h3>Session continuity</h3>
                <p>JWT API with refresh token rotation and clean sign-out.</p>
              </article>
              <article className={styles.narrativeCard}>
                <h3>Cluster-ready realtime</h3>
                <p>Redis STOMP relay and presence across instances.</p>
              </article>
            </div>
          </div>
        </section>

        <section id="documentation" className={styles.docsBand}>
          <div className={styles.container}>
            <h2 className={styles.docsTitle}>Ready to open your workspace?</h2>
            <p className={styles.docsLead}>
              Create an account and start messaging your team in minutes.
            </p>
            <Link href="/register" className={ds.btnCta}>
              Get started
              <ArrowRight size={18} strokeWidth={2.25} aria-hidden />
            </Link>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <span className={styles.footerBrand}>Pager</span>
          <nav className={styles.footerNav} aria-label="Footer">
            <Link href="/login">Log in</Link>
            <Link href="/register">Get started</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
