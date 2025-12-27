import ReactPlayer from "react-player";
import cx from "classnames";
import { Mic, MicOff } from "lucide-react";

import styles from "@/component/Player/index.module.css";

const Player = (props) => {
  const { url, muted, playing, isActive, playerId, playerName } = props;
  
  const getInitials = (name) => {
    if (!name) return "?";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const displayName = playerName || `Участник ${playerId?.substring(0, 6) || ""}`;
  const initials = getInitials(displayName);

  return (
    <div
      className={cx(styles.playerContainer, {
        [styles.notActive]: !isActive,
        [styles.active]: isActive,
        [styles.notPlaying]: !playing,
      })}
    >
      {playing ? (
        <ReactPlayer
          url={url}
          muted={muted}
          playing={playing}
          width="100%"
          height="100%"
        />
      ) : (
        <div className={styles.avatarContainer}>
          <div className={styles.avatar} style={{ fontSize: isActive ? '120px' : '60px' }}>
            {initials}
          </div>
        </div>
      )}

      <div className={styles.nameLabel}>
        {displayName}
      </div>

      {!isActive && (
        <div className={styles.micIcon}>
          {muted ? (
            <MicOff size={18} />
          ) : (
            <Mic size={18} />
          )}
        </div>
      )}
    </div>
  );
};

export default Player;
