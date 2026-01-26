import { useState, useRef, useCallback, useEffect } from 'react';
import { useStomp } from '@/context/socket';
import { safeJsonParse } from '@/utils/safe';
import { getCurrentUser } from '@/utils/api';

const SIGNAL_TYPES = {
  
  CALL_INITIATE: 'CALL_INITIATE',
  CALL_CANCEL: 'CALL_CANCEL',
  CALL_ACCEPT: 'CALL_ACCEPT',
  CALL_REJECT: 'CALL_REJECT',
  CALL_BUSY: 'CALL_BUSY',
  CALL_END: 'CALL_END',

  CALL_OFFER: 'CALL_OFFER',
  CALL_ANSWER: 'CALL_ANSWER',
  CALL_ICE_CANDIDATE: 'CALL_ICE_CANDIDATE',

  CALL_MUTE: 'CALL_MUTE',
  CALL_UNMUTE: 'CALL_UNMUTE',
};

const EVENT_TYPES = {
  INCOMING_CALL: 'INCOMING_CALL',
  CALL_ACCEPTED: 'CALL_ACCEPTED',
  CALL_REJECTED: 'CALL_REJECTED',
  CALL_CANCELLED: 'CALL_CANCELLED',
  CALL_ENDED: 'CALL_ENDED',
  CALL_BUSY: 'CALL_BUSY',
  CALL_FAILED: 'CALL_FAILED',
  CALL_MISSED: 'CALL_MISSED',

  WEBRTC_OFFER: 'WEBRTC_OFFER',
  WEBRTC_ANSWER: 'WEBRTC_ANSWER',
  WEBRTC_ICE_CANDIDATE: 'WEBRTC_ICE_CANDIDATE',

  PARTICIPANT_MUTED: 'PARTICIPANT_MUTED',
  PARTICIPANT_UNMUTED: 'PARTICIPANT_UNMUTED',
};

export const CALL_STATUS = {
  CALLING: 'CALLING',
  RINGING: 'RINGING',
  ACTIVE: 'ACTIVE',
  ENDED: 'ENDED',
};

