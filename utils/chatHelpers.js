export const getChatName = (chat, currentUser) => {
  if (!chat) return 'Чат';

  if (chat.name) return chat.name;

  if (chat.type === 'DIRECT' && chat.participants) {
    const otherParticipant = chat.participants.find(p => p.id !== currentUser?.id);
    return otherParticipant?.displayName || otherParticipant?.username || 'Чат';
  }

  return 'Групповой чат';
};

export const getChatAvatar = (chat, currentUser) => {
  if (!chat) return null;

  if (chat.type === 'DIRECT' && chat.participants) {
    const otherParticipant = chat.participants.find(p => p.id !== currentUser?.id);
    return otherParticipant?.avatarUrl || null;
  }

  return null;
};

export const getLastMessagePreview = (chat) => {
  const lastMessage = chat?.lastMessage;
  if (!lastMessage) return '';

  if (lastMessage.type === 'VOICE' && !lastMessage.content) {
    return 'Голосовое сообщение';
  }

  if ((lastMessage.type === 'FILE' || lastMessage.type === 'IMAGE') && !lastMessage.content) {
    if (lastMessage.fileName) {
      const fileName = lastMessage.fileName.length > 40 
        ? `${lastMessage.fileName.substring(0, 40)}...` 
        : lastMessage.fileName;
      return fileName;
    }
    
    if (lastMessage.fileUrl) {
      const parts = lastMessage.fileUrl.split('/');
      const lastPart = parts[parts.length - 1];
      const match = lastPart.match(/^[^.]*\.(.+)$/);
      if (match) {
        const extension = match[1];
        return lastMessage.type === 'IMAGE' 
          ? `Изображение.${extension}` 
          : `Файл.${extension}`;
      }
      return lastMessage.type === 'IMAGE' ? 'Изображение' : 'Файл';
    }
    
    return lastMessage.type === 'IMAGE' ? 'Изображение' : 'Файл';
  }

  if (!lastMessage.content) {
    if (lastMessage.forwardedFrom?.originalContent) {
      const original = lastMessage.forwardedFrom.originalContent;
      return original.length > 40 ? `${original.substring(0, 40)}...` : original;
    }
    if (lastMessage.replyTo?.content) {
      const replyText = lastMessage.replyTo.content;
      return replyText.length > 40 ? `${replyText.substring(0, 40)}...` : replyText;
    }
    return 'Сообщение';
  }

  const text = lastMessage.content;
  return text.length > 40 ? `${text.substring(0, 40)}...` : text;
};

export const getLastMessageReadMeta = (chat, user, readAtByChatIdByUserId) => {
  const lastMessage = chat?.lastMessage;
  if (!lastMessage?.createdAt || !user?.id) return { isRead: false, readCount: 0, totalOthers: 0 };

  const chatReadMap = readAtByChatIdByUserId?.[String(chat.id)] || {};
  const msgTime = new Date(lastMessage.createdAt).getTime();
  if (Number.isNaN(msgTime)) return { isRead: false, readCount: 0, totalOthers: 0 };

  const participantIds = Array.isArray(chat?.participants)
    ? chat.participants.map(p => Number(p?.id)).filter(n => Number.isFinite(n))
    : [];
  const uniqueParticipantIds = Array.from(new Set(participantIds));
  const totalOthers = Math.max(0, (uniqueParticipantIds.length || 0) - 1);

  const otherReaders = Object.entries(chatReadMap)
    .filter(([rid]) => Number(rid) !== Number(user.id))
    .map(([, readAt]) => new Date(readAt).getTime())
    .filter(t => !Number.isNaN(t));

  const readCount = otherReaders.reduce((acc, readAtTime) => (readAtTime >= msgTime ? acc + 1 : acc), 0);
  const isRead = readCount > 0;
  return { isRead, readCount, totalOthers };
};

export const getOtherParticipantOnline = (chat, user) => {
  if (!chat?.participants || !user?.id) return false;
  if (chat.type !== 'DIRECT') return false;
  const other = chat.participants.find(p => Number(p.id) !== Number(user.id));
  return other?.online || false;
};