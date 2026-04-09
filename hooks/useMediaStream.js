import { useState, useEffect, useRef } from 'react';

const useMediaStream = () => {
  const [stream, setStream] = useState(null);
  const [error, setError] = useState(null);
  const streamRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Медиа устройства не поддерживаются в этом браузере или требуется HTTPS');
      return;
    }

    let active = true;

    const attachStream = (s) => {
      streamRef.current = s;
      setStream(s);
    };

    const stopStream = (s) => {
      if (!s) return;
      s.getTracks().forEach((t) => t.stop());
    };

    const init = async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        if (!active) {
          stopStream(s);
          return;
        }
        attachStream(s);
      } catch (e) {
        setError(e?.message || 'Failed to access camera/microphone');
        try {
          const s = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          if (!active) {
            stopStream(s);
            return;
          }
          attachStream(s);
        } catch (audioError) {
          setError(audioError?.message || 'Не удалось получить доступ к микрофону');
        }
      }
    };

    init();

    return () => {
      active = false;
      stopStream(streamRef.current);
      streamRef.current = null;
    };
  }, []);

  return { stream, error };
};

export default useMediaStream;
