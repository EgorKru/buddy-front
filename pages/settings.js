import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import {
  ArrowLeft,
  Bell,
  Camera,
  Check,
  ChevronRight,
  Keyboard,
  LayoutPanelLeft,
  Mic,
  MonitorUp,
  Palette,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  User,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useAuth } from '@/features/auth';
import { useProfile } from '@/features/profile';
import { usePreferences } from '@/features/preferences';
import { isSoundEnabled, setSoundEnabled } from '@/features/notifications/lib/settings';
import { playPagerNotificationSound, unlockPagerAudio } from '@/features/notifications/lib/audio';
import { useMediaDevices } from '@/hooks/useMediaDevices';
import ChatSidebar from '@/widgets/chat-sidebar';
import { AppShell } from '@/surface/app';
import { Loader } from '@/shared/ui/Loader';
import shellStyles from '@/surface/app/appShell.module.css';
import styles from '@/styles/settings.module.css';

const SETTINGS_SECTIONS = [
  { id: 'profile', label: 'Профиль', description: 'Имя и аватар', icon: User },
  { id: 'interface', label: 'Интерфейс', description: 'Вид и управление', icon: Palette },
  { id: 'notifications', label: 'Уведомления', description: 'Звук и рабочий стол', icon: Bell },
  { id: 'devices', label: 'Устройства', description: 'Камера и микрофон', icon: Camera },
];

function ToggleRow({ icon: Icon, label, description, checked, onChange, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={`${styles.settingRow} ${disabled ? styles.settingRowDisabled : ''}`}
      onClick={() => onChange(!checked)}
      disabled={disabled}
    >
      <span className={styles.settingIcon} aria-hidden>
        <Icon size={19} />
      </span>
      <span className={styles.settingCopy}>
        <strong>{label}</strong>
        <span>{description}</span>
      </span>
      <span className={`${styles.switch} ${checked ? styles.switchOn : ''}`} aria-hidden>
        <span />
      </span>
    </button>
  );
}

function SegmentedSetting({ label, description, icon: Icon, value, options, onChange }) {
  return (
    <div className={styles.segmentedRow}>
      <div className={styles.segmentedHeading}>
        <span className={styles.settingIcon} aria-hidden>
          <Icon size={19} />
        </span>
        <span className={styles.settingCopy}>
          <strong>{label}</strong>
          <span>{description}</span>
        </span>
      </div>
      <div className={styles.segmented} role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={value === option.value ? styles.segmentActive : ''}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ProfileAvatar({ url, name }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [url]);

  const initials = String(name || 'P')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return (
    <div className={styles.avatar} aria-label="Предпросмотр аватара">
      {url && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" onError={() => setFailed(true)} />
      ) : (
        <span>{initials || 'P'}</span>
      )}
    </div>
  );
}

