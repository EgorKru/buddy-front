import cx from "classnames";
import { Mic, Video, PhoneOff, MicOff, VideoOff, Users, Hand, Monitor, MonitorOff } from "lucide-react";

import styles from "@/component/Bottom/index.module.css";

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
  } = props;

  const isMuted = muted ?? true;
  const isPlaying = playing ?? true;

  return (
    <div className={styles.bottomMenu}>
      <div className={styles.leftSection}>
        <button 
          className={styles.participantButton}
          onClick={onParticipantsClick}
          title="Показать участников"
        >
          <Users size={18} />
          <span>{participantCount || 1}</span>
        </button>
      </div>
      
      <div className={styles.centerSection}>
        {isMuted ? (
          <button
            className={cx(styles.icon, styles.active)}
            title="Включить микрофон"
            onClick={toggleAudio}
            type="button"
          >
            <MicOff size={22} />
          </button>
        ) : (
          <button
            className={styles.icon}
            title="Выключить микрофон"
            onClick={toggleAudio}
            type="button"
          >
            <Mic size={22} />
          </button>
        )}
        {isPlaying ? (
          <button
            className={styles.icon}
            title="Выключить камеру"
            onClick={toggleVideo}
            type="button"
          >
            <Video size={22} />
          </button>
        ) : (
          <button
            className={cx(styles.icon, styles.active)}
            title="Включить камеру"
            onClick={toggleVideo}
            type="button"
          >
            <VideoOff size={22} />
          </button>
        )}
        
        {/* Поднять руку */}
        <button
          className={cx(styles.icon, { [styles.handRaised]: handRaised })}
          title={handRaised ? "Опустить руку" : "Поднять руку"}
          onClick={onRaiseHand}
          type="button"
        >
          <Hand size={22} />
        </button>
        
        {/* Демонстрация экрана */}
        <button
          className={cx(styles.icon, { [styles.screenSharing]: isScreenSharing })}
          title={isScreenSharing ? "Остановить демонстрацию" : "Показать экран"}
          onClick={onToggleScreenShare}
          type="button"
        >
          {isScreenSharing ? <MonitorOff size={22} /> : <Monitor size={22} />}
        </button>
        
        <button
          className={cx(styles.icon, styles.leaveButton)}
          title="Покинуть встречу"
          onClick={leaveRoom}
          type="button"
        >
          <PhoneOff size={22} />
        </button>
      </div>
      
      <div className={styles.rightSection}></div>
    </div>
  );
};

export default Bottom;
