import { useState, useRef, useCallback, useEffect } from 'react';
import { useStomp } from '@/context/socket';
import { safeJsonParse, safeUnsubscribe } from '@/utils/safe';
import { turnAPI } from '@/utils/api';

const SIGNAL_TYPES = {
  ROOM_CREATE: 'ROOM_CREATE',
  ROOM_JOIN: 'ROOM_JOIN',
  ROOM_LEAVE: 'ROOM_LEAVE',
  ROOM_END: 'ROOM_END',

  ROOM_OFFER: 'ROOM_OFFER',
  ROOM_ANSWER: 'ROOM_ANSWER',
  ROOM_ICE_CANDIDATE: 'ROOM_ICE_CANDIDATE',

  ROOM_MUTE_AUDIO: 'ROOM_MUTE_AUDIO',
  ROOM_UNMUTE_AUDIO: 'ROOM_UNMUTE_AUDIO',
  ROOM_MUTE_VIDEO: 'ROOM_MUTE_VIDEO',
  ROOM_UNMUTE_VIDEO: 'ROOM_UNMUTE_VIDEO',

  ROOM_RAISE_HAND: 'ROOM_RAISE_HAND',
  ROOM_LOWER_HAND: 'ROOM_LOWER_HAND',
  ROOM_START_SCREEN_SHARE: 'ROOM_START_SCREEN_SHARE',
  ROOM_STOP_SCREEN_SHARE: 'ROOM_STOP_SCREEN_SHARE',

  ROOM_PROMOTE_CO_HOST: 'ROOM_PROMOTE_CO_HOST',
  ROOM_DEMOTE_TO_PARTICIPANT: 'ROOM_DEMOTE_TO_PARTICIPANT',
  ROOM_MUTE_PARTICIPANT: 'ROOM_MUTE_PARTICIPANT',
  ROOM_KICK_PARTICIPANT: 'ROOM_KICK_PARTICIPANT',
};

const EVENT_TYPES = {
  ROOM_CREATED: 'ROOM_CREATED',
  ROOM_STARTED: 'ROOM_STARTED',
  ROOM_JOINED: 'ROOM_JOINED',
  ROOM_LEFT: 'ROOM_LEFT',
  ROOM_ENDED: 'ROOM_ENDED',

  PARTICIPANT_AUDIO_CHANGED: 'PARTICIPANT_AUDIO_CHANGED',
  PARTICIPANT_VIDEO_CHANGED: 'PARTICIPANT_VIDEO_CHANGED',
  PARTICIPANT_HAND_RAISED: 'PARTICIPANT_HAND_RAISED',
  PARTICIPANT_HAND_LOWERED: 'PARTICIPANT_HAND_LOWERED',
  PARTICIPANT_SCREEN_SHARE_STARTED: 'PARTICIPANT_SCREEN_SHARE_STARTED',
  PARTICIPANT_SCREEN_SHARE_STOPPED: 'PARTICIPANT_SCREEN_SHARE_STOPPED',

  PARTICIPANT_PROMOTED: 'PARTICIPANT_PROMOTED',
  PARTICIPANT_DEMOTED: 'PARTICIPANT_DEMOTED',
  PARTICIPANT_MUTED_BY_HOST: 'PARTICIPANT_MUTED_BY_HOST',
  PARTICIPANT_KICKED: 'PARTICIPANT_KICKED',

  WEBRTC_OFFER: 'WEBRTC_OFFER',
  WEBRTC_ANSWER: 'WEBRTC_ANSWER',
  WEBRTC_ICE_CANDIDATE: 'WEBRTC_ICE_CANDIDATE',
};

