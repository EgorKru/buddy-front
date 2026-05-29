import { isCustomEmojiKey } from '@/src/shared/lib/emoji/standardEmojis';
import { resolveMediaUrl } from '@/src/shared/lib/media/resolveMediaUrl';
import styles from './MessageReactionsList.module.css';

export default function MessageReactionsList({ reactions, customEmojisByKey, onToggle }) {
  if (!reactions?.length) return null;

  return (
    <div className={styles.list} data-testid="message-reactions-list">
      {reactions.map((r) => {
        const isCustom = isCustomEmojiKey(r.emoji);
        const custom = isCustom ? customEmojisByKey?.[r.emoji] : null;
        return (
          <button
            key={r.emoji}
            type="button"
            className={`${styles.chip} ${r.reactedByMe ? styles.chipActive : ''}`}
            data-testid="message-reaction-chip"
            onClick={(e) => {
              e.stopPropagation();
              onToggle?.(r.emoji);
            }}
          >
            {isCustom && custom ? (
              <img src={resolveMediaUrl(custom.fileUrl)} alt="" className={styles.customImg} />
            ) : (
              <span>{r.emoji}</span>
            )}
            <span className={styles.count}>{r.count}</span>
          </button>
        );
      })}
    </div>
  );
}
