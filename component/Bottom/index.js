import cx from "classnames";
import { Mic, Video, PhoneOff, MicOff, VideoOff, Hand, Monitor, Share2, Users, MessageCircle } from "lucide-react";

import styles from "@/component/Bottom/index.module.css";

const Bottom = (props) => {
  const { muted, playing, toggleAudio, toggleVideo, leaveRoom, participantCount, onChatToggle } = props;

  // Используем значения по умолчанию, если данные ещё не готовы
  const isMuted = muted ?? true;
  const isPlaying = playing ?? true;

  return (
    <div className={styles.bottomMenu}>
      <div className={styles.leftSection}>
        <button className={styles.iconButton} title="Эффекты">
          <span className={styles.iconEmoji}>🎄</span>
        </button>
        <button className={styles.iconButton} title="Участники">
          <Users size={20} />
          <span className={styles.count}>{participantCount || 1}</span>
        </button>
        {onChatToggle && (
          <button 
            className={styles.iconButton} 
            title="Чат"
            onClick={onChatToggle}
          >
            <MessageCircle size={20} />
          </button>
        )}
      </div>
      
      <div className={styles.centerSection}>
        <button
          className={styles.icon}
          title="Поднять руку"
          onClick={() => {}}
        >
          <Hand size={24} />
        </button>
        <button
          className={styles.icon}
          title="Поделиться экраном"
          onClick={() => {}}
        >
          <Monitor size={24} />
        </button>
      {isMuted ? (
        <button
          className={cx(styles.icon, styles.active)}
          title="Включить микрофон"
          onClick={toggleAudio || (() => {})}
        >
          <MicOff size={24} />
        </button>
      ) : (
        <button
          className={styles.icon}
          title="Выключить микрофон"
          onClick={toggleAudio || (() => {})}
        >
          <Mic size={24} />
        </button>
      )}
      {isPlaying ? (
        <button
          className={styles.icon}
          title="Выключить камеру"
          onClick={toggleVideo || (() => {})}
        >
          <Video size={24} />
        </button>
      ) : (
        <button
          className={cx(styles.icon, styles.active)}
          title="Включить камеру"
          onClick={toggleVideo || (() => {})}
        >
          <VideoOff size={24} />
        </button>
      )}
      <button
        className={styles.icon}
        title="Поделиться"
        onClick={() => {}}
      >
        <Share2 size={24} />
      </button>
      <button
        className={cx(styles.icon, styles.leaveButton)}
        title="Покинуть встречу"
        onClick={leaveRoom || (() => {})}
      >
        <PhoneOff size={24} />
      </button>
      </div>
      
      <div className={styles.rightSection}>
        <div className={styles.activationInfo}>
          <div className={styles.activationText}>Активация</div>
          <div className={styles.activationHint}>Чтобы активир...</div>
        </div>
        <button className={styles.iconButton} title="Дополнительно">
          <span className={styles.iconEmoji}>❓</span>
        </button>
      </div>
    </div>
  );
};

export default Bottom;
