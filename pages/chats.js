import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { MessageCircle, Search, ArrowLeft } from 'lucide-react';
import { apiRequest, getCurrentUser, isAuthenticated } from '@/utils/api';
import styles from '@/styles/chats.module.css';

export default function Chats() {
  const router = useRouter();
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const user = getCurrentUser();

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }
    loadChats();
  }, [router]);

  const loadChats = async () => {
    try {
      const data = await apiRequest('/chats');
      setChats(data);
    } catch (error) {
      console.error('Ошибка загрузки чатов:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredChats = chats.filter(chat => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      chat.name?.toLowerCase().includes(query) ||
      chat.participants?.some(p => 
        p.displayName?.toLowerCase().includes(query) ||
        p.username?.toLowerCase().includes(query)
      )
    );
  });

  const getChatName = (chat) => {
    if (chat.name) return chat.name;
    if (chat.type === 'DIRECT' && chat.participants) {
      const otherParticipant = chat.participants.find(p => p.id !== user?.id);
      return otherParticipant?.displayName || otherParticipant?.username || 'Чат';
    }
    return 'Групповой чат';
  };

  const getChatAvatar = (chat) => {
    if (chat.type === 'DIRECT' && chat.participants) {
      const otherParticipant = chat.participants.find(p => p.id !== user?.id);
      return otherParticipant?.avatarUrl;
    }
    return null;
  };

  const formatTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Вчера';
    } else if (days < 7) {
      return `${days} дн. назад`;
    } else {
      return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Загрузка чатов...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button onClick={() => router.push('/')} className={styles.backButton}>
          <ArrowLeft size={20} />
        </button>
        <h1>Чаты</h1>
      </div>

      <div className={styles.searchContainer}>
        <Search size={20} className={styles.searchIcon} />
        <input
          type="text"
          placeholder="Поиск чатов..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={styles.searchInput}
        />
      </div>

      <div className={styles.chatsList}>
        {filteredChats.length === 0 ? (
          <div className={styles.emptyState}>
            <MessageCircle size={64} className={styles.emptyIcon} />
            <p>У вас пока нет чатов</p>
            <p className={styles.emptyHint}>Начните общение с другими пользователями!</p>
          </div>
        ) : (
          filteredChats.map((chat) => (
            <div
              key={chat.id}
              className={styles.chatItem}
              onClick={() => router.push(`/chat/${chat.id}`)}
            >
              <div className={styles.chatAvatar}>
                {getChatAvatar(chat) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={getChatAvatar(chat)} alt="" />
                ) : (
                  <MessageCircle size={24} />
                )}
              </div>
              <div className={styles.chatInfo}>
                <div className={styles.chatHeader}>
                  <span className={styles.chatName}>{getChatName(chat)}</span>
                  {chat.lastMessage && (
                    <span className={styles.chatTime}>
                      {formatTime(chat.lastMessage.createdAt)}
                    </span>
                  )}
                </div>
                {chat.lastMessage && (
                  <div className={styles.lastMessage}>
                    <span className={styles.lastMessageSender}>
                      {chat.lastMessage.senderDisplayName || chat.lastMessage.senderUsername}:
                    </span>
                    <span className={styles.lastMessageText}>
                      {chat.lastMessage.content.substring(0, 50)}
                      {chat.lastMessage.content.length > 50 ? '...' : ''}
                    </span>
                  </div>
                )}
                {chat.unreadCount > 0 && (
                  <div className={styles.unreadBadge}>{chat.unreadCount}</div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

