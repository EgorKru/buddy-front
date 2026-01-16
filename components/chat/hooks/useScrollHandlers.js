import { useCallback, useMemo } from 'react';

const throttle = (func, delay) => {
  let timeoutId = null;
  let lastExecTime = 0;
  return function (...args) {
    const currentTime = Date.now();
    
    if (currentTime - lastExecTime > delay) {
      func.apply(this, args);
      lastExecTime = currentTime;
    } else {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        func.apply(this, args);
        lastExecTime = Date.now();
      }, delay - (currentTime - lastExecTime));
    }
  };
};
import {
  SCROLL_DIRECTION_THRESHOLD,
  LOAD_MORE_SCROLL_THRESHOLD,
  LOAD_MORE_DELAY,
  SCROLL_SAVE_DELAY,
  SCROLL_THROTTLE_DELAY,
  CHECK_BOTTOM_DEFAULT_THRESHOLD
} from '../constants/chat';

export const useScrollHandlers = ({
  messagesContainerRef,
  isLoadingInitialRef,
  isAutoScrollingRef,
  lastScrollTopRef,
  isUserScrollingUpRef,
  scrollStateRef,
  loadOlderMessages,
  loadMessages,
  saveScrollPosition,
  checkIsAtBottom,
  setShowScrollToBottom,
  userScrolledToBottomRef,
  isRestoringScrollRef,
  isUserScrollingRef,
  scrollTimeoutRef,
  loadMoreTimeoutRef
}) => {
  const handleScroll = useCallback(() => {
    if (!messagesContainerRef.current) return;
    
    const container = messagesContainerRef.current;
    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;
    
    if (!isLoadingInitialRef.current && lastScrollTopRef.current > 0 && !isAutoScrollingRef.current) {
      const scrollDelta = scrollTop - lastScrollTopRef.current;
      if (scrollDelta < -SCROLL_DIRECTION_THRESHOLD) {
        isUserScrollingUpRef.current = true;
      } else if (scrollDelta > SCROLL_DIRECTION_THRESHOLD) {
        isUserScrollingUpRef.current = false;
      }
    }
    lastScrollTopRef.current = scrollTop;
    
    const { hasMore: hasMoreRef, loadingMore: loadingMoreRef, oldestMessageId: oldestMessageIdRef } = scrollStateRef.current;
    
    if (
      scrollTop > 0 && 
      scrollTop < LOAD_MORE_SCROLL_THRESHOLD && 
      hasMoreRef && 
      !loadingMoreRef && 
      !isLoadingInitialRef.current &&
      !isRestoringScrollRef.current &&
      !isAutoScrollingRef.current
    ) {
      if (loadMoreTimeoutRef.current) {
        clearTimeout(loadMoreTimeoutRef.current);
      }
      loadMoreTimeoutRef.current = setTimeout(() => {
        if (messagesContainerRef.current && messagesContainerRef.current.scrollTop < LOAD_MORE_SCROLL_THRESHOLD) {
          if (oldestMessageIdRef) {
            loadOlderMessages(oldestMessageIdRef);
          } else {
            loadMessages();
          }
        }
      }, LOAD_MORE_DELAY);
    }

    const isNearBottom = checkIsAtBottom(300);
    setShowScrollToBottom(!isNearBottom);
    
    if (isNearBottom) {
      userScrolledToBottomRef.current = true;
      isUserScrollingUpRef.current = false;
    } else {
      userScrolledToBottomRef.current = false;
    }
    
    isUserScrollingRef.current = true;
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    scrollTimeoutRef.current = setTimeout(() => {
      if (!isRestoringScrollRef.current) {
        saveScrollPosition();
      }
      isUserScrollingRef.current = false;
    }, SCROLL_SAVE_DELAY);
  }, [loadOlderMessages, loadMessages, saveScrollPosition, checkIsAtBottom, setShowScrollToBottom, messagesContainerRef, isLoadingInitialRef, isAutoScrollingRef, lastScrollTopRef, isUserScrollingUpRef, scrollStateRef, isRestoringScrollRef, isUserScrollingRef, scrollTimeoutRef, loadMoreTimeoutRef, userScrolledToBottomRef]);

  const handleScrollThrottled = useMemo(() => {
    return throttle(handleScroll, SCROLL_THROTTLE_DELAY);
  }, [handleScroll]);

  return { handleScroll, handleScrollThrottled };
};

