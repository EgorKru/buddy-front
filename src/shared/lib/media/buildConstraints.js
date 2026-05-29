export function buildAudioConstraints(deviceId) {
  const base = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  };
  if (deviceId) {
    return { ...base, deviceId: { exact: deviceId } };
  }
  return base;
}

export function buildVideoConstraints(deviceId) {
  const base = {
    facingMode: 'user',
    width: { ideal: 1280, max: 1920 },
    height: { ideal: 720, max: 1080 },
    frameRate: { ideal: 30, max: 30 },
  };
  if (deviceId) {
    return { ...base, deviceId: { exact: deviceId } };
  }
  return base;
}
