import { useEffect, useRef, useCallback } from 'react';
import { chatAPI } from '@/utils/api';

const needsLastMessage = (chat) => {
  const hasLastMessage = !!chat.lastMessage;
  const hasIdAndDate = hasLastMessage && chat.lastMessage.id && chat.lastMessage.createdAt;
  const hasTextForTextMessage =
    !hasLastMessage ||
    chat.lastMessage.type !== 'TEXT' ||
    (typeof chat.lastMessage.content === 'string' && chat.lastMessage.content.trim().length > 0);

  return !hasLastMessage || !hasIdAndDate || !hasTextForTextMessage;
};

const processFileMetadata = (lastMessage) => {
  if ((lastMessage.type === 'FILE' || lastMessage.type === 'IMAGE') && lastMessage.fileUrl && typeof window !== 'undefined') {
    const metadataKey = `file_metadata_${lastMessage.fileUrl}`;
    
    if (lastMessage.fileSize && lastMessage.fileName && lastMessage.mimeType) {
      const fileMetadata = {
        fileSize: lastMessage.fileSize,
        fileName: lastMessage.fileName,
        mimeType: lastMessage.mimeType,
        timestamp: Date.now()
      };
      localStorage.setItem(metadataKey, JSON.stringify(fileMetadata));
    } else {
      const savedMetadata = localStorage.getItem(metadataKey);
      if (savedMetadata) {
        try {
          const metadata = JSON.parse(savedMetadata);
          if (!lastMessage.fileSize && metadata.fileSize) {
            lastMessage.fileSize = metadata.fileSize;
          }
          if (!lastMessage.fileName && metadata.fileName) {
            lastMessage.fileName = metadata.fileName;
          }
          if (!lastMessage.mimeType && metadata.mimeType) {
            lastMessage.mimeType = metadata.mimeType;
          }
        } catch (e) {
        }
      }
    }
  }
};

export const useLastMessagesLoader = (chats, loading, currentChatId, upsertMessage, upsertChat, refreshChats) => {
  const loadingLastMessagesRef = useRef(new Set());
  const hasLoadedLastMessagesRef = useRef(false);

  useEffect(() => {
    hasLoadedLastMessagesRef.current = false;
    loadingLastMessagesRef.current.clear();
    refreshChats();
  }, [refreshChats]);

  const loadLastMessages = useCallback(async () => {
    if (!chats || chats.length === 0 || loading) return;
    
    const chatsToLoad = chats.filter(chat => {
      const chatId = String(chat.id);
      if (currentChatId && String(currentChatId) === chatId) return false;
      if (loadingLastMessagesRef.current.has(chatId)) return false;
      return needsLastMessage(chat);
    });

    if (chatsToLoad.length === 0) {
      hasLoadedLastMessagesRef.current = true;
      return;
    }

    const promises = chatsToLoad.map(async (chat) => {
      const chatId = String(chat.id);
      
      if (currentChatId && String(currentChatId) === chatId) {
        return;
      }
      
      if (loadingLastMessagesRef.current.has(chatId)) return;
      
      loadingLastMessagesRef.current.add(chatId);
      try {
        const response = await chatAPI.getMessages(chatId, { page: 0, size: 20 });
        if (response?.content && Array.isArray(response.content) && response.content.length > 0) {
          const nonDeleted = response.content.find(
            (m) => !m.deletedForMe && !m.deletedForAll
          );

          if (!nonDeleted) {
            return;
          }

          const lastMessage = nonDeleted;
          processFileMetadata(lastMessage);
          
          if (upsertMessage) {
            upsertMessage({
              ...lastMessage,
              status: 'SENT',
              isOptimistic: false,
              deletedForMe: lastMessage.deletedForMe || false,
              deletedForAll: lastMessage.deletedForAll || false,
            }, { unreadDelta: 0 });
          }
          
          if (upsertChat) {
            upsertChat({
              id: chat.id,
              lastMessage: lastMessage,
              updatedAt: lastMessage.createdAt,
            });
          }
        }
      } catch (error) {
      } finally {
        loadingLastMessagesRef.current.delete(chatId);
      }
    });

    await Promise.all(promises);
    
    setTimeout(() => {
      const currentChats = chats;
      if (currentChats && currentChats.length > 0) {
        const stillMissing = currentChats.filter(needsLastMessage);
        if (stillMissing.length === 0) {
          hasLoadedLastMessagesRef.current = true;
        }
      }
    }, 200);
  }, [chats, loading, currentChatId, upsertMessage, upsertChat]);

  useEffect(() => {
    if (!loading && chats && chats.length > 0) {
      const chatsWithoutLastMessage = chats.filter(needsLastMessage);

      if (chatsWithoutLastMessage.length > 0 && !hasLoadedLastMessagesRef.current) {
        loadLastMessages();
      } else if (chatsWithoutLastMessage.length === 0) {
        hasLoadedLastMessagesRef.current = true;
      }
    }
  }, [loading, chats, loadLastMessages]);

  return { loadLastMessages };
};

