import { useMessageTextPreview } from '@/hooks/useMessageTextPreview';
import styles from '@/styles/chat.module.css';

export default function ReplyMessage({ replyTo, onNavigate, chat, user }) {
  const preview = useMessageTextPreview(replyTo, chat, user);
  return (
    <div
      className={styles.messageReply}
      data-testid="message-reply-preview"
      onClick={async (e) => {
        e.stopPropagation();
        onNavigate(replyTo.id);
      }}
    >
      <div className={styles.messageReplyContent}>
        <div className={styles.messageReplyAuthor}>
          {replyTo.senderDisplayName || replyTo.senderUsername}
        </div>
        <div className={styles.messageReplyText}>{preview}</div>
      </div>
    </div>
  );
}
