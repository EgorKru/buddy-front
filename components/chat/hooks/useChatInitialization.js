import { useState, useEffect, useRef } from 'react';
import { SCROLL_RESTORE_TIMEOUT, INITIALIZATION_CHECK_DELAY, INITIALIZATION_CHECK_RETRY_DELAY } from '../constants/chat';

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
  
  const loadedChatIdRef = useRef(null);
  const loadedMessagesRef = useRef(false);
  const loadedPinnedRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }

    if (chatId) {
      const chatIdStr = String(chatId);
      const isNewChat = loadedChatIdRef.current !== chatIdStr;

      if (isNewChat) {
        clearSelectedFile();

        scrollPositionSavedRef.current = false;
        userScrolledToBottomRef.current = false;
        restoreAttemptsRef.current = 0;
        loadedMessagesRef.current = false;
        loadedPinnedRef.current = false;
        loadedChatIdRef.current = chatIdStr;

        shouldRestorePositionRef.current = false;

        if (!chat) {
          refreshChats();
        }

        isLoadingInitialRef.current = true;
        lastScrollTopRef.current = 0;
        isUserScrollingUpRef.current = false;

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
        scrollPositionSavedRef.current = false;
        userScrolledToBottomRef.current = false;
        shouldRestorePositionRef.current = false;
        isLoadingInitialRef.current = true;
        lastScrollTopRef.current = 0;
        isUserScrollingUpRef.current = false;
      }
    }

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

    return () => {
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

