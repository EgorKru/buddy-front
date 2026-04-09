import React, { useEffect, useState } from 'react';

function getDirectPeerUserId(msg, user, chats) {
  if (!msg?.chatId || !user?.id || !Array.isArray(chats)) return null;
  const chat = chats.find((c) => String(c?.id) === String(msg.chatId));
  if (!chat || chat.type !== 'DIRECT' || !chat.participants) return null;
  const other = chat.participants.find((p) => Number(p.id) !== Number(user.id));
  return other?.id != null ? Number(other.id) : null;
}

/**
 * Расшифровка TEXT с encryptionVersion (direct-чат, Web Crypto на клиенте).
 */
export default function E2eeTextContent({
  msg,
  user,
  chats,
  searchOpen,
  searchText,
  highlightSearchText,
  styles,
}) {
  const [text, setText] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mod = await import('@/shared/lib/e2ee/directTextE2ee');
        if (!mod.isE2eeEnabled()) {
          if (!cancelled) setText(msg.content);
          return;
        }
        const peerUid = getDirectPeerUserId(msg, user, chats);
        const otherUserId =
          Number(msg.senderId) === Number(user?.id) ? peerUid : Number(msg.senderId);
        if (!otherUserId) {
          if (!cancelled) setFailed(true);
          return;
        }
        const plain = await mod.decryptDirectText(otherUserId, msg.content);
        if (!cancelled) setText(plain);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Стабильные поля вместо целых объектов msg/user — меньше лишних перезапусков расшифровки.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msg.id, msg.content, msg.senderId, msg.chatId, user?.id, chats]);

  if (failed) {
    return <span className={styles.e2eeFailed}>🔒 Не удалось расшифровать сообщение</span>;
  }
  if (text == null) {
    return <span className={styles.e2eePending}>🔒 Расшифровка…</span>;
  }
  if (searchOpen && searchText && highlightSearchText) {
    return <>{highlightSearchText(text, searchText, styles)}</>;
  }
  return <>{text}</>;
}
