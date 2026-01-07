import { useEffect, useRef, useCallback } from 'react';
import { useStomp } from '@/context/socket';
import { chatAPI, getCurrentUser } from '@/utils/api';
import { safeJsonParse, safeUnsubscribe } from '@/utils/safe';
import { useChats } from '@/context/messaging';
import { MESSAGE_STATUS } from '@/utils/messageQueue';

export const useChatRealtime = (chatId) => {
  const { client, connected } = useStomp();
  const {
    setActiveChatId,
    markChatAsRead,
    upsertMessage,
    updateMessage,
    removeMessage,
  } = useChats();

  const topicSubRef = useRef(null);
  const voiceTopicSubRef = useRef(null);
  const lastMarkedReadRef = useRef(null);
  const markReadTimeoutRef = useRef(null);
  const loadingInitialRef = useRef(false);
  const lastLoadedChatIdRef = useRef(null);
  
  // Telegram-подход: хранение локальных последовательностей
  const localSeqRef = useRef(0); // Глобальная последовательность
  const localPtsRef = useRef(new Map()); // pts для каждого чата: Map<chatId, pts>
  const gapRecoveryInProgressRef = useRef(new Set()); // Защита от множественных Gap Recovery

  // Telegram-подход: Gap Recovery для восстановления пропущенных обновлений
  const handleGapRecovery = useCallback(async (chatId, fromPts, toPts) => {
    try {
      const updates = await chatAPI.getChatUpdates(chatId, fromPts, 100);
      if (!updates?.updates || !Array.isArray(updates.updates)) return;
      
      // Применяем все пропущенные обновления в порядке pts
      const sortedUpdates = updates.updates.sort((a, b) => a.pts - b.pts);
      
      for (const update of sortedUpdates) {
        const eventData = update.eventData;
        if (!eventData) continue;
        
        switch (update.eventType) {
          case 'MESSAGE_NEW':
            if (eventData.message) {
              upsertMessage(
                { ...eventData.message, status: MESSAGE_STATUS.SENT, isOptimistic: false },
                { unreadDelta: 0 }
              );
            }
            break;
          case 'MESSAGE_EDITED':
            if (eventData.message) {
              updateMessage(
                { ...eventData.message, status: MESSAGE_STATUS.SENT, isOptimistic: false },
                { unreadDelta: 0 }
              );
            }
            break;
          case 'MESSAGE_DELETED_FOR_ALL':
            if (eventData.messageId) {
              // Удаление сообщения для всех
              removeMessage(eventData.messageId);
            }
            break;
          case 'MESSAGE_DELETED_FOR_ME':
            if (eventData.messageId) {
              // Удаление сообщения для текущего пользователя
              removeMessage(eventData.messageId);
            }
            break;
          case 'MESSAGE_PINNED':
            if (eventData.message) {
              // Закрепление сообщения - обновляем сообщение
              updateMessage(
                { ...eventData.message, status: MESSAGE_STATUS.SENT, isOptimistic: false },
                { unreadDelta: 0 }
              );
            }
            break;
          case 'MESSAGE_UNPINNED':
            if (eventData.message) {
              // Открепление сообщения - обновляем сообщение
              updateMessage(
                { ...eventData.message, status: MESSAGE_STATUS.SENT, isOptimistic: false },
                { unreadDelta: 0 }
              );
            }
            break;
        }
        
        // Обновляем локальный pts
        const chatIdStr = String(chatId);
        localPtsRef.current.set(chatIdStr, update.pts);
      }
    } catch (error) {
      console.error('[Gap Recovery] Failed to recover updates:', error);
    }
  }, [upsertMessage, updateMessage, removeMessage]);

  const loadInitial = useCallback(async () => {
    if (!chatId) return;
    const chatIdStr = String(chatId);
    
    // Защита от повторных вызовов для того же чата
    if (loadingInitialRef.current && lastLoadedChatIdRef.current === chatIdStr) {
      return;
    }
    
    loadingInitialRef.current = true;
    lastLoadedChatIdRef.current = chatIdStr;
    
    try {
      // Telegram-подход: получаем состояние чата перед загрузкой сообщений
      const chatState = await chatAPI.getChatState(chatId);
      if (chatState?.pts !== undefined) {
        localPtsRef.current.set(chatIdStr, chatState.pts);
      }
      
      const response = await chatAPI.getMessages(chatId, { page: 0, size: 50 });
      const list = Array.isArray(response?.content) ? response.content : [];
      const ordered = [...list].reverse();
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
        upsertMessage({ ...m, status: MESSAGE_STATUS.SENT, isOptimistic: false }, { unreadDelta: 0 });
      }
    } catch (e) {} finally {
      loadingInitialRef.current = false;
    }
  }, [chatId, upsertMessage]);

  useEffect(() => {
    if (!chatId) return;
    const chatIdStr = String(chatId);
    setActiveChatId(chatId);
    
    // Вызываем markChatAsRead только если еще не вызывали для этого чата
    if (lastMarkedReadRef.current !== chatIdStr) {
      lastMarkedReadRef.current = chatIdStr;
      markChatAsRead(chatId);
    }
    
    // loadInitial дублирует loadMessages из основного компонента, убираем
    // loadInitial();
    return () => setActiveChatId(null);
  }, [chatId, setActiveChatId, markChatAsRead]);

  useEffect(() => {
    if (!chatId || !client || !connected || !client.connected || !client.active) {
      if (topicSubRef.current) {
        safeUnsubscribe(topicSubRef.current);
        topicSubRef.current = null;
      }
      if (voiceTopicSubRef.current) {
        safeUnsubscribe(voiceTopicSubRef.current);
        voiceTopicSubRef.current = null;
      }
      return;
    }

    if (topicSubRef.current) {
      safeUnsubscribe(topicSubRef.current);
      topicSubRef.current = null;
    }

    if (voiceTopicSubRef.current) {
      safeUnsubscribe(voiceTopicSubRef.current);
      voiceTopicSubRef.current = null;
    }

    try {
      const sub = client.subscribe(`/topic/chat/${chatId}`, (message) => {
        const data = safeJsonParse(message.body);
        if (!data) return;

        // Telegram-подход: обработка последовательностей
        const receivedPts = data.pts;
        const receivedPtsCount = data.ptsCount || 1;
        const chatIdStr = String(chatId);
        const currentLocalPts = localPtsRef.current.get(chatIdStr) || 0;
        
        // Проверяем разрыв в последовательности (Gap Detection)
        if (receivedPts !== undefined && receivedPts > currentLocalPts + receivedPtsCount) {
          // Обнаружен разрыв - запускаем Gap Recovery
          const gapKey = `${chatIdStr}_${currentLocalPts}`;
          if (!gapRecoveryInProgressRef.current.has(gapKey)) {
            gapRecoveryInProgressRef.current.add(gapKey);
            handleGapRecovery(chatId, currentLocalPts + 1, receivedPts).finally(() => {
              gapRecoveryInProgressRef.current.delete(gapKey);
            });
          }
        }
        
        // Обновляем локальный pts после обработки
        if (receivedPts !== undefined) {
          localPtsRef.current.set(chatIdStr, receivedPts);
        }
        
        // Обновляем глобальный seq
        if (data.seq !== undefined && data.seq > localSeqRef.current) {
          localSeqRef.current = data.seq;
        }

        if (data.eventType === 'MESSAGE_EDITED') {
          const editedMessage = data.message;
          if (!editedMessage) return;
          if (Number(editedMessage.chatId) !== Number(chatId)) return;

          // Обновляем сообщение полностью, включая метаданные файлов
          const updatedMessage = { ...editedMessage, status: MESSAGE_STATUS.SENT, isOptimistic: false };
          
          // Если это файловое сообщение, проверяем и обновляем метаданные
          if ((updatedMessage.type === 'FILE' || updatedMessage.type === 'IMAGE') && updatedMessage.fileUrl && typeof window !== 'undefined') {
            const metadataKey = `file_metadata_${updatedMessage.fileUrl}`;
            
            // Приоритет: данные от сервера > localStorage
            if (!updatedMessage.fileSize || !updatedMessage.fileName || !updatedMessage.mimeType) {
              const savedMetadata = localStorage.getItem(metadataKey);
              if (savedMetadata) {
                try {
                  const metadata = JSON.parse(savedMetadata);
                  if (!updatedMessage.fileSize && metadata.fileSize) {
                    updatedMessage.fileSize = metadata.fileSize;
                  }
                  if (!updatedMessage.fileName && metadata.fileName) {
                    updatedMessage.fileName = metadata.fileName;
                  }
                  if (!updatedMessage.mimeType && metadata.mimeType) {
                    updatedMessage.mimeType = metadata.mimeType;
                  }
                } catch (e) {
                  // Игнорируем ошибки парсинга
                }
              }
            } else {
              // Если метаданные пришли от сервера, обновляем localStorage
              const fileMetadata = {
                fileSize: updatedMessage.fileSize,
                fileName: updatedMessage.fileName,
                mimeType: updatedMessage.mimeType,
                timestamp: Date.now()
              };
              localStorage.setItem(metadataKey, JSON.stringify(fileMetadata));
            }
          }

          updateMessage(updatedMessage, { unreadDelta: 0 });
          return;
        }

        // Обработка других типов событий
        if (data.eventType === 'MESSAGE_DELETED_FOR_ALL' || data.eventType === 'MESSAGE_DELETED_FOR_ME') {
          if (data.messageId) {
            removeMessage(data.messageId);
          }
          return;
        }

        if (data.eventType === 'MESSAGE_PINNED' || data.eventType === 'MESSAGE_UNPINNED') {
          if (data.message) {
            updateMessage(
              { ...data.message, status: MESSAGE_STATUS.SENT, isOptimistic: false },
              { unreadDelta: 0 }
            );
          }
          return;
        }

        // Обработка нового сообщения (MESSAGE_NEW или без eventType для обратной совместимости)
        // Оптимизация: выносим тяжелые операции в requestIdleCallback
        const dto = data;
        
        // Используем requestIdleCallback для неблокирующей обработки
        const processMessage = () => {
          if (Number(dto.chatId) !== Number(chatId)) return;

        const currentUser = getCurrentUser();
        const isOwn = currentUser?.id && dto?.senderId && Number(currentUser.id) === Number(dto.senderId);
        
        // Пропускаем собственные сообщения, которые только что отправили (чтобы избежать дубликатов)
        if (isOwn) {
          const messageTime = new Date(dto.createdAt || Date.now()).getTime();
          const now = Date.now();
          if (now - messageTime < 2000) {
            return;
          }
        }

        // Обработка метаданных файлов: приоритет серверным данным, fallback на localStorage
        if ((dto.type === 'FILE' || dto.type === 'IMAGE') && dto.fileUrl && typeof window !== 'undefined') {
          const metadataKey = `file_metadata_${dto.fileUrl}`;
          
          // Если метаданные пришли от сервера - обновляем localStorage
          if (dto.fileSize && dto.fileName && dto.mimeType) {
            const fileMetadata = {
              fileSize: dto.fileSize,
              fileName: dto.fileName,
              mimeType: dto.mimeType,
              timestamp: Date.now()
            };
            localStorage.setItem(metadataKey, JSON.stringify(fileMetadata));
          } else {
            // Fallback: восстанавливаем из localStorage для старых сообщений
            const savedMetadata = localStorage.getItem(metadataKey);
            if (savedMetadata) {
              try {
                const metadata = JSON.parse(savedMetadata);
                // Используем сохраненные данные только если их нет в сообщении
                if (!dto.fileSize && metadata.fileSize) {
                  dto.fileSize = metadata.fileSize;
                }
                if (!dto.fileName && metadata.fileName) {
                  dto.fileName = metadata.fileName;
                }
                if (!dto.mimeType && metadata.mimeType) {
                  dto.mimeType = metadata.mimeType;
                }
              } catch (e) {
                // Игнорируем ошибки парсинга
              }
            }
          }
        }

        const isVisible = typeof document !== 'undefined' && document.visibilityState === 'visible';
        // upsertMessage автоматически обновит существующее сообщение, если оно уже загружено
        upsertMessage(
          { ...dto, status: MESSAGE_STATUS.SENT, isOptimistic: false },
          { unreadDelta: isVisible ? 0 : undefined }
        );

        // Throttle markChatAsRead - вызываем не чаще раза в 2 секунды
        if (isVisible) {
          if (markReadTimeoutRef.current) {
            clearTimeout(markReadTimeoutRef.current);
          }
          markReadTimeoutRef.current = setTimeout(() => {
            markChatAsRead(chatId);
            markReadTimeoutRef.current = null;
          }, 2000);
        }
        };
        
        // Используем requestIdleCallback с таймаутом для гарантированного выполнения
        if (typeof window !== 'undefined' && window.requestIdleCallback) {
          window.requestIdleCallback(processMessage, { timeout: 1000 });
        } else {
          // Fallback для браузеров без requestIdleCallback
          setTimeout(processMessage, 0);
        }
      });
      topicSubRef.current = sub;
    } catch (e) {}

    if (typeof window !== 'undefined') {
      try {
        const voiceSub = client.subscribe(`/topic/voice/${chatId}`, (message) => {
          const data = safeJsonParse(message.body);
          if (!data) return;
          if (Number(data.chatId) !== Number(chatId)) return;

          if (data.audioData) {
            try {
              const audioBlob = new Blob([
                Uint8Array.from(atob(data.audioData), c => c.charCodeAt(0))
              ], { type: 'audio/webm' });
              
              const audioUrl = URL.createObjectURL(audioBlob);
              const audio = new Audio(audioUrl);
              audio.play().catch(() => {});
              
              audio.onended = () => {
                URL.revokeObjectURL(audioUrl);
              };
            } catch (e) {}
          }
        });
        voiceTopicSubRef.current = voiceSub;
      } catch (e) {}
    }

    return () => {
      if (topicSubRef.current) {
        safeUnsubscribe(topicSubRef.current);
        topicSubRef.current = null;
      }
      if (voiceTopicSubRef.current) {
        safeUnsubscribe(voiceTopicSubRef.current);
        voiceTopicSubRef.current = null;
      }
      if (markReadTimeoutRef.current) {
        clearTimeout(markReadTimeoutRef.current);
        markReadTimeoutRef.current = null;
      }
    };
  }, [chatId, client, connected, upsertMessage, updateMessage, markChatAsRead]);
};


