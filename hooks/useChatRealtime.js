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
    replaceOptimistic,
    chats,
    messageIdsByChatId,
    messagesById,
    setReadReceiptsForChat,
  } = useChats();

  const topicSubRef = useRef(null);
  const voiceTopicSubRef = useRef(null);
  const lastMarkedReadRef = useRef(null);
  const markReadTimeoutRef = useRef(null);
  const loadingInitialRef = useRef(false);
  const lastLoadedChatIdRef = useRef(null);
  
  const localSeqRef = useRef(0);
  const localPtsRef = useRef(new Map());
  const gapRecoveryInProgressRef = useRef(new Set());

  const handleGapRecovery = useCallback(async (chatId, fromPts, toPts) => {
    try {
      const updates = await chatAPI.getChatUpdates(chatId, fromPts, 100);
      if (!updates?.updates || !Array.isArray(updates.updates)) return;
      
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
              removeMessage(eventData.messageId);
            }
            break;
          case 'MESSAGE_DELETED_FOR_ME':
            if (eventData.messageId) {
              removeMessage(eventData.messageId);
            }
            break;
          case 'MESSAGE_PINNED':
            if (eventData.message) {
              updateMessage(
                { ...eventData.message, status: MESSAGE_STATUS.SENT, isOptimistic: false },
                { unreadDelta: 0 }
              );
            }
            break;
          case 'MESSAGE_UNPINNED':
            if (eventData.message) {
              updateMessage(
                { ...eventData.message, status: MESSAGE_STATUS.SENT, isOptimistic: false },
                { unreadDelta: 0 }
              );
            }
            break;
        }
        
        const chatIdStr = String(chatId);
        localPtsRef.current.set(chatIdStr, update.pts);
      }
    } catch (error) {
      
    }
  }, [upsertMessage, updateMessage, removeMessage]);

  const loadInitial = useCallback(async () => {
    if (!chatId) return;
    const chatIdStr = String(chatId);
    
    if (loadingInitialRef.current && lastLoadedChatIdRef.current === chatIdStr) {
      return;
    }
    
    loadingInitialRef.current = true;
    lastLoadedChatIdRef.current = chatIdStr;
    
    try {
      const chatState = await chatAPI.getChatState(chatId);
      if (chatState?.pts !== undefined) {
        localPtsRef.current.set(chatIdStr, chatState.pts);
      }
      
      if (setReadReceiptsForChat && chatState) {
        const readReceipts = {};
        
        if (chatState.readReceipts && typeof chatState.readReceipts === 'object') {
          for (const [userId, lastReadAt] of Object.entries(chatState.readReceipts)) {
            if (userId && lastReadAt != null) {
              readReceipts[String(userId)] = lastReadAt;
            }
          }
        }
        
        if (chatState.lastReadAt) {
          const currentUser = getCurrentUser();
          if (currentUser?.id) {
            const currentUserId = String(currentUser.id);
            if (!readReceipts[currentUserId] || chatState.lastReadAt > readReceipts[currentUserId]) {
              readReceipts[currentUserId] = chatState.lastReadAt;
            }
          }
        }
        
        if (Object.keys(readReceipts).length > 0) {
          setReadReceiptsForChat(chatId, readReceipts);
        }
      }
      
      const response = await chatAPI.getMessages(chatId, { page: 0, size: 50 });
      const list = Array.isArray(response?.content) ? response.content : [];
      const ordered = [...list].reverse();
      for (const m of ordered) {
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
          } else {
            const savedMetadata = localStorage.getItem(metadataKey);
            if (savedMetadata) {
              try {
                const metadata = JSON.parse(savedMetadata);
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
    
    if (lastMarkedReadRef.current !== chatIdStr) {
      lastMarkedReadRef.current = chatIdStr;
      markChatAsRead(chatId);
    }
    
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

        const receivedPts = data.pts;
        const receivedPtsCount = data.ptsCount || 1;
        const chatIdStr = String(chatId);
        const currentLocalPts = localPtsRef.current.get(chatIdStr) || 0;
        
        if (receivedPts !== undefined && receivedPts > currentLocalPts + receivedPtsCount) {
          const gapKey = `${chatIdStr}_${currentLocalPts}`;
          if (!gapRecoveryInProgressRef.current.has(gapKey)) {
            gapRecoveryInProgressRef.current.add(gapKey);
            handleGapRecovery(chatId, currentLocalPts + 1, receivedPts).finally(() => {
              gapRecoveryInProgressRef.current.delete(gapKey);
            });
          }
        }
        
        if (receivedPts !== undefined) {
          localPtsRef.current.set(chatIdStr, receivedPts);
        }
        
        if (data.seq !== undefined && data.seq > localSeqRef.current) {
          localSeqRef.current = data.seq;
        }

        if (data.eventType === 'MESSAGE_EDITED') {
          const editedMessage = data.message;
          if (!editedMessage) return;
          if (Number(editedMessage.chatId) !== Number(chatId)) return;

          const updatedMessage = { ...editedMessage, status: MESSAGE_STATUS.SENT, isOptimistic: false };
          
          if ((updatedMessage.type === 'FILE' || updatedMessage.type === 'IMAGE') && updatedMessage.fileUrl && typeof window !== 'undefined') {
            const metadataKey = `file_metadata_${updatedMessage.fileUrl}`;
            
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
                }
              }
            } else {
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

        const dto = data;

        if (dto.type === 'SYSTEM') {
          if (Number(dto.chatId) !== Number(chatId)) return;
          
          const isVisible = typeof document !== 'undefined' && document.visibilityState === 'visible';
          upsertMessage(
            { ...dto, status: MESSAGE_STATUS.SENT, isOptimistic: false },
            { unreadDelta: isVisible ? 0 : undefined }
          );
          
          if (isVisible) {
            if (markReadTimeoutRef.current) {
              clearTimeout(markReadTimeoutRef.current);
            }
            markReadTimeoutRef.current = setTimeout(() => {
              markChatAsRead(chatId);
            }, 1000);
          }
          return;
        }
        
        const processMessage = () => {
          if (Number(dto.chatId) !== Number(chatId)) return;

        const currentUser = getCurrentUser();
        const isOwn = currentUser?.id && dto?.senderId && Number(currentUser.id) === Number(dto.senderId);
        
        if (isOwn && dto.id) {
          const cid = String(chatId);
          const messageIds = messageIdsByChatId?.[cid] || [];
          
          let optimisticMessages = messageIds
            .map(id => messagesById?.[String(id)])
            .filter(msg => msg && msg.isOptimistic && msg.tempId && msg.type === dto.type);
          
          if (dto.type === 'FILE' || dto.type === 'IMAGE') {
            if (dto.fileUrl) {
              optimisticMessages = optimisticMessages.filter(msg => msg.fileUrl === dto.fileUrl);
            }
          }
          
          optimisticMessages.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          
          if (optimisticMessages.length > 0) {
            const latestOptimistic = optimisticMessages[0];
            const now = Date.now();
            const optimisticTime = new Date(latestOptimistic.createdAt || Date.now()).getTime();
            const timeDiff = now - optimisticTime;
            
            if (timeDiff < 30000) {
              replaceOptimistic(chatId, latestOptimistic.tempId, dto, MESSAGE_STATUS.SENT);
              return;
            }
          }
          
          return;
        }

        if ((dto.type === 'FILE' || dto.type === 'IMAGE') && dto.fileUrl && typeof window !== 'undefined') {
          const metadataKey = `file_metadata_${dto.fileUrl}`;
          
          if (dto.fileSize && dto.fileName && dto.mimeType) {
            const fileMetadata = {
              fileSize: dto.fileSize,
              fileName: dto.fileName,
              mimeType: dto.mimeType,
              timestamp: Date.now()
            };
            localStorage.setItem(metadataKey, JSON.stringify(fileMetadata));
          } else {
            const savedMetadata = localStorage.getItem(metadataKey);
            if (savedMetadata) {
              try {
                const metadata = JSON.parse(savedMetadata);
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
              }
            }
          }
        }

        const isVisible = typeof document !== 'undefined' && document.visibilityState === 'visible';
        upsertMessage(
          { ...dto, status: MESSAGE_STATUS.SENT, isOptimistic: false },
          { unreadDelta: isVisible ? 0 : undefined }
        );

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
        
        if (typeof window !== 'undefined' && window.requestIdleCallback) {
          window.requestIdleCallback(processMessage, { timeout: 1000 });
        } else {
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
  }, [chatId, client, connected, upsertMessage, updateMessage, markChatAsRead, replaceOptimistic, messageIdsByChatId, messagesById]);
};

