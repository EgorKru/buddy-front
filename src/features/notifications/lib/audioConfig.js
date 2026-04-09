/** Конфиг звуковых паттернов и громкости. FSD: features/notifications/lib */
export const VOLUME_CONFIG = {
  default: 0.045,
  min: 0.01,
  max: 0.08,
  attack: 0.005,
  release: 0.03,
};

export const SOUND_PATTERNS = {
  pager: [
    { freq: 880, durationMs: 70, gapMs: 50 },
    { freq: 880, durationMs: 70, gapMs: 240 },
    { freq: 740, durationMs: 80, gapMs: 50 },
    { freq: 740, durationMs: 80, gapMs: 0 },
  ],
  simple: [{ freq: 880, durationMs: 80, gapMs: 0 }],
};
