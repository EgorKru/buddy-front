import { Copy, Settings } from "lucide-react";
import { CopyToClipboard } from "react-copy-to-clipboard";
import { useState } from "react";
import styles from "@/component/SingleParticipantInfo/index.module.css";

const SingleParticipantInfo = ({ roomId, onSettingsClick }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

  const meetingLink = roomId ? `${window.location.origin}/${roomId}` : "";

  return (
    <div className={styles.container}>
      <div className={styles.message}>
        Вы — единственный участник. Скопируйте ссылку на встречу и перешлите её
        участникам.
      </div>
      <div className={styles.actions}>
        <CopyToClipboard text={meetingLink} onCopy={handleCopy}>
          <button className={styles.actionButton}>
            <Copy size={18} />
            <span>{copied ? "Скопировано!" : "Копировать"}</span>
          </button>
        </CopyToClipboard>
        <button className={styles.actionButton} onClick={onSettingsClick}>
          <Settings size={18} />
          <span>Настройки</span>
        </button>
      </div>
    </div>
  );
};

export default SingleParticipantInfo;

