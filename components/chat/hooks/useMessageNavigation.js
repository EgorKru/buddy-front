import { useCallback } from 'react';
import { chatAPI } from '@/utils/api';
import { MESSAGE_STATUS } from '@/utils/messageQueue';
import { NAVIGATION_TIMEOUT, MESSAGE_PAGE_SIZE } from '../constants/chat';
import styles from '@/styles/chat.module.css';

export const useMessageNavigation = ({
  chatId,
  upsertMessage,
  isRestoringScrollRef
}) => {
  const handleNavigateToMessage = useCallback(async (messageId) => {
    if (!chatId || !messageId) return;

    const targetMessage = document.querySelector(`[data-message-id="${messageId}"]`);
    if (targetMessage) {
      
      targetMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
      targetMessage.classList.add(styles.messageHighlight);
      setTimeout(() => {
        targetMessage.classList.remove(styles.messageHighlight);
      }, NAVIGATION_TIMEOUT);
      return;
    }

    try {
      if (isRestoringScrollRef) {
        isRestoringScrollRef.current = true;
      }

      const messageData = await chatAPI.getMessage(chatId, messageId);
      if (!messageData || !messageData.createdAt) {
        
        if (isRestoringScrollRef) {
          isRestoringScrollRef.current = false;
        }
        return;
      }

      if ((messageData.type === 'FILE' || messageData.type === 'IMAGE') && messageData.fileUrl && typeof window !== 'undefined') {
        const metadataKey = `file_metadata_${messageData.fileUrl}`;
        if (messageData.fileSize && messageData.fileName && messageData.mimeType) {
          const fileMetadata = { 
            fileSize: messageData.fileSize, 
            fileName: messageData.fileName, 
            mimeType: messageData.mimeType, 
            timestamp: Date.now() 
          };
          localStorage.setItem(metadataKey, JSON.stringify(fileMetadata));
        }
      }
      upsertMessage({ ...messageData, status: MESSAGE_STATUS.SENT, isOptimistic: false }, { unreadDelta: 0 });

      const messageDate = new Date(messageData.createdAt);
      const messageTime = messageDate.getTime();

      let firstPageResponse = await chatAPI.getMessages(chatId, { page: 0, size: MESSAGE_PAGE_SIZE });
      const totalPages = firstPageResponse?.totalPages || 1;

      let found = false;
      let targetPage = 0;

      const firstList = Array.isArray(firstPageResponse?.content) ? firstPageResponse.content : [];
      if (firstList.some(m => Number(m.id) === Number(messageId))) {
        found = true;
        targetPage = 0;
      } else if (totalPages > 1) {
        
        let left = 0;
        let right = totalPages - 1;
        
        while (left <= right) {
          const mid = Math.floor((left + right) / 2);
          const response = await chatAPI.getMessages(chatId, { page: mid, size: MESSAGE_PAGE_SIZE });
          const list = Array.isArray(response?.content) ? response.content : [];
          
          if (list.length === 0) {
            break;
          }
          
          const firstMessageTime = new Date(list[0].createdAt).getTime();
          const lastMessageTime = new Date(list[list.length - 1].createdAt).getTime();

          if (list.some(m => Number(m.id) === Number(messageId))) {
            found = true;
            targetPage = mid;
            break;
          }

          if (messageTime < lastMessageTime) {
            
            left = mid + 1;
          } else {
            
            right = mid - 1;
          }
        }
      }
      
      if (found) {
        
        const pagesToLoad = [
          Math.max(0, targetPage - 1), 
          targetPage, 
          Math.min(totalPages - 1, targetPage + 1) 
        ];

        const uniquePages = [...new Set(pagesToLoad)];

        const loadPromises = uniquePages.map(async (pageNum) => {
          const response = await chatAPI.getMessages(chatId, { page: pageNum, size: MESSAGE_PAGE_SIZE });
          const list = Array.isArray(response?.content) ? response.content : [];
          return list;
        });
        
        const allMessages = await Promise.all(loadPromises);
        const flatMessages = allMessages.flat();

        for (const m of flatMessages) {
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

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const targetMessage = document.querySelector(`[data-message-id="${messageId}"]`);
            if (targetMessage) {
              
              targetMessage.scrollIntoView({ behavior: 'auto', block: 'center' });
              targetMessage.classList.add(styles.messageHighlight);
              setTimeout(() => {
                targetMessage.classList.remove(styles.messageHighlight);
              }, NAVIGATION_TIMEOUT);
            }
            if (isRestoringScrollRef) {
              isRestoringScrollRef.current = false;
            }
          });
        });
      } else {
        
        if (isRestoringScrollRef) {
          isRestoringScrollRef.current = false;
        }
      }
    } catch (error) {
      
      if (isRestoringScrollRef) {
        isRestoringScrollRef.current = false;
      }
    }
  }, [chatId, upsertMessage, isRestoringScrollRef]);

  return { handleNavigateToMessage };
};

