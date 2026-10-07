export const VIDEO_NOTE_FILE_PREFIX = 'pager-video-note-';
export const VIDEO_NOTE_MAX_SECONDS = 60;

export function isVideoNoteMessage(message) {
  return Boolean(
    message?.type === 'FILE' &&
    String(message?.mimeType || '')
      .toLowerCase()
      .startsWith('video/') &&
    String(message?.fileName || '')
      .toLowerCase()
      .startsWith(VIDEO_NOTE_FILE_PREFIX)
  );
}

export function getSupportedVideoNoteMimeType(MediaRecorderClass = globalThis.MediaRecorder) {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4',
  ];
  if (!MediaRecorderClass?.isTypeSupported) return '';
  return candidates.find((mimeType) => MediaRecorderClass.isTypeSupported(mimeType)) || '';
}

export function createVideoNoteFile(blob, timestamp = Date.now()) {
  const mimeType = blob?.type || 'video/webm';
  const extension = mimeType.includes('mp4') ? 'mp4' : 'webm';
  return new File([blob], `${VIDEO_NOTE_FILE_PREFIX}${timestamp}.${extension}`, { type: mimeType });
}
