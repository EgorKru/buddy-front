import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { mediaAPI } from '@/src/shared/api/media';
import { formatCustomEmojiKey } from '@/src/shared/lib/emoji/standardEmojis';
import { MESSAGE_STATUS } from '@/utils/messageQueue';

export function useEmojiMedia({
  chatId,
  user,
  sendMessageHook,
  addOptimistic,
  updateMessage,
  contextMenu,
  setContextMenu,
}) {
  const emojiButtonRef = useRef(null);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [emojiPacks, setEmojiPacks] = useState([]);

  useEffect(() => {
    mediaAPI
      .getEmojiPacks()
      .then((packs) => setEmojiPacks(packs || []))
      .catch(() => setEmojiPacks([]));
  }, []);

  const customEmojisByKey = useMemo(() => {
    const map = {};
    for (const pack of emojiPacks) {
      for (const ce of pack.emojis || []) {
        map[formatCustomEmojiKey(ce.id)] = ce;
      }
    }
    return map;
  }, [emojiPacks]);

  const sendMediaMessage = useCallback(
    async (type, content, extra) => {
      if (!chatId || !user) return;
      const result = await sendMessageHook(
        content || '',
        type,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        extra
      );
      const msg = result?.serverMessage || result?.optimisticMessage;
      if (msg) {
        addOptimistic(chatId, { ...msg, status: MESSAGE_STATUS.SENT, isOptimistic: false });
      }
    },
    [chatId, user, sendMessageHook, addOptimistic]
  );

  const handleSelectEmoji = useCallback((emoji, insertIntoInput) => {
    insertIntoInput?.(emoji);
  }, []);

  const handleSelectCustomEmoji = useCallback(
    async (ce) => {
      const isAnimated = ce.fileUrl?.endsWith('.gif');
      const type = isAnimated ? 'GIF' : 'STICKER';
      await sendMediaMessage(type, `custom:${ce.id}`, { customEmojiId: ce.id });
    },
    [sendMediaMessage]
  );

  const handleSelectSticker = useCallback(
    async (sticker) => {
      await sendMediaMessage('STICKER', String(sticker.id), { stickerId: sticker.id });
    },
    [sendMediaMessage]
  );

  const handleSelectGif = useCallback(
    async (gif) => {
      await sendMediaMessage('GIF', String(gif.id), { gifId: gif.id });
    },
    [sendMediaMessage]
  );

  const handleToggleReaction = useCallback(
    async (message, emoji) => {
      if (!chatId || !message?.id) return;
      try {
        const summary = await mediaAPI.toggleReaction(chatId, message.id, emoji);
        const updated = { ...message, reactions: summary.reactions || [] };
        updateMessage(updated, { unreadDelta: 0 });
        setContextMenu((prev) =>
          prev && Number(prev.message?.id) === Number(message.id)
            ? { ...prev, message: updated }
            : prev
        );
      } catch {
        /* ignore */
      }
    },
    [chatId, updateMessage, setContextMenu]
  );

  return {
    emojiButtonRef,
    emojiPickerOpen,
    setEmojiPickerOpen,
    customEmojisByKey,
    handleSelectEmoji,
    handleSelectCustomEmoji,
    handleSelectSticker,
    handleSelectGif,
    handleToggleReaction,
  };
}
