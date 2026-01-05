import { useEffect, useRef } from 'react';
import { Reply, Pin, Copy, Forward, Trash2, CheckCircle2, Edit } from 'lucide-react';
import styles from './index.module.css';

export default function MessageContextMenu({ 
  message, 
  position, 
  isOwn, 
  onClose, 
  onReply, 
  onPin, 
  onCopy, 
  onForward, 
  onDelete, 
  onEdit,
  onSelect 
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
      const menu = menuRef.current;
      const rect = menu.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let { x, y } = position;

      // Проверяем, не выходит ли меню за правый край
      if (x + rect.width > viewportWidth) {
        x = viewportWidth - rect.width - 10;
      }

      // Проверяем, не выходит ли меню за нижний край
      if (y + rect.height > viewportHeight) {
        y = viewportHeight - rect.height - 10;
      }

      // Проверяем, не выходит ли меню за левый край
      if (x < 10) {
        x = 10;
      }

      // Проверяем, не выходит ли меню за верхний край
      if (y < 10) {
        y = 10;
      }

      menu.style.left = `${x}px`;
      menu.style.top = `${y}px`;
    }
  }, [position]);

  if (!position) return null;

  const menuItems = [
    { icon: Reply, label: 'Ответить', onClick: onReply, show: true },
    { icon: Pin, label: 'Закрепить', onClick: onPin, show: true },
    { icon: Copy, label: 'Копировать текст', onClick: onCopy, show: message.type === 'TEXT' },
    { icon: Forward, label: 'Переслать', onClick: onForward, show: true },
    { icon: Edit, label: 'Редактировать', onClick: onEdit, show: isOwn && message.type === 'TEXT' && !message.isOptimistic },
    { icon: Trash2, label: 'Удалить', onClick: onDelete, show: isOwn && !message.isOptimistic },
    { icon: CheckCircle2, label: 'Выделить', onClick: onSelect, show: true },
  ].filter(item => item.show);

  return (
    <div ref={menuRef} className={styles.contextMenu} style={{ left: position.x, top: position.y }}>
      {menuItems.map((item, index) => {
        const Icon = item.icon;
        return (
          <button
            key={index}
            className={styles.menuItem}
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

