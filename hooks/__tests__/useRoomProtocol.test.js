import { renderHook, act } from '@testing-library/react';

let roomTopicHandler = null;
let userQueueHandler = null;
let publishMock = null;

jest.mock('@/context/socket', () => ({
  useStomp: jest.fn(),
}));

jest.mock('@/utils/api', () => ({
  turnAPI: {
    getCredentials: jest.fn().mockResolvedValue(null),
  },
  roomAPI: {
    joinRoom: jest.fn().mockResolvedValue({
      roomId: 'ABC12345',
      participants: [{ user: { id: 10 }, role: 'HOST', handRaised: false, screenSharing: false }],
    }),
    createRoom: jest.fn(),
  },
}));

jest.mock('@/shared/lib/media', () => ({
  acquireMediaStream: jest.fn(),
  buildProcessedMediaStream: jest.fn((stream) => stream),
  stopMediaStream: jest.fn((stream) => stream?.getTracks?.().forEach((track) => track.stop?.())),
}));

import { useStomp } from '@/context/socket';
import { roomAPI } from '@/utils/api';
import { acquireMediaStream } from '@/shared/lib/media';
import { useRoomProtocol, ROOM_STATUS, PARTICIPANT_ROLE } from '../useRoomProtocol';

describe('useRoomProtocol', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    roomTopicHandler = null;
    userQueueHandler = null;
    publishMock = jest.fn();

    Object.defineProperty(global, 'localStorage', {
      configurable: true,
      value: {
        getItem: jest.fn(() => JSON.stringify({ id: 10, username: 'host', displayName: 'Host' })),
      },
    });

    global.RTCPeerConnection = jest.fn().mockImplementation(() => ({
      signalingState: 'stable',
      remoteDescription: null,
      close: jest.fn(),
      addTrack: jest.fn(),
      removeTrack: jest.fn(),
      createOffer: jest.fn().mockResolvedValue({ sdp: 'offer-sdp' }),
      createAnswer: jest.fn().mockResolvedValue({ sdp: 'answer-sdp' }),
      setLocalDescription: jest.fn().mockResolvedValue(undefined),
      setRemoteDescription: jest.fn().mockResolvedValue(undefined),
      addIceCandidate: jest.fn().mockResolvedValue(undefined),
    }));

    useStomp.mockReturnValue({
      client: {
        connected: true,
        active: true,
        publish: publishMock,
        subscribe: jest.fn((destination, handler) => {
          if (destination.startsWith('/topic/room/')) roomTopicHandler = handler;
          if (destination === '/user/queue/room-signal') userQueueHandler = handler;
          return { unsubscribe: jest.fn() };
        }),
      },
      connected: true,
    });

    acquireMediaStream.mockResolvedValue({
      stream: {
        getTracks: jest.fn(() => []),
        getAudioTracks: jest.fn(() => []),
        getVideoTracks: jest.fn(() => []),
      },
    });
  });

  it('subscribes to room topic and user queue on join', async () => {
    const { result } = renderHook(() => useRoomProtocol('ABC12345'));

    await act(async () => {
      await result.current.joinRoom('ABC12345', false, true, false);
    });

    expect(useStomp().client.subscribe).toHaveBeenCalledWith(
      '/topic/room/ABC12345',
      expect.any(Function)
    );
    expect(useStomp().client.subscribe).toHaveBeenCalledWith(
      '/user/queue/room-signal',
      expect.any(Function)
    );
  });

  it('subscribes when the STOMP client becomes ready during room join', async () => {
    const subscribe = jest.fn((destination, handler) => {
      if (destination.startsWith('/topic/room/')) roomTopicHandler = handler;
      if (destination === '/user/queue/room-signal') userQueueHandler = handler;
      return { unsubscribe: jest.fn() };
    });
    const readyClient = { connected: true, active: true, publish: publishMock, subscribe };
    useStomp.mockReturnValue({ client: null, connected: false });

    const { result, rerender } = renderHook(() => useRoomProtocol('ABC12345'));
    let joinPromise;
    act(() => {
      joinPromise = result.current.joinRoom('ABC12345', false, true, false);
    });

    useStomp.mockReturnValue({ client: readyClient, connected: true });
    rerender();

    await act(async () => {
      await joinPromise;
    });

    expect(subscribe).toHaveBeenCalledWith('/topic/room/ABC12345', expect.any(Function));
    expect(subscribe).toHaveBeenCalledWith('/user/queue/room-signal', expect.any(Function));
  });

  it('keeps a camera toggle made while initial media acquisition is pending', async () => {
    let resolveMedia;
    const videoTrack = { enabled: true, stop: jest.fn() };
    const stream = {
      getTracks: jest.fn(() => [videoTrack]),
      getAudioTracks: jest.fn(() => []),
      getVideoTracks: jest.fn(() => [videoTrack]),
    };
    Object.defineProperty(global.navigator, 'mediaDevices', {
      configurable: true,
      value: {},
    });
    acquireMediaStream.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveMedia = resolve;
      })
    );

    const { result } = renderHook(() => useRoomProtocol('ABC12345'));
    let joinPromise;
    act(() => {
      joinPromise = result.current.joinRoom('ABC12345', true, true, true);
    });

    await act(async () => {
      await Promise.resolve();
      await result.current.toggleVideo();
    });

    await act(async () => {
      resolveMedia({ stream });
      await joinPromise;
    });

    expect(result.current.videoEnabled).toBe(false);
    expect(videoTrack.enabled).toBe(false);
  });

  it('does not publish signal when STOMP disconnected', () => {
    useStomp.mockReturnValue({
      client: { connected: false, publish: publishMock },
      connected: false,
    });

    const { result } = renderHook(() => useRoomProtocol('ABC12345'));

    act(() => {
      result.current.raiseHand();
    });

    expect(publishMock).not.toHaveBeenCalled();
  });

  it('uses the current STOMP connection from callbacks created before reconnect', () => {
    const stompClient = { connected: false, publish: publishMock };
    useStomp.mockReturnValue({ client: stompClient, connected: false });

    const { result, rerender } = renderHook(() => useRoomProtocol('ABC12345'));
    const callbackCreatedWhileDisconnected = result.current.raiseHand;

    stompClient.connected = true;
    useStomp.mockReturnValue({ client: stompClient, connected: true });
    rerender();

    act(() => {
      callbackCreatedWhileDisconnected();
    });

    expect(publishMock).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining('ROOM_RAISE_HAND'),
      })
    );
  });

  it('room-signal error sets error message', async () => {
    const { result } = renderHook(() => useRoomProtocol('ABC12345'));

    await act(async () => {
      await result.current.joinRoom('ABC12345', false, true, false);
    });

    act(() => {
      userQueueHandler({
        body: JSON.stringify({
          success: false,
          errorMessage: 'Room has already ended',
        }),
      });
    });

    expect(result.current.error).toBe('Room has already ended');
  });

  it('ROOM_ENDED event clears in-room state', async () => {
    const { result } = renderHook(() => useRoomProtocol('ABC12345'));

    await act(async () => {
      await result.current.joinRoom('ABC12345', false, true, false);
    });

    expect(result.current.isInRoom).toBe(true);

    act(() => {
      roomTopicHandler({
        body: JSON.stringify({
          eventType: 'ROOM_ENDED',
          roomId: 'ABC12345',
          seq: 1,
        }),
      });
    });

    expect(result.current.isInRoom).toBe(false);
    expect(result.current.room).toBeNull();
  });

  it('accepts the first live event after a subscriber joins mid-sequence', async () => {
    const { result } = renderHook(() => useRoomProtocol('ABC12345'));

    await act(async () => {
      await result.current.joinRoom('ABC12345', false, true, false);
    });

    act(() => {
      roomTopicHandler({
        body: JSON.stringify({
          eventType: 'PARTICIPANT_HAND_RAISED',
          roomId: 'ABC12345',
          fromUserId: 10,
          seq: 42,
        }),
      });
    });

    expect(result.current.handRaised).toBe(true);

    act(() => {
      roomTopicHandler({
        body: JSON.stringify({
          eventType: 'PARTICIPANT_HAND_LOWERED',
          roomId: 'ABC12345',
          fromUserId: 10,
          seq: 41,
        }),
      });
    });

    expect(result.current.handRaised).toBe(true);
  });

  it('subscribes and lets the newcomer offer to existing participants after REST join', async () => {
    roomAPI.joinRoom.mockResolvedValueOnce({
      roomId: 'ABC12345',
      participants: [
        { user: { id: 5 }, role: 'HOST' },
        { user: { id: 10 }, role: 'PARTICIPANT' },
      ],
    });
    const { result } = renderHook(() => useRoomProtocol('ABC12345'));

    await act(async () => {
      await result.current.joinRoom('ABC12345', false, true, false);
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(useStomp().client.subscribe).toHaveBeenCalledWith(
      '/topic/room/ABC12345',
      expect.any(Function)
    );
    expect(publishMock).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringMatching(/ROOM_OFFER.*"targetUserId":5/),
      })
    );
  });

  it('PARTICIPANT_KICKED for self sets error and leaves room', async () => {
    const { result } = renderHook(() => useRoomProtocol('ABC12345'));

    await act(async () => {
      await result.current.joinRoom('ABC12345', false, true, false);
    });

    act(() => {
      roomTopicHandler({
        body: JSON.stringify({
          eventType: 'PARTICIPANT_KICKED',
          roomId: 'ABC12345',
          fromUserId: 99,
          targetUserId: 10,
          seq: 1,
        }),
      });
    });

    expect(result.current.error).toMatch(/удалили/i);
    expect(result.current.isInRoom).toBe(false);
  });

  it('exports room status and role constants', () => {
    expect(ROOM_STATUS.ACTIVE).toBe('ACTIVE');
    expect(PARTICIPANT_ROLE.HOST).toBe('HOST');
  });

  it('starts and stops screen sharing with explicit state and signalling', async () => {
    const displayTrack = {
      kind: 'video',
      label: 'Screen 1',
      readyState: 'live',
      stop: jest.fn(),
      onended: null,
    };
    const displayStream = {
      getVideoTracks: jest.fn(() => [displayTrack]),
      getTracks: jest.fn(() => [displayTrack]),
    };
    Object.defineProperty(global.navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getDisplayMedia: jest.fn().mockResolvedValue(displayStream),
      },
    });

    const { result } = renderHook(() => useRoomProtocol('ABC12345'));

    await act(async () => {
      await result.current.startScreenShare();
    });

    expect(result.current.isScreenSharing).toBe(true);
    expect(result.current.screenStream).toBe(displayStream);
    expect(publishMock).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining('ROOM_START_SCREEN_SHARE'),
      })
    );

    act(() => {
      result.current.stopScreenShare();
    });

    expect(displayTrack.stop).toHaveBeenCalledTimes(1);
    expect(result.current.isScreenSharing).toBe(false);
    expect(result.current.screenStream).toBeNull();
    expect(publishMock).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining('ROOM_STOP_SCREEN_SHARE'),
      })
    );
  });

  it('treats cancelling the native screen picker as a non-error state', async () => {
    const cancelled = new Error('Permission denied');
    cancelled.name = 'NotAllowedError';
    Object.defineProperty(global.navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getDisplayMedia: jest.fn().mockRejectedValue(cancelled),
      },
    });

    const { result } = renderHook(() => useRoomProtocol('ABC12345'));

    await act(async () => {
      await result.current.startScreenShare();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.isScreenSharing).toBe(false);
  });
});
