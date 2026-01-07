import { useEffect } from 'react';
import { CHECK_BOTTOM_AUTO_SCROLL_THRESHOLD, AUTO_SCROLL_DELAY, CHECK_BOTTOM_DEFAULT_THRESHOLD } from '../constants/chat';

export const useMessageEffects = ({
  messages,
  scrollPositionSavedRef,
  messagesContainerRef,
  isLoadingInitialRef,
  shouldRestorePositionRef,
  restoreScrollPosition,
  scrollHeightBeforeMessageRef,
  wasAtBottomBeforeMessageRef,
  shouldAutoScrollRef,
  checkIsAtBottom,
  scrollToBottom,
  userScrolledToBottomRef,
  isUserScrollingUpRef,
  lastScrollTopRef
}) => {
  useEffect(() => {
    if (messages.length > 0 && !scrollPositionSavedRef.current && messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      
      if (isLoadingInitialRef.current && !shouldRestorePositionRef.current) {
        const targetScrollTop = container.scrollHeight;
        if (targetScrollTop > 0) {
          container.scrollTop = targetScrollTop;
          lastScrollTopRef.current = targetScrollTop;
          scrollPositionSavedRef.current = true;
          userScrolledToBottomRef.current = true;
          isUserScrollingUpRef.current = false;
        }
      }
    }
  }, [messages.length, scrollPositionSavedRef, messagesContainerRef, isLoadingInitialRef, shouldRestorePositionRef, lastScrollTopRef, userScrolledToBottomRef, isUserScrollingUpRef]);

  useEffect(() => {
    if (messages.length > 0 && !scrollPositionSavedRef.current && messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      
      if (!isLoadingInitialRef.current) {
        if (shouldRestorePositionRef.current) {
          restoreScrollPosition();
        } else {
          restoreScrollPosition();
        }
      }
    }
  }, [messages, restoreScrollPosition, isLoadingInitialRef, scrollPositionSavedRef, messagesContainerRef, shouldRestorePositionRef]);

  useEffect(() => {
    if (!messagesContainerRef.current || messages.length === 0) return;
    if (!scrollPositionSavedRef.current) return;
    
    const container = messagesContainerRef.current;
    const currentScrollHeight = container.scrollHeight;
    
    if (scrollHeightBeforeMessageRef.current > 0 && currentScrollHeight > scrollHeightBeforeMessageRef.current) {
      if (wasAtBottomBeforeMessageRef.current || shouldAutoScrollRef.current) {
        requestAnimationFrame(() => {
          setTimeout(() => {
            if (checkIsAtBottom(CHECK_BOTTOM_AUTO_SCROLL_THRESHOLD)) {
              scrollToBottom();
              userScrolledToBottomRef.current = true;
            } else {
              userScrolledToBottomRef.current = false;
            }
            wasAtBottomBeforeMessageRef.current = false;
            shouldAutoScrollRef.current = false;
          }, AUTO_SCROLL_DELAY);
        });
      } else {
        userScrolledToBottomRef.current = false;
      }
    } else {
      const isNearBottom = checkIsAtBottom(CHECK_BOTTOM_DEFAULT_THRESHOLD);
      if (isNearBottom && (wasAtBottomBeforeMessageRef.current || shouldAutoScrollRef.current)) {
        requestAnimationFrame(() => {
          setTimeout(() => {
            if (checkIsAtBottom(150)) {
              scrollToBottom();
              userScrolledToBottomRef.current = true;
            }
            wasAtBottomBeforeMessageRef.current = false;
            shouldAutoScrollRef.current = false;
          }, 100);
        });
      } else {
        userScrolledToBottomRef.current = false;
        wasAtBottomBeforeMessageRef.current = false;
        shouldAutoScrollRef.current = false;
      }
    }
    
    scrollHeightBeforeMessageRef.current = currentScrollHeight;
  }, [messages.length, checkIsAtBottom, messagesContainerRef, scrollPositionSavedRef, scrollHeightBeforeMessageRef, wasAtBottomBeforeMessageRef, shouldAutoScrollRef, scrollToBottom, userScrolledToBottomRef]);
};

