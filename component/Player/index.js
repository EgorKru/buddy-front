import { useEffect, useRef } from "react";
import cx from "classnames";
import { Mic, MicOff } from "lucide-react";

import styles from "@/component/Player/index.module.css";

const Player = (props) => {
  const { stream, muted, playing, isActive, playerId, playerName } = props;
  const videoRef = useRef(null);
  
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

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
      {playing && stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={muted}
          className={styles.video}
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
