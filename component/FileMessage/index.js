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
  fileName: originalFileName 
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
      const downloadUrl = chatAPI.getFileUrl(fileUrl, true, fullFileName);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = fullFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading file:', error);
      alert('Не удалось скачать файл');
    } finally {
      setDownloading(false);
    }
  };

  const handleClick = (e) => {
    e.stopPropagation();
    if (canViewInBrowser(mimeType)) {
      const viewUrl = chatAPI.getFileUrl(fileUrl, false);
      window.open(viewUrl, '_blank');
      return;
    }
    handleDownload(e);
  };

  return (
    <div className={`${styles.fileMessage} ${isOwn ? styles.ownMessage : ''}`}>
      <div className={styles.fileContainer} onClick={handleClick}>
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
            {extension && (
              <span className={styles.fileExtension}>.{extension}</span>
            )}
          </div>
          <div className={styles.fileSize}>{displaySize}</div>
          {content && content.trim() && (
            <div className={styles.fileCaption}>{content}</div>
          )}
        </div>
        <div className={styles.fileRightColumn}>
          <button
            type="button"
            className={styles.downloadButton}
            onClick={handleDownload}
            disabled={downloading}
            title="Скачать"
          >
            {downloading ? (
              <div className={styles.spinner} />
            ) : (
              <Download size={20} />
            )}
          </button>
          <div className={styles.fileMeta}>
            {isPinned && (
              <span className={styles.pinnedIcon} title="Закреплено">📌</span>
            )}
            <span className={styles.messageTime}>{messageTime}</span>
            {statusIcon && (
              <span className={styles.statusIcon}>{statusIcon}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
