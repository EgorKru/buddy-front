export {
  CAMERA_SLA_MS,
  MIC_SLA_MS,
  BACKGROUND_EFFECT,
  MEDIA_BACKGROUND_STORAGE_KEY,
} from './constants';
export { buildAudioConstraints, buildVideoConstraints } from './buildConstraints';
export {
  acquireMediaStream,
  assertMediaSla,
  stopMediaStream,
  publishMediaTimings,
} from './acquireMediaStream';
export {
  applyBackgroundEffect,
  getBackgroundEffect,
  setBackgroundEffect,
} from './backgroundEffect';

import { applyBackgroundEffect, getBackgroundEffect } from './backgroundEffect';

/**
 * Собирает отображаемый/исходящий поток с эффектом фона.
 */
export function buildProcessedMediaStream(rawStream, { effect, effectStopRef } = {}) {
  const resolvedEffect = effect ?? getBackgroundEffect();
  if (effectStopRef?.current) {
    effectStopRef.current();
    effectStopRef.current = null;
  }
  const { stream, stop } = applyBackgroundEffect(rawStream, resolvedEffect);
  if (effectStopRef) {
    effectStopRef.current = stop;
  }
  return stream;
}
