/**
 * Интеграционный тест цепочки захвата: порядок вызовов и SLA на синтетических задержках.
 */
import { acquireMediaStream, assertMediaSla } from '../acquireMediaStream';
import { CAMERA_SLA_MS, MIC_SLA_MS } from '../constants';

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('acquireMediaStream integration', () => {
  beforeEach(() => {
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
          if (constraints.audio) {
            await delay(80);
            return {
              getTracks: () => [{ kind: 'audio', stop: jest.fn() }],
              getAudioTracks: () => [{ kind: 'audio', stop: jest.fn() }],
              getVideoTracks: () => [],
            };
          }
          await delay(400);
          return {
            getTracks: () => [{ kind: 'video', stop: jest.fn() }],
            getAudioTracks: () => [],
            getVideoTracks: () => [{ kind: 'video', stop: jest.fn() }],
          };
        }),
      },
    });
  });

  it('mic is ready well before camera under realistic delays', async () => {
    const micCallbacks = [];
    const { micReadyMs, cameraReadyMs } = await acquireMediaStream({
      audio: true,
      video: true,
      onMicReady: () => micCallbacks.push(Date.now()),
    });

    expect(micCallbacks).toHaveLength(1);
    expect(micReadyMs).toBeLessThan(cameraReadyMs);
    expect(micReadyMs).toBeLessThanOrEqual(MIC_SLA_MS);
    expect(cameraReadyMs).toBeLessThanOrEqual(CAMERA_SLA_MS);
    assertMediaSla({ micReadyMs, cameraReadyMs, videoRequested: true });
  });

  it('fails SLA check when camera is too slow', () => {
    expect(() =>
      assertMediaSla({
        micReadyMs: 50,
        cameraReadyMs: CAMERA_SLA_MS + 1,
        videoRequested: true,
      })
    ).toThrow(/Камера/);
  });

  it('audio-only path never waits for camera', async () => {
    const result = await acquireMediaStream({ audio: true, video: false });
    expect(result.cameraReadyMs).toBeNull();
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
    expect(result.micReadyMs).toBeLessThanOrEqual(MIC_SLA_MS);
  });
});
