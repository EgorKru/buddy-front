import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/router";
import { useRoomProtocol } from "@/hooks/useRoomProtocol";
import { getCurrentUser } from "@/utils/api";

import Player from "@/component/Player";
import Bottom from "@/component/Bottom";
import CopySection from "@/component/CopySection";
import ParticipantsModal from "@/component/ParticipantsModal";
import RoomToast from "@/component/RoomToast";

import styles from "@/styles/room.module.css";

const Room = () => {
  const router = useRouter();
  const { roomId, audio, video } = router.query;
  
  const initialAudio = audio !== '0';
  const initialVideo = video !== '0';
  
  const {
    participants,
    localStream,
    remoteStreams,
    audioEnabled,
    videoEnabled,
    isInRoom,
    error,
    toggleAudio,
    toggleVideo,
    leaveRoom,
    endRoom,
    joinRoom,
    clearError,
    // Новые функции
    handRaised,
    raiseHand,
    isScreenSharing,
    screenStream,
    startScreenShare,
    stopScreenShare,
    myRole,
    isHost,
    isCoHost,
    promoteParticipant,
    demoteParticipant,
    muteParticipant,
    kickParticipant,
  } = useRoomProtocol(roomId);

  const [players, setPlayers] = useState({});
  const [playerNames, setPlayerNames] = useState({});
  const [isJoining, setIsJoining] = useState(false);
  const [meetingTime, setMeetingTime] = useState(0);
  const [showParticipants, setShowParticipants] = useState(false);
  const [toastNotifications, setToastNotifications] = useState([]);
  const hasJoinedRef = useRef(false);
  const prevParticipantsRef = useRef([]);
  
  const currentUser = getCurrentUser();
  const currentUserId = currentUser?.id || null;
  const currentUserIdStr = currentUserId?.toString() || 'local';
  const currentUserName = currentUser?.displayName || currentUser?.username || "Вы";

  // Отслеживаем вход/выход участников для тостов
  useEffect(() => {
    if (!isInRoom) return;
    
    const prevIds = new Set(prevParticipantsRef.current.map(p => p.user?.id));
    const currentIds = new Set(participants.map(p => p.user?.id));
    
    // Новые участники (кроме себя)
    participants.forEach(p => {
      const userId = p.user?.id;
      if (userId && !prevIds.has(userId) && userId !== currentUserId) {
        const userName = p.user?.displayName || p.user?.username || `Участник ${userId}`;
        addToast('join', userName, userId);
      }
    });
    
    // Ушедшие участники
    prevParticipantsRef.current.forEach(p => {
      const userId = p.user?.id;
      if (userId && !currentIds.has(userId) && userId !== currentUserId) {
        const userName = p.user?.displayName || p.user?.username || `Участник ${userId}`;
        addToast('leave', userName, userId);
      }
    });
    
    prevParticipantsRef.current = [...participants];
  }, [participants, isInRoom, currentUserId]);

  const addToast = useCallback((type, userName, odUserId) => {
    const id = `${type}-${odUserId}-${Date.now()}`;
    setToastNotifications(prev => [...prev, { id, type, userName }]);
  }, []);

  const dismissToast = useCallback((id) => {
    setToastNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  // Таймер встречи
  useEffect(() => {
    if (!isInRoom) return;
    const interval = setInterval(() => {
      setMeetingTime(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isInRoom]);

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Подключение к комнате — только один раз
  useEffect(() => {
    if (roomId && !hasJoinedRef.current && !isInRoom && !error) {
      hasJoinedRef.current = true;
      setIsJoining(true);
      joinRoom(roomId, true, initialAudio, initialVideo)
        .then(() => {
          setIsJoining(false);
        })
        .catch(() => {
          setIsJoining(false);
          hasJoinedRef.current = false; // Разрешаем повторную попытку при ошибке
        });
    }
  }, [roomId]);

  const handleRetry = async () => {
    clearError();
    hasJoinedRef.current = false;
    setIsJoining(true);
    if (roomId) {
      try {
        hasJoinedRef.current = true;
        await joinRoom(roomId, true);
        setIsJoining(false);
      } catch (err) {
        setIsJoining(false);
        hasJoinedRef.current = false;
      }
    }
  };

  const handleJoinWithoutMedia = async () => {
    clearError();
    hasJoinedRef.current = false;
    setIsJoining(true);
    if (roomId) {
      try {
        hasJoinedRef.current = true;
        await joinRoom(roomId, false);
        setIsJoining(false);
      } catch (err) {
        setIsJoining(false);
        hasJoinedRef.current = false;
      }
    }
  };

  // Обновляем локальный плеер при изменении stream
  useEffect(() => {
    if (localStream) {
      setPlayers(prev => ({
        ...prev,
        [currentUserIdStr]: {
          stream: localStream,
          muted: true, // Локальный всегда muted чтобы не слышать себя
          playing: videoEnabled,
          isLocal: true,
        },
      }));
      setPlayerNames(prev => ({
        ...prev,
        [currentUserIdStr]: currentUserName,
      }));
    }
  }, [localStream, currentUserIdStr, currentUserName]);

  // Обновляем состояние видео при переключении камеры
  useEffect(() => {
    setPlayers(prev => {
      if (!prev[currentUserIdStr]) return prev;
      return {
        ...prev,
        [currentUserIdStr]: {
          ...prev[currentUserIdStr],
          playing: videoEnabled,
        },
      };
    });
  }, [videoEnabled, currentUserIdStr]);

  // Обновляем удалённые плееры
  useEffect(() => {
    setPlayers(prev => {
      const newPlayers = { ...prev };
      
      // Добавляем/обновляем удалённые стримы
      remoteStreams.forEach((stream, odUserId) => {
        const userIdStr = odUserId.toString();
        newPlayers[userIdStr] = {
          stream: stream,
          muted: false, // Удалённые не muted
          playing: true,
          isLocal: false,
        };
      });
      
      // Удаляем плееры для отключившихся участников
      Object.keys(newPlayers).forEach(id => {
        if (id !== currentUserIdStr && !remoteStreams.has(parseInt(id)) && !remoteStreams.has(id)) {
          delete newPlayers[id];
        }
      });
      
      return newPlayers;
    });

    // Обновляем имена участников
    setPlayerNames(prev => {
      const newNames = { ...prev };
      remoteStreams.forEach((_, odUserId) => {
        const userIdStr = odUserId.toString();
        // Новая структура: participant.user.id
        const participant = participants.find(p => 
          p.user?.id === odUserId || p.user?.id === parseInt(odUserId)
        );
        const user = participant?.user;
        newNames[userIdStr] = user?.displayName || user?.username || `Участник ${userIdStr.substring(0, 6)}`;
      });
      return newNames;
    });
  }, [remoteStreams, participants, currentUserIdStr]);

  useEffect(() => {
    participants.forEach(participant => {
      // Новая структура: participant.user.id
      const userIdStr = participant.user?.id?.toString();
      if (userIdStr && !playerNames[userIdStr]) {
        const user = participant.user;
        setPlayerNames(prev => ({
          ...prev,
          [userIdStr]: user?.displayName || user?.username || `Участник ${userIdStr.substring(0, 6)}`,
        }));
      }
    });
  }, [participants]);

  const handleLeaveRoom = () => {
    try {
      const participantCount = participants.length || Object.keys(players).length || 0;
      if (participantCount <= 1) {
        endRoom();
      } else {
        leaveRoom();
      }
      router.push('/');
    } catch (error) {
      router.push('/');
    }
  };

  const handleToggleAudio = async () => {
    await toggleAudio();
    // audioEnabled обновится в useRoomProtocol, 
    // Player получит новое значение через проп
  };

  const handleToggleVideo = async () => {
    await toggleVideo();
    // videoEnabled обновится в useRoomProtocol,
    // useEffect синхронизирует players[].playing
  };

  const playerHighlighted = players[currentUserIdStr];
  const nonHighlightedPlayers = Object.keys(players).reduce((acc, playerId) => {
    if (playerId !== currentUserIdStr) {
      acc[playerId] = players[playerId];
    }
    return acc;
  }, {});

  const participantCount = participants.length || Object.keys(players).length || 1;

  // Экран ошибки
  if (error && !localStream && !isInRoom) {
    return (
      <div className={styles.roomContainer}>
        <div className={styles.topBar}>
          <div className={styles.logo}>Pager Meet</div>
        </div>
        <div className={styles.centerContent}>
          <div className={styles.errorBox}>
            <h2>Ошибка подключения</h2>
            <p>{error}</p>
            <div className={styles.errorActions}>
              <button onClick={handleRetry} className={styles.primaryButton}>
                Попробовать снова
              </button>
              <button onClick={handleJoinWithoutMedia} className={styles.secondaryButton}>
                Войти без камеры
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Экран загрузки
  if ((!isInRoom && !error) || isJoining) {
    return (
      <div className={styles.roomContainer}>
        <div className={styles.topBar}>
          <div className={styles.logo}>Pager Meet</div>
        </div>
        <div className={styles.centerContent}>
          <div className={styles.loader}></div>
          <p className={styles.loadingText}>Подключение к комнате...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.roomContainer}>
      {/* Тост-уведомления */}
      <RoomToast 
        notifications={toastNotifications} 
        onDismiss={dismissToast} 
      />

      {/* Верхняя панель */}
      <div className={styles.topBar}>
        <div className={styles.logo}>Pager Meet</div>
        <div className={styles.meetingInfo}>
          <span className={styles.timer}>{formatTime(meetingTime)}</span>
          <span className={styles.roomCode}>{roomId}</span>
        </div>
      </div>
      
      {/* Видео контейнер */}
      <div className={styles.videoGrid}>
        {/* Превью своей демонстрации экрана */}
        {isScreenSharing && screenStream && (
          <div className={styles.screenSharePreview}>
            <video
              autoPlay
              playsInline
              muted
              ref={(el) => { if (el) el.srcObject = screenStream; }}
              className={styles.screenShareVideo}
            />
            <div className={styles.screenShareLabel}>Ваша демонстрация</div>
          </div>
        )}
        
        {/* Локальный плеер */}
        {playerHighlighted && (
          <div className={Object.keys(nonHighlightedPlayers).length > 0 ? styles.videoItem : styles.videoItemFull}>
            <Player
              stream={playerHighlighted.stream}
              muted={true}  // Локальный всегда muted чтобы не слышать себя
              playing={playerHighlighted.playing}
              isActive
              isLocal
              audioEnabled={audioEnabled}  // Реальное состояние микрофона
              playerId={currentUserIdStr}
              playerName={playerNames[currentUserIdStr]}
              handRaised={handRaised}
              isScreenSharing={isScreenSharing}
            />
          </div>
        )}
        
        {/* Удалённые плееры */}
        {Object.keys(nonHighlightedPlayers).map((playerId) => {
          const player = nonHighlightedPlayers[playerId];
          // Находим участника чтобы получить его состояние
          const participant = participants.find(p => 
            p.user?.id?.toString() === playerId
          );
          return (
            <div key={playerId} className={styles.videoItem}>
              <Player
                stream={player.stream}
                muted={false}  // Удалённых слышим
                playing={player.playing}
                isActive={false}
                isLocal={false}
                audioEnabled={participant?.audioEnabled !== false}  // Состояние микрофона участника
                playerId={playerId}
                playerName={playerNames[playerId]}
                handRaised={participant?.handRaised}
                isScreenSharing={participant?.screenSharing}
              />
            </div>
          );
        })}
        
        {/* Если один участник — показываем CopySection */}
        {participantCount <= 1 && (
          <CopySection roomId={roomId} />
        )}
      </div>
      
      {/* Нижняя панель управления */}
      <Bottom
        muted={!audioEnabled}
        playing={videoEnabled}
        toggleAudio={handleToggleAudio}
        toggleVideo={handleToggleVideo}
        leaveRoom={handleLeaveRoom}
        participantCount={participantCount}
        onParticipantsClick={() => setShowParticipants(true)}
        handRaised={handRaised}
        onRaiseHand={raiseHand}
        isScreenSharing={isScreenSharing}
        onToggleScreenShare={isScreenSharing ? stopScreenShare : startScreenShare}
      />

      {/* Модалка участников */}
      <ParticipantsModal
        isOpen={showParticipants}
        onClose={() => setShowParticipants(false)}
        participants={participants}
        currentUserId={currentUserId}
        isHost={isHost}
        isCoHost={isCoHost}
        onPromote={promoteParticipant}
        onDemote={demoteParticipant}
        onMute={muteParticipant}
        onKick={kickParticipant}
      />
    </div>
  );
};

export default Room;

