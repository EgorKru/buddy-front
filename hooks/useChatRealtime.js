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
  } = useChats();

  const topicSubRef = useRef(null);
  const voiceTopicSubRef = useRef(null);
  const lastMarkedReadRef = useRef(null);
  const markReadTimeoutRef = useRef(null);
  const loadingInitialRef = useRef(false);
  const lastLoadedChatIdRef = useRef(null);

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
      const response = await chatAPI.getMessages(chatId, { page: 0, size: 50 });
      const list = Array.isArray(response?.content) ? response.content : [];
      const ordered = [...list].reverse();
      for (const m of ordered) {
        // Fallback: Восстанавливаем метаданные файла из localStorage для старых сообщений
        // (новые сообщения уже содержат fileSize, fileName, mimeType от сервера)
        if ((m.type === 'FILE' || m.type === 'IMAGE') && m.fileUrl && typeof window !== 'undefined') {
          if (!m.fileSize || !m.fileName || !m.mimeType) {
            const metadataKey = `file_metadata_${m.fileUrl}`;
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

        if (data.eventType === 'MESSAGE_EDITED') {
          const editedMessage = data.message;
          if (!editedMessage) return;
          if (Number(editedMessage.chatId) !== Number(chatId)) return;

          updateMessage(
            { ...editedMessage, status: MESSAGE_STATUS.SENT, isOptimistic: false },
            { unreadDelta: 0 }
          );
          return;
        }

        const dto = data;
        if (Number(dto.chatId) !== Number(chatId)) return;

        const currentUser = getCurrentUser();
        const isOwn = currentUser?.id && dto?.senderId && Number(currentUser.id) === Number(dto.senderId);
        
        if (isOwn) {
          const messageTime = new Date(dto.createdAt || Date.now()).getTime();
          const now = Date.now();
          if (now - messageTime < 2000) {
            return;
          }
        }

        // Fallback: Восстанавливаем метаданные файла из localStorage для старых сообщений
        // (новые сообщения уже содержат fileSize, fileName, mimeType от сервера)
        if ((dto.type === 'FILE' || dto.type === 'IMAGE') && dto.fileUrl && typeof window !== 'undefined') {
          if (!dto.fileSize || !dto.fileName || !dto.mimeType) {
            const metadataKey = `file_metadata_${dto.fileUrl}`;
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


