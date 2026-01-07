import { getForwardedContentPreview } from './utils';
import styles from '@/styles/chat.module.css';

export default function ForwardedMessage({ forwardedFrom, senderId }) {
  return (
    <div className={styles.messageForwarded}>
      <div className={styles.messageForwardedHeader}>
        <span className={styles.messageForwardedIcon}>↪</span>
        <span className={styles.messageForwardedText}>
          Переслано от {forwardedFrom.originalSenderDisplayName || forwardedFrom.originalSenderUsername}
          {forwardedFrom.forwardedByUserId !== senderId && (
            <span> • Переслал {forwardedFrom.forwardedByDisplayName || forwardedFrom.forwardedByUsername}</span>
          )}
        </span>
      </div>
      <div className={styles.messageForwardedContent}>
        {getForwardedContentPreview(forwardedFrom.originalType, forwardedFrom.originalContent)}
      </div>
    </div>
  );
}

