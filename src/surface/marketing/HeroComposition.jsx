import { Shield, Phone } from 'lucide-react';
import styles from './landing.module.css';

/** Payman-style layered product planes — messaging surfaces, not fintech UI. */
export function HeroComposition() {
  return (
    <div className={styles.composition} aria-hidden>
      <div className={styles.compositionPattern} />

      <div className={styles.planeWarm}>
        <span className={styles.planeLabel}>Team channel</span>
        <div className={styles.channelList}>
          <div className={`${styles.channelRow} ${styles.channelRowActive}`}>
            <span className={styles.channelAvatar}>DS</span>
            <span className={styles.channelCopy}>
              <strong>Design sync</strong>
              <span>4 members · active now</span>
            </span>
          </div>
          <div className={styles.channelRow}>
            <span className={styles.channelAvatar}>RC</span>
            <span className={styles.channelCopy}>
              <strong>Release channel</strong>
              <span>Build passed on staging</span>
            </span>
          </div>
        </div>
      </div>

      <div className={styles.planeDeep}>
        <span className={styles.planeLabelLight}>Pager workspace</span>
        <div className={styles.thread}>
          <div className={styles.bubbleIn}>Can we lock the API contract before Friday?</div>
          <div className={styles.bubbleOut}>Yes — latest changes are on the branch.</div>
          <div className={styles.bubbleIn}>I will review the WebSocket payload tonight.</div>
          <div className={styles.typingLine}>Maya is typing…</div>
        </div>
      </div>

      <div className={styles.planeSide}>
        <span className={styles.sideIcon} aria-hidden>
          <Shield size={20} strokeWidth={2} />
        </span>
        <span className={styles.sideCopy}>
          <strong>Direct route</strong>
          <span>Encrypted · end-to-end</span>
        </span>
      </div>

      <div className={styles.planeCall}>
        <span className={styles.callIcon} aria-hidden>
          <Phone size={16} strokeWidth={2.25} />
        </span>
        <span className={styles.callCopy}>
          <strong>Voice room</strong>
          <span>Live · 2 participants</span>
        </span>
      </div>
    </div>
  );
}
