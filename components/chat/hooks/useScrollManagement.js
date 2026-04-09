import { useRef, useCallback, useEffect, useState } from 'react';
import {
  isAtBottom,
  findFirstVisibleMessage,
  saveScrollPositionToStorage,
  loadScrollPositionFromStorage,
  countMessagesBelowViewport,
} from '../utils/scrollHelpers';
import {
  LOAD_MORE_THRESHOLD,
  CHECK_BOTTOM_DEFAULT_THRESHOLD,
  CHECK_BOTTOM_STRICT_THRESHOLD,
  RESTORE_POSITION_DELAY,
  CHECK_BOTTOM_AUTO_SCROLL_THRESHOLD,
  AUTO_SCROLL_DELAY,
} from '../constants/chat';
import { useInfiniteScroll } from './useInfiniteScroll';

export const useScrollManagement = ({
  chatId,
  messages,
  messagesContainerRef,
  isLoadingInitial,
  hasMore,
  loadingMore,
  oldestMessageId,
  onLoadOlderMessages,
  setShowScrollToBottom: _setShowScrollToBottom,
}) => {
  const scrollPositionSavedRef = useRef(false);
  const shouldRestorePositionRef = useRef(true);
  const userScrolledToBottomRef = useRef(false);
  const isUserScrollingUpRef = useRef(false);
  const restoreAttemptsRef = useRef(0);
  const isRestoringScrollRef = useRef(false);
  const lastScrollTopRef = useRef(0);
  const scrollHeightBeforeMessageRef = useRef(0);
  const wasAtBottomBeforeMessageRef = useRef(false);
  const shouldAutoScrollRef = useRef(false);
  const scrollTimeoutRef = useRef(null);
  const loadMoreTimeoutRef = useRef(null);
  const isUserScrollingRef = useRef(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const unreadCountUpdateTimeoutRef = useRef(null);
  const lastReadMessageIdRef = useRef(null);

  const getIsRestoringScroll = () => isRestoringScrollRef.current;

  const checkIsAtBottom = useCallback(
    (threshold = CHECK_BOTTOM_DEFAULT_THRESHOLD) => {
      if (!messagesContainerRef.current) return false;
      return isAtBottom(messagesContainerRef.current, threshold);
    },
    [messagesContainerRef]
  );

  const updateUnreadCount = useCallback(() => {
    if (!messagesContainerRef.current || !messages || messages.length === 0) {
      setUnreadCount(0);
      return;
    }

    const isAtBottomNow = checkIsAtBottom(50);
    if (isAtBottomNow) {
      const sortedMessages = [...messages].sort((a, b) => {
        const timeA = new Date(a.createdAt || 0).getTime();
        const timeB = new Date(b.createdAt || 0).getTime();
        return timeB - timeA;
      });
      if (sortedMessages.length > 0) {
        const lastMessage = sortedMessages[0];
        lastReadMessageIdRef.current = lastMessage.id;
      }
      setUnreadCount(0);
      return;
    }

    if (!lastReadMessageIdRef.current) {
      const count = countMessagesBelowViewport(messagesContainerRef.current);
      setUnreadCount(count);
      return;
    }

    const containerRect = messagesContainerRef.current.getBoundingClientRect();
    const viewportBottom = containerRect.bottom;
    const messageElements = messagesContainerRef.current.querySelectorAll('[data-message-id]');
    let count = 0;
    let foundLastRead = false;

    for (const msgEl of messageElements) {
      const messageId = msgEl.getAttribute('data-message-id');
      if (messageId && String(messageId) === String(lastReadMessageIdRef.current)) {
        foundLastRead = true;
        continue;
      }

      if (foundLastRead) {
        const msgRect = msgEl.getBoundingClientRect();

        if (msgRect.top > viewportBottom) {
          count++;
        }
      }
    }

    setUnreadCount(count);
  }, [checkIsAtBottom, messages, messagesContainerRef]);

  useInfiniteScroll({
    containerRef: messagesContainerRef,
    hasMore,
    loadingMore,
    isLoadingInitial,
    isRestoringScroll: getIsRestoringScroll,
    oldestMessageId,
    onLoadMore: onLoadOlderMessages,
    rootMargin: `${LOAD_MORE_THRESHOLD}px 0px 0px 0px`,
    sentinelId: `messages-load-sentinel-${chatId}`,
    updateSentinelOnScroll: true,
  });

  const _loadMoreObserverRef = useRef(null);

  useEffect(() => {
    if (!chatId) return;

    scrollPositionSavedRef.current = false;
    userScrolledToBottomRef.current = false;
    restoreAttemptsRef.current = 0;
    shouldRestorePositionRef.current = false;
    lastReadMessageIdRef.current = null;
  }, [chatId]);

  const saveScrollPosition = useCallback(
    (_force = false) => {
      if (!messagesContainerRef.current || !chatId) return;

      const container = messagesContainerRef.current;
      const scrollTop = container.scrollTop;
      const scrollHeight = container.scrollHeight;
      const isBottom = checkIsAtBottom(CHECK_BOTTOM_STRICT_THRESHOLD);

      let messageId = null;
      if (!isBottom) {
        const firstVisible = findFirstVisibleMessage(container);
        if (firstVisible) {
          messageId = firstVisible.getAttribute('data-message-id');
        }
      }

      saveScrollPositionToStorage(chatId, {
        scrollTop,
        scrollHeight,
        isBottom,
        messageId,
      });

      if (isBottom) {
        userScrolledToBottomRef.current = true;

        if (messages && messages.length > 0) {
          const sortedMessages = [...messages].sort((a, b) => {
            const timeA = new Date(a.createdAt || 0).getTime();
            const timeB = new Date(b.createdAt || 0).getTime();
            return timeB - timeA;
          });
          if (sortedMessages.length > 0) {
            lastReadMessageIdRef.current = sortedMessages[0].id;
          }
        }
        setUnreadCount(0);
      }
    },
    [chatId, checkIsAtBottom, messages, messagesContainerRef]
  );

  const scrollToBottom = useCallback(
    (behavior = 'auto') => {
      if (!messagesContainerRef.current) return;

      const container = messagesContainerRef.current;
      const targetScrollTop = container.scrollHeight;

      const validBehavior =
        typeof behavior === 'string' && (behavior === 'auto' || behavior === 'smooth')
          ? behavior
          : 'auto';

      container.scrollTo({
        top: targetScrollTop,
        behavior: validBehavior,
      });

      lastScrollTopRef.current = targetScrollTop;
      userScrolledToBottomRef.current = true;
      isUserScrollingUpRef.current = false;

      if (messages && messages.length > 0) {
        const sortedMessages = [...messages].sort((a, b) => {
          const timeA = new Date(a.createdAt || 0).getTime();
          const timeB = new Date(b.createdAt || 0).getTime();
          return timeB - timeA;
        });
        if (sortedMessages.length > 0) {
          lastReadMessageIdRef.current = sortedMessages[0].id;
        }
      }
      setUnreadCount(0);
    },
    [messages, messagesContainerRef]
  );

  const restoreScrollPosition = useCallback(() => {
    if (!messagesContainerRef.current || !chatId || messages.length === 0) return;

    const saved = loadScrollPositionFromStorage(chatId);

    if (!shouldRestorePositionRef.current) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollToBottom('auto');
          scrollPositionSavedRef.current = true;
        });
      });
      return;
    }

    if (!saved) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollToBottom('auto');
          scrollPositionSavedRef.current = true;
          shouldRestorePositionRef.current = false;
        });
      });
      return;
    }

    try {
      const { scrollTop, scrollHeight, isBottom, messageId } = saved;
      const container = messagesContainerRef.current;

      if (!saved.isRecent) {
        scrollToBottom('auto');
        scrollPositionSavedRef.current = true;
        shouldRestorePositionRef.current = false;
        return;
      }

      if (isBottom) {
        setTimeout(() => {
          scrollToBottom('auto');
          scrollPositionSavedRef.current = true;
          shouldRestorePositionRef.current = false;
        }, RESTORE_POSITION_DELAY);
        return;
      }

      if (messageId) {
        const targetMessage = document.querySelector(`[data-message-id="${messageId}"]`);
        if (targetMessage) {
          targetMessage.scrollIntoView({ behavior: 'auto', block: 'center' });
          scrollPositionSavedRef.current = true;
          shouldRestorePositionRef.current = false;
          lastScrollTopRef.current = container.scrollTop;
          return;
        }
      }

      isRestoringScrollRef.current = true;
      const attemptRestore = () => {
        if (container.scrollHeight >= scrollHeight) {
          requestAnimationFrame(() => {
            container.scrollTop = scrollTop;
            scrollPositionSavedRef.current = true;
            shouldRestorePositionRef.current = false;
            restoreAttemptsRef.current = 0;
            lastScrollTopRef.current = scrollTop;
            setTimeout(() => {
              isRestoringScrollRef.current = false;
            }, 300);
          });
        } else {
          restoreAttemptsRef.current++;
          if (restoreAttemptsRef.current < 5) {
            setTimeout(attemptRestore, 200);
          } else {
            scrollToBottom('auto');
            scrollPositionSavedRef.current = true;
            shouldRestorePositionRef.current = false;
            isRestoringScrollRef.current = false;
          }
        }
      };

      setTimeout(attemptRestore, RESTORE_POSITION_DELAY);
    } catch (e) {
      scrollToBottom('auto');
      scrollPositionSavedRef.current = true;
      shouldRestorePositionRef.current = false;
    }
  }, [chatId, messages.length, scrollToBottom, messagesContainerRef]);

  useEffect(() => {
    if (messages.length > 0 && !scrollPositionSavedRef.current && messagesContainerRef.current) {
      const container = messagesContainerRef.current;

      if (isLoadingInitial && !shouldRestorePositionRef.current) {
        const targetScrollTop = container.scrollHeight;
        if (targetScrollTop > 0) {
          container.scrollTop = targetScrollTop;
          lastScrollTopRef.current = targetScrollTop;
          scrollPositionSavedRef.current = true;
          userScrolledToBottomRef.current = true;
          isUserScrollingUpRef.current = false;

          if (messages && messages.length > 0) {
            const sortedMessages = [...messages].sort((a, b) => {
              const timeA = new Date(a.createdAt || 0).getTime();
              const timeB = new Date(b.createdAt || 0).getTime();
              return timeB - timeA;
            });
            if (sortedMessages.length > 0) {
              lastReadMessageIdRef.current = sortedMessages[0].id;
            }
          }
          setUnreadCount(0);
        }
      }
    }
  }, [messages.length, isLoadingInitial, messages, messagesContainerRef]);

  useEffect(() => {
    if (messages.length > 0 && !scrollPositionSavedRef.current && messagesContainerRef.current) {
      if (!isLoadingInitial) {
        restoreScrollPosition();
      }
    }
  }, [messages.length, isLoadingInitial, restoreScrollPosition, messagesContainerRef]);

  useEffect(() => {
    if (!messagesContainerRef.current || messages.length === 0) return;
    if (!scrollPositionSavedRef.current) return;

    const container = messagesContainerRef.current;
    const currentScrollHeight = container.scrollHeight;

    if (
      scrollHeightBeforeMessageRef.current > 0 &&
      currentScrollHeight > scrollHeightBeforeMessageRef.current
    ) {
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
            updateUnreadCount();
          }, AUTO_SCROLL_DELAY);
        });
      } else {
        updateUnreadCount();
      }
    } else {
      updateUnreadCount();
    }

    scrollHeightBeforeMessageRef.current = currentScrollHeight;
  }, [messages.length, checkIsAtBottom, scrollToBottom, updateUnreadCount, messagesContainerRef]);

  useEffect(() => {
    if (!messagesContainerRef.current) return;

    const container = messagesContainerRef.current;

    const handleScroll = () => {
      if (unreadCountUpdateTimeoutRef.current) {
        clearTimeout(unreadCountUpdateTimeoutRef.current);
      }

      unreadCountUpdateTimeoutRef.current = setTimeout(() => {
        updateUnreadCount();
      }, 100);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });

    const resizeObserver = new ResizeObserver(() => {
      updateUnreadCount();
    });
    resizeObserver.observe(container);

    updateUnreadCount();

    return () => {
      container.removeEventListener('scroll', handleScroll);
      resizeObserver.disconnect();
      if (unreadCountUpdateTimeoutRef.current) {
        clearTimeout(unreadCountUpdateTimeoutRef.current);
      }
    };
  }, [updateUnreadCount, messages.length, messagesContainerRef]);

  return {
    saveScrollPosition,
    restoreScrollPosition,
    scrollToBottom,
    checkIsAtBottom,

    unreadCount,

    scrollPositionSavedRef,
    userScrolledToBottomRef,
    restoreAttemptsRef,
    isUserScrollingUpRef,
    isRestoringScrollRef,
    lastScrollTopRef,
    scrollHeightBeforeMessageRef,
    wasAtBottomBeforeMessageRef,
    shouldAutoScrollRef,
    shouldRestorePositionRef,
    scrollTimeoutRef,
    loadMoreTimeoutRef,
    isUserScrollingRef,
  };
};
