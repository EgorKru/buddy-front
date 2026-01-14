import cx from "classnames";
import { Mic, Video, PhoneOff, MicOff, VideoOff, Users } from "lucide-react";

import styles from "@/component/Bottom/index.module.css";

const Bottom = (props) => {
  const { muted, playing, toggleAudio, toggleVideo, leaveRoom, participantCount } = props;

  const isMuted = muted ?? true;
  const isPlaying = playing ?? true;

  return (
    <div className={styles.bottomMenu}>
      <div className={styles.leftSection}>
        <div className={styles.participantInfo}>
          <Users size={18} />
          <span>{participantCount || 1}</span>
        </div>
      </div>
      
      <div className={styles.centerSection}>
        {isMuted ? (
          <button
            className={cx(styles.icon, styles.active)}
            title="Включить микрофон"
            onClick={toggleAudio || (() => {})}
          >
            <MicOff size={22} />
          </button>
        ) : (
          <button
            className={styles.icon}
            title="Выключить микрофон"
            onClick={toggleAudio || (() => {})}
          >
            <Mic size={22} />
          </button>
        )}
        {isPlaying ? (
          <button
            className={styles.icon}
            title="Выключить камеру"
            onClick={toggleVideo || (() => {})}
          >
            <Video size={22} />
          </button>
        ) : (
          <button
            className={cx(styles.icon, styles.active)}
            title="Включить камеру"
            onClick={toggleVideo || (() => {})}
          >
            <VideoOff size={22} />
          </button>
        )}
        <button
          className={cx(styles.icon, styles.leaveButton)}
          title="Покинуть встречу"
          onClick={leaveRoom || (() => {})}
        >
          <PhoneOff size={22} />
        </button>
      </div>
      
      <div className={styles.rightSection}></div>
    </div>
  );
};

export default Bottom;
