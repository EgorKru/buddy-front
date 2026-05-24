import { TESTIMONIALS } from './landingContent';
import styles from './landing.module.css';

export function Testimonials() {
  return (
    <section
      id="testimonials"
      className={styles.testimonialsSection}
      aria-labelledby="testimonials-heading"
    >
      <div className={styles.sectionInner}>
        <header className={styles.sectionHeaderCentered}>
          <p className={styles.sectionEyebrow}>Отзывы</p>
          <h2 id="testimonials-heading" className={styles.sectionTitleLarge}>
            Как это ощущается в работе
          </h2>
        </header>

        <div className={styles.testimonialsGrid}>
          {TESTIMONIALS.map((item) => (
            <blockquote key={item.name} className={styles.testimonialCard}>
              <p className={styles.testimonialQuote}>«{item.quote}»</p>
              <footer>
                <cite className={styles.testimonialName}>{item.name}</cite>
                <span className={styles.testimonialRole}>{item.role}</span>
              </footer>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  );
}
