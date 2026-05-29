import { CAMERA_SLA_MS, MIC_SLA_MS } from './constants';
import { buildAudioConstraints, buildVideoConstraints } from './buildConstraints';

function nowMs() {
  if (typeof performance !== 'undefined' && performance.now) {
    return performance.now();
  }
  return Date.now();
}

export function publishMediaTimings(timings) {
  if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_PLAYWRIGHT_TEST === '1') {
    window.__lastMediaAcquisition = { ...timings, at: Date.now() };
  }
}

/**
 * Двухфазный захват: сначала микрофон, затем камера (отдельные getUserMedia).
 * @returns {{ stream: MediaStream, micReadyMs: number|null, cameraReadyMs: number|null }}
 */
export async function acquireMediaStream({
  audio = true,
  video = false,
  cameraDeviceId,
  microphoneDeviceId,
  onMicReady,
  onCameraReady,
} = {}) {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('MediaDevices API недоступен');
  }

  const startedAt = nowMs();
  const tracks = [];
  let micReadyMs = null;
  let cameraReadyMs = null;

  if (audio) {
    const audioStream = await navigator.mediaDevices.getUserMedia({
      audio: buildAudioConstraints(microphoneDeviceId),
      video: false,
    });
    micReadyMs = Math.round(nowMs() - startedAt);
    audioStream.getAudioTracks().forEach((track) => tracks.push(track));
    onMicReady?.(audioStream);
  }

  if (video) {
    const videoStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: buildVideoConstraints(cameraDeviceId),
    });
    cameraReadyMs = Math.round(nowMs() - startedAt);
    videoStream.getVideoTracks().forEach((track) => tracks.push(track));
    onCameraReady?.(videoStream);
  }

  const stream = new MediaStream(tracks);
  const timings = {
    micReadyMs,
    cameraReadyMs,
    totalMs: Math.round(nowMs() - startedAt),
  };
  publishMediaTimings(timings);

  return { stream, ...timings };
}

export function assertMediaSla({
  micReadyMs,
  cameraReadyMs,
  videoRequested = false,
  audioRequested = true,
}) {
  if (audioRequested && micReadyMs != null && micReadyMs > MIC_SLA_MS) {
    throw new Error(`Микрофон: ${micReadyMs}ms > SLA ${MIC_SLA_MS}ms`);
  }
  if (videoRequested && cameraReadyMs != null && cameraReadyMs > CAMERA_SLA_MS) {
    throw new Error(`Камера: ${cameraReadyMs}ms > SLA ${CAMERA_SLA_MS}ms`);
  }
}

export function stopMediaStream(stream) {
  if (!stream) return;
  stream.getTracks().forEach((track) => {
    try {
      track.stop();
    } catch {
      // ignore
    }
  });
}
