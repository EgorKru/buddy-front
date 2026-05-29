import { useEffect, useMemo, useRef } from 'react';
import { QUICK_REACTIONS, isCustomEmojiKey } from '@/src/shared/lib/emoji/standardEmojis';
import { getApiUrl } from '@/src/shared/config';
import styles from './ReactionBar.module.css';

function resolveMediaUrl(url) {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  const clean = url.startsWith('/') ? url.slice(1) : url;
  return getApiUrl(`/chats/files/${clean}`);
}

export default function ReactionBar({
  position,
  message,
  customEmojisByKey,
  activeReactions,
  onToggle,
  onClose,
}) {
  const barRef = useRef(null);

  useEffect(() => {
    const handleOutside = (e) => {
      if (barRef.current && !barRef.current.contains(e.target)) {
        onClose?.();
      }
    };
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const style = useMemo(() => {
    if (!position) return {};
    return {
      left: Math.max(8, position.x - 120),
      top: Math.max(8, position.y - 52),
    };
  }, [position]);

  if (!position || !message) return null;

  const isActive = (emoji) => activeReactions?.some((r) => r.emoji === emoji && r.reactedByMe);

  return (
    <div
      ref={barRef}
      className={styles.bar}
      style={style}
      data-testid="message-reaction-bar"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {QUICK_REACTIONS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          className={`${styles.btn} ${isActive(emoji) ? styles.btnActive : ''}`}
          data-testid="reaction-bar-emoji"
          onClick={() => onToggle?.(message, emoji)}
        >
          {emoji}
        </button>
      ))}
      {Object.entries(customEmojisByKey || {})
        .slice(0, 4)
        .map(([key, ce]) => (
          <button
            key={key}
            type="button"
            className={`${styles.btn} ${isActive(key) ? styles.btnActive : ''}`}
            data-testid="reaction-bar-custom"
            onClick={() => onToggle?.(message, key)}
          >
            <img src={resolveMediaUrl(ce.fileUrl)} alt="" className={styles.customImg} />
          </button>
        ))}
    </div>
  );
}

export { isCustomEmojiKey };
