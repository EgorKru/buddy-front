import { QUICK_REACTIONS } from '@/src/shared/lib/emoji/standardEmojis';
import { resolveMediaUrl } from '@/src/shared/lib/media/resolveMediaUrl';
import styles from './index.module.css';

export default function ReactionPickerRow({
  message,
  activeReactions = [],
  customEmojisByKey = {},
  onToggleReaction,
}) {
  if (!message) return null;

  const isActive = (emoji) => activeReactions.some((r) => r.emoji === emoji && r.reactedByMe);

  const customEntries = Object.entries(customEmojisByKey).slice(0, 4);

  return (
    <div className={styles.reactionsRow} data-testid="message-context-menu-reactions">
      {QUICK_REACTIONS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          className={`${styles.reactionBtn} ${isActive(emoji) ? styles.reactionBtnActive : ''}`}
          data-testid="reaction-bar-emoji"
          title={`Реакция ${emoji}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleReaction?.(message, emoji);
          }}
        >
          {emoji}
        </button>
      ))}
      {customEntries.map(([key, ce]) => (
        <button
          key={key}
          type="button"
          className={`${styles.reactionBtn} ${isActive(key) ? styles.reactionBtnActive : ''}`}
          data-testid="reaction-bar-custom"
          title={ce.altText || 'Кастомная реакция'}
          onClick={(e) => {
            e.stopPropagation();
            onToggleReaction?.(message, key);
          }}
        >
          <img src={resolveMediaUrl(ce.fileUrl)} alt="" className={styles.reactionCustomImg} />
        </button>
      ))}
    </div>
  );
}
