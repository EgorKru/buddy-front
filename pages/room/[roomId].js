import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useRoomProtocol } from "@/hooks/useRoomProtocol";
import { getCurrentUser } from "@/utils/api";

import Player from "@/component/Player";
import Bottom from "@/component/Bottom";
import CopySection from "@/component/CopySection";
import ChatPanel from "@/component/ChatPanel";
import TopBar from "@/component/TopBar";
import SingleParticipantInfo from "@/component/SingleParticipantInfo";

import styles from "@/styles/room.module.css";

const Room = () => {
  const router = useRouter();
  const { roomId, audio, video } = router.query;
  
  const initialAudio = audio !== '0';
  const initialVideo = video !== '0';
  
  const {
    room,
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
    startLocalStream,
    joinRoom,
    clearError,
  } = useRoomProtocol(roomId);

  const [players, setPlayers] = useState({});
  const [playerNames, setPlayerNames] = useState({});
  const [chatOpen, setChatOpen] = useState(false);
  const [meetingStarted, setMeetingStarted] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  
  const currentUser = getCurrentUser();
  const currentUserId = currentUser?.id?.toString() || 'local';
  const currentUserName = currentUser?.displayName || currentUser?.username || "Вы";

  useEffect(() => {
    if (roomId && !isInRoom && !error && !isJoining) {
      setIsJoining(true);
      joinRoom(roomId, true, initialAudio, initialVideo)
        .then(() => {
          setIsJoining(false);
        })
        .catch(() => {
          setIsJoining(false);
        });
    }
  }, [roomId, isInRoom, error, isJoining, joinRoom, initialAudio, initialVideo]);

  const handleRetry = async () => {
    clearError();
    setIsJoining(false);
    if (roomId) {
      try {
        await joinRoom(roomId, true);
      } catch (err) {
        setIsJoining(false);
      }
    }
  };

  const handleJoinWithoutMedia = async () => {
    clearError();
    setIsJoining(false);
    if (roomId) {
      try {
        await joinRoom(roomId, false);
        setIsJoining(false);
      } catch (err) {
        setIsJoining(false);
      }
    }
  };

  useEffect(() => {
    if (localStream) {
      const streamUrl = URL.createObjectURL(localStream);
      setPlayers(prev => ({
        ...prev,
        [currentUserId]: {
          url: streamUrl,
          muted: !audioEnabled,
          playing: videoEnabled,
        },
      }));
      setPlayerNames(prev => ({
        ...prev,
        [currentUserId]: currentUserName,
      }));

      return () => {
        URL.revokeObjectURL(streamUrl);
      };
    }
  }, [localStream, audioEnabled, videoEnabled, currentUserId, currentUserName]);

  useEffect(() => {
    const newStreams = { ...players };
    const newNames = { ...playerNames };

    remoteStreams.forEach((stream, userId) => {
      const streamUrl = URL.createObjectURL(stream);
      const userIdStr = userId.toString();
      newStreams[userIdStr] = {
        url: streamUrl,
        muted: true,
        playing: true,
      };
      
      const participant = participants.find(p => p.userId === userId);
      newNames[userIdStr] = participant?.displayName || participant?.username || `Участник ${userIdStr.substring(0, 6)}`;
    });

    setPlayers(newStreams);
    setPlayerNames(newNames);

    return () => {
      Object.values(newStreams).forEach(player => {
        if (player.url && player.url.startsWith('blob:')) {
          URL.revokeObjectURL(player.url);
        }
      });
    };
  }, [remoteStreams, participants]);

  useEffect(() => {
    participants.forEach(participant => {
      const userIdStr = participant.userId?.toString();
      if (userIdStr && !playerNames[userIdStr]) {
        setPlayerNames(prev => ({
          ...prev,
          [userIdStr]: participant.displayName || participant.username || `Участник ${userIdStr.substring(0, 6)}`,
        }));
      }
    });
  }, [participants]);

  const handleLeaveRoom = async () => {
    try {
      const participantCount = participants.length || Object.keys(players).length || 0;
      if (participantCount <= 1) {
        await endRoom();
      } else {
        await leaveRoom();
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
  const isSingleParticipant = participantCount <= 1;

  if (error && !localStream && !isInRoom) {
    return (
      <div className={styles.roomContainer}>
        <TopBar roomId={roomId} />
        <div className={styles.singleParticipantContainer}>
          <div style={{ textAlign: 'center', padding: '40px', color: 'rgb(255, 100, 100)' }}>
            <h2 style={{ marginBottom: '16px', fontSize: '24px' }}>Ошибка подключения к комнате</h2>
            <p style={{ marginBottom: '8px', color: 'rgb(180, 180, 190)' }}>{error}</p>
            <p style={{ color: 'rgb(150, 150, 160)' }}>Проверьте ID комнаты и попробуйте снова</p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '20px' }}>
              <button 
                onClick={handleRetry}
                style={{
                  padding: '10px 20px',
                  background: 'rgb(102, 126, 234)',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => e.target.style.background = 'rgb(90, 110, 220)'}
                onMouseLeave={(e) => e.target.style.background = 'rgb(102, 126, 234)'}
              >
                Попробовать снова
              </button>
              <button 
                onClick={handleJoinWithoutMedia}
                style={{
                  padding: '10px 20px',
                  background: 'rgb(50, 50, 60)',
                  border: '1px solid rgb(70, 70, 80)',
                  borderRadius: '8px',
                  color: 'white',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgb(60, 60, 70)';
                  e.target.style.borderColor = 'rgb(80, 80, 90)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'rgb(50, 50, 60)';
                  e.target.style.borderColor = 'rgb(70, 70, 80)';
                }}
              >
                Присоединиться без камеры
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if ((!isInRoom && !error) || isJoining) {
    return (
      <div className={styles.roomContainer}>
        <TopBar roomId={roomId} />
        <div className={styles.singleParticipantContainer}>
          <div style={{ textAlign: 'center', padding: '40px', color: 'rgb(180, 180, 190)' }}>
            <div style={{ 
              width: '48px', 
              height: '48px', 
              border: '4px solid rgb(102, 126, 234)',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 20px'
            }}></div>
            <p>Подключение к комнате...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.roomContainer}>
      <TopBar roomId={roomId} onStart={() => setMeetingStarted(true)} />
      
      {isSingleParticipant && !meetingStarted ? (
        <div className={styles.singleParticipantContainer}>
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            {playerHighlighted && (
              <div style={{ flex: 1, marginBottom: '24px' }}>
                <Player
                  url={playerHighlighted.url}
                  muted={playerHighlighted.muted}
                  playing={playerHighlighted.playing}
                  isActive
                  playerId={currentUserId}
                  playerName={playerNames[currentUserId]}
                />
              </div>
            )}
            <SingleParticipantInfo 
              roomId={roomId}
              onSettingsClick={() => {}}
            />
          </div>
        </div>
      ) : (
        <>
          <div className={styles.activePlayerContainer}>
            {playerHighlighted && (
              <Player
                url={playerHighlighted.url}
                muted={playerHighlighted.muted}
                playing={playerHighlighted.playing}
                isActive
                playerId={currentUserId}
                playerName={playerNames[currentUserId]}
              />
            )}
            {!playerHighlighted && isSingleParticipant && (
              <SingleParticipantInfo 
                roomId={roomId}
                onSettingsClick={() => {}}
              />
            )}
          </div>
          <div className={styles.inActivePlayerContainer}>
            {Object.keys(nonHighlightedPlayers).map((playerId) => {
              const player = nonHighlightedPlayers[playerId];
              return (
                <Player
                  key={playerId}
                  url={player.url}
                  muted={player.muted}
                  playing={player.playing}
                  isActive={false}
                  playerId={playerId}
                  playerName={playerNames[playerId]}
                />
              );
            })}
          </div>
        </>
      )}
      
      <CopySection roomId={roomId}/>
      
      <ChatPanel 
        roomId={roomId} 
        isOpen={chatOpen} 
        onClose={() => setChatOpen(false)} 
      />
      
      <Bottom
        muted={!audioEnabled}
        playing={videoEnabled}
        toggleAudio={handleToggleAudio}
        toggleVideo={handleToggleVideo}
        leaveRoom={handleLeaveRoom}
        participantCount={participantCount}
        onChatToggle={() => setChatOpen(!chatOpen)}
      />
    </div>
  );
};

export default Room;

