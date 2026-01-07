import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// Throttle функция для оптимизации обработчиков событий
const throttle = (func, delay) => {
  let timeoutId = null;
  let lastExecTime = 0;
  return function (...args) {
    const currentTime = Date.now();
    
    if (currentTime - lastExecTime > delay) {
      func.apply(this, args);
      lastExecTime = currentTime;
    } else {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        func.apply(this, args);
        lastExecTime = Date.now();
      }, delay - (currentTime - lastExecTime));
    }
  };
};
import { useRouter } from 'next/router';
import { Send, Loader2, Menu, Check, CheckCheck, AlertCircle, Clock, ArrowLeft, Mic, X, ChevronDown, Pause, Play, Lock, Unlock, Trash2, Edit, Reply, Pin, PinOff, Forward, Search, ChevronUp, Paperclip, File } from 'lucide-react';
import { chatAPI, getCurrentUser, isAuthenticated } from '@/utils/api';
import { getChatName } from '@/utils/chatHelpers';
import { formatChatDate, formatChatTime, getOnlineStatus } from '@/utils/dateHelpers';
import { useMessageSender } from '@/hooks/useMessageSender';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { MESSAGE_STATUS } from '@/utils/messageQueue';
import ChatSidebar from '@/component/ChatSidebar';
import VoiceMessagePlayer from '@/component/VoiceMessagePlayer';
import MessageContextMenu from '@/component/MessageContextMenu';
import ImageMessage from '@/component/ImageMessage';
import FileMessage from '@/component/FileMessage';
import ImageModal from '@/component/ImageModal';
import styles from '@/styles/chat.module.css';
import { useChats, useChatMessages } from '@/context/messaging';
import { useChatRealtime } from '@/hooks/useChatRealtime';
import { usePinnedMessages } from '@/hooks/usePinnedMessages';
import { useMessageSelection } from '@/hooks/useMessageSelection';
import { useStomp } from '@/context/socket';
import PinnedMessagesHeader from '@/component/PinnedMessagesHeader';
import DeleteConfirmModal from '@/component/DeleteConfirmModal';
import ForwardModal from '@/component/ForwardModal';
import SelectionHeader from '@/component/SelectionHeader';
import MessageRow from '@/component/MessageRow';

const DUPLICATE_WINDOW_MS = 5000;

const isDuplicate = (a, b) => {
  if (a?.id && b?.id && Number(a.id) === Number(b.id)) return true;
  if (Number(a?.senderId) !== Number(b?.senderId)) return false;
  if (String(a?.content || '').trim() !== String(b?.content || '').trim()) return false;
  const timeDiff = Math.abs(new Date(a?.createdAt) - new Date(b?.createdAt));
  return timeDiff < DUPLICATE_WINDOW_MS;
};

const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};


