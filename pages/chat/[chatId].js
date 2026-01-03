import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import { Send, Loader2, Menu, Check, CheckCheck, AlertCircle, Clock } from 'lucide-react';
import { chatAPI, getCurrentUser, isAuthenticated } from '@/utils/api';
import { getChatName } from '@/utils/chatHelpers';
import { formatChatDate, formatChatTime } from '@/utils/dateHelpers';
import { useMessageSender } from '@/hooks/useMessageSender';
import { MESSAGE_STATUS } from '@/utils/messageQueue';
import ChatSidebar from '@/component/ChatSidebar';
import styles from '@/styles/chat.module.css';
import { useChats, useChatMessages } from '@/context/messaging';
import { useChatRealtime } from '@/hooks/useChatRealtime';

const DUPLICATE_WINDOW_MS = 5000;

const isDuplicate = (a, b) => {
  if (a?.id && b?.id && Number(a.id) === Number(b.id)) return true;
  if (Number(a?.senderId) !== Number(b?.senderId)) return false;
  if (String(a?.content || '').trim() !== String(b?.content || '').trim()) return false;
  const timeDiff = Math.abs(new Date(a?.createdAt) - new Date(b?.createdAt));
  return timeDiff < DUPLICATE_WINDOW_MS;
};


export default function ChatPage() {
  const router = useRouter();
  const { chatId } = router.query;
  const user = getCurrentUser();
  const { connected, readAtByChatIdByUserId, replaceOptimistic, addOptimistic } = useChats();

  const [chat, setChat] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const messages = useChatMessages(chatId);

  useChatRealtime(chatId);

  const loadChat = useCallback(async () => {
    if (!chatId) return;
    try {
      const chatData = await chatAPI.getChat(chatId);
      setChat(chatData);
    } catch (error) {
      if (error?.message?.includes('404')) {
        router.push('/');
      }
    }
  }, [chatId, router]);

  const loadMessages = useCallback(async (pageNum = 0, append = false) => {
    if (!chatId) return;
    try {
      setLoadingMore(true);
      const response = await chatAPI.getMessages(chatId, {
        page: pageNum,
        size: 50,
      });

      setPage(response.number);
      setHasMore(!response.last);
      setLoading(false);
    } catch (error) {
      setLoading(false);
    } finally {
      setLoadingMore(false);
    }
  }, [chatId]);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }
    if (chatId) {
      loadChat();
      loadMessages(0);
    }
  }, [chatId, router, loadChat, loadMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleMessageSent = useCallback((confirmation, tempId) => {
    if (!confirmation || !confirmation.message) return;

    const message = confirmation.message;
    if (tempId && confirmation.status === 'sent') {
      replaceOptimistic(chatId, tempId, message, MESSAGE_STATUS.SENT);
    } else if (tempId && confirmation.status !== 'sent') {
      replaceOptimistic(chatId, tempId, message, MESSAGE_STATUS.FAILED);
    }
  }, [chatId, replaceOptimistic]);

  const { sendMessage: sendMessageHook, sending, syncQueue } = useMessageSender(
    chatId,
    handleMessageSent
  );


  useEffect(() => {
    if (connected && chatId) {
      syncQueue();
    }
  }, [connected, chatId, syncQueue]);

  const sendMessage = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!newMessage.trim() || !user || sending) return;

    const messageContent = newMessage.trim();
    setNewMessage('');

    const result = await sendMessageHook(messageContent, 'TEXT');

    if (result?.serverMessage) {
      // serverMessage придёт и в topic, но upsert в store безопасен — добавим сразу для UX
      addOptimistic(chatId, { ...result.serverMessage, status: MESSAGE_STATUS.SENT, isOptimistic: false });
    } else if (result?.optimisticMessage) {
      addOptimistic(chatId, result.optimisticMessage);
    }
    
    if (!result) {
      setNewMessage(messageContent);
    }
  };

  const handleScroll = () => {
    if (!messagesContainerRef.current) return;
    
    const container = messagesContainerRef.current;
    if (container.scrollTop < 100 && hasMore && !loadingMore) {
      loadMessages(page + 1, true);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const getReadMetaForMessage = useCallback((msg) => {
    if (!chatId || !msg?.createdAt || !user?.id) return { isRead: false, readCount: 0, totalOthers: 0 };

    const chatReadMap = readAtByChatIdByUserId?.[String(chatId)] || {};
    const msgTime = new Date(msg.createdAt).getTime();
    if (Number.isNaN(msgTime)) return { isRead: false, readCount: 0, totalOthers: 0 };

    const participantIds = Array.isArray(chat?.participants)
      ? chat.participants.map(p => Number(p?.id)).filter(n => Number.isFinite(n))
      : [];

    const uniqueParticipantIds = Array.from(new Set(participantIds));
    const totalOthers = Math.max(0, (uniqueParticipantIds.length || 0) - 1);

    const otherReaders = Object.entries(chatReadMap)
      .filter(([rid]) => Number(rid) !== Number(user.id))
      .map(([, readAt]) => new Date(readAt).getTime())
      .filter(t => !Number.isNaN(t));

    const readCount = otherReaders.reduce((acc, readAtTime) => (readAtTime >= msgTime ? acc + 1 : acc), 0);
    const isRead = readCount > 0;

    return { isRead, readCount, totalOthers };
  }, [chatId, chat?.participants, readAtByChatIdByUserId, user?.id]);

  const getMessageStatusIcon = (status, readMeta) => {
    const isRead = !!readMeta?.isRead;
    switch (status) {
      case MESSAGE_STATUS.SENDING:
      case MESSAGE_STATUS.PENDING:
        return <Clock size={14} className={styles.statusIcon} />;
      case MESSAGE_STATUS.SENT:
        if (isRead) return <CheckCheck size={14} className={styles.statusIconRead} />;
        return <CheckCheck size={14} className={styles.statusIcon} />;
      case MESSAGE_STATUS.DELIVERED:
        return <CheckCheck size={14} className={styles.statusIcon} />;
      case MESSAGE_STATUS.FAILED:
        return <AlertCircle size={14} className={styles.statusIconFailed} title="Ошибка отправки" />;
      default:
        return <CheckCheck size={14} className={styles.statusIcon} />;
    }
  };

  const getDisplayChatName = () => {
    if (!chat) return 'Загрузка...';
    return getChatName(chat, user);
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Загрузка чата...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <ChatSidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)}
        currentChatId={chatId}
      />
      
      {sidebarOpen && <div className={styles.sidebarOverlay} onClick={() => setSidebarOpen(false)} />}
      
      <div className={styles.mainContent}>
        <div className={styles.header}>
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)} 
            className={styles.menuButton}
            title="Открыть список чатов"
          >
            <Menu size={20} />
          </button>
          <div className={styles.chatInfo}>
            <h1>{getDisplayChatName()}</h1>
          </div>
        </div>

      <div
        ref={messagesContainerRef}
        className={styles.messagesContainer}
        onScroll={handleScroll}
      >
        {loadingMore && (
          <div className={styles.loadingMore}>
            <Loader2 size={16} className={styles.spinner} />
            <span>Загрузка старых сообщений...</span>
          </div>
        )}
        
        {messages.length === 0 ? (
          <div className={styles.emptyState}>
            <p>Пока нет сообщений</p>
            <p className={styles.emptyHint}>Начните общение!</p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const showDate = index === 0 || 
              formatChatDate(messages[index - 1].createdAt) !== formatChatDate(msg.createdAt);
            const isOwn = msg.senderId === user?.id;

            return (
              <div key={msg.id}>
                {showDate && (
                  <div className={styles.dateDivider}>
                    {formatChatDate(msg.createdAt)}
                  </div>
                )}
                <div
                  className={`${styles.message} ${isOwn ? styles.ownMessage : ''}`}
                >
                  {!isOwn && (
                    <div className={styles.messageAvatar}>
                      {msg.senderDisplayName?.[0] || msg.senderUsername?.[0] || '?'}
                    </div>
                  )}
                  <div className={styles.messageContent}>
                    {!isOwn && (
                      <div className={styles.messageHeader}>
                        <span className={styles.senderName}>
                          {msg.senderDisplayName || msg.senderUsername}
                        </span>
                        <span className={styles.messageTime}>
                          {formatChatTime(msg.createdAt)}
                        </span>
                      </div>
                    )}
                    <div className={`${styles.messageText} ${msg.isOptimistic ? styles.messagePending : ''} ${msg.status === MESSAGE_STATUS.FAILED ? styles.messageFailed : ''}`}>
                      {msg.content}
                    </div>
                    {isOwn && (
                      <div className={styles.messageFooter}>
                        <span className={styles.messageTime}>
                          {formatChatTime(msg.createdAt)}
                        </span>
                        {(() => {
                          const status = msg.status || (msg.isOptimistic ? MESSAGE_STATUS.SENDING : MESSAGE_STATUS.SENT);
                          const readMeta = status === MESSAGE_STATUS.SENT ? getReadMetaForMessage(msg) : null;
                          const title = readMeta?.readCount
                            ? (readMeta.totalOthers > 1 ? `Прочитали ${readMeta.readCount}/${readMeta.totalOthers}` : 'Прочитано')
                            : 'Отправлено';
                          return (
                            <span title={title}>
                              {getMessageStatusIcon(status, readMeta)}
                            </span>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={sendMessage} className={styles.messageForm}>
        <input
          type="text"
          id="chat-message-input"
          name="message"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Введите сообщение..."
          disabled={sending}
          className={styles.messageInput}
        />
        <button
          type="submit"
          disabled={!newMessage.trim() || sending}
          className={styles.sendButton}
          title="Отправить сообщение"
        >
          {sending ? (
            <Loader2 size={20} className={styles.spinner} />
          ) : (
            <Send size={20} />
          )}
        </button>
      </form>
      </div>
    </div>
  );
}
