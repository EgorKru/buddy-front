import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import { ArrowLeft, Send, Loader2, Menu, Check, CheckCheck, AlertCircle, Clock } from 'lucide-react';
import { chatAPI, getCurrentUser, isAuthenticated } from '@/utils/api';
import { useStomp } from '@/context/socket';
import { getChatName } from '@/utils/chatHelpers';
import { formatChatDate, formatChatTime } from '@/utils/dateHelpers';
import { useMessageSender } from '@/hooks/useMessageSender';
import { MESSAGE_STATUS } from '@/utils/messageQueue';
import ChatSidebar from '@/component/ChatSidebar';
import styles from '@/styles/chat.module.css';

export default function ChatPage() {
  const router = useRouter();
  const { chatId } = router.query;
  const { client, connected } = useStomp();
  const user = getCurrentUser();

  const [chat, setChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [messageStatusMap, setMessageStatusMap] = useState({}); // tempId -> status

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const subscriptionRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }
    if (chatId) {
      loadChat();
      loadMessages(0);
    }
  }, [chatId, router]);

  useEffect(() => {
    if (chatId && client && connected && client.connected && client.active) {
      // Небольшая задержка для гарантии, что соединение полностью установлено
      const timeout = setTimeout(() => {
        subscribeToChat();
      }, 100);
      
      return () => {
        clearTimeout(timeout);
        unsubscribeFromChat();
      };
    }
  }, [chatId, client, connected]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Callback для обработки отправленных сообщений
  const handleMessageSent = useCallback((message, tempId) => {
    // Игнорируем оптимистичные сообщения - они не должны отображаться
    if (tempId && message.isOptimistic) {
      return; // Не добавляем оптимистичное сообщение в UI
    }
    
    // Если это реальное сообщение (с tempId для замены оптимистичного)
    if (tempId) {
      setMessages(prev => {
        // Сначала проверяем дубликаты по id - если сообщение уже есть, ничего не делаем
        if (message.id && prev.some(m => Number(m.id) === Number(message.id))) {
          return prev;
        }
        
        // Найти оптимистичное сообщение по tempId
        const optimisticIndex = prev.findIndex(m => 
          m.tempId === tempId && m.isOptimistic === true
        );
        
        if (optimisticIndex !== -1) {
          // Заменить оптимистичное на реальное
          const updated = [...prev];
          updated[optimisticIndex] = {
            ...message,
            id: message.id,
            status: message.status || MESSAGE_STATUS.SENT,
            isOptimistic: false,
          };
          delete updated[optimisticIndex].tempId;
          return updated;
        }
        
        // Если не нашли по tempId, ищем по chatId, content и status 'sending' (для подтверждений)
        if (message.chatId && message.content) {
          const optimisticIndexByChat = prev.findIndex(m => {
            if (!m.tempId && !m.isOptimistic) return false;
            if (m.chatId !== message.chatId) return false;
            if (String(m.content || '').trim() !== String(message.content || '').trim()) return false;
            const isSending = m.status === MESSAGE_STATUS.SENDING || m.status === 'sending';
            return isSending;
          });
          
          if (optimisticIndexByChat !== -1) {
            // Заменить оптимистичное на реальное
            const updated = [...prev];
            updated[optimisticIndexByChat] = {
              ...message,
              id: message.id,
              status: message.status || MESSAGE_STATUS.SENT,
              isOptimistic: false,
            };
            delete updated[optimisticIndexByChat].tempId;
            return updated;
          }
        }
        
        // Если не нашли оптимистичное сообщение и нет ID - это не наше сообщение для замены
        // Не добавляем новое сообщение здесь - оно придет через топик чата
        return prev;
      });
    }
  }, []);

  // Хук для отправки сообщений
  const { sendMessage: sendMessageHook, sending, syncQueue, handleServerMessage } = useMessageSender(
    chatId,
    handleMessageSent
  );

  const loadChat = async () => {
    try {
      const chatData = await chatAPI.getChat(chatId);
      setChat(chatData);
    } catch (error) {
      console.error('Ошибка загрузки чата:', error);
      if (error.message.includes('404')) {
        router.push('/');
      }
    }
  };

  const loadMessages = async (pageNum = 0, append = false) => {
    try {
      setLoadingMore(true);
      const response = await chatAPI.getMessages(chatId, {
        page: pageNum,
        size: 50,
      });
      
      if (append) {
        setMessages(prev => [...response.content.reverse(), ...prev]);
      } else {
        setMessages(response.content.reverse());
      }
      
      setPage(response.number);
      setHasMore(!response.last);
      setLoading(false);
    } catch (error) {
      console.error('Ошибка загрузки сообщений:', error);
      setLoading(false);
    } finally {
      setLoadingMore(false);
    }
  };

  const subscribeToChat = () => {
    if (!client || !connected || !chatId) {
      return;
    }
    
    if (!client.connected || !client.active) {
      return;
    }

    // Отписываемся от старой подписки, если есть
    if (subscriptionRef.current) {
      try {
        subscriptionRef.current.unsubscribe();
      } catch (error) {
        // Игнорируем ошибки отписки
      }
      subscriptionRef.current = null;
    }

    try {
      const topic = `/topic/chat/${chatId}`;
      const subscription = client.subscribe(
        topic,
        (message) => {
          try {
            const messageDto = JSON.parse(message.body);
            
            setMessages(prev => {
              // 1. Проверяем, нет ли уже сообщения с таким id
              const existingById = prev.findIndex(m => Number(m.id) === Number(messageDto.id));
              if (existingById !== -1) {
                return prev; // Уже есть, пропускаем
              }
              
              // 2. Если это наше сообщение (senderId === currentUserId) - игнорируем
              // Оно уже обработано через подтверждение из /user/queue/message-sent
              if (user && Number(messageDto.senderId) === Number(user.id)) {
                return prev; // Игнорируем свои сообщения из топика
              }
              
              // 2.5. Дополнительная проверка на дубликаты по content + senderId + время (в пределах 5 секунд)
              const duplicateByContent = prev.find(m => {
                if (Number(m.senderId) !== Number(messageDto.senderId)) return false;
                if (String(m.content || '').trim() !== String(messageDto.content || '').trim()) return false;
                const timeDiff = Math.abs(new Date(m.createdAt) - new Date(messageDto.createdAt));
                return timeDiff < 5000; // В пределах 5 секунд
              });
              if (duplicateByContent) {
                return prev; // Дубликат, пропускаем
              }
              
              // 3. Ищем оптимистичное сообщение для замены (на случай, если это чужое сообщение)
              const optimisticIndex = prev.findIndex(m => {
                if (!m.tempId && !m.isOptimistic) return false;
                if (String(m.content || '').trim() !== String(messageDto.content || '').trim()) {
                  return false;
                }
                if (Number(m.senderId) !== Number(messageDto.senderId)) {
                  return false;
                }
                const isSending = m.status === MESSAGE_STATUS.SENDING || 
                                 m.status === 'sending';
                return isSending;
              });
              
              if (optimisticIndex !== -1) {
                // Заменяем оптимистичное сообщение на реальное
                const updated = [...prev];
                updated[optimisticIndex] = {
                  ...messageDto,
                  status: MESSAGE_STATUS.SENT,
                  isOptimistic: false,
                };
                delete updated[optimisticIndex].tempId;
                return updated; // НЕ добавляем новое!
              }
              
              // 4. Если не нашли оптимистичное сообщение, добавляем новое (чужое сообщение)
              return [...prev, {
                ...messageDto,
                status: MESSAGE_STATUS.SENT,
                isOptimistic: false,
              }];
            });
          } catch (error) {
            // Игнорируем ошибки парсинга
          }
        }
      );
      subscriptionRef.current = subscription;
    } catch (error) {
      // Игнорируем ошибки подписки
    }
  };

  const unsubscribeFromChat = () => {
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
    }
  };

  // Синхронизация очереди при подключении (только для текущего чата)
  useEffect(() => {
    if (connected && chatId) {
      syncQueue();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, chatId]); // syncQueue стабилен, не добавляем в зависимости

  const sendMessage = async (e) => {
    e.preventDefault();
    e.stopPropagation(); // Предотвращаем всплытие события
    
    if (!newMessage.trim() || !user || sending) {
      return;
    }

    const messageContent = newMessage.trim();
    setNewMessage(''); // Очищаем поле сразу, чтобы предотвратить повторную отправку

    const result = await sendMessageHook(messageContent, 'TEXT');
    
    if (!result) {
      setNewMessage(messageContent);
    }
  };

  const handleScroll = () => {
    if (!messagesContainerRef.current) return;
    
    const container = messagesContainerRef.current;
    // Если прокрутили вверх достаточно далеко, загружаем старые сообщения
    if (container.scrollTop < 100 && hasMore && !loadingMore) {
      loadMessages(page + 1, true);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Получает иконку статуса сообщения
  const getMessageStatusIcon = (status) => {
    switch (status) {
      case MESSAGE_STATUS.SENDING:
      case MESSAGE_STATUS.PENDING:
        return <Clock size={14} className={styles.statusIcon} />;
      case MESSAGE_STATUS.SENT:
        return <Check size={14} className={styles.statusIcon} />;
      case MESSAGE_STATUS.DELIVERED:
        return <CheckCheck size={14} className={styles.statusIcon} />;
      case MESSAGE_STATUS.FAILED:
        return <AlertCircle size={14} className={styles.statusIconFailed} title="Ошибка отправки" />;
      default:
        return <Check size={14} className={styles.statusIcon} />;
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
            <div className={styles.status}>
              <span className={`${styles.statusDot} ${connected ? styles.connected : ''}`}></span>
              <span>{connected ? 'Подключено' : 'Подключение...'}</span>
            </div>
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
                        {getMessageStatusIcon(msg.status || (msg.isOptimistic ? MESSAGE_STATUS.SENDING : MESSAGE_STATUS.SENT))}
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
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder={connected ? "Введите сообщение..." : "Подключение... (отправка через REST API)"}
          disabled={sending}
          className={styles.messageInput}
        />
        <button
          type="submit"
          disabled={!newMessage.trim() || sending}
          className={styles.sendButton}
          title={!connected ? "WebSocket не подключен, сообщение будет отправлено через REST API" : ""}
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

