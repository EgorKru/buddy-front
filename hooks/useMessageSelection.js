import { useState, useCallback } from 'react';

export const useMessageSelection = () => {
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState(new Set());

  const handleSelectMessage = useCallback((message) => {
    if (!message?.id) return;
    setSelectionMode(true);
    setSelectedMessages(new Set([message.id]));
  }, []);

  const toggleMessageSelection = useCallback((messageId) => {
    setSelectedMessages((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }

      if (newSet.size === 0) {
        setSelectionMode(false);
      }

      return newSet;
    });
  }, []);

  const handleSelectAll = useCallback((messages) => {
    const visibleMessages = messages.filter((msg) => {
      return !(msg.deletedForMe === true || msg.deletedForAll === true);
    });
    setSelectedMessages(new Set(visibleMessages.map((msg) => msg.id)));
  }, []);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedMessages(new Set());
  }, []);

  return {
    selectionMode,
    selectedMessages,
    handleSelectMessage,
    toggleMessageSelection,
    handleSelectAll,
    exitSelectionMode,
    setSelectionMode,
  };
};
