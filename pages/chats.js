import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Image from 'next/image';
import { MessageCircle, Search, ArrowLeft, Plus, X, Loader2, Check, CheckCheck, UserPlus } from 'lucide-react';
import { getCurrentUser, isAuthenticated } from '@/utils/api';
import { useCreateChat } from '@/hooks/useCreateChat';
import { getChatName, getChatAvatar } from '@/utils/chatHelpers';
import { formatChatListTime } from '@/utils/dateHelpers';
import styles from '@/styles/chats.module.css';
import { useChats, getChatTime } from '@/context/messaging';

// Функция для парсинга дат с бэкенда (включая Java LocalDateTime массив)
const parseServerDate = (dateString) => {
  if (!dateString) return null;
  
  if (typeof dateString === 'number') {
    return new Date(dateString);
  }
  
  if (dateString instanceof Date) {
    return dateString;
  }
  
  // Если это массив (Java LocalDateTime) - УСТАРЕЛО после перехода на UTC
  // Оставлено для обратной совместимости
  if (Array.isArray(dateString) && dateString.length >= 3) {
    const [year, month, day, hour = 0, minute = 0, second = 0, nanosecond = 0] = dateString;
    const millisecond = Math.floor(nanosecond / 1000000);
    return new Date(Date.UTC(year, month - 1, day, hour, minute, second, millisecond));
  }
  
  let str = String(dateString).trim();
  
  if (/^\d+$/.test(str)) {
    const timestamp = parseInt(str, 10);
    if (timestamp > 1000000000000) {
      return new Date(timestamp);
    }
    if (timestamp > 1000000000) {
      return new Date(timestamp * 1000);
    }
  }
  
  // Бэкенд отправляет ISO с Z суффиксом (UTC)
  return new Date(str);
};

export default function Chats() {
  const router = useRouter();
  const user = getCurrentUser();
  const { chats, loading, refreshChats, readReceiptsByChatId } = useChats();
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  const createChat = useCreateChat();

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }
    refreshChats();
  }, [router, refreshChats]);

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
  }, [createChat]);

  const handleCreateChat = async (e) => {
    e.preventDefault();
    try {
      await createChat.handleCreateChat(async () => {
        await refreshChats();
        handleCloseModal();
      });
    } catch (error) {
    }
  };

  const handleCloseModal = () => {
    setShowCreateModal(false);
    createChat.resetForm();
  };

  const sortedChats = useMemo(() => {
    if (!chats || chats.length === 0) return [];
    
    return [...chats].sort((a, b) => {
      const timeA = getChatTime(a);
      const timeB = getChatTime(b);

      return timeB - timeA;
    });
  }, [chats]);

  const filteredChats = sortedChats.filter(chat => {
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

  const getLastMessageReadMeta = (chat) => {
    const lastMessage = chat?.lastMessage;
    if (!lastMessage?.createdAt || !user?.id) return { isRead: false, readCount: 0, totalOthers: 0 };

    const chatReadMap = readReceiptsByChatId?.[String(chat.id)] || {};
    const msgDate = parseServerDate(lastMessage.createdAt);
    const msgTime = msgDate ? msgDate.getTime() : NaN;
    if (Number.isNaN(msgTime)) return { isRead: false, readCount: 0, totalOthers: 0 };

    const participantIds = Array.isArray(chat?.participants)
      ? chat.participants.map(p => Number(p?.id)).filter(n => Number.isFinite(n))
      : [];
    const uniqueParticipantIds = Array.from(new Set(participantIds));
    const totalOthers = Math.max(0, (uniqueParticipantIds.length || 0) - 1);

    const otherReaders = Object.entries(chatReadMap)
      .filter(([rid]) => Number(rid) !== Number(user.id))
      .map(([, readAt]) => {
        const readDate = parseServerDate(readAt);
        return readDate ? readDate.getTime() : NaN;
      })
      .filter(t => !Number.isNaN(t));

    const readCount = otherReaders.reduce((acc, readAtTime) => (readAtTime >= msgTime ? acc + 1 : acc), 0);
    return { isRead: readCount > 0, readCount, totalOthers };
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
          id="chats-search"
          name="searchQuery"
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
            <Link
              key={chat.id}
              href={`/chat/${chat.id}`}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
            <div
              className={styles.chatItem}
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
                      {Number(chat.lastMessage.senderId) === Number(user?.id) ? (
                        <span title={(() => {
                          const meta = getLastMessageReadMeta(chat);
                          if (!meta.readCount) return 'Отправлено';
                          return meta.totalOthers > 1 ? `Прочитали ${meta.readCount}/${meta.totalOthers}` : 'Прочитано';
                        })()} style={{ display: 'inline-flex', alignItems: 'center', marginRight: 6 }}>
                          {(() => {
                            const meta = getLastMessageReadMeta(chat);
                            return meta.isRead ? <CheckCheck size={14} /> : <Check size={14} />;
                          })()}
                        </span>
                      ) : (
                        `${chat.lastMessage.senderDisplayName || chat.lastMessage.senderUsername}:`
                      )}
                    </span>
                    <span className={styles.lastMessageText}>
                      {chat.lastMessage.content ? (
                        <>
                          {chat.lastMessage.content.substring(0, 50)}
                          {chat.lastMessage.content.length > 50 ? '...' : ''}
                        </>
                      ) : (
                        chat.lastMessage.type === 'IMAGE' ? '📷 Изображение' :
                        chat.lastMessage.type === 'FILE' ? '📎 Файл' :
                        chat.lastMessage.type === 'VOICE' ? '🎤 Голосовое сообщение' :
                        'Сообщение'
                      )}
                    </span>
                  </div>
                )}
                {chat.unreadCount > 0 && (
                  <div className={styles.unreadBadge}>{chat.unreadCount}</div>
                )}
              </div>
            </div>
            </Link>
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
                    id="create-chat-search"
                    name="participantSearch"
                    value={createChat.participantUsernames}
                    onChange={createChat.handleSearchInputChange}
                    onFocus={() => {
                      if (createChat.searchResults.length > 0) {
                        createChat.setShowSearchResults(true);
                      }
                    }}
                    placeholder={createChat.chatType === 'DIRECT' 
                      ? 'Введите username или email...' 
                      : 'Введите username или email участников...'}
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
                              {user.email && (
                                <span style={{ marginLeft: '8px', color: '#888', fontSize: '12px' }}>
                                  • {user.email}
                                </span>
                              )}
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
                    ? 'Начните вводить username или email пользователя и выберите из результатов'
                    : 'Начните вводить username или email и выберите участников из результатов'}
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

