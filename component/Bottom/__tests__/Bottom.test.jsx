import { fireEvent, render, screen } from '@testing-library/react';

import Bottom from '../index';

const renderControls = (overrides = {}) => {
  const props = {
    muted: false,
    playing: true,
    toggleAudio: jest.fn(),
    toggleVideo: jest.fn(),
    leaveRoom: jest.fn(),
    participantCount: 4,
    onParticipantsClick: jest.fn(),
    handRaised: false,
    onRaiseHand: jest.fn(),
    isScreenSharing: false,
    onToggleScreenShare: jest.fn(),
    onSettingsClick: jest.fn(),
    ...overrides,
  };

  render(<Bottom {...props} />);
  return props;
};

describe('Bottom room controls', () => {
  it('exposes every primary call action without a nested menu', () => {
    renderControls();

    expect(screen.getByTestId('room-participants-button')).toHaveAccessibleName('Участники: 4');
    expect(screen.getByTestId('room-mic-toggle')).toHaveAccessibleName('Выключить микрофон');
    expect(screen.getByTestId('room-video-toggle')).toHaveAccessibleName('Выключить камеру');
    expect(screen.getByTestId('room-screen-share-toggle')).toHaveAccessibleName('Показать экран');
    expect(screen.getByTestId('room-hand-toggle')).toHaveAccessibleName('Поднять руку');
    expect(screen.getByTestId('room-settings-button')).toBeVisible();
    expect(screen.getByTestId('room-leave-button')).toBeVisible();
  });

  it('routes control clicks to the corresponding actions', () => {
    const props = renderControls();

    fireEvent.click(screen.getByTestId('room-participants-button'));
    fireEvent.click(screen.getByTestId('room-mic-toggle'));
    fireEvent.click(screen.getByTestId('room-video-toggle'));
    fireEvent.click(screen.getByTestId('room-screen-share-toggle'));
    fireEvent.click(screen.getByTestId('room-hand-toggle'));
    fireEvent.click(screen.getByTestId('room-settings-button'));
    fireEvent.click(screen.getByTestId('room-leave-button'));

    expect(props.onParticipantsClick).toHaveBeenCalledTimes(1);
    expect(props.toggleAudio).toHaveBeenCalledTimes(1);
    expect(props.toggleVideo).toHaveBeenCalledTimes(1);
    expect(props.onToggleScreenShare).toHaveBeenCalledTimes(1);
    expect(props.onRaiseHand).toHaveBeenCalledTimes(1);
    expect(props.onSettingsClick).toHaveBeenCalledTimes(1);
    expect(props.leaveRoom).toHaveBeenCalledTimes(1);
  });

  it('shows media state and locks screen sharing while permission is pending', () => {
    renderControls({
      muted: true,
      playing: false,
      handRaised: true,
      isScreenSharing: true,
      screenShareBusy: true,
    });

    expect(screen.getByTestId('room-mic-toggle')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('room-video-toggle')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('room-hand-toggle')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('room-screen-share-toggle')).toBeDisabled();
  });
});
