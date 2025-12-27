import { CopyToClipboard } from "react-copy-to-clipboard";
import { Copy, Check } from "lucide-react";
import { useState } from "react";

import styles from "@/component/CopySection/index.module.css";

const CopySection = (props) => {
  const { roomId } = props;
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

  if (!roomId) return null;

  const meetingLink = typeof window !== 'undefined' ? `${window.location.origin}/${roomId}` : roomId;

  return (
    <div className={styles.copyContainer}>
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