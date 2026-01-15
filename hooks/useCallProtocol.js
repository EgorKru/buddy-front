import { useState, useRef, useCallback, useEffect } from 'react';
import { useStomp } from '@/context/socket';
import { safeJsonParse } from '@/utils/safe';
import { getCurrentUser } from '@/utils/api';

// Signal Types (отправляемые команды)
const SIGNAL_TYPES = {
  // Управление звонком
  CALL_INITIATE: 'CALL_INITIATE',
  CALL_CANCEL: 'CALL_CANCEL',
  CALL_ACCEPT: 'CALL_ACCEPT',
  CALL_REJECT: 'CALL_REJECT',
  CALL_BUSY: 'CALL_BUSY',
  CALL_END: 'CALL_END',
  
  // WebRTC
  CALL_OFFER: 'CALL_OFFER',
  CALL_ANSWER: 'CALL_ANSWER',
  CALL_ICE_CANDIDATE: 'CALL_ICE_CANDIDATE',
  
  // Mute
  CALL_MUTE: 'CALL_MUTE',
  CALL_UNMUTE: 'CALL_UNMUTE',
};

// Event Types (входящие события)
const EVENT_TYPES = {
  INCOMING_CALL: 'INCOMING_CALL',
  CALL_ACCEPTED: 'CALL_ACCEPTED',
  CALL_REJECTED: 'CALL_REJECTED',
  CALL_CANCELLED: 'CALL_CANCELLED',
  CALL_ENDED: 'CALL_ENDED',
  CALL_BUSY: 'CALL_BUSY',
  
  // WebRTC
  WEBRTC_OFFER: 'WEBRTC_OFFER',
  WEBRTC_ANSWER: 'WEBRTC_ANSWER',
  WEBRTC_ICE_CANDIDATE: 'WEBRTC_ICE_CANDIDATE',
  
  // Mute
  PARTICIPANT_MUTED: 'PARTICIPANT_MUTED',
  PARTICIPANT_UNMUTED: 'PARTICIPANT_UNMUTED',
};

// Статусы звонка
export const CALL_STATUS = {
  CALLING: 'CALLING',
  RINGING: 'RINGING',
  ACTIVE: 'ACTIVE',
  ENDED: 'ENDED',
};

// Типы звонка
export const CALL_TYPE = {
  AUDIO: 'AUDIO',
  VIDEO: 'VIDEO',
};

// Причины завершения
export const END_REASON = {
  COMPLETED: 'COMPLETED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
  MISSED: 'MISSED',
  BUSY: 'BUSY',
  FAILED: 'FAILED',
};

const STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

const isBrowser = typeof window !== 'undefined';

