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
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [isInRoom, setIsInRoom] = useState(false);
  const [error, setError] = useState(null);
  
  const peerConnectionsRef = useRef(new Map());
  const roomEventSubscriptionRef = useRef(null);
  const roomSignalSubscriptionRef = useRef(null);
  const userSignalSubscriptionRef = useRef(null);
  const localStreamRef = useRef(null);
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
    
    setLocalStream(null);
    setRemoteStreams(new Map());
    setIsInRoom(false);
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
    if (!event || !roomIdRef.current || event.room?.roomId !== roomIdRef.current) return;

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
            const currentUser = JSON.parse(localStorage.getItem('user'));
            if (event.participant.userId !== currentUser?.id && isInRoom) {
              setTimeout(() => sendOffer(event.participant.userId), 100);
            }
          }
          return newParticipants;
        });
        break;
      case ROOM_EVENT_TYPES.ROOM_LEFT:
        setParticipants(prev => prev.filter(p => p.id !== event.userId));
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

    const timeout = 10000;
    let timeoutId;

    try {
      const getUserMediaPromise = navigator.mediaDevices.getUserMedia({
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
      });

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

  const createRoom = useCallback(async (title, chatId, type = 'PUBLIC', customRoomId = null) => {
    try {
      setError(null);
      const newRoom = await roomAPI.createRoom(title, chatId, type, customRoomId);
      setRoom(newRoom);
      roomIdRef.current = newRoom.roomId;
      subscribeToRoomEvents();
      return newRoom;
    } catch (error) {
      const errorMessage = error.message || 'Ошибка при создании комнаты';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [subscribeToRoomEvents]);

  const joinRoom = useCallback(async (roomIdToJoin) => {
    try {
      setError(null);
      const roomData = await roomAPI.joinRoom(roomIdToJoin);
      roomIdRef.current = roomIdToJoin;
      setRoom(roomData);
      setParticipants(roomData.participants || []);
      setIsInRoom(true);
      subscribeToRoomEvents();
      
      try {
        await startLocalStream(true, true);
      } catch (streamError) {
        setError(streamError.message);
        throw streamError;
      }
      
      if (roomData.participants && roomData.participants.length > 0) {
        const currentUser = JSON.parse(localStorage.getItem('user'));
        roomData.participants.forEach(participant => {
          if (participant.userId !== currentUser?.id) {
            sendOffer(participant.userId);
          }
        });
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

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    room,
    participants,
    localStream,
    remoteStreams,
    audioEnabled,
    videoEnabled,
    isInRoom,
    error,
    createRoom,
    joinRoom,
    leaveRoom,
    endRoom,
    startLocalStream,
    stopLocalStream,
    toggleAudio,
    toggleVideo,
    sendOffer,
    clearError: () => setError(null),
  };
};

