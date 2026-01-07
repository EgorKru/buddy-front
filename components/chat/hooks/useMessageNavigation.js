import { useCallback } from 'react';
import { chatAPI } from '@/utils/api';
import { MESSAGE_STATUS } from '@/utils/messageQueue';
import styles from '@/styles/chat.module.css';

/**
 * Хук для навигации к конкретному сообщению в чате
 */
export const useMessageNavigation = ({
  chatId,
  upsertMessage,
  isRestoringScrollRef
}) => {
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
      }, NAVIGATION_TIMEOUT);
      return;
    }

    // Сообщение не загружено - загружаем его и контекст вокруг
    try {
      if (isRestoringScrollRef) {
        isRestoringScrollRef.current = true;
      }
      
      // Получаем информацию о сообщении
      const messageData = await chatAPI.getMessage(chatId, messageId);
      if (!messageData || !messageData.createdAt) {
        console.error('Failed to load message data');
        if (isRestoringScrollRef) {
          isRestoringScrollRef.current = false;
        }
        return;
      }

      // Загружаем сообщения вокруг нужного сообщения
      // Сначала загружаем само сообщение в контекст
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
      
      // Используем дату сообщения для поиска нужной страницы
      const messageDate = new Date(messageData.createdAt);
      const messageTime = messageDate.getTime();
      
      // Бинарный поиск страницы с нужным сообщением
      // Сначала получаем общее количество страниц
      let firstPageResponse = await chatAPI.getMessages(chatId, { page: 0, size: MESSAGE_PAGE_SIZE });
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
          const response = await chatAPI.getMessages(chatId, { page: mid, size: MESSAGE_PAGE_SIZE });
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
          const response = await chatAPI.getMessages(chatId, { page: pageNum, size: MESSAGE_PAGE_SIZE });
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
              }, NAVIGATION_TIMEOUT);
            }
            if (isRestoringScrollRef) {
              isRestoringScrollRef.current = false;
            }
          });
        });
      } else {
        console.error('Message not found in chat history');
        if (isRestoringScrollRef) {
          isRestoringScrollRef.current = false;
        }
      }
    } catch (error) {
      console.error('Failed to navigate to message:', error);
      if (isRestoringScrollRef) {
        isRestoringScrollRef.current = false;
      }
    }
  }, [chatId, upsertMessage, isRestoringScrollRef]);

  return { handleNavigateToMessage };
};

