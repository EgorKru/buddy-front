import { act, renderHook, waitFor } from '@testing-library/react';
import { useVideoNoteRecorder } from '../useVideoNoteRecorder';

class FakeMediaRecorder {
  static isTypeSupported(type) {
    return type.startsWith('video/webm');
  }

  constructor(stream, options = {}) {
    this.stream = stream;
    this.mimeType = options.mimeType || 'video/webm';
    this.state = 'inactive';
  }

  start() {
    this.state = 'recording';
  }

  stop() {
    this.ondataavailable?.({ data: new Blob(['recorded-video'], { type: this.mimeType }) });
    this.state = 'inactive';
    this.onstop?.();
  }
}

const createStream = () => {
  const track = { stop: jest.fn() };
  return { stream: { getTracks: () => [track] }, track };
};

describe('useVideoNoteRecorder', () => {
  const originalMediaRecorder = global.MediaRecorder;

  beforeEach(() => {
    global.MediaRecorder = FakeMediaRecorder;
  });

  afterEach(() => {
    global.MediaRecorder = originalMediaRecorder;
    jest.restoreAllMocks();
  });

  it('записывает, освобождает камеру и отправляет маркированный файл', async () => {
    const { stream, track } = createStream();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: jest.fn().mockResolvedValue(stream) },
    });
    const onSend = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useVideoNoteRecorder({ onSend }));

    await act(async () => {
      await result.current.start();
    });
    expect(result.current.isRecording).toBe(true);

    act(() => result.current.send());
    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(1));
    const [file, duration] = onSend.mock.calls[0];
    expect(file.name).toMatch(/^pager-video-note-\d+\.webm$/);
    expect(file.type).toContain('video/webm');
    expect(duration).toBeGreaterThanOrEqual(1);
    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(result.current.isRecording).toBe(false);
  });

  it('не включает запись после отмены, пока браузер ещё запрашивает камеру', async () => {
    const { stream, track } = createStream();
    let resolveMedia;
    const mediaPromise = new Promise((resolve) => {
      resolveMedia = resolve;
    });
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: jest.fn(() => mediaPromise) },
    });
    const { result } = renderHook(() => useVideoNoteRecorder({ onSend: jest.fn() }));

    let startPromise;
    act(() => {
      startPromise = result.current.start();
    });
    act(() => result.current.cancel());
    await act(async () => {
      resolveMedia(stream);
      await startPromise;
    });

    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(result.current.isRecording).toBe(false);
  });
});
