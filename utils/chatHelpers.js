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
