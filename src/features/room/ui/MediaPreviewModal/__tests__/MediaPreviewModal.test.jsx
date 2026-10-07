import { act, fireEvent, render, screen } from '@testing-library/react';

import { useMediaDevices } from '@/hooks/useMediaDevices';
import MediaPreviewModal from '../MediaPreviewModal';

jest.mock('@/hooks/useMediaDevices', () => ({
  useMediaDevices: jest.fn(),
}));

const startPreview = jest.fn(() => Promise.resolve(null));
const stopPreview = jest.fn();

function mediaState(overrides = {}) {
  return {
    devices: { cameras: [], microphones: [] },
    selectedCamera: '',
    selectedMicrophone: '',
    localStream: null,
    audioEnabled: true,
    videoEnabled: true,
    isLoading: false,
    error: null,
    permissionGranted: true,
    audioLevel: 0,
    isMicWorking: false,
    startPreview,
    stopPreview,
    toggleAudio: jest.fn(),
    toggleVideo: jest.fn(),
    switchCamera: jest.fn(),
    switchMicrophone: jest.fn(),
    getStream: jest.fn(),
    setError: jest.fn(),
    backgroundEffect: 'none',
    setBackgroundEffect: jest.fn(),
    ...overrides,
  };
}

describe('MediaPreviewModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('prevents joining before the first device initialization has settled', async () => {
    const onConfirm = jest.fn();
    let finishPreview;
    startPreview.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishPreview = resolve;
        })
    );
    // The hook is not loading during the first render; its effect starts acquisition afterwards.
    // The modal must remain locked during this frame as well.
    useMediaDevices.mockReturnValue(mediaState({ isLoading: false }));

    render(<MediaPreviewModal isOpen onClose={jest.fn()} onConfirm={onConfirm} />);

    const confirm = screen.getByTestId('meet-preview-confirm');
    expect(confirm).toBeDisabled();
    expect(confirm).toHaveTextContent('Проверяем устройства...');

    fireEvent.click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();

    await act(async () => {
      finishPreview(null);
      await Promise.resolve();
    });
    expect(confirm).toBeEnabled();
  });
});
