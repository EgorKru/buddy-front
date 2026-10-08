import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Settings from '../../pages/settings';
import { usePreferences } from '@/features/preferences';
import { useMediaDevices } from '@/hooks/useMediaDevices';
import { setSoundEnabled } from '@/features/notifications/lib/settings';

const mockPush = jest.fn();
const updatePreference = jest.fn();
const getDevices = jest.fn();

jest.mock('next/router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@/features/auth', () => ({
  useAuth: () => ({
    user: { id: 1, username: 'demo', email: 'demo@example.com', displayName: 'Demo User' },
    isAuthenticated: true,
    logout: jest.fn(),
  }),
}));
jest.mock('@/features/profile', () => ({
  useProfile: () => ({
    formData: { displayName: 'Demo User', email: 'demo@example.com', avatarUrl: '' },
    loading: false,
    saving: false,
    error: '',
    success: '',
    dirty: false,
    savedUser: null,
    handleChange: jest.fn(),
    handleSubmit: jest.fn((event) => event.preventDefault()),
    resetForm: jest.fn(),
  }),
}));
jest.mock('@/features/preferences', () => ({
  usePreferences: jest.fn(),
}));
jest.mock('@/hooks/useMediaDevices', () => ({ useMediaDevices: jest.fn() }));
jest.mock('@/features/notifications/lib/settings', () => ({
  isSoundEnabled: () => true,
  setSoundEnabled: jest.fn(),
}));
jest.mock('@/features/notifications/lib/audio', () => ({
  unlockPagerAudio: jest.fn(() => Promise.resolve(true)),
  playPagerNotificationSound: jest.fn(() => Promise.resolve(true)),
}));
jest.mock(
  '@/widgets/chat-sidebar',
  () =>
    function MockSidebar() {
      return null;
    }
);
jest.mock('@/surface/app', () => ({
  AppShell: ({ children }) => <div data-testid="app-shell">{children}</div>,
}));
jest.mock('@/shared/ui/Loader', () => ({ Loader: () => <div>Загрузка</div> }));

describe('settings page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    usePreferences.mockReturnValue({
      preferences: {
        density: 'comfortable',
        sidebarPosition: 'left',
        reduceMotion: false,
        enterToSend: true,
        desktopNotifications: false,
      },
      ready: true,
      updatePreference,
      resetPreferences: jest.fn(),
    });
    useMediaDevices.mockReturnValue({
      devices: { cameras: [], microphones: [], speakers: [] },
      selectedCamera: '',
      selectedMicrophone: '',
      localStream: null,
      isLoading: false,
      error: null,
      audioLevel: 0,
      isMicWorking: false,
      getDevices,
      startPreview: jest.fn(),
      stopPreview: jest.fn(),
      switchCamera: jest.fn(),
      switchMicrophone: jest.fn(),
    });
  });

  it('uses the product shell and exposes functional settings sections', async () => {
    render(<Settings />);

    expect(await screen.findByTestId('app-shell')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Настройки' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Профиль' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Рабочее пространство' })).toHaveAttribute(
      'href',
      '/app'
    );

    fireEvent.click(screen.getByRole('button', { name: /Интерфейс/ }));
    expect(screen.getByRole('heading', { name: 'Интерфейс' })).toBeVisible();
    expect(screen.queryByText('Плотность')).not.toBeInTheDocument();
    expect(screen.queryByText('Панель чатов')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('switch', { name: /Уменьшить анимацию/ }));
    expect(updatePreference).toHaveBeenCalledWith('reduceMotion', true);

    fireEvent.click(screen.getByRole('button', { name: /Уведомления/ }));
    const soundToggle = screen.getByRole('switch', { name: /Звук новых сообщений/ });
    fireEvent.click(soundToggle);
    expect(setSoundEnabled).toHaveBeenCalledWith(false);

    fireEvent.click(screen.getByRole('button', { name: /Устройства/ }));
    expect(screen.getByRole('heading', { name: 'Камера и микрофон' })).toBeVisible();
    await waitFor(() => expect(getDevices).toHaveBeenCalled());
  });
});
