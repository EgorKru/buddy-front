import { useCallback } from 'react';
import { Clock, CheckCheck, AlertCircle } from 'lucide-react';
import { MESSAGE_STATUS } from '@/utils/messageQueue';
import { STATUS_ICON_SIZE } from '../constants/chat';
import styles from '@/styles/chat.module.css';

export const useMessageStatus = ({ chatId, chat, readAtByChatIdByUserId, user }) => {
  const getReadMetaForMessage = useCallback((msg) => {
    if (!chatId || !msg?.createdAt || !user?.id) {
      return { isRead: false, readCount: 0, totalOthers: 0 };
    }

    const chatIdStr = String(chatId);
    const chatReadMap = readAtByChatIdByUserId?.[chatIdStr] || {};
    const msgTime = new Date(msg.createdAt).getTime();
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
        const readAtTime = new Date(readAt).getTime();
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

