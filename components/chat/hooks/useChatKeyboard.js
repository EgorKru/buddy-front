import { useCallback } from 'react';

export const useChatKeyboard = ({
  editingMessageId,
  sending,
  isRecording,
  editingContent,
  newMessage,
  selectedFiles = [],
  handleSaveEdit,
  handleCancelEdit,
  sendMessage,
}) => {
  const hasFiles = selectedFiles.length > 0;

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
          if (!sending && !isRecording && (newMessage.trim() || hasFiles)) {
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
      hasFiles,
      handleSaveEdit,
      handleCancelEdit,
      sendMessage,
    ]
  );

  return { handleKeyDown };
};
