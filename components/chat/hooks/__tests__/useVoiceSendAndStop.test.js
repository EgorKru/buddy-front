import { renderHook, act } from '@testing-library/react';
import { useVoiceSendAndStop } from '../useVoiceSendAndStop';

describe('useVoiceSendAndStop', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should call handleVoiceSendSimple with blob when not recording and audioBlob exists', async () => {
    const handleVoiceSendSimple = jest.fn().mockResolvedValue(undefined);
    const blob = new Blob(['audio'], { type: 'audio/webm' });

    const { result } = renderHook(() =>
      useVoiceSendAndStop({
        isRecording: false,
        handleStopRecording: jest.fn(),
        handleVoiceSendSimple,
        voiceRecording: {},
        audioBlob: blob,
        previewBlob: null,
      })
    );

    await act(async () => {
      await result.current();
    });

    expect(handleVoiceSendSimple).toHaveBeenCalledWith(blob);
  });

  it('should call handleVoiceSendSimple with undefined when not recording and no blob', async () => {
    const handleVoiceSendSimple = jest.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useVoiceSendAndStop({
        isRecording: false,
        handleStopRecording: jest.fn(),
        handleVoiceSendSimple,
        voiceRecording: {},
        audioBlob: null,
        previewBlob: null,
      })
    );

    await act(async () => {
      await result.current();
    });

    expect(handleVoiceSendSimple).toHaveBeenCalledWith(undefined);
  });

  it('should call handleStopRecording when isRecording is true', async () => {
    const handleStopRecording = jest.fn();
    const handleVoiceSendSimple = jest.fn().mockResolvedValue(undefined);
    const chunkBlob = new Blob(['audio'], { type: 'audio/webm' });
    const audioChunksRef = { current: [chunkBlob] };

    const { result } = renderHook(() =>
      useVoiceSendAndStop({
        isRecording: true,
        handleStopRecording,
        handleVoiceSendSimple,
        voiceRecording: { isRecording: false, audioChunksRef },
        audioBlob: null,
        previewBlob: null,
      })
    );

    const promise = result.current();
    expect(handleStopRecording).toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(150);
      return promise;
    });
    expect(handleVoiceSendSimple).toHaveBeenCalledWith(expect.any(Blob));
  });
});
