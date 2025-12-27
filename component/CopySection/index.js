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

  return (
    <div className={styles.copyContainer}>
      <div className={styles.copyHeading}>Copy Room ID:</div>
      <hr />
      <div className={styles.copyDescription}>
        <span>{roomId}</span>
        <CopyToClipboard text={roomId} onCopy={handleCopy}>
          {copied ? (
            <Check className="ml-3 cursor-pointer" style={{ color: 'green' }} size={20} />
          ) : (
            <Copy className="ml-3 cursor-pointer" size={20} />
          )}
        </CopyToClipboard>
      </div>
    </div>
  );
};

export default CopySection;