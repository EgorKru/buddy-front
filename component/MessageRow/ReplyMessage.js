import { getReplyContentPreview } from './utils';
import styles from '@/styles/chat.module.css';

export default function ReplyMessage({ replyTo, onNavigate }) {
  return (
    <div 
      className={styles.messageReply}
      onClick={async (e) => {
        e.stopPropagation();
        onNavigate(replyTo.id);
      }}
    >
      <div className={styles.messageReplyContent}>
        <div className={styles.messageReplyAuthor}>
          {replyTo.senderDisplayName || replyTo.senderUsername}
        </div>
        <div className={styles.messageReplyText}>
          {getReplyContentPreview(replyTo)}
        </div>
      </div>
    </div>
  );
}

