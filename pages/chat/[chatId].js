import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import { Send, Loader2, Menu, Check, CheckCheck, AlertCircle, Clock, ArrowLeft, Mic, X, ChevronDown, Pause, Play, Lock, Unlock, Trash2, Edit, Reply, Pin } from 'lucide-react';
import { chatAPI, getCurrentUser, isAuthenticated } from '@/utils/api';
import { getChatName } from '@/utils/chatHelpers';
import { formatChatDate, formatChatTime, getOnlineStatus } from '@/utils/dateHelpers';
import { useMessageSender } from '@/hooks/useMessageSender';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { MESSAGE_STATUS } from '@/utils/messageQueue';
import ChatSidebar from '@/component/ChatSidebar';
import VoiceMessagePlayer from '@/component/VoiceMessagePlayer';
import MessageContextMenu from '@/component/MessageContextMenu';
import styles from '@/styles/chat.module.css';
import { useChats, useChatMessages } from '@/context/messaging';
import { useChatRealtime } from '@/hooks/useChatRealtime';
import { useStomp } from '@/context/socket';
import { safeJsonParse, safeUnsubscribe } from '@/utils/safe';

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
  const { connected, readAtByChatIdByUserId, replaceOptimistic, addOptimistic, chats, refreshChats, upsertMessage, updateMessage } = useChats();
  const { client } = useStomp();

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
  const [contextMenu, setContextMenu] = useState(null);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingContent, setEditingContent] = useState('');
  const [replyingToMessageId, setReplyingToMessageId] = useState(null);
  const [replyingToMessage, setReplyingToMessage] = useState(null);
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [viewedPinnedMessageId, setViewedPinnedMessageId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleteForAll, setDeleteForAll] = useState(false);

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
  const userScrolledToBottomRef = useRef(false); // Флаг, что пользователь намеренно прокрутил вниз
  const shouldRestorePositionRef = useRef(true); // Флаг, нужно ли восстанавливать позицию
  const restoreAttemptsRef = useRef(0); // Счетчик попыток восстановления
  const wasAtBottomBeforeMessageRef = useRef(false); // Флаг, был ли пользователь внизу до добавления сообщения
  const shouldAutoScrollRef = useRef(false); // Флаг, нужно ли автоматически прокручивать
  const scrollHeightBeforeMessageRef = useRef(0); // Высота скролла до добавления сообщения

  useChatRealtime(chatId);

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
      // Сбрасываем флаги при смене чата
      scrollPositionSavedRef.current = false;
      shouldRestorePositionRef.current = true;
      userScrolledToBottomRef.current = false;
      restoreAttemptsRef.current = 0;
      if (!chat) {
        setLoading(true);
        loadChat();
      } else {
        setLoading(false);
      }
      loadMessages(0);
      loadPinnedMessages();
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

  // Проверка, находится ли пользователь внизу чата
  const isAtBottom = useCallback((threshold = 100) => {
    if (!messagesContainerRef.current) return false;
    const container = messagesContainerRef.current;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    return distanceFromBottom <= threshold;
  }, []);

  // Сохранение позиции скролла
  const saveScrollPosition = useCallback((force = false) => {
    if (!messagesContainerRef.current || !chatId) return;
    const container = messagesContainerRef.current;
    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    const isBottom = isAtBottom(50); // Более строгая проверка для "внизу"
    
    if (typeof window !== 'undefined') {
      const scrollData = {
        scrollTop,
        scrollHeight,
        isBottom, // Сохраняем, был ли пользователь внизу
        timestamp: Date.now()
      };
      
      localStorage.setItem(`chat_scroll_${chatId}`, JSON.stringify(scrollData));
      
      // Если пользователь внизу, помечаем это
      if (isBottom) {
        userScrolledToBottomRef.current = true;
      }
    }
  }, [chatId, isAtBottom]);

  // Восстановление позиции скролла
  const restoreScrollPosition = useCallback(() => {
    if (!messagesContainerRef.current || !chatId || messages.length === 0) return;
    if (!shouldRestorePositionRef.current) return;
    
    const saved = typeof window !== 'undefined' 
      ? localStorage.getItem(`chat_scroll_${chatId}`)
      : null;
    
    if (saved) {
      try {
        const { scrollTop, scrollHeight, isBottom, timestamp } = JSON.parse(saved);
        const container = messagesContainerRef.current;
        
        // Восстанавливаем только если сохранение было недавно (в течение 10 минут)
        const isRecent = Date.now() - timestamp < 10 * 60 * 1000;
        
        if (isRecent) {
          // Если пользователь был внизу, всегда прокручиваем вниз
          if (isBottom) {
            userScrolledToBottomRef.current = true;
            setTimeout(() => {
              scrollToBottom();
              scrollPositionSavedRef.current = true;
              shouldRestorePositionRef.current = false;
            }, 100);
            return;
          }
          
          // Иначе восстанавливаем сохраненную позицию
          const attemptRestore = () => {
            if (container.scrollHeight >= scrollHeight) {
              container.scrollTop = scrollTop;
              scrollPositionSavedRef.current = true;
              shouldRestorePositionRef.current = false;
              restoreAttemptsRef.current = 0;
            } else {
              // Если контент еще не загружен, пробуем еще раз
              restoreAttemptsRef.current++;
              if (restoreAttemptsRef.current < 5) {
                setTimeout(attemptRestore, 200);
              } else {
                // Если не удалось восстановить за 5 попыток, прокручиваем вниз
                scrollToBottom();
                scrollPositionSavedRef.current = true;
                shouldRestorePositionRef.current = false;
              }
            }
          };
          
          setTimeout(attemptRestore, 100);
        } else {
          // Если сохранение старое, прокручиваем вниз
          scrollToBottom();
          scrollPositionSavedRef.current = true;
          shouldRestorePositionRef.current = false;
        }
      } catch (e) {
        // Игнорируем ошибки парсинга, прокручиваем вниз
        scrollToBottom();
        scrollPositionSavedRef.current = true;
        shouldRestorePositionRef.current = false;
      }
    } else {
      // Если нет сохраненной позиции, прокручиваем вниз
      scrollToBottom();
      scrollPositionSavedRef.current = true;
      shouldRestorePositionRef.current = false;
    }
  }, [chatId, messages.length]);

  useEffect(() => {
    if (messages.length > 0 && !scrollPositionSavedRef.current && shouldRestorePositionRef.current) {
      restoreScrollPosition();
    }
  }, [messages, restoreScrollPosition]);

  // Автоскролл только для новых сообщений, если пользователь внизу
  useEffect(() => {
    if (!messagesContainerRef.current || messages.length === 0) return;
    if (!scrollPositionSavedRef.current) return; // Не автоскроллим, пока не восстановили позицию
    
    const container = messagesContainerRef.current;
    const currentScrollHeight = container.scrollHeight;
    
    // Если высота изменилась (добавилось новое сообщение), проверяем, нужно ли прокручивать
    if (scrollHeightBeforeMessageRef.current > 0 && currentScrollHeight > scrollHeightBeforeMessageRef.current) {
      // Высота увеличилась - добавлено новое сообщение
      // Прокручиваем только если пользователь был внизу до добавления сообщения
      if (wasAtBottomBeforeMessageRef.current || shouldAutoScrollRef.current) {
        setTimeout(() => {
          // Двойная проверка перед прокруткой
          if (isAtBottom(150)) {
            scrollToBottom();
            userScrolledToBottomRef.current = true;
          } else {
            userScrolledToBottomRef.current = false;
          }
          // Сбрасываем флаги после проверки
          wasAtBottomBeforeMessageRef.current = false;
          shouldAutoScrollRef.current = false;
        }, 50);
      } else {
        // Если пользователь не был внизу, не прокручиваем
        userScrolledToBottomRef.current = false;
      }
    } else {
      // Если высота не изменилась или это первая загрузка, проверяем текущую позицию
      const isNearBottom = isAtBottom(100);
      if (isNearBottom && (wasAtBottomBeforeMessageRef.current || shouldAutoScrollRef.current)) {
        setTimeout(() => {
          if (isAtBottom(150)) {
            scrollToBottom();
            userScrolledToBottomRef.current = true;
          }
          wasAtBottomBeforeMessageRef.current = false;
          shouldAutoScrollRef.current = false;
        }, 50);
      } else {
        userScrolledToBottomRef.current = false;
        wasAtBottomBeforeMessageRef.current = false;
        shouldAutoScrollRef.current = false;
      }
    }
    
    // Сохраняем текущую высоту для следующей проверки
    scrollHeightBeforeMessageRef.current = currentScrollHeight;
  }, [messages.length, isAtBottom]);

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
    isPaused,
    recordingTime,
    audioBlob,
    previewBlob,
    error: voiceError,
    audioLevel,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    cancelRecording,
    reset: resetVoice,
    convertToBase64,
  } = useVoiceRecorder();

  const [isLocked, setIsLocked] = useState(false);
  const [isHolding, setIsHolding] = useState(false);
  const [dragDistance, setDragDistance] = useState(0);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [reachedLockThreshold, setReachedLockThreshold] = useState(false);
  const buttonRef = useRef(null);
  const startYRef = useRef(0);
  const startTimeRef = useRef(0);
  const startDelayTimeoutRef = useRef(null);
  const audioPreviewRef = useRef(null);
  const lockThreshold = 80; // Пикселей вверх для блокировки
  const minHoldTime = 500; // Минимальное время удержания в мс (0.5 секунды)


  useEffect(() => {
    if (connected && chatId) {
      syncQueue();
    }
  }, [connected, chatId, syncQueue]);

  // Подписка на WebSocket события закрепления/открепления
  const pinnedSubRef = useRef(null);
  const unpinnedSubRef = useRef(null);
  // Подписка на WebSocket события удаления сообщений
  const deletedForMeSubRef = useRef(null);
  const deletedForAllSubRef = useRef(null);

  useEffect(() => {
    if (!chatId || !client || !connected || !client.connected || !client.active) {
      if (pinnedSubRef.current) {
        safeUnsubscribe(pinnedSubRef.current);
        pinnedSubRef.current = null;
      }
      if (unpinnedSubRef.current) {
        safeUnsubscribe(unpinnedSubRef.current);
        unpinnedSubRef.current = null;
      }
      if (deletedForMeSubRef.current) {
        safeUnsubscribe(deletedForMeSubRef.current);
        deletedForMeSubRef.current = null;
      }
      if (deletedForAllSubRef.current) {
        safeUnsubscribe(deletedForAllSubRef.current);
        deletedForAllSubRef.current = null;
      }
      return;
    }

    if (pinnedSubRef.current) {
      safeUnsubscribe(pinnedSubRef.current);
      pinnedSubRef.current = null;
    }
    if (unpinnedSubRef.current) {
      safeUnsubscribe(unpinnedSubRef.current);
      unpinnedSubRef.current = null;
    }
    if (deletedForMeSubRef.current) {
      safeUnsubscribe(deletedForMeSubRef.current);
      deletedForMeSubRef.current = null;
    }
    if (deletedForAllSubRef.current) {
      safeUnsubscribe(deletedForAllSubRef.current);
      deletedForAllSubRef.current = null;
    }

    try {
      console.log('Subscribing to pinned messages for chat:', chatId);
      const pinnedSub = client.subscribe(`/topic/chat/${chatId}/pinned`, (message) => {
        const event = safeJsonParse(message.body);
        console.log('MESSAGE_PINNED event received:', event); // Для отладки
        if (!event || event.eventType !== 'MESSAGE_PINNED') {
          console.log('Event is not MESSAGE_PINNED or missing eventType');
          return;
        }
        if (!event.pinnedMessage) {
          console.log('Event missing pinnedMessage');
          return;
        }
        
        // Проверяем chatId из pinnedMessage (согласно инструкции)
        const eventChatId = event.pinnedMessage.chatId;
        if (Number(eventChatId) !== Number(chatId)) {
          console.log('ChatId mismatch:', eventChatId, 'vs', chatId);
          return;
        }

        // Согласно инструкции: pinnedMessage содержит message (полная информация о сообщении)
        const pinnedMsg = event.pinnedMessage?.message;
        const pinnedMsgId = pinnedMsg?.id;
        
        if (!pinnedMsgId) {
          console.warn('MESSAGE_PINNED: missing message ID', event);
          return;
        }
        
        console.log('MESSAGE_PINNED WebSocket event received:', pinnedMsgId, event);
        
        // Сначала обновляем сообщение в списке сообщений, чтобы показать индикатор закрепления
        updateMessage({ ...pinnedMsg, isPinned: true }, { unreadDelta: 0 });

        // Затем обновляем список закрепленных сообщений
        setPinnedMessages(prev => {
          console.log('Updating pinned messages list, current length:', prev.length);
          // Проверяем, есть ли уже такое сообщение (включая временные оптимистичные)
          // Ищем по message.id внутри pinnedMessage
          const existingIndex = prev.findIndex(p => {
            const pMsgId = p.message?.id;
            return pMsgId && Number(pMsgId) === Number(pinnedMsgId);
          });
          
          if (existingIndex >= 0) {
            console.log('Replacing existing pinned message at index:', existingIndex);
            // Заменяем существующее (включая временное оптимистичное) на реальное из сервера
            const updated = [...prev];
            updated[existingIndex] = event.pinnedMessage;
            const sorted = updated.sort((a, b) => (b.orderIndex || 0) - (a.orderIndex || 0));
            console.log('Pinned messages after replace:', sorted.length);
            
            // Если замененное сообщение было первым в списке, сбрасываем viewedPinnedMessageId
            // чтобы показать обновленное сообщение
            if (sorted[0] && sorted[0].message?.id && Number(sorted[0].message.id) === Number(pinnedMsgId)) {
              setViewedPinnedMessageId(null);
            }
            
            return sorted;
          }
          
          console.log('Adding new pinned message to list');
          // Добавляем новое закрепленное сообщение и сортируем по orderIndex DESC
          const updated = [...prev, event.pinnedMessage];
          const sorted = updated.sort((a, b) => (b.orderIndex || 0) - (a.orderIndex || 0));
          console.log('Pinned messages after add:', sorted.length);
          
          // Сбрасываем просмотренное сообщение, чтобы показать новое закрепленное (первое в списке)
          setViewedPinnedMessageId(null);
          
          return sorted;
        });
      });
      pinnedSubRef.current = pinnedSub;
      console.log('Successfully subscribed to pinned messages');

      const unpinnedSub = client.subscribe(`/topic/chat/${chatId}/unpinned`, (message) => {
        const event = safeJsonParse(message.body);
        console.log('MESSAGE_UNPINNED event received:', event); // Для отладки
        if (!event || event.eventType !== 'MESSAGE_UNPINNED') {
          console.log('Event is not MESSAGE_UNPINNED or missing eventType');
          return;
        }
        if (Number(event.chatId) !== Number(chatId)) {
          console.log('ChatId mismatch:', event.chatId, 'vs', chatId);
          return;
        }

        // Обновляем сообщение в списке сообщений, чтобы убрать индикатор закрепления
        if (event.messageId) {
          // Находим сообщение в списке и обновляем его
          const messageToUpdate = messages.find(m => Number(m.id) === Number(event.messageId));
          if (messageToUpdate) {
            updateMessage({ ...messageToUpdate, isPinned: false }, { unreadDelta: 0 });
          }
        }

        // Согласно инструкции: event содержит messageId
        setPinnedMessages(prev => prev.filter(p => {
          const pMsgId = p.message?.id;
          return !pMsgId || Number(pMsgId) !== Number(event.messageId);
        }));

        // Сбрасываем просмотренное сообщение, если оно было откреплено
        setViewedPinnedMessageId(prev => {
          if (prev && Number(prev) === Number(event.messageId)) {
            return null;
          }
          return prev;
        });
      });
      unpinnedSubRef.current = unpinnedSub;
      console.log('Successfully subscribed to unpinned messages');

      // Подписка на удаление сообщения для себя
      const deletedForMeSub = client.subscribe('/user/queue/message-deleted', (message) => {
        const event = safeJsonParse(message.body);
        console.log('MESSAGE_DELETED_FOR_ME event received:', event);
        if (!event || event.eventType !== 'MESSAGE_DELETED_FOR_ME') return;
        if (!event.messageId) return;

        // Находим сообщение в актуальном состоянии и обновляем его
        const messageToDelete = messages.find(m => Number(m.id) === Number(event.messageId));
        if (messageToDelete) {
          updateMessage({ ...messageToDelete, deletedForMe: true }, { unreadDelta: 0 });
        }

        // Убираем из списка закрепленных ТОЛЬКО удаленное сообщение
        const deletedMessageId = Number(event.messageId);
        setPinnedMessages(prev => prev.filter(p => {
          const pMsgId = p.message?.id;
          // Фильтруем только если message.id совпадает с удаленным
          return !pMsgId || Number(pMsgId) !== deletedMessageId;
        }));

        // Сбрасываем просмотренное сообщение, если оно было удалено
        setViewedPinnedMessageId(prev => {
          if (prev && Number(prev) === Number(event.messageId)) {
            return null;
          }
          return prev;
        });
      });
      deletedForMeSubRef.current = deletedForMeSub;

      // Подписка на удаление сообщения для всех
      const deletedForAllSub = client.subscribe(`/topic/chat/${chatId}/deleted`, (message) => {
        const event = safeJsonParse(message.body);
        console.log('MESSAGE_DELETED_FOR_ALL event received:', event);
        if (!event || event.eventType !== 'MESSAGE_DELETED_FOR_ALL') return;
        if (Number(event.chatId) !== Number(chatId)) return;
        if (!event.messageId) return;

        const deletedMessageId = Number(event.messageId);

        // Находим сообщение в актуальном состоянии и обновляем его
        const messageToDelete = messages.find(m => Number(m.id) === deletedMessageId);
        if (messageToDelete) {
          updateMessage({ ...messageToDelete, deletedForAll: true }, { unreadDelta: 0 });
        }

        // Убираем из списка закрепленных ТОЛЬКО удаленное сообщение
        // Важно: проверяем именно message.id внутри pinnedMessage, а не id самого pinnedMessage
        setPinnedMessages(prev => prev.filter(p => {
          const pMsgId = p.message?.id;
          // Фильтруем только если message.id совпадает с удаленным
          return !pMsgId || Number(pMsgId) !== deletedMessageId;
        }));

        // Сбрасываем просмотренное сообщение, если оно было удалено
        setViewedPinnedMessageId(prev => {
          if (prev && Number(prev) === deletedMessageId) {
            return null;
          }
          return prev;
        });
      });
      deletedForAllSubRef.current = deletedForAllSub;
    } catch (e) {
      console.error('Error subscribing to pinned/deleted messages:', e);
    }

    return () => {
      if (pinnedSubRef.current) {
        safeUnsubscribe(pinnedSubRef.current);
        pinnedSubRef.current = null;
      }
      if (unpinnedSubRef.current) {
        safeUnsubscribe(unpinnedSubRef.current);
        unpinnedSubRef.current = null;
      }
      if (deletedForMeSubRef.current) {
        safeUnsubscribe(deletedForMeSubRef.current);
        deletedForMeSubRef.current = null;
      }
      if (deletedForAllSubRef.current) {
        safeUnsubscribe(deletedForAllSubRef.current);
        deletedForAllSubRef.current = null;
      }
    };
  }, [chatId, client, connected, updateMessage, messages]);

  const handleContextMenu = useCallback((e, message) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      message,
      position: { x: e.clientX, y: e.clientY }
    });
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleCopyMessage = useCallback(async (message) => {
    if (!message?.content) return;
    
    const textToCopy = message.content;
    
    try {
      // Пробуем использовать современный Clipboard API
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(textToCopy);
        // Можно добавить уведомление об успешном копировании
        if (typeof window !== 'undefined') {
          // Визуальная обратная связь (опционально)
          const notification = document.createElement('div');
          notification.textContent = 'Текст скопирован';
          notification.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #10b981; color: white; padding: 12px 20px; border-radius: 8px; z-index: 10000; font-size: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);';
          document.body.appendChild(notification);
          setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transition = 'opacity 0.3s';
            setTimeout(() => document.body.removeChild(notification), 300);
          }, 2000);
        }
      } else {
        // Fallback для старых браузеров
        const textArea = document.createElement('textarea');
        textArea.value = textToCopy;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        textArea.setSelectionRange(0, 99999); // Для мобильных устройств
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
    } catch (err) {
      console.error('Failed to copy text:', err);
      // В случае ошибки можно показать сообщение пользователю
      alert('Не удалось скопировать текст');
    }
  }, []);

  const loadPinnedMessages = useCallback(async () => {
    if (!chatId) return;
    try {
      const pinned = await chatAPI.getPinnedMessages(chatId);
      // Сортируем по orderIndex DESC (последние закрепленные первыми)
      const sorted = Array.isArray(pinned) 
        ? [...pinned].sort((a, b) => (b.orderIndex || 0) - (a.orderIndex || 0))
        : [];
      setPinnedMessages(sorted);
      // Сбрасываем просмотренное сообщение при загрузке новых закрепленных
      setViewedPinnedMessageId(null);
    } catch (error) {
      console.error('Error loading pinned messages:', error);
    }
  }, [chatId]);

  const handleDeleteMessage = useCallback((message) => {
    if (!message?.id || !chatId) return;
    setContextMenu(null);
    setDeleteConfirm({ message });
  }, [chatId]);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteConfirm?.message?.id || !chatId) return;
    const message = deleteConfirm.message;
    const shouldDeleteForAll = deleteForAll && message.senderId === user?.id;
    setDeleteConfirm(null);
    setDeleteForAll(false);
    
    // Оптимистичное обновление: сразу удаляем из UI
    const messageToDelete = messages.find(m => Number(m.id) === Number(message.id));
    if (messageToDelete) {
      if (shouldDeleteForAll) {
        updateMessage({ ...messageToDelete, deletedForAll: true }, { unreadDelta: 0 });
      } else {
        updateMessage({ ...messageToDelete, deletedForMe: true }, { unreadDelta: 0 });
      }
    }
    
    // Убираем из списка закрепленных ТОЛЬКО удаленное сообщение
    const deletedMessageId = Number(message.id);
    setPinnedMessages(prev => prev.filter(p => {
      const pMsgId = p.message?.id;
      // Фильтруем только если message.id совпадает с удаленным
      return !pMsgId || Number(pMsgId) !== deletedMessageId;
    }));
    
    // Сбрасываем просмотренное сообщение, если оно было удалено
    if (viewedPinnedMessageId && Number(viewedPinnedMessageId) === Number(message.id)) {
      setViewedPinnedMessageId(null);
    }
    
    try {
      if (shouldDeleteForAll) {
        await chatAPI.deleteMessageForAll(chatId, message.id);
      } else {
        await chatAPI.deleteMessageForMe(chatId, message.id);
      }
      // WebSocket события подтвердят удаление
    } catch (error) {
      console.error('Error deleting message:', error);
      // Откатываем оптимистичное обновление при ошибке
      if (messageToDelete) {
        if (shouldDeleteForAll) {
          updateMessage({ ...messageToDelete, deletedForAll: false }, { unreadDelta: 0 });
        } else {
          updateMessage({ ...messageToDelete, deletedForMe: false }, { unreadDelta: 0 });
        }
      }
      // Перезагружаем закрепленные сообщения при ошибке
      loadPinnedMessages();
    }
  }, [chatId, deleteConfirm, deleteForAll, messages, updateMessage, viewedPinnedMessageId, loadPinnedMessages, user]);

  const handleEditMessage = useCallback((message) => {
    setEditingMessageId(message.id);
    setEditingContent(message.content || '');
    setContextMenu(null);
    // Фокусируемся на поле ввода
    setTimeout(() => {
      messageInputRef.current?.focus();
    }, 100);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingMessageId || !chatId || !editingContent.trim()) {
      setEditingMessageId(null);
      setEditingContent('');
      return;
    }

    // Находим текущее сообщение в списке
    const currentMessage = messages.find(m => String(m.id) === String(editingMessageId));
    
    // Проверяем, изменился ли текст
    const originalContent = currentMessage?.content?.trim() || '';
    const newContent = editingContent.trim();
    
    if (originalContent === newContent) {
      // Текст не изменился, просто закрываем режим редактирования
      setEditingMessageId(null);
      setEditingContent('');
      setNewMessage('');
      return;
    }

    try {
      const editedMessage = await chatAPI.editMessage(chatId, editingMessageId, newContent);
      
      if (currentMessage) {
        // Обновляем сообщение локально с новым содержимым и флагом edited
        const updatedMessage = {
          ...currentMessage,
          content: newContent,
          edited: true,
          editedAt: editedMessage?.editedAt || new Date().toISOString(),
        };
        
        // Обновляем сообщение через updateMessage (для существующих сообщений)
        updateMessage(updatedMessage, { unreadDelta: 0 });
      }
      
      setEditingMessageId(null);
      setEditingContent('');
      setNewMessage('');
    } catch (error) {
      console.error('Error editing message:', error);
      alert('Не удалось отредактировать сообщение');
    }
  }, [editingMessageId, chatId, editingContent, messages, updateMessage]);

  const handleCancelEdit = useCallback(() => {
    setEditingMessageId(null);
    setEditingContent('');
    setNewMessage('');
  }, []);

  const handleReplyMessage = useCallback((message) => {
    if (!message?.id) return;
    setReplyingToMessageId(message.id);
    setReplyingToMessage(message);
    setContextMenu(null);
    // Фокусируемся на поле ввода
    setTimeout(() => {
      messageInputRef.current?.focus();
    }, 100);
  }, []);

  const handleCancelReply = useCallback(() => {
    setReplyingToMessageId(null);
    setReplyingToMessage(null);
  }, []);

  const handlePinMessage = useCallback(async (message) => {
    if (!message?.id || !chatId) return;
    setContextMenu(null);
    
    const isCurrentlyPinned = pinnedMessages.some(p => {
      const pinnedMsgId = p.message?.id;
      return pinnedMsgId && Number(pinnedMsgId) === Number(message.id);
    });
    
    try {
      if (isCurrentlyPinned) {
        // Оптимистичное обновление: сразу убираем из списка закрепленных
        const messageIdToUnpin = Number(message.id);
        setPinnedMessages(prev => prev.filter(p => {
          const pMsgId = p.message?.id;
          return !pMsgId || Number(pMsgId) !== messageIdToUnpin;
        }));
        // Обновляем сообщение в списке
        updateMessage({ ...message, isPinned: false }, { unreadDelta: 0 });
        
        await chatAPI.unpinMessage(chatId, message.id);
      } else {
        // Оптимистичное обновление: сначала обновляем сообщение в списке сообщений
        updateMessage({ ...message, isPinned: true }, { unreadDelta: 0 });
        
        // Затем добавляем в список закрепленных
        setPinnedMessages(prev => {
          // Проверяем, нет ли уже такого сообщения (на случай двойного клика)
          const exists = prev.some(p => {
            const pMsgId = p.message?.id;
            return pMsgId && Number(pMsgId) === Number(message.id);
          });
          if (exists) {
            console.warn('Message already in pinned list:', message.id);
            return prev;
          }
          
          // Используем prev для получения максимального orderIndex
          const maxOrderIndex = prev.length > 0 
            ? Math.max(...prev.map(p => p.orderIndex || 0))
            : 0;
          
          // Используем временный ID, но с правильной структурой для замены при получении WebSocket события
          const optimisticPinned = {
            id: `temp-${message.id}-${Date.now()}`, // Временный ID с message.id для легкой идентификации
            message: message,
            orderIndex: maxOrderIndex + 1, // Новое сообщение должно быть первым (самый большой orderIndex)
          };
          
          console.log('Adding optimistic pinned message:', message.id, 'orderIndex:', optimisticPinned.orderIndex, 'to list of', prev.length);
          const updated = [optimisticPinned, ...prev];
          const sorted = updated.sort((a, b) => (b.orderIndex || 0) - (a.orderIndex || 0));
          console.log('Pinned messages after add:', sorted.length, 'first message ID:', sorted[0]?.message?.id);
          
          // Сбрасываем просмотренное сообщение, чтобы показать новое закрепленное (первое в списке)
          setViewedPinnedMessageId(null);
          
          return sorted;
        });
        
        await chatAPI.pinMessage(chatId, message.id);
      }
      // WebSocket событие подтвердит и обновит данные
    } catch (error) {
      console.error('Error pinning/unpinning message:', error);
      // Откатываем оптимистичное обновление при ошибке
      loadPinnedMessages();
      alert(`Не удалось ${isCurrentlyPinned ? 'открепить' : 'закрепить'} сообщение`);
    }
  }, [chatId, pinnedMessages, updateMessage, loadPinnedMessages]);

  const handleUnpinMessage = useCallback(async (pinnedMessage) => {
    if (!pinnedMessage?.message?.id || !chatId) return;
    const messageId = pinnedMessage.message.id;
    
    try {
      // Оптимистичное обновление: сразу убираем из списка закрепленных
      const messageIdToUnpin = Number(messageId);
      setPinnedMessages(prev => prev.filter(p => {
        const pMsgId = p.message?.id;
        return !pMsgId || Number(pMsgId) !== messageIdToUnpin;
      }));
      
      // Сбрасываем просмотренное сообщение, если оно было откреплено
      if (viewedPinnedMessageId && Number(viewedPinnedMessageId) === Number(messageId)) {
        setViewedPinnedMessageId(null);
      }
      
      // Обновляем сообщение в списке сообщений
      const messageToUpdate = messages.find(m => Number(m.id) === Number(messageId));
      if (messageToUpdate) {
        updateMessage({ ...messageToUpdate, isPinned: false }, { unreadDelta: 0 });
      }
      
      await chatAPI.unpinMessage(chatId, messageId);
      // WebSocket событие подтвердит и обновит данные
    } catch (error) {
      console.error('Error unpinning message:', error);
      // Откатываем оптимистичное обновление при ошибке
      loadPinnedMessages();
      alert('Не удалось открепить сообщение');
    }
  }, [chatId, messages, updateMessage, loadPinnedMessages, viewedPinnedMessageId]);

  const handleForwardMessage = useCallback((message) => {
    // TODO: Реализовать пересылку сообщения
    setContextMenu(null);
  }, []);

  const handleSelectMessage = useCallback((message) => {
    // TODO: Реализовать выделение сообщения
    setContextMenu(null);
  }, []);

  const sendMessage = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Если редактируем сообщение
    if (editingMessageId) {
      await handleSaveEdit();
      return;
    }
    
    if (!newMessage.trim() || !user || sending) return;

    const messageContent = newMessage.trimEnd();
    
    // Сохраняем текущую высоту скролла и позицию перед отправкой
    if (messagesContainerRef.current) {
      scrollHeightBeforeMessageRef.current = messagesContainerRef.current.scrollHeight;
      const wasAtBottom = isAtBottom(100);
      wasAtBottomBeforeMessageRef.current = wasAtBottom;
      shouldAutoScrollRef.current = wasAtBottom; // Устанавливаем флаг только если был внизу
    }
    
    // Сохраняем позицию перед отправкой
    saveScrollPosition();
    
    const replyToId = replyingToMessageId;
    setNewMessage('');
    setReplyingToMessageId(null);
    setReplyingToMessage(null);

    const result = await sendMessageHook(messageContent, 'TEXT', null, null, null, null, replyToId);

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
      if (editingMessageId) {
        // Для редактирования проверяем editingContent
        if (!sending && !isRecording && editingContent.trim()) {
          handleSaveEdit();
        }
      } else {
        // Для нового сообщения проверяем newMessage
        if (!sending && !isRecording && newMessage.trim()) {
          sendMessage(e);
        }
      }
    }
  };

  const handleVoiceStart = useCallback((clientY) => {
    if (!isRecording) {
      startTimeRef.current = Date.now();
      startYRef.current = clientY;
      setIsHolding(true);
      
      // Задержка перед началом записи - запись начнется только после удержания минимум 0.5 секунды
      startDelayTimeoutRef.current = setTimeout(async () => {
        // Проверяем, что кнопка все еще удерживается
        if (startTimeRef.current > 0 && !isRecording) {
          try {
            await startRecording();
          } catch (error) {
            if (typeof window !== 'undefined') {
              console.error('[Voice] Error starting recording:', error);
            }
            setIsHolding(false);
            startTimeRef.current = 0;
          }
        }
      }, minHoldTime);
    }
  }, [isRecording, startRecording, minHoldTime]);

  const handleVoiceEnd = useCallback(() => {
    const holdDuration = Date.now() - startTimeRef.current;
    
    // Отменяем задержку, если кнопка была отпущена до начала записи
    if (startDelayTimeoutRef.current) {
      clearTimeout(startDelayTimeoutRef.current);
      startDelayTimeoutRef.current = null;
    }
    
    setIsHolding(false);
    
    // Если запись еще не началась (кнопка отпущена до истечения задержки) - просто отменяем
    if (!isRecording) {
      setDragDistance(0);
      startTimeRef.current = 0;
      return;
    }
    
    // Если запись началась, но кнопка была отпущена слишком быстро - отменяем
    if (isRecording && !isLocked && holdDuration < minHoldTime) {
      cancelRecording();
      setDragDistance(0);
      startTimeRef.current = 0;
      return;
    }
    
    if (isRecording && !isLocked) {
      // Если достигли порога блокировки при отпускании - блокируем
      if (reachedLockThreshold) {
        setIsLocked(true);
        setReachedLockThreshold(false);
      } else {
        // Иначе отправляем сообщение
        stopRecording();
      }
    }
    setDragDistance(0);
    startTimeRef.current = 0;
  }, [isRecording, isLocked, reachedLockThreshold, stopRecording, cancelRecording, minHoldTime]);

  const handleVoiceMove = useCallback((clientY) => {
    if (isHolding && startYRef.current > 0) {
      const deltaY = startYRef.current - clientY;
      setDragDistance(Math.max(0, deltaY));
      if (deltaY > lockThreshold) {
        setReachedLockThreshold(true);
      } else {
        setReachedLockThreshold(false);
      }
    }
  }, [isHolding]);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    handleVoiceStart(e.clientY);
  }, [handleVoiceStart]);

  const handleMouseUp = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    // Обрабатываем только левую кнопку мыши
    if (e.button === 0 || e.button === undefined) {
      handleVoiceEnd();
    }
  }, [handleVoiceEnd]);

  const handleMouseMove = useCallback((e) => {
    if (isHolding) {
      handleVoiceMove(e.clientY);
    }
  }, [isHolding, handleVoiceMove]);

  const handleTouchStart = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    const touch = e.touches[0];
    handleVoiceStart(touch.clientY);
  }, [handleVoiceStart]);

  const handleTouchEnd = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    handleVoiceEnd();
  }, [handleVoiceEnd]);

  const handleTouchMove = useCallback((e) => {
    if (isHolding) {
      const touch = e.touches[0];
      handleVoiceMove(touch.clientY);
    }
  }, [isHolding, handleVoiceMove]);

  // Очистка при размонтировании или остановке записи
  useEffect(() => {
    if (!isRecording) {
      setIsLocked(false);
      setIsHolding(false);
      setDragDistance(0);
      setIsPlayingPreview(false);
      startYRef.current = 0;
      startTimeRef.current = 0;
      if (startDelayTimeoutRef.current) {
        clearTimeout(startDelayTimeoutRef.current);
        startDelayTimeoutRef.current = null;
      }
      if (audioPreviewRef.current) {
        audioPreviewRef.current.pause();
        if (audioPreviewRef.current.src) {
          URL.revokeObjectURL(audioPreviewRef.current.src);
        }
        audioPreviewRef.current.src = '';
      }
    }
  }, [isRecording]);

  // Обновление src для audio элемента при изменении previewBlob или audioBlob
  useEffect(() => {
    if (audioPreviewRef.current && (previewBlob || audioBlob) && isRecording && isLocked && isPaused) {
      // Освобождаем предыдущий URL
      if (audioPreviewRef.current.src && audioPreviewRef.current.src.startsWith('blob:')) {
        URL.revokeObjectURL(audioPreviewRef.current.src);
      }
      // Создаем новый URL
      const blob = previewBlob || audioBlob;
      if (blob && blob.size > 0) {
        const url = URL.createObjectURL(blob);
        audioPreviewRef.current.src = url;
        // Загружаем метаданные
        audioPreviewRef.current.load();
      }
    }
    return () => {
      if (audioPreviewRef.current && audioPreviewRef.current.src && audioPreviewRef.current.src.startsWith('blob:')) {
        URL.revokeObjectURL(audioPreviewRef.current.src);
      }
    };
  }, [previewBlob, audioBlob, isRecording, isLocked, isPaused]);

  // Глобальные обработчики для мыши и тача
  useEffect(() => {
    if (isHolding) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleTouchMove);
      document.addEventListener('touchend', handleTouchEnd);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [isHolding, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);


  // Способ 2 (рекомендуемый): загрузка файла через REST API + отправка через WebSocket
  const handleVoiceSendSimple = useCallback(async () => {
    if (!audioBlob || !user || sending) return;

    // Сохраняем текущую высоту скролла и позицию перед отправкой
    if (messagesContainerRef.current) {
      scrollHeightBeforeMessageRef.current = messagesContainerRef.current.scrollHeight;
      const wasAtBottom = isAtBottom(100);
      wasAtBottomBeforeMessageRef.current = wasAtBottom;
      shouldAutoScrollRef.current = wasAtBottom;
    }

    try {
      let fileUrl = null;
      let finalDuration = recordingTime > 0 ? recordingTime : null;

      // Шаг 1: Загрузка файла через REST API
      // POST /api/chats/{chatId}/files/voice
      // Возвращает fileUrl: "voices/14/11/uuid.webm"
      if (typeof window !== 'undefined') {
        console.log('[Voice] Step 1: Uploading voice file via REST API...');
      }
      
      try {
        // Передаём recordingTime как duration (в секундах)
        const duration = recordingTime > 0 ? recordingTime : null;
        const uploadResponse = await chatAPI.uploadVoiceFile(chatId, audioBlob, duration);
        fileUrl = uploadResponse?.fileUrl;
        // Используем duration из ответа сервера (если есть) или наш
        finalDuration = uploadResponse?.duration || duration;
        
        if (typeof window !== 'undefined') {
          console.log('[Voice] Step 1 complete: fileUrl =', fileUrl, 'duration =', finalDuration);
        }
      } catch (uploadError) {
        // Способ 3 (fallback): Base64 через WebSocket
        if (typeof window !== 'undefined') {
          console.warn('[Voice] REST upload failed, falling back to Base64 method:', uploadError.message);
        }
        
        const base64 = await convertToBase64(audioBlob);
        const mimeType = audioBlob.type || 'audio/webm';
        const duration = recordingTime > 0 ? recordingTime : null;
        
        if (typeof window !== 'undefined') {
          console.log('[Voice] Sending via WebSocket with Base64 (fallback)...');
        }
        
        const result = await sendMessageHook(null, 'VOICE', null, base64, mimeType, duration);

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
        throw new Error('Failed to upload voice file: no fileUrl returned from server');
      }

      // Шаг 2: Отправка сообщения через WebSocket с fileUrl
      // Payload: { chatId, type: "VOICE", fileUrl: "voices/...", duration: ... }
      if (typeof window !== 'undefined') {
        console.log('[Voice] Step 2: Sending VOICE message via WebSocket with fileUrl...');
      }
      
      const result = await sendMessageHook(null, 'VOICE', fileUrl, null, null, finalDuration);

      if (typeof window !== 'undefined') {
        console.log('[Voice] Step 2 complete: result =', result);
      }

      if (result?.serverMessage) {
        addOptimistic(chatId, { ...result.serverMessage, status: MESSAGE_STATUS.SENT, isOptimistic: false });
      } else if (result?.optimisticMessage) {
        addOptimistic(chatId, result.optimisticMessage);
      }

      resetVoice();
      sentAudioBlobRef.current = null;
    } catch (error) {
      if (typeof window !== 'undefined') {
        console.error('[Voice] Error sending voice message:', error);
      }
      resetVoice();
      sentAudioBlobRef.current = null;
    }
  }, [audioBlob, user, sending, recordingTime, convertToBase64, sendMessageHook, chatId, addOptimistic, resetVoice, isAtBottom]);

  // Используем рекомендуемый способ 2: загрузка файла через REST + отправка через WebSocket
  const handleVoiceSend = useCallback(async () => {
    // Проверяем условия перед отправкой
    if (!audioBlob || !user) {
      return;
    }
    
    // Проверяем, не отправляется ли уже сообщение
    if (sending) {
      return;
    }

    try {
      await handleVoiceSendSimple();
    } catch (error) {
      if (typeof window !== 'undefined') {
        console.error('[Voice] Failed to send voice message:', error);
      }
      resetVoice();
      sentAudioBlobRef.current = null;
    }
  }, [audioBlob, user, sending, handleVoiceSendSimple, resetVoice]);

  const handleVoiceCancel = () => {
    cancelRecording();
    sentAudioBlobRef.current = null;
  };

  useEffect(() => {
    // Отправляем голосовое сообщение, когда запись завершена
    // НЕ отправляем, если запись была отменена (isLocked сброшен, но audioBlob есть)
    if (audioBlob && !isRecording && sentAudioBlobRef.current !== audioBlob && !isLocked) {
      // Проверяем, что мы не в процессе отправки другого сообщения
      if (!sending) {
        sentAudioBlobRef.current = audioBlob;
        // Небольшая задержка, чтобы убедиться, что audioBlob полностью установлен
        const timeoutId = setTimeout(() => {
          if (audioBlob && !sending && !isLocked) {
            handleVoiceSend();
          }
        }, 100);
        
        return () => clearTimeout(timeoutId);
      }
    }
  }, [audioBlob, isRecording, sending, isLocked, handleVoiceSend]);

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
    const isNearBottom = isAtBottom(100);
    setShowScrollToBottom(!isNearBottom);
    
    // Если пользователь прокрутил вниз, помечаем это
    if (isNearBottom) {
      userScrolledToBottomRef.current = true;
    } else {
      // Если прокрутил вверх, сбрасываем флаг
      userScrolledToBottomRef.current = false;
    }
    
    // Сохраняем позицию с задержкой
    isUserScrollingRef.current = true;
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    scrollTimeoutRef.current = setTimeout(() => {
      saveScrollPosition();
      isUserScrollingRef.current = false;
    }, 500);
  }, [hasMore, loadingMore, page, loadMessages, saveScrollPosition, isAtBottom]);

  const scrollToBottom = useCallback((immediate = false) => {
    if (messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      const targetScroll = container.scrollHeight;
      
      container.scrollTo({
        top: targetScroll,
        behavior: immediate ? 'auto' : 'smooth'
      });
      
      setShowScrollToBottom(false);
      userScrolledToBottomRef.current = true; // Помечаем, что пользователь намеренно прокрутил вниз
      
      // Сохраняем позицию после скролла
      setTimeout(() => {
        saveScrollPosition(true);
      }, immediate ? 50 : 300);
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

        {pinnedMessages.length > 0 && (() => {
          // Определяем, какое закрепленное сообщение показывать
          // Если есть просмотренное сообщение, показываем следующее после него
          // Иначе показываем первое (последнее закрепленное)
          let messageToShow = null;
          if (viewedPinnedMessageId) {
            // Находим индекс просмотренного сообщения
            const viewedIndex = pinnedMessages.findIndex(p => {
              const msgId = p.message?.id;
              return msgId && Number(msgId) === Number(viewedPinnedMessageId);
            });
            // Показываем следующее сообщение после просмотренного
            if (viewedIndex >= 0 && viewedIndex < pinnedMessages.length - 1) {
              messageToShow = pinnedMessages[viewedIndex + 1];
            } else {
              // Если это было последнее сообщение, показываем первое
              messageToShow = pinnedMessages[0];
            }
          } else {
            // Показываем первое (последнее закрепленное)
            messageToShow = pinnedMessages[0];
          }

          if (!messageToShow) return null;

          const msg = messageToShow.message || messageToShow;
          return (
            <div className={styles.pinnedMessagesContainer}>
              <div
                key={messageToShow.id || msg.id}
                className={styles.pinnedMessage}
                onClick={async () => {
                  // Прокручиваем к сообщению
                  const targetMessage = document.querySelector(`[data-message-id="${msg.id}"]`);
                  if (targetMessage) {
                    targetMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    // Подсвечиваем сообщение
                    targetMessage.classList.add(styles.messageHighlight);
                    setTimeout(() => {
                      targetMessage.classList.remove(styles.messageHighlight);
                    }, 2000);
                    // Устанавливаем это сообщение как просмотренное
                    setViewedPinnedMessageId(msg.id);
                  } else {
                    // Если сообщение не найдено, загружаем его
                    try {
                      const fullMessage = await chatAPI.getMessage(chatId, msg.id);
                      // Прокручиваем к началу чата и загружаем сообщения
                      messagesContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                      // Сообщение будет загружено через loadMessages
                      setViewedPinnedMessageId(msg.id);
                    } catch (error) {
                      console.error('Failed to load message:', error);
                    }
                  }
                }}
              >
                <div className={styles.pinnedMessageLine} />
                <div className={styles.pinnedMessageContent}>
                  <div className={styles.pinnedMessageHeader}>
                    <span className={styles.pinnedMessageLabel}>Закреплённое сообщение</span>
                    <button
                      className={styles.pinnedMessageUnpin}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUnpinMessage(messageToShow);
                      }}
                      title="Открепить"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <div className={styles.pinnedMessageText}>
                    {msg.type === 'VOICE' ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Mic size={14} style={{ color: '#6b7280', flexShrink: 0 }} />
                        <span>Голосовое сообщение {msg.duration ? `(${Math.round(msg.duration)}с)` : ''}</span>
                      </div>
                    ) : (
                      msg.content || ''
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

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
        
        {(() => {
          // Фильтруем удаленные сообщения
          const visibleMessages = messages.filter(msg => !msg.deletedForMe && !msg.deletedForAll);
          return visibleMessages.length === 0 ? (
            <div className={styles.emptyState}>
              <p>Пока нет сообщений</p>
              <p className={styles.emptyHint}>Начните общение!</p>
            </div>
          ) : (
            visibleMessages.map((msg, index) => {
              const showDate = index === 0 ||
              formatChatDate(visibleMessages[index - 1].createdAt) !== formatChatDate(msg.createdAt);
            const isOwn = msg.senderId === user?.id;

            return (
              <div key={msg.id}>
                {showDate && (
                  <div className={styles.dateDivider}>
                    {formatChatDate(msg.createdAt)}
                  </div>
                )}
                <div
                  className={`${styles.message} ${isOwn ? styles.ownMessage : ''} ${msg.pinned ? styles.messagePinned : ''}`}
                  onContextMenu={(e) => handleContextMenu(e, msg)}
                  data-message-id={msg.id}
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
                      </div>
                    )}
                    {msg.type === 'VOICE' && msg.fileUrl ? (
                      (() => {
                        const status = msg.status || (msg.isOptimistic ? MESSAGE_STATUS.SENDING : MESSAGE_STATUS.SENT);
                        const readMeta = status === MESSAGE_STATUS.SENT ? getReadMetaForMessage(msg) : null;
                        return (
                          <VoiceMessagePlayer 
                            fileUrl={msg.fileUrl} 
                            duration={msg.duration}
                            messageTime={formatChatTime(msg.createdAt)}
                            isOwn={isOwn}
                            statusIcon={isOwn ? getMessageStatusIcon(status, readMeta) : null}
                          />
                        );
                      })()
                    ) : (
                      <div className={`${styles.messageText} ${msg.isOptimistic ? styles.messagePending : ''} ${msg.status === MESSAGE_STATUS.FAILED ? styles.messageFailed : ''}`}>
                        {msg.replyTo && (
                          <div 
                            className={styles.messageReply}
                            onClick={async (e) => {
                              e.stopPropagation();
                              // Прокручиваем к сообщению
                              const targetMessage = document.querySelector(`[data-message-id="${msg.replyTo.id}"]`);
                              if (targetMessage) {
                                targetMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                // Подсвечиваем сообщение
                                targetMessage.classList.add(styles.messageHighlight);
                                setTimeout(() => {
                                  targetMessage.classList.remove(styles.messageHighlight);
                                }, 2000);
                              } else {
                                // Если сообщение не найдено, загружаем его
                                try {
                                  const fullMessage = await chatAPI.getMessage(chatId, msg.replyTo.id);
                                  // Прокручиваем к началу чата и загружаем сообщения
                                  messagesContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                                  // Сообщение будет загружено через loadMessages
                                } catch (error) {
                                  console.error('Failed to load message:', error);
                                }
                              }
                            }}
                          >
                            <div className={styles.messageReplyContent}>
                              <div className={styles.messageReplyAuthor}>
                                {msg.replyTo.senderDisplayName || msg.replyTo.senderUsername}
                              </div>
                              <div className={styles.messageReplyText}>
                                {msg.replyTo.content || (msg.replyTo.type === 'VOICE' ? '🎤 Голосовое сообщение' : '')}
                              </div>
                            </div>
                          </div>
                        )}
                        <div className={styles.messageTextContentWrapper}>
                          <div className={styles.messageTextContent}>
                            {msg.content}
                          </div>
                          <div className={styles.messageTextMeta}>
                            {(() => {
                              // Проверяем и флаг isPinned на сообщении, и наличие в pinnedMessages
                              const isPinnedInList = pinnedMessages.some(p => {
                                const pinnedMsgId = p.message?.id;
                                return pinnedMsgId && Number(pinnedMsgId) === Number(msg.id);
                              });
                              const isPinned = msg.isPinned || isPinnedInList;
                              return isPinned ? (
                                <Pin size={12} className={styles.messagePinnedIcon} title="Закреплено" />
                              ) : null;
                            })()}
                            <span className={styles.messageTime}>
                              {formatChatTime(msg.createdAt)}
                            </span>
                            {msg.edited && (
                              <span className={styles.messageEdited} title={msg.editedAt ? `Отредактировано ${formatChatTime(msg.editedAt)}` : 'Отредактировано'}>
                                (ред.)
                              </span>
                            )}
                            {isOwn && (() => {
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
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
          );
        })()}
        <div ref={messagesEndRef} />
      </div>
      
      {scrollButtonReady && (
        <button
          onClick={scrollToBottom}
          className={`${styles.scrollToBottomButton} ${!showScrollToBottom ? styles.hidden : ''}`}
          title="Прокрутить к новым сообщениям"
        >
          <ChevronDown size={20} />
        </button>
      )}

      {voiceError && (
        <div style={{ padding: '10px', background: '#fee', color: '#c33', borderRadius: '4px', margin: '10px' }}>
          {voiceError}
        </div>
      )}

      <form onSubmit={sendMessage} className={styles.messageForm}>
        {editingMessageId && (
          <div className={styles.editIndicator}>
            <Edit size={14} strokeWidth={1.5} />
            <span>Редактирование</span>
            <button
              type="button"
              onClick={handleCancelEdit}
              className={styles.cancelEditButton}
              title="Отменить редактирование"
            >
              <X size={14} strokeWidth={2} />
            </button>
          </div>
        )}
        {replyingToMessage && (
          <div className={styles.replyIndicator}>
            <Reply size={16} strokeWidth={1.5} />
            <div className={styles.replyIndicatorContent}>
              <div className={styles.replyIndicatorAuthor}>
                В ответ {replyingToMessage.senderDisplayName || replyingToMessage.senderUsername}
              </div>
              <div className={styles.replyIndicatorText}>
                {replyingToMessage.content || (replyingToMessage.type === 'VOICE' ? '🎤 Голосовое сообщение' : '')}
              </div>
            </div>
            <button
              type="button"
              onClick={handleCancelReply}
              className={styles.cancelReplyButton}
              title="Отменить ответ"
            >
              <X size={14} strokeWidth={2} />
            </button>
          </div>
        )}
        <div className={styles.messageFormRow}>
        <textarea
          ref={messageInputRef}
          id="chat-message-input"
          name="message"
          value={editingMessageId ? editingContent : newMessage}
          onChange={(e) => {
            if (editingMessageId) {
              setEditingContent(e.target.value);
            } else {
              setNewMessage(e.target.value);
            }
          }}
          onKeyDown={(e) => {
            if (editingMessageId && e.key === 'Escape') {
              handleCancelEdit();
              return;
            }
            handleKeyDown(e);
          }}
          placeholder={isRecording ? "Идет запись..." : editingMessageId ? "Редактируйте сообщение..." : "Введите сообщение..."}
          disabled={sending || isRecording}
          className={styles.messageInput}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
          rows={1}
        />
        {!newMessage.trim() && !editingMessageId && (
          <>
            {!isRecording && (
              <button
                ref={buttonRef}
                type="button"
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
                className={styles.voiceButton}
                title="Зажмите для записи, потяните вверх для блокировки"
                disabled={sending}
              >
                <Mic size={20} />
              </button>
            )}
            {isRecording && !isLocked && (
              <div className={styles.voiceButtonWrapper}>
                <div 
                  className={`${styles.lockIndicator} ${reachedLockThreshold ? styles.lockIndicatorActive : ''} ${reachedLockThreshold ? styles.lockIndicatorCollapse : ''}`}
                  style={{ 
                    opacity: isHolding && dragDistance > 20 ? Math.min(1, 0.4 + (dragDistance / lockThreshold) * 0.6) : 0.4,
                    transform: isHolding && dragDistance > 20 
                      ? `translateX(-50%) translateY(-${Math.min(dragDistance, lockThreshold)}px) ${reachedLockThreshold ? 'scale(0.85)' : 'scale(1)'}` 
                      : 'translateX(-50%) translateY(-20px)'
                  }}
                >
                  {reachedLockThreshold ? (
                    <Lock size={16} style={{ 
                      stroke: '#4a9eff',
                      fill: 'none',
                      strokeWidth: 2.5
                    }} />
                  ) : (
                    <Unlock size={16} style={{ 
                      color: '#666'
                    }} />
                  )}
                  <ChevronDown size={12} style={{
                    opacity: reachedLockThreshold ? 0 : 1,
                    transform: reachedLockThreshold ? 'scale(0)' : 'scale(1)',
                    transition: 'all 0.2s ease'
                  }} />
                </div>
                <div className={styles.voiceWaves}>
                  <div 
                    className={styles.voiceWave}
                    style={{
                      width: `${48 + audioLevel * 0.5}px`,
                      height: `${48 + audioLevel * 0.5}px`,
                      opacity: 0.3 + audioLevel / 300
                    }}
                  />
                  <div 
                    className={styles.voiceWave}
                    style={{
                      width: `${56 + audioLevel * 0.6}px`,
                      height: `${56 + audioLevel * 0.6}px`,
                      opacity: 0.2 + audioLevel / 400
                    }}
                  />
                  <div 
                    className={styles.voiceWave}
                    style={{
                      width: `${64 + audioLevel * 0.7}px`,
                      height: `${64 + audioLevel * 0.7}px`,
                      opacity: 0.1 + audioLevel / 500
                    }}
                  />
                </div>
                <button
                  ref={buttonRef}
                  type="button"
                  className={`${styles.voiceButton} ${styles.voiceButtonRecording} ${reachedLockThreshold ? styles.voiceButtonActive : ''}`}
                  style={reachedLockThreshold ? {
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    boxShadow: '0 4px 16px rgba(102, 126, 234, 0.5)',
                    transform: 'scale(1.05)'
                  } : {}}
                  title="Отпустите для отправки, потяните вверх для блокировки"
                  disabled={sending}
                >
                  <Mic size={20} />
                </button>
              </div>
            )}
            {isRecording && isLocked && !isPaused && (
              <>
                <div className={styles.voiceButtonWrapper}>
                  <div 
                    className={`${styles.lockIndicator} ${styles.lockIndicatorLocked}`}
                    style={{ 
                      opacity: 1,
                      transform: 'translateX(-50%) translateY(-80px)'
                    }}
                  >
                    <Lock size={16} style={{ 
                      stroke: '#4a9eff',
                      fill: 'none',
                      strokeWidth: 2.5
                    }} />
                  </div>
                  <div className={styles.voiceWaves}>
                    <div 
                      className={styles.voiceWave}
                      style={{
                        width: `${48 + audioLevel * 0.5}px`,
                        height: `${48 + audioLevel * 0.5}px`,
                        opacity: 0.3 + audioLevel / 300
                      }}
                    />
                    <div 
                      className={styles.voiceWave}
                      style={{
                        width: `${56 + audioLevel * 0.6}px`,
                        height: `${56 + audioLevel * 0.6}px`,
                        opacity: 0.2 + audioLevel / 400
                      }}
                    />
                    <div 
                      className={styles.voiceWave}
                      style={{
                        width: `${64 + audioLevel * 0.7}px`,
                        height: `${64 + audioLevel * 0.7}px`,
                        opacity: 0.1 + audioLevel / 500
                      }}
                    />
                  </div>
                  <button
                    ref={buttonRef}
                    type="button"
                    className={`${styles.voiceButton} ${styles.voiceButtonRecording} ${styles.voiceButtonLocked}`}
                    title="Запись заблокирована"
                    disabled={sending}
                  >
                    <Mic size={20} />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    pauseRecording();
                  }}
                  className={styles.pauseButton}
                  title="Приостановить запись"
                  disabled={sending}
                >
                  <Pause size={16} />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    stopRecording();
                  }}
                  className={styles.sendButton}
                  title="Отправить запись"
                  disabled={sending}
                >
                  <Send size={20} />
                </button>
              </>
            )}
            {isRecording && isLocked && isPaused && (
              <>
                <audio
                  ref={audioPreviewRef}
                  onEnded={() => setIsPlayingPreview(false)}
                  onPause={() => setIsPlayingPreview(false)}
                  onPlay={() => setIsPlayingPreview(true)}
                />
                <div className={styles.voicePreviewBar}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    cancelRecording();
                  }}
                  className={styles.voiceDeleteButton}
                  title="Удалить запись"
                >
                  <Trash2 size={18} />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (audioPreviewRef.current) {
                      if (isPlayingPreview) {
                        audioPreviewRef.current.pause();
                        setIsPlayingPreview(false);
                      } else {
                        audioPreviewRef.current.play();
                        setIsPlayingPreview(true);
                      }
                    }
                  }}
                  className={styles.voicePlayButton}
                  title={isPlayingPreview ? "Пауза" : "Прослушать запись"}
                >
                  {isPlayingPreview ? <Pause size={16} /> : <Play size={16} />}
                </button>
                <div className={styles.voiceWaveform}>
                  {/* Простая визуализация волны */}
                  {Array.from({ length: 40 }).map((_, i) => (
                    <div
                      key={i}
                      className={styles.waveformBar}
                      style={{
                        height: `${20 + Math.sin(i * 0.3) * 15}px`,
                        animationDelay: `${i * 0.05}s`
                      }}
                    />
                  ))}
                </div>
                <span className={styles.voiceDuration}>
                  {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (audioPreviewRef.current) {
                      audioPreviewRef.current.pause();
                      setIsPlayingPreview(false);
                    }
                    resumeRecording();
                  }}
                  className={styles.voiceResumeButton}
                  title="Продолжить запись"
                >
                  <Mic size={16} />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (audioPreviewRef.current) {
                      audioPreviewRef.current.pause();
                      setIsPlayingPreview(false);
                    }
                    stopRecording();
                  }}
                  className={styles.voiceSendButton}
                  title="Отправить запись"
                >
                  <Send size={18} />
                </button>
                </div>
              </>
            )}
          </>
        )}
        {(newMessage.trim() || editingMessageId) && !isRecording && (
          <button
            type="submit"
            disabled={(!newMessage.trim() && !editingMessageId) || (!editingContent.trim() && editingMessageId) || sending || isRecording}
            className={styles.sendButton}
            title={editingMessageId ? "Сохранить изменения" : "Отправить сообщение"}
          >
            {sending ? (
              <Loader2 size={20} className={styles.spinner} />
            ) : (
              <Send size={20} />
            )}
          </button>
        )}
        </div>
      </form>
      </div>

      {contextMenu && (
        <MessageContextMenu
          message={contextMenu.message}
          position={contextMenu.position}
          isOwn={contextMenu.message.senderId === user?.id}
          isPinned={pinnedMessages.some(p => {
            const pinnedMsgId = p.message?.id;
            return pinnedMsgId && Number(pinnedMsgId) === Number(contextMenu.message.id);
          })}
          onClose={handleCloseContextMenu}
          onReply={() => handleReplyMessage(contextMenu.message)}
          onPin={() => handlePinMessage(contextMenu.message)}
          onCopy={() => handleCopyMessage(contextMenu.message)}
          onForward={() => handleForwardMessage(contextMenu.message)}
          onDelete={() => handleDeleteMessage(contextMenu.message)}
          onEdit={() => handleEditMessage(contextMenu.message)}
          onSelect={() => handleSelectMessage(contextMenu.message)}
        />
      )}

      {deleteConfirm && (() => {
        // Получаем имя другого участника для чекбокса
        const getOtherParticipantName = () => {
          if (!chat?.participants || !user?.id) return '';
          if (chat.type !== 'DIRECT') {
            // Для группового чата показываем количество участников
            return `${chat.participants?.length || 0} участников`;
          }
          const other = chat.participants.find(p => Number(p.id) !== Number(user.id));
          return other?.displayName || other?.username || '';
        };

        const otherParticipantName = getOtherParticipantName();
        const canDeleteForAll = deleteConfirm.message?.senderId === user?.id;

        return (
          <div className={styles.deleteModalOverlay} onClick={() => { setDeleteConfirm(null); setDeleteForAll(false); }}>
            <div className={styles.deleteModal} onClick={(e) => e.stopPropagation()}>
              <h3 className={styles.deleteModalTitle}>Удалить это сообщение?</h3>
              {canDeleteForAll && otherParticipantName && (
                <label className={styles.deleteModalCheckbox}>
                  <input
                    type="checkbox"
                    checked={deleteForAll}
                    onChange={(e) => setDeleteForAll(e.target.checked)}
                  />
                  <span>Также удалить для {otherParticipantName}</span>
                </label>
              )}
              <div className={styles.deleteModalButtons}>
                <button
                  className={styles.deleteModalCancel}
                  onClick={() => { setDeleteConfirm(null); setDeleteForAll(false); }}
                >
                  Отмена
                </button>
                <button
                  className={styles.deleteModalConfirm}
                  onClick={handleConfirmDelete}
                >
                  Удалить
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
