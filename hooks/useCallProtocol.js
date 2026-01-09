import { useState, useRef, useCallback, useEffect } from 'react';
import { useStomp } from '@/context/socket';
import { safeJsonParse, safeUnsubscribe } from '@/utils/safe';
import { callAPI } from '@/utils/api';

const CALL_SIGNAL_TYPES = {
  CALL_OFFER: 'CALL_OFFER',
  CALL_ANSWER: 'CALL_ANSWER',
  CALL_ICE_CANDIDATE: 'CALL_ICE_CANDIDATE',
  CALL_MUTE_AUDIO: 'CALL_MUTE_AUDIO',
  CALL_UNMUTE_AUDIO: 'CALL_UNMUTE_AUDIO',
  CALL_MUTE_VIDEO: 'CALL_MUTE_VIDEO',
  CALL_UNMUTE_VIDEO: 'CALL_UNMUTE_VIDEO',
};

const CALL_EVENT_TYPES = {
  CALL_STARTED: 'CALL_STARTED',
  CALL_JOINED: 'CALL_JOINED',
  CALL_LEFT: 'CALL_LEFT',
  CALL_ENDED: 'CALL_ENDED',
  CALL_PARTICIPANT_UPDATED: 'CALL_PARTICIPANT_UPDATED',
};

const STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
];

