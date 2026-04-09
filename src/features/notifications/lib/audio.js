/**
 * Воспроизведение звуковых уведомлений через Web Audio API.
 * FSD: features/notifications/lib.
 */
import { isSoundEnabled } from './settings';
import { SOUND_PATTERNS, VOLUME_CONFIG } from './audioConfig';

let audioCtx = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!audioCtx) audioCtx = new AudioCtx();
  return audioCtx;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Воспроизводит один тон через Web Audio API с плавным attack/release.
 * @param {AudioContext} ctx
 * @param {object} options
 * @param {number} options.freq — частота в Гц
 * @param {number} options.durationMs — длительность тона в мс
 * @param {number} [options.gapMs] — пауза после тона в мс (ожидание перед resolve)
 * @param {number} [options.volume] — громкость (ограничивается VOLUME_CONFIG)
 */
async function playTone(ctx, { freq, durationMs, gapMs, volume }) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'square';
  o.frequency.value = freq;
  g.gain.value = 0;
  o.connect(g);
  g.connect(ctx.destination);

  const now = ctx.currentTime;
  const attack = VOLUME_CONFIG.attack;
  const release = VOLUME_CONFIG.release;
  const dur = Math.max(0.02, durationMs / 1000);
  const target = Math.min(
    VOLUME_CONFIG.max,
    Math.max(VOLUME_CONFIG.min, volume ?? VOLUME_CONFIG.default)
  );

  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(target, now + attack);
  g.gain.linearRampToValueAtTime(0, now + dur + release);

  o.start(now);
  o.stop(now + dur + release + 0.01);

  await sleep(durationMs + (gapMs ?? 0));
}

/**
 * Разблокирует AudioContext после жеста пользователя.
 * @returns {Promise<boolean>} true, если контекст успешно запущен.
 */
export async function unlockPagerAudio() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return false;
    if (ctx.state !== 'running') {
      await ctx.resume();
    }
    return ctx.state === 'running';
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('unlockPagerAudio failed:', e);
    }
    return false;
  }
}

/**
 * Воспроизводит звук уведомления.
 * @param {Object} opts
 * @param {string} [opts.pattern='pager'] — имя паттерна ('pager' или 'simple').
 * @returns {Promise<boolean>} true, если звук сыгран успешно.
 */
export async function playPagerNotificationSound(opts = {}) {
  try {
    if (typeof window === 'undefined') return false;
    if (!isSoundEnabled()) return false;

    const ctx = getAudioContext();
    if (!ctx) return false;
    if (ctx.state !== 'running') {
      await ctx.resume();
      if (ctx.state !== 'running') return false;
    }

    const pattern = opts.pattern || 'pager';
    const steps = SOUND_PATTERNS[pattern] || SOUND_PATTERNS.simple;

    for (const step of steps) {
      await playTone(ctx, step);
    }
    return true;
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('playPagerNotificationSound failed:', e);
    }
    return false;
  }
}

/** Сброс кэша AudioContext (для тестов). */
export function _resetAudioContext() {
  audioCtx = null;
}
