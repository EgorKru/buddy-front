import { DUPLICATE_WINDOW_MS } from '../constants/chat';

/**
 * Проверяет, являются ли два сообщения дубликатами
 */
export const isDuplicate = (a, b) => {
  if (a?.id && b?.id && Number(a.id) === Number(b.id)) return true;
  if (Number(a?.senderId) !== Number(b?.senderId)) return false;
  if (String(a?.content || '').trim() !== String(b?.content || '').trim()) return false;
  const timeDiff = Math.abs(new Date(a?.createdAt) - new Date(b?.createdAt));
  return timeDiff < DUPLICATE_WINDOW_MS;
};

/**
 * Форматирует размер файла
 */
export const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

/**
 * Обрабатывает метаданные файлов для сохранения в localStorage
 */
export const saveFileMetadata = (message) => {
  if ((message.type === 'FILE' || message.type === 'IMAGE') && message.fileUrl && typeof window !== 'undefined') {
    const metadataKey = `file_metadata_${message.fileUrl}`;
    if (message.fileSize && message.fileName && message.mimeType) {
      const fileMetadata = {
        fileSize: message.fileSize,
        fileName: message.fileName,
        mimeType: message.mimeType,
        timestamp: Date.now()
      };
      localStorage.setItem(metadataKey, JSON.stringify(fileMetadata));
    }
  }
};

/**
 * Восстанавливает метаданные файлов из localStorage
 */
export const restoreFileMetadata = (message) => {
  if ((message.type === 'FILE' || message.type === 'IMAGE') && message.fileUrl && typeof window !== 'undefined') {
    const metadataKey = `file_metadata_${message.fileUrl}`;
    const savedMetadata = localStorage.getItem(metadataKey);
    if (savedMetadata && (!message.fileSize || !message.fileName || !message.mimeType)) {
      try {
        const metadata = JSON.parse(savedMetadata);
        return {
          ...message,
          fileSize: message.fileSize || metadata.fileSize,
          fileName: message.fileName || metadata.fileName,
          mimeType: message.mimeType || metadata.mimeType
        };
      } catch (e) {
        // Игнорируем ошибки парсинга
      }
    }
  }
  return message;
};