export default function ChatPage() {
  const router = useRouter();
  const { chatId } = router.query;
  const user = getCurrentUser();
  const { connected, readAtByChatIdByUserId, replaceOptimistic, addOptimistic, chats, refreshChats, upsertMessage, updateMessage, removeMessage, markChatAsRead } = useChats();
  const { client } = useStomp();

  const chat = useMemo(() => {
    if (!chatId) return null;
    return chats.find(c => String(c?.id) === String(chatId)) || null;
  }, [chatId, chats]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0); // Оставляем для обратной совместимости, но не используем
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [oldestMessageId, setOldestMessageId] = useState(null); // Для курсорной пагинации
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingContent, setEditingContent] = useState('');
  const [replyingToMessageId, setReplyingToMessageId] = useState(null);
  const [replyingToMessage, setReplyingToMessage] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleteForAll, setDeleteForAll] = useState(false);
  const [forwardModal, setForwardModal] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMode, setSearchMode] = useState(false);
  const [searchPage, setSearchPage] = useState(0);
  const [hasMoreSearchResults, setHasMoreSearchResults] = useState(true);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(-1);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const [imageModal, setImageModal] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const selectedFileUrlRef = useRef(null);
  const fileInputRef = useRef(null);
  
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const sentAudioBlobRef = useRef(null);
  const messageInputRef = useRef(null);
  const loadingMessagesRef = useRef(false);
  const messages = useChatMessages(chatId);
  
  const {
    pinnedMessages,
    viewedPinnedMessageId,
    setViewedPinnedMessageId,
    setPinnedMessages,
    loadPinnedMessages,
  } = usePinnedMessages(chatId, messages);
  
  const {
    selectionMode,
    selectedMessages,
    handleSelectMessage: handleSelectMessageBase,
    toggleMessageSelection,
    handleSelectAll: handleSelectAllBase,
    exitSelectionMode,
  } = useMessageSelection();
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [scrollButtonReady, setScrollButtonReady] = useState(false);
  const scrollPositionSavedRef = useRef(false);
  const isUserScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef(null);
  const userScrolledToBottomRef = useRef(false);
  const shouldRestorePositionRef = useRef(true);
  const restoreAttemptsRef = useRef(0);
  const wasAtBottomBeforeMessageRef = useRef(false);
  const shouldAutoScrollRef = useRef(false);
  const scrollHeightBeforeMessageRef = useRef(0);
  const isLoadingInitialRef = useRef(false);
  const lastScrollTopRef = useRef(0);
  const isUserScrollingUpRef = useRef(false);
  const loadMoreTimeoutRef = useRef(null);
  const isRestoringScrollRef = useRef(false);
  const newMessageIdsRef = useRef(new Set());
  const isAutoScrollingRef = useRef(false);
  const loadedMessageIdsRef = useRef(new Set()); // Для отслеживания только что загруженных сообщений
  
  // Refs для предотвращения утечек памяти при восстановлении позиции скролла
  const isRestoringScrollPositionRef = useRef(false);
  const correctionFrameIdRef = useRef(null);
  const resizeObserverRef = useRef(null);
  const correctionTimeoutRef = useRef(null);
  const scrollStateRef = useRef({ hasMore: false, loadingMore: false, page: 0 });
  
  // AbortController для предотвращения race conditions
  const abortControllerRef = useRef(null);

  useChatRealtime(chatId);

  useEffect(() => {
    const handleNewMessageFromWebSocket = (message) => {
      if (!message?.id) return;
      const messageTime = new Date(message.createdAt || Date.now()).getTime();
      const now = Date.now();
      if (now - messageTime < 3000) {
        const messageId = String(message.id);
        newMessageIdsRef.current.add(messageId);
        setTimeout(() => {
          newMessageIdsRef.current.delete(messageId);
        }, 500);
      }
    };

    const originalUpsertMessage = upsertMessage;
    const wrappedUpsertMessage = (message, meta) => {
      if (message?.id && !message.isOptimistic) {
        handleNewMessageFromWebSocket(message);
      }
      return originalUpsertMessage(message, meta);
    };

    return () => {
      newMessageIdsRef.current.clear();
    };
  }, [upsertMessage]);

  const loadingChatRef = useRef(false);
  const lastMarkedReadChatIdRef = useRef(null);
  const loadChat = useCallback(async () => {
    if (!chatId) return;
    
    // Защита от повторных вызовов для того же чата
    const chatIdStr = String(chatId);
    if (loadingChatRef.current && lastMarkedReadChatIdRef.current === chatIdStr) {
      return;
    }
    
    loadingChatRef.current = true;
    lastMarkedReadChatIdRef.current = chatIdStr;
    
    try {
      // refreshChats уже вызывается в context/messaging при монтировании и подключении WebSocket
      // Вызываем только если чата нет в списке (новый чат)
      if (!chat) {
        await refreshChats();
      }
      // markChatAsRead вызывается в useChatRealtime, не дублируем здесь
      setLoading(false);
    } catch (error) {
      setLoading(false);
      if (error?.message?.includes('404')) {
        router.push('/');
      }
    } finally {
      loadingChatRef.current = false;
    }
  }, [chatId, router, refreshChats, markChatAsRead]);

  // Новая функция: загрузка полного состояния одним запросом
  const loadChatStateFull = useCallback(async (chatId) => {
    if (!chatId) return;
    
    // Отменяем предыдущий запрос если он еще выполняется
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    try {
      setLoading(true);
      isLoadingInitialRef.current = true;
      
      // Один запрос за все: чат, сообщения, закрепленные, состояние
      const state = await chatAPI.getChatStateFull(chatId, 100);
      
      if (state) {
        // Обновляем чат
        if (state.chat) {
          refreshChats(); // Обновляем список чатов
        }
        
        // Загружаем сообщения
        if (state.messages && Array.isArray(state.messages)) {
          const ordered = [...state.messages].reverse();
          for (const m of ordered) {
            // Обработка метаданных файлов
            if ((m.type === 'FILE' || m.type === 'IMAGE') && m.fileUrl && typeof window !== 'undefined') {
              const metadataKey = `file_metadata_${m.fileUrl}`;
              if (m.fileSize && m.fileName && m.mimeType) {
                const fileMetadata = {
                  fileSize: m.fileSize,
                  fileName: m.fileName,
                  mimeType: m.mimeType,
                  timestamp: Date.now()
                };
                localStorage.setItem(metadataKey, JSON.stringify(fileMetadata));
              }
            }
            upsertMessage({ ...m, status: MESSAGE_STATUS.SENT, isOptimistic: false }, { unreadDelta: 0 });
          }
        }
        
        // Обновляем последовательности
        if (state.pts !== undefined) {
          const chatIdStr = String(chatId);
          localPtsRef.current.set(chatIdStr, state.pts);
        }
        if (state.seq !== undefined) {
          localSeqRef.current = state.seq;
        }
        
        // Устанавливаем курсор для следующей загрузки
        if (state.oldestMessageId) {
          setOldestMessageId(state.oldestMessageId);
        }
        
        // Обновляем флаг наличия еще сообщений
        if (state.hasMoreMessages !== undefined) {
          setHasMore(state.hasMoreMessages);
        }
        
        // Прокручиваем вниз после первой загрузки
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (messagesContainerRef.current) {
              const container = messagesContainerRef.current;
              container.scrollTop = container.scrollHeight;
              lastScrollTopRef.current = container.scrollHeight;
              userScrolledToBottomRef.current = true;
              isUserScrollingUpRef.current = false;
            }
          });
        });
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        return; // Запрос был отменен, игнорируем
      }
      console.error('[Load Chat State Full] Error:', error);
    } finally {
      setLoading(false);
      isLoadingInitialRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current = null;
      }
    }
  }, [chatId, refreshChats, upsertMessage]);

  // Курсорная пагинация: загрузка старых сообщений до указанного ID
  const loadOlderMessages = useCallback(async (beforeMessageId) => {
    if (!chatId || !beforeMessageId || loadingMessagesRef.current) return;
    
    // Отменяем предыдущий запрос если он еще выполняется
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    loadingMessagesRef.current = true;
    try {
      setLoadingMore(true);
      
      // Сохраняем anchor point для восстановления позиции скролла
      let anchorMessageId = null;
      let anchorViewportTop = 0;
      if (messagesContainerRef.current) {
        const container = messagesContainerRef.current;
        const containerRect = container.getBoundingClientRect();
        const messages = container.querySelectorAll('[data-message-id]');
        
        let bestMessage = null;
        let bestDistance = Infinity;
        
        for (const msgEl of messages) {
          const msgRect = msgEl.getBoundingClientRect();
          const msgTop = msgRect.top;
          const msgBottom = msgRect.bottom;
          const containerTop = containerRect.top;
          const containerBottom = containerRect.bottom;
          
          if (msgTop <= containerBottom && msgBottom >= containerTop) {
            const distanceFromTop = Math.abs(msgTop - containerTop);
            if (distanceFromTop < bestDistance) {
              bestDistance = distanceFromTop;
              bestMessage = msgEl;
            }
          }
        }
        
        if (bestMessage) {
          anchorMessageId = bestMessage.getAttribute('data-message-id');
          const msgRect = bestMessage.getBoundingClientRect();
          anchorViewportTop = msgRect.top - containerRect.top;
        }
      }
      
      // Загружаем сообщения через курсорную пагинацию
      const messages = await chatAPI.getMessagesBefore(chatId, beforeMessageId, 100);
      
      if (messages && Array.isArray(messages)) {
        if (messages.length === 0) {
          setHasMore(false);
          return;
        }
        
        // Обрабатываем и добавляем сообщения
        for (const m of messages) {
          if ((m.type === 'FILE' || m.type === 'IMAGE') && m.fileUrl && typeof window !== 'undefined') {
            const metadataKey = `file_metadata_${m.fileUrl}`;
            if (m.fileSize && m.fileName && m.mimeType) {
              const fileMetadata = {
                fileSize: m.fileSize,
                fileName: m.fileName,
                mimeType: m.mimeType,
                timestamp: Date.now()
              };
              localStorage.setItem(metadataKey, JSON.stringify(fileMetadata));
            }
          }
          upsertMessage({ ...m, status: MESSAGE_STATUS.SENT, isOptimistic: false }, { unreadDelta: 0 });
        }
        
        // Обновляем oldestMessageId для следующей загрузки
        const oldestMsg = messages[messages.length - 1];
        if (oldestMsg?.id) {
          setOldestMessageId(String(oldestMsg.id));
        }
        
        // Если загрузили меньше чем limit - больше нет сообщений
        if (messages.length < 100) {
          setHasMore(false);
        }
        
        // Восстанавливаем позицию скролла (Telegram-подход)
        if (messagesContainerRef.current && anchorMessageId) {
          // Используем refs для предотвращения утечек памяти
          isRestoringScrollPositionRef.current = true;
          
          // Очищаем предыдущие таймеры и observers
          if (correctionFrameIdRef.current) {
            cancelAnimationFrame(correctionFrameIdRef.current);
            correctionFrameIdRef.current = null;
          }
          if (resizeObserverRef.current) {
            resizeObserverRef.current.disconnect();
            resizeObserverRef.current = null;
          }
          if (correctionTimeoutRef.current) {
            clearTimeout(correctionTimeoutRef.current);
            correctionTimeoutRef.current = null;
          }
          
          const performRestore = () => {
            if (!messagesContainerRef.current || !anchorMessageId || !isRestoringScrollPositionRef.current) return;
            
            const container = messagesContainerRef.current;
            const anchorMessage = container.querySelector(`[data-message-id="${anchorMessageId}"]`);
            
            if (anchorMessage) {
              const containerRect = container.getBoundingClientRect();
              const msgRect = anchorMessage.getBoundingClientRect();
              const currentViewportTop = msgRect.top - containerRect.top;
              const viewportDiff = currentViewportTop - anchorViewportTop;
              
              if (Math.abs(viewportDiff) > 0.01) {
                container.scrollTop = container.scrollTop - viewportDiff;
                lastScrollTopRef.current = container.scrollTop;
              }
            }
          };
          
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              performRestore();
              
              // Непрерывная корректировка на 60fps
              let frameCount = 0;
              const maxFrames = 60;
              
              const correctionFrame = () => {
                if (frameCount >= maxFrames || !isRestoringScrollPositionRef.current) {
                  correctionFrameIdRef.current = null;
                  return;
                }
                performRestore();
                frameCount++;
                correctionFrameIdRef.current = requestAnimationFrame(correctionFrame);
              };
              
              correctionFrameIdRef.current = requestAnimationFrame(correctionFrame);
              
              // Останавливаем корректировку через 1 секунду
              correctionTimeoutRef.current = setTimeout(() => {
                isRestoringScrollPositionRef.current = false;
                if (correctionFrameIdRef.current) {
                  cancelAnimationFrame(correctionFrameIdRef.current);
                  correctionFrameIdRef.current = null;
                }
                performRestore();
              }, 1000);
            });
          });
        }
      }
    } catch (error) {
      console.error('[Load Older Messages] Error:', error);
      setHasMore(false);
    } finally {
      setLoadingMore(false);
      loadingMessagesRef.current = false;
    }
  }, [chatId, upsertMessage]);

  const loadMessages = useCallback(async (pageNum = 0, append = false) => {
    if (!chatId) return;
    
    // Если это первая загрузка - используем новый endpoint
    if (!append && pageNum === 0) {
      return loadChatStateFull(chatId);
    }
    
    // Для загрузки старых сообщений используем курсорную пагинацию
    if (append && oldestMessageId) {
      return loadOlderMessages(oldestMessageId);
    }
    
    // Fallback на старую логику для обратной совместимости
    // Защита от параллельных вызовов
    if (loadingMessagesRef.current && !append) {
      return;
    }
    
    loadingMessagesRef.current = true;
    try {
      setLoadingMore(true);
      
      let scrollHeightBefore = 0;
      let scrollTopBefore = 0;
      let anchorMessageId = null;
      let anchorMessageTop = 0; // offsetTop сообщения до загрузки
      let anchorViewportTop = 0; // Позиция сообщения относительно верха viewport (через getBoundingClientRect)
      let anchorScrollTop = 0; // Точная позиция скролла для проверки
      if (append && messagesContainerRef.current) {
        const container = messagesContainerRef.current;
        scrollHeightBefore = container.scrollHeight;
        scrollTopBefore = container.scrollTop;
        anchorScrollTop = scrollTopBefore;
        
        // Telegram-подход: находим первое видимое сообщение как "anchor point"
        // Используем getBoundingClientRect для максимальной точности
        const containerRect = container.getBoundingClientRect();
        const messages = container.querySelectorAll('[data-message-id]');
        
        // Ищем первое сообщение, которое видно в viewport
        // Используем более точный поиск - берем сообщение ближе к верху viewport
        let bestMessage = null;
        let bestDistance = Infinity;
        
        for (const msgEl of messages) {
          const msgRect = msgEl.getBoundingClientRect();
          const msgTop = msgRect.top;
          const msgBottom = msgRect.bottom;
          const containerTop = containerRect.top;
          const containerBottom = containerRect.bottom;
          
          // Проверяем, видно ли сообщение в viewport
          if (msgTop <= containerBottom && msgBottom >= containerTop) {
            // Выбираем сообщение, которое ближе всего к верху viewport
            const distanceFromTop = Math.abs(msgTop - containerTop);
            if (distanceFromTop < bestDistance) {
              bestDistance = distanceFromTop;
              bestMessage = msgEl;
            }
          }
        }
        
        if (bestMessage) {
          anchorMessageId = bestMessage.getAttribute('data-message-id');
          anchorMessageTop = bestMessage.offsetTop;
          const msgRect = bestMessage.getBoundingClientRect();
          anchorViewportTop = msgRect.top - containerRect.top; // Точное расстояние от верха viewport
        }
      }
      
      const response = await chatAPI.getMessages(chatId, {
        page: pageNum,
        size: 50,
      });

      if (Array.isArray(response?.content)) {
        const list = response.content;
        const ordered = append ? list : [...list].reverse();
        
        // Отслеживаем ID только что загруженных сообщений для плавной анимации
        const newlyLoadedIds = new Set();
        if (append) {
          ordered.forEach(m => {
            if (m.id) {
              newlyLoadedIds.add(String(m.id));
            }
          });
        }
        
        for (const m of ordered) {
          // Обработка метаданных файлов: приоритет серверным данным, fallback на localStorage
          if ((m.type === 'FILE' || m.type === 'IMAGE') && m.fileUrl && typeof window !== 'undefined') {
            const metadataKey = `file_metadata_${m.fileUrl}`;
            
            // Если метаданные пришли от сервера - обновляем localStorage
            if (m.fileSize && m.fileName && m.mimeType) {
              const fileMetadata = {
                fileSize: m.fileSize,
                fileName: m.fileName,
                mimeType: m.mimeType,
                timestamp: Date.now()
              };
              localStorage.setItem(metadataKey, JSON.stringify(fileMetadata));
            } else {
              // Fallback: восстанавливаем из localStorage для старых сообщений без метаданных
              const savedMetadata = localStorage.getItem(metadataKey);
              if (savedMetadata) {
                try {
                  const metadata = JSON.parse(savedMetadata);
                  // Используем сохраненные данные только если их нет в сообщении
                  if (!m.fileSize && metadata.fileSize) {
                    m.fileSize = metadata.fileSize;
                  }
                  if (!m.fileName && metadata.fileName) {
                    m.fileName = metadata.fileName;
                  }
                  if (!m.mimeType && metadata.mimeType) {
                    m.mimeType = metadata.mimeType;
                  }
                } catch (e) {
                  // Игнорируем ошибки парсинга
                }
              }
            }
          }
          
          // upsertMessage автоматически обновит существующее сообщение, если оно уже загружено
          // Это позволяет обновлять старые сообщения при получении обновлений через WebSocket
          const messageData = {
            ...m,
            status: MESSAGE_STATUS.SENT,
            isOptimistic: false,
            deletedForMe: m.deletedForMe || false,
            deletedForAll: m.deletedForAll || false,
          };
          upsertMessage(messageData, { unreadDelta: 0 });
        }
        
        // Сохраняем ID загруженных сообщений для анимации
        if (append && newlyLoadedIds.size > 0) {
          newlyLoadedIds.forEach(id => {
            loadedMessageIdsRef.current.add(id);
          });
          // Удаляем через 1 секунду, чтобы анимация успела проиграться
          setTimeout(() => {
            newlyLoadedIds.forEach(id => {
              loadedMessageIdsRef.current.delete(id);
            });
          }, 1000);
        }
      }

      setPage(response.number);
      setHasMore(!response.last);
      
      // Обновляем oldestMessageId для курсорной пагинации
      if (response.content && response.content.length > 0) {
        const oldestMsg = response.content[0]; // Первое сообщение (самое старое)
        if (oldestMsg?.id) {
          setOldestMessageId(String(oldestMsg.id));
        }
      }
      
      setLoading(false);
      
      if (!append) {
        // Telegram Web: после первой загрузки всегда прокручиваем вниз
        isLoadingInitialRef.current = false;
        
        // Проверяем, есть ли сохраненная позиция для восстановления
        const saved = typeof window !== 'undefined' 
          ? localStorage.getItem(`chat_scroll_${chatId}`)
          : null;
        
        let shouldScrollToBottom = true;
        if (saved) {
          try {
            const { timestamp, isBottom } = JSON.parse(saved);
            const isRecent = Date.now() - timestamp < 10 * 60 * 1000;
            // Если есть свежая сохраненная позиция и пользователь НЕ был внизу - восстанавливаем позже
            if (isRecent && !isBottom) {
              shouldScrollToBottom = false;
            }
          } catch (e) {
            // Игнорируем ошибки, прокручиваем вниз
          }
        }
        
        // Если это первое открытие (нет сохраненной позиции или она старая) - прокручиваем вниз
        if (shouldScrollToBottom) {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              if (messagesContainerRef.current) {
                const container = messagesContainerRef.current;
                container.scrollTop = container.scrollHeight;
                lastScrollTopRef.current = container.scrollHeight;
                userScrolledToBottomRef.current = true;
                isUserScrollingUpRef.current = false;
              }
            });
          });
        }
      }
      
      if (append && messagesContainerRef.current) {
        // Telegram Web метод: идеальное сохранение позиции через anchor point
        // Используем refs для предотвращения утечек памяти
        isRestoringScrollPositionRef.current = true;
        
        // Очищаем предыдущие таймеры и observers
        if (correctionFrameIdRef.current) {
          cancelAnimationFrame(correctionFrameIdRef.current);
          correctionFrameIdRef.current = null;
        }
        if (resizeObserverRef.current) {
          resizeObserverRef.current.disconnect();
          resizeObserverRef.current = null;
        }
        if (correctionTimeoutRef.current) {
          clearTimeout(correctionTimeoutRef.current);
          correctionTimeoutRef.current = null;
        }
        
        // Telegram/WhatsApp метод: идеальное сохранение позиции
        // Ключевой момент - синхронное обновление сразу после добавления DOM
        const performRestore = () => {
          if (!messagesContainerRef.current || !anchorMessageId || !isRestoringScrollPositionRef.current) return;
          
          const container = messagesContainerRef.current;
          const anchorMessage = container.querySelector(`[data-message-id="${anchorMessageId}"]`);
          
          if (anchorMessage) {
            const containerRect = container.getBoundingClientRect();
            const msgRect = anchorMessage.getBoundingClientRect();
            const currentViewportTop = msgRect.top - containerRect.top;
            const viewportDiff = currentViewportTop - anchorViewportTop;
            
            // Telegram/WhatsApp: синхронная корректировка для мгновенного обновления
            if (Math.abs(viewportDiff) > 0.01) {
              container.scrollTop = container.scrollTop - viewportDiff;
              lastScrollTopRef.current = container.scrollTop;
            }
          }
        };
        
        // Первое восстановление - ждем обновления DOM
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            performRestore();
            
            // Непрерывная корректировка на 60fps для идеальной плавности
            let frameCount = 0;
            const maxFrames = 60; // ~1 секунда при 60fps
            
            const correctionFrame = () => {
              if (frameCount >= maxFrames || !isRestoringScrollPositionRef.current) {
                correctionFrameIdRef.current = null;
                return;
              }
              
              performRestore();
              frameCount++;
              correctionFrameIdRef.current = requestAnimationFrame(correctionFrame);
            };
            
            correctionFrameIdRef.current = requestAnimationFrame(correctionFrame);
            
            // ResizeObserver для отслеживания изменений размеров (Telegram/WhatsApp)
            if (typeof ResizeObserver !== 'undefined' && anchorMessageId) {
              const anchorMessage = messagesContainerRef.current?.querySelector(`[data-message-id="${anchorMessageId}"]`);
              if (anchorMessage) {
                resizeObserverRef.current = new ResizeObserver(() => {
                  if (isRestoringScrollPositionRef.current) {
                    performRestore();
                  }
                });
                
                // Наблюдаем за anchor сообщением и всеми медиа-элементами
                resizeObserverRef.current.observe(anchorMessage);
                anchorMessage.querySelectorAll('img, video, iframe').forEach(media => {
                  resizeObserverRef.current.observe(media);
                });
                
                // Останавливаем наблюдение через 1 секунду
                correctionTimeoutRef.current = setTimeout(() => {
                  if (resizeObserverRef.current) {
                    resizeObserverRef.current.disconnect();
                    resizeObserverRef.current = null;
                  }
                }, 1000);
              }
            }
            
            // Останавливаем корректировку через 1 секунду
            correctionTimeoutRef.current = setTimeout(() => {
              isRestoringScrollPositionRef.current = false;
              if (correctionFrameIdRef.current) {
                cancelAnimationFrame(correctionFrameIdRef.current);
                correctionFrameIdRef.current = null;
              }
              if (resizeObserverRef.current) {
                resizeObserverRef.current.disconnect();
                resizeObserverRef.current = null;
              }
              // Финальная корректировка
              performRestore();
            }, 1000);
          });
        });
      }
    } catch (error) {
      setLoading(false);
      isLoadingInitialRef.current = false;
    } finally {
      setLoadingMore(false);
      loadingMessagesRef.current = false;
    }
  }, [chatId, upsertMessage]);

  const loadedChatIdRef = useRef(null);
  const loadedMessagesRef = useRef(false);
  const loadedPinnedRef = useRef(false);
  const loadMoreObserverRef = useRef(null); // Intersection Observer для предзагрузки
  
  // Telegram-подход: хранение локальных последовательностей
  const localSeqRef = useRef(0);
  const localPtsRef = useRef(new Map()); // Map<chatId, pts>
  const gapRecoveryInProgressRef = useRef(new Set());

  // Telegram/WhatsApp подход: Intersection Observer для предзагрузки сообщений
  // Это создает впечатление, что сообщения всегда загружены
  useEffect(() => {
    if (!chatId || !messagesContainerRef.current || !hasMore) return;
    
    const container = messagesContainerRef.current;
    
    // Создаем sentinel элемент для отслеживания приближения к верху
    // Размещаем его динамически в зависимости от текущей позиции скролла
    const updateSentinel = () => {
      let sentinel = document.getElementById('messages-load-sentinel');
      if (!sentinel) {
        sentinel = document.createElement('div');
        sentinel.id = 'messages-load-sentinel';
        sentinel.style.height = '1px';
        sentinel.style.width = '1px';
        sentinel.style.position = 'absolute';
        sentinel.style.pointerEvents = 'none';
        sentinel.style.visibility = 'hidden';
        sentinel.style.opacity = '0';
        container.appendChild(sentinel);
      }
      
      // Размещаем sentinel за 1000px до верха для предзагрузки
      sentinel.style.top = '1000px';
      
      return sentinel;
    };
    
    const sentinel = updateSentinel();
    
    // Создаем Intersection Observer для предзагрузки (как в Telegram)
    if (typeof IntersectionObserver !== 'undefined') {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (
              entry.isIntersecting && 
              hasMore && 
              !loadingMore && 
              !isLoadingInitialRef.current &&
              !isRestoringScrollRef.current &&
              oldestMessageId // Используем курсорную пагинацию
            ) {
              // Предзагружаем сообщения заранее через курсорную пагинацию
              loadOlderMessages(oldestMessageId);
            }
          });
        },
        {
          root: container,
          rootMargin: '800px 0px 0px 0px', // Предзагрузка за 800px до появления
          threshold: 0,
        }
      );
      
      observer.observe(sentinel);
      loadMoreObserverRef.current = observer;
      
      // Обновляем позицию sentinel при скролле
      const handleScrollForSentinel = () => {
        if (sentinel && container) {
          const scrollTop = container.scrollTop;
          // Обновляем позицию sentinel для предзагрузки
          sentinel.style.top = `${Math.max(800, scrollTop + 800)}px`;
        }
      };
      
      container.addEventListener('scroll', handleScrollForSentinel, { passive: true });
      
      return () => {
        observer.disconnect();
        container.removeEventListener('scroll', handleScrollForSentinel);
        if (sentinel && sentinel.parentNode) {
          sentinel.parentNode.removeChild(sentinel);
        }
      };
    }
  }, [chatId, hasMore, loadingMore, page, loadMessages, isLoadingInitialRef, isRestoringScrollRef]);

  // Telegram-подход: обработка STATE_SYNC при подключении
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleStateSync = async (event) => {
      const stateData = event.detail;
      if (!stateData || stateData.eventType !== 'STATE_SYNC') return;
      
      // Обновляем глобальный seq
      if (stateData.seq !== undefined && stateData.seq > localSeqRef.current) {
        const oldSeq = localSeqRef.current;
        localSeqRef.current = stateData.seq;
        
        // Если есть разрыв - запрашиваем пропущенные обновления
        if (stateData.seq > oldSeq + 1 && oldSeq > 0) {
          try {
            const updates = await chatAPI.getUserUpdates(oldSeq + 1, 100);
            if (updates?.updates && Array.isArray(updates.updates)) {
              // Применяем глобальные обновления
              // TODO: обработать глобальные обновления
            }
          } catch (error) {
            console.error('[State Sync] Failed to recover global updates:', error);
          }
        }
      }
      
      // Обновляем pts для каждого чата
      if (stateData.chats && Array.isArray(stateData.chats)) {
        for (const chatState of stateData.chats) {
          const chatIdStr = String(chatState.chatId);
          const serverPts = chatState.pts;
          const currentLocalPts = localPtsRef.current.get(chatIdStr) || 0;
          
          // Если есть разрыв - запускаем Gap Recovery
          if (serverPts > currentLocalPts + 1) {
            const gapKey = `${chatIdStr}_${currentLocalPts}`;
            if (!gapRecoveryInProgressRef.current.has(gapKey)) {
              gapRecoveryInProgressRef.current.add(gapKey);
              chatAPI.getChatUpdates(chatState.chatId, currentLocalPts + 1, 100)
                .then((updates) => {
                  if (updates?.updates && Array.isArray(updates.updates)) {
                    // Применяем обновления
                    updates.updates.forEach((update) => {
                      if (update.eventData?.message) {
                        upsertMessage(
                          { ...update.eventData.message, status: MESSAGE_STATUS.SENT, isOptimistic: false },
                          { unreadDelta: 0 }
                        );
                      }
                    });
                    // Обновляем pts
                    if (updates.updates.length > 0) {
                      const lastUpdate = updates.updates[updates.updates.length - 1];
                      localPtsRef.current.set(chatIdStr, lastUpdate.pts);
                    }
                  }
                })
                .catch((error) => {
                  console.error(`[State Sync] Failed to recover updates for chat ${chatIdStr}:`, error);
                })
                .finally(() => {
                  gapRecoveryInProgressRef.current.delete(gapKey);
                });
            }
          } else {
            // Нет разрыва - просто обновляем pts
            localPtsRef.current.set(chatIdStr, serverPts);
          }
        }
      }
    };
    
    window.addEventListener('state-sync', handleStateSync);
    
    return () => {
      window.removeEventListener('state-sync', handleStateSync);
    };
  }, [upsertMessage]);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }
    if (chatId) {
      const chatIdStr = String(chatId);
      const isNewChat = loadedChatIdRef.current !== chatIdStr;
      
      if (isNewChat) {
        // Очищаем выбранный файл при смене чата
        if (selectedFileUrlRef.current) {
          URL.revokeObjectURL(selectedFileUrlRef.current);
          selectedFileUrlRef.current = null;
        }
        setSelectedFile(null);
        
        scrollPositionSavedRef.current = false;
        userScrolledToBottomRef.current = false;
        restoreAttemptsRef.current = 0;
        loadedMessagesRef.current = false;
        loadedPinnedRef.current = false;
        loadedChatIdRef.current = chatIdStr;
        
        // Telegram Web: проверяем, есть ли свежая сохраненная позиция для восстановления
        const saved = typeof window !== 'undefined' 
          ? localStorage.getItem(`chat_scroll_${chatIdStr}`)
          : null;
        
        if (saved) {
          try {
            const { timestamp, isBottom } = JSON.parse(saved);
            const isRecent = Date.now() - timestamp < 10 * 60 * 1000;
            // Восстанавливаем позицию только если сохранение свежее и пользователь НЕ был внизу
            shouldRestorePositionRef.current = isRecent && !isBottom;
          } catch (e) {
            // Если ошибка парсинга - считаем первым открытием
            shouldRestorePositionRef.current = false;
          }
        } else {
          // Нет сохраненной позиции - это первое открытие, всегда вниз
          shouldRestorePositionRef.current = false;
        }
        
        if (!chat) {
          setLoading(true);
          loadChat();
        } else {
          setLoading(false);
        }
        isLoadingInitialRef.current = true;
        lastScrollTopRef.current = 0;
        isUserScrollingUpRef.current = false;
        
        // Загружаем только если еще не загружали для этого чата
        // Используем новый endpoint для полной загрузки состояния
        if (!loadedMessagesRef.current) {
          loadChatStateFull(chatId);
          loadedMessagesRef.current = true;
        }
        if (!loadedPinnedRef.current) {
          loadPinnedMessages();
          loadedPinnedRef.current = true;
        }
      }
    }
    
    // Очистка при размонтировании
    return () => {
      if (selectedFileUrlRef.current) {
        URL.revokeObjectURL(selectedFileUrlRef.current);
        selectedFileUrlRef.current = null;
      }
    };
    
    if (typeof window !== 'undefined') {
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
  }, [chatId, router, loadChat, loadMessages, loadPinnedMessages, chat]);

  const isAtBottom = useCallback((threshold = 100) => {
    if (!messagesContainerRef.current) return false;
    const container = messagesContainerRef.current;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    return distanceFromBottom <= threshold;
  }, []);

  const saveScrollPosition = useCallback((force = false) => {
    if (!messagesContainerRef.current || !chatId) return;
    const container = messagesContainerRef.current;
    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    const isBottom = isAtBottom(50); // Более строгая проверка для "внизу"
    
    // Находим сообщение, которое ближе всего к верху viewport
    let messageId = null;
    if (!isBottom && container) {
      const containerRect = container.getBoundingClientRect();
      const messages = container.querySelectorAll('[data-message-id]');
      let bestMessage = null;
      let bestDistance = Infinity;
      
      for (const msgEl of messages) {
        const msgRect = msgEl.getBoundingClientRect();
        const msgTop = msgRect.top;
        const msgBottom = msgRect.bottom;
        const containerTop = containerRect.top;
        const containerBottom = containerRect.bottom;
        
        // Проверяем, видно ли сообщение в viewport
        if (msgTop <= containerBottom && msgBottom >= containerTop) {
          // Выбираем сообщение, которое ближе всего к верху viewport
          const distanceFromTop = Math.abs(msgTop - containerTop);
          if (distanceFromTop < bestDistance) {
            bestDistance = distanceFromTop;
            bestMessage = msgEl;
          }
        }
      }
      
      if (bestMessage) {
        messageId = bestMessage.getAttribute('data-message-id');
      }
    }
    
    if (typeof window !== 'undefined') {
      const scrollData = {
        scrollTop,
        scrollHeight,
        isBottom, // Сохраняем, был ли пользователь внизу
        messageId, // Сохраняем ID сообщения для точного восстановления
        timestamp: Date.now()
      };
      
      localStorage.setItem(`chat_scroll_${chatId}`, JSON.stringify(scrollData));
      
      // Если пользователь внизу, помечаем это
      if (isBottom) {
        userScrolledToBottomRef.current = true;
      }
    }
  }, [chatId, isAtBottom]);

  const restoreScrollPosition = useCallback(() => {
    if (!messagesContainerRef.current || !chatId || messages.length === 0) return;
    if (!shouldRestorePositionRef.current) return;
    
    const saved = typeof window !== 'undefined' 
      ? localStorage.getItem(`chat_scroll_${chatId}`)
      : null;
    
    // Если нет сохраненной позиции - это первое открытие чата, скроллим вниз
    if (!saved) {
      if (messagesContainerRef.current) {
        const container = messagesContainerRef.current;
        // Используем 'auto' для мгновенной прокрутки вниз при первом открытии
        container.scrollTo({
          top: container.scrollHeight,
          behavior: 'auto'
        });
        lastScrollTopRef.current = container.scrollHeight;
      }
      scrollPositionSavedRef.current = true;
      shouldRestorePositionRef.current = false;
      userScrolledToBottomRef.current = true;
      isUserScrollingUpRef.current = false;
      return;
    }
    
    // Если есть сохраненная позиция - это возврат/обновление, восстанавливаем позицию
    try {
      const { scrollTop, scrollHeight, isBottom, timestamp, messageId } = JSON.parse(saved);
      const container = messagesContainerRef.current;
      
      // Восстанавливаем только если сохранение было недавно (в течение 10 минут)
      const isRecent = Date.now() - timestamp < 10 * 60 * 1000;
      
      if (!isRecent) {
        // Если сохранение старое, считаем это первым открытием - скроллим вниз
        if (messagesContainerRef.current) {
          const container = messagesContainerRef.current;
          container.scrollTo({
            top: container.scrollHeight,
            behavior: 'auto'
          });
          lastScrollTopRef.current = container.scrollHeight;
        }
        scrollPositionSavedRef.current = true;
        shouldRestorePositionRef.current = false;
        userScrolledToBottomRef.current = true;
        isUserScrollingUpRef.current = false;
        return;
      }
      
      // Если пользователь был внизу, всегда прокручиваем вниз
      if (isBottom) {
        userScrolledToBottomRef.current = true;
        isUserScrollingUpRef.current = false;
        setTimeout(() => {
          if (messagesContainerRef.current) {
            const container = messagesContainerRef.current;
            container.scrollTo({
              top: container.scrollHeight,
              behavior: 'auto'
            });
            lastScrollTopRef.current = container.scrollHeight;
          }
          scrollPositionSavedRef.current = true;
          shouldRestorePositionRef.current = false;
        }, 100);
        return;
      }
      
      // Если есть messageId - пытаемся найти и прокрутить к конкретному сообщению
      if (messageId) {
        const targetMessage = document.querySelector(`[data-message-id="${messageId}"]`);
        if (targetMessage) {
          // Сообщение уже в DOM - прокручиваем к нему
          targetMessage.scrollIntoView({ behavior: 'auto', block: 'center' });
          scrollPositionSavedRef.current = true;
          shouldRestorePositionRef.current = false;
          isUserScrollingUpRef.current = false;
          lastScrollTopRef.current = messagesContainerRef.current.scrollTop;
          return;
        }
      }
      
      // Восстанавливаем позицию скролла
      isRestoringScrollRef.current = true;
      const attemptRestore = () => {
        if (container.scrollHeight >= scrollHeight) {
          requestAnimationFrame(() => {
            if (messagesContainerRef.current) {
              const container = messagesContainerRef.current;
              container.scrollTop = scrollTop;
              scrollPositionSavedRef.current = true;
              shouldRestorePositionRef.current = false;
              restoreAttemptsRef.current = 0;
              lastScrollTopRef.current = scrollTop;
              isUserScrollingUpRef.current = false;
              setTimeout(() => {
                isRestoringScrollRef.current = false;
              }, 300);
            }
          });
        } else {
          // Если контент еще не загружен, пробуем еще раз
          restoreAttemptsRef.current++;
          if (restoreAttemptsRef.current < 5) {
            setTimeout(attemptRestore, 200);
          } else {
            // Если не удалось восстановить за 5 попыток, прокручиваем вниз
            if (messagesContainerRef.current) {
              const container = messagesContainerRef.current;
              container.scrollTo({
                top: container.scrollHeight,
                behavior: 'auto'
              });
              lastScrollTopRef.current = container.scrollHeight;
            }
            scrollPositionSavedRef.current = true;
            shouldRestorePositionRef.current = false;
            isUserScrollingUpRef.current = false;
            isRestoringScrollRef.current = false;
          }
        }
      };
      
      setTimeout(attemptRestore, 100);
    } catch (e) {
      // Игнорируем ошибки парсинга, прокручиваем вниз (первое открытие)
      if (messagesContainerRef.current) {
        const container = messagesContainerRef.current;
        container.scrollTo({
          top: container.scrollHeight,
          behavior: 'auto'
        });
        lastScrollTopRef.current = container.scrollHeight;
      }
      scrollPositionSavedRef.current = true;
      shouldRestorePositionRef.current = false;
      userScrolledToBottomRef.current = true;
      isUserScrollingUpRef.current = false;
    }
  }, [chatId, messages.length]);

  useEffect(() => {
    // Telegram Web: восстанавливаем позицию только после полной загрузки и если не была первая загрузка
    if (
      messages.length > 0 && 
      !scrollPositionSavedRef.current && 
      shouldRestorePositionRef.current &&
      !isLoadingInitialRef.current // Не восстанавливаем во время первой загрузки
    ) {
      restoreScrollPosition();
    }
  }, [messages, restoreScrollPosition, isLoadingInitialRef]);

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
        requestAnimationFrame(() => {
          setTimeout(() => {
            // Двойная проверка перед прокруткой
            if (isAtBottom(150)) {
              scrollToBottom();
              userScrolledToBottomRef.current = true;
            } else {
              userScrolledToBottomRef.current = false;
            }
            wasAtBottomBeforeMessageRef.current = false;
            shouldAutoScrollRef.current = false;
          }, 100);
        });
      } else {
        // Если пользователь не был внизу, не прокручиваем
        userScrolledToBottomRef.current = false;
      }
    } else {
      // Если высота не изменилась или это первая загрузка, проверяем текущую позицию
      const isNearBottom = isAtBottom(100);
      if (isNearBottom && (wasAtBottomBeforeMessageRef.current || shouldAutoScrollRef.current)) {
        requestAnimationFrame(() => {
          setTimeout(() => {
            if (isAtBottom(150)) {
              scrollToBottom();
              userScrolledToBottomRef.current = true;
            }
            wasAtBottomBeforeMessageRef.current = false;
            shouldAutoScrollRef.current = false;
          }, 100);
        });
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


  const handleDeleteMessage = useCallback((message) => {
    if (!message?.id || !chatId) return;
    setContextMenu(null);
    setDeleteConfirm({ message });
  }, [chatId]);

  const handleConfirmDelete = useCallback(async () => {
    const messageIds = deleteConfirm?.messageIds || (deleteConfirm?.message?.id ? [deleteConfirm.message.id] : null);
    if (!messageIds || messageIds.length === 0 || !chatId) return;
    
    const shouldDeleteForAll = deleteForAll;
    const deletedMessageIds = new Set(messageIds.map(id => Number(id)));
    
    // НЕМЕДЛЕННОЕ удаление сообщений из списка - так же, как новые сообщения сразу появляются
    for (const messageId of messageIds) {
      const messageToDelete = messages.find(m => Number(m.id) === Number(messageId));
      if (messageToDelete) {
        const canDeleteForAll = messageToDelete.senderId === user?.id;
        const deletedForMe = shouldDeleteForAll && canDeleteForAll ? false : true;
        const deletedForAll = shouldDeleteForAll && canDeleteForAll ? true : false;
        // Удаляем сообщение из списка напрямую - так же, как новые сообщения добавляются
        removeMessage(chatId, messageId, deletedForMe, deletedForAll);
      }
    }
    
    setPinnedMessages(prev => {
      const filtered = prev.filter(p => {
        const pMsgId = p.message?.id;
        return !pMsgId || !deletedMessageIds.has(Number(pMsgId));
      });
      return filtered;
    });
    
    if (viewedPinnedMessageId && deletedMessageIds.has(Number(viewedPinnedMessageId))) {
      setViewedPinnedMessageId(null);
    }
    
    setDeleteConfirm(null);
    setDeleteForAll(false);
    
    if (selectionMode) {
      exitSelectionMode();
    }
    
    try {
      for (const messageId of messageIds) {
        const message = messages.find(m => Number(m.id) === Number(messageId));
        const canDeleteForAll = message?.senderId === user?.id;
        if (shouldDeleteForAll && canDeleteForAll) {
          await chatAPI.deleteMessageForAll(chatId, messageId);
        } else {
          await chatAPI.deleteMessageForMe(chatId, messageId);
        }
      }
      if (selectionMode) {
        exitSelectionMode();
      }
    } catch (error) {
      console.error('Error deleting messages:', error);
      for (const messageId of messageIds) {
        const messageToDelete = messages.find(m => Number(m.id) === Number(messageId));
        if (messageToDelete) {
          const canDeleteForAll = messageToDelete.senderId === user?.id;
          if (shouldDeleteForAll && canDeleteForAll) {
            updateMessage({ ...messageToDelete, deletedForAll: false }, { unreadDelta: 0 });
          } else {
            updateMessage({ ...messageToDelete, deletedForMe: false }, { unreadDelta: 0 });
          }
        }
      }
      loadPinnedMessages();
    }
  }, [chatId, deleteConfirm, deleteForAll, messages, updateMessage, viewedPinnedMessageId, loadPinnedMessages, user]);

  const handleEditMessage = useCallback((message) => {
    setEditingMessageId(message.id);
    setEditingContent(message.content || '');
    setContextMenu(null);
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

    const currentMessage = messages.find(m => String(m.id) === String(editingMessageId));
    const originalContent = currentMessage?.content?.trim() || '';
    const newContent = editingContent.trim();
    
    if (originalContent === newContent) {
      setEditingMessageId(null);
      setEditingContent('');
      setNewMessage('');
      return;
    }

    try {
      const editedMessage = await chatAPI.editMessage(chatId, editingMessageId, newContent);
      
      if (currentMessage) {
        const updatedMessage = {
          ...currentMessage,
          content: newContent,
          edited: true,
          editedAt: editedMessage?.editedAt || new Date().toISOString(),
        };
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
        updateMessage({ ...message, isPinned: false }, { unreadDelta: 0 });
        
        await chatAPI.unpinMessage(chatId, message.id);
      } else {
        updateMessage({ ...message, isPinned: true }, { unreadDelta: 0 });
        
        setPinnedMessages(prev => {
          const exists = prev.some(p => {
            const pMsgId = p.message?.id;
            return pMsgId && Number(pMsgId) === Number(message.id);
          });
          if (exists) {
            return prev;
          }
          
          const maxOrderIndex = prev.length > 0 
            ? Math.max(...prev.map(p => p.orderIndex || 0))
            : 0;
          
          const optimisticPinned = {
            id: `temp-${message.id}-${Date.now()}`,
            message: message,
            orderIndex: maxOrderIndex + 1,
          };
          
          const updated = [optimisticPinned, ...prev];
          const sorted = updated.sort((a, b) => (b.orderIndex || 0) - (a.orderIndex || 0));
          setViewedPinnedMessageId(null);
          
          return sorted;
        });
        
        await chatAPI.pinMessage(chatId, message.id);
      }
    } catch (error) {
      console.error('Error pinning/unpinning message:', error);
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
      
      if (viewedPinnedMessageId && Number(viewedPinnedMessageId) === Number(messageId)) {
        setViewedPinnedMessageId(null);
      }
      
      const messageToUpdate = messages.find(m => Number(m.id) === Number(messageId));
      if (messageToUpdate) {
        updateMessage({ ...messageToUpdate, isPinned: false }, { unreadDelta: 0 });
      }
      
      await chatAPI.unpinMessage(chatId, messageId);
    } catch (error) {
      console.error('Error unpinning message:', error);
      loadPinnedMessages();
      alert('Не удалось открепить сообщение');
    }
  }, [chatId, messages, updateMessage, loadPinnedMessages, viewedPinnedMessageId]);

  const handleForwardMessage = useCallback((message) => {
    if (!message?.id || !chatId) return;
    setContextMenu(null);
    setForwardModal({ message, selectedChatId: null, comment: '' });
  }, [chatId]);

  const handleConfirmForward = useCallback(async () => {
    const messageIds = forwardModal?.messageIds || (forwardModal?.message?.id ? [forwardModal.message.id] : null);
    if (!messageIds || messageIds.length === 0 || !forwardModal?.selectedChatId || !chatId) return;
    
    try {
      await chatAPI.forwardMessages(
        forwardModal.selectedChatId,
        chatId,
        messageIds,
        forwardModal.comment || null
      );
      setForwardModal(null);
      if (selectionMode) {
        exitSelectionMode();
      }
    } catch (error) {
      console.error('Error forwarding message:', error);
      alert('Не удалось переслать сообщение');
    }
  }, [forwardModal, chatId, selectionMode, exitSelectionMode]);

  const handleSelectMessage = useCallback((message) => {
    if (!message?.id) return;
    setContextMenu(null);
    handleSelectMessageBase(message);
  }, [handleSelectMessageBase]);

  const handleSelectAll = useCallback(() => {
    handleSelectAllBase(messages);
  }, [handleSelectAllBase, messages]);

  const handleSearch = useCallback(async (query, pageNum = 0) => {
    if (!query.trim() || !chatId) {
      setSearchResults([]);
      setSearchMode(false);
      return;
    }

    setIsSearching(true);
    try {
      // Поиск работает для ВСЕХ сообщений в чате через серверный API,
      // а не только для загруженных на клиенте. API ищет по всей истории чата.
      const response = await chatAPI.searchMessages(chatId, query.trim(), pageNum, 50);
      const results = Array.isArray(response?.content) ? response.content : (Array.isArray(response) ? response : []);
      
      if (pageNum === 0) {
        setSearchResults(results);
      } else {
        setSearchResults(prev => [...prev, ...results]);
      }
      
      setHasMoreSearchResults(response?.totalPages ? pageNum < response.totalPages - 1 : results.length === 50);
      setSearchMode(true);
      setCurrentSearchIndex(-1);
    } catch (error) {
      console.error('Error searching messages:', error);
      alert('Не удалось выполнить поиск');
    } finally {
      setIsSearching(false);
    }
  }, [chatId]);

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchText.trim() && chatId) {
      searchTimeoutRef.current = setTimeout(() => {
        setSearchPage(0);
        handleSearch(searchText, 0);
      }, 300);
    } else {
      setSearchResults([]);
      setSearchMode(false);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchText, chatId, handleSearch]);

  const handleSearchSubmit = useCallback((e) => {
    e.preventDefault();
    if (!searchText.trim()) return;
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    setSearchPage(0);
    handleSearch(searchText, 0);
  }, [searchText, handleSearch]);

  const handleOpenSearch = useCallback(() => {
    setSearchOpen(true);
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
  }, []);

  const handleCloseSearch = useCallback(() => {
    setSearchOpen(false);
    setSearchText('');
    setSearchResults([]);
    setSearchMode(false);
    setCurrentSearchIndex(-1);
  }, []);


  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && searchOpen) {
        handleCloseSearch();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [searchOpen, handleCloseSearch]);

  const handleNavigateToMessage = useCallback(async (messageId) => {
    if (!chatId || !messageId) return;
    
    // Сначала проверяем, загружено ли сообщение уже
    const targetMessage = document.querySelector(`[data-message-id="${messageId}"]`);
    if (targetMessage) {
      // Сообщение уже загружено - просто прокручиваем к нему
      targetMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
      targetMessage.classList.add(styles.messageHighlight);
      setTimeout(() => {
        targetMessage.classList.remove(styles.messageHighlight);
      }, 2000);
      return;
    }

    // Сообщение не загружено - загружаем его и контекст вокруг
    try {
      isRestoringScrollRef.current = true;
      
      // Получаем информацию о сообщении
      const messageData = await chatAPI.getMessage(chatId, messageId);
      if (!messageData || !messageData.createdAt) {
        console.error('Failed to load message data');
        isRestoringScrollRef.current = false;
        return;
      }

      // Загружаем сообщения вокруг нужного сообщения
      // Сначала загружаем само сообщение в контекст
      if ((messageData.type === 'FILE' || messageData.type === 'IMAGE') && messageData.fileUrl && typeof window !== 'undefined') {
        const metadataKey = `file_metadata_${messageData.fileUrl}`;
        if (messageData.fileSize && messageData.fileName && messageData.mimeType) {
          const fileMetadata = { fileSize: messageData.fileSize, fileName: messageData.fileName, mimeType: messageData.mimeType, timestamp: Date.now() };
          localStorage.setItem(metadataKey, JSON.stringify(fileMetadata));
        }
      }
      upsertMessage({ ...messageData, status: MESSAGE_STATUS.SENT, isOptimistic: false }, { unreadDelta: 0 });
      
      // Используем дату сообщения для поиска нужной страницы
      const messageDate = new Date(messageData.createdAt);
      const messageTime = messageDate.getTime();
      
      // Бинарный поиск страницы с нужным сообщением
      // Сначала получаем общее количество страниц
      let firstPageResponse = await chatAPI.getMessages(chatId, { page: 0, size: 50 });
      const totalPages = firstPageResponse?.totalPages || 1;
      
      // Если сообщение на первой странице, загружаем её
      let found = false;
      let targetPage = 0;
      
      // Проверяем первую страницу
      const firstList = Array.isArray(firstPageResponse?.content) ? firstPageResponse.content : [];
      if (firstList.some(m => Number(m.id) === Number(messageId))) {
        found = true;
        targetPage = 0;
      } else if (totalPages > 1) {
        // Бинарный поиск страницы
        let left = 0;
        let right = totalPages - 1;
        
        while (left <= right) {
          const mid = Math.floor((left + right) / 2);
          const response = await chatAPI.getMessages(chatId, { page: mid, size: 50 });
          const list = Array.isArray(response?.content) ? response.content : [];
          
          if (list.length === 0) {
            break;
          }
          
          const firstMessageTime = new Date(list[0].createdAt).getTime();
          const lastMessageTime = new Date(list[list.length - 1].createdAt).getTime();
          
          // Проверяем, есть ли нужное сообщение на этой странице
          if (list.some(m => Number(m.id) === Number(messageId))) {
            found = true;
            targetPage = mid;
            break;
          }
          
          // Определяем направление поиска
          if (messageTime < lastMessageTime) {
            // Сообщение старше - ищем на более поздних страницах
            left = mid + 1;
          } else {
            // Сообщение новее - ищем на более ранних страницах
            right = mid - 1;
          }
        }
      }
      
      if (found) {
        // Загружаем сообщения вокруг найденного (до и после)
        const pagesToLoad = [
          Math.max(0, targetPage - 1), // Предыдущая страница
          targetPage, // Текущая страница
          Math.min(totalPages - 1, targetPage + 1) // Следующая страница
        ];
        
        // Убираем дубликаты
        const uniquePages = [...new Set(pagesToLoad)];
        
        // Загружаем все нужные страницы параллельно
        const loadPromises = uniquePages.map(async (pageNum) => {
          const response = await chatAPI.getMessages(chatId, { page: pageNum, size: 50 });
          const list = Array.isArray(response?.content) ? response.content : [];
          return list;
        });
        
        const allMessages = await Promise.all(loadPromises);
        const flatMessages = allMessages.flat();
        
        // Загружаем все сообщения в контекст
        for (const m of flatMessages) {
          if ((m.type === 'FILE' || m.type === 'IMAGE') && m.fileUrl && typeof window !== 'undefined') {
            const metadataKey = `file_metadata_${m.fileUrl}`;
            if (m.fileSize && m.fileName && m.mimeType) {
              const fileMetadata = { fileSize: m.fileSize, fileName: m.fileName, mimeType: m.mimeType, timestamp: Date.now() };
              localStorage.setItem(metadataKey, JSON.stringify(fileMetadata));
            }
          }
          upsertMessage({ ...m, status: MESSAGE_STATUS.SENT, isOptimistic: false }, { unreadDelta: 0 });
        }
        
        // Ждем обновления DOM и прокручиваем к сообщению
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const targetMessage = document.querySelector(`[data-message-id="${messageId}"]`);
            if (targetMessage) {
              // Моментальная прокрутка без анимации для скорости (как в Telegram)
              targetMessage.scrollIntoView({ behavior: 'auto', block: 'center' });
              targetMessage.classList.add(styles.messageHighlight);
              setTimeout(() => {
                targetMessage.classList.remove(styles.messageHighlight);
              }, 2000);
            }
            isRestoringScrollRef.current = false;
          });
        });
      } else {
        console.error('Message not found in chat history');
        isRestoringScrollRef.current = false;
      }
    } catch (error) {
      console.error('Failed to navigate to message:', error);
      isRestoringScrollRef.current = false;
    }
  }, [chatId, upsertMessage]);

  const handleNextSearchResult = useCallback(() => {
    if (searchResults.length === 0) return;
    const nextIndex = currentSearchIndex < searchResults.length - 1 ? currentSearchIndex + 1 : 0;
    setCurrentSearchIndex(nextIndex);
    handleNavigateToMessage(searchResults[nextIndex].id);
  }, [searchResults, currentSearchIndex, handleNavigateToMessage]);

  const handlePrevSearchResult = useCallback(() => {
    if (searchResults.length === 0) return;
    const prevIndex = currentSearchIndex > 0 ? currentSearchIndex - 1 : searchResults.length - 1;
    setCurrentSearchIndex(prevIndex);
    handleNavigateToMessage(searchResults[prevIndex].id);
  }, [searchResults, currentSearchIndex, handleNavigateToMessage]);

  const handleForwardSelected = useCallback(() => {
    if (selectedMessages.size === 0) return;
    setForwardModal({ 
      messageIds: Array.from(selectedMessages), 
      selectedChatId: null, 
      comment: '' 
    });
  }, [selectedMessages]);

  const handleDeleteSelected = useCallback(() => {
    if (selectedMessages.size === 0) return;
    setDeleteConfirm({ 
      messageIds: Array.from(selectedMessages),
      isMultiple: true 
    });
  }, [selectedMessages]);

  const handlePinSelected = useCallback(async () => {
    if (selectedMessages.size === 0 || !chatId) return;
    try {
      const messageIds = Array.from(selectedMessages);
      const messagesToPin = [];
      
      for (const messageId of messageIds) {
        const message = messages.find(m => Number(m.id) === Number(messageId));
        if (!message) continue;
        
        const isPinnedInList = pinnedMessages.some(p => {
          const pinnedMsgId = p.message?.id;
          return pinnedMsgId && Number(pinnedMsgId) === Number(messageId);
        });
        const isPinned = message.isPinned || isPinnedInList;
        
        if (!isPinned) {
          messagesToPin.push({ messageId, message });
          updateMessage({ ...message, isPinned: true }, { unreadDelta: 0 });
        }
      }
      
      setPinnedMessages(prev => {
        const updated = [...prev];
        const maxOrderIndex = prev.length > 0
          ? Math.max(...prev.map(p => p.orderIndex || 0))
          : 0;
        
        messagesToPin.forEach(({ messageId, message }, index) => {
          const exists = updated.some(p => {
            const pMsgId = p.message?.id;
            return pMsgId && Number(pMsgId) === Number(messageId);
          });
          if (!exists) {
            updated.push({
              id: `temp-${messageId}-${Date.now()}-${index}`,
              message: message,
              orderIndex: maxOrderIndex + index + 1,
            });
          }
        });
        
        return updated.sort((a, b) => (b.orderIndex || 0) - (a.orderIndex || 0));
      });
      
      await Promise.all(messagesToPin.map(({ messageId }) => chatAPI.pinMessage(chatId, messageId)));
      exitSelectionMode();
    } catch (error) {
      console.error('Error pinning messages:', error);
      loadPinnedMessages();
      alert('Не удалось закрепить сообщения');
    }
  }, [selectedMessages, chatId, messages, pinnedMessages, updateMessage, setPinnedMessages, loadPinnedMessages, exitSelectionMode]);

  const handleUnpinSelected = useCallback(async () => {
    if (selectedMessages.size === 0 || !chatId) return;
    try {
      const messageIds = Array.from(selectedMessages);
      const messagesToUnpin = [];
      
      for (const messageId of messageIds) {
        const message = messages.find(m => Number(m.id) === Number(messageId));
        if (!message) continue;
        
        const isPinnedInList = pinnedMessages.some(p => {
          const pinnedMsgId = p.message?.id;
          return pinnedMsgId && Number(pinnedMsgId) === Number(messageId);
        });
        const isPinned = message.isPinned || isPinnedInList;
        
        if (isPinned) {
          messagesToUnpin.push(messageId);
          updateMessage({ ...message, isPinned: false }, { unreadDelta: 0 });
        }
      }
      
      setPinnedMessages(prev => prev.filter(p => {
        const pMsgId = p.message?.id;
        return !pMsgId || !messagesToUnpin.some(id => Number(pMsgId) === Number(id));
      }));
      
      await Promise.all(messagesToUnpin.map(messageId => chatAPI.unpinMessage(chatId, messageId)));
      exitSelectionMode();
    } catch (error) {
      console.error('Error unpinning messages:', error);
      loadPinnedMessages();
      alert('Не удалось открепить сообщения');
    }
  }, [selectedMessages, chatId, messages, pinnedMessages, updateMessage, setPinnedMessages, loadPinnedMessages, exitSelectionMode]);

  const sendMessage = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Если редактируем сообщение
    if (editingMessageId) {
      await handleSaveEdit();
      return;
    }
    
    if ((!newMessage.trim() && !selectedFile) || !user || sending || uploadingFile) return;
    
    const messageText = newMessage.trimEnd();
    
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
    const fileToSend = selectedFile;
    setNewMessage('');
    setReplyingToMessageId(null);
    setReplyingToMessage(null);

    // Если есть выбранный файл, сначала загружаем его, потом отправляем
    if (fileToSend) {
      setUploadingFile(true);
      try {
        const isImage = fileToSend.type.startsWith('image/');
        const uploadResponse = isImage 
          ? await chatAPI.uploadImageFile(chatId, fileToSend)
          : await chatAPI.uploadFile(chatId, fileToSend);
        
        if (!uploadResponse?.fileUrl) {
          throw new Error('Не удалось загрузить файл: fileUrl не получен от сервера');
        }
        
        if (typeof window !== 'undefined') {
          console.log('[Chat] Upload successful, sending message:', {
            fileUrl: uploadResponse.fileUrl,
            type: isImage ? 'IMAGE' : 'FILE',
            content: messageText || '(пусто)',
            chatId
          });
        }
        
        const fileSize = uploadResponse.fileSize || fileToSend.size;
        const mimeType = uploadResponse.mimeType || fileToSend.type;
        const fileName = fileToSend.name;
        
        const result = await sendMessageHook(
          messageText || '', 
          isImage ? 'IMAGE' : 'FILE', 
          uploadResponse.fileUrl, 
          null, 
          null, 
          null, 
          replyToId, 
          fileName,
          fileSize,
          mimeType
        );
        
        if (typeof window !== 'undefined') {
          console.log('[Chat] sendMessageHook result:', result);
        }
        
        // Сохраняем метаданные файла в localStorage для восстановления после перезагрузки
        if (typeof window !== 'undefined' && uploadResponse.fileUrl) {
          const fileMetadata = {
            fileSize,
            fileName,
            mimeType,
            timestamp: Date.now()
          };
          localStorage.setItem(`file_metadata_${uploadResponse.fileUrl}`, JSON.stringify(fileMetadata));
        }
        
        if (result?.serverMessage) {
          const messageId = result.serverMessage.id;
          if (messageId) {
            newMessageIdsRef.current.add(String(messageId));
            setTimeout(() => {
              newMessageIdsRef.current.delete(String(messageId));
            }, 500);
          }
          addOptimistic(chatId, { ...result.serverMessage, status: MESSAGE_STATUS.SENT, isOptimistic: false });
        } else if (result?.optimisticMessage) {
          const messageId = result.optimisticMessage.id;
          if (messageId) {
            newMessageIdsRef.current.add(String(messageId));
            setTimeout(() => {
              newMessageIdsRef.current.delete(String(messageId));
            }, 500);
          }
          addOptimistic(chatId, result.optimisticMessage);
        } else if (result?.success) {
          // Сообщение отправлено через WebSocket, но serverMessage еще не получен
          // Оптимистичное сообщение уже добавлено в очередь, просто очищаем форму
          if (typeof window !== 'undefined') {
            console.log('[Chat] Message sent via WebSocket, waiting for server confirmation');
          }
        } else {
          if (typeof window !== 'undefined') {
            console.error('[Chat] Unexpected result from sendMessageHook:', result);
          }
        }
        
        // Очищаем файл и URL только после успешной отправки
        if (selectedFileUrlRef.current) {
          URL.revokeObjectURL(selectedFileUrlRef.current);
          selectedFileUrlRef.current = null;
        }
        setSelectedFile(null);
      } catch (error) {
        console.error('Error uploading and sending file:', error);
        alert(`Не удалось отправить файл: ${error.message || 'Неизвестная ошибка'}`);
        // Возвращаем файл обратно при ошибке
        setSelectedFile(fileToSend);
        // Восстанавливаем URL для изображений
        if (fileToSend && fileToSend.type.startsWith('image/') && !selectedFileUrlRef.current) {
          selectedFileUrlRef.current = URL.createObjectURL(fileToSend);
        }
      } finally {
        setUploadingFile(false);
      }
      return;
    }

    const result = await sendMessageHook(messageText, 'TEXT', null, null, null, null, replyToId);

    if (result?.serverMessage) {
      const messageId = result.serverMessage.id;
      if (messageId) {
        newMessageIdsRef.current.add(String(messageId));
        setTimeout(() => {
          newMessageIdsRef.current.delete(String(messageId));
        }, 500);
      }
      addOptimistic(chatId, { ...result.serverMessage, status: MESSAGE_STATUS.SENT, isOptimistic: false });
    } else if (result?.optimisticMessage) {
      const messageId = result.optimisticMessage.id;
      if (messageId) {
        newMessageIdsRef.current.add(String(messageId));
        setTimeout(() => {
          newMessageIdsRef.current.delete(String(messageId));
        }, 500);
      }
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

      try {
        const duration = recordingTime > 0 ? recordingTime : null;
        const uploadResponse = await chatAPI.uploadVoiceFile(chatId, audioBlob, duration);
        fileUrl = uploadResponse?.fileUrl;
        finalDuration = uploadResponse?.duration || duration;
      } catch (uploadError) {
        const base64 = await convertToBase64(audioBlob);
        const mimeType = audioBlob.type || 'audio/webm';
        const duration = recordingTime > 0 ? recordingTime : null;
        
        const result = await sendMessageHook(null, 'VOICE', null, base64, mimeType, duration);

        if (result?.serverMessage) {
          const messageId = result.serverMessage.id;
          if (messageId) {
            newMessageIdsRef.current.add(String(messageId));
            setTimeout(() => {
              newMessageIdsRef.current.delete(String(messageId));
            }, 500);
          }
          addOptimistic(chatId, { ...result.serverMessage, status: MESSAGE_STATUS.SENT, isOptimistic: false });
        } else if (result?.optimisticMessage) {
          const messageId = result.optimisticMessage.id;
          if (messageId) {
            newMessageIdsRef.current.add(String(messageId));
            setTimeout(() => {
              newMessageIdsRef.current.delete(String(messageId));
            }, 500);
          }
          addOptimistic(chatId, result.optimisticMessage);
        }

        resetVoice();
        sentAudioBlobRef.current = null;
        return;
      }

      if (!fileUrl) {
        throw new Error('Failed to upload voice file: no fileUrl returned from server');
      }

      const result = await sendMessageHook(null, 'VOICE', fileUrl, null, null, finalDuration);

      if (result?.serverMessage) {
        const messageId = result.serverMessage.id;
        if (messageId) {
          newMessageIdsRef.current.add(String(messageId));
          setTimeout(() => {
            newMessageIdsRef.current.delete(String(messageId));
          }, 500);
        }
        addOptimistic(chatId, { ...result.serverMessage, status: MESSAGE_STATUS.SENT, isOptimistic: false });
      } else if (result?.optimisticMessage) {
        const messageId = result.optimisticMessage.id;
        if (messageId) {
          newMessageIdsRef.current.add(String(messageId));
          setTimeout(() => {
            newMessageIdsRef.current.delete(String(messageId));
          }, 500);
        }
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

  const handleVoiceSend = useCallback(async () => {
    if (!audioBlob || !user) {
      return;
    }
    
    if (sending) {
      return;
    }

    try {
      await handleVoiceSendSimple();
    } catch (error) {
      console.error('[Voice] Failed to send voice message:', error);
      resetVoice();
      sentAudioBlobRef.current = null;
    }
  }, [audioBlob, user, sending, handleVoiceSendSimple, resetVoice]);

  const handleVoiceCancel = () => {
    cancelRecording();
    sentAudioBlobRef.current = null;
  };

  useEffect(() => {
    if (audioBlob && !isRecording && sentAudioBlobRef.current !== audioBlob && !isLocked) {
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

  // Обновляем scrollStateRef при изменении зависимостей
  useEffect(() => {
    scrollStateRef.current = { hasMore, loadingMore, page, oldestMessageId };
  }, [hasMore, loadingMore, page, oldestMessageId]);
  
  const handleScroll = useCallback(() => {
    if (!messagesContainerRef.current) return;
    
    const container = messagesContainerRef.current;
    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;
    
    // Определяем направление прокрутки (только если это не первая загрузка и не автоматический скролл)
    if (!isLoadingInitialRef.current && lastScrollTopRef.current > 0 && !isAutoScrollingRef.current) {
      const scrollDelta = scrollTop - lastScrollTopRef.current;
      // Если прокручиваем вверх (scrollDelta < 0), помечаем это
      if (scrollDelta < -10) { // Небольшой порог, чтобы игнорировать мелкие колебания
        isUserScrollingUpRef.current = true;
      } else if (scrollDelta > 10) { // Прокручиваем вниз
        isUserScrollingUpRef.current = false;
      }
    }
    lastScrollTopRef.current = scrollTop;
    
    // Telegram/WhatsApp подход: предзагрузка через Intersection Observer
    // Загружаем сообщения заранее, когда пользователь близко к верху
    const loadThreshold = 1000; // Предзагрузка за 1000px до верха
    
    // Используем значения из ref для уменьшения зависимостей
    const { hasMore: hasMoreRef, loadingMore: loadingMoreRef, page: pageRef, oldestMessageId: oldestMessageIdRef } = scrollStateRef.current;
    
    if (
      scrollTop > 0 && 
      scrollTop < loadThreshold && 
      hasMoreRef && 
      !loadingMoreRef && 
      !isLoadingInitialRef.current &&
      !isRestoringScrollRef.current &&
      !isAutoScrollingRef.current
    ) {
      // Очищаем предыдущий таймер
      if (loadMoreTimeoutRef.current) {
        clearTimeout(loadMoreTimeoutRef.current);
      }
      // Telegram загружает очень быстро - минимальная задержка
      loadMoreTimeoutRef.current = setTimeout(() => {
        if (messagesContainerRef.current && messagesContainerRef.current.scrollTop < loadThreshold) {
          // Используем курсорную пагинацию если есть oldestMessageId
          if (oldestMessageIdRef) {
            loadOlderMessages(oldestMessageIdRef);
          } else {
            // Fallback на старую логику
            loadMessages(pageRef + 1, true);
          }
        }
      }, 50); // Быстрая загрузка для создания впечатления "всегда загружено"
    }
    
    // Показываем кнопку "вниз" если пользователь не внизу
    const isNearBottom = isAtBottom(100);
    setShowScrollToBottom(!isNearBottom);
    
    if (isNearBottom) {
      userScrolledToBottomRef.current = true;
      isUserScrollingUpRef.current = false;
    } else {
      // Если прокрутил вверх, сбрасываем флаг "внизу"
      userScrolledToBottomRef.current = false;
    }
    
    // Сохраняем позицию с задержкой (debounce)
    isUserScrollingRef.current = true;
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    scrollTimeoutRef.current = setTimeout(() => {
      if (!isRestoringScrollRef.current) {
        saveScrollPosition();
      }
      isUserScrollingRef.current = false;
    }, 500);
  }, [loadOlderMessages, loadMessages, saveScrollPosition, isAtBottom]);
  
  // Throttled версия handleScroll для оптимизации производительности
  const handleScrollThrottled = useMemo(() => {
    return throttle(handleScroll, 100);
  }, [handleScroll]);

  const scrollToBottom = useCallback((immediate = false) => {
    if (messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      const targetScroll = container.scrollHeight;
      
      isAutoScrollingRef.current = true;
      
      if (immediate) {
        container.scrollTop = targetScroll;
        setTimeout(() => {
          isAutoScrollingRef.current = false;
        }, 100);
      } else {
        requestAnimationFrame(() => {
          if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTo({
              top: targetScroll,
              behavior: 'smooth'
            });
            setTimeout(() => {
              isAutoScrollingRef.current = false;
            }, 500);
          }
        });
      }
      
      setShowScrollToBottom(false);
      userScrolledToBottomRef.current = true;
      
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

  const visibleMessages = useMemo(() => {
    return messages.filter(msg => {
      if (!msg || !msg.id) return false;
      const isDeleted = msg.deletedForMe === true || msg.deletedForAll === true;
      return !isDeleted;
    });
  }, [messages]);

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
        {selectionMode ? (() => {
          const selectedMessagesList = Array.from(selectedMessages).map(id => 
            messages.find(m => Number(m.id) === Number(id))
          ).filter(Boolean);
          
          const allPinned = selectedMessagesList.length > 0 && selectedMessagesList.every(msg => {
            const isPinnedInList = pinnedMessages.some(p => {
              const pinnedMsgId = p.message?.id;
              return pinnedMsgId && Number(pinnedMsgId) === Number(msg.id);
            });
            return msg.isPinned || isPinnedInList;
          });
          
          const allUnpinned = selectedMessagesList.length > 0 && selectedMessagesList.every(msg => {
            const isPinnedInList = pinnedMessages.some(p => {
              const pinnedMsgId = p.message?.id;
              return pinnedMsgId && Number(pinnedMsgId) === Number(msg.id);
            });
            return !msg.isPinned && !isPinnedInList;
          });
          
          return (
            <SelectionHeader
              selectedCount={selectedMessages.size}
              onClose={exitSelectionMode}
              onSelectAll={handleSelectAll}
              onForward={handleForwardSelected}
              onPin={handlePinSelected}
              onUnpin={handleUnpinSelected}
              onDelete={handleDeleteSelected}
              canPin={!allPinned}
              canUnpin={!allUnpinned}
            />
          );
        })() : (
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
            <div className={styles.searchWrapper}>
              {!searchOpen ? (
                <button
                  onClick={handleOpenSearch}
                  className={styles.searchToggleButton}
                  title="Поиск сообщений"
                >
                  <Search size={20} />
                </button>
              ) : (
                <div className={styles.searchExpanded}>
                  <form onSubmit={handleSearchSubmit} className={styles.searchFormInline}>
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      placeholder="Поиск сообщений..."
                      className={styles.searchInputInline}
                      autoFocus
                    />
                    {isSearching && (
                      <div className={styles.searchLoadingInline}>
                        <Loader2 size={16} className={styles.spinner} />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={handleCloseSearch}
                      className={styles.searchCloseButtonInline}
                      title="Закрыть"
                    >
                      <X size={18} />
                    </button>
                  </form>
                  {searchMode && searchResults.length > 0 && (
                    <div className={styles.searchResultsDropdown}>
                      <div className={styles.searchResultsInfo}>
                        <span className={styles.searchResultsCount}>
                          {searchResults.length} найдено
                        </span>
                      </div>
                      <div className={styles.searchResultsList}>
                        {searchResults.map((msg, index) => {
                          const isOwn = msg.senderId === user?.id;
                          
                          const getPreviewText = () => {
                            if (!msg.content || !searchText) return msg.content || '';
                            
                            const searchLower = searchText.toLowerCase();
                            const contentLower = msg.content.toLowerCase();
                            const matchIndex = contentLower.indexOf(searchLower);
                            
                            if (matchIndex === -1) {
                              return msg.content.length > 80 ? msg.content.substring(0, 80) + '...' : msg.content;
                            }
                            
                            const contextLength = 40;
                            const start = Math.max(0, matchIndex - contextLength);
                            const end = Math.min(msg.content.length, matchIndex + searchText.length + contextLength);
                            
                            let preview = msg.content.substring(start, end);
                            if (start > 0) preview = '...' + preview;
                            if (end < msg.content.length) preview = preview + '...';
                            
                            return preview;
                          };
                          
                          const previewText = getPreviewText();
                          
                          return (
                            <div
                              key={msg.id}
                              className={styles.searchResultItem}
                              onClick={async () => {
                                await handleNavigateToMessage(msg.id);
                                handleCloseSearch();
                              }}
                            >
                              <div className={styles.searchResultContent}>
                                <div className={styles.searchResultSender}>
                                  {isOwn ? 'Вы' : (msg.senderDisplayName || msg.senderUsername)}
                                </div>
                                <div className={styles.searchResultText}>
                                  {(() => {
                                    if (!msg.content || !searchText) return previewText;
                                    const escapedSearchText = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                                    const regex = new RegExp(`(${escapedSearchText})`, 'gi');
                                    const parts = previewText.split(regex);
                                    return parts.map((part, i) => 
                                      part.toLowerCase() === searchText.toLowerCase() ? (
                                        <mark key={i} className={styles.searchHighlight}>{part}</mark>
                                      ) : (
                                        <span key={i}>{part}</span>
                                      )
                                    );
                                  })()}
                                </div>
                                <div className={styles.searchResultTime}>
                                  {formatChatTime(msg.createdAt)}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        <PinnedMessagesHeader
          pinnedMessages={pinnedMessages}
          viewedPinnedMessageId={viewedPinnedMessageId}
          messages={messages}
          chatId={chatId}
          messagesContainerRef={messagesContainerRef}
          onUnpin={handleUnpinMessage}
          onViewedChange={setViewedPinnedMessageId}
          onNavigateToMessage={handleNavigateToMessage}
        />

      <div
        ref={messagesContainerRef}
        className={styles.messagesContainer}
        onScroll={handleScrollThrottled}
      >
        {loadingMore && (
          <div className={styles.loadingMore}>
            <Loader2 size={16} className={styles.spinner} />
            <span>Загрузка старых сообщений...</span>
          </div>
        )}
        
        {visibleMessages.length === 0 ? (
          <div className={styles.emptyState}>
            <p>Пока нет сообщений</p>
            <p className={styles.emptyHint}>Начните общение!</p>
          </div>
        ) : (
          <div>
            {visibleMessages.map((msg, index) => {
              const isOwn = msg.senderId === user?.id;
              
              return (
                <MessageRow
                  key={msg.id}
                  msg={msg}
                  index={index}
                  visibleMessages={visibleMessages}
                  user={user}
                  isOwn={isOwn}
                  selectionMode={selectionMode}
                  selectedMessages={selectedMessages}
                  toggleMessageSelection={toggleMessageSelection}
                  handleContextMenu={handleContextMenu}
                  getReadMetaForMessage={getReadMetaForMessage}
                  getMessageStatusIcon={getMessageStatusIcon}
                  pinnedMessages={pinnedMessages}
                  searchOpen={searchOpen}
                  searchText={searchText}
                  newMessageIdsRef={newMessageIdsRef}
                  loadedMessageIdsRef={loadedMessageIdsRef}
                  setImageModal={setImageModal}
                  handleNavigateToMessage={handleNavigateToMessage}
                />
              );
            })}
          </div>
        )}
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
                {replyingToMessage.type === 'VOICE' ? '🎤 Голосовое сообщение' : 
                 replyingToMessage.type === 'IMAGE' ? '📷 Фото' :
                 replyingToMessage.type === 'FILE' ? '📎 Файл' :
                 replyingToMessage.content || ''}
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
        {selectedFile && (
          <div className={styles.filePreview}>
            {selectedFile.type.startsWith('image/') ? (
              <div className={styles.imagePreview}>
                <img 
                  src={selectedFileUrlRef.current} 
                  alt={selectedFile.name}
                  className={styles.previewImage}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (selectedFileUrlRef.current) {
                      URL.revokeObjectURL(selectedFileUrlRef.current);
                      selectedFileUrlRef.current = null;
                    }
                    setSelectedFile(null);
                  }}
                  className={styles.removeFileButton}
                  title="Удалить файл"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className={styles.filePreviewInfo}>
                <File size={20} />
                <div className={styles.filePreviewDetails}>
                  <div className={styles.filePreviewName}>
                    {selectedFile.name}
                  </div>
                  <div className={styles.filePreviewSize}>
                    {formatFileSize(selectedFile.size)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedFileUrlRef.current) {
                      URL.revokeObjectURL(selectedFileUrlRef.current);
                      selectedFileUrlRef.current = null;
                    }
                    setSelectedFile(null);
                  }}
                  className={styles.removeFileButton}
                  title="Удалить файл"
                >
                  <X size={16} />
                </button>
              </div>
            )}
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
              <>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={styles.attachButton}
                  title="Прикрепить файл или изображение"
                  disabled={sending || uploadingFile}
                >
                  <Paperclip size={20} />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file || !chatId) return;
                    e.target.value = ''; // Сброс для возможности повторного выбора того же файла
                    
                    // Освобождаем предыдущий URL если был
                    if (selectedFileUrlRef.current) {
                      URL.revokeObjectURL(selectedFileUrlRef.current);
                      selectedFileUrlRef.current = null;
                    }
                    
                    // Создаем URL для превью изображения
                    if (file.type.startsWith('image/')) {
                      selectedFileUrlRef.current = URL.createObjectURL(file);
                    }
                    
                    setSelectedFile(file);
                    // Фокусируемся на поле ввода, чтобы пользователь мог добавить текст
                    setTimeout(() => {
                      messageInputRef.current?.focus();
                    }, 100);
                  }}
                  accept="*/*"
                />
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
              </>
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
        {(newMessage.trim() || editingMessageId || selectedFile) && !isRecording && (
          <button
            type="submit"
            disabled={(!newMessage.trim() && !editingMessageId && !selectedFile) || (!editingContent.trim() && editingMessageId) || sending || isRecording || uploadingFile}
            className={styles.sendButton}
            title={editingMessageId ? "Сохранить изменения" : "Отправить сообщение"}
          >
            {(sending || uploadingFile) ? (
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

      <DeleteConfirmModal
        deleteConfirm={deleteConfirm}
        deleteForAll={deleteForAll}
        messages={messages}
        user={user}
        chat={chat}
        onClose={() => { setDeleteConfirm(null); setDeleteForAll(false); }}
        onConfirm={handleConfirmDelete}
        onDeleteForAllChange={setDeleteForAll}
      />

      <ForwardModal
        forwardModal={forwardModal}
        chats={chats}
        chatId={chatId}
        user={user}
        onClose={() => setForwardModal(null)}
        onConfirm={handleConfirmForward}
        onChatSelect={(chatId) => setForwardModal(prev => ({ ...prev, selectedChatId: chatId }))}
        onCommentChange={(comment) => setForwardModal(prev => ({ ...prev, comment }))}
      />

      {imageModal && (
        <ImageModal
          imageUrl={imageModal.imageUrl}
          fileUrl={imageModal.fileUrl}
          onClose={() => setImageModal(null)}
        />
      )}
    </div>
  );
}
