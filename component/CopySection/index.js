import { CopyToClipboard } from "react-copy-to-clipboard";
import { Copy, Check } from "lucide-react";
import { useState, useEffect } from "react";

import styles from "@/component/CopySection/index.module.css";

const CopySection = (props) => {
  const { roomId } = props;
  const [copied, setCopied] = useState(false);
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => {
      setFading(true);
    }, 5000);

    const hideTimer = setTimeout(() => {
      setVisible(false);
    }, 6000); 

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

  if (!roomId || !visible) return null;

  const meetingLink = typeof window !== 'undefined' ? `${window.location.origin}/room/${roomId}` : roomId;

  return (
    <div className={`${styles.copyContainer} ${fading ? styles.fading : ''}`}>
      <div className={styles.copyHeading}>ID комнаты:</div>
      <div className={styles.copyDescription}>
        <span className={styles.roomId}>{roomId}</span>
        <CopyToClipboard text={meetingLink} onCopy={handleCopy}>
          <button className={styles.copyButton}>
            {copied ? (
              <Check size={18} className={styles.checkIcon} />
            ) : (
              <Copy size={18} />
            )}
          </button>
        </CopyToClipboard>
      </div>
    </div>
  );
};

export default CopySection;