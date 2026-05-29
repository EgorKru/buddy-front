import { acquireMediaStream, assertMediaSla, publishMediaTimings } from '../acquireMediaStream';
import { CAMERA_SLA_MS, MIC_SLA_MS } from '../constants';

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mockTrack(kind) {
  return { kind, enabled: true, stop: jest.fn() };
}

function mockStream(tracks) {
  return {
    getTracks: () => tracks,
    getAudioTracks: () => tracks.filter((t) => t.kind === 'audio'),
    getVideoTracks: () => tracks.filter((t) => t.kind === 'video'),
  };
}

describe('acquireMediaStream', () => {
  let callIndex;

  beforeEach(() => {
    callIndex = 0;
    global.MediaStream = jest.fn(function MediaStream(tracks) {
      this._tracks = tracks || [];
      this.getTracks = () => this._tracks;
      this.getAudioTracks = () => this._tracks.filter((t) => t.kind === 'audio');
      this.getVideoTracks = () => this._tracks.filter((t) => t.kind === 'video');
    });

    Object.defineProperty(global.navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: jest.fn(async (constraints) => {
          callIndex += 1;
          if (constraints.audio) {
            await delay(40);
            return mockStream([mockTrack('audio')]);
          }
          if (constraints.video) {
            await delay(120);
            return mockStream([mockTrack('video')]);
          }
          return mockStream([]);
        }),
      },
    });
  });

  it('requests microphone before camera in separate calls', async () => {
    const order = [];
    const onMicReady = jest.fn(() => order.push('mic'));
    const onCameraReady = jest.fn(() => order.push('camera'));

    const { stream, micReadyMs, cameraReadyMs } = await acquireMediaStream({
      audio: true,
      video: true,
      onMicReady,
      onCameraReady,
    });

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(2);
    expect(navigator.mediaDevices.getUserMedia.mock.calls[0][0].audio).toBeTruthy();
    expect(navigator.mediaDevices.getUserMedia.mock.calls[0][0].video).toBeFalsy();
    expect(navigator.mediaDevices.getUserMedia.mock.calls[1][0].video).toBeTruthy();
    expect(navigator.mediaDevices.getUserMedia.mock.calls[1][0].audio).toBeFalsy();
    expect(order).toEqual(['mic', 'camera']);
    expect(stream.getAudioTracks()).toHaveLength(1);
    expect(stream.getVideoTracks()).toHaveLength(1);
    expect(micReadyMs).toBeLessThan(cameraReadyMs);
    assertMediaSla({ micReadyMs, cameraReadyMs, videoRequested: true });
    expect(micReadyMs).toBeLessThanOrEqual(MIC_SLA_MS);
    expect(cameraReadyMs).toBeLessThanOrEqual(CAMERA_SLA_MS);
  });

  it('publishes timings for Playwright when enabled', async () => {
    const prev = process.env.NEXT_PUBLIC_PLAYWRIGHT_TEST;
    process.env.NEXT_PUBLIC_PLAYWRIGHT_TEST = '1';
    window.__lastMediaAcquisition = null;

    await acquireMediaStream({ audio: true, video: true });

    expect(window.__lastMediaAcquisition).toEqual(
      expect.objectContaining({
        micReadyMs: expect.any(Number),
        cameraReadyMs: expect.any(Number),
        totalMs: expect.any(Number),
      })
    );

    publishMediaTimings({ micReadyMs: 1, cameraReadyMs: 2, totalMs: 3 });
    expect(window.__lastMediaAcquisition.micReadyMs).toBe(1);

    process.env.NEXT_PUBLIC_PLAYWRIGHT_TEST = prev;
  });
});
