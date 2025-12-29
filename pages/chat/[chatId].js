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
    if (chatId && client && connected) {
      subscribeToChat();
      return () => {
        unsubscribeFromChat();
      };
    }
  }, [chatId, client, connected]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Callback для обработки отправленных сообщений
  const handleMessageSent = useCallback((message, tempId) => {
    if (tempId) {
      // Обновляем существующее оптимистичное сообщение
      setMessages(prev => {
        const index = prev.findIndex(m => 
          (m.tempId === tempId || m.id === tempId) && m.isOptimistic
        );
        
        if (index !== -1) {
          // Заменяем оптимистичное сообщение на реальное
          const updated = [...prev];
          updated[index] = {
            ...message,
            status: message.status || MESSAGE_STATUS.SENT,
          };
          return updated;
        } else {
          // Или добавляем новое, если это сообщение от сервера
          return [...prev, { ...message, status: message.status || MESSAGE_STATUS.SENT }];
        }
      });
      
      // Обновляем статус в карте
      if (message.status) {
        setMessageStatusMap(prev => ({
          ...prev,
          [tempId]: message.status,
        }));
      }
    } else {
      // Новое сообщение (не оптимистичное)
      setMessages(prev => {
        // Проверяем, нет ли уже такого сообщения
        const exists = prev.find(m => m.id === message.id);
        if (exists) return prev;
        return [...prev, { ...message, status: MESSAGE_STATUS.SENT }];
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
      if (process.env.NODE_ENV === 'development') {
        console.log('Не могу подписаться на чат:', { client: !!client, connected, chatId });
      }
      return;
    }

    try {
      const subscription = client.subscribe(
        `/topic/chat/${chatId}`,
        (message) => {
          try {
            const messageDto = JSON.parse(message.body);
            if (process.env.NODE_ENV === 'development') {
              console.log('Получено сообщение через WebSocket:', messageDto);
            }
            const isOwnMessage = messageDto.senderId === user?.id;
            
            setMessages(prev => {
              // Проверяем, нет ли уже такого сообщения (избегаем дубликатов)
              const existing = prev.find(m => m.id === messageDto.id);
              if (existing) {
                return prev;
              }
              
              // Если это наше сообщение, ищем оптимистичное для замены
              if (isOwnMessage) {
                const optimisticIndex = prev.findIndex(m => 
                  m.isOptimistic && 
                  m.content === messageDto.content && 
                  m.senderId === messageDto.senderId &&
                  Math.abs(new Date(m.createdAt || m.tempId).getTime() - new Date(messageDto.createdAt).getTime()) < 10000
                );
                
                if (optimisticIndex !== -1) {
                  if (process.env.NODE_ENV === 'development') {
                    console.log('✅ Заменяем оптимистичное сообщение на реальное:', messageDto);
                  }
                  const updated = [...prev];
                  const optimisticMsg = updated[optimisticIndex];
                  updated[optimisticIndex] = {
                    ...messageDto,
                    status: MESSAGE_STATUS.SENT,
                  };
                  
                  // Обновляем статус через handleServerMessage
                  if (optimisticMsg.tempId && handleServerMessage) {
                    handleServerMessage(messageDto, optimisticMsg.tempId);
                  }
                  
                  return updated;
                }
              }
              
              // Если это новое сообщение от другого пользователя
              return [...prev, { ...messageDto, status: MESSAGE_STATUS.SENT }];
            });
          } catch (error) {
            console.error('Ошибка парсинга сообщения:', error);
          }
        }
      );
      subscriptionRef.current = subscription;
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Подписались на чат:', chatId);
      }
    } catch (error) {
      console.error('Ошибка подписки на чат:', error);
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

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || sending) return;

    const messageContent = newMessage.trim();
    
    // Оптимистичное обновление UI - показываем сообщение сразу
    const optimisticMessage = {
      id: `temp-${Date.now()}`,
      content: messageContent,
      senderId: user.id,
      senderUsername: user.username,
      senderDisplayName: user.displayName || user.username,
      createdAt: new Date().toISOString(),
      type: 'TEXT',
      isOptimistic: true, // Флаг для временного сообщения
    };
    
    setMessages(prev => [...prev, optimisticMessage]);
    setNewMessage('');
    setSending(true);
    
    // Fallback: удаляем оптимистичное сообщение через 15 секунд, если оно не было заменено
    // Это защита от "висящих" сообщений, если что-то пошло не так
    const fallbackTimeout = setTimeout(() => {
      setMessages(prev => {
        const stillOptimistic = prev.find(m => m.id === optimisticMessage.id && m.isOptimistic);
        if (stillOptimistic) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('Оптимистичное сообщение не было заменено за 15 секунд, удаляем:', optimisticMessage);
          }
          return prev.filter(m => m.id !== optimisticMessage.id);
        }
        return prev;
      });
    }, 15000);

    try {
      // Проверяем реальное состояние WebSocket
      const isWebSocketReady = client && connected && client.connected && client.active;
      
      if (isWebSocketReady) {
        // Отправляем через WebSocket
        console.log('📤 Отправка сообщения через WebSocket:', {
          chatId,
          content: messageContent,
          destination: '/app/chat.sendMessage'
        });
        try {
          client.publish({
            destination: '/app/chat.sendMessage',
            body: JSON.stringify({
              chatId: parseInt(chatId),
              content: messageContent,
              type: 'TEXT',
            }),
          });
          console.log('✅ Сообщение отправлено через WebSocket, ждем подтверждения через подписку');
          // WebSocket отправка асинхронная, сообщение придет через подписку
          // Оптимистичное сообщение будет заменено реальным в subscribeToChat
          // Fallback таймаут очистится при замене сообщения или через 15 секунд
        } catch (wsError) {
          console.error('❌ Ошибка отправки через WebSocket:', wsError);
          // Если WebSocket ошибка, пробуем через REST API
          throw wsError;
        }
      } else {
        // Fallback: отправляем через REST API
        console.log('📤 WebSocket не подключен, отправка через REST API', { 
          client: !!client, 
          connected, 
          clientConnected: client?.connected,
          clientActive: client?.active
        });
        const sentMessage = await chatAPI.sendMessage(chatId, messageContent);
        // Заменяем оптимистичное сообщение на реальное
        clearTimeout(fallbackTimeout); // Очищаем fallback таймаут
        setMessages(prev => 
          prev.map(m => m.id === optimisticMessage.id ? sentMessage : m)
        );
      }
    } catch (error) {
      console.error('Ошибка отправки сообщения:', error);
      // Если это была ошибка WebSocket, пробуем через REST API
      if (client && connected) {
        try {
          if (process.env.NODE_ENV === 'development') {
            console.log('Повторная попытка через REST API после ошибки WebSocket');
          }
          const sentMessage = await chatAPI.sendMessage(chatId, messageContent);
          clearTimeout(fallbackTimeout); // Очищаем fallback таймаут
          setMessages(prev => 
            prev.map(m => m.id === optimisticMessage.id ? sentMessage : m)
          );
        } catch (restError) {
          console.error('Ошибка отправки через REST API:', restError);
          // Удаляем оптимистичное сообщение только при полной ошибке
          setMessages(prev => prev.filter(m => m.id !== optimisticMessage.id));
          setNewMessage(messageContent); // Возвращаем текст обратно
          alert('Не удалось отправить сообщение. Попробуйте еще раз.');
        }
      } else {
        // Удаляем оптимистичное сообщение при ошибке
        setMessages(prev => prev.filter(m => m.id !== optimisticMessage.id));
        setNewMessage(messageContent); // Возвращаем текст обратно
        alert('Не удалось отправить сообщение. Попробуйте еще раз.');
      }
    } finally {
      setSending(false);
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

