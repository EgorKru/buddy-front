import { SCROLL_RESTORE_TIMEOUT } from '../constants/chat';

export const saveScrollPositionToStorage = (chatId, scrollData) => {
  if (typeof window !== 'undefined' && chatId) {
    localStorage.setItem(`chat_scroll_${chatId}`, JSON.stringify({
      ...scrollData,
      timestamp: Date.now()
    }));
  }
};

export const loadScrollPositionFromStorage = (chatId) => {
  if (typeof window === 'undefined' || !chatId) return null;
  
  const saved = localStorage.getItem(`chat_scroll_${chatId}`);
  if (!saved) return null;
  
  try {
    const data = JSON.parse(saved);
    const isRecent = Date.now() - data.timestamp < SCROLL_RESTORE_TIMEOUT;
    return {
      ...data,
      isRecent
    };
  } catch (e) {
    return null;
  }
};

export const isAtBottom = (container, threshold = 100) => {
  if (!container) return false;
  const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
  return distanceFromBottom <= threshold;
};

export const findFirstVisibleMessage = (container) => {
  if (!container) return null;
  
  const containerRect = container.getBoundingClientRect();
  const messages = container.querySelectorAll('[data-message-id]');
  let bestMessage = null;
  let bestDistance = Infinity;
  
  for (const msgEl of messages) {
    const msgRect = msgEl.getBoundingClientRect();
    if (msgRect.top <= containerRect.bottom && msgRect.bottom >= containerRect.top) {
      const distanceFromTop = Math.abs(msgRect.top - containerRect.top);
      if (distanceFromTop < bestDistance) {
        bestDistance = distanceFromTop;
        bestMessage = msgEl;
      }
    }
  }
  
  return bestMessage;
};

export const countMessagesBelowViewport = (container) => {
  if (!container) return 0;
  
  const containerRect = container.getBoundingClientRect();
  const viewportBottom = containerRect.bottom;
  const messages = container.querySelectorAll('[data-message-id]');
  let count = 0;
  
  for (const msgEl of messages) {
    const msgRect = msgEl.getBoundingClientRect();
    
    if (msgRect.top > viewportBottom) {
      count++;
    }
  }
  
  return count;
};

