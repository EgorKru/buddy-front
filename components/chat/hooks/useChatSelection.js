import { useCallback } from 'react';

export const useChatSelection = ({
  selectionMode,
  selectedMessages,
  handleSelectMessageBase,
  toggleMessageSelection,
  handleSelectAllBase,
  exitSelectionMode,
  messages,
  setContextMenu,
}) => {
  const handleSelectMessage = useCallback(
    (message) => {
      if (!message?.id) return;
      setContextMenu(null);
      handleSelectMessageBase(message);
    },
    [handleSelectMessageBase, setContextMenu]
  );

  const handleSelectAll = useCallback(() => {
    handleSelectAllBase(messages);
  }, [handleSelectAllBase, messages]);

  return {
    selectionMode,
    selectedMessages,
    handleSelectMessage,
    toggleMessageSelection,
    handleSelectAll,
    exitSelectionMode,
  };
};
