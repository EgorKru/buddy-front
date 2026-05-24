import { TRUST_METRICS } from './landingContent';
import styles from './landing.module.css';

export function TrustMetrics() {
  return (
    <section className={styles.trustMetricsSection} aria-label="Почему команды выбирают Pager">
      <div className={styles.sectionInner}>
        <div className={styles.trustMetricsGrid}>
          {TRUST_METRICS.map((metric) => (
            <article key={metric.label} className={styles.trustMetricCard}>
              <p className={styles.trustMetricValue}>{metric.value}</p>
              <p className={styles.trustMetricLabel}>{metric.label}</p>
              <p className={styles.trustMetricDetail}>{metric.detail}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
