import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { FEATURE_ROWS } from './landingContent';
import { ProductVisual } from './ProductVisual';
import ds from '@/design-system/primitives.module.css';
import styles from './landing.module.css';

export function FeatureRows() {
  return (
    <section id="features" className={styles.featureRowsSection} aria-labelledby="features-heading">
      <div className={styles.sectionInner}>
        <header className={styles.sectionHeaderCentered}>
          <p className={styles.sectionEyebrow}>Преимущества</p>
          <h2 id="features-heading" className={styles.sectionTitleLarge}>
            Почему команды остаются в Pager
          </h2>
        </header>

        <div className={styles.featureRowsList}>
          {FEATURE_ROWS.map((row) => (
            <article
              key={row.id}
              className={`${styles.featureRow} ${row.reverse ? styles.featureRowReverse : ''}`}
            >
              <div className={styles.featureRowCopy}>
                <p className={styles.featureRowEyebrow}>{row.eyebrow}</p>
                <h3 className={styles.featureRowTitle}>{row.title}</h3>
                <p className={styles.featureRowBody}>{row.body}</p>
                <ul className={styles.featureRowBullets}>
                  {row.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </div>
              <ProductVisual variant={row.visual} />
            </article>
          ))}
        </div>

        <p className={styles.featureRowsCta}>
          <Link href="/register" className={ds.btnCta}>
            Попробовать бесплатно
            <ArrowRight size={18} strokeWidth={2.25} aria-hidden />
          </Link>
        </p>
      </div>
    </section>
  );
}
