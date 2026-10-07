import { useEffect } from 'react';
import { Camera, Mic, RefreshCw, X } from 'lucide-react';
import styles from './RoomSettingsModal.module.css';

export default function RoomSettingsModal({
  isOpen,
  onClose,
  devices,
  selectedCamera,
  selectedMicrophone,
  onSwitchCamera,
  onSwitchMicrophone,
  onRefreshDevices,
}) {
  useEffect(() => {
    if (isOpen && onRefreshDevices) {
      onRefreshDevices();
    }
  }, [isOpen, onRefreshDevices]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose} data-testid="room-settings-panel">
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="device-settings-title"
      >
        <div className={styles.header}>
          <div>
            <span className={styles.eyebrow}>Встреча</span>
            <h2 id="device-settings-title" className={styles.title}>
              Устройства
            </h2>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Закрыть настройки устройств"
          >
            <X size={20} />
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.statusCard}>
            <span className={styles.statusDot} aria-hidden />
            <span>
              <strong>Устройства подключены</strong>
              Переключение применяется к текущему звонку сразу.
            </span>
            <button
              type="button"
              onClick={onRefreshDevices}
              aria-label="Обновить список устройств"
              title="Обновить список"
            >
              <RefreshCw size={17} aria-hidden />
            </button>
          </div>
          <div className={styles.settingsPanel}>
            <div className={styles.settingGroup}>
              <label className={styles.settingLabel} htmlFor="room-camera-select">
                <Camera size={17} aria-hidden />
                <span>
                  <strong>Камера</strong>
                  <small>Источник видео</small>
                </span>
              </label>
              <select
                id="room-camera-select"
                className={styles.select}
                value={selectedCamera || ''}
                onChange={(e) => onSwitchCamera && onSwitchCamera(e.target.value)}
                disabled={!devices?.cameras?.length}
                data-testid="room-camera-select"
              >
                {!devices?.cameras?.length ? <option value="">Камеры не найдены</option> : null}
                {devices?.cameras?.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Камера ${devices.cameras.indexOf(device) + 1}`}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.settingGroup}>
              <label className={styles.settingLabel} htmlFor="room-microphone-select">
                <Mic size={17} aria-hidden />
                <span>
                  <strong>Микрофон</strong>
                  <small>Источник звука</small>
                </span>
              </label>
              <select
                id="room-microphone-select"
                className={styles.select}
                value={selectedMicrophone || ''}
                onChange={(e) => onSwitchMicrophone && onSwitchMicrophone(e.target.value)}
                disabled={!devices?.microphones?.length}
                data-testid="room-microphone-select"
              >
                {!devices?.microphones?.length ? (
                  <option value="">Микрофоны не найдены</option>
                ) : null}
                {devices?.microphones?.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Микрофон ${devices.microphones.indexOf(device) + 1}`}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.doneButton} onClick={onClose}>
            Готово
          </button>
        </div>
      </div>
    </div>
  );
}
