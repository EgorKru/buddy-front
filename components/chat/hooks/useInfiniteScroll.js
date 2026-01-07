import { useEffect, useRef } from 'react';
import { INFINITE_SCROLL_SENTINEL_OFFSET } from '../constants/chat';

/**
 * Хук для бесконечной прокрутки с использованием Intersection Observer
 * Оптимизирован для плавной загрузки старых сообщений (Telegram-like)
 */
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
  updateSentinelOnScroll = true
}) => {
  const observerRef = useRef(null);
  const sentinelRef = useRef(null);
  const scrollHandlerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !hasMore || typeof IntersectionObserver === 'undefined') {
      return;
    }

    // Не создаем observer во время начальной загрузки
    if (isLoadingInitial) {
      return;
    }

    const container = containerRef.current;

    /**
     * Создает или обновляет sentinel элемент для отслеживания приближения к верху
     */
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
      
      // Размещаем sentinel за 1000px до верха для предзагрузки
      sentinel.style.top = '1000px';
      
      sentinelRef.current = sentinel;
      return sentinel;
    };

    const sentinel = updateSentinel();

    /**
     * Обработчик пересечения sentinel с viewport
     */
    const handleIntersection = (entries) => {
      entries.forEach((entry) => {
        // Проверяем isRestoringScroll (может быть функцией или значением)
        const isRestoring = typeof isRestoringScroll === 'function' 
          ? isRestoringScroll() 
          : isRestoringScroll;
        
        if (
          entry.isIntersecting &&
          hasMore &&
          !loadingMore &&
          !isLoadingInitial &&
          !isRestoring &&
          oldestMessageId &&
          onLoadMore
        ) {
          // Предзагружаем сообщения заранее через курсорную пагинацию
          onLoadMore(oldestMessageId);
        }
      });
    };

    // Создаем Intersection Observer
    const observer = new IntersectionObserver(handleIntersection, {
      root: container,
      rootMargin,
      threshold: 0,
    });

    observer.observe(sentinel);
    observerRef.current = observer;

    /**
     * Обновляет позицию sentinel при скролле для более точной предзагрузки
     */
    if (updateSentinelOnScroll) {
      const handleScrollForSentinel = () => {
        if (sentinel && container) {
          const scrollTop = container.scrollTop;
          // Обновляем позицию sentinel для предзагрузки
          // Размещаем его на 800px выше текущей позиции скролла
          sentinel.style.top = `${Math.max(INFINITE_SCROLL_SENTINEL_OFFSET, scrollTop + INFINITE_SCROLL_SENTINEL_OFFSET)}px`;
        }
      };

      container.addEventListener('scroll', handleScrollForSentinel, { passive: true });
      scrollHandlerRef.current = handleScrollForSentinel;
    }

    // Очистка при размонтировании
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
    updateSentinelOnScroll
  ]);

  return {
    observerRef,
    sentinelRef
  };
};