export const useCallProtocol = (callId = null) => {
  const isBrowser = typeof window !== 'undefined';
  
  const { client, connected } = useStomp();
  const [call, setCall] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState(new Map());
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [isInCall, setIsInCall] = useState(false);
  const [error, setError] = useState(null);
  
  const peerConnectionsRef = useRef(new Map());
  const callEventSubscriptionRef = useRef(null);
  const callSignalSubscriptionRef = useRef(null);
  const userSignalSubscriptionRef = useRef(null);
  const localStreamRef = useRef(null);
  const callIdRef = useRef(callId);

  useEffect(() => {
    callIdRef.current = callId;
  }, [callId]);

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
    setIsInCall(false);
    setCall(null);
    setParticipants([]);
    setError(null);
    
    safeUnsubscribe(callEventSubscriptionRef);
    safeUnsubscribe(callSignalSubscriptionRef);
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
      if (event.candidate && client && connected && callIdRef.current) {
        client.publish({
          destination: '/app/call.signal',
          body: JSON.stringify({
            type: CALL_SIGNAL_TYPES.CALL_ICE_CANDIDATE,
            callId: callIdRef.current,
            iceCandidate: event.candidate.candidate,
            iceCandidateSdpMid: event.candidate.sdpMid,
            iceCandidateSdpMLineIndex: event.candidate.sdpMLineIndex,
          }),
        });
      }
    };

    pc.ontrack = (event) => {
      const stream = event.streams[0];
      setRemoteStreams(prev => {
        const newMap = new Map(prev);
        newMap.set(userId, stream);
        return newMap;
      });
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        pc.close();
        peerConnectionsRef.current.delete(userId);
      }
    };

    return pc;
  }, [client, connected]);

  const handleCallSignal = useCallback((message) => {
    const signal = safeJsonParse(message.body);
    if (!signal || !callIdRef.current || signal.callId !== callIdRef.current) return;

    const userId = signal.userId || signal.fromUserId;

    switch (signal.type) {
      case CALL_SIGNAL_TYPES.CALL_OFFER:
        handleOffer(signal, userId);
        break;
      case CALL_SIGNAL_TYPES.CALL_ANSWER:
        handleAnswer(signal, userId);
        break;
      case CALL_SIGNAL_TYPES.CALL_ICE_CANDIDATE:
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

      if (client && connected && callIdRef.current) {
        client.publish({
          destination: '/app/call.signal',
          body: JSON.stringify({
            type: CALL_SIGNAL_TYPES.CALL_ANSWER,
            callId: callIdRef.current,
            sdp: answer.sdp,
          }),
        });
      }

      peerConnectionsRef.current.set(userId, pc);
    } catch (error) {
      pc.close();
    }
  }, [createPeerConnection, client, connected]);

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

      if (client && connected && callIdRef.current) {
        client.publish({
          destination: '/app/call.signal',
          body: JSON.stringify({
            type: CALL_SIGNAL_TYPES.CALL_OFFER,
            callId: callIdRef.current,
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

  const handleCallEvent = useCallback((message) => {
    const event = safeJsonParse(message.body);
    if (!event || !callIdRef.current || event.call?.id !== callIdRef.current) return;

    switch (event.eventType) {
      case CALL_EVENT_TYPES.CALL_STARTED:
        setCall(event.call);
        setParticipants(event.call.participants || []);
        break;
      case CALL_EVENT_TYPES.CALL_JOINED:
        setParticipants(prev => {
          const newParticipants = [...prev];
          if (event.participant && !newParticipants.find(p => p.id === event.participant.id)) {
            newParticipants.push(event.participant);
            const currentUser = JSON.parse(localStorage.getItem('user'));
            if (event.participant.userId !== currentUser?.id && isInCall) {
              setTimeout(() => sendOffer(event.participant.userId), 100);
            }
          }
          return newParticipants;
        });
        break;
      case CALL_EVENT_TYPES.CALL_LEFT:
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
      case CALL_EVENT_TYPES.CALL_ENDED:
        cleanup();
        break;
      case CALL_EVENT_TYPES.CALL_PARTICIPANT_UPDATED:
        setParticipants(prev => prev.map(p => 
          p.id === event.participant.id ? event.participant : p
        ));
        break;
      default:
        break;
    }
  }, [cleanup, isInCall, sendOffer]);

  const subscribeToCallEvents = useCallback(() => {
    if (!client || !connected || !callIdRef.current) return;

    const eventTopic = `/topic/call/${callIdRef.current}`;
    const signalTopic = `/topic/call/${callIdRef.current}/signal`;

    callEventSubscriptionRef.current = client.subscribe(eventTopic, handleCallEvent);
    callSignalSubscriptionRef.current = client.subscribe(signalTopic, handleCallSignal);
    userSignalSubscriptionRef.current = client.subscribe('/user/queue/call-signal', handleCallSignal);
  }, [client, connected, handleCallEvent, handleCallSignal]);

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
      
      if (callIdRef.current) {
        await callAPI.updateMediaState(callIdRef.current, newAudioEnabled, videoEnabled);
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
      
      if (callIdRef.current) {
        await callAPI.updateMediaState(callIdRef.current, audioEnabled, newVideoEnabled);
      }
    }
  }, [audioEnabled, videoEnabled]);

  const createCall = useCallback(async (chatId, type, targetUserId = null) => {
    try {
      setError(null);
      const newCall = await callAPI.createCall(chatId, type, targetUserId);
      setCall(newCall);
      callIdRef.current = newCall.id;
      subscribeToCallEvents();
      return newCall;
    } catch (error) {
      const errorMessage = error.message || 'Ошибка при создании звонка';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [subscribeToCallEvents]);

  const joinCall = useCallback(async (callIdToJoin) => {
    try {
      setError(null);
      const callData = await callAPI.joinCall(callIdToJoin);
      callIdRef.current = callIdToJoin;
      setCall(callData);
      setParticipants(callData.participants || []);
      setIsInCall(true);
      subscribeToCallEvents();
      
      try {
        await startLocalStream(true, true);
      } catch (streamError) {
        setError(streamError.message);
        throw streamError;
      }
      
      if (callData.participants && callData.participants.length > 0) {
        const currentUser = JSON.parse(localStorage.getItem('user'));
        callData.participants.forEach(participant => {
          if (participant.userId !== currentUser?.id) {
            sendOffer(participant.userId);
          }
        });
      }
    } catch (error) {
      setError(error.message || 'Ошибка при присоединении к звонку');
      throw error;
    }
  }, [subscribeToCallEvents, startLocalStream, sendOffer]);

  const leaveCall = useCallback(async () => {
    if (callIdRef.current) {
      try {
        await callAPI.leaveCall(callIdRef.current);
      } catch (error) {
      }
    }
    cleanup();
  }, [cleanup]);

  const endCall = useCallback(async () => {
    if (callIdRef.current) {
      try {
        await callAPI.endCall(callIdRef.current);
      } catch (error) {
      }
    }
    cleanup();
  }, [cleanup]);

  useEffect(() => {
    if (connected && callIdRef.current) {
      subscribeToCallEvents();
    }

    return () => {
      cleanup();
    };
  }, [connected, subscribeToCallEvents, cleanup]);

  return {
    call,
    participants,
    localStream,
    remoteStreams,
    audioEnabled,
    videoEnabled,
    isInCall,
    error,
    createCall,
    joinCall,
    leaveCall,
    endCall,
    startLocalStream,
    stopLocalStream,
    toggleAudio,
    toggleVideo,
    sendOffer,
    clearError: () => setError(null),
  };
};