export const useCallProtocol = () => {
  const { client: stompClient, connected: isConnected } = useStomp();
  
  // Состояние
  const [call, setCall] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [remoteMuted, setRemoteMuted] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const [isRinging, setIsRinging] = useState(false);  // Ожидание ответа (исходящий звонок)
  const [error, setError] = useState(null);
  
  // Refs
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const callIdRef = useRef(null);
  const subscriptionsRef = useRef([]);
  const iceCandidatesQueueRef = useRef([]);
  
  const currentUser = getCurrentUser();
  const myUserId = currentUser?.id;

  // Отправка сигнала
  const sendSignal = useCallback((signal) => {
    if (isConnected && stompClient) {
      console.log('[sendSignal] Sending:', signal);
      stompClient.publish({
        destination: '/app/call.signal',
        body: JSON.stringify(signal),
      });
    } else {
      console.warn('[sendSignal] Cannot send - WebSocket not connected:', { isConnected, hasStompClient: !!stompClient });
    }
  }, [isConnected, stompClient]);

  // Создание PeerConnection
  const createPeerConnection = useCallback(() => {
    if (!isBrowser) return null;

    const pc = new RTCPeerConnection({ iceServers: STUN_SERVERS });

    pc.onicecandidate = (event) => {
      if (event.candidate && callIdRef.current) {
        sendSignal({
          type: SIGNAL_TYPES.CALL_ICE_CANDIDATE,
          callId: callIdRef.current,
          iceCandidate: event.candidate.candidate,
          iceCandidateSdpMid: event.candidate.sdpMid,
          iceCandidateSdpMLineIndex: event.candidate.sdpMLineIndex,
        });
      }
    };

    pc.ontrack = (event) => {
      if (event.streams?.[0]) {
        setRemoteStream(event.streams[0]);
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
        setError('Соединение потеряно');
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  }, [sendSignal]);

  // Запуск локального стрима
  const startLocalStream = useCallback(async (isVideo = false) => {
    if (!isBrowser) return null;

    try {
      const constraints = {
        audio: true,
        video: isVideo ? { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } : false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setLocalStream(stream);
      setAudioEnabled(true);
      setVideoEnabled(isVideo);
      
      return stream;
    } catch (err) {
      console.error('Error getting media:', err);
      setError('Не удалось получить доступ к камере/микрофону');
      throw err;
    }
  }, []);

  // Добавление треков в PeerConnection
  const addTracksToPC = useCallback((stream, pc) => {
    stream.getTracks().forEach(track => {
      pc.addTrack(track, stream);
    });
  }, []);

  // Обработка ICE кандидатов из очереди
  const processIceCandidatesQueue = useCallback(async () => {
    const pc = peerConnectionRef.current;
    if (!pc || !pc.remoteDescription) return;

    while (iceCandidatesQueueRef.current.length > 0) {
      const candidate = iceCandidatesQueueRef.current.shift();
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error('Error adding ICE candidate:', err);
      }
    }
  }, []);

  // Отправка offer (caller)
  const sendOffer = useCallback(async () => {
    const pc = peerConnectionRef.current;
    if (!pc || !callIdRef.current) return;

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      sendSignal({
        type: SIGNAL_TYPES.CALL_OFFER,
        callId: callIdRef.current,
        sdp: offer.sdp,
      });
    } catch (err) {
      console.error('Error creating offer:', err);
      setError('Ошибка установки соединения');
    }
  }, [sendSignal]);

  // Обработка offer (callee)
  const handleOffer = useCallback(async (sdp) => {
    const pc = peerConnectionRef.current;
    if (!pc) return;

    try {
      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp }));
      
      // Обрабатываем накопленные ICE кандидаты
      await processIceCandidatesQueue();

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      sendSignal({
        type: SIGNAL_TYPES.CALL_ANSWER,
        callId: callIdRef.current,
        sdp: answer.sdp,
      });
    } catch (err) {
      console.error('Error handling offer:', err);
      setError('Ошибка установки соединения');
    }
  }, [sendSignal, processIceCandidatesQueue]);

  // Обработка answer (caller)
  const handleAnswer = useCallback(async (sdp) => {
    const pc = peerConnectionRef.current;
    if (!pc) return;

    try {
      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp }));
      // Обрабатываем накопленные ICE кандидаты
      await processIceCandidatesQueue();
    } catch (err) {
      console.error('Error handling answer:', err);
    }
  }, [processIceCandidatesQueue]);

  // Обработка ICE кандидата
  const handleIceCandidate = useCallback(async (candidateData) => {
    const pc = peerConnectionRef.current;
    
    const candidate = {
      candidate: candidateData.candidate,
      sdpMid: candidateData.sdpMid,
      sdpMLineIndex: candidateData.sdpMLineIndex,
    };

    // Если remote description ещё не установлен — кладём в очередь
    if (!pc?.remoteDescription) {
      iceCandidatesQueueRef.current.push(candidate);
      return;
    }

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.error('Error adding ICE candidate:', err);
    }
  }, []);

  // Очистка ресурсов
  const cleanup = useCallback(() => {
    // Останавливаем треки
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);
    setRemoteStream(null);

    // Закрываем PeerConnection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Сбрасываем состояние
    callIdRef.current = null;
    iceCandidatesQueueRef.current = [];
    setCall(null);
    setIncomingCall(null);
    setIsCallActive(false);
    setIsRinging(false);
    setAudioEnabled(true);
    setVideoEnabled(true);
    setRemoteMuted(false);
    setError(null);
  }, []);

  // Обработка событий звонка
  const handleCallEvent = useCallback((event) => {
    switch (event.eventType) {
      case EVENT_TYPES.INCOMING_CALL:
        setIncomingCall(event.call);
        break;

      case EVENT_TYPES.CALL_ACCEPTED:
        console.log('[CALL_ACCEPTED] Event:', event);
        console.log('[CALL_ACCEPTED] Call object:', event.call);
        console.log('[CALL_ACCEPTED] acceptedAt:', event.call?.acceptedAt);
        console.log('[CALL_ACCEPTED] startedAt:', event.call?.startedAt);
        setCall(event.call);
        setIncomingCall(null);
        setIsRinging(false);  // Ответили — убираем экран ожидания
        setIsCallActive(true);
        // Caller начинает WebRTC после accept
        if (event.call.caller?.id === myUserId) {
          setTimeout(() => sendOffer(), 100);
        }
        break;

      case EVENT_TYPES.CALL_REJECTED:
        setIsRinging(false);
        cleanup();
        break;

      case EVENT_TYPES.CALL_CANCELLED:
        setIsRinging(false);
        cleanup();
        break;

      case EVENT_TYPES.CALL_ENDED:
        setIsRinging(false);
        cleanup();
        break;

      case EVENT_TYPES.CALL_BUSY:
        setIsRinging(false);
        cleanup();
        break;

      case EVENT_TYPES.WEBRTC_OFFER:
        handleOffer(event.sdp);
        break;

      case EVENT_TYPES.WEBRTC_ANSWER:
        handleAnswer(event.sdp);
        break;

      case EVENT_TYPES.WEBRTC_ICE_CANDIDATE:
        handleIceCandidate({
          candidate: event.iceCandidate,
          sdpMid: event.iceCandidateSdpMid,
          sdpMLineIndex: event.iceCandidateSdpMLineIndex,
        });
        break;

      case EVENT_TYPES.PARTICIPANT_MUTED:
        setRemoteMuted(true);
        break;

      case EVENT_TYPES.PARTICIPANT_UNMUTED:
        setRemoteMuted(false);
        break;

      default:
        break;
    }
  }, [myUserId, cleanup, sendOffer, handleOffer, handleAnswer, handleIceCandidate]);

  // Подписки WebSocket
  useEffect(() => {
    if (!isConnected || !stompClient) return;

    // Подписка на ответы
    const signalSub = stompClient.subscribe('/user/queue/call-signal', (message) => {
      const response = safeJsonParse(message.body);
      if (response && !response.success && response.errorMessage) {
        setError(response.errorMessage);
      }
      if (response?.call) {
        setCall(response.call);
        callIdRef.current = response.call.id;
      }
    });

    // Подписка на события
    const eventsSub = stompClient.subscribe('/user/queue/call-events', (message) => {
      const event = safeJsonParse(message.body);
      if (event) {
        handleCallEvent(event);
      }
    });

    subscriptionsRef.current = [signalSub, eventsSub];

    return () => {
      subscriptionsRef.current.forEach(sub => {
        try { sub?.unsubscribe(); } catch (e) {}
      });
      subscriptionsRef.current = [];
    };
  }, [isConnected, stompClient, handleCallEvent]);

  // === API методы ===

  // Инициировать звонок
  // targetUserInfo: { id, username?, displayName? } - можно передать дополнительную информацию
  const initiateCall = useCallback(async (targetUserId, callType = CALL_TYPE.AUDIO, chatId = null, targetUserInfo = null) => {
    console.log('[initiateCall] Called with:', { targetUserId, callType, chatId, targetUserInfo });
    console.log('[initiateCall] WebSocket status:', { isConnected, hasStompClient: !!stompClient });
    
    if (!targetUserId) {
      console.error('[initiateCall] No targetUserId provided');
      setError('Не указан получатель звонка');
      return;
    }

    if (!isConnected || !stompClient) {
      console.error('[initiateCall] WebSocket not connected');
      setError('Нет соединения с сервером. Пожалуйста, подождите...');
      return;
    }

    try {
      console.log('[initiateCall] Creating temp call object...');
      // Создаём временный объект звонка для UI
      const tempCall = {
        id: null,
        caller: currentUser,
        callee: targetUserInfo || { id: targetUserId },
        type: callType,
        status: CALL_STATUS.CALLING,
        chatId,
      };
      setCall(tempCall);
      console.log('[initiateCall] Temp call set:', tempCall);
      
      // Устанавливаем состояние "ожидание ответа"
      setIsRinging(true);
      console.log('[initiateCall] isRinging set to true');
      
      // Запускаем медиа
      console.log('[initiateCall] Requesting media...');
      const stream = await startLocalStream(callType === CALL_TYPE.VIDEO);
      console.log('[initiateCall] Media stream obtained');
      
      // Создаём PeerConnection
      const pc = createPeerConnection();
      addTracksToPC(stream, pc);
      console.log('[initiateCall] PeerConnection created');

      // Отправляем сигнал
      console.log('[initiateCall] Sending CALL_INITIATE signal...');
      sendSignal({
        type: SIGNAL_TYPES.CALL_INITIATE,
        targetUserId,
        callType,
        chatId,
      });
      console.log('[initiateCall] Signal sent');
    } catch (err) {
      console.error('[initiateCall] Error:', err);
      setError(err.message || 'Ошибка при инициации звонка');
      setIsRinging(false);
      cleanup();
    }
  }, [isConnected, stompClient, currentUser, startLocalStream, createPeerConnection, addTracksToPC, sendSignal, cleanup]);

  // Принять звонок
  const acceptCall = useCallback(async (callId) => {
    if (!incomingCall) return;

    try {
      callIdRef.current = callId;
      
      // Запускаем медиа
      const isVideo = incomingCall.type === CALL_TYPE.VIDEO;
      const stream = await startLocalStream(isVideo);
      
      // Создаём PeerConnection
      const pc = createPeerConnection();
      addTracksToPC(stream, pc);

      // Отправляем accept
      sendSignal({
        type: SIGNAL_TYPES.CALL_ACCEPT,
        callId,
      });

      setCall(incomingCall);
      setIncomingCall(null);
      setIsCallActive(true);
    } catch (err) {
      cleanup();
    }
  }, [incomingCall, startLocalStream, createPeerConnection, addTracksToPC, sendSignal, cleanup]);

  // Отклонить звонок
  const rejectCall = useCallback((callId) => {
    sendSignal({
      type: SIGNAL_TYPES.CALL_REJECT,
      callId,
    });
    setIncomingCall(null);
  }, [sendSignal]);

  // Отменить звонок (до ответа)
  const cancelCall = useCallback(() => {
    if (callIdRef.current) {
      sendSignal({
        type: SIGNAL_TYPES.CALL_CANCEL,
        callId: callIdRef.current,
      });
    }
    cleanup();
  }, [sendSignal, cleanup]);

  // Сообщить что занят
  const sendBusy = useCallback((callId) => {
    sendSignal({
      type: SIGNAL_TYPES.CALL_BUSY,
      callId,
    });
    setIncomingCall(null);
  }, [sendSignal]);

  // Завершить звонок
  const endCall = useCallback(() => {
    if (callIdRef.current) {
      sendSignal({
        type: SIGNAL_TYPES.CALL_END,
        callId: callIdRef.current,
      });
    }
    cleanup();
  }, [sendSignal, cleanup]);

  // Переключить микрофон
  const toggleAudio = useCallback(() => {
    if (!localStreamRef.current) return;
    
    const newEnabled = !audioEnabled;
    localStreamRef.current.getAudioTracks().forEach(track => {
      track.enabled = newEnabled;
    });
    setAudioEnabled(newEnabled);
    
    if (callIdRef.current) {
      sendSignal({
        type: newEnabled ? SIGNAL_TYPES.CALL_UNMUTE : SIGNAL_TYPES.CALL_MUTE,
        callId: callIdRef.current,
      });
    }
  }, [audioEnabled, sendSignal]);

  // Переключить камеру
  const toggleVideo = useCallback(() => {
    if (!localStreamRef.current) return;
    
    const newEnabled = !videoEnabled;
    localStreamRef.current.getVideoTracks().forEach(track => {
      track.enabled = newEnabled;
    });
    setVideoEnabled(newEnabled);
  }, [videoEnabled]);

  // Cleanup при размонтировании
  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  return {
    // Состояние
    call,
    incomingCall,
    isCallActive,
    isRinging,  // Ожидание ответа (исходящий звонок)
    error,
    remoteMuted,
    
    // Медиа
    localStream,
    remoteStream,
    audioEnabled,
    videoEnabled,
    
    // Действия
    initiateCall,
    acceptCall,
    rejectCall,
    cancelCall,
    sendBusy,
    endCall,
    toggleAudio,
    toggleVideo,
    
    // Утилиты
    clearError: () => setError(null),
  };
};
