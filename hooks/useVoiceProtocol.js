import { useState, useRef, useCallback, useEffect } from 'react';
import { useStomp } from '@/context/socket';
import { safeJsonParse, safeUnsubscribe } from '@/utils/safe';
import { WebRTCPeer } from '@/utils/webrtc';

const VOICE_SIGNAL_TYPES = {
  INITIATE: 'INITIATE',
  OFFER: 'OFFER',
  ANSWER: 'ANSWER',
  READY: 'READY',
  COMPLETE: 'COMPLETE',
};

const DEFAULT_CODEC = {
  codec: 'opus',
  sampleRate: 48000,
  channels: 1,
  bitrate: 32,
};

export const useVoiceProtocol = (chatId) => {
  const { client, connected } = useStomp();
  const [sessionState, setSessionState] = useState(null);
  const [relaySessionId, setRelaySessionId] = useState(null);
  const [remoteEndpoint, setRemoteEndpoint] = useState(null);
  const [messageId, setMessageId] = useState(null);
  
  const signalSubscriptionRef = useRef(null);
  const sendingIntervalRef = useRef(null);
  const onCompleteCallbackRef = useRef(null);
  const webrtcPeerRef = useRef(null);
  const dataChannelRef = useRef(null);
  
  const isBrowser = typeof window !== 'undefined';

  const cleanup = useCallback(() => {
    if (sendingIntervalRef.current) {
      clearInterval(sendingIntervalRef.current);
      sendingIntervalRef.current = null;
    }
    if (webrtcPeerRef.current) {
      webrtcPeerRef.current.close();
      webrtcPeerRef.current = null;
    }
    dataChannelRef.current = null;
    setSessionState(null);
    setRelaySessionId(null);
    setRemoteEndpoint(null);
    setMessageId(null);
  }, []);

  const handleWebRTCOffer = useCallback(async (offerSdp) => {
    if (typeof window === 'undefined' || !window.RTCPeerConnection) {
      setSessionState('error');
      return;
    }

    try {
      const webrtc = new WebRTCPeer(chatId, (dataChannel) => {
        dataChannelRef.current = dataChannel;
        setSessionState('ready');
      }, (error) => {
        setSessionState('error');
      });

      webrtcPeerRef.current = webrtc;
      const answer = await webrtc.createAnswer(offerSdp);

      if (client && connected && client.connected && client.active) {
        client.publish({
          destination: '/app/voice.signal',
          body: JSON.stringify({
            type: VOICE_SIGNAL_TYPES.ANSWER,
            chatId: parseInt(chatId),
            sdp: answer.sdp,
            localEndpoint: answer.localEndpoint,
          }),
        });
      }
    } catch (error) {
      setSessionState('error');
    }
  }, [chatId, client, connected]);

  const handleWebRTCAnswer = useCallback(async (answerSdp) => {
    if (webrtcPeerRef.current) {
      try {
        await webrtcPeerRef.current.setRemoteAnswer(answerSdp);
        setSessionState('ready');
      } catch (error) {
        setSessionState('error');
      }
    }
  }, []);

  const handleSignalResponse = useCallback((response) => {
    if (!response?.type) return;
    if (typeof window !== 'undefined') {
      console.log('[Voice Protocol] Received signal:', response.type, { relaySessionId: response.relaySessionId, remoteEndpoint: response.remoteEndpoint, hasSdp: !!response.sdp });
    }
    switch (response.type) {
      case VOICE_SIGNAL_TYPES.OFFER:
        if (response.relaySessionId) {
          setRelaySessionId(response.relaySessionId);
          setSessionState('relay');
        } else if (response.remoteEndpoint) {
          setRemoteEndpoint(response.remoteEndpoint);
          setSessionState('p2p');
          if (response.sdp) {
            handleWebRTCOffer(response.sdp);
          }
        } else if (response.sdp) {
          handleWebRTCOffer(response.sdp);
        }
        break;
      case VOICE_SIGNAL_TYPES.ANSWER:
        if (response.relaySessionId) setRelaySessionId(response.relaySessionId);
        if (response.remoteEndpoint) setRemoteEndpoint(response.remoteEndpoint);
        if (response.sdp) {
          handleWebRTCAnswer(response.sdp);
        }
        setSessionState('ready');
        break;
      case VOICE_SIGNAL_TYPES.READY:
        setSessionState('ready');
        break;
      case VOICE_SIGNAL_TYPES.COMPLETE:
        cleanup();
        if (onCompleteCallbackRef.current) {
          onCompleteCallbackRef.current();
          onCompleteCallbackRef.current = null;
        }
        break;
    }
  }, [cleanup, handleWebRTCOffer, handleWebRTCAnswer]);

  useEffect(() => {
    if (!client || !connected || !client.connected || !client.active) {
      if (signalSubscriptionRef.current) {
        safeUnsubscribe(signalSubscriptionRef.current);
        signalSubscriptionRef.current = null;
      }
      return;
    }

    if (signalSubscriptionRef.current) {
      safeUnsubscribe(signalSubscriptionRef.current);
      signalSubscriptionRef.current = null;
    }

    try {
      const subscription = client.subscribe('/user/queue/voice-signal', (message) => {
        const response = safeJsonParse(message.body);
        if (!response) return;
        handleSignalResponse(response);
      });
      signalSubscriptionRef.current = subscription;
    } catch (e) {}

    return () => {
      if (signalSubscriptionRef.current) {
        safeUnsubscribe(signalSubscriptionRef.current);
        signalSubscriptionRef.current = null;
      }
    };
  }, [client, connected, handleSignalResponse]);

  const initiate = useCallback(async (codecParams = DEFAULT_CODEC) => {
    if (!client || !connected || !client.connected || !client.active) {
      throw new Error('WebSocket not connected');
    }

    setSessionState('initiating');
    setRelaySessionId(null);
    setRemoteEndpoint(null);

    if (typeof window !== 'undefined' && window.RTCPeerConnection) {
      try {
        const webrtc = new WebRTCPeer(chatId, (dataChannel) => {
          dataChannelRef.current = dataChannel;
        }, (error) => {
          setSessionState('error');
        });

        webrtcPeerRef.current = webrtc;
        const offer = await webrtc.createOffer();

        const payload = {
          type: VOICE_SIGNAL_TYPES.INITIATE,
          chatId: parseInt(chatId),
          sdp: offer.sdp,
          localEndpoint: offer.localEndpoint,
          ...codecParams,
        };
        if (typeof window !== 'undefined') {
          console.log('[Voice Protocol] Sending INITIATE with WebRTC SDP:', { type: payload.type, chatId: payload.chatId, hasSdp: !!payload.sdp });
        }
        client.publish({
          destination: '/app/voice.signal',
          body: JSON.stringify(payload),
        });
        return;
      } catch (error) {}
    }

    const payload = {
      type: VOICE_SIGNAL_TYPES.INITIATE,
      chatId: parseInt(chatId),
      ...codecParams,
    };
    if (typeof window !== 'undefined') {
      console.log('[Voice Protocol] Sending INITIATE without WebRTC (fallback):', { type: payload.type, chatId: payload.chatId });
    }
    client.publish({
      destination: '/app/voice.signal',
      body: JSON.stringify(payload),
    });
  }, [client, connected, chatId]);

  const createSignalPayload = useCallback((type, localEndpoint = null) => {
    const payload = {
      type,
      chatId: parseInt(chatId),
    };
    if (messageId) payload.messageId = messageId;
    if (localEndpoint) payload.localEndpoint = localEndpoint;
    if (relaySessionId) payload.relaySessionId = relaySessionId;
    return payload;
  }, [chatId, messageId, relaySessionId]);

  const sendSignal = useCallback((type, localEndpoint = null, extraFields = {}) => {
    if (!client || !connected || !client.connected || !client.active) {
      throw new Error('WebSocket not connected');
    }
    const payload = { ...createSignalPayload(type, localEndpoint), ...extraFields };
    client.publish({
      destination: '/app/voice.signal',
      body: JSON.stringify(payload),
    });
  }, [client, connected, createSignalPayload]);

  const sendOffer = useCallback(async (localEndpoint = null) => {
    if (typeof window !== 'undefined' && window.RTCPeerConnection && webrtcPeerRef.current && !localEndpoint) {
      try {
        const offer = await webrtcPeerRef.current.createOffer();
        sendSignal(VOICE_SIGNAL_TYPES.OFFER, offer.localEndpoint, {
          ...DEFAULT_CODEC,
          sdp: offer.sdp,
        });
      } catch (error) {
        sendSignal(VOICE_SIGNAL_TYPES.OFFER, localEndpoint, DEFAULT_CODEC);
      }
    } else {
      sendSignal(VOICE_SIGNAL_TYPES.OFFER, localEndpoint, DEFAULT_CODEC);
    }
  }, [sendSignal]);

  const sendAnswer = useCallback((localEndpoint = null) => {
    sendSignal(VOICE_SIGNAL_TYPES.ANSWER, localEndpoint);
  }, [sendSignal]);

  const sendReady = useCallback(() => {
    sendSignal(VOICE_SIGNAL_TYPES.READY);
  }, [sendSignal]);

  const sendComplete = useCallback(() => {
    if (!client || !connected || !client.connected || !client.active) return;
    sendSignal(VOICE_SIGNAL_TYPES.COMPLETE);
  }, [client, connected, sendSignal]);

  const convertToBase64 = useCallback((buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }, []);

  const sendAudioData = useCallback((audioData, onComplete = null) => {
    if (onComplete) onCompleteCallbackRef.current = onComplete;

    if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
      if (webrtcPeerRef.current) {
        if (typeof window !== 'undefined') {
          console.log('[Voice Protocol] Sending audio via WebRTC DataChannel');
        }
        webrtcPeerRef.current.sendAudioData(audioData);
        return;
      }
    }

    if (typeof window !== 'undefined') {
      console.log('[Voice Protocol] Sending audio via WebSocket fallback');
    }

    if (!client || !connected || !client.connected || !client.active) {
      throw new Error('WebSocket not connected');
    }

    const publishAudio = (buffer) => {
      const base64 = convertToBase64(buffer);
      client.publish({
        destination: '/app/voice.data',
        body: JSON.stringify({
          chatId: parseInt(chatId),
          sessionId: relaySessionId || 'default',
          audioData: base64,
          codec: 'opus',
        }),
      });
    };

    if (audioData instanceof ArrayBuffer) {
      publishAudio(audioData);
    } else if (audioData instanceof Blob) {
      audioData.arrayBuffer().then(publishAudio);
    }
  }, [client, connected, chatId, relaySessionId, convertToBase64]);

  const startSendingAudio = useCallback((audioChunks, onComplete = null) => {
    if (sendingIntervalRef.current) {
      clearInterval(sendingIntervalRef.current);
    }

    sendReady();

    let chunkIndex = 0;
    sendingIntervalRef.current = setInterval(() => {
      if (chunkIndex < audioChunks.length) {
        const chunk = audioChunks[chunkIndex];
        sendAudioData(chunk);
        chunkIndex++;
      } else {
        if (sendingIntervalRef.current) {
          clearInterval(sendingIntervalRef.current);
          sendingIntervalRef.current = null;
        }
        sendComplete();
        if (onComplete) {
          onComplete();
        }
      }
    }, 20);
  }, [sendReady, sendAudioData, sendComplete]);

  useEffect(() => {
    return () => {
      cleanup();
      if (signalSubscriptionRef.current) {
        safeUnsubscribe(signalSubscriptionRef.current);
        signalSubscriptionRef.current = null;
      }
    };
  }, [cleanup]);

  return {
    sessionState,
    relaySessionId,
    messageId,
    setMessageId,
    initiate,
    sendOffer,
    sendAnswer,
    sendReady,
    sendComplete,
    sendAudioData,
    startSendingAudio,
    cleanup,
  };
};

