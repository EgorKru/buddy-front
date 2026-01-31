import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { MessageCircle, Search, Plus, X } from 'lucide-react';
import { getCurrentUser } from '@/utils/api';
import { useChats, getChatTime } from '@/context/messaging';
import { useSidebarResize } from '@/hooks/useSidebarResize';
import { useLastMessagesLoader } from '@/hooks/useLastMessagesLoader';
import ChatListItem from '@/component/ChatSidebar/ChatListItem';
import CreateChatModal from '@/component/ChatSidebar/CreateChatModal';
import styles from '@/component/ChatSidebar/index.module.css';

// Функция для парсинга дат с бэкенда (включая Java LocalDateTime массив)
const parseServerDate = (dateString) => {
  if (!dateString) return null;
  if (typeof dateString === 'number') return new Date(dateString);
  if (dateString instanceof Date) return dateString;
  if (Array.isArray(dateString) && dateString.length >= 3) {
    const [year, month, day, hour = 0, minute = 0, second = 0, nanosecond = 0] = dateString;
    const millisecond = Math.floor(nanosecond / 1000000);
    return new Date(year, month - 1, day, hour, minute, second, millisecond);
  }
  let str = String(dateString).trim();
  if (/^\d+$/.test(str)) {
    const timestamp = parseInt(str, 10);
    if (timestamp > 1000000000000) return new Date(timestamp);
    if (timestamp > 1000000000) return new Date(timestamp * 1000);
  }
  if (!str.endsWith('Z') && !str.includes('+') && !str.includes('-', 10)) {
    str = str + 'Z';
  }
  return new Date(str);
};

export default function ChatSidebar({ isOpen, onClose, currentChatId }) {
  const router = useRouter();
  const user = getCurrentUser();
  const { 
    chats, 
    loading, 
    refreshChats, 
    readAtByChatIdByUserId, 
    messageIdsByChatId, 
    messagesById, 
    upsertMessage, 
    upsertChat 
  } = useChats();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  
  useEffect(() => {
    setIsMounted(true);
    const checkDesktop = () => {
      setIsDesktop(window.innerWidth > 768);
    };
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);
  
  const {
    sidebarPosition,
    sidebarWidth,
    sidebarRef,
    resizeHandleRef,
    toggleSidebarPosition,
    handleResizeStart,
  } = useSidebarResize();

  useLastMessagesLoader(
    chats,
    loading,
    currentChatId,
    upsertMessage,
    upsertChat,
    refreshChats
  );

  const sortedChats = useMemo(() => {
    if (!chats || chats.length === 0) return [];
    
    const enrichedChats = chats.map(chat => {
      if (!chat.lastMessage && messageIdsByChatId && messagesById) {
        const chatId = String(chat.id);
        const messageIds = messageIdsByChatId[chatId] || [];
        if (messageIds.length > 0) {
          const chatMessages = messageIds
            .map(id => messagesById[String(id)])
            .filter(Boolean)
            .filter(msg => !msg.deletedForMe && !msg.deletedForAll)
            .sort((a, b) => {
              const dateA = parseServerDate(a.createdAt);
              const dateB = parseServerDate(b.createdAt);
              const timeA = dateA ? dateA.getTime() : 0;
              const timeB = dateB ? dateB.getTime() : 0;
              return timeB - timeA;
            });
          
          if (chatMessages.length > 0) {
            return {
              ...chat,
              lastMessage: chatMessages[0],
            };
          }
        }
      }
      return chat;
    });
    
    return enrichedChats.sort((a, b) => {
      const timeA = getChatTime(a);
      const timeB = getChatTime(b);
      return timeB - timeA;
    });
  }, [chats, messageIdsByChatId, messagesById]);

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

  const handleChatClick = (chatId, e) => {
    
    if (e) {
      e.preventDefault();
    }
    
    router.push(`/chat/${chatId}`, undefined, { shallow: false });
    if (onClose) onClose();
  };

  const handleCreateSuccess = async () => {
    await refreshChats();
    setShowCreateModal(false);
    if (onClose) onClose();
  };

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
        {isMounted && isDesktop && (
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
            {isMounted && isDesktop && (
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
            {isMounted && !isDesktop && (
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
              <Link
                key={chat.id}
                href={`/chat/${chat.id}`}
                onClick={() => {
                  if (onClose) onClose();
                }}
                style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
              >
                <ChatListItem
                  chat={chat}
                  user={user}
                  currentChatId={currentChatId}
                  readAtByChatIdByUserId={readAtByChatIdByUserId}
                />
              </Link>
            ))
          )}
        </div>
      </div>

      <CreateChatModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleCreateSuccess}
      />
    </>
  );
}
