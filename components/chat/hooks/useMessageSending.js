import { useCallback } from 'react';
import { NEW_MESSAGE_ID_REMOVE_DELAY, CHECK_BOTTOM_DEFAULT_THRESHOLD } from '../constants/chat';
import { chatAPI } from '@/utils/api';
import { MESSAGE_STATUS } from '@/utils/messageQueue';

export const useMessageSending = ({
  chatId,
  user,
  sendMessageHook,
  addOptimistic,
  checkIsAtBottom,
  saveScrollPosition,
  scrollHeightBeforeMessageRef,
  wasAtBottomBeforeMessageRef,
  shouldAutoScrollRef,
  newMessageIdsRef,
  messagesContainerRef,
}) => {
  const sendTextMessage = useCallback(
    async (content, replyToId = null, replyToMessage = null) => {
      if (!content?.trim() || !user || !chatId) return null;

      const result = await sendMessageHook(
        content.trim(),
        'TEXT',
        null,
        null,
        null,
        null,
        replyToId,
        null,
        null,
        null,
        replyToMessage
      );

      if (result?.serverMessage) {
        const messageId = result.serverMessage.id;
        if (messageId) {
          newMessageIdsRef.current.add(String(messageId));
          setTimeout(() => {
            newMessageIdsRef.current.delete(String(messageId));
          }, NEW_MESSAGE_ID_REMOVE_DELAY);
        }
        addOptimistic(chatId, {
          ...result.serverMessage,
          status: MESSAGE_STATUS.SENT,
          isOptimistic: false,
        });
      } else if (result?.optimisticMessage) {
        const messageId = result.optimisticMessage.id;
        if (messageId) {
          newMessageIdsRef.current.add(String(messageId));
          setTimeout(() => {
            newMessageIdsRef.current.delete(String(messageId));
          }, NEW_MESSAGE_ID_REMOVE_DELAY);
        }
        addOptimistic(chatId, result.optimisticMessage);
      }

      return result;
    },
    [chatId, user, sendMessageHook, addOptimistic, newMessageIdsRef]
  );

  const sendFileMessage = useCallback(
    async (file, content = '', replyToId = null, onProgress = null, replyToMessage = null) => {
      if (!file || !user || !chatId) return null;

      try {
        const isImage = file.type.startsWith('image/');
        const uploadResponse = isImage
          ? await chatAPI.uploadImageFile(chatId, file, onProgress)
          : await chatAPI.uploadFile(chatId, file, onProgress);

        if (!uploadResponse?.fileUrl) {
          throw new Error('Не удалось загрузить файл: fileUrl не получен от сервера');
        }

        const fileSize = uploadResponse.fileSize || file.size;
        const mimeType = uploadResponse.mimeType || file.type;
        const fileName = file.name;

        const result = await sendMessageHook(
          content || '',
          isImage ? 'IMAGE' : 'FILE',
          uploadResponse.fileUrl,
          null,
          null,
          null,
          replyToId,
          fileName,
          fileSize,
          mimeType,
          replyToMessage
        );

        if (typeof window !== 'undefined' && uploadResponse.fileUrl) {
          const fileMetadata = {
            fileSize,
            fileName,
            mimeType,
            timestamp: Date.now(),
          };
          localStorage.setItem(
            `file_metadata_${uploadResponse.fileUrl}`,
            JSON.stringify(fileMetadata)
          );
        }

        if (result?.serverMessage) {
          const messageId = result.serverMessage.id;
          if (messageId) {
            newMessageIdsRef.current.add(String(messageId));
            setTimeout(() => {
              newMessageIdsRef.current.delete(String(messageId));
            }, 500);
          }
          addOptimistic(chatId, {
            ...result.serverMessage,
            status: MESSAGE_STATUS.SENT,
            isOptimistic: false,
          });
        } else if (result?.optimisticMessage) {
          const messageId = result.optimisticMessage.id;
          if (messageId) {
            newMessageIdsRef.current.add(String(messageId));
            setTimeout(() => {
              newMessageIdsRef.current.delete(String(messageId));
            }, 500);
          }
          addOptimistic(chatId, result.optimisticMessage);
        } else if (result?.success && result?.optimisticMessage) {
          const messageId = result.optimisticMessage.id;
          if (messageId) {
            newMessageIdsRef.current.add(String(messageId));
            setTimeout(() => {
              newMessageIdsRef.current.delete(String(messageId));
            }, 500);
          }
          addOptimistic(chatId, result.optimisticMessage);
        }

        return { result, uploadResponse };
      } catch (error) {
        throw error;
      }
    },
    [chatId, user, sendMessageHook, addOptimistic, newMessageIdsRef]
  );

  const sendMultipleFileMessages = useCallback(
    async (files, content = '', replyToId = null, replyToMessage = null) => {
      if (!files?.length || !user || !chatId) return [];

      const results = [];
      for (let i = 0; i < files.length; i++) {
        const caption = i === 0 ? content : '';
        const result = await sendFileMessage(
          files[i],
          caption,
          i === 0 ? replyToId : null,
          null,
          i === 0 ? replyToMessage : null
        );
        results.push(result);
      }
      return results;
    },
    [chatId, user, sendFileMessage]
  );

  const prepareScrollForSending = useCallback(() => {
    if (messagesContainerRef?.current) {
      scrollHeightBeforeMessageRef.current = messagesContainerRef.current.scrollHeight;
      const wasAtBottom = checkIsAtBottom(CHECK_BOTTOM_DEFAULT_THRESHOLD);
      wasAtBottomBeforeMessageRef.current = wasAtBottom;
      shouldAutoScrollRef.current = wasAtBottom;
    }
    saveScrollPosition();
  }, [
    messagesContainerRef,
    scrollHeightBeforeMessageRef,
    checkIsAtBottom,
    wasAtBottomBeforeMessageRef,
    shouldAutoScrollRef,
    saveScrollPosition,
  ]);

  const _sendMessage = useCallback(
    async (e, messageData = null) => {
      e?.preventDefault();
      e?.stopPropagation();

      if (messagesContainerRef?.current) {
        scrollHeightBeforeMessageRef.current = messagesContainerRef.current.scrollHeight;
        const wasAtBottom = checkIsAtBottom(CHECK_BOTTOM_DEFAULT_THRESHOLD);
        wasAtBottomBeforeMessageRef.current = wasAtBottom;
        shouldAutoScrollRef.current = wasAtBottom;
      }

      saveScrollPosition();

      if (messageData) {
        const { content, file, replyToId, onProgress } = messageData;

        if (file) {
          return await sendFileMessage(file, content, replyToId, onProgress);
        } else if (content) {
          return await sendTextMessage(content, replyToId);
        }
      }

      return { sendTextMessage, sendFileMessage };
    },
    [
      checkIsAtBottom,
      saveScrollPosition,
      scrollHeightBeforeMessageRef,
      wasAtBottomBeforeMessageRef,
      shouldAutoScrollRef,
      messagesContainerRef,
      sendTextMessage,
      sendFileMessage,
    ]
  );

  return {
    sendTextMessage,
    sendFileMessage,
    sendMultipleFileMessages,
    prepareScrollForSending,
  };
};
