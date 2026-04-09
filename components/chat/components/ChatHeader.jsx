import { ArrowLeft, Search, Loader2, X, Phone } from 'lucide-react';
import { useRouter } from 'next/router';
import { getChatName } from '@/utils/chatHelpers';
import { getOnlineStatus } from '@/utils/dateHelpers';
import { useCall } from '@/context/CallContext';
import RoomControls from '@/components/room/RoomControls';
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
  onMenuClick: _onMenuClick,
  onStartCall,
}) {
  const router = useRouter();
  const { canInitiateCall } = useCall();

  const canCall = chat?.type === 'DIRECT' && canInitiateCall();

  const getCallTarget = () => {
    if (!chat?.participants || !user?.id) {
      return null;
    }

    const other = chat.participants.find((p) => {
      const participantId = p.user?.id || p.id;
      return Number(participantId) !== Number(user.id);
    });

    if (!other) {
      return null;
    }

    const targetUser = other.user || other;
    const result = {
      id: targetUser.id || other.id || other.userId,
      username: targetUser.username || other.username,
      displayName: targetUser.displayName || other.displayName,
    };

    return result;
  };

  const getDisplayChatName = () => {
    if (!chat) return 'Загрузка...';
    return getChatName(chat, user);
  };

  const getOtherParticipantStatus = () => {
    if (!chat?.participants || !user?.id) return { text: '', online: false };
    if (chat.type !== 'DIRECT')
      return { text: `${chat.participants?.length || 0} участников`, online: false };

    const other = chat.participants.find((p) => Number(p.id) !== Number(user.id));
    return getOnlineStatus(other, user.id);
  };

  const status = getOtherParticipantStatus();

  const handleBack = () => {
    router.push('/');
  };

  return (
    <div className={styles.header}>
      <button onClick={handleBack} className={styles.backButton} title="Назад">
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

      <div className={styles.headerActions}>
        {}
        {chat?.type === 'DIRECT' && (
          <button
            onClick={() => {
              const target = getCallTarget();
              if (target && onStartCall) {
                onStartCall(target.id, chat?.id, target);
              }
            }}
            className={styles.callButton}
            disabled={!canCall}
            title={canCall ? 'Позвонить' : 'Вы уже в активном звонке'}
          >
            <Phone size={20} />
          </button>
        )}

        {chat && chat.id && <RoomControls chatId={chat.id} chatType={chat.type} />}
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
    </div>
  );
}
