import { buildAudioConstraints, buildVideoConstraints } from '../buildConstraints';

describe('buildConstraints', () => {
  it('builds audio constraints with device id', () => {
    expect(buildAudioConstraints('mic-1')).toEqual({
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      deviceId: { exact: 'mic-1' },
    });
  });

  it('builds video constraints with device id and quality hints', () => {
    const c = buildVideoConstraints('cam-1');
    expect(c.deviceId).toEqual({ exact: 'cam-1' });
    expect(c.facingMode).toBe('user');
    expect(c.width.ideal).toBe(1280);
    expect(c.frameRate.max).toBe(30);
  });
});
