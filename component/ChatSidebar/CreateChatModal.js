import { useEffect } from 'react';
import Image from 'next/image';
import { X, Loader2, UserPlus } from 'lucide-react';
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
    } catch (error) {
    }
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
            <label htmlFor="chat-create-participants">
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
              onClick={handleClose}
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
  );
}

