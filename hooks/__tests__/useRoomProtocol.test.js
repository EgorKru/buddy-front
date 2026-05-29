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

import { useStomp } from '@/context/socket';
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
      close: jest.fn(),
      addTrack: jest.fn(),
      createOffer: jest.fn(),
      setLocalDescription: jest.fn(),
      setRemoteDescription: jest.fn(),
      addIceCandidate: jest.fn(),
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
});
