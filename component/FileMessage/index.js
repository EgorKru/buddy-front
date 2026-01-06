import { useState } from 'react';
import { Download, File, FileText, FileImage, FileVideo, FileMusic, Archive, FileCode } from 'lucide-react';
import { chatAPI } from '@/utils/api';
import styles from './index.module.css';

const getFileIcon = (mimeType, fileName) => {
  if (!mimeType && !fileName) return File;
  
  const mime = mimeType?.toLowerCase() || '';
  const name = fileName?.toLowerCase() || '';
  
  if (mime.startsWith('image/') || name.match(/\.(jpg|jpeg|png|gif|webp|svg)$/)) {
    return FileImage;
  }
  if (mime.startsWith('video/') || name.match(/\.(mp4|avi|mov|webm|mkv)$/)) {
    return FileVideo;
  }
  if (mime.startsWith('audio/') || name.match(/\.(mp3|wav|ogg|flac|m4a)$/)) {
    return FileMusic;
  }
  if (mime.includes('pdf') || name.endsWith('.pdf')) {
    return FileText;
  }
  if (mime.includes('zip') || mime.includes('rar') || mime.includes('7z') || 
      name.match(/\.(zip|rar|7z|tar|gz)$/)) {
    return Archive;
  }
  if (mime.includes('text') || mime.includes('code') || 
      name.match(/\.(txt|js|ts|jsx|tsx|html|css|json|xml|yaml|yml)$/)) {
    return FileCode;
  }
  if (mime.includes('document') || mime.includes('word') || 
      name.match(/\.(doc|docx|odt)$/)) {
    return FileText;
  }
  return File;
};

const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

const getFileName = (fileUrl) => {
  if (!fileUrl) return 'Файл';
  const parts = fileUrl.split('/');
  const lastPart = parts[parts.length - 1];
  // Убираем UUID, оставляем только расширение если есть
  const match = lastPart.match(/\.([^.]+)$/);
  return match ? `Файл.${match[1]}` : 'Файл';
};

export default function FileMessage({ fileUrl, content, fileSize, mimeType, messageTime, isOwn, statusIcon, isPinned }) {
  const [downloading, setDownloading] = useState(false);
  
  const FileIcon = getFileIcon(mimeType, fileUrl);
  const fileName = getFileName(fileUrl);
  const displaySize = fileSize ? formatFileSize(fileSize) : null;

  const handleDownload = async (e) => {
    e.stopPropagation();
    if (!fileUrl) return;
    
    setDownloading(true);
    try {
      const downloadUrl = chatAPI.getFileUrl(fileUrl, true, fileName);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = fileName;
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
    // Для PDF и изображений открываем в новой вкладке для просмотра
    if (mimeType) {
      const mime = mimeType.toLowerCase();
      if (mime.includes('pdf') || mime.startsWith('image/')) {
        const viewUrl = chatAPI.getFileUrl(fileUrl, false);
        window.open(viewUrl, '_blank');
        return;
      }
    }
    // Для остальных файлов - скачиваем
    handleDownload(e);
  };

  return (
    <div className={`${styles.fileMessage} ${isOwn ? styles.ownMessage : ''}`}>
      <div 
        className={styles.fileContainer}
        onClick={handleClick}
      >
        <div className={styles.fileIconWrapper}>
          <FileIcon size={32} className={styles.fileIcon} />
        </div>
        <div className={styles.fileInfo}>
          <div className={styles.fileName}>{fileName}</div>
          {displaySize && (
            <div className={styles.fileSize}>{displaySize}</div>
          )}
        </div>
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
      </div>
      {content && content.trim() && (
        <div className={styles.fileCaption}>
          {content}
        </div>
      )}
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
  );
}

