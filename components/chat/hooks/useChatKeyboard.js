import { useCallback } from 'react';

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

      if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
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
