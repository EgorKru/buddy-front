import cx from 'classnames';
import {
  ChevronUp,
  Hand,
  Loader2,
  Mic,
  MicOff,
  Monitor,
  MonitorOff,
  PhoneOff,
  Settings,
  ShieldCheck,
  Users,
  Video,
  VideoOff,
} from 'lucide-react';

import styles from '@/component/Bottom/index.module.css';

const Bottom = ({
  muted,
  playing,
  toggleAudio,
  toggleVideo,
  leaveRoom,
  participantCount,
  onParticipantsClick,
  handRaised,
  onRaiseHand,
  isScreenSharing,
  onToggleScreenShare,
  screenShareBusy = false,
  onSettingsClick,
}) => {
  const isMuted = muted ?? true;
  const isPlaying = playing ?? true;

  const run = (callback) => (event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    callback?.();
  };

  return (
    <div className={styles.bottomMenu} data-testid="room-control-bar">
      <div className={styles.leftSection} data-testid="room-controls-left">
        <button
          className={styles.participantButton}
          onClick={run(onParticipantsClick)}
          title="Показать участников"
          type="button"
          data-testid="room-participants-button"
          aria-label={`Участники: ${participantCount || 1}`}
        >
          <Users size={18} aria-hidden />
          <span className={styles.participantLabel}>Участники</span>
          <span className={styles.participantCount}>{participantCount || 1}</span>
        </button>
      </div>

      <div className={styles.centerSection} data-testid="room-controls-center">
        <div className={styles.controlDock}>
          <div className={styles.splitControl}>
            <button
              className={cx(styles.icon, { [styles.mediaOff]: isMuted })}
              aria-label={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
              aria-pressed={!isMuted}
              title={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
              onClick={run(toggleAudio)}
              type="button"
              data-testid="room-mic-toggle"
            >
              {isMuted ? <MicOff size={21} aria-hidden /> : <Mic size={21} aria-hidden />}
              <span className={styles.controlLabel}>{isMuted ? 'Микрофон выкл.' : 'Микрофон'}</span>
            </button>
            <button
              className={styles.deviceChevron}
              aria-label="Выбрать микрофон"
              title="Выбрать микрофон"
              onClick={run(onSettingsClick)}
              type="button"
            >
              <ChevronUp size={15} aria-hidden />
            </button>
          </div>

          <div className={styles.splitControl}>
            <button
              className={cx(styles.icon, { [styles.mediaOff]: !isPlaying })}
              aria-label={isPlaying ? 'Выключить камеру' : 'Включить камеру'}
              aria-pressed={isPlaying}
              title={isPlaying ? 'Выключить камеру' : 'Включить камеру'}
              onClick={run(toggleVideo)}
              type="button"
              data-testid="room-video-toggle"
            >
              {isPlaying ? <Video size={21} aria-hidden /> : <VideoOff size={21} aria-hidden />}
              <span className={styles.controlLabel}>{isPlaying ? 'Камера' : 'Камера выкл.'}</span>
            </button>
            <button
              className={styles.deviceChevron}
              aria-label="Выбрать камеру"
              title="Выбрать камеру"
              onClick={run(onSettingsClick)}
              type="button"
            >
              <ChevronUp size={15} aria-hidden />
            </button>
          </div>

          <button
            className={cx(styles.icon, styles.wideControl, {
              [styles.screenSharing]: isScreenSharing,
            })}
            aria-label={isScreenSharing ? 'Остановить демонстрацию' : 'Показать экран'}
            aria-pressed={isScreenSharing}
            title={isScreenSharing ? 'Остановить демонстрацию' : 'Показать экран'}
            onClick={run(onToggleScreenShare)}
            type="button"
            data-testid="room-screen-share-toggle"
            disabled={screenShareBusy}
          >
            {screenShareBusy ? (
              <Loader2 size={21} className={styles.spinner} aria-hidden />
            ) : isScreenSharing ? (
              <MonitorOff size={21} aria-hidden />
            ) : (
              <Monitor size={21} aria-hidden />
            )}
            <span className={styles.controlLabel}>{isScreenSharing ? 'Остановить' : 'Экран'}</span>
          </button>

          <button
            className={cx(styles.icon, { [styles.handRaised]: handRaised })}
            aria-label={handRaised ? 'Опустить руку' : 'Поднять руку'}
            aria-pressed={handRaised}
            title={handRaised ? 'Опустить руку' : 'Поднять руку'}
            onClick={run(onRaiseHand)}
            type="button"
            data-testid="room-hand-toggle"
          >
            <Hand size={21} aria-hidden />
            <span className={styles.controlLabel}>Рука</span>
          </button>

          <button
            className={styles.icon}
            aria-label="Настройки устройств"
            title="Настройки устройств"
            onClick={run(onSettingsClick)}
            type="button"
            data-testid="room-settings-button"
          >
            <Settings size={21} aria-hidden />
            <span className={styles.controlLabel}>Устройства</span>
          </button>

          <button
            className={cx(styles.icon, styles.leaveButton)}
            aria-label="Покинуть встречу"
            title="Покинуть встречу"
            onClick={run(leaveRoom)}
            type="button"
            data-testid="room-leave-button"
          >
            <PhoneOff size={21} aria-hidden />
            <span className={styles.controlLabel}>Выйти</span>
          </button>
        </div>
      </div>

      <div className={styles.rightSection} data-testid="room-controls-right">
        <span className={styles.secureStatus} title="Медиа передаётся напрямую между участниками">
          <ShieldCheck size={16} aria-hidden />
          Защищено
        </span>
      </div>
    </div>
  );
};

export default Bottom;
