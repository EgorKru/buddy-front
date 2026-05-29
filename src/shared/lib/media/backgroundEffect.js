import { BACKGROUND_EFFECT, MEDIA_BACKGROUND_STORAGE_KEY } from './constants';

const MAX_PROCESS_WIDTH = 960;

export function getBackgroundEffect() {
  if (typeof window === 'undefined') return BACKGROUND_EFFECT.NONE;
  try {
    const stored = window.localStorage.getItem(MEDIA_BACKGROUND_STORAGE_KEY);
    if (stored === BACKGROUND_EFFECT.BLUR) return BACKGROUND_EFFECT.BLUR;
  } catch {
    // ignore
  }
  return BACKGROUND_EFFECT.NONE;
}

export function setBackgroundEffect(effect) {
  if (typeof window === 'undefined') return;
  const value = effect === BACKGROUND_EFFECT.BLUR ? BACKGROUND_EFFECT.BLUR : BACKGROUND_EFFECT.NONE;
  try {
    window.localStorage.setItem(MEDIA_BACKGROUND_STORAGE_KEY, value);
  } catch {
    // ignore
  }
}

/**
 * Применяет эффект к видеотреку. Аудио передаётся без изменений.
 * @returns {{ stream: MediaStream, stop: () => void }}
 */
export function applyBackgroundEffect(inputStream, effect = BACKGROUND_EFFECT.NONE) {
  if (
    !inputStream ||
    effect === BACKGROUND_EFFECT.NONE ||
    typeof document === 'undefined' ||
    !inputStream.getVideoTracks().length
  ) {
    return { stream: inputStream, stop: () => {} };
  }

  const videoTrack = inputStream.getVideoTracks()[0];
  const videoEl = document.createElement('video');
  videoEl.muted = true;
  videoEl.playsInline = true;
  videoEl.autoplay = true;
  videoEl.srcObject = new MediaStream([videoTrack]);

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  const outputStream = canvas.captureStream(30);

  inputStream.getAudioTracks().forEach((track) => {
    outputStream.addTrack(track);
  });

  let rafId = null;
  let stopped = false;

  const render = () => {
    if (stopped) return;
    const vw = videoEl.videoWidth || 640;
    const vh = videoEl.videoHeight || 480;
    if (vw > 0 && vh > 0) {
      const scale = Math.min(1, MAX_PROCESS_WIDTH / vw);
      const w = Math.round(vw * scale);
      const h = Math.round(vh * scale);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      ctx.filter = 'blur(16px) saturate(1.05)';
      ctx.drawImage(videoEl, 0, 0, w, h);
      ctx.filter = 'none';
      const padX = w * 0.12;
      const padY = h * 0.08;
      ctx.drawImage(videoEl, padX, padY, w - padX * 2, h - padY * 2);
    }
    rafId = requestAnimationFrame(render);
  };

  const start = () => {
    videoEl
      .play()
      .then(() => {
        render();
      })
      .catch(() => {});
  };

  if (videoEl.readyState >= 2) {
    start();
  } else {
    videoEl.addEventListener('loadeddata', start, { once: true });
  }

  const stop = () => {
    stopped = true;
    if (rafId != null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    videoEl.pause();
    videoEl.srcObject = null;
    outputStream.getVideoTracks().forEach((t) => {
      try {
        t.stop();
      } catch {
        // ignore
      }
    });
  };

  return { stream: outputStream, stop };
}
