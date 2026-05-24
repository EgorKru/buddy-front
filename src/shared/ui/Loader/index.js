import styles from './Loader.module.css';

/**
 * @param {boolean} [fullPage]
 * @param {string} [text]
 */
export function Loader({ fullPage = false, text }) {
  const rootClass = fullPage ? styles.fullPageLoader : styles.loader;
  return (
    <div className={rootClass}>
      <div className={styles.spinner} aria-hidden />
      {text ? <span>{text}</span> : null}
    </div>
  );
}
