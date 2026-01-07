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

        // Telegram Web: проверяем, есть ли свежая сохраненная позиция для восстановления
        const saved = typeof window !== 'undefined'
          ? localStorage.getItem(`chat_scroll_${chatIdStr}`)
          : null;

        if (saved) {
          try {
            const { timestamp, isBottom } = JSON.parse(saved);
            const isRecent = Date.now() - timestamp < SCROLL_RESTORE_TIMEOUT;
            // Восстанавливаем позицию только если сохранение свежее и пользователь НЕ был внизу
            shouldRestorePositionRef.current = isRecent && !isBottom;
          } catch (e) {
            // Если ошибка парсинга - считаем первым открытием
            shouldRestorePositionRef.current = false;
          }
        } else {
          // Нет сохраненной позиции - это первое открытие, всегда вниз
          shouldRestorePositionRef.current = false;
        }

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

