import { useEffect, useState, useRef, useCallback, useMemo } from "react";
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
    if (roomId && !hasJoinedRef.current && !isInRoom) {
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
    // Всегда показываем локального участника, даже если нет стрима
    setPlayers(prev => ({
      ...prev,
      [currentUserIdStr]: {
        stream: localStream || null,
        muted: true, // Локальный всегда muted чтобы не слышать себя
        playing: localStream ? videoEnabled : false,
        isLocal: true,
      },
    }));
    setPlayerNames(prev => ({
      ...prev,
      [currentUserIdStr]: currentUserName,
    }));
  }, [localStream, videoEnabled, currentUserIdStr, currentUserName]);

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
        // Проверяем, есть ли активные видео треки (включая screen sharing)
        const hasVideoTracks = stream && stream.getVideoTracks().length > 0;
        const videoTracks = hasVideoTracks ? stream.getVideoTracks() : [];
        const hasActiveVideoTracks = videoTracks.some(track => 
          track.readyState === 'live' && track.enabled
        );
        // Проверяем наличие screen sharing треков
        const hasScreenShareTracks = videoTracks.some(track => 
          track.readyState === 'live' && 
          (track.label?.toLowerCase().includes('screen') || 
           track.label?.toLowerCase().includes('display'))
        );
        
        newPlayers[userIdStr] = {
          stream: stream,
          muted: false, // Удалённые не muted
          playing: hasActiveVideoTracks || hasScreenShareTracks, // playing = true если есть активные видео треки или screen sharing
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

    // Обновляем имена участников для всех участников (не только тех, у кого есть stream)
    setPlayerNames(prev => {
      const newNames = { ...prev };
      // Обновляем имена для всех участников
      participants.forEach(participant => {
        const participantId = participant.user?.id;
        if (!participantId) return;
        const userIdStr = participantId.toString();
        const user = participant.user;
        const displayName = user?.displayName || user?.username || `Участник ${userIdStr.substring(0, 6)}`;
        newNames[userIdStr] = displayName;
      });
      return newNames;
    });
  }, [remoteStreams, participants, currentUserIdStr]);

  // Обновляем имена всех участников сразу при изменении списка participants
  useEffect(() => {
    if (!participants || participants.length === 0) return;
    
    setPlayerNames(prev => {
      const newNames = { ...prev };
      let hasChanges = false;
      
      participants.forEach(participant => {
        const userIdStr = participant.user?.id?.toString();
        if (userIdStr) {
          const user = participant.user;
          const displayName = user?.displayName || user?.username || `Участник ${userIdStr.substring(0, 6)}`;
          // Обновляем имя, даже если оно уже есть (на случай изменения)
          if (newNames[userIdStr] !== displayName) {
            newNames[userIdStr] = displayName;
            hasChanges = true;
          }
        }
      });
      
      return hasChanges ? newNames : prev;
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

  // Мемоизируем вычисления для производительности
  const playerHighlighted = useMemo(() => players[currentUserIdStr], [players, currentUserIdStr]);
  
  const nonHighlightedPlayers = useMemo(() => {
    return Object.keys(players).reduce((acc, playerId) => {
      if (playerId !== currentUserIdStr) {
        acc[playerId] = players[playerId];
      }
      return acc;
    }, {});
  }, [players, currentUserIdStr]);

  const participantCount = useMemo(() => {
    return participants.length || Object.keys(players).length || 1;
  }, [participants.length, players]);

  // Убрали экран ошибки - пользователь может войти в комнату даже без медиа

  // Экран загрузки
  if (!isInRoom || isJoining) {
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
        
        {/* Локальный плеер - показываем всегда, даже если нет стрима */}
        <div className={Object.keys(nonHighlightedPlayers).length > 0 ? styles.videoItem : styles.videoItemFull}>
          <Player
            stream={playerHighlighted?.stream || null}
            muted={true}  // Локальный всегда muted чтобы не слышать себя
            playing={playerHighlighted?.playing || false}
            isActive
            isLocal
            audioEnabled={audioEnabled}  // Реальное состояние микрофона
            playerId={currentUserIdStr}
            playerName={playerNames[currentUserIdStr] || currentUserName}
            handRaised={handRaised}
            isScreenSharing={isScreenSharing}
          />
        </div>
        
        {/* Удалённые плееры - показываем ВСЕХ участников, не только тех у кого есть stream */}
        {participants
          .filter(p => {
            // Исключаем текущего пользователя (он показывается отдельно)
            const participantId = p.user?.id;
            return participantId && participantId.toString() !== currentUserIdStr && participantId !== currentUserId;
          })
          .map((participant) => {
            const participantId = participant.user?.id;
            const participantIdStr = participantId?.toString();
            
            // Находим stream для этого участника (если есть)
            const player = nonHighlightedPlayers[participantIdStr] || 
                          (participantId && nonHighlightedPlayers[participantId]);
            
            // Получаем имя участника
            const participantName = participant?.user?.displayName || 
                                    participant?.user?.username || 
                                    (player && playerNames[participantIdStr]) || 
                                    `Участник ${participantIdStr?.substring(0, 6) || ''}`;
            
            // Определяем screen sharing: проверяем и participant.screenSharing, и наличие screen sharing треков
            const hasScreenShareTracks = player?.stream && 
              player.stream.getVideoTracks().some(track => 
                track.readyState === 'live' && 
                (track.label?.toLowerCase().includes('screen') || 
                 track.label?.toLowerCase().includes('display'))
              );
            const isParticipantScreenSharing = participant?.screenSharing === true || hasScreenShareTracks;
            
            return (
              <div key={participantIdStr || participant.id} className={styles.videoItem}>
                <Player
                  stream={player?.stream || null}
                  muted={false}  // Удалённых слышим
                  playing={player?.playing || false}
                  isActive={false}
                  isLocal={false}
                  audioEnabled={participant?.audioEnabled !== false}  // Состояние микрофона участника
                  playerId={participantIdStr}
                  playerName={participantName}
                  handRaised={participant?.handRaised === true}
                  isScreenSharing={isParticipantScreenSharing}
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

