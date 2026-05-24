import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import ds from '@/design-system/primitives.module.css';
import styles from './landing.module.css';
import { HeroComposition } from './HeroComposition';

const TRUST_ITEMS = ['Secure messaging', 'Encrypted direct', 'Voice rooms', 'Context that stays'];

const PILLARS = [
  {
    title: 'Direct conversations stay private',
    body: '1:1 text is encrypted on the client. The server never sees plaintext.',
  },
  {
    title: 'Team channels stay in sync',
    body: 'Real-time delivery, typing, and reconnect sync keep one shared timeline.',
  },
  {
    title: 'Calls without leaving the thread',
    body: 'Open a voice room from the conversation and return to the same context.',
  },
];

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
          <h1 id="landing-headline" className={styles.headline}>
            Secure messaging and calls
            <span className={styles.headlineBreak}>for focused teams</span>
          </h1>
          <p className={styles.subheadline}>
            Chat in real time, reconnect without losing context, and keep direct conversations
            private.
          </p>
          <Link href="/register" className={ds.btnCta}>
            Get started
            <ArrowRight size={18} strokeWidth={2.25} aria-hidden />
          </Link>
        </section>

        <section id="product" className={styles.showcase} aria-label="Product preview">
          <div className={styles.trustStrip}>
            <p className={styles.trustLabel}>One workspace for focused communication</p>
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
              <p className={styles.eyebrow}>Security</p>
              <h2 className={styles.sectionTitle}>
                Communication that respects privacy and continuity
              </h2>
              <p className={styles.sectionLead}>
                Pager is built for teams that need clarity without noise — private direct routes,
                reliable delivery, and recovery that preserves the thread instead of resetting it.
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
            <h2 className={styles.docsTitle}>Open your team workspace</h2>
            <p className={styles.docsLead}>
              Start with messaging, direct privacy, and voice — in one calm surface.
            </p>
            <Link href="/register" className={ds.btnCta}>
              Get started
              <ArrowRight size={18} strokeWidth={2.25} aria-hidden />
            </Link>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={ds.container}>
          <div className={styles.footerRow}>
            <span className={styles.footerBrand}>Pager</span>
            <nav className={styles.footerNav} aria-label="Footer">
              <Link href="/login">Log in</Link>
              <Link href="/register">Get started</Link>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}
