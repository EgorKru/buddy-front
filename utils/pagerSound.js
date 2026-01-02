let audioCtx = null;

const getAudioContext = () => {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!audioCtx) audioCtx = new AudioCtx();
  return audioCtx;
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const unlockPagerAudio = async () => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return false;
    if (ctx.state !== 'running') {
      await ctx.resume();
    }
    return ctx.state === 'running';
  } catch (e) {
    return false;
  }
};

const playTone = async (ctx, { freq, durationMs, gapMs, volume }) => {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'square';
  o.frequency.value = freq;
  g.gain.value = 0;
  o.connect(g);
  g.connect(ctx.destination);

  const now = ctx.currentTime;
  const attack = 0.005;
  const release = 0.03;
  const dur = Math.max(0.02, durationMs / 1000);
  const target = Math.min(0.08, Math.max(0.01, volume ?? 0.045));

  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(target, now + attack);
  g.gain.linearRampToValueAtTime(0, now + dur + release);

  o.start(now);
  o.stop(now + dur + release + 0.01);

  await sleep(durationMs + (gapMs ?? 0));
};

export const playPagerNotificationSound = async (opts = {}) => {
  try {
    if (typeof window === 'undefined') return false;
    const disabled = localStorage.getItem('disable_notification_sound') === 'true';
    if (disabled) return false;

    const ctx = getAudioContext();
    if (!ctx) return false;
    if (ctx.state !== 'running') {
      await ctx.resume();
      if (ctx.state !== 'running') return false;
    }

    const pattern = opts.pattern || 'pager';

    if (pattern === 'pager') {
      // “Пейджер”: bip-bip … пауза … bip-bip (похоже на классические)
      const seq = [
        { freq: 880, durationMs: 70, gapMs: 50 },
        { freq: 880, durationMs: 70, gapMs: 240 },
        { freq: 740, durationMs: 80, gapMs: 50 },
        { freq: 740, durationMs: 80, gapMs: 0 },
      ];
      for (const step of seq) {
        await playTone(ctx, step);
      }
      return true;
    }

    // fallback single beep
    await playTone(ctx, { freq: 880, durationMs: 80, gapMs: 0 });
    return true;
  } catch (e) {
    return false;
  }
};


