import { useCallback } from 'react';
import { chatAPI } from '@/utils/api';

export const useBulkMessageActions = ({
  chatId,
  messages,
  pinnedMessages,
  updateMessage,
  setPinnedMessages,
  loadPinnedMessages,
  exitSelectionMode,
  setDeleteConfirm,
  setForwardModal,
}) => {
  const handlePinSelected = useCallback(
    async (selectedMessages) => {
      if (selectedMessages.size === 0 || !chatId) return;
      try {
        const messageIds = Array.from(selectedMessages);
        const messagesToPin = [];

        for (const messageId of messageIds) {
          const message = messages.find((m) => Number(m.id) === Number(messageId));
          if (!message) continue;

          const isPinnedInList = pinnedMessages.some((p) => {
            const pinnedMsgId = p.message?.id;
            return pinnedMsgId && Number(pinnedMsgId) === Number(messageId);
          });
          const isPinned = message.isPinned || isPinnedInList;

          if (!isPinned) {
            messagesToPin.push({ messageId, message });
            updateMessage({ ...message, isPinned: true }, { unreadDelta: 0 });
          }
        }

        setPinnedMessages((prev) => {
          const updated = [...prev];
          const maxOrderIndex =
            prev.length > 0 ? Math.max(...prev.map((p) => p.orderIndex || 0)) : 0;

          messagesToPin.forEach(({ messageId, message }, index) => {
            const exists = updated.some((p) => {
              const pMsgId = p.message?.id;
              return pMsgId && Number(pMsgId) === Number(messageId);
            });
            if (!exists) {
              updated.push({
                id: `temp-${messageId}-${Date.now()}-${index}`,
                message: message,
                orderIndex: maxOrderIndex + index + 1,
              });
            }
          });

          return updated.sort((a, b) => (b.orderIndex || 0) - (a.orderIndex || 0));
        });

        await Promise.all(
          messagesToPin.map(({ messageId }) => chatAPI.pinMessage(chatId, messageId))
        );
        exitSelectionMode();
      } catch (error) {
        loadPinnedMessages();
        alert('Не удалось закрепить сообщения');
      }
    },
    [
      chatId,
      messages,
      pinnedMessages,
      updateMessage,
      setPinnedMessages,
      loadPinnedMessages,
      exitSelectionMode,
    ]
  );

  const handleUnpinSelected = useCallback(
    async (selectedMessages) => {
      if (selectedMessages.size === 0 || !chatId) return;
      try {
        const messageIds = Array.from(selectedMessages);
        const messagesToUnpin = [];

        for (const messageId of messageIds) {
          const message = messages.find((m) => Number(m.id) === Number(messageId));
          if (!message) continue;

          const isPinnedInList = pinnedMessages.some((p) => {
            const pinnedMsgId = p.message?.id;
            return pinnedMsgId && Number(pinnedMsgId) === Number(messageId);
          });
          const isPinned = message.isPinned || isPinnedInList;

          if (isPinned) {
            messagesToUnpin.push(messageId);
            updateMessage({ ...message, isPinned: false }, { unreadDelta: 0 });
          }
        }

        setPinnedMessages((prev) =>
          prev.filter((p) => {
            const pMsgId = p.message?.id;
            return !pMsgId || !messagesToUnpin.some((id) => Number(pMsgId) === Number(id));
          })
        );

        await Promise.all(
          messagesToUnpin.map((messageId) => chatAPI.unpinMessage(chatId, messageId))
        );
        exitSelectionMode();
      } catch (error) {
        loadPinnedMessages();
        alert('Не удалось открепить сообщения');
      }
    },
    [
      chatId,
      messages,
      pinnedMessages,
      updateMessage,
      setPinnedMessages,
      loadPinnedMessages,
      exitSelectionMode,
    ]
  );

  const handleDeleteSelected = useCallback(
    (selectedMessages) => {
      if (selectedMessages.size === 0) return;
      setDeleteConfirm({
        messageIds: Array.from(selectedMessages),
        isMultiple: true,
      });
    },
    [setDeleteConfirm]
  );

  const handleForwardSelected = useCallback(
    (selectedMessages) => {
      if (selectedMessages.size === 0) return;
      setForwardModal({
        messageIds: Array.from(selectedMessages),
        selectedChatId: null,
        comment: '',
      });
    },
    [setForwardModal]
  );

  return {
    handlePinSelected,
    handleUnpinSelected,
    handleDeleteSelected,
    handleForwardSelected,
  };
};
