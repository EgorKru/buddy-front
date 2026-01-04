import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import { Send, Loader2, Menu, Check, CheckCheck, AlertCircle, Clock, ArrowLeft, Mic, X, ChevronDown } from 'lucide-react';
import { chatAPI, getCurrentUser, isAuthenticated } from '@/utils/api';
import { getChatName } from '@/utils/chatHelpers';
import { formatChatDate, formatChatTime, getOnlineStatus } from '@/utils/dateHelpers';
import { useMessageSender } from '@/hooks/useMessageSender';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { useVoiceProtocol } from '@/hooks/useVoiceProtocol';
import { MESSAGE_STATUS } from '@/utils/messageQueue';
import ChatSidebar from '@/component/ChatSidebar';
import VoiceMessagePlayer from '@/component/VoiceMessagePlayer';
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
  const { connected, readAtByChatIdByUserId, replaceOptimistic, addOptimistic, chats, refreshChats } = useChats();

  const chat = useMemo(() => {
    if (!chatId) return null;
    return chats.find(c => String(c?.id) === String(chatId)) || null;
  }, [chatId, chats]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const sentAudioBlobRef = useRef(null);
  const messageInputRef = useRef(null);
  const messages = useChatMessages(chatId);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [scrollButtonReady, setScrollButtonReady] = useState(false);
  const scrollPositionSavedRef = useRef(false);
  const isUserScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef(null);

  useChatRealtime(chatId);
  const voiceProtocol = useVoiceProtocol(chatId);

  const loadChat = useCallback(async () => {
    if (!chatId) return;
    try {
      await refreshChats();
      setLoading(false);
    } catch (error) {
      setLoading(false);
      if (error?.message?.includes('404')) {
        router.push('/');
      }
    }
  }, [chatId, router, refreshChats]);

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
      // Сбрасываем флаг сохранения позиции при смене чата
      scrollPositionSavedRef.current = false;
      if (!chat) {
        setLoading(true);
        loadChat();
      } else {
        setLoading(false);
      }
      loadMessages(0);
    }
    
    // Устанавливаем готовность кнопки после загрузки страницы и применения стилей
    if (typeof window !== 'undefined') {
      // Ждем, пока CSS переменные и стили применятся
      const checkReady = () => {
        const sidebarWidth = getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width');
        if (sidebarWidth || document.body.hasAttribute('data-sidebar-position')) {
          setScrollButtonReady(true);
        } else {
          setTimeout(checkReady, 50);
        }
      };
      setTimeout(checkReady, 100);
    }
  }, [chatId, router, loadChat, loadMessages, chat]);

  // Сохранение позиции скролла
  const saveScrollPosition = useCallback(() => {
    if (!messagesContainerRef.current || !chatId) return;
    const container = messagesContainerRef.current;
    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    
    if (typeof window !== 'undefined') {
      localStorage.setItem(`chat_scroll_${chatId}`, JSON.stringify({
        scrollTop,
        scrollHeight,
        timestamp: Date.now()
      }));
    }
  }, [chatId]);

  // Восстановление позиции скролла
  const restoreScrollPosition = useCallback(() => {
    if (!messagesContainerRef.current || !chatId || messages.length === 0) return;
    
    const saved = typeof window !== 'undefined' 
      ? localStorage.getItem(`chat_scroll_${chatId}`)
      : null;
    
    if (saved) {
      try {
        const { scrollTop, scrollHeight, timestamp } = JSON.parse(saved);
        const container = messagesContainerRef.current;
        
        // Восстанавливаем только если сохранение было недавно (в течение 5 минут)
        if (Date.now() - timestamp < 5 * 60 * 1000) {
          // Ждем, пока DOM обновится
          setTimeout(() => {
            if (container.scrollHeight >= scrollHeight) {
              container.scrollTop = scrollTop;
              scrollPositionSavedRef.current = true;
            }
          }, 100);
        }
      } catch (e) {
        // Игнорируем ошибки парсинга
      }
    }
  }, [chatId, messages.length]);

  useEffect(() => {
    if (messages.length > 0 && !scrollPositionSavedRef.current) {
      restoreScrollPosition();
    }
  }, [messages, restoreScrollPosition]);

  // Автоскролл только для новых сообщений, если пользователь внизу
  useEffect(() => {
    if (!messagesContainerRef.current || messages.length === 0) return;
    
    const container = messagesContainerRef.current;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    
    // Автоскролл только если пользователь уже был внизу или это первая загрузка
    if (isNearBottom || !scrollPositionSavedRef.current) {
      setTimeout(() => {
        scrollToBottom();
      }, 50);
    }
  }, [messages.length]);

  useEffect(() => {
    const textarea = messageInputRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const newHeight = Math.min(textarea.scrollHeight, 120);
      textarea.style.height = `${newHeight}px`;
      
      // Показываем скроллбар только если контент переполняется
      if (textarea.scrollHeight > 120) {
        textarea.style.overflowY = 'auto';
        textarea.style.paddingRight = '1.25rem';
      } else {
        textarea.style.overflowY = 'hidden';
        textarea.style.paddingRight = '1rem';
      }
    }
  }, [newMessage]);

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

  const {
    isRecording,
    recordingTime,
    audioBlob,
    error: voiceError,
    startRecording,
    stopRecording,
    cancelRecording,
    reset: resetVoice,
    convertToBase64,
  } = useVoiceRecorder();


  useEffect(() => {
    if (connected && chatId) {
      syncQueue();
    }
  }, [connected, chatId, syncQueue]);

  const sendMessage = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!newMessage.trim() || !user || sending) return;

    const messageContent = newMessage.trimEnd();
    
    // Сохраняем позицию перед отправкой
    saveScrollPosition();
    
    setNewMessage('');

    const result = await sendMessageHook(messageContent, 'TEXT');

    if (result?.serverMessage) {
      addOptimistic(chatId, { ...result.serverMessage, status: MESSAGE_STATUS.SENT, isOptimistic: false });
    } else if (result?.optimisticMessage) {
      addOptimistic(chatId, result.optimisticMessage);
    }
    
    if (!result) {
      setNewMessage(messageContent);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      if (!sending && !isRecording && newMessage.trim()) {
        sendMessage(e);
      }
    }
  };

  const handleVoiceRecord = async () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleVoiceSendSimple = useCallback(async () => {
    if (!audioBlob || !user || sending) return;

    try {
      let fileUrl = null;

      try {
        const uploadResponse = await chatAPI.uploadVoiceFile(chatId, audioBlob);
        fileUrl = uploadResponse?.fileUrl;
      } catch (uploadError) {
        const base64 = await convertToBase64(audioBlob);
        const mimeType = audioBlob.type || 'audio/webm';
        const result = await sendMessageHook(null, 'VOICE', null, base64, mimeType);

        if (result?.serverMessage) {
          addOptimistic(chatId, { ...result.serverMessage, status: MESSAGE_STATUS.SENT, isOptimistic: false });
        } else if (result?.optimisticMessage) {
          addOptimistic(chatId, result.optimisticMessage);
        }

        resetVoice();
        sentAudioBlobRef.current = null;
        return;
      }

      if (!fileUrl) {
        throw new Error('Failed to upload voice file: no fileUrl returned');
      }

      const result = await sendMessageHook(null, 'VOICE', fileUrl);

      if (result?.serverMessage) {
        addOptimistic(chatId, { ...result.serverMessage, status: MESSAGE_STATUS.SENT, isOptimistic: false });
      } else if (result?.optimisticMessage) {
        addOptimistic(chatId, result.optimisticMessage);
      }

      resetVoice();
      sentAudioBlobRef.current = null;
    } catch (error) {
      resetVoice();
      sentAudioBlobRef.current = null;
    }
  }, [audioBlob, user, sending, convertToBase64, sendMessageHook, chatId, addOptimistic, resetVoice]);

  const handleVoiceSend = useCallback(async () => {
    if (!audioBlob || !user || sending) return;

    const useNewProtocol = typeof window !== 'undefined' && localStorage.getItem('use_voice_protocol') !== 'false';

    if (typeof window !== 'undefined') {
      console.log('[Voice] Protocol:', useNewProtocol ? 'NEW (Pager Voice Protocol)' : 'SIMPLE (REST + WebSocket)');
    }

    if (useNewProtocol) {
      try {
        if (typeof window !== 'undefined') {
          console.log('[Voice] Initiating new protocol...');
        }
        voiceProtocol.initiate();
        
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            if (typeof window !== 'undefined') {
              console.warn('[Voice] Protocol timeout - no response from server');
            }
            reject(new Error('Voice protocol timeout'));
          }, 10000);
          
          const checkState = setInterval(() => {
            const { sessionState, relaySessionId } = voiceProtocol;
            if (typeof window !== 'undefined') {
              console.log('[Voice] Checking state:', sessionState, 'relaySessionId:', relaySessionId);
            }
            
            if (sessionState === 'ready' || sessionState === 'relay' || sessionState === 'p2p') {
              clearInterval(checkState);
              clearTimeout(timeout);
              
              if (relaySessionId) {
                if (typeof window !== 'undefined') {
                  console.log('[Voice] Sending ANSWER (relay mode)');
                }
                voiceProtocol.sendAnswer();
              } else {
                if (typeof window !== 'undefined') {
                  console.log('[Voice] Sending OFFER (P2P mode)');
                }
                voiceProtocol.sendOffer();
              }
              
              setTimeout(() => {
                if (typeof window !== 'undefined') {
                  console.log('[Voice] Starting audio transmission');
                }
                voiceProtocol.startSendingAudio([audioBlob], () => {
                  if (typeof window !== 'undefined') {
                    console.log('[Voice] Audio transmission completed');
                  }
                  resetVoice();
                  sentAudioBlobRef.current = null;
                  resolve();
                });
              }, 500);
            } else if (sessionState === 'error') {
              clearInterval(checkState);
              clearTimeout(timeout);
              reject(new Error('Voice protocol error'));
            }
          }, 100);
        });
      } catch (error) {
        if (typeof window !== 'undefined') {
          console.warn('[Voice] New protocol failed, falling back to simple method:', error);
        }
        await handleVoiceSendSimple();
      }
    } else {
      if (typeof window !== 'undefined') {
        console.log('[Voice] Using simple method (protocol disabled)');
      }
      await handleVoiceSendSimple();
    }
  }, [audioBlob, user, sending, voiceProtocol, handleVoiceSendSimple, resetVoice]);

  const handleVoiceCancel = () => {
    cancelRecording();
    sentAudioBlobRef.current = null;
  };

  useEffect(() => {
    if (audioBlob && !isRecording && !sending && sentAudioBlobRef.current !== audioBlob) {
      sentAudioBlobRef.current = audioBlob;
      handleVoiceSend();
    }
  }, [audioBlob, isRecording, sending, handleVoiceSend]);

  const handleScroll = useCallback(() => {
    if (!messagesContainerRef.current) return;
    
    const container = messagesContainerRef.current;
    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;
    
    // Проверка на загрузку старых сообщений
    if (scrollTop < 100 && hasMore && !loadingMore) {
      loadMessages(page + 1, true);
    }
    
    // Показываем кнопку "вниз" если пользователь не внизу
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    setShowScrollToBottom(!isNearBottom);
    
    // Сохраняем позицию с задержкой
    isUserScrollingRef.current = true;
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    scrollTimeoutRef.current = setTimeout(() => {
      saveScrollPosition();
      isUserScrollingRef.current = false;
    }, 500);
  }, [hasMore, loadingMore, page, loadMessages, saveScrollPosition]);

  const scrollToBottom = useCallback(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
      setShowScrollToBottom(false);
      // Сохраняем позицию после скролла
      setTimeout(() => {
        saveScrollPosition();
      }, 300);
    }
  }, [saveScrollPosition]);

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

  const getOtherParticipantStatus = () => {
    if (!chat?.participants || !user?.id) return { text: '', online: false };
    if (chat.type !== 'DIRECT') return { text: `${chat.participants?.length || 0} участников`, online: false };
    
    const other = chat.participants.find(p => Number(p.id) !== Number(user.id));
    return getOnlineStatus(other, user.id);
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
            onClick={() => router.back()} 
            className={styles.backButton}
            title="Назад"
          >
            <ArrowLeft size={20} />
          </button>
          <div className={styles.chatInfo}>
            <h1>{getDisplayChatName()}</h1>
            {(() => {
              const status = getOtherParticipantStatus();
              if (!status.text) return null;
              return (
                <div className={styles.onlineStatus}>
                  {status.online && <span className={styles.onlineDot} />}
                  <span className={status.online ? styles.onlineText : styles.offlineText}>
                    {status.text}
                  </span>
            </div>
              );
            })()}
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
                    {msg.type === 'VOICE' && msg.fileUrl ? (
                      <VoiceMessagePlayer fileUrl={msg.fileUrl} duration={msg.duration} />
                    ) : (
                      <div className={`${styles.messageText} ${msg.isOptimistic ? styles.messagePending : ''} ${msg.status === MESSAGE_STATUS.FAILED ? styles.messageFailed : ''}`}>
                        {msg.content}
                      </div>
                    )}
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
      
      {showScrollToBottom && scrollButtonReady && (
        <button
          onClick={scrollToBottom}
          className={styles.scrollToBottomButton}
          title="Прокрутить к новым сообщениям"
        >
          <ChevronDown size={20} />
        </button>
      )}

      {isRecording && (
        <div className={styles.voiceRecordingBar}>
          <div className={styles.voiceRecordingInfo}>
            <div className={styles.voiceRecordingIndicator} />
            <span className={styles.voiceRecordingTime}>
              {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
            </span>
          </div>
          <button
            type="button"
            onClick={handleVoiceCancel}
            className={styles.voiceCancelButton}
            title="Отменить запись"
          >
            <X size={20} />
          </button>
        </div>
      )}
      <form onSubmit={sendMessage} className={styles.messageForm}>
        <textarea
          ref={messageInputRef}
          id="chat-message-input"
          name="message"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isRecording ? "Идет запись..." : "Введите сообщение..."}
          disabled={sending || isRecording}
          className={styles.messageInput}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
          rows={1}
        />
        <button
          type="button"
          onClick={handleVoiceRecord}
          className={`${styles.voiceButton} ${isRecording ? styles.voiceButtonRecording : ''}`}
          title={isRecording ? "Остановить запись" : "Записать голосовое сообщение"}
          disabled={sending}
        >
          <Mic size={20} />
        </button>
        <button
          type="submit"
          disabled={!newMessage.trim() || sending || isRecording}
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
