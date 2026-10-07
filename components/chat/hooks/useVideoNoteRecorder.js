import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createVideoNoteFile,
  getSupportedVideoNoteMimeType,
  VIDEO_NOTE_MAX_SECONDS,
} from '@/shared/lib/chat/videoNote';

const stopTracks = (stream) => {
  stream?.getTracks?.().forEach((track) => track.stop());
};

export function useVideoNoteRecorder({ onSend, maxDuration = VIDEO_NOTE_MAX_SECONDS } = {}) {
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState('');
  const [stream, setStream] = useState(null);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const startedAtRef = useRef(0);
  const actionRef = useRef('cancel');
  const timerRef = useRef(null);
  const limitRef = useRef(null);
  const generationRef = useRef(0);
  const onSendRef = useRef(onSend);

  useEffect(() => {
    onSendRef.current = onSend;
  }, [onSend]);

  const clearTimers = useCallback(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    if (limitRef.current) window.clearTimeout(limitRef.current);
    timerRef.current = null;
    limitRef.current = null;
  }, []);

  const releaseStream = useCallback(() => {
    stopTracks(streamRef.current);
    streamRef.current = null;
    setStream(null);
  }, []);

  const stop = useCallback(
    (action = 'send') => {
      actionRef.current = action;
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        recorder.stop();
        return;
      }
      clearTimers();
      releaseStream();
      setIsRecording(false);
    },
    [clearTimers, releaseStream]
  );

  const start = useCallback(async () => {
    if (isRecording || isUploading) return false;
    setError('');
    const generation = generationRef.current + 1;
    generationRef.current = generation;

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Запись видеокружков не поддерживается этим браузером');
      return false;
    }

    try {
      const nextStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: {
          facingMode: 'user',
          width: { ideal: 720 },
          height: { ideal: 720 },
          aspectRatio: { ideal: 1 },
        },
      });
      if (generation !== generationRef.current) {
        stopTracks(nextStream);
        return false;
      }

      const mimeType = getSupportedVideoNoteMimeType();
      const recorder = mimeType
        ? new MediaRecorder(nextStream, { mimeType, videoBitsPerSecond: 1_800_000 })
        : new MediaRecorder(nextStream);
      recorderRef.current = recorder;
      streamRef.current = nextStream;
      chunksRef.current = [];
      startedAtRef.current = Date.now();
      actionRef.current = 'cancel';

      recorder.ondataavailable = (event) => {
        if (event.data?.size) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        setError('Не удалось записать видеокружок');
        actionRef.current = 'cancel';
      };
      recorder.onstop = async () => {
        const elapsed = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || mimeType || 'video/webm',
        });
        const shouldSend = actionRef.current === 'send' && blob.size > 0;
        recorderRef.current = null;
        chunksRef.current = [];
        clearTimers();
        releaseStream();
        setIsRecording(false);
        setDuration(0);

        if (!shouldSend) return;
        setIsUploading(true);
        try {
          await onSendRef.current?.(createVideoNoteFile(blob), elapsed);
        } catch (sendError) {
          setError(sendError?.message || 'Не удалось отправить видеокружок');
        } finally {
          setIsUploading(false);
        }
      };

      recorder.start(250);
      setStream(nextStream);
      setDuration(0);
      setIsRecording(true);
      timerRef.current = window.setInterval(() => {
        setDuration(Math.min(maxDuration, Math.floor((Date.now() - startedAtRef.current) / 1000)));
      }, 250);
      limitRef.current = window.setTimeout(() => stop('send'), maxDuration * 1000);
      return true;
    } catch (mediaError) {
      setError(
        mediaError?.name === 'NotAllowedError'
          ? 'Разрешите доступ к камере и микрофону'
          : 'Камера или микрофон сейчас недоступны'
      );
      setIsRecording(false);
      return false;
    }
  }, [clearTimers, isRecording, isUploading, maxDuration, releaseStream, stop]);

  const cancel = useCallback(() => {
    generationRef.current += 1;
    stop('cancel');
  }, [stop]);

  const send = useCallback(() => stop('send'), [stop]);

  useEffect(
    () => () => {
      generationRef.current += 1;
      actionRef.current = 'cancel';
      clearTimers();
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== 'inactive') recorder.stop();
      stopTracks(streamRef.current);
    },
    [clearTimers]
  );

  return { isRecording, isUploading, duration, error, stream, start, send, cancel };
}
