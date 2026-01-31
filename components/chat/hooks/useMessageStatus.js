import { useCallback } from 'react';
import { Clock, CheckCheck, AlertCircle } from 'lucide-react';
import { MESSAGE_STATUS } from '@/utils/messageQueue';
import { STATUS_ICON_SIZE } from '../constants/chat';
import styles from '@/styles/chat.module.css';

// Импортируем parseServerDate для правильного парсинга дат с бэкенда
const parseServerDate = (dateString) => {
  if (!dateString) return null;
  
  if (typeof dateString === 'number') {
    return new Date(dateString);
  }
  
  if (dateString instanceof Date) {
    return dateString;
  }
  
  // Если это массив (Java LocalDateTime): [year, month, day, hour, minute, second, nanosecond]
  if (Array.isArray(dateString) && dateString.length >= 3) {
    const [year, month, day, hour = 0, minute = 0, second = 0, nanosecond = 0] = dateString;
    const millisecond = Math.floor(nanosecond / 1000000);
    return new Date(year, month - 1, day, hour, minute, second, millisecond);
  }
  
  let str = String(dateString).trim();
  
  if (/^\d+$/.test(str)) {
    const timestamp = parseInt(str, 10);
    if (timestamp > 1000000000000) {
      return new Date(timestamp);
    }
    if (timestamp > 1000000000) {
      return new Date(timestamp * 1000);
    }
  }
  
  if (!str.endsWith('Z') && !str.includes('+') && !str.includes('-', 10)) {
    str = str + 'Z';
  }
  
  return new Date(str);
};

export const useMessageStatus = ({ chatId, chat, readAtByChatIdByUserId, user }) => {
  const getReadMetaForMessage = useCallback((msg) => {
    if (!chatId || !msg?.createdAt || !user?.id) {
      return { isRead: false, readCount: 0, totalOthers: 0 };
    }

    const chatIdStr = String(chatId);
    const chatReadMap = readAtByChatIdByUserId?.[chatIdStr] || {};
    
    // Парсим дату через parseServerDate из dateHelpers
    const date = parseServerDate(msg.createdAt);
    const msgTime = date ? date.getTime() : NaN;
    
    if (Number.isNaN(msgTime)) {
      return { isRead: false, readCount: 0, totalOthers: 0 };
    }

    const participantIds = Array.isArray(chat?.participants)
      ? chat.participants.map(p => Number(p?.id)).filter(n => Number.isFinite(n))
      : [];

    const uniqueParticipantIds = Array.from(new Set(participantIds));
    const totalOthers = Math.max(0, (uniqueParticipantIds.length || 0) - 1);

    if (totalOthers === 0) {
      return { isRead: false, readCount: 0, totalOthers: 0 };
    }

    const otherReaders = Object.entries(chatReadMap)
      .filter(([rid]) => Number(rid) !== Number(user.id))
      .map(([, readAt]) => {
        if (!readAt) return null;
        const readDate = parseServerDate(readAt);
        const readAtTime = readDate ? readDate.getTime() : NaN;
        return Number.isNaN(readAtTime) ? null : readAtTime;
      })
      .filter(t => t !== null);

    const readCount = otherReaders.reduce((acc, readAtTime) => {
      return readAtTime >= msgTime ? acc + 1 : acc;
    }, 0);
    const isRead = readCount > 0;

    return { isRead, readCount, totalOthers };
  }, [chatId, chat?.participants, readAtByChatIdByUserId, user?.id]);

  const getMessageStatusIcon = useCallback((status, readMeta) => {
    const isRead = !!readMeta?.isRead;
    switch (status) {
      case MESSAGE_STATUS.SENDING:
      case MESSAGE_STATUS.PENDING:
        return <Clock size={STATUS_ICON_SIZE} className={styles.statusIcon} />;
      case MESSAGE_STATUS.SENT:
        if (isRead) return <CheckCheck size={STATUS_ICON_SIZE} className={styles.statusIconRead} />;
        return <CheckCheck size={STATUS_ICON_SIZE} className={styles.statusIcon} />;
      case MESSAGE_STATUS.DELIVERED:
        return <CheckCheck size={STATUS_ICON_SIZE} className={styles.statusIcon} />;
      case MESSAGE_STATUS.FAILED:
        return <AlertCircle size={STATUS_ICON_SIZE} className={styles.statusIconFailed} title="Ошибка отправки" />;
      default:
        return <CheckCheck size={STATUS_ICON_SIZE} className={styles.statusIcon} />;
    }
  }, []);

  return { getReadMetaForMessage, getMessageStatusIcon };
};

