import { createContext, useContext } from 'react';
import { useCallProtocol, CALL_TYPE } from '@/hooks/useCallProtocol';

const CallContext = createContext(null);

export const CallProvider = ({ children }) => {
  const callProtocol = useCallProtocol();

  return (
    <CallContext.Provider value={callProtocol}>
      {children}
    </CallContext.Provider>
  );
};

CallProvider.displayName = 'CallProvider';

const noopCall = {
  call: null,
  incomingCall: null,
  activeCalls: [],
  isCallActive: false,
  isRinging: false,
  error: null,
  remoteMuted: false,
  localStream: null,
  remoteStream: null,
  audioEnabled: true,
  videoEnabled: true,
  canInitiateCall: () => true,
  initiateCall: () => {},
  acceptCall: () => {},
  rejectCall: () => {},
  cancelCall: () => {},
  sendBusy: () => {},
  endCall: () => {},
  toggleAudio: () => {},
  toggleVideo: () => {},
  clearError: () => {},
};

export const useCall = () => {
  const context = useContext(CallContext);
  
  if (!context) {
    return noopCall;
  }
  return context;
};

export { CALL_TYPE };
