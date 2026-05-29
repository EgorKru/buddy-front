import { useEffect, useRef, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { adjustMenuPosition, getMenuItems } from './utils';
import ReactionPickerRow from './ReactionPickerRow';
import styles from './index.module.css';

export default function MessageContextMenu({
  message,
  position,
  isOwn,
  isPinned = false,
  isSearchResult = false,
  onClose,
  onReply,
  onPin,
  onCopy,
  onForward,
  onDelete,
  onEdit,
  onSelect,
  onNavigate,
  onToggleReaction,
  customEmojisByKey,
}) {
  const menuRef = useRef(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('contextmenu', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('contextmenu', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  useEffect(() => {
    if (menuRef.current && position) {
      const adjustedPosition = adjustMenuPosition(menuRef.current, position);
      if (adjustedPosition) {
        menuRef.current.style.left = `${adjustedPosition.x}px`;
        menuRef.current.style.top = `${adjustedPosition.y}px`;
      }
    }
  }, [position]);

  const menuItems = useMemo(() => {
    const items = getMenuItems(
      message,
      isOwn,
      isPinned,
      {
        onReply,
        onPin,
        onCopy,
        onForward,
        onEdit,
        onDelete,
        onSelect,
        onNavigate,
      },
      isSearchResult
    );
    return items;
  }, [
    message,
    isOwn,
    isPinned,
    isSearchResult,
    onReply,
    onPin,
    onCopy,
    onForward,
    onEdit,
    onDelete,
    onSelect,
    onNavigate,
  ]);

  if (!position || !mounted) return null;

  const menu = (
    <div
      ref={menuRef}
      className={styles.contextMenu}
      style={{ left: position.x, top: position.y }}
      data-testid="message-context-menu"
      onContextMenu={(e) => e.preventDefault()}
    >
      <ReactionPickerRow
        message={message}
        activeReactions={message?.reactions || []}
        customEmojisByKey={customEmojisByKey}
        onToggleReaction={onToggleReaction}
      />
      {menuItems.map((item, index) => {
        const Icon = item.icon;
        return (
          <button
            key={index}
            className={styles.menuItem}
            data-testid={item.label === 'Ответить' ? 'chat-context-menu-reply' : undefined}
            onClick={(e) => {
              e.stopPropagation();
              item.onClick?.();
              onClose();
            }}
          >
            <Icon size={18} className={styles.menuIcon} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );

  return createPortal(menu, document.body);
}
