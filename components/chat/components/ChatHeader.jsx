import { ArrowLeft, Search, Loader2, X } from 'lucide-react';
import { useRouter } from 'next/router';
import { getChatName } from '@/utils/chatHelpers';
import { getOnlineStatus } from '@/utils/dateHelpers';
import styles from '@/styles/chat.module.css';

export default function ChatHeader({
  chat,
  user,
  searchOpen,
  searchText,
  isSearching,
  searchInputRef,
  onOpenSearch,
  onCloseSearch,
  onSearchSubmit,
  onSearchTextChange,
  onMenuClick
}) {
  const router = useRouter();

  const getDisplayChatName = () => {
    if (!chat) return 'Загрузка...';
    return getChatName(chat, user);
  };

  const getOtherParticipantStatus = () => {
    if (!chat?.participants || !user?.id) return { text: '', online: false };
    if (chat.type !== 'DIRECT') return { text: `${chat.participants?.length || 0} участников`, online: false };
    
    const other = chat.participants.find(p => Number(p.id) !== Number(user.id));
    return getOnlineStatus(other, user.id);
  };

  const status = getOtherParticipantStatus();

  const handleBack = () => {
    router.push('/');
  };

  return (
    <div className={styles.header}>
      <button 
        onClick={handleBack} 
        className={styles.backButton}
        title="Назад"
      >
        <ArrowLeft size={20} />
      </button>
      
      <div className={styles.chatInfo}>
        <h1>{getDisplayChatName()}</h1>
        {status.text && (
          <div className={styles.onlineStatus}>
            {status.online && <span className={styles.onlineDot} />}
            <span className={status.online ? styles.onlineText : styles.offlineText}>
              {status.text}
            </span>
          </div>
        )}
      </div>
      
      <div className={styles.searchWrapper}>
        {!searchOpen ? (
          <button
            onClick={onOpenSearch}
            className={styles.searchToggleButton}
            title="Поиск сообщений"
          >
            <Search size={20} />
          </button>
        ) : (
          <div className={styles.searchExpanded}>
            <form onSubmit={onSearchSubmit} className={styles.searchFormInline}>
              <input
                ref={searchInputRef}
                type="text"
                value={searchText}
                onChange={(e) => onSearchTextChange(e.target.value)}
                placeholder="Поиск сообщений..."
                className={styles.searchInputInline}
                autoFocus
              />
              {isSearching && (
                <div className={styles.searchLoadingInline}>
                  <Loader2 size={16} className={styles.spinner} />
                </div>
              )}
              <button
                type="button"
                onClick={onCloseSearch}
                className={styles.searchCloseButtonInline}
                title="Закрыть"
              >
                <X size={18} />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

