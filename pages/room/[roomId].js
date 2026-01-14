import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";
import { useRoomProtocol } from "@/hooks/useRoomProtocol";
import { getCurrentUser } from "@/utils/api";

import Player from "@/component/Player";
import Bottom from "@/component/Bottom";
import CopySection from "@/component/CopySection";

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
  } = useRoomProtocol(roomId);

  const [players, setPlayers] = useState({});
  const [playerNames, setPlayerNames] = useState({});
  const [isJoining, setIsJoining] = useState(false);
  const [meetingTime, setMeetingTime] = useState(0);
  const hasJoinedRef = useRef(false);
  
  const currentUser = getCurrentUser();
  const currentUserId = currentUser?.id?.toString() || 'local';
  const currentUserName = currentUser?.displayName || currentUser?.username || "Вы";

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

  // Обновляем локальный плеер
  useEffect(() => {
    if (localStream) {
      setPlayers(prev => ({
        ...prev,
        [currentUserId]: {
          stream: localStream,
          muted: true, // Локальный всегда muted чтобы не слышать себя
          playing: videoEnabled,
        },
      }));
      setPlayerNames(prev => ({
        ...prev,
        [currentUserId]: currentUserName,
      }));
    }
  }, [localStream, videoEnabled, currentUserId, currentUserName]);

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
        };
      });
      
      // Удаляем плееры для отключившихся участников
      Object.keys(newPlayers).forEach(id => {
        if (id !== currentUserId && !remoteStreams.has(parseInt(id)) && !remoteStreams.has(id)) {
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
  }, [remoteStreams, participants, currentUserId]);

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
    setPlayers(prev => {
      if (!prev[currentUserId]) return prev;
      return {
        ...prev,
        [currentUserId]: {
          ...prev[currentUserId],
          muted: !prev[currentUserId].muted,
        },
      };
    });
  };

  const handleToggleVideo = async () => {
    await toggleVideo();
    setPlayers(prev => {
      if (!prev[currentUserId]) return prev;
      return {
        ...prev,
        [currentUserId]: {
          ...prev[currentUserId],
          playing: !prev[currentUserId].playing,
        },
      };
    });
  };

  const playerHighlighted = players[currentUserId];
  const nonHighlightedPlayers = Object.keys(players).reduce((acc, playerId) => {
    if (playerId !== currentUserId) {
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
        {/* Локальный плеер */}
        {playerHighlighted && (
          <div className={Object.keys(nonHighlightedPlayers).length > 0 ? styles.videoItem : styles.videoItemFull}>
            <Player
              stream={playerHighlighted.stream}
              muted={playerHighlighted.muted}
              playing={playerHighlighted.playing}
              isActive
              playerId={currentUserId}
              playerName={playerNames[currentUserId]}
            />
          </div>
        )}
        
        {/* Удалённые плееры */}
        {Object.keys(nonHighlightedPlayers).map((playerId) => {
          const player = nonHighlightedPlayers[playerId];
          return (
            <div key={playerId} className={styles.videoItem}>
              <Player
                stream={player.stream}
                muted={player.muted}
                playing={player.playing}
                isActive={false}
                playerId={playerId}
                playerName={playerNames[playerId]}
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
      />
    </div>
  );
};

export default Room;

