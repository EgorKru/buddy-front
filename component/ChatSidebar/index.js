import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import { MessageCircle, Search, Plus, X, Loader2, Check, CheckCheck, UserPlus } from 'lucide-react';
import { getCurrentUser } from '@/utils/api';
import { useCreateChat } from '@/hooks/useCreateChat';
import { getChatName, getChatAvatar } from '@/utils/chatHelpers';
import { formatChatListTime, getOnlineStatus } from '@/utils/dateHelpers';
import styles from '@/component/ChatSidebar/index.module.css';
import { useChats, getChatTime } from '@/context/messaging';

const SIDEBAR_POSITION_KEY = 'chatSidebarPosition';
const SIDEBAR_WIDTH_KEY = 'chatSidebarWidth';
const MIN_SIDEBAR_WIDTH = 250;
const MAX_SIDEBAR_WIDTH = 600;
const DEFAULT_SIDEBAR_WIDTH = 320;

export default function ChatSidebar({ isOpen, onClose, currentChatId }) {
  const router = useRouter();
  const user = getCurrentUser();
  const { chats, loading, refreshChats, readReceiptsByChatId } = useChats();
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [sidebarPosition, setSidebarPosition] = useState('left');
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef(null);
  const resizeHandleRef = useRef(null);
  
  const createChat = useCreateChat();

  useEffect(() => {
    // Загружаем сохраненную позицию из localStorage
    const savedPosition = typeof window !== 'undefined' 
      ? localStorage.getItem(SIDEBAR_POSITION_KEY) || 'left'
      : 'left';
    setSidebarPosition(savedPosition);
    
    // Загружаем сохраненную ширину из localStorage
    const savedWidth = typeof window !== 'undefined'
      ? parseInt(localStorage.getItem(SIDEBAR_WIDTH_KEY) || DEFAULT_SIDEBAR_WIDTH, 10)
      : DEFAULT_SIDEBAR_WIDTH;
    setSidebarWidth(savedWidth);
    
    // Применяем класс к body для обновления стилей контейнеров
    if (typeof window !== 'undefined') {
      document.body.setAttribute('data-sidebar-position', savedPosition);
      document.body.setAttribute('data-sidebar-width', savedWidth);
      document.documentElement.style.setProperty('--sidebar-width', `${savedWidth}px`);
    }
  }, []);

  const toggleSidebarPosition = () => {
    const newPosition = sidebarPosition === 'left' ? 'right' : 'left';
    setSidebarPosition(newPosition);
    
    if (typeof window !== 'undefined') {
      localStorage.setItem(SIDEBAR_POSITION_KEY, newPosition);
      document.body.setAttribute('data-sidebar-position', newPosition);
    }
  };

  const handleResizeStart = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    
    const startX = e.clientX;
    const startWidth = sidebarWidth;
    let currentWidth = startWidth;
    
    const handleMouseMove = (e) => {
      const diff = sidebarPosition === 'left' 
        ? e.clientX - startX 
        : startX - e.clientX;
      const newWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, startWidth + diff));
      currentWidth = newWidth;
      
      setSidebarWidth(newWidth);
      if (typeof window !== 'undefined') {
        document.body.setAttribute('data-sidebar-width', newWidth);
        document.documentElement.style.setProperty('--sidebar-width', `${newWidth}px`);
      }
    };
    
    const handleMouseUp = () => {
      setIsResizing(false);
      if (typeof window !== 'undefined') {
        localStorage.setItem(SIDEBAR_WIDTH_KEY, currentWidth.toString());
      }
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [sidebarWidth, sidebarPosition]);

  useEffect(() => {
    if (sidebarRef.current) {
      sidebarRef.current.style.width = `${sidebarWidth}px`;
    }
  }, [sidebarWidth]);

  useEffect(() => {
    refreshChats();
  }, [refreshChats]);

  const handleCreateChat = async (e) => {
    e.preventDefault();
    try {
      await createChat.handleCreateChat(async () => {
        await refreshChats();
        handleCloseModal();
        if (onClose) onClose();
      });
    } catch (error) {
    }
  };

  const handleCloseModal = () => {
    setShowCreateModal(false);
    createChat.resetForm();
  };

  // Чаты уже отсортированы в контексте, но делаем дополнительную сортировку для надежности
  const sortedChats = useMemo(() => {
    if (!chats || chats.length === 0) return [];
    
    return [...chats].sort((a, b) => {
      const timeA = getChatTime(a);
      const timeB = getChatTime(b);
      
      // Более новые (большее время) идут первыми (сверху)
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
    return { isRead: readCount > 0, readCount, totalOthers };
  };

  const getOtherParticipantOnline = (chat) => {
    if (!chat?.participants || !user?.id) return false;
    if (chat.type !== 'DIRECT') return false;
    const other = chat.participants.find(p => Number(p.id) !== Number(user.id));
    return other?.online || false;
  };

  const isDesktop = typeof window !== 'undefined' && window.innerWidth > 768;
  const shouldShow = isDesktop || isOpen;

  if (!shouldShow) {
    return null;
  }

  return (
    <>
      <div 
        ref={sidebarRef}
        className={`${styles.sidebar} ${shouldShow ? styles.open : ''} ${styles[sidebarPosition]}`}
        style={{ width: `${sidebarWidth}px` }}
      >
        {isDesktop && (
          <div
            ref={resizeHandleRef}
            className={`${styles.resizeHandle} ${styles[sidebarPosition === 'left' ? 'resizeHandleRight' : 'resizeHandleLeft']}`}
            onMouseDown={handleResizeStart}
            title="Растянуть сайдбар"
          />
        )}
        <div className={styles.sidebarHeader}>
          <h2>Чаты</h2>
          <div className={styles.sidebarActions}>
            {isDesktop && (
              <button
                onClick={toggleSidebarPosition}
                className={styles.positionToggle}
                title={sidebarPosition === 'left' ? 'Переместить вправо' : 'Переместить влево'}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="1" y="1" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                  {sidebarPosition === 'left' ? (
                    <>
                      <rect x="2" y="2" width="5" height="16" rx="1" fill="currentColor" opacity="0.4"/>
                      <rect x="8" y="2" width="10" height="16" rx="1" fill="currentColor" opacity="0.1"/>
                    </>
                  ) : (
                    <>
                      <rect x="2" y="2" width="10" height="16" rx="1" fill="currentColor" opacity="0.1"/>
                      <rect x="13" y="2" width="5" height="16" rx="1" fill="currentColor" opacity="0.4"/>
                    </>
                  )}
                </svg>
              </button>
            )}
            <button
              onClick={() => setShowCreateModal(true)}
              className={styles.createButton}
              title="Создать чат"
            >
              <Plus size={20} />
            </button>
            {typeof window !== 'undefined' && window.innerWidth <= 768 && (
              <button onClick={onClose} className={styles.closeButton} title="Закрыть">
                <X size={20} />
              </button>
            )}
          </div>
        </div>

        <div className={styles.searchContainer}>
          <Search size={18} className={styles.searchIcon} />
          <input
            type="text"
            id="chat-sidebar-search"
            name="chatSearch"
            placeholder="Поиск чатов..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        <div className={styles.chatsList}>
          {loading ? (
            <div className={styles.loading}>Загрузка...</div>
          ) : filteredChats.length === 0 ? (
            <div className={styles.emptyState}>
              <MessageCircle size={48} className={styles.emptyIcon} />
              <p>Нет чатов</p>
            </div>
          ) : (
            filteredChats.map((chat) => (
              <div
                key={chat.id}
                className={`${styles.chatItem} ${currentChatId === String(chat.id) ? styles.active : ''}`}
                onClick={() => {
                  router.push(`/chat/${chat.id}`);
                  if (onClose) onClose();
                }}
              >
                <div className={styles.chatAvatarWrapper}>
                  <div className={styles.chatAvatar}>
                    {getChatAvatar(chat, user) ? (
                      <Image
                        src={getChatAvatar(chat, user)}
                        alt=""
                        width={32}
                        height={32}
                        unoptimized
                      />
                    ) : (
                      <MessageCircle size={20} />
                    )}
                  </div>
                  {getOtherParticipantOnline(chat) && (
                    <span className={styles.onlineIndicator} title="Онлайн" />
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
                      <span className={styles.lastMessageText}>
                        {Number(chat.lastMessage.senderId) === Number(user?.id) && (
                          (() => {
                            const meta = getLastMessageReadMeta(chat);
                            const title = meta.isRead 
                              ? (meta.totalOthers > 1 ? `Прочитали ${meta.readCount}/${meta.totalOthers}` : 'Прочитано')
                              : 'Отправлено';
                            return (
                              <span title={title} style={{ display: 'inline-flex', alignItems: 'center', marginRight: 6 }}>
                                {meta.isRead ? (
                                  <CheckCheck size={14} className={styles.statusIconRead} />
                                ) : (
                                  <CheckCheck size={14} className={styles.statusIcon} />
                                )}
                              </span>
                            );
                          })()
                        )}
                        {(chat.lastMessage.content || '').substring(0, 40)}
                        {(chat.lastMessage.content || '').length > 40 ? '...' : ''}
                      </span>
                    </div>
                  )}
                </div>
                {chat.unreadCount > 0 && (
                  <div className={styles.unreadBadge}>{chat.unreadCount}</div>
                )}
              </div>
            ))
          )}
        </div>
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
                    id="chat-create-group-name"
                    name="chatName"
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
                    id="chat-create-participants"
                    name="participants"
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
    </>
  );
}
