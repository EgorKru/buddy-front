import { useCallback, useState } from 'react';
import { chatAPI } from '@/utils/api';
import { getCurrentUser } from '@/utils/api';
import { NOTIFICATION_DISPLAY_DURATION, SEARCH_DEBOUNCE_DELAY } from '../constants/chat';

export const useMessageActions = ({
  chatId,
  directPeerUserId,
  messages,
  pinnedMessages,
  setPinnedMessages,
  updateMessage,
  removeMessage,
  loadPinnedMessages,
  setContextMenu,
  messageInputRef,
  viewedPinnedMessageId,
  setViewedPinnedMessageId,
  selectionMode,
  exitSelectionMode,
  deleteConfirm,
  setDeleteConfirm,
  deleteForAll,
  setDeleteForAll,
  forwardModal,
  setForwardModal,
}) => {
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingContent, setEditingContent] = useState('');
  const [editingWasE2ee, setEditingWasE2ee] = useState(false);
  const [editingOriginalPlain, setEditingOriginalPlain] = useState('');
  const [replyingToMessageId, setReplyingToMessageId] = useState(null);
  const [replyingToMessage, setReplyingToMessage] = useState(null);

  const user = getCurrentUser();

  const handleCopyMessage = useCallback(
    async (message) => {
      if (!message?.content) return;

      let textToCopy = message.content;
      if (Number(message.encryptionVersion) > 0) {
        try {
          const mod = await import('@/shared/lib/e2ee/directTextE2ee');
          if (mod.isE2eeEnabled()) {
            const otherUserId =
              Number(message.senderId) === Number(user?.id)
                ? directPeerUserId
                : Number(message.senderId);
            if (otherUserId) {
              textToCopy = await mod.decryptDirectText(otherUserId, message.content);
            }
          }
        } catch {
          /* оставляем шифртекст */
        }
      }

      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(textToCopy);

          if (typeof window !== 'undefined') {
            const notification = document.createElement('div');
            notification.textContent = 'Текст скопирован';
            notification.style.cssText =
              'position: fixed; top: 20px; right: 20px; background: #10b981; color: white; padding: 12px 20px; border-radius: 8px; z-index: 10000; font-size: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);';
            document.body.appendChild(notification);
            setTimeout(() => {
              notification.style.opacity = '0';
              notification.style.transition = 'opacity 0.3s';
              setTimeout(() => document.body.removeChild(notification), 300);
            }, NOTIFICATION_DISPLAY_DURATION);
          }
        } else {
          const textArea = document.createElement('textarea');
          textArea.value = textToCopy;
          textArea.style.cssText = 'position: fixed; opacity: 0;';
          document.body.appendChild(textArea);
          textArea.select();
          textArea.setSelectionRange(0, 99999);
          document.execCommand('copy');
          document.body.removeChild(textArea);
        }
      } catch (err) {
        alert('Не удалось скопировать текст');
      }
    },
    [user?.id, directPeerUserId]
  );

  const handleDeleteMessage = useCallback(
    (message) => {
      if (!message?.id || !chatId) return;
      setContextMenu(null);
      if (setDeleteConfirm) {
        setDeleteConfirm({ message });
      }
    },
    [chatId, setContextMenu, setDeleteConfirm]
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteConfirm || !chatId) {
      return;
    }

    let messageIds = [];
    if (deleteConfirm.messageIds && Array.isArray(deleteConfirm.messageIds)) {
      messageIds = deleteConfirm.messageIds;
    } else if (deleteConfirm.message?.id) {
      messageIds = [deleteConfirm.message.id];
    }

    if (messageIds.length === 0) {
      return;
    }

    const shouldDeleteForAll = deleteForAll;
    const deletedMessageIds = new Set(messageIds.map((id) => Number(id)));

    for (const messageId of messageIds) {
      const messageToDelete = messages.find((m) => Number(m.id) === Number(messageId));
      if (messageToDelete) {
        const canDeleteForAll = messageToDelete.senderId === user?.id;
        const deletedForMe = shouldDeleteForAll && canDeleteForAll ? false : true;
        const deletedForAll = shouldDeleteForAll && canDeleteForAll ? true : false;
        removeMessage(chatId, messageId, deletedForMe, deletedForAll);
      }
    }

    setPinnedMessages((prev) => {
      return prev.filter((p) => {
        const pMsgId = p.message?.id;
        return !pMsgId || !deletedMessageIds.has(Number(pMsgId));
      });
    });

    if (viewedPinnedMessageId && deletedMessageIds.has(Number(viewedPinnedMessageId))) {
      setViewedPinnedMessageId(null);
    }

    setDeleteConfirm(null);
    setDeleteForAll(false);

    if (selectionMode) {
      exitSelectionMode();
    }

    try {
      for (const messageId of messageIds) {
        const message = messages.find((m) => Number(m.id) === Number(messageId));
        const canDeleteForAll = message?.senderId === user?.id;
        if (shouldDeleteForAll && canDeleteForAll) {
          await chatAPI.deleteMessageForAll(chatId, messageId);
        } else {
          await chatAPI.deleteMessageForMe(chatId, messageId);
        }
      }
      if (selectionMode) {
        exitSelectionMode();
      }
    } catch (error) {
      for (const messageId of messageIds) {
        const messageToDelete = messages.find((m) => Number(m.id) === Number(messageId));
        if (messageToDelete) {
          const canDeleteForAll = messageToDelete.senderId === user?.id;
          if (shouldDeleteForAll && canDeleteForAll) {
            updateMessage({ ...messageToDelete, deletedForAll: false }, { unreadDelta: 0 });
          } else {
            updateMessage({ ...messageToDelete, deletedForMe: false }, { unreadDelta: 0 });
          }
        }
      }
      loadPinnedMessages();
    }
  }, [
    chatId,
    deleteConfirm,
    deleteForAll,
    messages,
    updateMessage,
    removeMessage,
    viewedPinnedMessageId,
    setViewedPinnedMessageId,
    loadPinnedMessages,
    user,
    selectionMode,
    exitSelectionMode,
    setPinnedMessages,
    setDeleteConfirm,
    setDeleteForAll,
  ]);

  const handleEditMessage = useCallback(
    (message) => {
      setEditingMessageId(message.id);
      setContextMenu(null);
      setTimeout(() => {
        messageInputRef.current?.focus();
      }, SEARCH_DEBOUNCE_DELAY);

      const isE2ee = Number(message.encryptionVersion) > 0;
      setEditingWasE2ee(isE2ee);

      if (!isE2ee) {
        const plain = (message.content || '').trim();
        setEditingContent(plain);
        setEditingOriginalPlain(plain);
        return;
      }

      setEditingContent('');
      setEditingOriginalPlain('');

      (async () => {
        try {
          const mod = await import('@/shared/lib/e2ee/directTextE2ee');
          if (!mod.isE2eeEnabled()) {
            setEditingContent('');
            return;
          }
          const otherUserId =
            Number(message.senderId) === Number(user?.id)
              ? directPeerUserId
              : Number(message.senderId);
          if (!otherUserId) {
            setEditingContent('');
            return;
          }
          const plain = await mod.decryptDirectText(otherUserId, message.content);
          setEditingContent(plain);
          setEditingOriginalPlain(plain);
        } catch {
          setEditingContent('');
        }
      })();
    },
    [setContextMenu, messageInputRef, user?.id, directPeerUserId]
  );

  const handleSaveEdit = useCallback(async () => {
    if (!editingMessageId || !chatId) {
      setEditingMessageId(null);
      setEditingContent('');
      setEditingWasE2ee(false);
      setEditingOriginalPlain('');
      return;
    }

    const newPlain = editingContent.trim();
    if (!newPlain) {
      setEditingMessageId(null);
      setEditingContent('');
      setEditingWasE2ee(false);
      setEditingOriginalPlain('');
      return;
    }

    const currentMessage = messages.find((m) => String(m.id) === String(editingMessageId));

    if (editingWasE2ee) {
      if (newPlain === (editingOriginalPlain || '').trim()) {
        setEditingMessageId(null);
        setEditingContent('');
        setEditingWasE2ee(false);
        setEditingOriginalPlain('');
        return;
      }
    } else {
      const originalContent = currentMessage?.content?.trim() || '';
      if (originalContent === newPlain) {
        setEditingMessageId(null);
        setEditingContent('');
        setEditingWasE2ee(false);
        setEditingOriginalPlain('');
        return;
      }
    }

    try {
      let payload = newPlain;
      if (editingWasE2ee) {
        const mod = await import('@/shared/lib/e2ee/directTextE2ee');
        if (!mod.isE2eeEnabled() || !directPeerUserId) {
          alert('E2EE недоступно: включите NEXT_PUBLIC_E2EE_ENABLED или откройте личный чат.');
          return;
        }
        const enc = await mod.encryptDirectText(directPeerUserId, newPlain);
        if (!enc) {
          alert('Не удалось зашифровать текст. Убедитесь, что у собеседника опубликован ключ.');
          return;
        }
        payload = enc.content;
      }

      const editedMessage = await chatAPI.editMessage(chatId, editingMessageId, payload);

      if (currentMessage) {
        const updatedMessage = {
          ...currentMessage,
          content: editingWasE2ee ? payload : newPlain,
          encryptionVersion: editingWasE2ee
            ? (editedMessage?.encryptionVersion ?? currentMessage.encryptionVersion)
            : currentMessage.encryptionVersion,
          edited: true,
          editedAt: editedMessage?.editedAt || new Date().toISOString(),
        };
        updateMessage(updatedMessage, { unreadDelta: 0 });
      }

      setEditingMessageId(null);
      setEditingContent('');
      setEditingWasE2ee(false);
      setEditingOriginalPlain('');
    } catch (error) {
      alert('Не удалось отредактировать сообщение');
    }
  }, [
    editingMessageId,
    chatId,
    editingContent,
    editingWasE2ee,
    editingOriginalPlain,
    messages,
    updateMessage,
    directPeerUserId,
  ]);

  const handleCancelEdit = useCallback(() => {
    setEditingMessageId(null);
    setEditingContent('');
    setEditingWasE2ee(false);
    setEditingOriginalPlain('');
  }, []);

  const handleReplyMessage = useCallback(
    (message) => {
      if (!message?.id) return;
      setReplyingToMessageId(message.id);
      setReplyingToMessage(message);
      setContextMenu(null);
      setTimeout(() => {
        messageInputRef.current?.focus();
      }, SEARCH_DEBOUNCE_DELAY);
    },
    [setContextMenu, messageInputRef]
  );

  const handleCancelReply = useCallback(() => {
    setReplyingToMessageId(null);
    setReplyingToMessage(null);
  }, []);

  const handlePinMessage = useCallback(
    async (message) => {
      if (!message?.id || !chatId) return;
      setContextMenu(null);

      const isCurrentlyPinned = pinnedMessages.some((p) => {
        const pinnedMsgId = p.message?.id;
        return pinnedMsgId && Number(pinnedMsgId) === Number(message.id);
      });

      try {
        if (isCurrentlyPinned) {
          const messageIdToUnpin = Number(message.id);
          setPinnedMessages((prev) =>
            prev.filter((p) => {
              const pMsgId = p.message?.id;
              return !pMsgId || Number(pMsgId) !== messageIdToUnpin;
            })
          );
          updateMessage({ ...message, isPinned: false }, { unreadDelta: 0 });

          await chatAPI.unpinMessage(chatId, message.id);
        } else {
          updateMessage({ ...message, isPinned: true }, { unreadDelta: 0 });
          await chatAPI.pinMessage(chatId, message.id);
          loadPinnedMessages();
        }
      } catch (error) {
        if (isCurrentlyPinned) {
          loadPinnedMessages();
          updateMessage({ ...message, isPinned: true }, { unreadDelta: 0 });
        } else {
          updateMessage({ ...message, isPinned: false }, { unreadDelta: 0 });
        }
      }
    },
    [chatId, pinnedMessages, setPinnedMessages, updateMessage, loadPinnedMessages, setContextMenu]
  );

  const handleUnpinMessage = useCallback(
    async (pinnedMessage) => {
      if (!pinnedMessage?.message?.id || !chatId) return;
      const messageId = pinnedMessage.message.id;

      try {
        const messageIdToUnpin = Number(messageId);
        setPinnedMessages((prev) =>
          prev.filter((p) => {
            const pMsgId = p.message?.id;
            return !pMsgId || Number(pMsgId) !== messageIdToUnpin;
          })
        );

        if (viewedPinnedMessageId && Number(viewedPinnedMessageId) === Number(messageId)) {
          setViewedPinnedMessageId(null);
        }

        const messageToUpdate = messages.find((m) => Number(m.id) === Number(messageId));
        if (messageToUpdate) {
          updateMessage({ ...messageToUpdate, isPinned: false }, { unreadDelta: 0 });
        }

        await chatAPI.unpinMessage(chatId, messageId);
      } catch (error) {
        loadPinnedMessages();
        alert('Не удалось открепить сообщение');
      }
    },
    [
      chatId,
      messages,
      updateMessage,
      loadPinnedMessages,
      setPinnedMessages,
      viewedPinnedMessageId,
      setViewedPinnedMessageId,
    ]
  );

  const handleForwardMessage = useCallback(
    (message) => {
      if (!message?.id) return;
      setContextMenu(null);
      setForwardModal({
        message,
        selectedChatId: null,
        comment: '',
      });
    },
    [setContextMenu, setForwardModal]
  );

  const handleConfirmForward = useCallback(async () => {
    if (!forwardModal || !forwardModal.selectedChatId) return;

    try {
      const toChatId = forwardModal.selectedChatId;
      const comment = forwardModal.comment || null;

      if (forwardModal.message) {
        const messageId = forwardModal.message.id;
        await chatAPI.forwardMessage(chatId, toChatId, [messageId], comment);
      } else if (forwardModal.messageIds && forwardModal.messageIds.length > 0) {
        await chatAPI.forwardMessage(chatId, toChatId, forwardModal.messageIds, comment);
      } else {
        throw new Error('Нет сообщений для пересылки');
      }

      setForwardModal(null);
    } catch (error) {
      alert('Не удалось переслать сообщение');
    }
  }, [forwardModal, chatId, setForwardModal]);

  return {
    editingMessageId,
    editingContent,
    replyingToMessageId,
    replyingToMessage,

    setEditingContent,
    setReplyingToMessageId,
    setReplyingToMessage,

    handleCopyMessage,
    handleDeleteMessage,
    handleConfirmDelete,
    handleEditMessage,
    handleSaveEdit,
    handleCancelEdit,
    handleReplyMessage,
    handleCancelReply,
    handlePinMessage,
    handleUnpinMessage,
    handleForwardMessage,
    handleConfirmForward,
  };
};
