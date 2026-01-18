import { useEffect, useState } from 'react';
import { X, Settings, ChevronDown } from 'lucide-react';
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
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (isOpen && onRefreshDevices) {
      onRefreshDevices();
    }
  }, [isOpen, onRefreshDevices]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Настройки устройств</h2>
          <button className={styles.closeButton} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.settingsPanel}>
            <div className={styles.settingGroup}>
              <label className={styles.settingLabel}>Камера</label>
              <select
                className={styles.select}
                value={selectedCamera || ''}
                onChange={(e) => onSwitchCamera && onSwitchCamera(e.target.value)}
              >
                {devices?.cameras?.map(device => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Камера ${devices.cameras.indexOf(device) + 1}`}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.settingGroup}>
              <label className={styles.settingLabel}>Микрофон</label>
              <select
                className={styles.select}
                value={selectedMicrophone || ''}
                onChange={(e) => onSwitchMicrophone && onSwitchMicrophone(e.target.value)}
              >
                {devices?.microphones?.map(device => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Микрофон ${devices.microphones.indexOf(device) + 1}`}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.closeButton} onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
