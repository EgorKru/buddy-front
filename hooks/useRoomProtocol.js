import { useState, useRef, useCallback, useEffect } from 'react';
import { useStomp } from '@/context/socket';
import { safeJsonParse, safeUnsubscribe } from '@/utils/safe';
import { roomAPI } from '@/utils/api';

const ROOM_SIGNAL_TYPES = {
  ROOM_OFFER: 'ROOM_OFFER',
  ROOM_ANSWER: 'ROOM_ANSWER',
  ROOM_ICE_CANDIDATE: 'ROOM_ICE_CANDIDATE',
  ROOM_MUTE_AUDIO: 'ROOM_MUTE_AUDIO',
  ROOM_UNMUTE_AUDIO: 'ROOM_UNMUTE_AUDIO',
  ROOM_MUTE_VIDEO: 'ROOM_MUTE_VIDEO',
  ROOM_UNMUTE_VIDEO: 'ROOM_UNMUTE_VIDEO',
};

const ROOM_EVENT_TYPES = {
  ROOM_STARTED: 'ROOM_STARTED',
  ROOM_JOINED: 'ROOM_JOINED',
  ROOM_LEFT: 'ROOM_LEFT',
  ROOM_ENDED: 'ROOM_ENDED',
  ROOM_PARTICIPANT_UPDATED: 'ROOM_PARTICIPANT_UPDATED',
  ROOM_HAND_RAISED: 'ROOM_HAND_RAISED',
  ROOM_SCREEN_SHARE_STARTED: 'ROOM_SCREEN_SHARE_STARTED',
  ROOM_SCREEN_SHARE_STOPPED: 'ROOM_SCREEN_SHARE_STOPPED',
  ROOM_PARTICIPANT_MUTED: 'ROOM_PARTICIPANT_MUTED',
  ROOM_PARTICIPANT_KICKED: 'ROOM_PARTICIPANT_KICKED',
  ROOM_PARTICIPANT_PROMOTED: 'ROOM_PARTICIPANT_PROMOTED',
};

// Статусы комнаты
export const ROOM_STATUS = {
  WAITING: 'WAITING',
  ACTIVE: 'ACTIVE',
  ENDED: 'ENDED',
};

// Роли участников
export const PARTICIPANT_ROLE = {
  HOST: 'HOST',
  CO_HOST: 'CO_HOST',
  PARTICIPANT: 'PARTICIPANT',
};

const STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
];

