/**
 * Форматирование и парсинг дат. FSD: shared/lib
 */

const MS_PER_DAY = 86400000;

/**
 * Выбор формы слова для числа (русская локализация).
 * @param {number} count
 * @param {[string, string, string]} forms — [1, 2-4, 0,5-20,...], например ['минуту', 'минуты', 'минут']
 * @returns {string}
 */
function pluralize(count, forms) {
  const cases = [2, 0, 1, 1, 1, 2];
  const index = count % 100 > 4 && count % 100 < 20 ? 2 : cases[Math.min(count % 10, 5)];
  return forms[index];
}

/**
 * Парсит дату с сервера: число, Date, массив [year, month, day, ...] или строка ISO/timestamp.
 * @param {string|number|Date|number[]|null|undefined} dateString
 * @returns {Date|null}
 */
export const parseServerDate = (dateString) => {
  if (dateString == null) return null;
  if (typeof dateString === 'number') return new Date(dateString);
  if (dateString instanceof Date) return dateString;
  if (Array.isArray(dateString) && dateString.length >= 3) {
    const [year, month, day, hour = 0, minute = 0, second = 0, nanosecond = 0] = dateString;
    const y = Number(year);
    const m = Number(month);
    const d = Number(day);
    if (
      !Number.isFinite(y) ||
      !Number.isFinite(m) ||
      !Number.isFinite(d) ||
      m < 1 ||
      m > 12 ||
      d < 1 ||
      d > 31
    ) {
      return null;
    }
    const millisecond = Math.floor(Number(nanosecond) / 1000000);
    const date = new Date(
      Date.UTC(y, m - 1, d, Number(hour), Number(minute), Number(second), millisecond)
    );
    return isNaN(date.getTime()) ? null : date;
  }
  const str = String(dateString).trim();
  if (/^\d+$/.test(str)) {
    const timestamp = parseInt(str, 10);
    if (timestamp > 1000000000000) return new Date(timestamp);
    if (timestamp > 1000000000) return new Date(timestamp * 1000);
  }
  const date = new Date(str);
  return isNaN(date.getTime()) ? null : date;
};

/**
 * Дата для заголовка в чате: «Сегодня», «Вчера» или ДД.ММ[, ГГГГ].
 * @param {string|number|Date|number[]|null|undefined} dateString
 * @returns {string}
 */
export const formatChatDate = (dateString) => {
  if (!dateString) return '';
  const date = parseServerDate(dateString);
  if (!date || isNaN(date.getTime())) return '';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (messageDate.getTime() === today.getTime()) return 'Сегодня';
  if (messageDate.getTime() === today.getTime() - MS_PER_DAY) return 'Вчера';
  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
};

/**
 * Время в формате ЧЧ:ММ (локаль ru-RU).
 * @param {string|number|Date|number[]|null|undefined} dateString
 * @returns {string}
 */
export const formatChatTime = (dateString) => {
  if (!dateString) return '';
  const date = parseServerDate(dateString);
  if (!date || isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
};

/**
 * Время для списка чатов: время сегодня, «Вчера», «X дн. назад» или ДД.ММ.
 * @param {string|number|Date|number[]|null|undefined} dateString
 * @returns {string}
 */
export const formatChatListTime = (dateString) => {
  if (!dateString) return '';
  const date = parseServerDate(dateString);
  if (!date || isNaN(date.getTime())) return '';
  const now = new Date();
  const diff = now - date;
  const days = Math.floor(diff / MS_PER_DAY);
  if (days === 0) return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  if (days === 1) return 'Вчера';
  if (days < 7) return `${days} ${pluralize(days, ['день', 'дня', 'дней'])} назад`;
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
};

/**
 * Длительность встречи: ЧЧ:ММ:СС или ММ:СС (seconds — длительность в секундах).
 * @param {number} seconds
 * @returns {string}
 */
export const formatMeetingTime = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Относительное время «был(а) в сети»: «только что», «X мин/час назад», «вчера в ЧЧ:ММ», «X дн. назад» или ДД.ММ.
 * @param {string|number|Date|number[]|null|undefined} dateString
 * @returns {string}
 */
export const formatLastSeen = (dateString) => {
  if (!dateString) return '';
  const date = parseServerDate(dateString);
  if (!date || isNaN(date.getTime())) return '';
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / MS_PER_DAY);
  if (diffMins < 1) return 'только что';
  if (diffMins < 60) {
    return `${diffMins} ${pluralize(diffMins, ['минуту', 'минуты', 'минут'])} назад`;
  }
  if (diffHours < 24) {
    return `${diffHours} ${pluralize(diffHours, ['час', 'часа', 'часов'])} назад`;
  }
  if (diffDays === 1)
    return 'вчера в ' + date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  if (diffDays < 7) return `${diffDays} ${pluralize(diffDays, ['день', 'дня', 'дней'])} назад`;
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
};

/**
 * Текст статуса участника: «онлайн» или «был(а) …» по lastSeenAt; для текущего пользователя — пусто.
 * @param {{ id: string|number, online?: boolean, lastSeenAt?: string|number|Date|number[] }|null} participant
 * @param {string|number|null|undefined} currentUserId
 * @returns {{ text: string, online: boolean }}
 */
export const getOnlineStatus = (participant, currentUserId) => {
  if (!participant) return { text: '', online: false };
  if (Number(participant.id) === Number(currentUserId)) return { text: '', online: false };
  if (participant.online) return { text: 'онлайн', online: true };
  if (participant.lastSeenAt)
    return { text: `был(а) ${formatLastSeen(participant.lastSeenAt)}`, online: false };
  return { text: '', online: false };
};
