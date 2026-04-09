/**
 * Индикатор загрузки. FSD: shared/ui
 */
import styles from './Loader.module.css';

/**
 * @param {boolean} [fullPage] — на весь экран (min-height: 100vh)
 * @param {string} [text] — подпись под спиннером
 */
export function Loader({ fullPage = false, text }) {
  const rootClass = fullPage ? styles.fullPageLoader : styles.loader;
  return (
    <div className={rootClass}>
      <div className={styles.spinner} aria-hidden />
      {text && <span>{text}</span>}
    </div>
  );
}
