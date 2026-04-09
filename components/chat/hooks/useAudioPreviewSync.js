import { useEffect } from 'react';

/**
 * Выбирает blob для установки в audio.src: приоритет — чанки, затем previewBlob, затем audioBlob.
 * Возвращает { blob, lastChunksCount, lastBlobSize } или { blob: null } если обновлять не нужно.
 */
function pickBlobForAudioSrc(chunks, previewBlob, audioBlob, lastChunksCount, lastBlobSize) {
  if (chunks?.length > 0) {
    const currentSize = chunks.reduce((sum, chunk) => sum + (chunk.size || 0), 0);
    if (chunks.length === lastChunksCount && currentSize === lastBlobSize) {
      return { blob: null, lastChunksCount, lastBlobSize };
    }
    const blob = new Blob(Array.from(chunks), { type: 'audio/webm' });
    return blob?.size > 0
      ? { blob, lastChunksCount: chunks.length, lastBlobSize: currentSize }
      : { blob: null, lastChunksCount, lastBlobSize };
  }
  if (previewBlob?.size > 0) {
    return { blob: previewBlob, lastChunksCount, lastBlobSize };
  }
  if (audioBlob?.size > 0) {
    return { blob: audioBlob, lastChunksCount, lastBlobSize };
  }
  return { blob: null, lastChunksCount, lastBlobSize };
}

/**
 * Синхронизирует src аудио-элемента с blob-данными записи (chunks, previewBlob, audioBlob).
 * Обновляет audio.src при изменении записанных чанков и отзывает старые blob URL.
 */
export function useAudioPreviewSync(
  audioPreviewRef,
  isRecording,
  isLocked,
  voiceRecording,
  isPlayingPreview
) {
  const { previewBlob, audioBlob, audioChunksRef } = voiceRecording || {};

  useEffect(() => {
    if (!audioPreviewRef?.current || !isRecording || !isLocked) return;

    let currentBlobUrl = null;
    let lastChunksCount = 0;
    let lastBlobSize = 0;
    const revokedUrls = new Set();

    const revokeOldUrl = (url) => {
      if (!url || !url.startsWith('blob:') || revokedUrls.has(url)) return;
      revokedUrls.add(url);
      setTimeout(() => {
        try {
          URL.revokeObjectURL(url);
        } catch (_e) {}
      }, 500);
    };

    const setAudioSrcFromBlob = (blob) => {
      const audio = audioPreviewRef.current;
      if (!audio || !blob || blob.size === 0) return;

      try {
        const url = URL.createObjectURL(blob);
        const oldSrc = audio.src;

        audio.src = url;

        if (oldSrc && oldSrc.startsWith('blob:') && oldSrc !== url) {
          audio.addEventListener('loadeddata', () => revokeOldUrl(oldSrc), { once: true });
        }
        if (currentBlobUrl && currentBlobUrl !== url) {
          revokeOldUrl(currentBlobUrl);
        }
        currentBlobUrl = url;
        if (audio.readyState === 0) audio.load();
      } catch (_error) {}
    };

    const updateAudioSrc = () => {
      const audio = audioPreviewRef.current;
      if (!audio) return;

      const isCurrentlyPlaying =
        !audio.paused && !audio.ended && audio.currentTime > 0 && audio.readyState > 2;
      if (isCurrentlyPlaying || isPlayingPreview) return;

      const chunksRef = audioChunksRef || { current: [] };
      const chunks = chunksRef.current || [];
      const {
        blob,
        lastChunksCount: nextChunks,
        lastBlobSize: nextSize,
      } = pickBlobForAudioSrc(chunks, previewBlob, audioBlob, lastChunksCount, lastBlobSize);

      lastChunksCount = nextChunks;
      lastBlobSize = nextSize;
      if (!blob) return;

      const shouldSetSrc = chunks.length > 0 || !currentBlobUrl || !audio.src?.startsWith('blob:');
      if (shouldSetSrc) setAudioSrcFromBlob(blob);
    };

    updateAudioSrc();
    const interval = setInterval(() => {
      if (audioPreviewRef.current) updateAudioSrc();
    }, 1000);

    return () => {
      clearInterval(interval);
      if (currentBlobUrl?.startsWith('blob:') && !revokedUrls.has(currentBlobUrl)) {
        setTimeout(() => {
          try {
            URL.revokeObjectURL(currentBlobUrl);
          } catch (_e) {}
        }, 1000);
      }
    };
  }, [
    previewBlob,
    audioBlob,
    isRecording,
    isLocked,
    audioPreviewRef,
    voiceRecording,
    isPlayingPreview,
    audioChunksRef,
  ]);
}