export default function Settings() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();
  const [hasMounted, setHasMounted] = useState(false);
  const [activeSection, setActiveSection] = useState('profile');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [soundEnabled, setSoundEnabledState] = useState(true);
  const [notice, setNotice] = useState('');
  const videoRef = useRef(null);

  const {
    formData,
    loading,
    saving,
    error,
    success,
    dirty,
    savedUser,
    handleChange,
    handleSubmit,
    resetForm,
  } = useProfile(user);
  const { preferences, ready, updatePreference, resetPreferences } = usePreferences();
  const {
    devices,
    selectedCamera,
    selectedMicrophone,
    localStream,
    isLoading: devicesLoading,
    error: devicesError,
    audioLevel,
    isMicWorking,
    getDevices,
    startPreview,
    stopPreview,
    switchCamera,
    switchMicrophone,
  } = useMediaDevices();

  useEffect(() => {
    setHasMounted(true);
    setSoundEnabledState(isSoundEnabled());
  }, []);

  useEffect(() => {
    if (!isAuthenticated) router.push('/login');
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (activeSection === 'devices') getDevices();
  }, [activeSection, getDevices]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = localStream;
  }, [localStream]);

  useEffect(() => () => stopPreview(), [stopPreview]);

  const handleLogout = useCallback(async () => {
    await logout().catch(() => {});
    await router.push('/login');
  }, [logout, router]);

  const toggleSound = useCallback((enabled) => {
    setSoundEnabled(enabled);
    setSoundEnabledState(enabled);
    setNotice(enabled ? 'Звук уведомлений включён' : 'Звук уведомлений выключен');
  }, []);

  const testSound = useCallback(async () => {
    await unlockPagerAudio();
    const played = await playPagerNotificationSound();
    setNotice(played ? 'Проверочный сигнал воспроизведён' : 'Не удалось воспроизвести сигнал');
  }, []);

  const toggleDesktopNotifications = useCallback(
    async (enabled) => {
      if (!enabled) {
        updatePreference('desktopNotifications', false);
        setNotice('Системные уведомления выключены');
        return;
      }

      if (typeof window === 'undefined' || !('Notification' in window)) {
        setNotice('Этот браузер не поддерживает системные уведомления');
        return;
      }

      const permission =
        window.Notification.permission === 'default'
          ? await window.Notification.requestPermission()
          : window.Notification.permission;
      const granted = permission === 'granted';
      updatePreference('desktopNotifications', granted);
      setNotice(
        granted ? 'Системные уведомления включены' : 'Браузер не разрешил системные уведомления'
      );
    },
    [updatePreference]
  );

  const toggleDevicePreview = useCallback(async () => {
    setNotice('');
    if (localStream) {
      stopPreview();
      return;
    }
    try {
      await startPreview(true, true);
    } catch {
      // useMediaDevices уже показывает понятную ошибку.
    }
  }, [localStream, startPreview, stopPreview]);

  const resetAllPreferences = useCallback(() => {
    resetPreferences();
    setSoundEnabled(true);
    setSoundEnabledState(true);
    setNotice('Настройки интерфейса и уведомлений сброшены');
  }, [resetPreferences]);

  if (!hasMounted || !user || loading || !ready) {
    return <Loader fullPage text="Загружаем настройки…" />;
  }

  const shellUser = savedUser || user;

  return (
    <>
      <ChatSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        currentChatId={null}
      />
      {sidebarOpen && typeof window !== 'undefined' && window.innerWidth <= 768 ? (
        <button
          type="button"
          className={shellStyles.sidebarOverlay}
          onClick={() => setSidebarOpen(false)}
          aria-label="Закрыть список чатов"
        />
      ) : null}

      <AppShell
        user={shellUser}
        onLogout={handleLogout}
        onMenuClick={() => setSidebarOpen((open) => !open)}
      >
        <div className={styles.page}>
          <header className={styles.pageHeader}>
            <button type="button" className={styles.backButton} onClick={() => router.push('/app')}>
              <ArrowLeft size={18} aria-hidden />
              Рабочее пространство
            </button>
            <div className={styles.titleRow}>
              <div>
                <span className={styles.eyebrow}>Персонализация Pager</span>
                <h1>Настройки</h1>
                <p>Профиль, интерфейс, уведомления и устройства — в одном месте.</p>
              </div>
              <div className={styles.securityBadge}>
                <ShieldCheck size={18} aria-hidden />
                <span>
                  <strong>Локальные параметры</strong>
                  Хранятся только на этом устройстве
                </span>
              </div>
            </div>
          </header>

          <div className={styles.settingsLayout}>
            <nav className={styles.sectionNav} aria-label="Разделы настроек">
              {SETTINGS_SECTIONS.map(({ id, label, description, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  className={activeSection === id ? styles.navActive : ''}
                  aria-current={activeSection === id ? 'page' : undefined}
                  onClick={() => {
                    setNotice('');
                    setActiveSection(id);
                  }}
                >
                  <span className={styles.navIcon} aria-hidden>
                    <Icon size={19} />
                  </span>
                  <span>
                    <strong>{label}</strong>
                    <small>{description}</small>
                  </span>
                  <ChevronRight size={17} className={styles.navChevron} aria-hidden />
                </button>
              ))}
              <button type="button" className={styles.resetButton} onClick={resetAllPreferences}>
                <RotateCcw size={17} aria-hidden />
                Сбросить параметры
              </button>
            </nav>

            <main className={styles.panel}>
              {notice ? (
                <div className={styles.notice} role="status">
                  <Check size={17} aria-hidden /> {notice}
                  <button
                    type="button"
                    onClick={() => setNotice('')}
                    aria-label="Закрыть сообщение"
                  >
                    <X size={15} />
                  </button>
                </div>
              ) : null}

              {activeSection === 'profile' ? (
                <section aria-labelledby="profile-settings-title">
                  <div className={styles.sectionHeading}>
                    <span className={styles.sectionIcon} aria-hidden>
                      <User size={22} />
                    </span>
                    <div>
                      <h2 id="profile-settings-title">Профиль</h2>
                      <p>Так вас видят коллеги в чатах и созвонах.</p>
                    </div>
                  </div>

                  <form onSubmit={handleSubmit} className={styles.profileForm}>
                    <div className={styles.profileHero}>
                      <ProfileAvatar url={formData.avatarUrl} name={formData.displayName} />
                      <div>
                        <strong>{formData.displayName || user.username}</strong>
                        <span>@{user.username}</span>
                        {formData.avatarUrl ? (
                          <button
                            type="button"
                            className={styles.textButton}
                            onClick={() =>
                              handleChange({ target: { name: 'avatarUrl', value: '' } })
                            }
                          >
                            Удалить аватар
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <div className={styles.fieldGrid}>
                      <label className={styles.field}>
                        <span>Отображаемое имя</span>
                        <input
                          name="displayName"
                          value={formData.displayName}
                          onChange={handleChange}
                          maxLength={50}
                          placeholder="Как к вам обращаться"
                        />
                        <small>{formData.displayName.length}/50 символов</small>
                      </label>
                      <label className={styles.field}>
                        <span>Ссылка на аватар</span>
                        <input
                          type="url"
                          name="avatarUrl"
                          value={formData.avatarUrl}
                          onChange={handleChange}
                          placeholder="https://…"
                        />
                        <small>HTTPS‑изображение, доступное вашей команде</small>
                      </label>
                    </div>

                    <div className={styles.identityGrid}>
                      <div>
                        <span>Логин</span>
                        <strong>@{user.username}</strong>
                      </div>
                      <div>
                        <span>Email</span>
                        <strong>{formData.email || 'Не указан'}</strong>
                      </div>
                    </div>

                    {error ? (
                      <div className={styles.error} role="alert">
                        {error}
                      </div>
                    ) : null}
                    {success ? (
                      <div className={styles.success} role="status">
                        <Check size={17} aria-hidden /> {success}
                      </div>
                    ) : null}

                    <div className={styles.formActions}>
                      <button
                        type="button"
                        className={styles.secondaryButton}
                        onClick={resetForm}
                        disabled={!dirty || saving}
                      >
                        Отменить
                      </button>
                      <button
                        type="submit"
                        className={styles.primaryButton}
                        disabled={!dirty || saving || !formData.displayName.trim()}
                      >
                        <Save size={18} aria-hidden />
                        {saving ? 'Сохраняем…' : 'Сохранить профиль'}
                      </button>
                    </div>
                  </form>
                </section>
              ) : null}

              {activeSection === 'interface' ? (
                <section aria-labelledby="interface-settings-title">
                  <div className={styles.sectionHeading}>
                    <span className={styles.sectionIcon} aria-hidden>
                      <Palette size={22} />
                    </span>
                    <div>
                      <h2 id="interface-settings-title">Интерфейс</h2>
                      <p>Изменения применяются сразу во всём приложении.</p>
                    </div>
                  </div>
                  <div className={styles.settingsGroup}>
                    <SegmentedSetting
                      icon={Sparkles}
                      label="Плотность"
                      description="Больше воздуха или больше информации на экране"
                      value={preferences.density}
                      onChange={(value) => updatePreference('density', value)}
                      options={[
                        { value: 'comfortable', label: 'Комфортно' },
                        { value: 'compact', label: 'Компактно' },
                      ]}
                    />
                    <SegmentedSetting
                      icon={LayoutPanelLeft}
                      label="Панель чатов"
                      description="Расположение списка чатов на широком экране"
                      value={preferences.sidebarPosition}
                      onChange={(value) => updatePreference('sidebarPosition', value)}
                      options={[
                        { value: 'left', label: 'Слева' },
                        { value: 'right', label: 'Справа' },
                      ]}
                    />
                    <ToggleRow
                      icon={Sparkles}
                      label="Уменьшить анимацию"
                      description="Отключает декоративные движения и плавные переходы"
                      checked={preferences.reduceMotion}
                      onChange={(value) => updatePreference('reduceMotion', value)}
                    />
                    <ToggleRow
                      icon={Keyboard}
                      label="Enter отправляет сообщение"
                      description={
                        preferences.enterToSend
                          ? 'Shift + Enter добавляет новую строку'
                          : 'Для отправки используйте Ctrl/⌘ + Enter'
                      }
                      checked={preferences.enterToSend}
                      onChange={(value) => updatePreference('enterToSend', value)}
                    />
                  </div>
                </section>
              ) : null}

              {activeSection === 'notifications' ? (
                <section aria-labelledby="notification-settings-title">
                  <div className={styles.sectionHeading}>
                    <span className={styles.sectionIcon} aria-hidden>
                      <Bell size={22} />
                    </span>
                    <div>
                      <h2 id="notification-settings-title">Уведомления</h2>
                      <p>Не пропускайте важное и уберите лишний шум.</p>
                    </div>
                  </div>
                  <div className={styles.settingsGroup}>
                    <ToggleRow
                      icon={soundEnabled ? Volume2 : VolumeX}
                      label="Звук новых сообщений"
                      description="Короткий сигнал для входящих сообщений и звонков"
                      checked={soundEnabled}
                      onChange={toggleSound}
                    />
                    <div className={styles.inlineAction}>
                      <span>Убедитесь, что громкость вам подходит.</span>
                      <button type="button" onClick={testSound} disabled={!soundEnabled}>
                        <Volume2 size={16} aria-hidden /> Проверить звук
                      </button>
                    </div>
                    <ToggleRow
                      icon={MonitorUp}
                      label="Системные уведомления"
                      description="Показывать сообщения поверх других окон"
                      checked={preferences.desktopNotifications}
                      onChange={toggleDesktopNotifications}
                    />
                    <div className={styles.permissionNote}>
                      <ShieldCheck size={18} aria-hidden />
                      <span>
                        Pager запрашивает разрешение браузера только при включении этой функции.
                      </span>
                    </div>
                  </div>
                </section>
              ) : null}

              {activeSection === 'devices' ? (
                <section aria-labelledby="device-settings-title">
                  <div className={styles.sectionHeading}>
                    <span className={styles.sectionIcon} aria-hidden>
                      <Camera size={22} />
                    </span>
                    <div>
                      <h2 id="device-settings-title">Камера и микрофон</h2>
                      <p>Выбранные устройства будут использоваться в следующих созвонах.</p>
                    </div>
                  </div>

                  <div className={styles.deviceGrid}>
                    <div className={styles.previewCard}>
                      {localStream ? (
                        <video ref={videoRef} autoPlay muted playsInline />
                      ) : (
                        <div className={styles.previewPlaceholder}>
                          <Camera size={30} aria-hidden />
                          <span>Предпросмотр выключен</span>
                        </div>
                      )}
                      {localStream ? (
                        <div className={styles.micMeter}>
                          <Mic size={15} aria-hidden />
                          <span>
                            <i style={{ width: `${Math.max(4, audioLevel)}%` }} />
                          </span>
                          <strong>{isMicWorking ? 'Сигнал есть' : 'Скажите что-нибудь'}</strong>
                        </div>
                      ) : null}
                    </div>

                    <div className={styles.deviceControls}>
                      <label className={styles.field}>
                        <span>Камера</span>
                        <select
                          value={selectedCamera}
                          onChange={(event) => switchCamera(event.target.value)}
                        >
                          <option value="">Системная камера</option>
                          {devices.cameras.map((device, index) => (
                            <option key={device.deviceId} value={device.deviceId}>
                              {device.label || `Камера ${index + 1}`}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className={styles.field}>
                        <span>Микрофон</span>
                        <select
                          value={selectedMicrophone}
                          onChange={(event) => switchMicrophone(event.target.value)}
                        >
                          <option value="">Системный микрофон</option>
                          {devices.microphones.map((device, index) => (
                            <option key={device.deviceId} value={device.deviceId}>
                              {device.label || `Микрофон ${index + 1}`}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className={styles.deviceActions}>
                        <button
                          type="button"
                          className={styles.secondaryButton}
                          onClick={() => getDevices()}
                          disabled={devicesLoading}
                        >
                          <RefreshCw size={17} aria-hidden /> Обновить
                        </button>
                        <button
                          type="button"
                          className={styles.primaryButton}
                          onClick={toggleDevicePreview}
                          disabled={devicesLoading}
                        >
                          {localStream ? <X size={17} /> : <Camera size={17} />}
                          {localStream ? 'Остановить' : 'Проверить устройства'}
                        </button>
                      </div>
                    </div>
                  </div>
                  {devicesError ? (
                    <div className={styles.error} role="alert">
                      {devicesError}
                    </div>
                  ) : null}
                  <div className={styles.permissionNote}>
                    <ShieldCheck size={18} aria-hidden />
                    <span>
                      Видео остаётся на устройстве и не отправляется в комнату во время проверки.
                    </span>
                  </div>
                </section>
              ) : null}
            </main>
          </div>
        </div>
      </AppShell>
    </>
  );
}
