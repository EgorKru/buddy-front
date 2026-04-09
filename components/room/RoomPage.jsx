/**
 * Контент страницы комнаты. Подгружается лениво через next/dynamic в pages/room/[roomId].js
 */
import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import { useRoomProtocol } from '@/hooks/useRoomProtocol';
import { getCurrentUser } from '@/utils/api';

import Player from '@/component/Player';
import Bottom from '@/component/Bottom';
import CopySection from '@/component/CopySection';
import ParticipantsModal from '@/component/ParticipantsModal';
import RoomToast from '@/component/RoomToast';
import RoomSettingsModal from '@/components/room/RoomSettingsModal';

import styles from '@/styles/room.module.css';

export default function RoomPage() {
  const router = useRouter();
  const { roomId, audio, video } = router.query;

  const [roomIdFromPath, setRoomIdFromPath] = useState(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const match = window.location.pathname.match(/\/room\/([^/?]+)/);
      if (match && match[1]) {
        setRoomIdFromPath(match[1]);
      }
    }
  }, []);

  const isRouterReady = router.isReady || !!roomIdFromPath;
  const actualRoomId = roomId || roomIdFromPath || undefined;

  const initialAudio = audio !== undefined ? audio !== '0' : true;
  const initialVideo = video !== undefined ? video !== '0' : false;

  const {
    participants,
    localStream,
    remoteStreams,
    audioEnabled,
    videoEnabled,
    isInRoom,
    error: _error,
    toggleAudio,
    toggleVideo,
    leaveRoom,
    endRoom,
    joinRoom,
    handRaised,
    raiseHand,
    isScreenSharing,
    screenStream,
    startScreenShare,
    stopScreenShare,
    myRole: _myRole,
    isHost,
    isCoHost,
    promoteParticipant,
    demoteParticipant,
    muteParticipant,
    kickParticipant,
    getDevices,
    switchCamera,
    switchMicrophone,
    devices,
    selectedCamera,
    selectedMicrophone,
  } = useRoomProtocol(actualRoomId);

  const [players, setPlayers] = useState({});
  const [playerNames, setPlayerNames] = useState({});
  const [isJoining, setIsJoining] = useState(false);
  const [meetingTime, setMeetingTime] = useState(0);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [toastNotifications, setToastNotifications] = useState([]);
  const hasJoinedRef = useRef(false);
  const prevParticipantsRef = useRef([]);

  const currentUser = getCurrentUser();
  const currentUserId = currentUser?.id || null;
  const currentUserIdStr = currentUserId?.toString() || 'local';
  const currentUserName = currentUser?.displayName || currentUser?.username || 'Вы';

  const addToast = useCallback((type, userName, odUserId) => {
    const id = `${type}-${odUserId}-${Date.now()}`;
    setToastNotifications((prev) => [...prev, { id, type, userName }]);
  }, []);

  const dismissToast = useCallback((id) => {
    setToastNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  useEffect(() => {
    if (!isInRoom) return;
    const prevIds = new Set(prevParticipantsRef.current.map((p) => p.user?.id));
    const currentIds = new Set(participants.map((p) => p.user?.id));
    participants.forEach((p) => {
      const userId = p.user?.id;
      if (userId && !prevIds.has(userId) && userId !== currentUserId) {
        const userName = p.user?.displayName || p.user?.username || `Участник ${userId}`;
        addToast('join', userName, userId);
      }
    });
    prevParticipantsRef.current.forEach((p) => {
      const userId = p.user?.id;
      if (userId && !currentIds.has(userId) && userId !== currentUserId) {
        const userName = p.user?.displayName || p.user?.username || `Участник ${userId}`;
        addToast('leave', userName, userId);
      }
    });
    prevParticipantsRef.current = [...participants];
  }, [participants, isInRoom, currentUserId, addToast]);

  useEffect(() => {
    if (!isInRoom) return;
    const interval = setInterval(() => setMeetingTime((prev) => prev + 1), 1000);
    return () => clearInterval(interval);
  }, [isInRoom]);

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (!isRouterReady) return;
    if (isInRoom) {
      if (isJoining) setIsJoining(false);
      return;
    }
    if (actualRoomId && !hasJoinedRef.current) {
      hasJoinedRef.current = true;
      setIsJoining(true);
      joinRoom(actualRoomId, true, initialAudio, initialVideo)
        .then(() => setIsJoining(false))
        .catch(() => {
          setIsJoining(false);
          hasJoinedRef.current = false;
        });
    }
  }, [isRouterReady, actualRoomId, isInRoom, joinRoom, initialAudio, initialVideo, isJoining]);

  useEffect(() => {
    if (isInRoom) {
      setIsJoining(false);
      hasJoinedRef.current = true;
      if (getDevices) getDevices();
    }
  }, [isInRoom, getDevices]);

  useEffect(() => {
    if (hasJoinedRef.current && !isInRoom && !isJoining && actualRoomId) {
      const timeout = setTimeout(() => {
        hasJoinedRef.current = false;
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [isInRoom, isJoining, actualRoomId]);

  useEffect(() => {
    setPlayers((prev) => ({
      ...prev,
      [currentUserIdStr]: {
        stream: localStream || null,
        muted: true,
        playing: localStream ? videoEnabled : false,
        isLocal: true,
      },
    }));
    setPlayerNames((prev) => ({ ...prev, [currentUserIdStr]: currentUserName }));
  }, [localStream, videoEnabled, currentUserIdStr, currentUserName]);

  useEffect(() => {
    setPlayers((prev) =>
      !prev[currentUserIdStr]
        ? prev
        : { ...prev, [currentUserIdStr]: { ...prev[currentUserIdStr], playing: videoEnabled } }
    );
  }, [videoEnabled, currentUserIdStr]);

  useEffect(() => {
    setPlayers((prev) => {
      const newPlayers = { ...prev };
      remoteStreams.forEach((stream, odUserId) => {
        const userIdStr = odUserId.toString();
        const hasVideoTracks = stream && stream.getVideoTracks().length > 0;
        const videoTracks = hasVideoTracks ? stream.getVideoTracks() : [];
        const hasActiveVideoTracks = videoTracks.some((t) => t.readyState === 'live' && t.enabled);
        const hasScreenShareTracks = videoTracks.some(
          (t) =>
            t.readyState === 'live' &&
            (t.label?.toLowerCase().includes('screen') ||
              t.label?.toLowerCase().includes('display'))
        );
        newPlayers[userIdStr] = {
          stream,
          muted: false,
          playing: hasActiveVideoTracks || hasScreenShareTracks,
          isLocal: false,
        };
      });
      Object.keys(newPlayers).forEach((id) => {
        if (id !== currentUserIdStr && !remoteStreams.has(parseInt(id)) && !remoteStreams.has(id)) {
          delete newPlayers[id];
        }
      });
      return newPlayers;
    });
    setPlayerNames((prev) => {
      const newNames = { ...prev };
      participants.forEach((participant) => {
        const participantId = participant.user?.id;
        if (!participantId) return;
        const userIdStr = participantId.toString();
        const user = participant.user;
        newNames[userIdStr] =
          user?.displayName || user?.username || `Участник ${userIdStr.substring(0, 6)}`;
      });
      return newNames;
    });
  }, [remoteStreams, participants, currentUserIdStr]);

  useEffect(() => {
    if (!participants || participants.length === 0) return;
    setPlayerNames((prev) => {
      const newNames = { ...prev };
      let hasChanges = false;
      participants.forEach((participant) => {
        const userIdStr = participant.user?.id?.toString();
        if (userIdStr) {
          const displayName =
            participant.user?.displayName ||
            participant.user?.username ||
            `Участник ${userIdStr.substring(0, 6)}`;
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
      if (participantCount <= 1) endRoom();
      else leaveRoom();
      router.push('/');
    } catch {
      router.push('/');
    }
  };

  const handleToggleAudio = async () => {
    try {
      await toggleAudio();
    } catch (_err) {}
  };

  const handleToggleVideo = async () => {
    try {
      await toggleVideo();
    } catch (_err) {}
  };

  const playerHighlighted = useMemo(() => players[currentUserIdStr], [players, currentUserIdStr]);
  const nonHighlightedPlayers = useMemo(() => {
    return Object.keys(players).reduce((acc, playerId) => {
      if (playerId !== currentUserIdStr) acc[playerId] = players[playerId];
      return acc;
    }, {});
  }, [players, currentUserIdStr]);
  const participantCount = useMemo(
    () => participants.length || Object.keys(players).length || 1,
    [participants.length, players]
  );

  const [showLoadingTimeout, setShowLoadingTimeout] = useState(false);
  const [forceShowInterface, setForceShowInterface] = useState(false);

  useEffect(() => {
    if (actualRoomId && hasJoinedRef.current && !isInRoom) {
      const timeout = setTimeout(() => {
        setForceShowInterface(true);
        setIsJoining(false);
      }, 8000);
      return () => clearTimeout(timeout);
    }
    setForceShowInterface(false);
  }, [actualRoomId, isInRoom]);

  useEffect(() => {
    if (isJoining && !isInRoom) {
      const timeout = setTimeout(() => {
        setShowLoadingTimeout(true);
        setIsJoining(false);
      }, 5000);
      return () => clearTimeout(timeout);
    }
    setShowLoadingTimeout(false);
  }, [isJoining, isInRoom]);

  const shouldShowLoading =
    isRouterReady &&
    !isInRoom &&
    !forceShowInterface &&
    ((isJoining && !showLoadingTimeout) || (!hasJoinedRef.current && actualRoomId));

  if (shouldShowLoading) {
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
      <RoomToast notifications={toastNotifications} onDismiss={dismissToast} />
      <div className={styles.topBar}>
        <div className={styles.logo}>Pager Meet</div>
        <div className={styles.meetingInfo}>
          <span className={styles.timer}>{formatTime(meetingTime)}</span>
          <span className={styles.roomCode}>{actualRoomId}</span>
        </div>
      </div>
      <div className={styles.videoGrid}>
        {isScreenSharing && screenStream && (
          <div className={styles.screenSharePreview}>
            <video
              autoPlay
              playsInline
              muted
              ref={(el) => {
                if (el) el.srcObject = screenStream;
              }}
              className={styles.screenShareVideo}
            />
            <div className={styles.screenShareLabel}>Ваша демонстрация</div>
          </div>
        )}
        <div
          className={
            Object.keys(nonHighlightedPlayers).length > 0 ? styles.videoItem : styles.videoItemFull
          }
        >
          <Player
            stream={playerHighlighted?.stream || null}
            muted={true}
            playing={playerHighlighted?.playing || false}
            isActive
            isLocal
            audioEnabled={audioEnabled}
            playerId={currentUserIdStr}
            playerName={playerNames[currentUserIdStr] || currentUserName}
            handRaised={handRaised}
            isScreenSharing={isScreenSharing}
          />
        </div>
        {participants
          .filter((p) => {
            const participantId = p.user?.id;
            return (
              participantId &&
              participantId.toString() !== currentUserIdStr &&
              participantId !== currentUserId
            );
          })
          .map((participant) => {
            const participantId = participant.user?.id;
            const participantIdStr = participantId?.toString();
            const player =
              nonHighlightedPlayers[participantIdStr] ||
              (participantId && nonHighlightedPlayers[participantId]);
            const participantName =
              participant?.user?.displayName ||
              participant?.user?.username ||
              (player && playerNames[participantIdStr]) ||
              `Участник ${participantIdStr?.substring(0, 6) || ''}`;
            const hasScreenShareTracks =
              player?.stream &&
              player.stream
                .getVideoTracks()
                .some(
                  (t) =>
                    t.readyState === 'live' &&
                    (t.label?.toLowerCase().includes('screen') ||
                      t.label?.toLowerCase().includes('display'))
                );
            const isParticipantScreenSharing =
              participant?.screenSharing === true || hasScreenShareTracks;
            return (
              <div key={participantIdStr || participant.id} className={styles.videoItem}>
                <Player
                  stream={player?.stream || null}
                  muted={false}
                  playing={player?.playing || false}
                  isActive={false}
                  isLocal={false}
                  audioEnabled={participant?.audioEnabled !== false}
                  playerId={participantIdStr}
                  playerName={participantName}
                  handRaised={participant?.handRaised === true}
                  isScreenSharing={isParticipantScreenSharing}
                />
              </div>
            );
          })}
        {participantCount <= 1 && <CopySection roomId={actualRoomId} />}
      </div>
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
        onSettingsClick={() => setShowSettings(true)}
      />
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
      <RoomSettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        devices={devices}
        selectedCamera={selectedCamera}
        selectedMicrophone={selectedMicrophone}
        onSwitchCamera={switchCamera}
        onSwitchMicrophone={switchMicrophone}
        onRefreshDevices={getDevices}
      />
    </div>
  );
}
