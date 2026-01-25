import { Reply, Pin, PinOff, Copy, Forward, Trash2, CheckCircle2, Edit, ArrowRight } from 'lucide-react';

export const adjustMenuPosition = (menuElement, position) => {
  if (!menuElement || !position) return null;

  const rect = menuElement.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const margin = 10;

  let { x, y } = position;

  if (x + rect.width > viewportWidth) {
    x = viewportWidth - rect.width - margin;
  }

  if (y + rect.height > viewportHeight) {
    y = viewportHeight - rect.height - margin;
  }

  if (x < margin) {
    x = margin;
  }

  if (y < margin) {
    y = margin;
  }

  return { x, y };
};

export const getMenuItems = (message, isOwn, isPinned, handlers, isSearchResult = false) => {
  const {
    onReply,
    onPin,
    onCopy,
    onForward,
    onEdit,
    onDelete,
    onSelect,
    onNavigate
  } = handlers;

  const items = [
    { icon: Reply, label: 'Ответить', onClick: onReply, show: true },
    { 
      icon: isPinned ? PinOff : Pin, 
      label: isPinned ? 'Открепить' : 'Закрепить', 
      onClick: onPin, 
      show: true 
    },
    { 
      icon: Copy, 
      label: 'Копировать текст', 
      onClick: onCopy, 
      show: message.type === 'TEXT' 
    },
    { icon: Forward, label: 'Переслать', onClick: onForward, show: true },
    { 
      icon: Edit, 
      label: 'Редактировать', 
      onClick: onEdit, 
      show: isOwn && message.type === 'TEXT' && !message.isOptimistic 
    },
    { 
      icon: Trash2, 
      label: 'Удалить', 
      onClick: onDelete, 
      show: !message.isOptimistic 
    },
    { icon: CheckCircle2, label: 'Выделить', onClick: onSelect, show: true },
    // Показываем кнопку "Перейти к сообщению" только для найденных сообщений
    {
      icon: ArrowRight,
      label: 'Перейти к сообщению',
      onClick: onNavigate || (() => {}),
      show: isSearchResult && !!onNavigate
    },
  ];

  const filteredItems = items.filter(item => item.show);
  
  return filteredItems;
};
