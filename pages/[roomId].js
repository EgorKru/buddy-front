import { useEffect, useState } from "react";

import { useSocket } from "@/context/socket";
import usePeer from "@/hooks/usePeer";
import useMediaStream from "@/hooks/useMediaStream";
import usePlayer from "@/hooks/usePlayer";

import Player from "@/component/Player";
import Bottom from "@/component/Bottom";
import CopySection from "@/component/CopySection";
import ChatPanel from "@/component/ChatPanel";
import TopBar from "@/component/TopBar";
import SingleParticipantInfo from "@/component/SingleParticipantInfo";

import styles from "@/styles/room.module.css";
import { useRouter } from "next/router";
import { MessageCircle } from "lucide-react";
import { getCurrentUser } from "@/utils/api";

const Room = () => {
  const socket = useSocket();
  const { roomId } = useRouter().query;
  const { peer, myId } = usePeer();
  const { stream, error: streamError } = useMediaStream();
  const {
    players,
    setPlayers,
    playerHighlighted,
    nonHighlightedPlayers,
    toggleAudio,
    toggleVideo,
    leaveRoom
  } = usePlayer(myId, roomId, peer);

  const [users, setUsers] = useState({})
  const [chatOpen, setChatOpen] = useState(false)
  const [meetingStarted, setMeetingStarted] = useState(false)
  const [playerNames, setPlayerNames] = useState({})
  
  const currentUser = getCurrentUser();
  const currentUserName = currentUser?.displayName || currentUser?.username || "Вы";

  useEffect(() => {
    if (!socket || !peer || !stream) return;
    const handleUserConnected = (newUser) => {
      console.log(`user connected in room with userId ${newUser}`);

      const call = peer.call(newUser, stream);

      call.on("stream", (incomingStream) => {
        console.log(`incoming stream from ${newUser}`);
        setPlayers((prev) => ({
          ...prev,
          [newUser]: {
            url: incomingStream,
            muted: true,
            playing: true,
          },
        }));

        setPlayerNames((prev) => ({
          ...prev,
          [newUser]: `Участник ${newUser.substring(0, 6)}`,
        }));

        setUsers((prev) => ({
          ...prev,
          [newUser]: call
        }))
      });

      call.on("error", (err) => {
        console.error("Call error:", err);
      });
    };
    socket.on("user-connected", handleUserConnected);

    return () => {
      socket.off("user-connected", handleUserConnected);
    };
  }, [peer, setPlayers, socket, stream]);

  useEffect(() => {
    if (!socket) return;
    const handleToggleAudio = (userId) => {
      console.log(`user with id ${userId} toggled audio`);
      setPlayers((prev) => {
        if (!prev[userId]) return prev;
        return {
          ...prev,
          [userId]: {
            ...prev[userId],
            muted: !prev[userId].muted
          }
        };
      });
    };

    const handleToggleVideo = (userId) => {
      console.log(`user with id ${userId} toggled video`);
      setPlayers((prev) => {
        if (!prev[userId]) return prev;
        return {
          ...prev,
          [userId]: {
            ...prev[userId],
            playing: !prev[userId].playing
          }
        };
      });
    };

    const handleUserLeave = (userId) => {
      console.log(`user ${userId} is leaving the room`);
      setUsers((prev) => {
        if (prev[userId]) {
          prev[userId].close();
          const newUsers = { ...prev };
          delete newUsers[userId];
          return newUsers;
        }
        return prev;
      });
      setPlayers((prev) => {
        const newPlayers = { ...prev };
        delete newPlayers[userId];
        return newPlayers;
      });
    }
    socket.on("user-toggle-audio", handleToggleAudio);
    socket.on("user-toggle-video", handleToggleVideo);
    socket.on("user-leave", handleUserLeave);
    return () => {
      socket.off("user-toggle-audio", handleToggleAudio);
      socket.off("user-toggle-video", handleToggleVideo);
      socket.off("user-leave", handleUserLeave);
    };
  }, [players, setPlayers, socket, users]);

  useEffect(() => {
    if (!peer || !stream) return;
    
    const handleCall = (call) => {
      const { peer: callerId } = call;
      call.answer(stream);

      call.on("stream", (incomingStream) => {
        console.log(`incoming stream from ${callerId}`);
        setPlayers((prev) => ({
          ...prev,
          [callerId]: {
            url: incomingStream,
            muted: true,
            playing: true,
          },
        }));

        setPlayerNames((prev) => ({
          ...prev,
          [callerId]: `Участник ${callerId.substring(0, 6)}`,
        }));

        setUsers((prev) => ({
          ...prev,
          [callerId]: call
        }))
      });

      call.on("error", (err) => {
        console.error("Call error:", err);
      });
    };

    peer.on("call", handleCall);

    return () => {
      peer.off("call", handleCall);
    };
  }, [peer, setPlayers, stream]);

  useEffect(() => {
    if (!stream || !myId) return;
    console.log(`setting my stream ${myId}`);
    setPlayers((prev) => ({
      ...prev,
      [myId]: {
        url: stream,
        muted: true,
        playing: true,
      },
    }));
    setPlayerNames((prev) => ({
      ...prev,
      [myId]: currentUserName,
    }));
  }, [myId, setPlayers, stream, currentUserName]);

  // Очистка ресурсов при размонтировании
  useEffect(() => {
    return () => {
      // Закрываем все активные звонки
      Object.values(users).forEach(call => {
        call.close();
      });
      // Останавливаем медиа-поток
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [users, stream]);

  const participantCount = Object.keys(players).length;
  const isSingleParticipant = participantCount <= 1;

  if (streamError && !stream) {
    return (
      <div className={styles.roomContainer}>
        <TopBar roomId={roomId} />
        <div className={styles.singleParticipantContainer}>
          <div style={{ textAlign: 'center', padding: '40px', color: 'rgb(255, 100, 100)' }}>
            <h2 style={{ marginBottom: '16px', fontSize: '24px' }}>Ошибка доступа к камере/микрофону</h2>
            <p style={{ marginBottom: '8px', color: 'rgb(180, 180, 190)' }}>{streamError}</p>
            <p style={{ color: 'rgb(150, 150, 160)' }}>Пожалуйста, разрешите доступ к камере и микрофону в настройках браузера</p>
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
                  playerId={myId}
                  playerName={playerNames[myId]}
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
                playerId={myId}
                playerName={playerNames[myId]}
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
              const { url, muted, playing } = nonHighlightedPlayers[playerId];
              return (
                <Player
                  key={playerId}
                  url={url}
                  muted={muted}
                  playing={playing}
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
        muted={playerHighlighted?.muted}
        playing={playerHighlighted?.playing}
        toggleAudio={toggleAudio}
        toggleVideo={toggleVideo}
        leaveRoom={leaveRoom}
        participantCount={participantCount}
        onChatToggle={() => setChatOpen(!chatOpen)}
      />
    </div>
  );
};

export default Room;
