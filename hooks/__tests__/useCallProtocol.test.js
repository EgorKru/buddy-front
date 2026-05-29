import { renderHook, act } from '@testing-library/react';

let signalHandler = null;
let eventsHandler = null;
let publishMock = null;

jest.mock('@/context/socket', () => ({
  useStomp: jest.fn(),
}));

jest.mock('@/utils/api', () => ({
  getCurrentUser: jest.fn(() => ({ id: 10, username: 'caller', displayName: 'Caller' })),
  turnAPI: {
    getCredentials: jest.fn().mockResolvedValue(null),
  },
}));

import { useStomp } from '@/context/socket';
import { useCallProtocol, CALL_STATUS, END_REASON } from '../useCallProtocol';

class MockRTCPeerConnection {
  constructor() {
    this.localDescription = null;
    this.remoteDescription = null;
    this.onicecandidate = null;
    this.ontrack = null;
    this.iceConnectionState = 'connected';
  }

  addTrack() {}

  createOffer = jest.fn().mockResolvedValue({ type: 'offer', sdp: 'v=0' });

  setLocalDescription = jest.fn().mockResolvedValue(undefined);

  setRemoteDescription = jest.fn().mockImplementation(async (desc) => {
    this.remoteDescription = desc;
  });

  addIceCandidate = jest.fn().mockResolvedValue(undefined);

  close = jest.fn();
}

