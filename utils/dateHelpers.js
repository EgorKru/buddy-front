/**
 * Утилиты для форматирования дат и времени
 */

/**
 * Форматировать дату для отображения в чате
 * @param {string} dateString - ISO строка даты
 * @returns {string} Отформатированная дата
 */
export const formatChatDate = (dateString) => {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (messageDate.getTime() === today.getTime()) {
    return 'Сегодня';
  } else if (messageDate.getTime() === today.getTime() - 86400000) {
    return 'Вчера';
  } else {
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  }
};

/**
 * Форматировать время для отображения
 * @param {string} dateString - ISO строка даты
 * @returns {string} Отформатированное время (HH:MM)
 */
export const formatChatTime = (dateString) => {
  if (!dateString) return '';
  
  return new Date(dateString).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Форматировать время для списка чатов (относительное время)
 * @param {string} dateString - ISO строка даты
 * @returns {string} Отформатированное время
 */
export const formatChatListTime = (dateString) => {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  } else if (days === 1) {
    return 'Вчера';
  } else if (days < 7) {
    return `${days} дн. назад`;
  } else {
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
  }
};

/**
 * Форматировать время для таймера встречи (секунды в HH:MM:SS или MM:SS)
 * @param {number} seconds - Количество секунд
 * @returns {string} Отформатированное время
 */
export const formatMeetingTime = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

