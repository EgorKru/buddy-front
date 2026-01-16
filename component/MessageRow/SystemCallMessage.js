import React from 'react';
import { Phone } from 'lucide-react';
import { useCall } from '@/context/CallContext';
import { formatChatTime } from '@/utils/dateHelpers';
import styles from '@/styles/chat.module.css';

const SystemCallMessage = ({ message, chatId, chats }) => {
  const { initiateCall } = useCall();

  const isMissedCall = message.content && message.content.includes('Пропущенный вызов');

  const handleCallBack = () => {
    if (!isMissedCall || !message.content) return;

    const match = message.content.match(/от (.+)$/);
    if (!match) return;
    
    const callerName = match[1].trim();

    if (!chatId || !chats) return;
    
    const chat = chats.find(c => c.id === chatId);
    if (!chat || !chat.participants) return;

    const targetUser = chat.participants.find(
      p => (p.displayName === callerName || p.username === callerName) && p.id !== message.senderId
    );
    
    if (targetUser) {
      const targetUserInfo = {
        id: targetUser.id,
        username: targetUser.username,
        displayName: targetUser.displayName || targetUser.username
      };

      if (typeof initiateCall === 'function') {
        initiateCall(targetUser.id, 'AUDIO', chatId, targetUserInfo);
      }
    }
  };
  
  return (
    <div className={styles.systemCallMessage}>
      <Phone size={16} className={styles.callIcon} />
      <span className={styles.callText}>{message.content}</span>
      {message.createdAt && (
        <span className={styles.callTime}>{formatChatTime(message.createdAt)}</span>
      )}
      {isMissedCall && (
        <button
          className={styles.callBackButton}
          onClick={handleCallBack}
          title="Перезвонить"
        >
          Перезвонить
        </button>
      )}
    </div>
  );
};

export default SystemCallMessage;
