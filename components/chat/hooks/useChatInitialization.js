import { useState, useEffect, useRef } from 'react';
import { SCROLL_RESTORE_TIMEOUT, INITIALIZATION_CHECK_DELAY, INITIALIZATION_CHECK_RETRY_DELAY } from '../constants/chat';

/**
 * Хук для инициализации чата
 * Обрабатывает логику загрузки чата, проверку аутентификации, инициализацию состояния
 */
export const useChatInitialization = ({
  chatId,
  router,
  isAuthenticated,
  refreshChats,
  loadChatStateFull,
  loadPinnedMessages,
  chat,
  clearSelectedFile,
  // Refs из других хуков
  scrollPositionSavedRef,
  userScrolledToBottomRef,
  restoreAttemptsRef,
  shouldRestorePositionRef,
  lastScrollTopRef,
  isUserScrollingUpRef,
  isLoadingInitialRef
}) => {
  const [scrollButtonReady, setScrollButtonReady] = useState(false);
  
  // Refs для отслеживания загрузки
  const loadedChatIdRef = useRef(null);
  const loadedMessagesRef = useRef(false);
  const loadedPinnedRef = useRef(false);

  useEffect(() => {
    // Проверка аутентификации
    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }

    if (chatId) {
      const chatIdStr = String(chatId);
      const isNewChat = loadedChatIdRef.current !== chatIdStr;

      // Telegram Web: при переходе между чатами (включая возврат) всегда скроллим вниз
      if (isNewChat) {
        // Очищаем выбранный файл при смене чата
        clearSelectedFile();

        // Сбрасываем состояние скролла
        scrollPositionSavedRef.current = false;
        userScrolledToBottomRef.current = false;
        restoreAttemptsRef.current = 0;
        loadedMessagesRef.current = false;
        loadedPinnedRef.current = false;
        loadedChatIdRef.current = chatIdStr;

        // Всегда скроллим вниз при переходе между чатами (без восстановления позиции)
        shouldRestorePositionRef.current = false;

        if (!chat) {
          // Обновляем список чатов если чата нет
          refreshChats();
        }

        // Инициализируем состояние загрузки
        isLoadingInitialRef.current = true;
        lastScrollTopRef.current = 0;
        isUserScrollingUpRef.current = false;

        // Загружаем только если еще не загружали для этого чата
        // Используем новый endpoint для полной загрузки состояния
        if (!loadedMessagesRef.current) {
          loadedMessagesRef.current = true;
          loadChatStateFull(chatId).finally(() => {
            if (loadedChatIdRef.current !== chatIdStr) {
              loadedMessagesRef.current = false;
            }
          });
        }
        if (!loadedPinnedRef.current) {
          loadedPinnedRef.current = true;
          loadPinnedMessages();
        }
      } else {
        // Возврат в уже открытый чат - всегда скроллим вниз
        scrollPositionSavedRef.current = false;
        userScrolledToBottomRef.current = false;
        shouldRestorePositionRef.current = false;
        isLoadingInitialRef.current = true;
        lastScrollTopRef.current = 0;
        isUserScrollingUpRef.current = false;
      }
    }

    // Проверка готовности sidebar для правильного позиционирования кнопки скролла
    if (typeof window !== 'undefined') {
      const checkReady = () => {
        const sidebarWidth = getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width');
        if (sidebarWidth || document.body.hasAttribute('data-sidebar-position')) {
          setScrollButtonReady(true);
        } else {
          setTimeout(checkReady, INITIALIZATION_CHECK_DELAY);
        }
      };
      setTimeout(checkReady, INITIALIZATION_CHECK_RETRY_DELAY);
    }

    // Очистка при размонтировании
    return () => {
      clearSelectedFile();
    };
  }, [
    chatId,
    router,
    isAuthenticated,
    refreshChats,
    loadChatStateFull,
    loadPinnedMessages,
    chat,
    clearSelectedFile,
    scrollPositionSavedRef,
    userScrolledToBottomRef,
    restoreAttemptsRef,
    shouldRestorePositionRef,
    lastScrollTopRef,
    isUserScrollingUpRef,
    isLoadingInitialRef
  ]);

  return {
    scrollButtonReady,
    loadedChatIdRef,
    loadedMessagesRef,
    loadedPinnedRef
  };
};

