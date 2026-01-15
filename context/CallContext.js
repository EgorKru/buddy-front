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

// Пустой объект-заглушка для SSR и случаев вне провайдера
const noopCall = {
  call: null,
  incomingCall: null,
  isCallActive: false,
  isRinging: false,
  error: null,
  remoteMuted: false,
  localStream: null,
  remoteStream: null,
  audioEnabled: true,
  videoEnabled: true,
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
  // Возвращаем заглушку если контекст недоступен (SSR или вне провайдера)
  if (!context) {
    return noopCall;
  }
  return context;
};

export { CALL_TYPE };
