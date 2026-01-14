import { useState, useRef, useCallback, useEffect } from 'react';
import { useStomp } from '@/context/socket';
import { safeJsonParse, safeUnsubscribe } from '@/utils/safe';

// Signal Types (отправляемые команды)
const SIGNAL_TYPES = {
  // Управление комнатой
  ROOM_CREATE: 'ROOM_CREATE',
  ROOM_JOIN: 'ROOM_JOIN',
  ROOM_LEAVE: 'ROOM_LEAVE',
  ROOM_END: 'ROOM_END',
  
  // WebRTC
  ROOM_OFFER: 'ROOM_OFFER',
  ROOM_ANSWER: 'ROOM_ANSWER',
  ROOM_ICE_CANDIDATE: 'ROOM_ICE_CANDIDATE',
  
  // Медиа (своё)
  ROOM_MUTE_AUDIO: 'ROOM_MUTE_AUDIO',
  ROOM_UNMUTE_AUDIO: 'ROOM_UNMUTE_AUDIO',
  ROOM_MUTE_VIDEO: 'ROOM_MUTE_VIDEO',
  ROOM_UNMUTE_VIDEO: 'ROOM_UNMUTE_VIDEO',
  
  // Интерактив
  ROOM_RAISE_HAND: 'ROOM_RAISE_HAND',
  ROOM_LOWER_HAND: 'ROOM_LOWER_HAND',
  ROOM_START_SCREEN_SHARE: 'ROOM_START_SCREEN_SHARE',
  ROOM_STOP_SCREEN_SHARE: 'ROOM_STOP_SCREEN_SHARE',
  
  // Управление участниками (host/co-host)
  ROOM_PROMOTE_CO_HOST: 'ROOM_PROMOTE_CO_HOST',
  ROOM_DEMOTE_TO_PARTICIPANT: 'ROOM_DEMOTE_TO_PARTICIPANT',
  ROOM_MUTE_PARTICIPANT: 'ROOM_MUTE_PARTICIPANT',
  ROOM_KICK_PARTICIPANT: 'ROOM_KICK_PARTICIPANT',
};

// Event Types (входящие события)
const EVENT_TYPES = {
  // Комната
  ROOM_CREATED: 'ROOM_CREATED',
  ROOM_STARTED: 'ROOM_STARTED',
  ROOM_JOINED: 'ROOM_JOINED',
  ROOM_LEFT: 'ROOM_LEFT',
  ROOM_ENDED: 'ROOM_ENDED',
  
  // Медиа участников
  PARTICIPANT_AUDIO_CHANGED: 'PARTICIPANT_AUDIO_CHANGED',
  PARTICIPANT_VIDEO_CHANGED: 'PARTICIPANT_VIDEO_CHANGED',
  PARTICIPANT_HAND_RAISED: 'PARTICIPANT_HAND_RAISED',
  PARTICIPANT_HAND_LOWERED: 'PARTICIPANT_HAND_LOWERED',
  PARTICIPANT_SCREEN_SHARE_STARTED: 'PARTICIPANT_SCREEN_SHARE_STARTED',
  PARTICIPANT_SCREEN_SHARE_STOPPED: 'PARTICIPANT_SCREEN_SHARE_STOPPED',
  
  // Роли
  PARTICIPANT_PROMOTED: 'PARTICIPANT_PROMOTED',
  PARTICIPANT_DEMOTED: 'PARTICIPANT_DEMOTED',
  PARTICIPANT_MUTED_BY_HOST: 'PARTICIPANT_MUTED_BY_HOST',
  PARTICIPANT_KICKED: 'PARTICIPANT_KICKED',
  
  // WebRTC
  WEBRTC_OFFER: 'WEBRTC_OFFER',
  WEBRTC_ANSWER: 'WEBRTC_ANSWER',
  WEBRTC_ICE_CANDIDATE: 'WEBRTC_ICE_CANDIDATE',
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
  { urls: 'stun:stun1.l.google.com:19302' },
];

