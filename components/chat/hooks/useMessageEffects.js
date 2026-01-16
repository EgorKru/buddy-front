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

      if (!shouldRestorePositionRef.current) {
        
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const targetScrollTop = container.scrollHeight;
            if (targetScrollTop > 0 && targetScrollTop > container.clientHeight) {
              container.scrollTop = targetScrollTop;
              lastScrollTopRef.current = targetScrollTop;
              userScrolledToBottomRef.current = true;
              isUserScrollingUpRef.current = false;
              scrollPositionSavedRef.current = true;
            }
          });
        });
      }
    }
  }, [messages.length, scrollPositionSavedRef, messagesContainerRef, shouldRestorePositionRef, userScrolledToBottomRef, isUserScrollingUpRef, lastScrollTopRef]);

  useEffect(() => {
    if (messages.length > 0 && messagesContainerRef.current && !scrollPositionSavedRef.current) {
      const container = messagesContainerRef.current;
      
      const performScroll = () => {
        if (shouldRestorePositionRef.current) {
          restoreScrollPosition();
        } else {
          const targetScrollTop = container.scrollHeight;
          if (targetScrollTop > 0) {
            container.scrollTop = targetScrollTop;
            lastScrollTopRef.current = targetScrollTop;
            userScrolledToBottomRef.current = true;
            isUserScrollingUpRef.current = false;
            scrollPositionSavedRef.current = true;
          }
        }
      };

      const attemptScroll = (attempt = 0) => {
        if (container.scrollHeight > container.clientHeight) {
          performScroll();
          
          setTimeout(() => {
            const currentScrollTop = container.scrollTop;
            const maxScrollTop = container.scrollHeight - container.clientHeight;
            if (currentScrollTop < maxScrollTop - 50) {
              performScroll();
            }
          }, 100);
        } else if (attempt < 20) {
          
          setTimeout(() => {
            if (!scrollPositionSavedRef.current) {
              attemptScroll(attempt + 1);
            }
          }, 50);
        }
      };

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          attemptScroll();
        });
      });
    }
  }, [messages.length, scrollPositionSavedRef, messagesContainerRef, shouldRestorePositionRef, restoreScrollPosition, userScrolledToBottomRef, isUserScrollingUpRef, lastScrollTopRef]);

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

