import { useCallback } from 'react';
import { isEnterToSendEnabled } from '@/features/preferences';

export const useChatKeyboard = ({
  editingMessageId,
  sending,
  isRecording,
  editingContent,
  newMessage,
  selectedFile,
  handleSaveEdit,
  handleCancelEdit,
  sendMessage,
}) => {
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape' && editingMessageId) {
        e.preventDefault();
        handleCancelEdit();
        return;
      }

      const enterToSend = isEnterToSendEnabled();
      const isSendShortcut =
        e.key === 'Enter' &&
        (enterToSend
          ? !e.shiftKey && !e.ctrlKey && !e.metaKey
          : !e.shiftKey && (e.ctrlKey || e.metaKey));

      if (isSendShortcut) {
        e.preventDefault();
        if (editingMessageId) {
          if (!sending && !isRecording && editingContent.trim()) {
            handleSaveEdit();
          }
        } else {
          if (!sending && !isRecording && (newMessage.trim() || selectedFile)) {
            sendMessage(e);
          }
        }
      }
    },
    [
      editingMessageId,
      sending,
      isRecording,
      editingContent,
      newMessage,
      selectedFile,
      handleSaveEdit,
      handleCancelEdit,
      sendMessage,
    ]
  );

  return { handleKeyDown };
};