export const useRoomProtocol = (roomId = null) => {
  const isBrowser = typeof window !== 'undefined';
  
  const { client, connected } = useStomp();
  const [room, setRoom] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState(new Map());
  const [screenStream, setScreenStream] = useState(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [isInRoom, setIsInRoom] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [myRole, setMyRole] = useState(PARTICIPANT_ROLE.PARTICIPANT);
  const [error, setError] = useState(null);
  
  const peerConnectionsRef = useRef(new Map());
  const roomEventSubscriptionRef = useRef(null);
  const roomSignalSubscriptionRef = useRef(null);
  const userSignalSubscriptionRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const roomIdRef = useRef(roomId);

  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);

  const cleanup = useCallback(() => {
    peerConnectionsRef.current.forEach((pc) => {
      pc.close();
    });
    peerConnectionsRef.current.clear();
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }
    
    setLocalStream(null);
    setScreenStream(null);
    setRemoteStreams(new Map());
    setIsInRoom(false);
    setIsScreenSharing(false);
    setHandRaised(false);
    setMyRole(PARTICIPANT_ROLE.PARTICIPANT);
    setRoom(null);
    setParticipants([]);
    setError(null);
    
    safeUnsubscribe(roomEventSubscriptionRef);
    safeUnsubscribe(roomSignalSubscriptionRef);
    safeUnsubscribe(userSignalSubscriptionRef);
  }, []);

  const createPeerConnection = useCallback((userId) => {
    if (!isBrowser || !window.RTCPeerConnection) {
      return null;
    }

    const pc = new RTCPeerConnection({
      iceServers: STUN_SERVERS,
    });

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && client && connected && roomIdRef.current) {
        const currentUser = JSON.parse(localStorage.getItem('user'));
        client.publish({
          destination: '/app/room.signal',
          body: JSON.stringify({
            type: ROOM_SIGNAL_TYPES.ROOM_ICE_CANDIDATE,
            roomId: roomIdRef.current,
            targetUserId: userId,
            iceCandidate: event.candidate.candidate,
            iceCandidateSdpMid: event.candidate.sdpMid,
            iceCandidateSdpMLineIndex: event.candidate.sdpMLineIndex,
          }),
        });
      }
    };

    pc.ontrack = (event) => {
      const stream = event.streams[0];
      if (stream) {
        setRemoteStreams(prev => {
          const newMap = new Map(prev);
          newMap.set(userId, stream);
          return newMap;
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        pc.close();
        peerConnectionsRef.current.delete(userId);
        setRemoteStreams(prev => {
          const newMap = new Map(prev);
          newMap.delete(userId);
          return newMap;
        });
      }
    };

    return pc;
  }, [client, connected]);

  const handleRoomSignal = useCallback((message) => {
    const signal = safeJsonParse(message.body);
    if (!signal || !roomIdRef.current || signal.roomId !== roomIdRef.current) return;

    const currentUser = JSON.parse(localStorage.getItem('user'));
    const userId = signal.targetUserId || signal.userId;
    
    if (userId === currentUser?.id) return;

    switch (signal.type) {
      case ROOM_SIGNAL_TYPES.ROOM_OFFER:
        handleOffer(signal, userId);
        break;
      case ROOM_SIGNAL_TYPES.ROOM_ANSWER:
        handleAnswer(signal, userId);
        break;
      case ROOM_SIGNAL_TYPES.ROOM_ICE_CANDIDATE:
        handleIceCandidate(signal, userId);
        break;
      default:
        break;
    }
  }, []);

  const handleOffer = useCallback(async (signal, userId) => {
    const pc = createPeerConnection(userId);
    if (!pc) return;

    try {
      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: signal.sdp }));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      if (client && connected && roomIdRef.current) {
        client.publish({
          destination: '/app/room.signal',
          body: JSON.stringify({
            type: ROOM_SIGNAL_TYPES.ROOM_ANSWER,
            roomId: roomIdRef.current,
            targetUserId: userId,
            sdp: answer.sdp,
          }),
        });
      }

      peerConnectionsRef.current.set(userId, pc);
    } catch (error) {
      pc.close();
      peerConnectionsRef.current.delete(userId);
    }
  }, [client, connected, createPeerConnection]);

  const handleAnswer = useCallback(async (signal, userId) => {
    const pc = peerConnectionsRef.current.get(userId);
    if (!pc) return;

    try {
      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: signal.sdp }));
    } catch (error) {
      pc.close();
      peerConnectionsRef.current.delete(userId);
    }
  }, []);

  const handleIceCandidate = useCallback(async (signal, userId) => {
    const pc = peerConnectionsRef.current.get(userId);
    if (!pc) return;

    try {
      await pc.addIceCandidate(new RTCIceCandidate({
        candidate: signal.iceCandidate,
        sdpMid: signal.iceCandidateSdpMid,
        sdpMLineIndex: signal.iceCandidateSdpMLineIndex,
      }));
    } catch (error) {
    }
  }, []);

  const sendOffer = useCallback(async (userId) => {
    const pc = createPeerConnection(userId);
    if (!pc) return;

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      if (client && connected && roomIdRef.current) {
        client.publish({
          destination: '/app/room.signal',
          body: JSON.stringify({
            type: ROOM_SIGNAL_TYPES.ROOM_OFFER,
            roomId: roomIdRef.current,
            targetUserId: userId,
            sdp: offer.sdp,
          }),
        });
      }

      peerConnectionsRef.current.set(userId, pc);
    } catch (error) {
      pc.close();
      peerConnectionsRef.current.delete(userId);
    }
  }, [client, connected, createPeerConnection]);

  const handleRoomEvent = useCallback((message) => {
    const event = safeJsonParse(message.body);
    if (!event) return;
    
    // Проверяем roomId в разных местах события
    const eventRoomId = event.room?.roomId || event.roomId;
    if (!roomIdRef.current || (eventRoomId && eventRoomId !== roomIdRef.current)) return;

    const currentUser = JSON.parse(localStorage.getItem('user'));

    switch (event.eventType) {
      case ROOM_EVENT_TYPES.ROOM_STARTED:
        setRoom(event.room);
        setParticipants(event.room.participants || []);
        break;
        
      case ROOM_EVENT_TYPES.ROOM_JOINED:
        setParticipants(prev => {
          const newParticipants = [...prev];
          if (event.participant && !newParticipants.find(p => p.id === event.participant.id)) {
            newParticipants.push(event.participant);
            if (event.participant.userId !== currentUser?.id && isInRoom) {
              setTimeout(() => sendOffer(event.participant.userId), 100);
            }
          }
          return newParticipants;
        });
        // Обновляем статус комнаты если он изменился
        if (event.room) {
          setRoom(event.room);
        }
        break;
        
      case ROOM_EVENT_TYPES.ROOM_LEFT:
        setParticipants(prev => prev.filter(p => p.userId !== event.userId && p.id !== event.userId));
        const pc = peerConnectionsRef.current.get(event.userId);
        if (pc) {
          pc.close();
          peerConnectionsRef.current.delete(event.userId);
        }
        setRemoteStreams(prev => {
          const newMap = new Map(prev);
          newMap.delete(event.userId);
          return newMap;
        });
        break;
        
      case ROOM_EVENT_TYPES.ROOM_ENDED:
        cleanup();
        break;
        
      case ROOM_EVENT_TYPES.ROOM_PARTICIPANT_UPDATED:
        setParticipants(prev => prev.map(p => 
          p.id === event.participant.id ? event.participant : p
        ));
        // Обновляем свою роль если это мы
        if (event.participant.userId === currentUser?.id) {
          setMyRole(event.participant.role || PARTICIPANT_ROLE.PARTICIPANT);
          setHandRaised(event.participant.handRaised || false);
          setIsScreenSharing(event.participant.screenSharing || false);
        }
        break;
        
      case ROOM_EVENT_TYPES.ROOM_HAND_RAISED:
        setParticipants(prev => prev.map(p => 
          p.userId === event.userId ? { ...p, handRaised: event.raised } : p
        ));
        if (event.userId === currentUser?.id) {
          setHandRaised(event.raised);
        }
        break;
        
      case ROOM_EVENT_TYPES.ROOM_SCREEN_SHARE_STARTED:
        setParticipants(prev => prev.map(p => 
          p.userId === event.userId ? { ...p, screenSharing: true } : p
        ));
        if (event.userId === currentUser?.id) {
          setIsScreenSharing(true);
        }
        break;
        
      case ROOM_EVENT_TYPES.ROOM_SCREEN_SHARE_STOPPED:
        setParticipants(prev => prev.map(p => 
          p.userId === event.userId ? { ...p, screenSharing: false } : p
        ));
        if (event.userId === currentUser?.id) {
          setIsScreenSharing(false);
        }
        break;
        
      case ROOM_EVENT_TYPES.ROOM_PARTICIPANT_MUTED:
        // Если замутили нас — выключаем аудио
        if (event.userId === currentUser?.id && localStreamRef.current) {
          localStreamRef.current.getAudioTracks().forEach(track => {
            track.enabled = false;
          });
          setAudioEnabled(false);
        }
        setParticipants(prev => prev.map(p => 
          p.userId === event.userId ? { ...p, audioEnabled: false } : p
        ));
        break;
        
      case ROOM_EVENT_TYPES.ROOM_PARTICIPANT_KICKED:
        // Если кикнули нас — выходим
        if (event.userId === currentUser?.id) {
          cleanup();
          setError('Вас удалили из комнаты');
        } else {
          setParticipants(prev => prev.filter(p => p.userId !== event.userId));
          const kickedPc = peerConnectionsRef.current.get(event.userId);
          if (kickedPc) {
            kickedPc.close();
            peerConnectionsRef.current.delete(event.userId);
          }
          setRemoteStreams(prev => {
            const newMap = new Map(prev);
            newMap.delete(event.userId);
            return newMap;
          });
        }
        break;
        
      case ROOM_EVENT_TYPES.ROOM_PARTICIPANT_PROMOTED:
        setParticipants(prev => prev.map(p => 
          p.userId === event.userId ? { ...p, role: PARTICIPANT_ROLE.CO_HOST } : p
        ));
        if (event.userId === currentUser?.id) {
          setMyRole(PARTICIPANT_ROLE.CO_HOST);
        }
        break;
        
      default:
        break;
    }
  }, [cleanup, isInRoom, sendOffer]);

  const subscribeToRoomEvents = useCallback(() => {
    if (!client || !connected || !roomIdRef.current) return;

    const eventTopic = `/topic/room/${roomIdRef.current}`;
    const signalTopic = `/topic/room/${roomIdRef.current}/signal`;

    roomEventSubscriptionRef.current = client.subscribe(eventTopic, handleRoomEvent);
    roomSignalSubscriptionRef.current = client.subscribe(signalTopic, handleRoomSignal);
    userSignalSubscriptionRef.current = client.subscribe('/user/queue/room-signal', handleRoomSignal);
  }, [client, connected, handleRoomEvent, handleRoomSignal]);

  const startLocalStream = useCallback(async (audio = true, video = true) => {
    if (!isBrowser || !navigator.mediaDevices) {
      throw new Error('Медиа устройства недоступны. Убедитесь, что вы используете HTTPS или localhost.');
    }

    const timeout = 30000;
    let timeoutId;

    try {
      const constraints = {
        audio: audio ? {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } : false,
        video: video ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        } : false,
      };

      const getUserMediaPromise = navigator.mediaDevices.getUserMedia(constraints);

      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error('Timeout starting video source'));
        }, timeout);
      });

      const stream = await Promise.race([getUserMediaPromise, timeoutPromise]);
      
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      localStreamRef.current = stream;
      setLocalStream(stream);
      setAudioEnabled(audio);
      setVideoEnabled(video);

      peerConnectionsRef.current.forEach((pc) => {
        stream.getTracks().forEach(track => {
          pc.addTrack(track, stream);
        });
      });

      return stream;
    } catch (error) {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      let errorMessage = 'Ошибка доступа к камере/микрофону';
      
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        errorMessage = 'Доступ к камере/микрофону запрещен. Пожалуйста, разрешите доступ в настройках браузера.';
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        errorMessage = 'Камера или микрофон не найдены. Убедитесь, что устройства подключены.';
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        errorMessage = 'Не удалось получить доступ к камере/микрофону. Возможно, устройство используется другим приложением.';
      } else if (error.message === 'Timeout starting video source') {
        errorMessage = 'Таймаут при запуске камеры. Пожалуйста, проверьте настройки браузера и разрешите доступ к камере и микрофону.';
      } else if (error.message) {
        errorMessage = `Ошибка доступа к медиа устройствам: ${error.message}`;
      }

      const errorObj = new Error(errorMessage);
      setError(errorMessage);
      throw errorObj;
    }
  }, []);

  const stopLocalStream = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }
  }, []);

  const toggleAudio = useCallback(async () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      const newAudioEnabled = !audioEnabled;
      setAudioEnabled(newAudioEnabled);
      
      if (roomIdRef.current) {
        await roomAPI.updateMediaState(roomIdRef.current, newAudioEnabled, videoEnabled);
      }
    }
  }, [audioEnabled, videoEnabled]);

  const toggleVideo = useCallback(async () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      const newVideoEnabled = !videoEnabled;
      setVideoEnabled(newVideoEnabled);
      
      if (roomIdRef.current) {
        await roomAPI.updateMediaState(roomIdRef.current, audioEnabled, newVideoEnabled);
      }
    }
  }, [audioEnabled, videoEnabled]);

  const createRoom = useCallback(async (title, chatId, type = 'PUBLIC', options = {}) => {
    try {
      setError(null);
      const newRoom = await roomAPI.createRoom(title, chatId, type, options);
      setRoom(newRoom);
      roomIdRef.current = newRoom.roomId;
      
      // Создатель комнаты — HOST
      setMyRole(PARTICIPANT_ROLE.HOST);
      
      subscribeToRoomEvents();
      return newRoom;
    } catch (error) {
      const errorMessage = error.message || 'Ошибка при создании комнаты';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [subscribeToRoomEvents]);

  const joinRoom = useCallback(async (roomIdToJoin, requestMedia = true, initialAudio = true, initialVideo = true) => {
    try {
      setError(null);
      const roomData = await roomAPI.joinRoom(roomIdToJoin);
      roomIdRef.current = roomIdToJoin;
      setRoom(roomData);
      setParticipants(roomData.participants || []);
      setIsInRoom(true);
      subscribeToRoomEvents();
      
      // Определяем свою роль из ответа
      const currentUser = JSON.parse(localStorage.getItem('user'));
      const myParticipant = roomData.participants?.find(p => p.userId === currentUser?.id);
      if (myParticipant) {
        setMyRole(myParticipant.role || PARTICIPANT_ROLE.PARTICIPANT);
        setHandRaised(myParticipant.handRaised || false);
        setIsScreenSharing(myParticipant.screenSharing || false);
      }
      
      if (roomData.participants && roomData.participants.length > 0) {
        roomData.participants.forEach(participant => {
          if (participant.userId !== currentUser?.id) {
            sendOffer(participant.userId);
          }
        });
      }
      
      if (requestMedia) {
        try {
          await startLocalStream(initialAudio, initialVideo);
          if (!initialAudio) {
            setAudioEnabled(false);
          }
          if (!initialVideo) {
            setVideoEnabled(false);
          }
        } catch (streamError) {
          setError(streamError.message);
        }
      }
    } catch (error) {
      setError(error.message || 'Ошибка при присоединении к комнате');
      throw error;
    }
  }, [subscribeToRoomEvents, startLocalStream, sendOffer]);

  const leaveRoom = useCallback(async () => {
    if (roomIdRef.current) {
      try {
        await roomAPI.leaveRoom(roomIdRef.current);
      } catch (error) {
      }
    }
    cleanup();
  }, [cleanup]);

  const endRoom = useCallback(async () => {
    if (roomIdRef.current) {
      try {
        await roomAPI.endRoom(roomIdRef.current);
      } catch (error) {
      }
    }
    cleanup();
  }, [cleanup]);

  // Поднять/опустить руку
  const raiseHand = useCallback(async (raised = true) => {
    if (!roomIdRef.current) return;
    try {
      await roomAPI.raiseHand(roomIdRef.current, raised);
      setHandRaised(raised);
    } catch (error) {
      setError(error.message || 'Ошибка при изменении статуса руки');
    }
  }, []);

  // Начать демонстрацию экрана
  const startScreenShare = useCallback(async () => {
    if (!isBrowser || !navigator.mediaDevices?.getDisplayMedia) {
      setError('Демонстрация экрана не поддерживается в этом браузере');
      return;
    }

    try {
      // Сначала уведомляем сервер
      await roomAPI.startScreenShare(roomIdRef.current);
      
      // Получаем стрим экрана
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
        },
        audio: false,
      });

      screenStreamRef.current = stream;
      setScreenStream(stream);
      setIsScreenSharing(true);

      // Обработка остановки демонстрации через кнопку браузера
      stream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };

      // Добавляем трек во все peer connections
      peerConnectionsRef.current.forEach((pc) => {
        stream.getTracks().forEach(track => {
          pc.addTrack(track, stream);
        });
      });

    } catch (error) {
      if (error.name !== 'NotAllowedError') {
        setError(error.message || 'Ошибка при запуске демонстрации экрана');
      }
      // Если пользователь отменил — уведомляем сервер
      try {
        await roomAPI.stopScreenShare(roomIdRef.current);
      } catch {}
    }
  }, []);

  // Остановить демонстрацию экрана
  const stopScreenShare = useCallback(async () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }
    setScreenStream(null);
    setIsScreenSharing(false);

    if (roomIdRef.current) {
      try {
        await roomAPI.stopScreenShare(roomIdRef.current);
      } catch {}
    }
  }, []);

  // Назначить со-ведущим (только для HOST/CO_HOST)
  const promoteParticipant = useCallback(async (participantId) => {
    if (!roomIdRef.current) return;
    if (myRole !== PARTICIPANT_ROLE.HOST && myRole !== PARTICIPANT_ROLE.CO_HOST) {
      setError('Недостаточно прав для этого действия');
      return;
    }
    try {
      await roomAPI.promoteParticipant(roomIdRef.current, participantId);
    } catch (error) {
      setError(error.message || 'Ошибка при назначении со-ведущего');
    }
  }, [myRole]);

  // Замутить участника (только для HOST/CO_HOST)
  const muteParticipant = useCallback(async (participantId) => {
    if (!roomIdRef.current) return;
    if (myRole !== PARTICIPANT_ROLE.HOST && myRole !== PARTICIPANT_ROLE.CO_HOST) {
      setError('Недостаточно прав для этого действия');
      return;
    }
    try {
      await roomAPI.muteParticipant(roomIdRef.current, participantId);
    } catch (error) {
      setError(error.message || 'Ошибка при отключении микрофона участника');
    }
  }, [myRole]);

  // Удалить участника из комнаты (только для HOST/CO_HOST)
  const kickParticipant = useCallback(async (participantId) => {
    if (!roomIdRef.current) return;
    if (myRole !== PARTICIPANT_ROLE.HOST && myRole !== PARTICIPANT_ROLE.CO_HOST) {
      setError('Недостаточно прав для этого действия');
      return;
    }
    try {
      await roomAPI.kickParticipant(roomIdRef.current, participantId);
    } catch (error) {
      setError(error.message || 'Ошибка при удалении участника');
    }
  }, [myRole]);

  // Проверка, является ли текущий пользователь хостом или со-хостом
  const isHost = myRole === PARTICIPANT_ROLE.HOST;
  const isCoHost = myRole === PARTICIPANT_ROLE.CO_HOST;
  const canManageParticipants = isHost || isCoHost;

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    // Состояние комнаты
    room,
    participants,
    isInRoom,
    error,
    
    // Медиа стримы
    localStream,
    remoteStreams,
    screenStream,
    
    // Состояние медиа
    audioEnabled,
    videoEnabled,
    isScreenSharing,
    handRaised,
    
    // Роль и права
    myRole,
    isHost,
    isCoHost,
    canManageParticipants,
    
    // Управление комнатой
    createRoom,
    joinRoom,
    leaveRoom,
    endRoom,
    
    // Управление медиа
    startLocalStream,
    stopLocalStream,
    toggleAudio,
    toggleVideo,
    
    // Демонстрация экрана
    startScreenShare,
    stopScreenShare,
    
    // Взаимодействие
    raiseHand,
    
    // Управление участниками (для хоста/со-хоста)
    promoteParticipant,
    muteParticipant,
    kickParticipant,
    
    // Вспомогательные
    sendOffer,
    clearError: () => setError(null),
  };
};

