import { useEffect, useState } from 'react';
import { X, Download } from 'lucide-react';
import { fetchChatFileBlob } from '@/shared/lib/chat/fetchChatFileBlob';
import { FILE_PREVIEW_KIND } from '@/component/FileMessage/utils';
import styles from './index.module.css';

export default function FileViewerModal({ fileUrl, fileName, mimeType, previewKind, onClose }) {
  const [textContent, setTextContent] = useState('');
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const kind = previewKind || FILE_PREVIEW_KIND.TEXT;

  useEffect(() => {
    if (!fileUrl) return;

    let objectUrl = null;
    let cancelled = false;

    const loadFile = async () => {
      setLoading(true);
      setError(null);
      setTextContent('');
      setBlobUrl(null);

      try {
        const blob = await fetchChatFileBlob(fileUrl, { filename: fileName });

        if (cancelled) return;

        if (kind === FILE_PREVIEW_KIND.TEXT) {
          const text = await blob.text();
          if (!cancelled) setTextContent(text);
        } else if (kind === FILE_PREVIEW_KIND.PDF || kind === FILE_PREVIEW_KIND.VIDEO) {
          objectUrl = URL.createObjectURL(blob);
          if (!cancelled) setBlobUrl(objectUrl);
        }
      } catch (err) {
        if (!cancelled) setError('Не удалось загрузить файл');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    if (kind === FILE_PREVIEW_KIND.OFFICE) {
      setLoading(false);
    } else {
      loadFile();
    }

    return () => {
      cancelled = true;
      if (objectUrl && typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [fileUrl, fileName, kind]);

  useEffect(() => {
    return () => {
      if (blobUrl && typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [blobUrl]);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const handleDownload = async () => {
    if (!fileUrl) return;

    try {
      const blob = await fetchChatFileBlob(fileUrl, { download: true, filename: fileName });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName || 'file';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      alert('Не удалось скачать файл');
    }
  };

  if (!fileUrl) return null;

  return (
    <div
      className={styles.modalOverlay}
      onClick={onClose}
      data-testid="chat-file-viewer-modal"
      data-preview-kind={kind}
    >
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.fileName}>{fileName || 'Файл'}</div>
          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.actionButton}
              onClick={handleDownload}
              title="Скачать"
              data-testid="chat-file-viewer-download"
            >
              <Download size={20} />
            </button>
            <button type="button" className={styles.closeButton} onClick={onClose} title="Закрыть">
              <X size={24} />
            </button>
          </div>
        </div>
        <div className={styles.contentContainer}>
          {loading && (
            <div className={styles.loading}>
              <div className={styles.spinner} />
            </div>
          )}
          {error && (
            <div className={styles.error}>
              <span>{error}</span>
            </div>
          )}
          {!loading && !error && kind === FILE_PREVIEW_KIND.TEXT && (
            <pre className={styles.textContent} data-testid="chat-file-viewer-text">
              <code>{textContent}</code>
            </pre>
          )}
          {!loading && !error && kind === FILE_PREVIEW_KIND.PDF && blobUrl && (
            <iframe
              title={fileName || 'PDF'}
              src={blobUrl}
              className={styles.pdfFrame}
              data-testid="chat-file-viewer-pdf"
            />
          )}
          {!loading && !error && kind === FILE_PREVIEW_KIND.VIDEO && blobUrl && (
            <video
              controls
              src={blobUrl}
              className={styles.videoPlayer}
              data-testid="chat-file-viewer-video"
            />
          )}
          {!loading && kind === FILE_PREVIEW_KIND.OFFICE && (
            <div className={styles.officeHint} data-testid="chat-file-viewer-office">
              <p>Предпросмотр документов Word и Excel в браузере недоступен.</p>
              <p>Нажмите «Скачать», чтобы открыть файл в приложении на устройстве.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
