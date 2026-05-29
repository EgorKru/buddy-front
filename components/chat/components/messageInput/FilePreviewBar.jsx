import Image from 'next/image';
import { X, File as FileIcon } from 'lucide-react';
import { formatFileSize } from '../../utils/messageHelpers';
import { fileSelectionKey } from '@/shared/lib/chat/multiFileSelection';
import styles from '@/styles/chat.module.css';

function previewUrlForFile(file, previewUrlsRef) {
  if (!file?.type?.startsWith('image/')) return '';
  const key = `${file.name}-${file.size}-${file.lastModified}`;
  return previewUrlsRef?.current?.get(key) || '';
}

export function FilePreviewBar({ selectedFiles = [], previewUrlsRef, onRemoveFileAt }) {
  if (!selectedFiles?.length) return null;

  return (
    <div className={styles.filePreviewList} data-testid="chat-file-preview-list">
      {selectedFiles.map((file, index) => {
        const isImage = file.type && String(file.type).startsWith('image/');
        const previewUrl = previewUrlForFile(file, previewUrlsRef);

        return (
          <div
            key={fileSelectionKey(file) || index}
            className={styles.filePreview}
            data-testid="chat-file-preview-item"
            data-file-name={file.name}
          >
            {isImage ? (
              <div className={styles.imagePreview}>
                <Image
                  src={previewUrl}
                  alt={file.name || 'Preview'}
                  width={120}
                  height={120}
                  className={styles.previewImage}
                />
                <button
                  type="button"
                  onClick={() => onRemoveFileAt?.(index)}
                  className={styles.removeFileButton}
                  title="Удалить файл"
                  data-testid="chat-file-preview-remove"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className={styles.filePreviewInfo}>
                <FileIcon size={20} />
                <div className={styles.filePreviewDetails}>
                  <div className={styles.filePreviewName}>{file.name || 'Файл'}</div>
                  <div className={styles.filePreviewSize}>{formatFileSize(file.size || 0)}</div>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveFileAt?.(index)}
                  className={styles.removeFileButton}
                  title="Удалить файл"
                  data-testid="chat-file-preview-remove"
                >
                  <X size={16} />
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
