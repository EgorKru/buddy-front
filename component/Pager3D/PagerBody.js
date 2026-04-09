import styles from '@/component/Pager3D/index.module.css';

export default function PagerBody() {
  return (
    <div className={styles.pagerBody}>
      <div className={styles.screen}>
        <div className={styles.screenContent}>
          <div className={styles.screenLine}>PAGER</div>
          <div className={styles.screenLine}>READY</div>
        </div>
      </div>

      <div className={styles.buttons}>
        <div className={styles.button}></div>
        <div className={styles.button}></div>
        <div className={styles.button}></div>
      </div>

      <div className={styles.antenna}>
        <div className={styles.antennaBase}></div>
        <div className={styles.antennaTop}></div>
      </div>

      <div className={styles.led}></div>
    </div>
  );
}
