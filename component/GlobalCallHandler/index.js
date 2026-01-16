import { useCall } from '@/context/CallContext';
import IncomingCallModal from '@/component/IncomingCallModal';
import OutgoingCallModal from '@/component/OutgoingCallModal';
import CallView from '@/component/CallView';

const GlobalCallHandler = () => {
  const {
    call,
    incomingCall,
    isCallActive,
    isRinging,
    localStream,
    remoteStream,
    audioEnabled,
    videoEnabled,
    remoteMuted,
    acceptCall,
    rejectCall,
    sendBusy,
    cancelCall,
    endCall,
    toggleAudio,
    toggleVideo,
  } = useCall();

  return (
    <>
      {}
      {incomingCall && !isCallActive && !isRinging && (
        <IncomingCallModal
          call={incomingCall}
          onAccept={acceptCall}
          onReject={rejectCall}
          onBusy={sendBusy}
        />
      )}

      {}
      {isRinging && call && !isCallActive && (
        <OutgoingCallModal
          call={call}
          onCancel={cancelCall}
          onToggleVideo={toggleVideo}
          onToggleMic={toggleAudio}
          videoEnabled={videoEnabled}
          audioEnabled={audioEnabled}
          localStream={localStream}
        />
      )}

      {}
      {isCallActive && call && (
        <CallView
          call={call}
          localStream={localStream}
          remoteStream={remoteStream}
          audioEnabled={audioEnabled}
          videoEnabled={videoEnabled}
          remoteMuted={remoteMuted}
          onToggleAudio={toggleAudio}
          onToggleVideo={toggleVideo}
          onEndCall={endCall}
          isCallActive={isCallActive}
        />
      )}
    </>
  );
};

GlobalCallHandler.displayName = 'GlobalCallHandler';

export default GlobalCallHandler;
