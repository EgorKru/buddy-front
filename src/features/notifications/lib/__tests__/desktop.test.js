import { DEFAULT_PREFERENCES, savePreferences } from '@/features/preferences';
import { showDesktopNotification } from '../desktop';

describe('showDesktopNotification', () => {
  const OriginalNotification = window.Notification;

  afterEach(() => {
    localStorage.clear();
    window.Notification = OriginalNotification;
  });

  it('does not create a notification while the preference is disabled', () => {
    const NotificationMock = jest.fn();
    NotificationMock.permission = 'granted';
    window.Notification = NotificationMock;

    expect(showDesktopNotification({ title: 'Новое сообщение' })).toBeNull();
    expect(NotificationMock).not.toHaveBeenCalled();
  });

  it('creates a desktop notification only after permission and opt-in', () => {
    const close = jest.fn();
    const NotificationMock = jest.fn(() => ({ close, onclick: null }));
    NotificationMock.permission = 'granted';
    window.Notification = NotificationMock;
    savePreferences({ ...DEFAULT_PREFERENCES, desktopNotifications: true });

    const result = showDesktopNotification({ id: 17, title: 'Команда', content: 'Проверка' });

    expect(NotificationMock).toHaveBeenCalledWith(
      'Команда',
      expect.objectContaining({ body: 'Проверка', tag: 'pager-notification-17' })
    );
    expect(result).not.toBeNull();
  });
});
