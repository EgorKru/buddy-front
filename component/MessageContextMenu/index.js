import { useEffect, useRef, useMemo } from 'react';
import { adjustMenuPosition, getMenuItems } from './utils';
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
}) {
  const menuRef = useRef(null);

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

  if (!position) return null;

  return (
    <div ref={menuRef} className={styles.contextMenu} style={{ left: position.x, top: position.y }}>
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
}
