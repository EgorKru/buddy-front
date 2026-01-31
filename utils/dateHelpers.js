const MS_PER_DAY = 86400000;

const parseServerDate = (dateString) => {
  if (!dateString) return null;
  let str = String(dateString);
  // Если дата без timezone, добавляем Z (UTC)
  if (!str.endsWith('Z') && !str.includes('+') && !str.includes('-', 10)) {
    str = str + 'Z';
  }
  return new Date(str);
};

export const formatChatDate = (dateString) => {
  if (!dateString) return '';

  const date = parseServerDate(dateString);
  if (!date || isNaN(date.getTime())) return '';
  
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (messageDate.getTime() === today.getTime()) {
    return 'Сегодня';
  } else if (messageDate.getTime() === today.getTime() - MS_PER_DAY) {
    return 'Вчера';
  } else {
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  }
};

export const formatChatTime = (dateString) => {
  if (!dateString) return '';

  const date = parseServerDate(dateString);
  if (!date || isNaN(date.getTime())) return '';
  
  return date.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatChatListTime = (dateString) => {
  if (!dateString) return '';

  const date = parseServerDate(dateString);
  if (!date || isNaN(date.getTime())) return '';
  
  const now = new Date();
  const diff = now - date;
  const days = Math.floor(diff / MS_PER_DAY);

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

export const formatLastSeen = (dateString) => {
  if (!dateString) return '';

  const date = parseServerDate(dateString);
  if (!date || isNaN(date.getTime())) return '';
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / MS_PER_DAY);

  if (diffMins < 1) {
    return 'только что';
  } else if (diffMins < 60) {
    const word = diffMins === 1 ? 'минуту' : (diffMins < 5 ? 'минуты' : 'минут');
    return `${diffMins} ${word} назад`;
  } else if (diffHours < 24) {
    const word = diffHours === 1 ? 'час' : (diffHours < 5 ? 'часа' : 'часов');
    return `${diffHours} ${word} назад`;
  } else if (diffDays === 1) {
    return 'вчера в ' + date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays < 7) {
    return `${diffDays} дн. назад`;
  } else {
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
  }
};

export const getOnlineStatus = (participant, currentUserId) => {
  if (!participant) return { text: '', online: false };
  if (Number(participant.id) === Number(currentUserId)) return { text: '', online: false };
  
  if (participant.online) {
    return { text: 'онлайн', online: true };
  }
  
  if (participant.lastSeenAt) {
    return { text: `был(а) ${formatLastSeen(participant.lastSeenAt)}`, online: false };
  }
  
  return { text: '', online: false };
};
