import { useEffect, useMemo, useState } from 'react';
import { getMessagePreview } from '@/utils/chatHelpers';
import { decryptMessagePlainText } from '@/shared/lib/e2ee/messageTextPreview';

/**
 * Текст превью сообщения: для E2EE — расшифровка на клиенте, иначе синхронный preview.
 */
export function useMessageTextPreview(message, chat, user) {
  const syncPreview = useMemo(() => {
    if (!message) return '';
    if (Number(message.encryptionVersion) > 0) return null;
    return getMessagePreview(message);
  }, [message]);

  const [decryptedText, setDecryptedText] = useState(undefined);

  useEffect(() => {
    if (!message || Number(message.encryptionVersion) <= 0) {
      setDecryptedText(undefined);
      return;
    }

    let cancelled = false;
    (async () => {
      const { text: plain } = await decryptMessagePlainText(message, chat, user);
      if (!cancelled) {
        setDecryptedText(plain ?? '');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    message?.id,
    message?.content,
    message?.encryptionVersion,
    message?.senderId,
    message?.type,
    chat?.id,
    user?.id,
  ]);

  if (syncPreview != null) {
    return syncPreview;
  }

  if (decryptedText !== undefined) {
    const preview = getMessagePreview(message, { decryptedText });
    return preview || 'Сообщение';
  }

  return '…';
}
