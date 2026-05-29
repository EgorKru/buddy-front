import { useState, useEffect } from 'react';
import { Download } from 'lucide-react';
import { fetchChatFileBlob } from '@/shared/lib/chat/fetchChatFileBlob';
import {
  formatFileSize,
  getFileName,
  getFilePreviewKind,
  canOpenInViewer,
  isInlineVideoPreview,
  FILE_PREVIEW_KIND,
} from './utils';
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
  const [videoBlobUrl, setVideoBlobUrl] = useState(null);
  const [videoError, setVideoError] = useState(null);
  const [videoLoading, setVideoLoading] = useState(false);

  const { name: fileName, extension } = getFileName(fileUrl, originalFileName);
  const displaySize = fileSize ? formatFileSize(fileSize) : 'Неизвестно';
  const previewKind = getFilePreviewKind(mimeType, extension);
  const showInlineVideo = isInlineVideoPreview(previewKind);

  useEffect(() => {
    if (!showInlineVideo || !fileUrl) {
      setVideoBlobUrl(null);
      return;
    }

    let objectUrl = null;
    let cancelled = false;
    setVideoLoading(true);
    setVideoError(null);

    fetchChatFileBlob(fileUrl)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setVideoBlobUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setVideoError('Не удалось загрузить видео');
      })
      .finally(() => {
        if (!cancelled) setVideoLoading(false);
      });

    return () => {
      cancelled = true;
      if (objectUrl && typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [fileUrl, showInlineVideo]);

  const handleDownload = async (e) => {
    e.stopPropagation();
    if (!fileUrl) return;

    setDownloading(true);
    try {
      const fullFileName = extension ? `${fileName}.${extension}` : fileName;
      const blob = await fetchChatFileBlob(fileUrl, { download: true, filename: fullFileName });
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

    if (!fileUrl || !setFileViewerModal || !canOpenInViewer(previewKind)) return;

    const fullFileName = extension ? `${fileName}.${extension}` : fileName;
    setFileViewerModal({
      fileUrl,
      fileName: fullFileName,
      mimeType: mimeType || 'application/octet-stream',
      previewKind,
    });
  };

  const isEmbedded = !messageTime;

  return (
    <div
      className={`${styles.fileMessage} ${isOwn ? styles.ownMessage : ''} ${isEmbedded ? styles.embedded : ''}`}
      data-testid="chat-message-file"
      data-preview-kind={previewKind}
    >
      {showInlineVideo && (
        <div className={styles.videoWrapper}>
          {videoLoading && (
            <div className={styles.videoLoading}>
              <div className={styles.spinner} />
            </div>
          )}
          {videoError && <div className={styles.videoError}>{videoError}</div>}
          {videoBlobUrl && !videoError && (
            <video
              controls
              src={videoBlobUrl}
              className={styles.inlineVideo}
              data-testid="chat-message-file-video"
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>
      )}
      <div
        className={`${styles.fileContainer} ${isEmbedded ? styles.embeddedContainer : ''} ${canOpenInViewer(previewKind) ? styles.viewable : ''}`}
        onClick={handleClick}
        data-testid="chat-message-file-card"
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
          {previewKind === FILE_PREVIEW_KIND.OFFICE && (
            <div className={styles.fileHint}>Скачайте, чтобы открыть в Word / Excel</div>
          )}
        </div>
        <div className={styles.fileRightColumn}>
          <button
            type="button"
            className={styles.downloadButton}
            onClick={handleDownload}
            disabled={downloading}
            title="Скачать"
            data-testid="chat-message-file-download"
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
