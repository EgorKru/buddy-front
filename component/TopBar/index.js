import { useState, useEffect } from "react";
import { Clock, Link2, Settings, MoreVertical, Play } from "lucide-react";
import { CopyToClipboard } from "react-copy-to-clipboard";
import styles from "@/component/TopBar/index.module.css";

const TopBar = ({ roomId, onStart }) => {
  const [meetingTime, setMeetingTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let interval = null;
    if (isRunning) {
      interval = setInterval(() => {
        setMeetingTime((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, "0")}:${minutes
        .toString()
        .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleStart = () => {
    setIsRunning(true);
    if (onStart) onStart();
  };

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

  const meetingLink = roomId && typeof window !== 'undefined' 
    ? `${window.location.origin}/${roomId}` 
    : '';

  return (
    <div className={styles.topBar}>
      <div className={styles.leftSection}>
        <div className={styles.logo}>Buddy</div>
        {!isRunning && (
          <button className={styles.startButton} onClick={handleStart}>
            <Play size={16} />
            <span>Старт</span>
          </button>
        )}
        {isRunning && (
          <div className={styles.timer}>
            <Clock size={16} />
            <span>{formatTime(meetingTime)}</span>
          </div>
        )}
        <div className={styles.meetingLabel}>Встреча</div>
      </div>
      <div className={styles.rightSection}>
        <CopyToClipboard text={meetingLink} onCopy={handleCopy}>
          <button 
            className={styles.iconButton} 
            title={copied ? "Скопировано!" : "Скопировать ссылку"}
          >
            <Link2 size={20} />
          </button>
        </CopyToClipboard>
        <button className={styles.iconButton} title="Настройки">
          <Settings size={20} />
        </button>
        <button className={styles.iconButton} title="Еще">
          <MoreVertical size={20} />
        </button>
      </div>
    </div>
  );
};

export default TopBar;

