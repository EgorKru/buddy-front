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
  messagesContainerRef
}) => {
  const sendTextMessage = useCallback(async (content, replyToId = null) => {
    if (!content?.trim() || !user || !chatId) return null;

    const result = await sendMessageHook(content.trim(), 'TEXT', null, null, null, null, replyToId);

    if (result?.serverMessage) {
      const messageId = result.serverMessage.id;
      if (messageId) {
        newMessageIdsRef.current.add(String(messageId));
        setTimeout(() => {
          newMessageIdsRef.current.delete(String(messageId));
        }, NEW_MESSAGE_ID_REMOVE_DELAY);
      }
      addOptimistic(chatId, { ...result.serverMessage, status: MESSAGE_STATUS.SENT, isOptimistic: false });
    } else if (result?.optimisticMessage) {
      const messageId = result.optimisticMessage.id;
      if (messageId) {
        newMessageIdsRef.current.add(String(messageId));
        setTimeout(() => {
          newMessageIdsRef.current.delete(String(messageId));
        }, NEW_MESSAGE_ID_REMOVE_DELAY);
      }
      addOptimistic(chatId, result.optimisticMessage);
    } else if (result?.success) {
      if (typeof window !== 'undefined') {
        console.log('[Chat] Message sent via WebSocket, waiting for server confirmation');
      }
    } else {
      if (typeof window !== 'undefined') {
        console.error('[Chat] Unexpected result from sendMessageHook:', result);
      }
    }

    return result;
  }, [chatId, user, sendMessageHook, addOptimistic, newMessageIdsRef]);

  const sendFileMessage = useCallback(async (file, content = '', replyToId = null, onProgress = null) => {
    if (!file || !user || !chatId) return null;

    try {
      const isImage = file.type.startsWith('image/');
      const uploadResponse = isImage
        ? await chatAPI.uploadImageFile(chatId, file, onProgress)
        : await chatAPI.uploadFile(chatId, file, onProgress);

      if (!uploadResponse?.fileUrl) {
        throw new Error('Не удалось загрузить файл: fileUrl не получен от сервера');
      }

      if (typeof window !== 'undefined') {
        console.log('[Chat] Upload successful, sending message:', {
          fileUrl: uploadResponse.fileUrl,
          type: isImage ? 'IMAGE' : 'FILE',
          content: content || '(пусто)',
          chatId
        });
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
        mimeType
      );

      if (typeof window !== 'undefined') {
        console.log('[Chat] sendMessageHook result:', result);
      }

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
        if (typeof window !== 'undefined') {
          console.log('[Chat] Message sent via WebSocket, waiting for server confirmation');
        }
      } else {
        if (typeof window !== 'undefined') {
          console.error('[Chat] Unexpected result from sendMessageHook:', result);
        }
      }

      return { result, uploadResponse };
    } catch (error) {
      console.error('Error uploading and sending file:', error);
      throw error;
    }
  }, [chatId, user, sendMessageHook, addOptimistic, newMessageIdsRef]);

  const prepareScrollForSending = useCallback(() => {
    if (messagesContainerRef?.current) {
      scrollHeightBeforeMessageRef.current = messagesContainerRef.current.scrollHeight;
      const wasAtBottom = checkIsAtBottom(CHECK_BOTTOM_DEFAULT_THRESHOLD);
      wasAtBottomBeforeMessageRef.current = wasAtBottom;
      shouldAutoScrollRef.current = wasAtBottom;
    }
    saveScrollPosition();
  }, [messagesContainerRef, scrollHeightBeforeMessageRef, checkIsAtBottom, wasAtBottomBeforeMessageRef, shouldAutoScrollRef, saveScrollPosition]);

  const sendMessage = useCallback(async (e, messageData = null) => {
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
  }, [
    checkIsAtBottom,
    saveScrollPosition,
    scrollHeightBeforeMessageRef,
    wasAtBottomBeforeMessageRef,
    shouldAutoScrollRef,
    messagesContainerRef,
    sendTextMessage,
    sendFileMessage
  ]);

  return {
    sendTextMessage,
    sendFileMessage,
    prepareScrollForSending
  };
};

