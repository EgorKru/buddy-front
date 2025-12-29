import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { MessageCircle, Search, ArrowLeft, Plus, X, UserPlus, Loader2 } from 'lucide-react';
import { chatAPI, userAPI, getCurrentUser, isAuthenticated } from '@/utils/api';
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
  const [selectedParticipants, setSelectedParticipants] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const searchTimeoutRef = useRef(null);
  const searchInputRef = useRef(null);
  const user = getCurrentUser();

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }
    loadChats();
  }, [router]);

  // Закрываем результаты поиска при клике вне области
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showSearchResults && searchInputRef.current && !searchInputRef.current.contains(event.target)) {
        const searchResults = document.querySelector(`.${styles.searchResults}`);
        if (searchResults && !searchResults.contains(event.target)) {
          setShowSearchResults(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSearchResults]);

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

  const searchUsers = async (query) => {
    if (!query || query.trim().length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setSearching(true);
    try {
      const users = await userAPI.searchUsers(query);
      // Исключаем текущего пользователя из результатов
      const filteredUsers = users.filter(u => u.id !== user?.id);
      setSearchResults(filteredUsers);
      setShowSearchResults(true);
    } catch (error) {
      console.error('Ошибка поиска пользователей:', error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleSearchInputChange = (e) => {
    const value = e.target.value;
    setParticipantUsernames(value);
    
    // Очищаем предыдущий таймаут
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // Запускаем поиск с задержкой
    searchTimeoutRef.current = setTimeout(() => {
      searchUsers(value);
    }, 300);
  };

  const handleSelectParticipant = (selectedUser) => {
    // Проверяем, не добавлен ли уже этот пользователь
    if (selectedParticipants.some(p => p.id === selectedUser.id)) {
      return;
    }
    
    setSelectedParticipants([...selectedParticipants, selectedUser]);
    setParticipantUsernames('');
    setSearchResults([]);
    setShowSearchResults(false);
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  const handleRemoveParticipant = (userId) => {
    setSelectedParticipants(selectedParticipants.filter(p => p.id !== userId));
  };

  const handleCreateChat = async (e) => {
    e.preventDefault();
    setCreateError('');
    
    if (chatType === 'GROUP' && !chatName.trim()) {
      setCreateError('Название группы обязательно');
      return;
    }

    // Используем выбранных участников
    const participantIds = selectedParticipants.map(p => p.id);

    if (participantIds.length === 0) {
      setCreateError('Выберите хотя бы одного участника');
      return;
    }

    if (chatType === 'DIRECT' && participantIds.length !== 1) {
      setCreateError('Для прямого чата выберите одного пользователя');
      return;
    }

    setCreating(true);
    try {
      if (chatType === 'DIRECT') {
        // Для прямого чата используем специальный endpoint
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
    setSelectedParticipants([]);
    setSearchResults([]);
    setShowSearchResults(false);
    setCreateError('');
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
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
                    ? 'Поиск пользователя *' 
                    : 'Поиск участников *'}
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={participantUsernames}
                    onChange={handleSearchInputChange}
                    onFocus={() => {
                      if (searchResults.length > 0) {
                        setShowSearchResults(true);
                      }
                    }}
                    placeholder={chatType === 'DIRECT' 
                      ? 'Введите username для поиска...' 
                      : 'Введите username для поиска участников...'}
                    className={styles.input}
                  />
                  {searching && (
                    <div style={{ 
                      position: 'absolute', 
                      right: '10px', 
                      top: '50%', 
                      transform: 'translateY(-50%)',
                      color: '#666'
                    }}>
                      <Loader2 size={16} className={styles.spinner} />
                    </div>
                  )}
                  {showSearchResults && searchResults.length > 0 && (
                    <div className={styles.searchResults}>
                      {searchResults.map((user) => (
                        <div
                          key={user.id}
                          className={styles.searchResultItem}
                          onClick={() => handleSelectParticipant(user)}
                        >
                          <div className={styles.searchResultAvatar}>
                            {user.avatarUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={user.avatarUrl} alt="" />
                            ) : (
                              <div className={styles.searchResultAvatarPlaceholder}>
                                {user.displayName?.[0] || user.username?.[0] || '?'}
                              </div>
                            )}
                          </div>
                          <div className={styles.searchResultInfo}>
                            <div className={styles.searchResultName}>
                              {user.displayName || user.username}
                            </div>
                            <div className={styles.searchResultUsername}>
                              @{user.username}
                            </div>
                          </div>
                          <UserPlus size={16} className={styles.addIcon} />
                        </div>
                      ))}
                    </div>
                  )}
                  {showSearchResults && searchResults.length === 0 && participantUsernames.length >= 2 && !searching && (
                    <div className={styles.searchResults}>
                      <div className={styles.searchResultEmpty}>
                        Пользователи не найдены
                      </div>
                    </div>
                  )}
                </div>
                <small className={styles.hint}>
                  {chatType === 'DIRECT'
                    ? 'Начните вводить username пользователя и выберите из результатов'
                    : 'Начните вводить username и выберите участников из результатов'}
                </small>
              </div>

              {selectedParticipants.length > 0 && (
                <div className={styles.formGroup}>
                  <label>Выбранные участники:</label>
                  <div className={styles.selectedParticipants}>
                    {selectedParticipants.map((participant) => (
                      <div key={participant.id} className={styles.participantTag}>
                        <span>{participant.displayName || participant.username}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveParticipant(participant.id)}
                          className={styles.removeParticipantButton}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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

