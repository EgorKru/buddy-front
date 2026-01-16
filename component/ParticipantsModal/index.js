import { useState } from "react";
import { X, Mic, MicOff, Video, VideoOff, Crown, Shield, User, Hand, MoreVertical, UserMinus, VolumeX, UserPlus } from "lucide-react";
import styles from "./index.module.css";

const ParticipantsModal = ({ 
  isOpen, 
  onClose, 
  participants, 
  currentUserId,
  isHost,
  isCoHost,
  onPromote,
  onDemote,
  onMute,
  onKick
}) => {
  const [menuOpenFor, setMenuOpenFor] = useState(null);
  
  if (!isOpen) return null;

  const canManage = isHost || isCoHost;

  const getRoleIcon = (role) => {
    switch (role) {
      case 'HOST':
        return <Crown size={14} className={styles.hostIcon} />;
      case 'CO_HOST':
        return <Shield size={14} className={styles.coHostIcon} />;
      default:
        return null;
    }
  };

  const getRoleLabel = (role) => {
    switch (role) {
      case 'HOST':
        return 'Организатор';
      case 'CO_HOST':
        return 'Со-организатор';
      default:
        return 'Участник';
    }
  };

  const getInitials = (name) => {
    if (!name) return "?";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const sortedParticipants = [...(participants || [])].sort((a, b) => {
    const roleOrder = { HOST: 0, CO_HOST: 1, PARTICIPANT: 2 };
    const roleA = roleOrder[a.role] ?? 2;
    const roleB = roleOrder[b.role] ?? 2;
    if (roleA !== roleB) return roleA - roleB;
    
    if (a.handRaised && !b.handRaised) return -1;
    if (!a.handRaised && b.handRaised) return 1;
    return 0;
  });

  const handleMenuClick = (e, participantId) => {
    e.stopPropagation();
    setMenuOpenFor(menuOpenFor === participantId ? null : participantId);
  };

  const handleAction = (action, userId) => {
    setMenuOpenFor(null);
    action(userId);
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>
            Участники ({participants?.length || 0})
          </h2>
          <button className={styles.closeButton} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className={styles.participantsList}>
          {sortedParticipants.map((participant) => {
            const user = participant.user || {};
            const userId = user.id;
            const isMe = userId === currentUserId;
            const displayName = user.displayName || user.username || `Участник ${userId}`;
            const isParticipantHost = participant.role === 'HOST';
            const isParticipantCoHost = participant.role === 'CO_HOST';
            const canManageThis = canManage && !isMe && !isParticipantHost;
            
            return (
              <div 
                key={participant.id || userId} 
                className={`${styles.participantItem} ${isMe ? styles.isMe : ''} ${participant.handRaised ? styles.handRaised : ''}`}
              >
                <div className={styles.avatarWrapper}>
                  <div className={styles.avatar}>
                    {getInitials(displayName)}
                  </div>
                  {participant.isActive !== false && (
                    <div className={styles.onlineIndicator} />
                  )}
                  {participant.handRaised && (
                    <div className={styles.handRaisedBadge}>
                      <Hand size={10} />
                    </div>
                  )}
                </div>
                
                <div className={styles.participantInfo}>
                  <div className={styles.nameRow}>
                    <span className={styles.name}>
                      {displayName}
                      {isMe && <span className={styles.youLabel}>(Вы)</span>}
                    </span>
                    {getRoleIcon(participant.role)}
                    {participant.handRaised && !isMe && (
                      <span className={styles.handRaisedLabel}>✋</span>
                    )}
                  </div>
                  <span className={styles.role}>
                    {getRoleLabel(participant.role)}
                    {participant.screenSharing && <span className={styles.sharingLabel}> • Показывает экран</span>}
                  </span>
                </div>

                <div className={styles.mediaStatus}>
                  {participant.audioEnabled !== false ? (
                    <Mic size={16} className={styles.mediaOn} />
                  ) : (
                    <MicOff size={16} className={styles.mediaOff} />
                  )}
                  {participant.videoEnabled ? (
                    <Video size={16} className={styles.mediaOn} />
                  ) : (
                    <VideoOff size={16} className={styles.mediaOff} />
                  )}
                </div>

                {}
                {canManageThis && (
                  <div className={styles.actionMenu}>
                    <button 
                      className={styles.menuButton}
                      onClick={(e) => handleMenuClick(e, participant.id || userId)}
                    >
                      <MoreVertical size={18} />
                    </button>
                    
                    {menuOpenFor === (participant.id || userId) && (
                      <div className={styles.dropdown}>
                        {participant.audioEnabled !== false && onMute && (
                          <button 
                            className={styles.dropdownItem}
                            onClick={() => handleAction(onMute, userId)}
                          >
                            <VolumeX size={16} />
                            <span>Выключить микрофон</span>
                          </button>
                        )}
                        
                        {isHost && !isParticipantCoHost && onPromote && (
                          <button 
                            className={styles.dropdownItem}
                            onClick={() => handleAction(onPromote, userId)}
                          >
                            <UserPlus size={16} />
                            <span>Сделать со-организатором</span>
                          </button>
                        )}
                        
                        {isHost && isParticipantCoHost && onDemote && (
                          <button 
                            className={styles.dropdownItem}
                            onClick={() => handleAction(onDemote, userId)}
                          >
                            <User size={16} />
                            <span>Убрать со-организатора</span>
                          </button>
                        )}
                        
                        {onKick && (
                          <button 
                            className={`${styles.dropdownItem} ${styles.danger}`}
                            onClick={() => handleAction(onKick, userId)}
                          >
                            <UserMinus size={16} />
                            <span>Удалить из встречи</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {(!participants || participants.length === 0) && (
            <div className={styles.emptyState}>
              <User size={48} />
              <p>Нет участников</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ParticipantsModal;
