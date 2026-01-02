import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import { MessageCircle, Search, ArrowLeft, Plus, X, UserPlus, Loader2 } from 'lucide-react';
import { chatAPI, getCurrentUser, isAuthenticated } from '@/utils/api';
import { useCreateChat } from '@/hooks/useCreateChat';
import { getChatName, getChatAvatar } from '@/utils/chatHelpers';
import { formatChatListTime } from '@/utils/dateHelpers';
import styles from '@/styles/chats.module.css';

export default function Chats() {
  const router = useRouter();
  const user = getCurrentUser();
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  const createChat = useCreateChat();

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }
    loadChats();
  }, [router]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (createChat.showSearchResults && createChat.searchInputRef.current && !createChat.searchInputRef.current.contains(event.target)) {
        const searchResults = document.querySelector(`.${styles.searchResults}`);
        if (searchResults && !searchResults.contains(event.target)) {
          createChat.setShowSearchResults(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [createChat.showSearchResults]);

  const loadChats = async () => {
    try {
      const data = await chatAPI.getChats();
      setChats(data);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const handleCreateChat = async (e) => {
    e.preventDefault();
    try {
      await createChat.handleCreateChat(async () => {
        await loadChats();
        handleCloseModal();
      });
    } catch (error) {
    }
  };

  const handleCloseModal = () => {
    setShowCreateModal(false);
    createChat.resetForm();
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
                {getChatAvatar(chat, user) ? (
                  <Image src={getChatAvatar(chat, user)} alt="" width={32} height={32} unoptimized />
                ) : (
                  <MessageCircle size={24} />
                )}
              </div>
              <div className={styles.chatInfo}>
                <div className={styles.chatHeader}>
                  <span className={styles.chatName}>{getChatName(chat, user)}</span>
                  {chat.lastMessage && (
                    <span className={styles.chatTime}>
                      {formatChatListTime(chat.lastMessage.createdAt)}
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
                  value={createChat.chatType}
                  onChange={(e) => createChat.setChatType(e.target.value)}
                  className={styles.select}
                >
                  <option value="DIRECT">Прямой чат</option>
                  <option value="GROUP">Групповой чат</option>
                </select>
              </div>

              {createChat.chatType === 'GROUP' && (
                <div className={styles.formGroup}>
                  <label>Название группы *</label>
                  <input
                    type="text"
                    value={createChat.chatName}
                    onChange={(e) => createChat.setChatName(e.target.value)}
                    placeholder="Введите название группы"
                    className={styles.input}
                    required
                  />
                </div>
              )}

              <div className={styles.formGroup}>
                <label>
                  {createChat.chatType === 'DIRECT' 
                    ? 'Поиск пользователя *' 
                    : 'Поиск участников *'}
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    ref={createChat.searchInputRef}
                    type="text"
                    value={createChat.participantUsernames}
                    onChange={createChat.handleSearchInputChange}
                    onFocus={() => {
                      if (createChat.searchResults.length > 0) {
                        createChat.setShowSearchResults(true);
                      }
                    }}
                    placeholder={createChat.chatType === 'DIRECT' 
                      ? 'Введите username для поиска...' 
                      : 'Введите username для поиска участников...'}
                    className={styles.input}
                  />
                  {createChat.searching && (
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
                  {createChat.showSearchResults && createChat.searchResults.length > 0 && (
                    <div className={styles.searchResults}>
                      {createChat.searchResults.map((user) => (
                        <div
                          key={user.id}
                          className={styles.searchResultItem}
                          onClick={() => createChat.handleSelectParticipant(user)}
                        >
                          <div className={styles.searchResultAvatar}>
                            {user.avatarUrl ? (
                              <Image src={user.avatarUrl} alt="" width={32} height={32} unoptimized />
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
                  {createChat.showSearchResults && createChat.searchResults.length === 0 && createChat.participantUsernames.length >= 2 && !createChat.searching && (
                    <div className={styles.searchResults}>
                      <div className={styles.searchResultEmpty}>
                        Пользователи не найдены
                      </div>
                    </div>
                  )}
                </div>
                <small className={styles.hint}>
                  {createChat.chatType === 'DIRECT'
                    ? 'Начните вводить username пользователя и выберите из результатов'
                    : 'Начните вводить username и выберите участников из результатов'}
                </small>
              </div>

              {createChat.selectedParticipants.length > 0 && (
                <div className={styles.formGroup}>
                  <label>Выбранные участники:</label>
                  <div className={styles.selectedParticipants}>
                    {createChat.selectedParticipants.map((participant) => (
                      <div key={participant.id} className={styles.participantTag}>
                        <span>{participant.displayName || participant.username}</span>
                        <button
                          type="button"
                          onClick={() => createChat.handleRemoveParticipant(participant.id)}
                          className={styles.removeParticipantButton}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {createChat.createError && (
                <div className={styles.error}>{createChat.createError}</div>
              )}

              <div className={styles.modalActions}>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className={styles.cancelButton}
                  disabled={createChat.creating}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className={styles.submitButton}
                  disabled={createChat.creating}
                >
                  {createChat.creating ? 'Создание...' : 'Создать'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

