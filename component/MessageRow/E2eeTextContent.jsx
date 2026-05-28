import React, { useEffect, useState } from 'react';
import { decryptMessagePlainText } from '@/shared/lib/e2ee/messageTextPreview';

const FAILURE_MESSAGES = {
  local_key_lost:
    'Ключ шифрования недоступен на этом устройстве. Войдите с того же браузера, где вы писали раньше.',
  no_peer: 'Не удалось определить собеседника для расшифровки. Обновите страницу.',
  decrypt_failed: 'Не удалось загрузить сообщение',
};

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
  const [failureReason, setFailureReason] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setText(null);
    setFailureReason(null);

    (async () => {
      const chat = Array.isArray(chats)
        ? chats.find((c) => String(c?.id) === String(msg.chatId))
        : null;
      const { text: plain, reason } = await decryptMessagePlainText(msg, chat, user);
      if (cancelled) return;
      if (plain != null) {
        setText(plain);
        setFailureReason(null);
      } else {
        setFailureReason(reason || 'decrypt_failed');
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    msg.id,
    msg.content,
    msg.senderId,
    msg.chatId,
    msg.encryptionVersion,
    user?.id,
    chats?.length,
    chats?.find?.((c) => String(c?.id) === String(msg.chatId))?.participants?.length,
  ]);

  if (failureReason) {
    return (
      <span className={styles.e2eeFailed}>
        {FAILURE_MESSAGES[failureReason] || FAILURE_MESSAGES.decrypt_failed}
      </span>
    );
  }
  if (text == null) {
    return <span className={styles.e2eePending}>…</span>;
  }
  if (searchOpen && searchText && highlightSearchText) {
    return (
      <span data-testid="chat-message-text-body">
        {highlightSearchText(text, searchText, styles)}
      </span>
    );
  }
  return <span data-testid="chat-message-text-body">{text}</span>;
}
