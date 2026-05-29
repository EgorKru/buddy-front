import {
  applyBackgroundEffect,
  getBackgroundEffect,
  setBackgroundEffect,
} from '../backgroundEffect';
import { BACKGROUND_EFFECT, MEDIA_BACKGROUND_STORAGE_KEY } from '../constants';

describe('backgroundEffect', () => {
  beforeEach(() => {
    localStorage.clear();
    global.MediaStream = jest.fn(function MediaStream(tracks) {
      this._tracks = tracks || [];
      this.getTracks = () => this._tracks;
    });
  });

  it('persists background effect in localStorage', () => {
    setBackgroundEffect(BACKGROUND_EFFECT.BLUR);
    expect(localStorage.getItem(MEDIA_BACKGROUND_STORAGE_KEY)).toBe(BACKGROUND_EFFECT.BLUR);
    expect(getBackgroundEffect()).toBe(BACKGROUND_EFFECT.BLUR);
    setBackgroundEffect(BACKGROUND_EFFECT.NONE);
    expect(getBackgroundEffect()).toBe(BACKGROUND_EFFECT.NONE);
  });

  it('returns input stream unchanged for none effect', () => {
    const stream = { getVideoTracks: () => [{ id: 'v1' }], getAudioTracks: () => [] };
    const { stream: out, stop } = applyBackgroundEffect(stream, BACKGROUND_EFFECT.NONE);
    expect(out).toBe(stream);
    expect(stop).toEqual(expect.any(Function));
  });

  it('creates canvas output stream for blur effect', () => {
    const videoTrack = { kind: 'video', stop: jest.fn() };
    const input = {
      getVideoTracks: () => [videoTrack],
      getAudioTracks: () => [{ kind: 'audio', stop: jest.fn() }],
    };

    const playMock = jest.fn().mockResolvedValue(undefined);
    const videoEl = {
      muted: false,
      playsInline: false,
      autoplay: false,
      srcObject: null,
      videoWidth: 640,
      videoHeight: 480,
      readyState: 2,
      play: playMock,
      pause: jest.fn(),
      addEventListener: jest.fn(),
    };
    const origCreateElement = document.createElement.bind(document);
    jest.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag === 'video') return videoEl;
      return origCreateElement(tag);
    });

    const canvasStream = {
      getVideoTracks: () => [{ stop: jest.fn() }],
      addTrack: jest.fn(),
    };
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({
        filter: '',
        drawImage: jest.fn(),
      }),
      captureStream: jest.fn(() => canvasStream),
    };
    jest.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag === 'video') return videoEl;
      if (tag === 'canvas') return canvas;
      return origCreateElement(tag);
    });

    global.requestAnimationFrame = jest.fn((cb) => {
      cb();
      return 1;
    });
    global.cancelAnimationFrame = jest.fn();

    const { stream, stop } = applyBackgroundEffect(input, BACKGROUND_EFFECT.BLUR);
    expect(canvas.captureStream).toHaveBeenCalledWith(30);
    expect(stream).toBe(canvasStream);
    expect(canvasStream.addTrack).toHaveBeenCalled();
    expect(() => stop()).not.toThrow();
  });
});
