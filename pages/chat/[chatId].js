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
    // Если это оптимистичное сообщение (с tempId), добавляем его в список
    if (tempId && message.isOptimistic) {
      setMessages(prev => {
        // Проверяем, нет ли уже такого сообщения
        if (prev.some(m => m.tempId === tempId)) {
          return prev;
        }
        
        const newMessage = { 
          ...message, 
          tempId,
          id: tempId,
          isOptimistic: true, 
          status: MESSAGE_STATUS.SENDING
        };
        return [...prev, newMessage];
      });
      return;
    }
    
    // Если это реальное сообщение (с tempId для замены оптимистичного)
    if (tempId) {
      setMessages(prev => {
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
        
        // Если не нашли, проверяем дубликаты по id
        if (prev.some(m => Number(m.id) === Number(message.id))) {
          return prev;
        }
        
        // Добавляем новое, если не нашли оптимистичное
        const newMsg = { ...message, status: message.status || MESSAGE_STATUS.SENT, isOptimistic: false };
        delete newMsg.tempId;
        return [...prev, newMsg];
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
      console.log('⚠️ Не могу подписаться на чат:', { 
        client: !!client, 
        connected, 
        chatId,
        clientConnected: client?.connected,
        clientActive: client?.active
      });
      return;
    }
    
    if (!client.connected || !client.active) {
      console.log('⚠️ Клиент не подключен или не активен:', {
        connected: client.connected,
        active: client.active,
        state: client.state
      });
      return;
    }

    // Отписываемся от старой подписки, если есть
    if (subscriptionRef.current) {
      try {
        subscriptionRef.current.unsubscribe();
        console.log('🔌 Отписались от старой подписки на чат:', chatId);
      } catch (error) {
        console.error('❌ Ошибка отписки от старой подписки:', error);
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
              
              // 2. Ищем оптимистичное сообщение для замены
              // Ищем по более широким критериям: content, senderId, статус и время создания
              const now = Date.now();
              const optimisticIndex = prev.findIndex(m => {
                // Должно быть оптимистичное сообщение
                if (!m.tempId && !m.isOptimistic) return false;
                
                // Content должен совпадать (trimmed)
                if (String(m.content || '').trim() !== String(messageDto.content || '').trim()) {
                  return false;
                }
                
                // SenderId должен совпадать (с приведением типов)
                if (Number(m.senderId) !== Number(messageDto.senderId)) {
                  return false;
                }
                
                // Статус должен быть sending
                const isSending = m.status === MESSAGE_STATUS.SENDING || 
                                 m.status === 'sending' || 
                                 m.status === MESSAGE_STATUS.PENDING ||
                                 m.status === 'pending';
                if (!isSending) return false;
                
                // Сообщение должно быть создано недавно (в последние 60 секунд)
                // Это защита от замены старых сообщений
                if (m.createdAt) {
                  const messageTime = new Date(m.createdAt).getTime();
                  const timeDiff = now - messageTime;
                  if (timeDiff > 60000) return false; // Больше 60 секунд
                }
                
                return true;
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
              
              // 3. Если не нашли оптимистичное сообщение, добавляем новое
              return [...prev, {
                ...messageDto,
                status: MESSAGE_STATUS.SENT,
                isOptimistic: false,
              }];
            });
          } catch (error) {
            console.error('Ошибка парсинга сообщения:', error);
          }
        }
      );
      subscriptionRef.current = subscription;
    } catch (error) {
      console.error('❌ Ошибка подписки на чат:', error);
    }
  };

  const unsubscribeFromChat = () => {
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
      if (process.env.NODE_ENV === 'development') {
        console.log('Отписались от чата:', chatId);
      }
    }
  };

  // Синхронизация очереди при подключении
  useEffect(() => {
    if (connected && chatId) {
      syncQueue();
    }
  }, [connected, chatId, syncQueue]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || sending) {
      return;
    }

    const messageContent = newMessage.trim();
    setNewMessage('');

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

