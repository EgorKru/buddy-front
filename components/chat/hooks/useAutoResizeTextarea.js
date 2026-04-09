import { useEffect } from 'react';

export const useAutoResizeTextarea = (textareaRef, value, maxHeight = 120) => {
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${newHeight}px`;

    if (textarea.scrollHeight > maxHeight) {
      textarea.style.overflowY = 'auto';
      textarea.style.paddingRight = '1.25rem';
    } else {
      textarea.style.overflowY = 'hidden';
      textarea.style.paddingRight = '1rem';
    }
  }, [value, textareaRef, maxHeight]);
};
