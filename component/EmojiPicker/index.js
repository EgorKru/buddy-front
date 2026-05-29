import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { mediaAPI } from '@/src/shared/api/media';
import { resolveMediaUrl } from '@/src/shared/lib/media/resolveMediaUrl';
import { formatCustomEmojiKey } from '@/src/shared/lib/emoji/standardEmojis';
import styles from './index.module.css';

const TABS = [
  { id: 'emoji', label: 'Эмодзи' },
  { id: 'stickers', label: 'Стикеры' },
  { id: 'gifs', label: 'GIF' },
];

export default function EmojiPicker({
  open,
  onClose,
  onSelectEmoji,
  onSelectCustomEmoji,
  onSelectSticker,
  onSelectGif,
  anchorRef,
}) {
  const panelRef = useRef(null);
  const [panelWidth, setPanelWidth] = useState(340);
  const [activeTab, setActiveTab] = useState('emoji');
  const [emojiPacks, setEmojiPacks] = useState([]);
  const [stickerPacks, setStickerPacks] = useState([]);
  const [gifs, setGifs] = useState([]);
  const [activeEmojiPackId, setActiveEmojiPackId] = useState(null);
  const [activeStickerPackId, setActiveStickerPackId] = useState(null);

  useEffect(() => {
    if (!open) return;
    mediaAPI
      .getEmojiPacks()
      .then((packs) => {
        setEmojiPacks(packs || []);
        if (packs?.length) setActiveEmojiPackId(packs[0].id);
      })
      .catch(() => setEmojiPacks([]));
    mediaAPI
      .getStickerPacks()
      .then((packs) => {
        setStickerPacks(packs || []);
        if (packs?.length) setActiveStickerPackId(packs[0].id);
      })
      .catch(() => setStickerPacks([]));
    mediaAPI
      .getGifs()
      .then((items) => setGifs(items || []))
      .catch(() => setGifs([]));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target) &&
        anchorRef?.current &&
        !anchorRef.current.contains(e.target)
      ) {
        onClose?.();
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open, onClose, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const measure = () => {
      const w = panelRef.current?.getBoundingClientRect?.().width;
      if (w && Number.isFinite(w)) setPanelWidth(w);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [open]);

  const activeEmojiPack = useMemo(
    () => emojiPacks.find((p) => p.id === activeEmojiPackId),
    [emojiPacks, activeEmojiPackId]
  );
  const activeStickerPack = useMemo(
    () => stickerPacks.find((p) => p.id === activeStickerPackId),
    [stickerPacks, activeStickerPackId]
  );

  const panelStyle = useMemo(() => {
    if (!anchorRef?.current) return {};
    const rect = anchorRef.current.getBoundingClientRect();
    const margin = 8;
    const maxLeft = Math.max(margin, window.innerWidth - panelWidth - margin);
    const left = Math.min(Math.max(margin, rect.left), maxLeft);
    return { position: 'fixed', left, bottom: window.innerHeight - rect.top + margin };
  }, [anchorRef, open, panelWidth]);

  if (!open) return null;

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div
        ref={panelRef}
        className={styles.panel}
        style={panelStyle}
        data-testid="emoji-picker-panel"
      >
        <div className={styles.tabs}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
              data-testid={`emoji-picker-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className={styles.body}>
          {activeTab === 'emoji' && (
            <>
              {emojiPacks.length > 0 && (
                <div className={styles.packTabs}>
                  {emojiPacks.map((pack) => (
                    <button
                      key={pack.id}
                      type="button"
                      className={`${styles.packTab} ${activeEmojiPackId === pack.id ? styles.packTabActive : ''}`}
                      onClick={() => setActiveEmojiPackId(pack.id)}
                    >
                      {pack.title}
                    </button>
                  ))}
                </div>
              )}
              {emojiPacks.length === 0 && (
                <p className={styles.emptyHint}>
                  Загрузите паки эмодзи или выполните импорт из Figma.
                </p>
              )}
              {activeEmojiPack?.emojis?.length > 0 && (
                <div className={styles.grid}>
                  {activeEmojiPack.emojis.map((ce) => (
                    <button
                      key={ce.id}
                      type="button"
                      className={styles.emojiBtn}
                      data-testid="emoji-picker-custom"
                      onClick={() =>
                        onSelectCustomEmoji?.({
                          id: ce.id,
                          fileUrl: ce.fileUrl,
                          key: formatCustomEmojiKey(ce.id),
                        })
                      }
                    >
                      <img
                        src={resolveMediaUrl(ce.fileUrl)}
                        alt={ce.altText || ''}
                        className={styles.customImg}
                      />
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === 'stickers' && (
            <>
              <div className={styles.packTabs}>
                {stickerPacks.map((pack) => (
                  <button
                    key={pack.id}
                    type="button"
                    className={`${styles.packTab} ${activeStickerPackId === pack.id ? styles.packTabActive : ''}`}
                    onClick={() => setActiveStickerPackId(pack.id)}
                  >
                    {pack.title}
                  </button>
                ))}
              </div>
              <div className={styles.stickerGrid}>
                {(activeStickerPack?.stickers || []).map((sticker) => (
                  <button
                    key={sticker.id}
                    type="button"
                    className={styles.gifItem}
                    data-testid="emoji-picker-sticker"
                    onClick={() => onSelectSticker?.(sticker)}
                  >
                    <img
                      src={resolveMediaUrl(sticker.fileUrl)}
                      alt={sticker.emoji || 'sticker'}
                      className={styles.stickerImg}
                    />
                  </button>
                ))}
              </div>
            </>
          )}

          {activeTab === 'gifs' && (
            <div className={styles.stickerGrid}>
              {gifs.map((gif) => (
                <button
                  key={gif.id}
                  type="button"
                  className={styles.gifItem}
                  data-testid="emoji-picker-gif"
                  onClick={() => onSelectGif?.(gif)}
                >
                  <img
                    src={resolveMediaUrl(gif.previewUrl || gif.fileUrl)}
                    alt={gif.title || 'gif'}
                    className={styles.gifImg}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