describe('useCallProtocol', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    signalHandler = null;
    eventsHandler = null;
    publishMock = jest.fn();

    global.RTCPeerConnection = MockRTCPeerConnection;
    global.RTCSessionDescription = class {
      constructor(init) {
        Object.assign(this, init);
      }
    };
    global.RTCIceCandidate = class {
      constructor(init) {
        Object.assign(this, init);
      }
    };

    global.MediaStream = jest.fn(function MediaStream(tracks) {
      this._tracks = tracks || [];
      this.getTracks = () => this._tracks;
      this.getAudioTracks = () => this._tracks.filter((t) => t.kind === 'audio');
      this.getVideoTracks = () => this._tracks.filter((t) => t.kind === 'video');
    });

    const audioTrack = { kind: 'audio', enabled: true, stop: jest.fn() };
    const videoTrack = { kind: 'video', enabled: true, stop: jest.fn() };

    Object.defineProperty(global.navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: jest.fn(async (constraints) => {
          const tracks = [];
          if (constraints.audio) tracks.push(audioTrack);
          if (constraints.video) tracks.push(videoTrack);
          return {
            getTracks: () => tracks,
            getAudioTracks: () => tracks.filter((t) => t.kind === 'audio'),
            getVideoTracks: () => tracks.filter((t) => t.kind === 'video'),
          };
        }),
      },
    });

    HTMLCanvasElement.prototype.captureStream = jest.fn(() => ({
      getVideoTracks: () => [{ stop: jest.fn() }],
      addTrack: jest.fn(),
    }));

    useStomp.mockReturnValue({
      client: {
        connected: true,
        active: true,
        publish: publishMock,
        subscribe: jest.fn((destination, handler) => {
          if (destination === '/user/queue/call-signal') signalHandler = handler;
          if (destination === '/user/queue/call-events') eventsHandler = handler;
          return { unsubscribe: jest.fn() };
        }),
      },
      connected: true,
    });
  });

  it('subscribes to call STOMP queues when connected', async () => {
    renderHook(() => useCallProtocol());

    await act(async () => {
      await Promise.resolve();
    });

    expect(useStomp().client.subscribe).toHaveBeenCalledWith(
      '/user/queue/call-signal',
      expect.any(Function)
    );
    expect(useStomp().client.subscribe).toHaveBeenCalledWith(
      '/user/queue/call-events',
      expect.any(Function)
    );
    expect(signalHandler).not.toBeNull();
    expect(eventsHandler).not.toBeNull();
  });

  it('initiateCall publishes CALL_INITIATE to /app/call.signal', async () => {
    const { result } = renderHook(() => useCallProtocol());

    await act(async () => {
      await result.current.initiateCall(20, 'AUDIO', 4, { id: 20, displayName: 'Peer' });
    });

    expect(publishMock).toHaveBeenCalledWith(
      expect.objectContaining({
        destination: '/app/call.signal',
        body: expect.stringContaining('"type":"CALL_INITIATE"'),
      })
    );
    expect(JSON.parse(publishMock.mock.calls[0][0].body)).toMatchObject({
      type: 'CALL_INITIATE',
      targetUserId: 20,
      callType: 'AUDIO',
      chatId: 4,
    });
  });

  it('call-signal ack with CALLING sets ringing state', async () => {
    const { result } = renderHook(() => useCallProtocol());

    await act(async () => {
      signalHandler({
        body: JSON.stringify({
          success: true,
          type: 'CALL_INITIATE',
          call: { id: 55, status: CALL_STATUS.CALLING, type: 'AUDIO' },
        }),
      });
    });

    expect(result.current.isRinging).toBe(true);
    expect(result.current.call?.id).toBe(55);
  });

  it('call-signal BUSY clears ringing and sets error', async () => {
    const { result } = renderHook(() => useCallProtocol());

    await act(async () => {
      signalHandler({
        body: JSON.stringify({
          success: true,
          type: 'CALL_INITIATE',
          call: {
            id: 56,
            status: CALL_STATUS.ENDED,
            endReason: END_REASON.BUSY,
            callee: { displayName: 'Busy User' },
          },
        }),
      });
    });

    expect(result.current.isRinging).toBe(false);
    expect(result.current.error).toContain('Busy User');
  });

  it('INCOMING_CALL event sets incomingCall', async () => {
    const { result } = renderHook(() => useCallProtocol());

    await act(async () => {
      eventsHandler({
        body: JSON.stringify({
          eventType: 'INCOMING_CALL',
          call: { id: 77, type: 'AUDIO', caller: { id: 10, displayName: 'Caller' } },
        }),
      });
    });

    expect(result.current.incomingCall?.id).toBe(77);
  });

  it('CALL_ACCEPTED for caller schedules offer publish', async () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useCallProtocol());

    await act(async () => {
      await result.current.initiateCall(20, 'AUDIO', 4);
    });

    await act(async () => {
      signalHandler({
        body: JSON.stringify({
          success: true,
          type: 'CALL_INITIATE',
          call: { id: 88, status: CALL_STATUS.CALLING, type: 'AUDIO' },
        }),
      });
    });

    publishMock.mockClear();

    await act(async () => {
      eventsHandler({
        body: JSON.stringify({
          eventType: 'CALL_ACCEPTED',
          call: { id: 88, status: CALL_STATUS.ACTIVE, caller: { id: 10 } },
        }),
      });
      jest.advanceTimersByTime(150);
    });

    expect(result.current.isCallActive).toBe(true);
    expect(publishMock).toHaveBeenCalledWith(
      expect.objectContaining({
        destination: '/app/call.signal',
        body: expect.stringContaining('"type":"CALL_OFFER"'),
      })
    );
    jest.useRealTimers();
  });

  it('CALL_REJECTED clears ringing state', async () => {
    const { result } = renderHook(() => useCallProtocol());

    await act(async () => {
      signalHandler({
        body: JSON.stringify({
          success: true,
          type: 'CALL_INITIATE',
          call: { id: 99, status: CALL_STATUS.CALLING },
        }),
      });
    });

    await act(async () => {
      eventsHandler({ body: JSON.stringify({ eventType: 'CALL_REJECTED', call: { id: 99 } }) });
    });

    expect(result.current.isRinging).toBe(false);
    expect(result.current.isCallActive).toBe(false);
  });

  it('rejectCall publishes CALL_REJECT', async () => {
    const { result } = renderHook(() => useCallProtocol());

    await act(async () => {
      eventsHandler({
        body: JSON.stringify({
          eventType: 'INCOMING_CALL',
          call: { id: 101, type: 'AUDIO' },
        }),
      });
    });

    publishMock.mockClear();

    await act(async () => {
      result.current.rejectCall(101);
    });

    expect(publishMock).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining('"type":"CALL_REJECT"'),
      })
    );
  });

  it('canInitiateCall is false when another call is ACTIVE', async () => {
    const { result } = renderHook(() => useCallProtocol());

    await act(async () => {
      eventsHandler({
        body: JSON.stringify({
          eventType: 'CALL_ACCEPTED',
          call: { id: 200, status: CALL_STATUS.ACTIVE, caller: { id: 10 } },
        }),
      });
    });

    expect(result.current.canInitiateCall()).toBe(false);
  });
});
