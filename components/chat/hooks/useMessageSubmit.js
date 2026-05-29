import { useCallback } from 'react';

/**
 * Возвращает колбэк отправки сообщения (текст, файл(ы) или сохранение редактирования).
 */
export function useMessageSubmit({
  editingMessageId,
  handleSaveEdit,
  newMessage,
  selectedFiles = [],
  user,
  sending,
  uploadingFile,
  replyingToMessageId,
  replyingToMessage,
  setNewMessage,
  messageActions,
  dismissLocalTyping,
  prepareScrollForSending,
  sendFileMessage,
  sendMultipleFileMessages,
  sendTextMessage,
  clearSelectedFiles,
  setSelectedFiles,
  setUploadingFile,
}) {
  const hasFiles = selectedFiles.length > 0;

  return useCallback(
    async (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (editingMessageId) {
        await handleSaveEdit();
        return;
      }

      if ((!newMessage.trim() && !hasFiles) || !user || sending || uploadingFile) return;

      const messageText = newMessage.trimEnd();
      const replyToId = replyingToMessageId;
      const filesToSend = [...selectedFiles];

      dismissLocalTyping?.();

      setNewMessage('');
      prepareScrollForSending();

      if (filesToSend.length > 0) {
        setUploadingFile(true);
        try {
          if (filesToSend.length === 1) {
            await sendFileMessage(filesToSend[0], messageText, replyToId, null, replyingToMessage);
          } else if (sendMultipleFileMessages) {
            await sendMultipleFileMessages(filesToSend, messageText, replyToId, replyingToMessage);
          } else {
            for (let i = 0; i < filesToSend.length; i++) {
              await sendFileMessage(
                filesToSend[i],
                i === 0 ? messageText : '',
                i === 0 ? replyToId : null,
                null,
                i === 0 ? replyingToMessage : null
              );
            }
          }
          clearSelectedFiles();
          messageActions.setReplyingToMessageId?.(null);
          messageActions.setReplyingToMessage?.(null);
        } catch (error) {
          alert(`Не удалось отправить файл: ${error.message || 'Неизвестная ошибка'}`);
          setSelectedFiles(filesToSend);
        } finally {
          setUploadingFile(false);
        }
        return;
      }

      if (messageText) {
        await sendTextMessage(messageText, replyToId, replyingToMessage);
        messageActions.setReplyingToMessageId?.(null);
        messageActions.setReplyingToMessage?.(null);
      }
    },
    [
      editingMessageId,
      handleSaveEdit,
      newMessage,
      hasFiles,
      selectedFiles,
      user,
      sending,
      uploadingFile,
      replyingToMessageId,
      replyingToMessage,
      setNewMessage,
      messageActions,
      dismissLocalTyping,
      prepareScrollForSending,
      sendFileMessage,
      sendMultipleFileMessages,
      sendTextMessage,
      clearSelectedFiles,
      setSelectedFiles,
      setUploadingFile,
    ]
  );
}
