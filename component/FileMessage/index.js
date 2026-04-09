import { useState } from 'react';
import { Download } from 'lucide-react';
import { chatAPI } from '@/utils/api';
import { formatFileSize, getFileName, canViewInBrowser } from './utils';
import styles from './index.module.css';

export default function FileMessage({
  fileUrl,
  content,
  fileSize,
  mimeType,
  messageTime,
  isOwn,
  statusIcon,
  isPinned,
  fileName: originalFileName,
  setFileViewerModal,
}) {
  const [downloading, setDownloading] = useState(false);

  const { name: fileName, extension } = getFileName(fileUrl, originalFileName);
  const displaySize = fileSize ? formatFileSize(fileSize) : 'Неизвестно';

  const handleDownload = async (e) => {
    e.stopPropagation();
    if (!fileUrl) return;

    setDownloading(true);
    try {
      const fullFileName = extension ? `${fileName}.${extension}` : fileName;
      const url = chatAPI.getFileUrl(fileUrl, true, fullFileName);
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(url, { headers });

      if (!response.ok) {
        if (response.status === 401) {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
          }
          throw new Error('Unauthorized');
        }
        throw new Error(`Failed to download file: ${response.status}`);
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fullFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      alert('Не удалось скачать файл');
    } finally {
      setDownloading(false);
    }
  };

  const handleClick = (e) => {
    e.stopPropagation();
    e.preventDefault();

    if (!fileUrl || !setFileViewerModal) return;

    const ext = extension ? extension.toLowerCase() : '';
    const canViewByMime = canViewInBrowser(mimeType);
    const canViewByExtension =
      ext &&
      [
        'txt',
        'log',
        'md',
        'json',
        'xml',
        'html',
        'css',
        'js',
        'ts',
        'jsx',
        'tsx',
        'csv',
        'yaml',
        'yml',
        'ini',
        'conf',
        'config',
      ].includes(ext);

    if (canViewByMime || canViewByExtension) {
      const fullFileName = extension ? `${fileName}.${extension}` : fileName;
      setFileViewerModal({
        fileUrl,
        fileName: fullFileName,
        mimeType: mimeType || (ext ? `text/${ext}` : 'text/plain'),
      });
    }
  };

  const isEmbedded = !messageTime;

  return (
    <div
      className={`${styles.fileMessage} ${isOwn ? styles.ownMessage : ''} ${isEmbedded ? styles.embedded : ''}`}
    >
      <div
        className={`${styles.fileContainer} ${isEmbedded ? styles.embeddedContainer : ''}`}
        onClick={handleClick}
      >
        <div className={styles.fileIconWrapper}>
          <div className={styles.fileIconContainer}>
            <div className={styles.fileIconDocument}>
              {extension ? (
                <span className={styles.fileExtensionIcon}>{extension.toUpperCase()}</span>
              ) : (
                <span className={styles.fileIconPlaceholder}>FILE</span>
              )}
            </div>
          </div>
        </div>
        <div className={styles.fileInfo}>
          <div className={styles.fileNameRow}>
            <span className={styles.fileName}>{fileName}</span>
            {extension && <span className={styles.fileExtension}>.{extension}</span>}
          </div>
          <div className={styles.fileSize}>{displaySize}</div>
          {content && content.trim() && <div className={styles.fileCaption}>{content}</div>}
        </div>
        <div className={styles.fileRightColumn}>
          <button
            type="button"
            className={styles.downloadButton}
            onClick={handleDownload}
            disabled={downloading}
            title="Скачать"
          >
            {downloading ? <div className={styles.spinner} /> : <Download size={20} />}
          </button>
          {messageTime && (
            <div className={styles.fileMeta}>
              {isPinned && (
                <span className={styles.pinnedIcon} title="Закреплено">
                  📌
                </span>
              )}
              <span className={styles.messageTime}>{messageTime}</span>
              {statusIcon && <span className={styles.statusIcon}>{statusIcon}</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
