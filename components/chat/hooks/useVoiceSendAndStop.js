import { useRef, useEffect, useCallback } from 'react';

const VOICE_BLOB_WAIT_MS = 100;
const VOICE_BLOB_MAX_ATTEMPTS = 50;

function getBlobFromChunks(audioChunksRef) {
  const chunks = audioChunksRef?.current || [];
  if (chunks.length === 0) return null;
  try {
    const blob = new Blob(chunks, { type: 'audio/webm' });
    return blob?.size > 0 ? blob : null;
  } catch (_e) {
    return null;
  }
}

/**
 * Возвращает колбэк: остановить запись (если идёт), дождаться blob и отправить голосовое сообщение.
 */
export function useVoiceSendAndStop({
  isRecording,
  handleStopRecording,
  handleVoiceSendSimple,
  voiceRecording,
  audioBlob,
  previewBlob,
}) {
  const audioBlobRef = useRef(audioBlob);
  const previewBlobRef = useRef(previewBlob);

  useEffect(() => {
    audioBlobRef.current = audioBlob;
  }, [audioBlob]);
  useEffect(() => {
    previewBlobRef.current = previewBlob;
  }, [previewBlob]);

  const waitForFinalBlob = useCallback(async () => {
    let attempts = 0;
    let finalBlob = null;

    while (attempts < VOICE_BLOB_MAX_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, VOICE_BLOB_WAIT_MS));

      if (audioBlobRef.current?.size > 0) {
        finalBlob = audioBlobRef.current;
        break;
      }

      const blobFromChunks = getBlobFromChunks(voiceRecording?.audioChunksRef);
      if (blobFromChunks) finalBlob = blobFromChunks;

      if (!finalBlob && previewBlobRef.current?.size > 0) finalBlob = previewBlobRef.current;
      if (!finalBlob && previewBlob?.size > 0) finalBlob = previewBlob;
      if (!finalBlob && audioBlob?.size > 0) finalBlob = audioBlob;

      const stillRecording = voiceRecording?.isRecording ?? false;
      if (finalBlob?.size > 0 && !stillRecording) break;

      attempts++;
    }

    if (!finalBlob) {
      finalBlob = getBlobFromChunks(voiceRecording?.audioChunksRef) || finalBlob;
    }

    return finalBlob;
  }, [voiceRecording, audioBlob, previewBlob]);

  const handleVoiceSendAndStop = useCallback(async () => {
    if (isRecording) {
      handleStopRecording();
      const finalBlob = await waitForFinalBlob();
      await handleVoiceSendSimple(finalBlob?.size > 0 ? finalBlob : undefined);
    } else {
      const currentBlob =
        audioBlobRef.current || previewBlobRef.current || audioBlob || previewBlob;
      await handleVoiceSendSimple(currentBlob?.size > 0 ? currentBlob : undefined);
    }
  }, [
    isRecording,
    handleStopRecording,
    waitForFinalBlob,
    handleVoiceSendSimple,
    audioBlob,
    previewBlob,
  ]);

  return handleVoiceSendAndStop;
}