export const ROOM_STATUS = {
  WAITING: 'WAITING',
  ACTIVE: 'ACTIVE',
  ENDED: 'ENDED',
};

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

  const [room, setRoom] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [isInRoom, setIsInRoom] = useState(false);
  const [error, setError] = useState(null);

  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState(new Map());
  const [screenStream, setScreenStream] = useState(null);

  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [handRaised, setHandRaised] = useState(false);

  const [myRole, setMyRole] = useState(PARTICIPANT_ROLE.PARTICIPANT);
  const [devices, setDevices] = useState({ cameras: [], microphones: [] });
  const [selectedCamera, setSelectedCamera] = useState('');
  const [selectedMicrophone, setSelectedMicrophone] = useState('');

  const peerConnectionsRef = useRef(new Map());
  const roomSubscriptionRef = useRef(null);
  const userQueueSubscriptionRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const roomIdRef = useRef(initialRoomId);
  const pendingCallbacksRef = useRef(new Map());
  const negotiationTimeoutRef = useRef(new Set());
  const connectedRef = useRef(connected);
  const turnCredentialsRef = useRef(null);

  const lastSeqRef = useRef(0);
  const eventQueueRef = useRef([]);
  const isRecoveringRef = useRef(false);

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

  useEffect(() => {
    roomIdRef.current = initialRoomId;
  }, [initialRoomId]);

  useEffect(() => {
    connectedRef.current = connected;
  }, [connected]);

  const sendSignal = useCallback(
    (signal, callback) => {
      if (!client || !connected) {
        return;
      }

      const signalId = Date.now().toString();
      if (callback) {
        pendingCallbacksRef.current.set(signalId, callback);
      }

      client.publish({
        destination: '/app/room.signal',
        body: JSON.stringify({ ...signal, signalId }),
      });
    },
    [client, connected]
  );

  const createPeerConnection = useCallback(
    async (userId) => {
      if (!isBrowser || !window.RTCPeerConnection) return null;

      const existingPc = peerConnectionsRef.current.get(userId);
      if (existingPc) {
        existingPc.close();
      }

      // Получить TURN credentials если еще не получены
      if (!turnCredentialsRef.current) {
        try {
          const turnCreds = await turnAPI.getCredentials();
          turnCredentialsRef.current = turnCreds;
        } catch (error) {
          console.warn('Failed to get TURN credentials, using STUN only:', error);
        }
      }

      // Построить конфигурацию ICE серверов
      const iceServers = [...STUN_SERVERS];

      if (turnCredentialsRef.current) {
        iceServers.push({
          urls: turnCredentialsRef.current.urls,
          username: turnCredentialsRef.current.username,
          credential: turnCredentialsRef.current.credential,
        });
      }

      const pc = new RTCPeerConnection({ iceServers });

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current);
        });
      }

      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, screenStreamRef.current);
        });
      }

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

      pc.onnegotiationneeded = async () => {
        if (pc.signalingState !== 'stable' && pc.signalingState !== 'have-local-offer') {
          return;
        }

        const negotiationTimeout = `negotiation_${userId}`;
        if (negotiationTimeoutRef.current?.has(negotiationTimeout)) {
          return;
        }
        negotiationTimeoutRef.current?.add(negotiationTimeout);

        try {
          await new Promise((resolve) => setTimeout(resolve, 50));

          if (pc.signalingState === 'stable' || pc.signalingState === 'have-local-offer') {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            sendSignal({
              type: SIGNAL_TYPES.ROOM_OFFER,
              roomId: roomIdRef.current,
              targetUserId: userId,
              sdp: offer.sdp,
            });
          }
        } catch (err) {
        } finally {
          setTimeout(() => {
            negotiationTimeoutRef.current?.delete(negotiationTimeout);
          }, 200);
        }
      };

      pc.ontrack = (event) => {
        const stream = event.streams[0];
        if (stream) {
          setRemoteStreams((prev) => {
            const newMap = new Map(prev);
            const existingStream = newMap.get(userId);

            if (existingStream) {
              const existingTrackIds = new Set(
                Array.from(existingStream.getTracks())
                  .filter((t) => t.readyState === 'live')
                  .map((t) => t.id)
              );
              const newTrackIds = new Set(
                Array.from(stream.getTracks())
                  .filter((t) => t.readyState === 'live')
                  .map((t) => t.id)
              );

              const tracksChanged =
                existingTrackIds.size !== newTrackIds.size ||
                Array.from(newTrackIds).some((id) => !existingTrackIds.has(id));

              if (tracksChanged) {
                const combinedStream = new MediaStream();

                existingStream.getTracks().forEach((track) => {
                  if (track.readyState === 'live') {
                    combinedStream.addTrack(track);
                  }
                });

                stream.getTracks().forEach((track) => {
                  if (track.readyState === 'live') {
                    const existingTrack = Array.from(combinedStream.getTracks()).find(
                      (t) => t.kind === track.kind && t.id === track.id
                    );
                    if (!existingTrack) {
                      combinedStream.addTrack(track);
                    } else {
                      const isScreenShareTrack =
                        track.label?.toLowerCase().includes('screen') ||
                        track.label?.toLowerCase().includes('display');
                      if (isScreenShareTrack) {
                        const oldTrack = Array.from(combinedStream.getTracks()).find(
                          (t) => t.kind === track.kind && t.id === track.id
                        );
                        if (oldTrack) {
                          combinedStream.removeTrack(oldTrack);
                        }
                        combinedStream.addTrack(track);
                      }
                    }
                  }
                });

                newMap.set(userId, combinedStream);
              }
            } else {
              newMap.set(userId, stream);
            }

            return newMap;
          });
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          pc.close();
          peerConnectionsRef.current.delete(userId);
          setRemoteStreams((prev) => {
            const newMap = new Map(prev);
            newMap.delete(userId);
            return newMap;
          });
        }
      };

      peerConnectionsRef.current.set(userId, pc);
      return pc;
    },
    [isBrowser, sendSignal]
  );

  const sendOffer = useCallback(
    async (userId) => {
      const pc = await createPeerConnection(userId);
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
        pc.close();
        peerConnectionsRef.current.delete(userId);
      }
    },
    [createPeerConnection, sendSignal]
  );

  const handleOffer = useCallback(
    async (fromUserId, sdp) => {
      const pc = await createPeerConnection(fromUserId);
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
        pc.close();
        peerConnectionsRef.current.delete(fromUserId);
      }
    },
    [createPeerConnection, sendSignal]
  );

  const handleAnswer = useCallback(async (fromUserId, sdp) => {
    const pc = peerConnectionsRef.current.get(fromUserId);
    if (!pc) return;

    try {
      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp }));
    } catch (err) {}
  }, []);

  const handleIceCandidate = useCallback(async (fromUserId, candidate) => {
    const pc = peerConnectionsRef.current.get(fromUserId);
    if (!pc) return;

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {}
  }, []);

  const closePeerConnection = useCallback((userId) => {
    const pc = peerConnectionsRef.current.get(userId);
    if (pc) {
      pc.close();
      peerConnectionsRef.current.delete(userId);
    }
    setRemoteStreams((prev) => {
      const newMap = new Map(prev);
      newMap.delete(userId);
      return newMap;
    });
  }, []);

  const processEventRef = useRef(null);
  const cleanupRef = useRef(null);

  const eventQueueMapRef = useRef(new Map());

  const requestRoomState = useCallback(() => {
    if (!client || !connected || !roomIdRef.current || isRecoveringRef.current) return;

    isRecoveringRef.current = true;
    sendSignal(
      {
        type: 'ROOM_GET_STATE',
        roomId: roomIdRef.current,
      },
      (response) => {
        isRecoveringRef.current = false;
        if (response.room) {
          setRoom(response.room);
          setParticipants(response.room.participants || []);
          lastSeqRef.current = response.seq || 0;

          const myParticipant = response.room.participants?.find((p) => p.user?.id === myUserId);
          if (myParticipant) {
            setIsInRoom(true);
          }

          while (eventQueueMapRef.current.has(lastSeqRef.current + 1)) {
            const nextEvent = eventQueueMapRef.current.get(lastSeqRef.current + 1);
            eventQueueMapRef.current.delete(lastSeqRef.current + 1);
            if (processEventRef.current) {
              processEventRef.current(nextEvent);
            }
            lastSeqRef.current++;
          }
        }
      }
    );
  }, [client, connected, sendSignal, myUserId]);

  const processEvent = useCallback(
    (event) => {
      const eventRoomId = event.room?.roomId || event.roomId;
      if (roomIdRef.current && eventRoomId && eventRoomId !== roomIdRef.current) return;

      const eventUserId = event.fromUserId || event.userId;

      switch (event.eventType) {
        case EVENT_TYPES.ROOM_CREATED:
        case EVENT_TYPES.ROOM_STARTED:
          setRoom(event.room);
          setParticipants(event.room?.participants || []);

          const myParticipantInRoom = event.room?.participants?.find(
            (p) => p.user?.id === myUserId
          );
          if (myParticipantInRoom && !isInRoom) {
            setIsInRoom(true);
          }
          break;

        case EVENT_TYPES.ROOM_JOINED:
          const joinedUserId = event.participant?.user?.id || event.fromUserId;

          if (joinedUserId === myUserId || !isInRoom) {
            setIsInRoom(true);

            setTimeout(() => {
              setIsInRoom(true);
            }, 0);
          }

          if (event.room) {
            setRoom(event.room);
          }

          if (event.participant) {
            setParticipants((prev) => {
              const existingIdx = prev.findIndex((p) => p.user?.id === event.participant.user?.id);
              if (existingIdx >= 0) {
                const updated = [...prev];
                updated[existingIdx] = event.participant;
                return updated;
              }
              return [...prev, event.participant];
            });

            const newUserId = event.participant.user?.id || eventUserId;
            if (newUserId && newUserId !== myUserId && isInRoom) {
              requestAnimationFrame(() => {
                sendOffer(newUserId);
              });
            }
          }
          break;

        case EVENT_TYPES.ROOM_LEFT:
          const leftUserId = eventUserId || event.participant?.user?.id;
          if (leftUserId) {
            setParticipants((prev) => prev.filter((p) => p.user?.id !== leftUserId));
            closePeerConnection(leftUserId);
          }

          if (event.room) {
            setRoom(event.room);
          }
          break;

        case EVENT_TYPES.ROOM_ENDED:
          if (cleanupRef.current) cleanupRef.current();
          break;

        case EVENT_TYPES.PARTICIPANT_AUDIO_CHANGED:
          if (event.participant) {
            setParticipants((prev) =>
              prev.map((p) => (p.user?.id === eventUserId ? { ...p, ...event.participant } : p))
            );
          } else {
            setParticipants((prev) =>
              prev.map((p) =>
                p.user?.id === eventUserId ? { ...p, audioEnabled: event.enabled } : p
              )
            );
          }
          break;

        case EVENT_TYPES.PARTICIPANT_VIDEO_CHANGED:
          if (event.participant) {
            setParticipants((prev) =>
              prev.map((p) => (p.user?.id === eventUserId ? { ...p, ...event.participant } : p))
            );
          } else {
            setParticipants((prev) =>
              prev.map((p) =>
                p.user?.id === eventUserId ? { ...p, videoEnabled: event.enabled } : p
              )
            );
          }
          break;

        case EVENT_TYPES.PARTICIPANT_HAND_RAISED:
          if (event.participant) {
            setParticipants((prev) =>
              prev.map((p) => (p.user?.id === eventUserId ? { ...p, ...event.participant } : p))
            );
          } else {
            setParticipants((prev) =>
              prev.map((p) => (p.user?.id === eventUserId ? { ...p, handRaised: true } : p))
            );
          }
          if (eventUserId === myUserId) setHandRaised(true);
          break;

        case EVENT_TYPES.PARTICIPANT_HAND_LOWERED:
          if (event.participant) {
            setParticipants((prev) =>
              prev.map((p) => (p.user?.id === eventUserId ? { ...p, ...event.participant } : p))
            );
          } else {
            setParticipants((prev) =>
              prev.map((p) => (p.user?.id === eventUserId ? { ...p, handRaised: false } : p))
            );
          }
          if (eventUserId === myUserId) setHandRaised(false);
          break;

        case EVENT_TYPES.PARTICIPANT_SCREEN_SHARE_STARTED:
          if (event.participant) {
            setParticipants((prev) =>
              prev.map((p) => (p.user?.id === eventUserId ? { ...p, ...event.participant } : p))
            );
          } else {
            setParticipants((prev) =>
              prev.map((p) => (p.user?.id === eventUserId ? { ...p, screenSharing: true } : p))
            );
          }
          if (eventUserId === myUserId) setIsScreenSharing(true);
          break;

        case EVENT_TYPES.PARTICIPANT_SCREEN_SHARE_STOPPED:
          if (event.participant) {
            setParticipants((prev) =>
              prev.map((p) => (p.user?.id === eventUserId ? { ...p, ...event.participant } : p))
            );
          } else {
            setParticipants((prev) =>
              prev.map((p) => (p.user?.id === eventUserId ? { ...p, screenSharing: false } : p))
            );
          }
          if (eventUserId === myUserId) setIsScreenSharing(false);
          break;

        case EVENT_TYPES.PARTICIPANT_PROMOTED:
          if (event.participant) {
            setParticipants((prev) =>
              prev.map((p) =>
                p.user?.id === event.targetUserId ? { ...p, ...event.participant } : p
              )
            );
          } else {
            setParticipants((prev) =>
              prev.map((p) =>
                p.user?.id === event.targetUserId ? { ...p, role: PARTICIPANT_ROLE.CO_HOST } : p
              )
            );
          }
          if (event.targetUserId === myUserId) setMyRole(PARTICIPANT_ROLE.CO_HOST);
          break;

        case EVENT_TYPES.PARTICIPANT_DEMOTED:
          if (event.participant) {
            setParticipants((prev) =>
              prev.map((p) =>
                p.user?.id === event.targetUserId ? { ...p, ...event.participant } : p
              )
            );
          } else {
            setParticipants((prev) =>
              prev.map((p) =>
                p.user?.id === event.targetUserId ? { ...p, role: PARTICIPANT_ROLE.PARTICIPANT } : p
              )
            );
          }
          if (event.targetUserId === myUserId) setMyRole(PARTICIPANT_ROLE.PARTICIPANT);
          break;

        case EVENT_TYPES.PARTICIPANT_MUTED_BY_HOST:
          if (event.targetUserId === myUserId && localStreamRef.current) {
            localStreamRef.current.getAudioTracks().forEach((track) => {
              track.enabled = false;
            });
            setAudioEnabled(false);
          }
          if (event.participant) {
            setParticipants((prev) =>
              prev.map((p) =>
                p.user?.id === event.targetUserId ? { ...p, ...event.participant } : p
              )
            );
          } else {
            setParticipants((prev) =>
              prev.map((p) =>
                p.user?.id === event.targetUserId ? { ...p, audioEnabled: false } : p
              )
            );
          }
          break;

        case EVENT_TYPES.PARTICIPANT_KICKED:
          if (event.targetUserId === myUserId) {
            if (cleanupRef.current) cleanupRef.current();
            setError('Вас удалили из комнаты');
          } else {
            setParticipants((prev) => prev.filter((p) => p.user?.id !== event.targetUserId));
            closePeerConnection(event.targetUserId);
          }
          break;

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
    },
    [
      myUserId,
      isInRoom,
      sendOffer,
      closePeerConnection,
      handleOffer,
      handleAnswer,
      handleIceCandidate,
    ]
  );

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

  const handleRoomEvent = useCallback(
    (message) => {
      const event = safeJsonParse(message.body);
      if (!event) return;

      const eventRoomId = event.room?.roomId || event.roomId;
      if (roomIdRef.current && eventRoomId && eventRoomId !== roomIdRef.current) return;

      const eventSeq = event.seq;
      if (eventSeq) {
        if (eventSeq === lastSeqRef.current + 1) {
          processEvent(event);
          lastSeqRef.current = eventSeq;

          processQueuedEvents();
        } else if (eventSeq > lastSeqRef.current + 1) {
          eventQueueMapRef.current.set(eventSeq, event);
          requestRoomState();
        }
      } else {
        processEvent(event);
      }
    },
    [processEvent, requestRoomState, processQueuedEvents]
  );

  const handleUserQueueMessage = useCallback(
    (message) => {
      const response = safeJsonParse(message.body);
      if (!response) return;

      if (response.signalId && pendingCallbacksRef.current.has(response.signalId)) {
        const callback = pendingCallbacksRef.current.get(response.signalId);
        pendingCallbacksRef.current.delete(response.signalId);
        callback(response);
      }

      if (response.success === false && response.errorMessage) {
        setError(response.errorMessage);
        return;
      }

      if (response.room) {
        setRoom(response.room);
        setParticipants(response.room.participants || []);

        const myParticipant = response.room.participants?.find((p) => p.user?.id === myUserId);
        if (myParticipant) {
          setIsInRoom(true);
          setMyRole(myParticipant.role || PARTICIPANT_ROLE.PARTICIPANT);
          setHandRaised(myParticipant.handRaised || false);
          setIsScreenSharing(myParticipant.screenSharing || false);
        }
      }
    },
    [myUserId]
  );

  const cleanup = useCallback(() => {
    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }

    safeUnsubscribe(roomSubscriptionRef);
    safeUnsubscribe(userQueueSubscriptionRef);

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

    lastSeqRef.current = 0;
    eventQueueRef.current = [];
    eventQueueMapRef.current.clear();
    isRecoveringRef.current = false;
  }, []);

  useEffect(() => {
    cleanupRef.current = cleanup;
  }, [cleanup]);

  useEffect(() => {
    processEventRef.current = processEvent;
  }, [processEvent]);

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

  const subscribeToRoom = useCallback(
    (roomId) => {
      if (!client || !connected || !roomId) {
        return;
      }

      if (roomSubscriptionRef.current) {
        safeUnsubscribe(roomSubscriptionRef);
      }

      const topic = `/topic/room/${roomId}`;

      roomSubscriptionRef.current = client.subscribe(topic, handleRoomEvent);

      ensureUserQueueSubscription();
    },
    [client, connected, handleRoomEvent, ensureUserQueueSubscription]
  );

  const startLocalStream = useCallback(
    async (audio = true, video = true) => {
      if (!isBrowser || !navigator.mediaDevices) {
        throw new Error('Медиа устройства недоступны');
      }

      try {
        const constraints = {
          audio: audio
            ? {
                deviceId: selectedMicrophone ? { exact: selectedMicrophone } : undefined,
                echoCancellation: true,
                noiseSuppression: true,
              }
            : false,
          video: video
            ? {
                deviceId: selectedCamera ? { exact: selectedCamera } : undefined,
                width: { ideal: 1280 },
                height: { ideal: 720 },
              }
            : false,
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);

        localStreamRef.current = stream;
        setLocalStream(stream);
        setAudioEnabled(audio);
        setVideoEnabled(video);

        peerConnectionsRef.current.forEach((pc) => {
          stream.getTracks().forEach((track) => {
            pc.addTrack(track, stream);
          });
        });

        return stream;
      } catch (err) {
        return null;
      }
    },
    [isBrowser]
  );

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

  const joinRoom = useCallback(
    async (roomId, requestMedia = true, initialAudio = true, initialVideo = true) => {
      const startTime = Date.now();
      let websocketSubscriptionEstablished = false;

      try {
        lastSeqRef.current = 0;
        eventQueueRef.current = [];
        eventQueueMapRef.current.clear();
        roomIdRef.current = roomId;

        if (!client) {
          const clientWaitStartTime = Date.now();
          const maxClientWaitTime = 10000;
          await new Promise((resolve, reject) => {
            const checkClientInterval = setInterval(() => {
              if (client) {
                clearInterval(checkClientInterval);
                resolve();
              } else if (Date.now() - clientWaitStartTime >= maxClientWaitTime) {
                clearInterval(checkClientInterval);
                resolve();
              }
            }, 100);
          });
        }

        if (!client) {
        }

        if (!connected && client) {
          const waitStartTime = Date.now();
          const maxWaitTime = 15000;

          await new Promise((resolve, reject) => {
            const checkInterval = setInterval(() => {
              if (connectedRef.current) {
                clearInterval(checkInterval);
                resolve();
              } else if (Date.now() - waitStartTime >= maxWaitTime) {
                clearInterval(checkInterval);
                resolve();
              }
            }, 100);
          });
        } else if (!client) {
        }

        if (client) {
          ensureUserQueueSubscription();

          subscribeToRoom(roomId);

          websocketSubscriptionEstablished = true;
        } else {
        }

        const beforeSetInRoom = Date.now();
        setIsInRoom(true);

        setTimeout(() => {
          setIsInRoom(true);
        }, 0);

        const { roomAPI } = await import('@/utils/api');

        const shouldRequestMedia = requestMedia && (initialAudio || initialVideo);

        const finalAudio = requestMedia && !initialAudio && !initialVideo ? true : initialAudio;
        const finalVideo = requestMedia && !initialAudio && !initialVideo ? false : initialVideo;

        const apiStartTime = Date.now();
        const [roomData, mediaResult] = await Promise.allSettled([
          (async () => {
            const result = await roomAPI.joinRoom(roomId);
            return result;
          })(),
          requestMedia && (finalAudio || finalVideo)
            ? (async () => {
                try {
                  const stream = await startLocalStream(finalAudio, finalVideo);
                  return stream;
                } catch (err) {
                  return null;
                }
              })()
            : (() => {
                return Promise.resolve(null);
              })(),
        ]);

        if (roomData.status === 'fulfilled' && roomData.value) {
          const roomDataValue = roomData.value;

          setRoom(roomDataValue);

          setParticipants((prev) => {
            if (prev.length === 0 && roomDataValue.participants) {
              return roomDataValue.participants;
            }

            return prev;
          });

          const myParticipant = roomDataValue.participants?.find((p) => p.user?.id === myUserId);
          if (myParticipant) {
            setMyRole(myParticipant.role || PARTICIPANT_ROLE.PARTICIPANT);
          }

          const otherParticipants =
            roomDataValue.participants?.filter(
              (p) => p.user?.id !== myUserId && p.isActive !== false
            ) || [];

          otherParticipants.forEach((p) => {
            requestAnimationFrame(() => {
              sendOffer(p.user.id);
            });
          });

          setIsInRoom(true);

          return roomDataValue;
        } else if (roomData.status === 'rejected') {
          const errorMsg = roomData.reason?.message || 'Не удалось получить данные комнаты';

          setIsInRoom(true);
        } else {
          setIsInRoom(true);
        }

        setIsInRoom(true);
        return null;
      } catch (err) {
        if (!websocketSubscriptionEstablished) {
          setIsInRoom(false);
        } else {
          setIsInRoom(true);
        }

        throw err;
      }
    },
    [
      subscribeToRoom,
      myUserId,
      sendOffer,
      startLocalStream,
      ensureUserQueueSubscription,
      client,
      connected,
    ]
  );

  const leaveRoom = useCallback(async () => {
    if (roomIdRef.current) {
      try {
        const { roomAPI } = await import('@/utils/api');
        await roomAPI.leaveRoom(roomIdRef.current);
      } catch (err) {}
    }
    cleanup();
  }, [cleanup]);

  const endRoom = useCallback(async () => {
    if (roomIdRef.current) {
      try {
        const { roomAPI } = await import('@/utils/api');
        await roomAPI.endRoom(roomIdRef.current);
      } catch (err) {}
    }
    cleanup();
  }, [cleanup]);

  const toggleAudio = useCallback(async () => {
    const newEnabled = !audioEnabled;

    if (!localStreamRef.current && newEnabled) {
      try {
        const stream = await startLocalStream(true, videoEnabled);
        if (stream) {
          setAudioEnabled(true);
          if (roomIdRef.current) {
            sendSignal({
              type: SIGNAL_TYPES.ROOM_UNMUTE_AUDIO,
              roomId: roomIdRef.current,
            });
          }
        }
      } catch (err) {}
      return;
    }

    if (!localStreamRef.current) {
      if (!newEnabled) {
        setAudioEnabled(false);
        if (roomIdRef.current) {
          sendSignal({
            type: SIGNAL_TYPES.ROOM_MUTE_AUDIO,
            roomId: roomIdRef.current,
          });
        }
      }
      return;
    }

    const audioTracks = localStreamRef.current.getAudioTracks();
    if (audioTracks.length > 0) {
      audioTracks.forEach((track) => {
        track.enabled = newEnabled;
      });

      setAudioEnabled(newEnabled);
    } else if (newEnabled) {
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: selectedMicrophone ? { exact: selectedMicrophone } : undefined,
            echoCancellation: true,
            noiseSuppression: true,
          },
          video: false,
        });
        audioStream.getAudioTracks().forEach((track) => {
          localStreamRef.current.addTrack(track);
        });

        peerConnectionsRef.current.forEach((pc) => {
          audioStream.getAudioTracks().forEach((track) => {
            pc.addTrack(track, localStreamRef.current);
          });
        });

        setAudioEnabled(true);
      } catch (err) {
        return;
      }
    } else {
      setAudioEnabled(false);
    }

    if (roomIdRef.current) {
      sendSignal({
        type: newEnabled ? SIGNAL_TYPES.ROOM_UNMUTE_AUDIO : SIGNAL_TYPES.ROOM_MUTE_AUDIO,
        roomId: roomIdRef.current,
      });
    }
  }, [audioEnabled, videoEnabled, sendSignal, startLocalStream, selectedMicrophone]);

  const toggleVideo = useCallback(async () => {
    const newEnabled = !videoEnabled;

    if (!localStreamRef.current && newEnabled) {
      try {
        const stream = await startLocalStream(audioEnabled, true);
        if (stream) {
          setVideoEnabled(true);
          if (roomIdRef.current) {
            sendSignal({
              type: SIGNAL_TYPES.ROOM_UNMUTE_VIDEO,
              roomId: roomIdRef.current,
            });
          }
        }
      } catch (err) {}
      return;
    }

    if (!localStreamRef.current) {
      if (!newEnabled) {
        setVideoEnabled(false);
        if (roomIdRef.current) {
          sendSignal({
            type: SIGNAL_TYPES.ROOM_MUTE_VIDEO,
            roomId: roomIdRef.current,
          });
        }
      }
      return;
    }

    const videoTracks = localStreamRef.current.getVideoTracks();
    if (videoTracks.length > 0) {
      videoTracks.forEach((track) => {
        track.enabled = newEnabled;
      });

      setVideoEnabled(newEnabled);
    } else if (newEnabled) {
      try {
        const constraints = {
          video: selectedCamera
            ? {
                deviceId: { exact: selectedCamera },
                width: { ideal: 1280 },
                height: { ideal: 720 },
              }
            : { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        };
        const videoStream = await navigator.mediaDevices.getUserMedia(constraints);
        videoStream.getVideoTracks().forEach((track) => {
          localStreamRef.current.addTrack(track);
        });

        peerConnectionsRef.current.forEach((pc) => {
          videoStream.getVideoTracks().forEach((track) => {
            pc.addTrack(track, localStreamRef.current);
          });
        });

        setVideoEnabled(true);
      } catch (err) {
        return;
      }
    } else {
      setVideoEnabled(false);
    }

    if (roomIdRef.current) {
      sendSignal({
        type: newEnabled ? SIGNAL_TYPES.ROOM_UNMUTE_VIDEO : SIGNAL_TYPES.ROOM_MUTE_VIDEO,
        roomId: roomIdRef.current,
      });
    }
  }, [videoEnabled, audioEnabled, sendSignal, startLocalStream, selectedCamera]);

  const raiseHand = useCallback(() => {
    if (!roomIdRef.current) return;

    const newHandRaised = !handRaised;

    setHandRaised(newHandRaised);

    sendSignal({
      type: newHandRaised ? SIGNAL_TYPES.ROOM_RAISE_HAND : SIGNAL_TYPES.ROOM_LOWER_HAND,
      roomId: roomIdRef.current,
    });
  }, [handRaised, sendSignal]);

  const getDevices = useCallback(async () => {
    if (!isBrowser || !navigator.mediaDevices) {
      return { cameras: [], microphones: [] };
    }

    try {
      const deviceList = await navigator.mediaDevices.enumerateDevices();
      const cameras = deviceList.filter((d) => d.kind === 'videoinput');
      const microphones = deviceList.filter((d) => d.kind === 'audioinput');

      setDevices({ cameras, microphones });

      if (cameras.length > 0 && !selectedCamera) {
        setSelectedCamera(cameras[0].deviceId);
      }
      if (microphones.length > 0 && !selectedMicrophone) {
        setSelectedMicrophone(microphones[0].deviceId);
      }

      return { cameras, microphones };
    } catch (err) {
      return { cameras: [], microphones: [] };
    }
  }, [isBrowser, selectedCamera, selectedMicrophone]);

  const switchCamera = useCallback(
    async (deviceId) => {
      if (!isBrowser || !navigator.mediaDevices) return;

      setSelectedCamera(deviceId);

      if (!localStreamRef.current || !videoEnabled) return;

      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: { exact: deviceId },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        const oldVideoTrack = localStreamRef.current.getVideoTracks()[0];
        const newVideoTrack = newStream.getVideoTracks()[0];

        if (oldVideoTrack) {
          localStreamRef.current.removeTrack(oldVideoTrack);
          oldVideoTrack.stop();
        }

        if (newVideoTrack) {
          localStreamRef.current.addTrack(newVideoTrack);

          peerConnectionsRef.current.forEach((pc) => {
            const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
            if (sender) {
              sender.replaceTrack(newVideoTrack);
            } else {
              pc.addTrack(newVideoTrack, localStreamRef.current);
            }
          });

          const updatedStream = new MediaStream(localStreamRef.current.getTracks());
          localStreamRef.current = updatedStream;
          setLocalStream(updatedStream);
        }

        newStream.getTracks().forEach((track) => {
          if (track !== newVideoTrack) {
            track.stop();
          }
        });
      } catch (err) {
        console.error('Не удалось переключить камеру:', err);
      }
    },
    [isBrowser, videoEnabled]
  );

  const switchMicrophone = useCallback(
    async (deviceId) => {
      if (!isBrowser || !navigator.mediaDevices) return;

      setSelectedMicrophone(deviceId);

      if (!localStreamRef.current || !audioEnabled) return;

      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: {
            deviceId: { exact: deviceId },
            echoCancellation: true,
            noiseSuppression: true,
          },
        });

        const oldAudioTrack = localStreamRef.current.getAudioTracks()[0];
        const newAudioTrack = newStream.getAudioTracks()[0];

        if (oldAudioTrack) {
          localStreamRef.current.removeTrack(oldAudioTrack);
          oldAudioTrack.stop();
        }

        if (newAudioTrack) {
          localStreamRef.current.addTrack(newAudioTrack);

          peerConnectionsRef.current.forEach((pc) => {
            const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'audio');
            if (sender) {
              sender.replaceTrack(newAudioTrack);
            } else {
              pc.addTrack(newAudioTrack, localStreamRef.current);
            }
          });

          const updatedStream = new MediaStream(localStreamRef.current.getTracks());
          localStreamRef.current = updatedStream;
          setLocalStream(updatedStream);
        }

        newStream.getTracks().forEach((track) => {
          if (track !== newAudioTrack) {
            track.stop();
          }
        });
      } catch (err) {
        console.error('Не удалось переключить микрофон:', err);
      }
    },
    [isBrowser, audioEnabled]
  );

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

      setIsScreenSharing(true);

      sendSignal({
        type: SIGNAL_TYPES.ROOM_START_SCREEN_SHARE,
        roomId: roomIdRef.current,
      });

      stream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };

      peerConnectionsRef.current.forEach((pc) => {
        if (pc.signalingState === 'stable' || pc.signalingState === 'have-local-offer') {
          stream.getTracks().forEach((track) => {
            try {
              pc.addTrack(track, stream);
            } catch (err) {}
          });
        }
      });
    } catch (err) {
      if (err.name !== 'NotAllowedError') {
        setError('Ошибка демонстрации экрана');
      }
    }
  }, [isBrowser, sendSignal]);

  const stopScreenShare = useCallback(() => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
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

  const promoteParticipant = useCallback(
    (targetUserId) => {
      if (!roomIdRef.current) return;
      sendSignal({
        type: SIGNAL_TYPES.ROOM_PROMOTE_CO_HOST,
        roomId: roomIdRef.current,
        targetUserId,
      });
    },
    [sendSignal]
  );

  const demoteParticipant = useCallback(
    (targetUserId) => {
      if (!roomIdRef.current) return;
      sendSignal({
        type: SIGNAL_TYPES.ROOM_DEMOTE_TO_PARTICIPANT,
        roomId: roomIdRef.current,
        targetUserId,
      });
    },
    [sendSignal]
  );

  const muteParticipant = useCallback(
    (targetUserId) => {
      if (!roomIdRef.current) return;
      sendSignal({
        type: SIGNAL_TYPES.ROOM_MUTE_PARTICIPANT,
        roomId: roomIdRef.current,
        targetUserId,
      });
    },
    [sendSignal]
  );

  const kickParticipant = useCallback(
    (targetUserId) => {
      if (!roomIdRef.current) return;
      sendSignal({
        type: SIGNAL_TYPES.ROOM_KICK_PARTICIPANT,
        roomId: roomIdRef.current,
        targetUserId,
      });
    },
    [sendSignal]
  );

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  const isHost = myRole === PARTICIPANT_ROLE.HOST;
  const isCoHost = myRole === PARTICIPANT_ROLE.CO_HOST;
  const canManageParticipants = isHost || isCoHost;

  return {
    room,
    participants,
    isInRoom,
    error,

    localStream,
    remoteStreams,
    screenStream,
    audioEnabled,
    videoEnabled,
    isScreenSharing,
    handRaised,

    myRole,
    isHost,
    isCoHost,
    canManageParticipants,

    createRoom,
    joinRoom,
    leaveRoom,
    endRoom,

    startLocalStream,
    toggleAudio,
    toggleVideo,

    raiseHand,
    startScreenShare,
    stopScreenShare,

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

    sendOffer,
    clearError: () => setError(null),
  };
};
