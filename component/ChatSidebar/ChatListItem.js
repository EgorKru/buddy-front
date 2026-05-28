import React from 'react';
import Image from 'next/image';
import { MessageCircle, CheckCheck, Users } from 'lucide-react';
import {
  getChatName,
  getChatAvatar,
  getLastMessageReadMeta,
  getOtherParticipantOnline,
} from '@/utils/chatHelpers';
import ChatLastMessagePreview from '@/component/ChatSidebar/ChatLastMessagePreview';
import { formatChatListTime } from '@/utils/dateHelpers';
import styles from '@/component/ChatSidebar/index.module.css';

function ChatListItem({ chat, user, currentChatId, readAtByChatIdByUserId, onChatClick }) {
  const getReadStatusIcon = () => {
    if (Number(chat.lastMessage.senderId) !== Number(user?.id)) return null;

    const meta = getLastMessageReadMeta(chat, user, readAtByChatIdByUserId);
    const title = meta.isRead
      ? meta.totalOthers > 1
        ? `Прочитали ${meta.readCount}/${meta.totalOthers}`
        : 'Прочитано'
      : 'Отправлено';

    return (
      <span
        data-testid="chat-sidebar-read-status"
        data-read={meta.isRead ? 'true' : 'false'}
        title={title}
        style={{ display: 'inline-flex', alignItems: 'center', marginRight: 6 }}
      >
        {meta.isRead ? (
          <CheckCheck size={14} className={styles.statusIconRead} />
        ) : (
          <CheckCheck size={14} className={styles.statusIcon} />
        )}
      </span>
    );
  };

  const getSenderName = () => {
    if (!chat.lastMessage) return null;
    if (chat.type !== 'GROUP') return null;
    if (Number(chat.lastMessage.senderId) === Number(user?.id)) return null;

    return chat.lastMessage.senderDisplayName || chat.lastMessage.senderUsername || 'Неизвестный';
  };

  return (
    <div
      data-testid={`chat-sidebar-item-${chat.id}`}
      className={`${styles.chatItem} ${currentChatId === String(chat.id) ? styles.active : ''}`}
    >
      <div className={styles.chatAvatarWrapper}>
        <div className={styles.chatAvatar}>
          {getChatAvatar(chat, user) ? (
            <Image src={getChatAvatar(chat, user)} alt="" width={32} height={32} unoptimized />
          ) : chat.type === 'GROUP' ? (
            <Users size={20} />
          ) : (
            <MessageCircle size={20} />
          )}
        </div>
        {getOtherParticipantOnline(chat, user) && (
          <span
            data-testid="chat-sidebar-online"
            className={styles.onlineIndicator}
            title="Онлайн"
          />
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
        {chat.type === 'GROUP' && chat.participants && chat.participants.length > 0 && (
          <div className={styles.participantCount}>
            {chat.participants.length}{' '}
            {chat.participants.length === 1
              ? 'участник'
              : chat.participants.length < 5
                ? 'участника'
                : 'участников'}
          </div>
        )}
        {chat.lastMessage && (
          <div className={styles.lastMessage}>
            {getSenderName() && (
              <span className={styles.lastMessageSender}>{getSenderName()}:</span>
            )}
            <span className={styles.lastMessageText} data-testid="chat-sidebar-last-message">
              {getReadStatusIcon()}
              <ChatLastMessagePreview chat={chat} user={user} />
            </span>
          </div>
        )}
      </div>
      {chat.unreadCount > 0 && <div className={styles.unreadBadge}>{chat.unreadCount}</div>}
    </div>
  );
}

function chatListItemPropsAreEqual(prev, next) {
  if (String(prev.currentChatId) !== String(next.currentChatId)) return false;
  if (Number(prev.user?.id) !== Number(next.user?.id)) return false;

  const id = String(prev.chat?.id);
  if (id !== String(next.chat?.id)) return false;

  const pc = prev.chat;
  const nc = next.chat;
  if (pc.unreadCount !== nc.unreadCount) return false;
  if (pc.type !== nc.type) return false;
  if (pc.name !== nc.name) return false;

  const pl = pc.lastMessage;
  const nl = nc.lastMessage;
  if (String(pl?.id) !== String(nl?.id)) return false;
  if (pl?.content !== nl?.content) return false;
  if (pl?.createdAt !== nl?.createdAt) return false;
  if (Number(pl?.senderId) !== Number(nl?.senderId)) return false;

  const prevRead = prev.readAtByChatIdByUserId?.[id];
  const nextRead = next.readAtByChatIdByUserId?.[id];
  if (prevRead !== nextRead) return false;

  const prevOther = pc.participants?.find((p) => Number(p.id) !== Number(prev.user?.id));
  const nextOther = nc.participants?.find((p) => Number(p.id) !== Number(next.user?.id));
  if (Boolean(prevOther?.online) !== Boolean(nextOther?.online)) return false;

  return true;
}

export default React.memo(ChatListItem, chatListItemPropsAreEqual);
