import { useEffect } from 'react';
import Image from 'next/image';
import { X, Loader2, Search, UserPlus, Users } from 'lucide-react';
import { useCreateChat } from '@/hooks/useCreateChat';
import styles from '@/component/ChatSidebar/index.module.css';

export default function CreateChatModal({ isOpen, onClose, onSuccess }) {
  const createChat = useCreateChat();

  useEffect(() => {
    if (!isOpen) {
      createChat.resetForm();
    }
  }, [isOpen]);

  const handleCreateChat = async (e) => {
    e.preventDefault();
    try {
      await createChat.handleCreateChat(async () => {
        onSuccess();
        onClose();
      });
    } catch (error) {}
  };

  const handleClose = () => {
    createChat.resetForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={handleClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Создать чат</h2>
          <button onClick={handleClose} className={styles.modalClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleCreateChat} className={styles.modalForm}>
          <div className={styles.modalTopSection}>
            <div className={styles.chatTypeSelector}>
              <button
                type="button"
                onClick={() => createChat.setChatType('DIRECT')}
                className={`${styles.chatTypeButton} ${createChat.chatType === 'DIRECT' ? styles.chatTypeButtonActive : ''}`}
              >
                <Users size={18} />
                Прямой чат
              </button>
              <button
                type="button"
                onClick={() => createChat.setChatType('GROUP')}
                className={`${styles.chatTypeButton} ${createChat.chatType === 'GROUP' ? styles.chatTypeButtonActive : ''}`}
              >
                <UserPlus size={18} />
                Групповой чат
              </button>
            </div>

            {createChat.chatType === 'GROUP' && (
              <div className={styles.groupNameInput}>
                <input
                  type="text"
                  id="chat-create-group-name"
                  name="chatName"
                  value={createChat.chatName}
                  onChange={(e) => createChat.setChatName(e.target.value)}
                  placeholder="Название группы"
                  className={styles.input}
                  required
                  autoFocus={createChat.chatType === 'GROUP'}
                />
              </div>
            )}

            <div className={styles.searchInputContainer}>
              <Search size={18} className={styles.searchIcon} />
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
                placeholder={
                  createChat.chatType === 'DIRECT' ? 'Поиск пользователя...' : 'Поиск участников...'
                }
                className={styles.searchInput}
                autoFocus={createChat.chatType === 'DIRECT'}
              />
              {createChat.searching && <Loader2 size={16} className={styles.searchLoader} />}
            </div>

            {createChat.selectedParticipants.length > 0 && (
              <div className={styles.selectedParticipantsCompact}>
                {createChat.selectedParticipants.map((participant) => (
                  <div key={participant.id} className={styles.participantTagCompact}>
                    <div className={styles.participantTagAvatar}>
                      {participant.avatarUrl ? (
                        <Image
                          src={participant.avatarUrl}
                          alt=""
                          width={24}
                          height={24}
                          unoptimized
                        />
                      ) : (
                        <span>
                          {(participant.displayName || participant.username)?.[0]?.toUpperCase() ||
                            '?'}
                        </span>
                      )}
                    </div>
                    <span className={styles.participantTagName}>
                      {participant.displayName || participant.username}
                    </span>
                    <button
                      type="button"
                      onClick={() => createChat.handleRemoveParticipant(participant.id)}
                      className={styles.removeParticipantButton}
                      aria-label="Удалить"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={styles.searchResultsContainer}>
            {createChat.showSearchResults && createChat.searchResults.length > 0 && (
              <div className={styles.searchResultsList}>
                {createChat.searchResults.map((user) => (
                  <div
                    key={user.id}
                    className={styles.searchResultItem}
                    onClick={() => createChat.handleSelectParticipant(user)}
                  >
                    <div className={styles.searchResultAvatar}>
                      {user.avatarUrl ? (
                        <Image src={user.avatarUrl} alt="" width={40} height={40} unoptimized />
                      ) : (
                        <div className={styles.searchResultAvatarPlaceholder}>
                          {(user.displayName || user.username)?.[0]?.toUpperCase() || '?'}
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
                          <span className={styles.searchResultEmail}> • {user.email}</span>
                        )}
                      </div>
                    </div>
                    <UserPlus size={18} className={styles.addIcon} />
                  </div>
                ))}
              </div>
            )}

            {createChat.showSearchResults &&
              createChat.searchResults.length === 0 &&
              createChat.participantUsernames.length >= 2 &&
              !createChat.searching && (
                <div className={styles.searchResultEmpty}>Пользователи не найдены</div>
              )}

            {!createChat.showSearchResults && createChat.participantUsernames.length === 0 && (
              <div className={styles.searchResultEmpty}>
                Начните вводить имя или email пользователя
              </div>
            )}
          </div>

          {createChat.createError && <div className={styles.error}>{createChat.createError}</div>}

          <div className={styles.modalActions}>
            <button
              type="button"
              onClick={handleClose}
              className={styles.cancelButton}
              disabled={createChat.creating}
            >
              Отмена
            </button>
            <button
              type="submit"
              className={styles.submitButton}
              disabled={
                createChat.creating ||
                (createChat.chatType === 'DIRECT' &&
                  createChat.selectedParticipants.length !== 1) ||
                (createChat.chatType === 'GROUP' &&
                  (createChat.selectedParticipants.length === 0 || !createChat.chatName.trim()))
              }
            >
              {createChat.creating ? 'Создание...' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
