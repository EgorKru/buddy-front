import { useEffect, useRef } from 'react';
import { INFINITE_SCROLL_SENTINEL_OFFSET } from '../constants/chat';

export const useInfiniteScroll = ({
  containerRef,
  hasMore,
  loadingMore,
  isLoadingInitial,
  isRestoringScroll,
  oldestMessageId,
  onLoadMore,
  rootMargin = '800px 0px 0px 0px',
  sentinelId = 'messages-load-sentinel',
  updateSentinelOnScroll = true,
}) => {
  const observerRef = useRef(null);
  const sentinelRef = useRef(null);
  const scrollHandlerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !hasMore || typeof IntersectionObserver === 'undefined') {
      return;
    }

    if (isLoadingInitial) {
      return;
    }

    const container = containerRef.current;

    const updateSentinel = () => {
      let sentinel = document.getElementById(sentinelId);
      if (!sentinel) {
        sentinel = document.createElement('div');
        sentinel.id = sentinelId;
        sentinel.style.height = '1px';
        sentinel.style.width = '1px';
        sentinel.style.position = 'absolute';
        sentinel.style.pointerEvents = 'none';
        sentinel.style.visibility = 'hidden';
        sentinel.style.opacity = '0';
        container.appendChild(sentinel);
      }

      sentinel.style.top = '1000px';

      sentinelRef.current = sentinel;
      return sentinel;
    };

    const sentinel = updateSentinel();

    const handleIntersection = (entries) => {
      entries.forEach((entry) => {
        const isRestoring =
          typeof isRestoringScroll === 'function' ? isRestoringScroll() : isRestoringScroll;

        if (
          entry.isIntersecting &&
          hasMore &&
          !loadingMore &&
          !isLoadingInitial &&
          !isRestoring &&
          oldestMessageId &&
          onLoadMore
        ) {
          onLoadMore(oldestMessageId);
        }
      });
    };

    const observer = new IntersectionObserver(handleIntersection, {
      root: container,
      rootMargin,
      threshold: 0,
    });

    observer.observe(sentinel);
    observerRef.current = observer;

    if (updateSentinelOnScroll) {
      const handleScrollForSentinel = () => {
        if (sentinel && container) {
          const scrollTop = container.scrollTop;

          sentinel.style.top = `${Math.max(INFINITE_SCROLL_SENTINEL_OFFSET, scrollTop + INFINITE_SCROLL_SENTINEL_OFFSET)}px`;
        }
      };

      container.addEventListener('scroll', handleScrollForSentinel, { passive: true });
      scrollHandlerRef.current = handleScrollForSentinel;
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }

      if (scrollHandlerRef.current && container) {
        container.removeEventListener('scroll', scrollHandlerRef.current);
        scrollHandlerRef.current = null;
      }

      if (sentinel && sentinel.parentNode) {
        sentinel.parentNode.removeChild(sentinel);
      }

      sentinelRef.current = null;
    };
  }, [
    containerRef,
    hasMore,
    loadingMore,
    isLoadingInitial,
    isRestoringScroll,
    oldestMessageId,
    onLoadMore,
    rootMargin,
    sentinelId,
    updateSentinelOnScroll,
  ]);

  return {
    observerRef,
    sentinelRef,
  };
};
