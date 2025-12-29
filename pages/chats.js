import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { MessageCircle, Search, ArrowLeft, Plus, X } from 'lucide-react';
import { chatAPI, getCurrentUser, isAuthenticated } from '@/utils/api';
import styles from '@/styles/chats.module.css';

export default function Chats() {
  const router = useRouter();
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [chatType, setChatType] = useState('DIRECT');
  const [chatName, setChatName] = useState('');
  const [participantUsernames, setParticipantUsernames] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
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
      const data = await chatAPI.getChats();
      setChats(data);
    } catch (error) {
      console.error('Ошибка загрузки чатов:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateChat = async (e) => {
    e.preventDefault();
    setCreateError('');
    
    if (chatType === 'GROUP' && !chatName.trim()) {
      setCreateError('Название группы обязательно');
      return;
    }

    if (!participantUsernames.trim()) {
      setCreateError('Укажите участников');
      return;
    }

    setCreating(true);
    try {
      // Парсим ID пользователей (можно вводить через запятую)
      const participantIds = participantUsernames
        .split(',')
        .map(id => id.trim())
        .filter(Boolean)
        .map(id => {
          const numId = parseInt(id, 10);
          if (isNaN(numId)) {
            throw new Error(`"${id}" не является валидным ID пользователя`);
          }
          return numId;
        });

      if (participantIds.length === 0) {
        setCreateError('Укажите хотя бы одного участника');
        setCreating(false);
        return;
      }

      if (chatType === 'DIRECT') {
        // Для прямого чата используем специальный endpoint
        if (participantIds.length !== 1) {
          setCreateError('Для прямого чата укажите одного пользователя');
          setCreating(false);
          return;
        }

        const chat = await chatAPI.getDirectChat(participantIds[0]);
        await loadChats(); // Обновляем список чатов
        handleCloseModal();
        router.push(`/chat/${chat.id}`);
      } else {
        // Для группового чата создаем через API
        const chatData = {
          type: 'GROUP',
          name: chatName.trim(),
          participantIds: participantIds,
        };

        const chat = await chatAPI.createChat(chatData);
        await loadChats(); // Обновляем список чатов
        handleCloseModal();
        router.push(`/chat/${chat.id}`);
      }
    } catch (error) {
      console.error('Ошибка создания чата:', error);
      setCreateError(error.message || 'Ошибка при создании чата');
    } finally {
      setCreating(false);
    }
  };

  const resetCreateForm = () => {
    setChatType('DIRECT');
    setChatName('');
    setParticipantUsernames('');
    setCreateError('');
  };

  const handleCloseModal = () => {
    setShowCreateModal(false);
    resetCreateForm();
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
        <button
          onClick={() => setShowCreateModal(true)}
          className={styles.createButton}
          title="Создать чат"
        >
          <Plus size={20} />
        </button>
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

      {showCreateModal && (
        <div className={styles.modalOverlay} onClick={handleCloseModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Создать чат</h2>
              <button onClick={handleCloseModal} className={styles.modalClose}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateChat} className={styles.modalForm}>
              <div className={styles.formGroup}>
                <label>Тип чата</label>
                <select
                  value={chatType}
                  onChange={(e) => setChatType(e.target.value)}
                  className={styles.select}
                >
                  <option value="DIRECT">Прямой чат</option>
                  <option value="GROUP">Групповой чат</option>
                </select>
              </div>

              {chatType === 'GROUP' && (
                <div className={styles.formGroup}>
                  <label>Название группы *</label>
                  <input
                    type="text"
                    value={chatName}
                    onChange={(e) => setChatName(e.target.value)}
                    placeholder="Введите название группы"
                    className={styles.input}
                    required
                  />
                </div>
              )}

              <div className={styles.formGroup}>
                <label>
                  {chatType === 'DIRECT' 
                    ? 'ID пользователя *' 
                    : 'ID пользователей (через запятую) *'}
                </label>
                <input
                  type="text"
                  value={participantUsernames}
                  onChange={(e) => setParticipantUsernames(e.target.value)}
                  placeholder={chatType === 'DIRECT' 
                    ? '123' 
                    : '123, 456, 789'}
                  className={styles.input}
                  required
                />
                <small className={styles.hint}>
                  {chatType === 'DIRECT'
                    ? 'Введите ID пользователя для прямого чата (число)'
                    : 'Введите ID пользователей через запятую (например: 123, 456, 789)'}
                  <br />
                  <span style={{ color: '#888', fontSize: '0.85em' }}>
                    Примечание: для удобства рекомендуется добавить API поиска пользователей по username
                  </span>
                </small>
              </div>

              {createError && (
                <div className={styles.error}>{createError}</div>
              )}

              <div className={styles.modalActions}>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className={styles.cancelButton}
                  disabled={creating}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className={styles.submitButton}
                  disabled={creating}
                >
                  {creating ? 'Создание...' : 'Создать'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

