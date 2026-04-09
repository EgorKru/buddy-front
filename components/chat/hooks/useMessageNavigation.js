import { useCallback } from 'react';
import { chatAPI } from '@/utils/api';
import { MESSAGE_STATUS } from '@/utils/messageQueue';
import { NAVIGATION_TIMEOUT } from '../constants/chat';
import styles from '@/styles/chat.module.css';

export const useMessageNavigation = ({ chatId, upsertMessage, isRestoringScrollRef }) => {
  const handleNavigateToMessage = useCallback(
    async (messageId) => {
      if (!chatId || !messageId) return;

      // Сначала проверяем, не отображается ли сообщение уже
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

        // Используем новый endpoint для получения контекста
        const context = await chatAPI.getMessageContext(chatId, messageId, 20);

        if (!context || !context.message) {
          if (isRestoringScrollRef) {
            isRestoringScrollRef.current = false;
          }
          return;
        }

        // Функция для сохранения метаданных файлов
        const saveFileMetadata = (msg) => {
          if (
            (msg.type === 'FILE' || msg.type === 'IMAGE') &&
            msg.fileUrl &&
            typeof window !== 'undefined'
          ) {
            const metadataKey = `file_metadata_${msg.fileUrl}`;
            if (msg.fileSize && msg.fileName && msg.mimeType) {
              const fileMetadata = {
                fileSize: msg.fileSize,
                fileName: msg.fileName,
                mimeType: msg.mimeType,
                timestamp: Date.now(),
              };
              localStorage.setItem(metadataKey, JSON.stringify(fileMetadata));
            }
          }
        };

        // Сохраняем метаданные для основного сообщения
        saveFileMetadata(context.message);

        // Загружаем все сообщения в правильном порядке:
        // beforeMessages (от новых к старым) -> message -> afterMessages (от старых к новым)
        const allMessages = [];

        // beforeMessages уже в порядке от новых к старым, переворачиваем для правильного порядка
        if (Array.isArray(context.beforeMessages)) {
          const beforeReversed = [...context.beforeMessages].reverse();
          for (const m of beforeReversed) {
            saveFileMetadata(m);
            allMessages.push({ ...m, status: MESSAGE_STATUS.SENT, isOptimistic: false });
          }
        }

        // Основное сообщение
        allMessages.push({ ...context.message, status: MESSAGE_STATUS.SENT, isOptimistic: false });

        // afterMessages уже в порядке от старых к новым
        if (Array.isArray(context.afterMessages)) {
          for (const m of context.afterMessages) {
            saveFileMetadata(m);
            allMessages.push({ ...m, status: MESSAGE_STATUS.SENT, isOptimistic: false });
          }
        }

        // Загружаем все сообщения
        for (const m of allMessages) {
          upsertMessage(m, { unreadDelta: 0 });
        }

        // Прокручиваем к целевому сообщению после загрузки
        // Используем несколько requestAnimationFrame для гарантии, что DOM обновился
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setTimeout(() => {
              const targetMessage = document.querySelector(`[data-message-id="${messageId}"]`);
              if (targetMessage) {
                targetMessage.scrollIntoView({ behavior: 'auto', block: 'center' });
                targetMessage.classList.add(styles.messageHighlight);
                setTimeout(() => {
                  targetMessage.classList.remove(styles.messageHighlight);
                }, NAVIGATION_TIMEOUT);
                console.log('Successfully navigated to message:', messageId);
              } else {
                console.warn('Target message not found after navigation:', messageId);
                // Пробуем еще раз через небольшую задержку
                setTimeout(() => {
                  const retryMessage = document.querySelector(`[data-message-id="${messageId}"]`);
                  if (retryMessage) {
                    retryMessage.scrollIntoView({ behavior: 'auto', block: 'center' });
                    retryMessage.classList.add(styles.messageHighlight);
                    setTimeout(() => {
                      retryMessage.classList.remove(styles.messageHighlight);
                    }, NAVIGATION_TIMEOUT);
                  }
                }, 500);
              }
              if (isRestoringScrollRef) {
                isRestoringScrollRef.current = false;
              }
            }, 100);
          });
        });
      } catch (error) {
        console.error('Error navigating to message:', error);
        if (isRestoringScrollRef) {
          isRestoringScrollRef.current = false;
        }
      }
    },
    [chatId, upsertMessage, isRestoringScrollRef]
  );

  return { handleNavigateToMessage };
};
