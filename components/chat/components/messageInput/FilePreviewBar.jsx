import Image from 'next/image';
import { X, File as FileIcon } from 'lucide-react';
import { formatFileSize } from '../../utils/messageHelpers';
import styles from '@/styles/chat.module.css';

export function FilePreviewBar({ selectedFile, selectedFileUrlRef, onRemoveFile }) {
  if (!selectedFile) return null;

  const isImage = selectedFile.type && String(selectedFile.type).startsWith('image/');

  return (
    <div
      key={`file-preview-${selectedFile.name}-${selectedFile.size}`}
      className={styles.filePreview}
    >
      {isImage ? (
        <div className={styles.imagePreview}>
          <Image
            src={selectedFileUrlRef?.current || ''}
            alt={selectedFile.name || 'Preview'}
            width={200}
            height={200}
            className={styles.previewImage}
          />
          <button
            type="button"
            onClick={onRemoveFile}
            className={styles.removeFileButton}
            title="Удалить файл"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <div className={styles.filePreviewInfo}>
          <FileIcon size={20} />
          <div className={styles.filePreviewDetails}>
            <div className={styles.filePreviewName}>{selectedFile.name || 'Файл'}</div>
            <div className={styles.filePreviewSize}>{formatFileSize(selectedFile.size || 0)}</div>
          </div>
          <button
            type="button"
            onClick={onRemoveFile}
            className={styles.removeFileButton}
            title="Удалить файл"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
