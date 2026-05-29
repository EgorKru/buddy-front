import cx from 'classnames';
import {
  Mic,
  Video,
  PhoneOff,
  MicOff,
  VideoOff,
  Users,
  Hand,
  Monitor,
  MonitorOff,
  Settings,
} from 'lucide-react';

import styles from '@/component/Bottom/index.module.css';

const Bottom = (props) => {
  const {
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
    onSettingsClick,
  } = props;

  const isMuted = muted ?? true;
  const isPlaying = playing ?? true;

  const handleToggleAudio = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();

    if (toggleAudio) {
      toggleAudio();
    } else {
    }
  };

  const handleToggleVideo = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();

    if (toggleVideo) {
      toggleVideo();
    } else {
    }
  };

  const handleLeaveRoom = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();

    if (leaveRoom) {
      leaveRoom();
    } else {
    }
  };

  const handleRaiseHand = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();

    if (onRaiseHand) {
      onRaiseHand();
    } else {
    }
  };

  const handleToggleScreenShare = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();

    if (onToggleScreenShare) {
      onToggleScreenShare();
    } else {
    }
  };

  const handleParticipantsClick = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();

    if (onParticipantsClick) {
      onParticipantsClick();
    } else {
    }
  };

  const handleSettingsClick = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();

    if (onSettingsClick) {
      onSettingsClick();
    }
  };

  return (
    <div className={styles.bottomMenu} data-testid="room-control-bar">
      <div className={styles.leftSection} data-testid="room-controls-left">
        <button
          className={styles.participantButton}
          onClick={handleParticipantsClick}
          title="Показать участников"
          type="button"
          data-testid="room-participants-button"
        >
          <Users size={18} />
          <span>{participantCount || 1}</span>
        </button>
      </div>

      <div className={styles.centerSection} data-testid="room-controls-center">
        {isMuted ? (
          <button
            className={cx(styles.icon, styles.active)}
            title="Включить микрофон"
            onClick={handleToggleAudio}
            type="button"
            data-testid="room-mic-toggle"
          >
            <MicOff size={22} />
          </button>
        ) : (
          <button
            className={styles.icon}
            title="Выключить микрофон"
            onClick={handleToggleAudio}
            type="button"
            data-testid="room-mic-toggle"
          >
            <Mic size={22} />
          </button>
        )}
        {isPlaying ? (
          <button
            className={styles.icon}
            title="Выключить камеру"
            onClick={handleToggleVideo}
            type="button"
            data-testid="room-video-toggle"
          >
            <Video size={22} />
          </button>
        ) : (
          <button
            className={cx(styles.icon, styles.active)}
            title="Включить камеру"
            onClick={handleToggleVideo}
            type="button"
            data-testid="room-video-toggle"
          >
            <VideoOff size={22} />
          </button>
        )}

        {}
        <button
          className={cx(styles.icon, { [styles.handRaised]: handRaised })}
          title={handRaised ? 'Опустить руку' : 'Поднять руку'}
          onClick={handleRaiseHand}
          type="button"
          data-testid="room-hand-toggle"
        >
          <Hand size={22} />
        </button>

        {}
        <button
          className={cx(styles.icon, { [styles.screenSharing]: isScreenSharing })}
          title={isScreenSharing ? 'Остановить демонстрацию' : 'Показать экран'}
          onClick={handleToggleScreenShare}
          type="button"
          data-testid="room-screen-share-toggle"
        >
          {isScreenSharing ? <MonitorOff size={22} /> : <Monitor size={22} />}
        </button>

        {}
        <button
          className={styles.icon}
          title="Настройки устройств"
          onClick={handleSettingsClick}
          type="button"
          data-testid="room-settings-button"
        >
          <Settings size={22} />
        </button>

        <button
          className={cx(styles.icon, styles.leaveButton)}
          title="Покинуть встречу"
          onClick={handleLeaveRoom}
          type="button"
          data-testid="room-leave-button"
        >
          <PhoneOff size={22} />
        </button>
      </div>

      <div className={styles.rightSection} data-testid="room-controls-right"></div>
    </div>
  );
};

export default Bottom;
