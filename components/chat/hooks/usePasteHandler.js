import { useCallback } from 'react';

/**
 * Возвращает обработчик onPaste для вставки изображений из буфера в поле ввода.
 * При вставке изображения создаёт File и вызывает onFileSelect с синтетическим event.
 */
export function usePasteHandler(editingMessageId, isRecording, sending, onFileSelect) {
  return useCallback(
    (e) => {
      if (editingMessageId || isRecording || sending) return;
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') !== -1) {
          e.preventDefault();
          const blob = item.getAsFile();
          if (blob && onFileSelect) {
            const file = new File(
              [blob],
              `pasted-image-${Date.now()}.${blob.type.split('/')[1] || 'png'}`,
              { type: blob.type }
            );
            onFileSelect({ target: { files: [file], value: '' } });
          }
          break;
        }
      }
    },
    [editingMessageId, isRecording, sending, onFileSelect]
  );
}