export const useRoomProtocol = (initialRoomId = null) => {
  const isBrowser = typeof window !== 'undefined';
  
  const { client, connected } = useStomp();
  
  // Состояние комнаты
  const [room, setRoom] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [isInRoom, setIsInRoom] = useState(false);
  const [error, setError] = useState(null);
  
  // Медиа стримы
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState(new Map());
  const [screenStream, setScreenStream] = useState(null);
  
  // Состояние медиа
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  
  // Роль
  const [myRole, setMyRole] = useState(PARTICIPANT_ROLE.PARTICIPANT);
  
  // Refs
  const peerConnectionsRef = useRef(new Map());
  const roomSubscriptionRef = useRef(null);
  const userQueueSubscriptionRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const roomIdRef = useRef(initialRoomId);
  const pendingCallbacksRef = useRef(new Map());
  
  // Seq/Pts для Gap Recovery
  const lastSeqRef = useRef(0);
  const eventQueueRef = useRef([]);
  const isRecoveringRef = useRef(false);

  // Текущий пользователь
  const getCurrentUser = useCallback(() => {
    if (!isBrowser) return null;
    try {
      return JSON.parse(localStorage.getItem('user'));
    } catch {
      return null;
    }
  }, [isBrowser]);

  const currentUser = getCurrentUser();
  const myUserId = currentUser?.id;

  // Обновляем roomId ref
  useEffect(() => {
    roomIdRef.current = initialRoomId;
  }, [initialRoomId]);

  // Отправка сигнала через WebSocket
  const sendSignal = useCallback((signal, callback) => {
    if (!client || !connected) {
      console.error('WebSocket not connected');
      return;
    }
    
    // Генерируем ID для отслеживания ответа
    const signalId = Date.now().toString();
    if (callback) {
      pendingCallbacksRef.current.set(signalId, callback);
    }
    
    client.publish({
      destination: '/app/room.signal',
      body: JSON.stringify({ ...signal, signalId }),
    });
  }, [client, connected]);

  // Создание PeerConnection
  const createPeerConnection = useCallback((userId) => {
    if (!isBrowser || !window.RTCPeerConnection) return null;

    const existingPc = peerConnectionsRef.current.get(userId);
    if (existingPc) {
      existingPc.close();
    }

    const pc = new RTCPeerConnection({ iceServers: STUN_SERVERS });

    // Добавляем локальные треки
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    // ICE кандидаты
    pc.onicecandidate = (event) => {
      if (event.candidate && roomIdRef.current) {
        sendSignal({
          type: SIGNAL_TYPES.ROOM_ICE_CANDIDATE,
          roomId: roomIdRef.current,
          targetUserId: userId,
          iceCandidate: event.candidate.candidate,
          iceCandidateSdpMid: event.candidate.sdpMid,
          iceCandidateSdpMLineIndex: event.candidate.sdpMLineIndex,
        });
      }
    };

    // Получение удалённых треков
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

    // Состояние соединения
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

    peerConnectionsRef.current.set(userId, pc);
    return pc;
  }, [isBrowser, sendSignal]);

  // Отправка offer
  const sendOffer = useCallback(async (userId) => {
    const pc = createPeerConnection(userId);
    if (!pc) return;

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      sendSignal({
        type: SIGNAL_TYPES.ROOM_OFFER,
        roomId: roomIdRef.current,
        targetUserId: userId,
        sdp: offer.sdp,
      });
    } catch (err) {
      console.error('Error creating offer:', err);
      pc.close();
      peerConnectionsRef.current.delete(userId);
    }
  }, [createPeerConnection, sendSignal]);

  // Обработка входящего offer
  const handleOffer = useCallback(async (fromUserId, sdp) => {
    const pc = createPeerConnection(fromUserId);
    if (!pc) return;

    try {
      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp }));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      sendSignal({
        type: SIGNAL_TYPES.ROOM_ANSWER,
        roomId: roomIdRef.current,
        targetUserId: fromUserId,
        sdp: answer.sdp,
      });
    } catch (err) {
      console.error('Error handling offer:', err);
      pc.close();
      peerConnectionsRef.current.delete(fromUserId);
    }
  }, [createPeerConnection, sendSignal]);

  // Обработка входящего answer
  const handleAnswer = useCallback(async (fromUserId, sdp) => {
    const pc = peerConnectionsRef.current.get(fromUserId);
    if (!pc) return;

    try {
      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp }));
    } catch (err) {
      console.error('Error handling answer:', err);
    }
  }, []);

  // Обработка ICE кандидата
  const handleIceCandidate = useCallback(async (fromUserId, candidate) => {
    const pc = peerConnectionsRef.current.get(fromUserId);
    if (!pc) return;

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.error('Error adding ICE candidate:', err);
    }
  }, []);

  // Закрытие peer connection
  const closePeerConnection = useCallback((userId) => {
    const pc = peerConnectionsRef.current.get(userId);
    if (pc) {
      pc.close();
      peerConnectionsRef.current.delete(userId);
    }
    setRemoteStreams(prev => {
      const newMap = new Map(prev);
      newMap.delete(userId);
      return newMap;
    });
  }, []);

  // Refs для избежания циклических зависимостей
  const processEventRef = useRef(null);
  const cleanupRef = useRef(null);
  
  // Gap Recovery: очередь событий с ключом по seq
  const eventQueueMapRef = useRef(new Map());

  // Запрос состояния комнаты (Gap Recovery)
  const requestRoomState = useCallback(() => {
    if (!client || !connected || !roomIdRef.current || isRecoveringRef.current) return;
    
    isRecoveringRef.current = true;
    sendSignal({
      type: 'ROOM_GET_STATE',
      roomId: roomIdRef.current,
    }, (response) => {
      isRecoveringRef.current = false;
      if (response.room) {
        setRoom(response.room);
        setParticipants(response.room.participants || []);
        lastSeqRef.current = response.seq || 0;
        
        // Обрабатываем очередь событий по порядку
        while (eventQueueMapRef.current.has(lastSeqRef.current + 1)) {
          const nextEvent = eventQueueMapRef.current.get(lastSeqRef.current + 1);
          eventQueueMapRef.current.delete(lastSeqRef.current + 1);
          if (processEventRef.current) {
            processEventRef.current(nextEvent);
          }
          lastSeqRef.current++;
        }
      }
    });
  }, [client, connected, sendSignal]);

  // Обработка одного события
  const processEvent = useCallback((event) => {
    const eventRoomId = event.room?.roomId || event.roomId;
    if (roomIdRef.current && eventRoomId && eventRoomId !== roomIdRef.current) return;

    switch (event.eventType) {
      // === Комната ===
      case EVENT_TYPES.ROOM_CREATED:
      case EVENT_TYPES.ROOM_STARTED:
        setRoom(event.room);
        setParticipants(event.room?.participants || []);
        break;

      case EVENT_TYPES.ROOM_JOINED:
        if (event.room) {
          setRoom(event.room);
          setParticipants(event.room.participants || []);
        }
        if (event.participant) {
          setParticipants(prev => {
            if (prev.find(p => p.user?.id === event.participant.user?.id)) return prev;
            return [...prev, event.participant];
          });
          // Устанавливаем WebRTC соединение с новым участником
          const newUserId = event.participant.user?.id;
          if (newUserId && newUserId !== myUserId && isInRoom) {
            setTimeout(() => sendOffer(newUserId), 100);
          }
        }
        break;

      case EVENT_TYPES.ROOM_LEFT:
        const leftUserId = event.participant?.user?.id || event.userId;
        setParticipants(prev => prev.filter(p => p.user?.id !== leftUserId));
        closePeerConnection(leftUserId);
        break;

      case EVENT_TYPES.ROOM_ENDED:
        if (cleanupRef.current) cleanupRef.current();
        break;

      // === Медиа участников ===
      case EVENT_TYPES.PARTICIPANT_AUDIO_CHANGED:
        setParticipants(prev => prev.map(p => 
          p.user?.id === event.userId ? { ...p, audioEnabled: event.enabled } : p
        ));
        break;

      case EVENT_TYPES.PARTICIPANT_VIDEO_CHANGED:
        setParticipants(prev => prev.map(p => 
          p.user?.id === event.userId ? { ...p, videoEnabled: event.enabled } : p
        ));
        break;

      case EVENT_TYPES.PARTICIPANT_HAND_RAISED:
        setParticipants(prev => prev.map(p => 
          p.user?.id === event.userId ? { ...p, handRaised: true } : p
        ));
        if (event.userId === myUserId) setHandRaised(true);
        break;

      case EVENT_TYPES.PARTICIPANT_HAND_LOWERED:
        setParticipants(prev => prev.map(p => 
          p.user?.id === event.userId ? { ...p, handRaised: false } : p
        ));
        if (event.userId === myUserId) setHandRaised(false);
        break;

      case EVENT_TYPES.PARTICIPANT_SCREEN_SHARE_STARTED:
        setParticipants(prev => prev.map(p => 
          p.user?.id === event.userId ? { ...p, screenSharing: true } : p
        ));
        if (event.userId === myUserId) setIsScreenSharing(true);
        break;

      case EVENT_TYPES.PARTICIPANT_SCREEN_SHARE_STOPPED:
        setParticipants(prev => prev.map(p => 
          p.user?.id === event.userId ? { ...p, screenSharing: false } : p
        ));
        if (event.userId === myUserId) setIsScreenSharing(false);
        break;

      // === Роли ===
      case EVENT_TYPES.PARTICIPANT_PROMOTED:
        setParticipants(prev => prev.map(p => 
          p.user?.id === event.targetUserId ? { ...p, role: PARTICIPANT_ROLE.CO_HOST } : p
        ));
        if (event.targetUserId === myUserId) setMyRole(PARTICIPANT_ROLE.CO_HOST);
        break;

      case EVENT_TYPES.PARTICIPANT_DEMOTED:
        setParticipants(prev => prev.map(p => 
          p.user?.id === event.targetUserId ? { ...p, role: PARTICIPANT_ROLE.PARTICIPANT } : p
        ));
        if (event.targetUserId === myUserId) setMyRole(PARTICIPANT_ROLE.PARTICIPANT);
        break;

      case EVENT_TYPES.PARTICIPANT_MUTED_BY_HOST:
        if (event.targetUserId === myUserId && localStreamRef.current) {
          localStreamRef.current.getAudioTracks().forEach(track => {
            track.enabled = false;
          });
          setAudioEnabled(false);
        }
        setParticipants(prev => prev.map(p => 
          p.user?.id === event.targetUserId ? { ...p, audioEnabled: false } : p
        ));
        break;

      case EVENT_TYPES.PARTICIPANT_KICKED:
        if (event.targetUserId === myUserId) {
          if (cleanupRef.current) cleanupRef.current();
          setError('Вас удалили из комнаты');
        } else {
          setParticipants(prev => prev.filter(p => p.user?.id !== event.targetUserId));
          closePeerConnection(event.targetUserId);
        }
        break;

      // === WebRTC ===
      case EVENT_TYPES.WEBRTC_OFFER:
        if (event.targetUserId === myUserId) {
          handleOffer(event.fromUserId, event.sdp);
        }
        break;

      case EVENT_TYPES.WEBRTC_ANSWER:
        if (event.targetUserId === myUserId) {
          handleAnswer(event.fromUserId, event.sdp);
        }
        break;

      case EVENT_TYPES.WEBRTC_ICE_CANDIDATE:
        if (event.targetUserId === myUserId) {
          handleIceCandidate(event.fromUserId, {
            candidate: event.iceCandidate,
            sdpMid: event.iceCandidateSdpMid,
            sdpMLineIndex: event.iceCandidateSdpMLineIndex,
          });
        }
        break;

      default:
        break;
    }
  }, [myUserId, isInRoom, sendOffer, closePeerConnection, handleOffer, handleAnswer, handleIceCandidate]);

  // Обработка очереди событий после получения события в правильном порядке
  const processQueuedEvents = useCallback(() => {
    while (eventQueueMapRef.current.has(lastSeqRef.current + 1)) {
      const nextEvent = eventQueueMapRef.current.get(lastSeqRef.current + 1);
      eventQueueMapRef.current.delete(lastSeqRef.current + 1);
      if (processEventRef.current) {
        processEventRef.current(nextEvent);
      }
      lastSeqRef.current++;
    }
  }, []);

  // Обработка событий комнаты с Gap Recovery
  const handleRoomEvent = useCallback((message) => {
    const event = safeJsonParse(message.body);
    if (!event) return;

    // Проверяем roomId
    const eventRoomId = event.room?.roomId || event.roomId;
    if (roomIdRef.current && eventRoomId && eventRoomId !== roomIdRef.current) return;

    // Gap Recovery: проверяем seq
    const eventSeq = event.seq;
    if (eventSeq) {
      if (eventSeq === lastSeqRef.current + 1) {
        // В порядке — обрабатываем
        processEvent(event);
        lastSeqRef.current = eventSeq;
        
        // Проверяем очередь на следующие события
        processQueuedEvents();
      } else if (eventSeq > lastSeqRef.current + 1) {
        // Пропуск — кладем в очередь и запрашиваем состояние
        eventQueueMapRef.current.set(eventSeq, event);
        requestRoomState();
      }
      // eventSeq <= lastSeqRef.current — дубликат, игнорируем
    } else {
      // Без seq — просто обрабатываем (WebRTC сигналы)
      processEvent(event);
    }
  }, [processEvent, requestRoomState, processQueuedEvents]);

  // Обработка ответов на команды (user queue)
  const handleUserQueueMessage = useCallback((message) => {
    const response = safeJsonParse(message.body);
    if (!response) return;

    // Обработка callback если есть
    if (response.signalId && pendingCallbacksRef.current.has(response.signalId)) {
      const callback = pendingCallbacksRef.current.get(response.signalId);
      pendingCallbacksRef.current.delete(response.signalId);
      callback(response);
    }

    // Обработка ответа
    if (response.success === false && response.errorMessage) {
      setError(response.errorMessage);
      return;
    }

    if (response.room) {
      setRoom(response.room);
      setParticipants(response.room.participants || []);
      
      // Определяем свою роль
      const myParticipant = response.room.participants?.find(p => p.user?.id === myUserId);
      if (myParticipant) {
        setMyRole(myParticipant.role || PARTICIPANT_ROLE.PARTICIPANT);
        setHandRaised(myParticipant.handRaised || false);
        setIsScreenSharing(myParticipant.screenSharing || false);
      }
    }
  }, [myUserId]);

  // Cleanup
  const cleanup = useCallback(() => {
    // Закрываем все peer connections
    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();
    
    // Останавливаем стримы
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }
    
    // Отписки
    safeUnsubscribe(roomSubscriptionRef);
    safeUnsubscribe(userQueueSubscriptionRef);
    
    // Сброс состояния
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
    roomIdRef.current = null;
    
    // Сброс seq/pts
    lastSeqRef.current = 0;
    eventQueueRef.current = [];
    eventQueueMapRef.current.clear();
    isRecoveringRef.current = false;
  }, []);

  // Обновляем refs при изменении функций
  useEffect(() => {
    cleanupRef.current = cleanup;
  }, [cleanup]);

  useEffect(() => {
    processEventRef.current = processEvent;
  }, [processEvent]);

  // Подписка на user queue (для ответов на команды)
  const ensureUserQueueSubscription = useCallback(() => {
    if (!client || !connected) return false;
    
    if (!userQueueSubscriptionRef.current) {
      userQueueSubscriptionRef.current = client.subscribe(
        '/user/queue/room-signal',
        handleUserQueueMessage
      );
    }
    return true;
  }, [client, connected, handleUserQueueMessage]);

  // Подписка на события комнаты
  const subscribeToRoom = useCallback((roomId) => {
    if (!client || !connected || !roomId) return;

    // Подписка на события комнаты
    if (roomSubscriptionRef.current) {
      safeUnsubscribe(roomSubscriptionRef);
    }
    roomSubscriptionRef.current = client.subscribe(
      `/topic/room/${roomId}`,
      handleRoomEvent
    );

    // Подписка на личные ответы (если ещё не подписаны)
    ensureUserQueueSubscription();
  }, [client, connected, handleRoomEvent, ensureUserQueueSubscription]);

  // Запуск локального стрима
  const startLocalStream = useCallback(async (audio = true, video = true) => {
    if (!isBrowser || !navigator.mediaDevices) {
      throw new Error('Медиа устройства недоступны');
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audio ? { echoCancellation: true, noiseSuppression: true } : false,
        video: video ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
      });

      localStreamRef.current = stream;
      setLocalStream(stream);
      setAudioEnabled(audio);
      setVideoEnabled(video);

      // Добавляем треки в существующие соединения
      peerConnectionsRef.current.forEach((pc) => {
        stream.getTracks().forEach(track => {
          pc.addTrack(track, stream);
        });
      });

      return stream;
    } catch (err) {
      let errorMessage = 'Ошибка доступа к камере/микрофону';
      if (err.name === 'NotAllowedError') {
        errorMessage = 'Доступ запрещён. Разрешите доступ в настройках браузера.';
      } else if (err.name === 'NotFoundError') {
        errorMessage = 'Камера или микрофон не найдены.';
      }
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [isBrowser]);

  // === API методы ===

  // Создать комнату (через REST API) — обёртка для удобства
  const createRoom = useCallback(async (options = {}) => {
    try {
      const { roomAPI } = await import('@/utils/api');
      const roomData = await roomAPI.createRoom(
        options.title || null,
        options.chatId || null,
        options.type || 'PUBLIC',
        {
          maxParticipants: options.maxParticipants,
          waitingRoom: options.waitingRoom,
          screenShareEnabled: options.screenShareEnabled,
        }
      );
      return roomData;
    } catch (err) {
      throw new Error(err.message || 'Ошибка создания комнаты');
    }
  }, []);

  // Войти в комнату (через REST API + WebSocket подписка)
  const joinRoom = useCallback(async (roomId, requestMedia = true, initialAudio = true, initialVideo = true) => {
    try {
      // Сбрасываем seq для новой комнаты
      lastSeqRef.current = 0;
      eventQueueRef.current = [];
      eventQueueMapRef.current.clear();
      roomIdRef.current = roomId;
      
      // 1. Подписываемся на WebSocket события комнаты
      ensureUserQueueSubscription();
      subscribeToRoom(roomId);
      
      // 2. Входим в комнату через REST API
      const { roomAPI } = await import('@/utils/api');
      const roomData = await roomAPI.joinRoom(roomId);
      
      if (!roomData) {
        throw new Error('Не удалось получить данные комнаты');
      }
      
      setRoom(roomData);
      setParticipants(roomData.participants || []);
      setIsInRoom(true);
      
      // Определяем роль
      const myParticipant = roomData.participants?.find(p => p.user?.id === myUserId);
      if (myParticipant) {
        setMyRole(myParticipant.role || PARTICIPANT_ROLE.PARTICIPANT);
      }
      
      // Устанавливаем WebRTC соединения с другими участниками
      roomData.participants?.forEach(p => {
        if (p.user?.id !== myUserId && p.isActive !== false) {
          sendOffer(p.user.id);
        }
      });
      
      // 3. Запрашиваем медиа
      if (requestMedia) {
        try {
          await startLocalStream(initialAudio, initialVideo);
        } catch (err) {
          setError(err.message);
          // Не бросаем ошибку — пользователь уже в комнате
        }
      }
      
      return roomData;
    } catch (err) {
      setError(err.message || 'Ошибка входа в комнату');
      throw err;
    }
  }, [subscribeToRoom, myUserId, sendOffer, startLocalStream, ensureUserQueueSubscription]);

  // Выйти из комнаты (через REST API)
  const leaveRoom = useCallback(async () => {
    if (roomIdRef.current) {
      try {
        const { roomAPI } = await import('@/utils/api');
        await roomAPI.leaveRoom(roomIdRef.current);
      } catch (err) {
        console.error('Error leaving room:', err);
      }
    }
    cleanup();
  }, [cleanup]);

  // Завершить комнату (через REST API)
  const endRoom = useCallback(async () => {
    if (roomIdRef.current) {
      try {
        const { roomAPI } = await import('@/utils/api');
        await roomAPI.endRoom(roomIdRef.current);
      } catch (err) {
        console.error('Error ending room:', err);
      }
    }
    cleanup();
  }, [cleanup]);

  // Переключить аудио
  const toggleAudio = useCallback(() => {
    if (!localStreamRef.current) return;
    
    const newEnabled = !audioEnabled;
    localStreamRef.current.getAudioTracks().forEach(track => {
      track.enabled = newEnabled;
    });
    setAudioEnabled(newEnabled);
    
    if (roomIdRef.current) {
      sendSignal({
        type: newEnabled ? SIGNAL_TYPES.ROOM_UNMUTE_AUDIO : SIGNAL_TYPES.ROOM_MUTE_AUDIO,
        roomId: roomIdRef.current,
      });
    }
  }, [audioEnabled, sendSignal]);

  // Переключить видео
  const toggleVideo = useCallback(() => {
    if (!localStreamRef.current) return;
    
    const newEnabled = !videoEnabled;
    localStreamRef.current.getVideoTracks().forEach(track => {
      track.enabled = newEnabled;
    });
    setVideoEnabled(newEnabled);
    
    if (roomIdRef.current) {
      sendSignal({
        type: newEnabled ? SIGNAL_TYPES.ROOM_UNMUTE_VIDEO : SIGNAL_TYPES.ROOM_MUTE_VIDEO,
        roomId: roomIdRef.current,
      });
    }
  }, [videoEnabled, sendSignal]);

  // Поднять руку
  const raiseHand = useCallback(() => {
    if (!roomIdRef.current) return;
    sendSignal({
      type: handRaised ? SIGNAL_TYPES.ROOM_LOWER_HAND : SIGNAL_TYPES.ROOM_RAISE_HAND,
      roomId: roomIdRef.current,
    });
  }, [handRaised, sendSignal]);

  // Демонстрация экрана
  const startScreenShare = useCallback(async () => {
    if (!isBrowser || !navigator.mediaDevices?.getDisplayMedia) {
      setError('Демонстрация экрана не поддерживается');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' },
        audio: false,
      });

      screenStreamRef.current = stream;
      setScreenStream(stream);
      
      // Уведомляем сервер
      sendSignal({
        type: SIGNAL_TYPES.ROOM_START_SCREEN_SHARE,
        roomId: roomIdRef.current,
      });

      // При остановке через браузер
      stream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };

      // Добавляем в peer connections
      peerConnectionsRef.current.forEach((pc) => {
        stream.getTracks().forEach(track => pc.addTrack(track, stream));
      });
    } catch (err) {
      if (err.name !== 'NotAllowedError') {
        setError('Ошибка демонстрации экрана');
      }
    }
  }, [isBrowser, sendSignal]);

  const stopScreenShare = useCallback(() => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }
    setScreenStream(null);
    setIsScreenSharing(false);
    
    if (roomIdRef.current) {
      sendSignal({
        type: SIGNAL_TYPES.ROOM_STOP_SCREEN_SHARE,
        roomId: roomIdRef.current,
      });
    }
  }, [sendSignal]);

  // Управление участниками (host/co-host)
  const promoteParticipant = useCallback((targetUserId) => {
    if (!roomIdRef.current) return;
    sendSignal({
      type: SIGNAL_TYPES.ROOM_PROMOTE_CO_HOST,
      roomId: roomIdRef.current,
      targetUserId,
    });
  }, [sendSignal]);

  const demoteParticipant = useCallback((targetUserId) => {
    if (!roomIdRef.current) return;
    sendSignal({
      type: SIGNAL_TYPES.ROOM_DEMOTE_TO_PARTICIPANT,
      roomId: roomIdRef.current,
      targetUserId,
    });
  }, [sendSignal]);

  const muteParticipant = useCallback((targetUserId) => {
    if (!roomIdRef.current) return;
    sendSignal({
      type: SIGNAL_TYPES.ROOM_MUTE_PARTICIPANT,
      roomId: roomIdRef.current,
      targetUserId,
    });
  }, [sendSignal]);

  const kickParticipant = useCallback((targetUserId) => {
    if (!roomIdRef.current) return;
    sendSignal({
      type: SIGNAL_TYPES.ROOM_KICK_PARTICIPANT,
      roomId: roomIdRef.current,
      targetUserId,
    });
  }, [sendSignal]);

  // Cleanup при размонтировании
  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  // Права
  const isHost = myRole === PARTICIPANT_ROLE.HOST;
  const isCoHost = myRole === PARTICIPANT_ROLE.CO_HOST;
  const canManageParticipants = isHost || isCoHost;

  return {
    // Состояние
    room,
    participants,
    isInRoom,
    error,
    
    // Медиа
    localStream,
    remoteStreams,
    screenStream,
    audioEnabled,
    videoEnabled,
    isScreenSharing,
    handRaised,
    
    // Роль
    myRole,
    isHost,
    isCoHost,
    canManageParticipants,
    
    // Управление комнатой
    createRoom,
    joinRoom,
    leaveRoom,
    endRoom,
    
    // Медиа
    startLocalStream,
    toggleAudio,
    toggleVideo,
    
    // Интерактив
    raiseHand,
    startScreenShare,
    stopScreenShare,
    
    // Управление участниками
    promoteParticipant,
    demoteParticipant,
    muteParticipant,
    kickParticipant,
    
    // Утилиты
    sendOffer,
    clearError: () => setError(null),
  };
};
