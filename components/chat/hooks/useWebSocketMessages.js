import { useEffect } from 'react';
import { NEW_MESSAGE_TIME_WINDOW, NEW_MESSAGE_ID_REMOVE_DELAY } from '../constants/chat';

export const useWebSocketMessages = ({ upsertMessage, newMessageIdsRef }) => {
  useEffect(() => {
    const handleNewMessageFromWebSocket = (message) => {
      if (!message?.id) return;
      const messageTime = new Date(message.createdAt || Date.now()).getTime();
      const now = Date.now();
      if (now - messageTime < NEW_MESSAGE_TIME_WINDOW) {
        const messageId = String(message.id);
        newMessageIdsRef.current.add(messageId);
        setTimeout(() => {
          newMessageIdsRef.current.delete(messageId);
        }, NEW_MESSAGE_ID_REMOVE_DELAY);
      }
    };

    const originalUpsertMessage = upsertMessage;
    const wrappedUpsertMessage = (message, meta) => {
      if (message?.id && !message.isOptimistic) {
        handleNewMessageFromWebSocket(message);
      }
      return originalUpsertMessage(message, meta);
    };

    return () => {
      newMessageIdsRef.current.clear();
    };
  }, [upsertMessage, newMessageIdsRef]);
};

