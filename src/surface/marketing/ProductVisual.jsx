import styles from './landing.module.css';

/**
 * Абстрактная визуализация продукта (без fake UI mockup).
 * @param {{ variant: 'team' | 'private' | 'voice' | 'focus' | 'secure' | 'reliable' }} props
 */
export function ProductVisual({ variant }) {
  return (
    <div
      className={`${styles.productVisual} ${styles[`productVisual${variant.charAt(0).toUpperCase()}${variant.slice(1)}`]}`}
      aria-hidden
    >
      {variant === 'team' && (
        <>
          <div className={styles.visualChannel}>
            <span className={styles.visualChannelName}># продукт</span>
            <div className={styles.visualLine} style={{ width: '72%' }} />
            <div className={styles.visualLine} style={{ width: '48%' }} />
            <div className={styles.visualLineAccent} style={{ width: '64%' }} />
          </div>
          <div className={styles.visualChannel}>
            <span className={styles.visualChannelName}># релиз</span>
            <div className={styles.visualLine} style={{ width: '56%' }} />
          </div>
        </>
      )}
      {variant === 'private' && (
        <div className={styles.visualSecure}>
          <span className={styles.visualSecureBadge}>Защищённый диалог</span>
          <div className={styles.visualLine} style={{ width: '80%' }} />
          <div className={styles.visualLine} style={{ width: '52%', alignSelf: 'flex-end' }} />
          <p className={styles.visualSecureHint}>Только на ваших устройствах</p>
        </div>
      )}
      {variant === 'voice' && (
        <div className={styles.visualVoice}>
          <span className={styles.visualVoiceStatus}>Голосовая комната · 8 участников</span>
          <div className={styles.visualVoiceBars}>
            {[40, 65, 30, 80, 50, 70, 35].map((h, i) => (
              <span key={i} className={styles.visualVoiceBar} style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>
      )}
      {variant === 'focus' && (
        <div className={styles.visualStack}>
          <span className={styles.visualStackItem}>Чат</span>
          <span className={styles.visualStackItem}>Файл</span>
          <span className={styles.visualStackItemActive}>Звонок</span>
        </div>
      )}
      {variant === 'secure' && (
        <div className={styles.visualLock}>
          <span className={styles.visualLockIcon} />
          <span>Личный диалог</span>
        </div>
      )}
      {variant === 'reliable' && (
        <div className={styles.visualReconnect}>
          <span className={styles.visualReconnectDot} />
          <span>Связь восстановлена</span>
          <div className={styles.visualLine} style={{ width: '90%', marginTop: 16 }} />
          <div className={styles.visualLine} style={{ width: '70%' }} />
        </div>
      )}
    </div>
  );
}
