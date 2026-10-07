import { fireEvent, render, screen } from '@testing-library/react';

import RoomSettingsModal from '../RoomSettingsModal';

const devices = {
  cameras: [
    { deviceId: 'camera-1', label: 'Studio Camera' },
    { deviceId: 'camera-2', label: 'Desk Camera' },
  ],
  microphones: [
    { deviceId: 'mic-1', label: 'Studio Mic' },
    { deviceId: 'mic-2', label: 'Headset Mic' },
  ],
};

describe('RoomSettingsModal', () => {
  it('does not render while closed', () => {
    render(<RoomSettingsModal isOpen={false} devices={devices} />);
    expect(screen.queryByTestId('room-settings-panel')).not.toBeInTheDocument();
  });

  it('refreshes devices and applies selections immediately', () => {
    const onRefreshDevices = jest.fn();
    const onSwitchCamera = jest.fn();
    const onSwitchMicrophone = jest.fn();

    render(
      <RoomSettingsModal
        isOpen
        onClose={jest.fn()}
        devices={devices}
        selectedCamera="camera-1"
        selectedMicrophone="mic-1"
        onSwitchCamera={onSwitchCamera}
        onSwitchMicrophone={onSwitchMicrophone}
        onRefreshDevices={onRefreshDevices}
      />
    );

    expect(onRefreshDevices).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByTestId('room-camera-select'), {
      target: { value: 'camera-2' },
    });
    fireEvent.change(screen.getByTestId('room-microphone-select'), {
      target: { value: 'mic-2' },
    });

    expect(onSwitchCamera).toHaveBeenCalledWith('camera-2');
    expect(onSwitchMicrophone).toHaveBeenCalledWith('mic-2');
  });

  it('closes from the explicit done action', () => {
    const onClose = jest.fn();
    render(
      <RoomSettingsModal isOpen onClose={onClose} devices={devices} onRefreshDevices={jest.fn()} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Готово' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
