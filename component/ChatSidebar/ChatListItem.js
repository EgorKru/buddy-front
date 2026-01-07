import Image from 'next/image';
import { MessageCircle, CheckCheck } from 'lucide-react';
import { getChatName, getChatAvatar, getLastMessagePreview, getLastMessageReadMeta, getOtherParticipantOnline } from '@/utils/chatHelpers';
import { formatChatListTime } from '@/utils/dateHelpers';
import styles from '@/component/ChatSidebar/index.module.css';

export default function ChatListItem({ chat, user, currentChatId, readAtByChatIdByUserId, onChatClick }) {
  const handleClick = () => {
    onChatClick(chat.id);
  };

  const getReadStatusIcon = () => {
    if (Number(chat.lastMessage.senderId) !== Number(user?.id)) return null;
    
    const meta = getLastMessageReadMeta(chat, user, readAtByChatIdByUserId);
    const title = meta.isRead 
      ? (meta.totalOthers > 1 ? `Прочитали ${meta.readCount}/${meta.totalOthers}` : 'Прочитано')
      : 'Отправлено';
    
    return (
      <span title={title} style={{ display: 'inline-flex', alignItems: 'center', marginRight: 6 }}>
        {meta.isRead ? (
          <CheckCheck size={14} className={styles.statusIconRead} />
        ) : (
          <CheckCheck size={14} className={styles.statusIcon} />
        )}
      </span>
    );
  };

  return (
    <div
      className={`${styles.chatItem} ${currentChatId === String(chat.id) ? styles.active : ''}`}
      onClick={handleClick}
    >
      <div className={styles.chatAvatarWrapper}>
        <div className={styles.chatAvatar}>
          {getChatAvatar(chat, user) ? (
            <Image
              src={getChatAvatar(chat, user)}
              alt=""
              width={32}
              height={32}
              unoptimized
            />
          ) : (
            <MessageCircle size={20} />
          )}
        </div>
        {getOtherParticipantOnline(chat, user) && (
          <span className={styles.onlineIndicator} title="Онлайн" />
        )}
      </div>
      <div className={styles.chatInfo}>
        <div className={styles.chatHeader}>
          <span className={styles.chatName}>{getChatName(chat, user)}</span>
          {chat.lastMessage && (
            <span className={styles.chatTime}>
              {formatChatListTime(chat.lastMessage.createdAt)}
            </span>
          )}
        </div>
        {chat.lastMessage && (
          <div className={styles.lastMessage}>
            <span className={styles.lastMessageText}>
              {getReadStatusIcon()}
              {getLastMessagePreview(chat)}
            </span>
          </div>
        )}
      </div>
      {chat.unreadCount > 0 && (
        <div className={styles.unreadBadge}>{chat.unreadCount}</div>
      )}
    </div>
  );
}

