/**
 * Компонент «глаз» логотипа (Pager eyes). FSD: shared/ui
 * @param {'logo'|'loader'} variant — logo: в блоке логотипа, loader: для overlay-лоадера (крупнее)
 */
export function PagerEyes({ isClosed, pupilOffset, styles, variant = 'logo' }) {
  const transform = `translate(${pupilOffset.x}px, ${pupilOffset.y}px)`;
  const eyesRow = (
    <div className={`${styles.pagerEyesRow} ${isClosed ? styles.pagerEyesClosed : ''}`}>
      <div className={styles.pagerEye}>
        <div className={styles.pagerPupil} style={{ transform }} />
      </div>
      <div className={styles.pagerEye}>
        <div className={styles.pagerPupil} style={{ transform }} />
      </div>
    </div>
  );

  if (variant === 'loader') {
    return <div className={styles.loaderEyesContainer}>{eyesRow}</div>;
  }

  return <div className={styles.logoIconWrapper}>{eyesRow}</div>;
}
