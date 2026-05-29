import { useCallback } from 'react';

/**
 * Возвращает колбэк отправки сообщения (текст, файл или сохранение редактирования).
 */
export function useMessageSubmit({
  editingMessageId,
  handleSaveEdit,
  newMessage,
  selectedFile,
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
  sendTextMessage,
  clearSelectedFile,
  setSelectedFile,
  setUploadingFile,
  selectedFileUrlRef,
}) {
  return useCallback(
    async (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (editingMessageId) {
        await handleSaveEdit();
        return;
      }

      if ((!newMessage.trim() && !selectedFile) || !user || sending || uploadingFile) return;

      const messageText = newMessage.trimEnd();
      const replyToId = replyingToMessageId;
      const fileToSend = selectedFile;

      dismissLocalTyping?.();

      setNewMessage('');
      prepareScrollForSending();

      if (fileToSend) {
        setUploadingFile(true);
        try {
          await sendFileMessage(fileToSend, messageText, replyToId, null, replyingToMessage);
          clearSelectedFile();
          messageActions.setReplyingToMessageId?.(null);
          messageActions.setReplyingToMessage?.(null);
        } catch (error) {
          alert(`Не удалось отправить файл: ${error.message || 'Неизвестная ошибка'}`);
          setSelectedFile(fileToSend);
          if (fileToSend.type?.startsWith('image/') && !selectedFileUrlRef?.current) {
            selectedFileUrlRef.current = URL.createObjectURL(fileToSend);
          }
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
      selectedFile,
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
      sendTextMessage,
      clearSelectedFile,
      setSelectedFile,
      setUploadingFile,
      selectedFileUrlRef,
    ]
  );
}