export const CALL_TYPE = {
  AUDIO: 'AUDIO',
  VIDEO: 'VIDEO',
};

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

  const [call, setCall] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [remoteMuted, setRemoteMuted] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const [isRinging, setIsRinging] = useState(false);  
  const [error, setError] = useState(null);

  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const callIdRef = useRef(null);
  const subscriptionsRef = useRef([]);
  const iceCandidatesQueueRef = useRef([]);
  
  const currentUser = getCurrentUser();
  const myUserId = currentUser?.id;

  const sendSignal = useCallback((signal) => {
    if (isConnected && stompClient) {
      
      stompClient.publish({
        destination: '/app/call.signal',
        body: JSON.stringify(signal),
      });
    } else {
      
    }
  }, [isConnected, stompClient]);

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
        const stream = event.streams[0];
        setRemoteStream(stream);
      } else if (event.track) {

        const stream = new MediaStream([event.track]);
        
        setRemoteStream(stream);
      } else {
        
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
      
      setError('Не удалось получить доступ к камере/микрофону');
      throw err;
    }
  }, []);

  const addTracksToPC = useCallback((stream, pc) => {
    stream.getTracks().forEach(track => {
      pc.addTrack(track, stream);
    });
  }, []);

  const processIceCandidatesQueue = useCallback(async () => {
    const pc = peerConnectionRef.current;
    if (!pc || !pc.remoteDescription) return;

    while (iceCandidatesQueueRef.current.length > 0) {
      const candidate = iceCandidatesQueueRef.current.shift();
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        
      }
    }
  }, []);

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
      
      setError('Ошибка установки соединения');
    }
  }, [sendSignal]);

  const handleOffer = useCallback(async (sdp) => {
    const pc = peerConnectionRef.current;
    if (!pc) return;

    try {
      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp }));

      await processIceCandidatesQueue();

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      sendSignal({
        type: SIGNAL_TYPES.CALL_ANSWER,
        callId: callIdRef.current,
        sdp: answer.sdp,
      });
    } catch (err) {
      
      setError('Ошибка установки соединения');
    }
  }, [sendSignal, processIceCandidatesQueue]);

  const handleAnswer = useCallback(async (sdp) => {
    const pc = peerConnectionRef.current;
    if (!pc) return;

    try {
      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp }));
      
      await processIceCandidatesQueue();
    } catch (err) {
      
    }
  }, [processIceCandidatesQueue]);

  const handleIceCandidate = useCallback(async (candidateData) => {
    const pc = peerConnectionRef.current;
    
    const candidate = {
      candidate: candidateData.candidate,
      sdpMid: candidateData.sdpMid,
      sdpMLineIndex: candidateData.sdpMLineIndex,
    };

    if (!pc?.remoteDescription) {
      iceCandidatesQueueRef.current.push(candidate);
      return;
    }

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      
    }
  }, []);

  const cleanup = useCallback(() => {
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);
    setRemoteStream(null);

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

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

  const handleCallEvent = useCallback((event) => {
    // События могут содержать поля seq, timestamp, fromUserId, targetUserId
    // для логирования и отладки, но они не критичны для основной функциональности
    
    switch (event.eventType) {
      case EVENT_TYPES.INCOMING_CALL:
        setIncomingCall(event.call);
        break;

      case EVENT_TYPES.CALL_ACCEPTED:

        setCall(event.call);
        setIncomingCall(null);
        setIsRinging(false);  
        setIsCallActive(true);
        
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
        // Обновляем состояние звонка с финальными данными (durationSeconds, endReason)
        if (event.call) {
          setCall(event.call);
        }
        cleanup();
        break;

      case EVENT_TYPES.CALL_BUSY:
        setIsRinging(false);
        cleanup();
        break;

      case EVENT_TYPES.CALL_FAILED:
        setIsRinging(false);
        setError('Ошибка при звонке');
        cleanup();
        break;

      case EVENT_TYPES.CALL_MISSED:
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

  useEffect(() => {
    if (!isConnected || !stompClient) return;

    const signalSub = stompClient.subscribe('/user/queue/call-signal', (message) => {
      const response = safeJsonParse(message.body);
      if (!response) return;

      // Обработка ошибок
      if (response.success === false) {
        if (response.errorMessage) {
          setError(response.errorMessage);
        }
        // Если ошибка при инициации звонка, очищаем состояние
        if (response.type === SIGNAL_TYPES.CALL_INITIATE) {
          setIsRinging(false);
          cleanup();
        }
        return;
      }

      // Обработка успешных ответов
      if (response.success === true) {
        // Обновляем callId если он пришел отдельно
        if (response.callId && !callIdRef.current) {
          callIdRef.current = response.callId;
        }

        // Обновляем состояние звонка если пришел объект call
        if (response.call) {
          setCall(response.call);
          callIdRef.current = response.call.id;
          
          // Если звонок завершен, обновляем состояние
          if (response.call.status === CALL_STATUS.ENDED) {
            setIsCallActive(false);
            setIsRinging(false);
          }
        }
      }
    });

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

  const initiateCall = useCallback(async (targetUserId, callType = CALL_TYPE.AUDIO, chatId = null, targetUserInfo = null) => {

    if (!targetUserId) {
      
      setError('Не указан получатель звонка');
      return;
    }

    if (!isConnected || !stompClient) {
      
      setError('Нет соединения с сервером. Пожалуйста, подождите...');
      return;
    }

    try {

      const tempCall = {
        id: null,
        caller: currentUser,
        callee: targetUserInfo || { id: targetUserId },
        type: callType,
        status: CALL_STATUS.CALLING,
        chatId,
      };
      setCall(tempCall);

      setIsRinging(true);

      const stream = await startLocalStream(callType === CALL_TYPE.VIDEO);

      const pc = createPeerConnection();
      addTracksToPC(stream, pc);

      sendSignal({
        type: SIGNAL_TYPES.CALL_INITIATE,
        targetUserId,
        callType,
        chatId,
      });
      
    } catch (err) {
      
      setError(err.message || 'Ошибка при инициации звонка');
      setIsRinging(false);
      cleanup();
    }
  }, [isConnected, stompClient, currentUser, startLocalStream, createPeerConnection, addTracksToPC, sendSignal, cleanup]);

  const acceptCall = useCallback(async (callId) => {
    if (!incomingCall) return;

    try {
      callIdRef.current = callId;

      const isVideo = incomingCall.type === CALL_TYPE.VIDEO;
      const stream = await startLocalStream(isVideo);

      const pc = createPeerConnection();
      addTracksToPC(stream, pc);

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

  const rejectCall = useCallback((callId) => {
    sendSignal({
      type: SIGNAL_TYPES.CALL_REJECT,
      callId,
    });
    setIncomingCall(null);
  }, [sendSignal]);

  const cancelCall = useCallback(() => {
    if (callIdRef.current) {
      sendSignal({
        type: SIGNAL_TYPES.CALL_CANCEL,
        callId: callIdRef.current,
      });
    }
    cleanup();
  }, [sendSignal, cleanup]);

  const sendBusy = useCallback((callId) => {
    sendSignal({
      type: SIGNAL_TYPES.CALL_BUSY,
      callId,
    });
    setIncomingCall(null);
  }, [sendSignal]);

  const endCall = useCallback(() => {
    if (callIdRef.current) {
      sendSignal({
        type: SIGNAL_TYPES.CALL_END,
        callId: callIdRef.current,
      });
    }
    cleanup();
  }, [sendSignal, cleanup]);

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

  const toggleVideo = useCallback(() => {
    if (!localStreamRef.current) return;
    
    const newEnabled = !videoEnabled;
    localStreamRef.current.getVideoTracks().forEach(track => {
      track.enabled = newEnabled;
    });
    setVideoEnabled(newEnabled);
  }, [videoEnabled]);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  return {
    
    call,
    incomingCall,
    isCallActive,
    isRinging,  
    error,
    remoteMuted,

    localStream,
    remoteStream,
    audioEnabled,
    videoEnabled,

    initiateCall,
    acceptCall,
    rejectCall,
    cancelCall,
    sendBusy,
    endCall,
    toggleAudio,
    toggleVideo,

    clearError: () => setError(null),
  };
};
