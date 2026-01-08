import { useCallback, useState } from 'react';
import { chatAPI } from '@/utils/api';
import { getCurrentUser } from '@/utils/api';
import { NOTIFICATION_DISPLAY_DURATION, SEARCH_DEBOUNCE_DELAY } from '../constants/chat';

/**
 * Хук для действий с сообщениями (edit, delete, pin, forward, reply)
 */
export const useMessageActions = ({
  chatId,
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
  setForwardModal
}) => {
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingContent, setEditingContent] = useState('');
  const [replyingToMessageId, setReplyingToMessageId] = useState(null);
  const [replyingToMessage, setReplyingToMessage] = useState(null);
  
  const user = getCurrentUser();

  /**
   * Копирование сообщения в буфер обмена
   */
  const handleCopyMessage = useCallback(async (message) => {
    if (!message?.content) return;
    
    const textToCopy = message.content;
    
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(textToCopy);
        
        // Визуальная обратная связь
        if (typeof window !== 'undefined') {
          const notification = document.createElement('div');
          notification.textContent = 'Текст скопирован';
          notification.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #10b981; color: white; padding: 12px 20px; border-radius: 8px; z-index: 10000; font-size: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);';
          document.body.appendChild(notification);
          setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transition = 'opacity 0.3s';
            setTimeout(() => document.body.removeChild(notification), 300);
          }, NOTIFICATION_DISPLAY_DURATION);
        }
      } else {
        // Fallback для старых браузеров
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
      console.error('Failed to copy text:', err);
      alert('Не удалось скопировать текст');
    }
  }, []);

  /**
   * Удаление сообщения
   */
  const handleDeleteMessage = useCallback((message) => {
    if (!message?.id || !chatId) return;
    setContextMenu(null);
    if (setDeleteConfirm) {
      setDeleteConfirm({ message });
    }
  }, [chatId, setContextMenu, setDeleteConfirm]);

  /**
   * Подтверждение удаления
   */
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
    const deletedMessageIds = new Set(messageIds.map(id => Number(id)));
    
    // Немедленное удаление из списка
    for (const messageId of messageIds) {
      const messageToDelete = messages.find(m => Number(m.id) === Number(messageId));
      if (messageToDelete) {
        const canDeleteForAll = messageToDelete.senderId === user?.id;
        const deletedForMe = shouldDeleteForAll && canDeleteForAll ? false : true;
        const deletedForAll = shouldDeleteForAll && canDeleteForAll ? true : false;
        removeMessage(chatId, messageId, deletedForMe, deletedForAll);
      }
    }
    
    // Обновляем закрепленные сообщения
    setPinnedMessages(prev => {
      return prev.filter(p => {
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
        const message = messages.find(m => Number(m.id) === Number(messageId));
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
      console.error('Error deleting messages:', error);
      // Откатываем изменения при ошибке
      for (const messageId of messageIds) {
        const messageToDelete = messages.find(m => Number(m.id) === Number(messageId));
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
  }, [chatId, deleteConfirm, deleteForAll, messages, updateMessage, removeMessage, viewedPinnedMessageId, setViewedPinnedMessageId, loadPinnedMessages, user, selectionMode, exitSelectionMode, setPinnedMessages]);

  /**
   * Редактирование сообщения
   */
  const handleEditMessage = useCallback((message) => {
    setEditingMessageId(message.id);
    setEditingContent(message.content || '');
    setContextMenu(null);
    setTimeout(() => {
      messageInputRef.current?.focus();
    }, SEARCH_DEBOUNCE_DELAY);
  }, [setContextMenu]);

  /**
   * Сохранение редактирования
   */
  const handleSaveEdit = useCallback(async () => {
    if (!editingMessageId || !chatId || !editingContent.trim()) {
      setEditingMessageId(null);
      setEditingContent('');
      return;
    }

    const currentMessage = messages.find(m => String(m.id) === String(editingMessageId));
    const originalContent = currentMessage?.content?.trim() || '';
    const newContent = editingContent.trim();
    
    if (originalContent === newContent) {
      setEditingMessageId(null);
      setEditingContent('');
      return;
    }

    try {
      const editedMessage = await chatAPI.editMessage(chatId, editingMessageId, newContent);
      
      if (currentMessage) {
        const updatedMessage = {
          ...currentMessage,
          content: newContent,
          edited: true,
          editedAt: editedMessage?.editedAt || new Date().toISOString(),
        };
        updateMessage(updatedMessage, { unreadDelta: 0 });
      }
      
      setEditingMessageId(null);
      setEditingContent('');
    } catch (error) {
      console.error('Error editing message:', error);
      alert('Не удалось отредактировать сообщение');
    }
  }, [editingMessageId, chatId, editingContent, messages, updateMessage]);

  /**
   * Отмена редактирования
   */
  const handleCancelEdit = useCallback(() => {
    setEditingMessageId(null);
    setEditingContent('');
  }, []);

  /**
   * Ответ на сообщение
   */
  const handleReplyMessage = useCallback((message) => {
    if (!message?.id) return;
    setReplyingToMessageId(message.id);
    setReplyingToMessage(message);
    setContextMenu(null);
    setTimeout(() => {
      messageInputRef.current?.focus();
    }, SEARCH_DEBOUNCE_DELAY);
  }, [setContextMenu]);

  /**
   * Отмена ответа
   */
  const handleCancelReply = useCallback(() => {
    setReplyingToMessageId(null);
    setReplyingToMessage(null);
  }, []);

  /**
   * Закрепление/открепление сообщения
   */
  const handlePinMessage = useCallback(async (message) => {
    if (!message?.id || !chatId) return;
    setContextMenu(null);
    
    const isCurrentlyPinned = pinnedMessages.some(p => {
      const pinnedMsgId = p.message?.id;
      return pinnedMsgId && Number(pinnedMsgId) === Number(message.id);
    });
    
    try {
      if (isCurrentlyPinned) {
        // Оптимистичное обновление
        const messageIdToUnpin = Number(message.id);
        setPinnedMessages(prev => prev.filter(p => {
          const pMsgId = p.message?.id;
          return !pMsgId || Number(pMsgId) !== messageIdToUnpin;
        }));
        updateMessage({ ...message, isPinned: false }, { unreadDelta: 0 });
        
        await chatAPI.unpinMessage(chatId, message.id);
      } else {
        updateMessage({ ...message, isPinned: true }, { unreadDelta: 0 });
        await chatAPI.pinMessage(chatId, message.id);
        loadPinnedMessages();
      }
    } catch (error) {
      console.error('Error pinning/unpinning message:', error);
      // Откатываем изменения
      if (isCurrentlyPinned) {
        loadPinnedMessages();
        updateMessage({ ...message, isPinned: true }, { unreadDelta: 0 });
      } else {
        updateMessage({ ...message, isPinned: false }, { unreadDelta: 0 });
      }
    }
  }, [chatId, pinnedMessages, setPinnedMessages, updateMessage, loadPinnedMessages, setContextMenu]);

  /**
   * Открепление сообщения (из PinnedMessagesHeader)
   */
  const handleUnpinMessage = useCallback(async (pinnedMessage) => {
    if (!pinnedMessage?.message?.id || !chatId) return;
    const messageId = pinnedMessage.message.id;
    
    try {
      // Оптимистичное обновление: сразу убираем из списка закрепленных
      const messageIdToUnpin = Number(messageId);
      setPinnedMessages(prev => prev.filter(p => {
        const pMsgId = p.message?.id;
        return !pMsgId || Number(pMsgId) !== messageIdToUnpin;
      }));
      
      if (viewedPinnedMessageId && Number(viewedPinnedMessageId) === Number(messageId)) {
        setViewedPinnedMessageId(null);
      }
      
      const messageToUpdate = messages.find(m => Number(m.id) === Number(messageId));
      if (messageToUpdate) {
        updateMessage({ ...messageToUpdate, isPinned: false }, { unreadDelta: 0 });
      }
      
      await chatAPI.unpinMessage(chatId, messageId);
    } catch (error) {
      console.error('Error unpinning message:', error);
      loadPinnedMessages();
      alert('Не удалось открепить сообщение');
    }
  }, [chatId, messages, updateMessage, loadPinnedMessages, setPinnedMessages, viewedPinnedMessageId, setViewedPinnedMessageId]);

  /**
   * Пересылка сообщения
   */
  const handleForwardMessage = useCallback((message) => {
    if (!message?.id) return;
    setContextMenu(null);
    setForwardModal({ message });
  }, [setContextMenu]);

  /**
   * Подтверждение пересылки
   */
  const handleConfirmForward = useCallback(async (targetChatIds) => {
    if (!forwardModal?.message || !targetChatIds || targetChatIds.length === 0) return;
    
    try {
      await chatAPI.forwardMessage(forwardModal.message.id, targetChatIds);
      setForwardModal(null);
    } catch (error) {
      console.error('Error forwarding message:', error);
      alert('Не удалось переслать сообщение');
    }
  }, [forwardModal]);

  return {
    // Состояние
    editingMessageId,
    editingContent,
    replyingToMessageId,
    replyingToMessage,
    
    // Setters
    setEditingContent,
    
    // Обработчики
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
    handleConfirmForward
  };
};

