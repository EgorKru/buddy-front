import { useEffect, useRef, useState, useMemo } from "react";
import cx from "classnames";
import { Mic, MicOff, Hand, Monitor } from "lucide-react";

import styles from "@/component/Player/index.module.css";

const Player = (props) => {
  const { 
    stream, 
    muted,           
    playing, 
    isActive, 
    playerId, 
    playerName, 
    isLocal,
    audioEnabled = true,  
    handRaised = false,   
    isScreenSharing = false  
  } = props;
  const videoRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const isMicOn = isLocal ? audioEnabled : !muted;
  
  useEffect(() => {
    if (videoRef.current && stream) {
      
      if (videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream;
      }
    } else if (videoRef.current && !stream) {
      
      if (videoRef.current.srcObject) {
        videoRef.current.srcObject = null;
      }
    }
  }, [stream]);

  useEffect(() => {
    if (!stream) {
      setIsSpeaking(false);
      return;
    }

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      setIsSpeaking(false);
      return;
    }

    if (!isMicOn) {
      setIsSpeaking(false);
      return;
    }

    try {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      analyserRef.current.smoothingTimeConstant = 0.3;
      
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      
      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      let speakingTimeout = null;
      const SPEAKING_THRESHOLD = 12; 
      const SPEAKING_DELAY = 250; 
      
      const checkAudioLevel = () => {
        if (!analyserRef.current) return;
        
        analyserRef.current.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        
        if (average > SPEAKING_THRESHOLD) {
          setIsSpeaking(true);
          if (speakingTimeout) {
            clearTimeout(speakingTimeout);
            speakingTimeout = null;
          }
        } else if (!speakingTimeout) {
          speakingTimeout = setTimeout(() => {
            setIsSpeaking(false);
            speakingTimeout = null;
          }, SPEAKING_DELAY);
        }
        
        animationFrameRef.current = requestAnimationFrame(checkAudioLevel);
      };
      
      checkAudioLevel();
      
      return () => {
        if (speakingTimeout) clearTimeout(speakingTimeout);
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close();
        }
      };
    } catch (err) {
      
    }
  }, [stream, isMicOn]);

  const getInitials = (name) => {
    if (!name) return "?";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const displayName = playerName || `Участник ${playerId?.substring(0, 6) || ""}`;

  const [initials, setInitials] = useState("??");
  
  useEffect(() => {
    
    setInitials(getInitials(displayName));
  }, [displayName]);

  const hasVideoTracks = stream && stream.getVideoTracks().length > 0;
  const videoTracks = hasVideoTracks ? stream.getVideoTracks() : [];
  const hasActiveVideoTracks = videoTracks.some(track => 
    track.readyState === 'live' && track.enabled
  );
  
  const hasScreenShareTracksInStream = videoTracks.some(track => 
    track.readyState === 'live' && 
    (track.label?.toLowerCase().includes('screen') || 
     track.label?.toLowerCase().includes('display'))
  );

  const shouldShowVideo = stream && ((playing && hasActiveVideoTracks) || isScreenSharing || hasScreenShareTracksInStream);

  return (
    <div
      className={cx(styles.playerContainer, {
        [styles.notActive]: !isActive,
        [styles.active]: isActive,
        [styles.notPlaying]: !shouldShowVideo,
        [styles.speaking]: isSpeaking && isMicOn,
      })}
    >
      {shouldShowVideo && stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal || muted}
          className={styles.video}
        />
      ) : (
        <div className={styles.avatarContainer}>
          <div 
            className={cx(styles.avatar, { [styles.avatarSpeaking]: isSpeaking && isMicOn })} 
            style={{ fontSize: isActive ? '120px' : '60px' }}
            suppressHydrationWarning
          >
            {initials}
          </div>
        </div>
      )}

      <div className={styles.nameLabel} suppressHydrationWarning>
        {displayName}
        {isSpeaking && isMicOn && <span className={styles.speakingIndicator}>🔊</span>}
      </div>

      {}
      {handRaised && (
        <div className={styles.handRaisedBadge}>
          <Hand size={20} />
        </div>
      )}

      {}
      {isScreenSharing && (
        <div className={styles.screenShareBadge}>
          <Monitor size={16} />
          <span>Демонстрация</span>
        </div>
      )}

      {!isActive && (
        <div className={cx(styles.micIcon, { [styles.micSpeaking]: isSpeaking && isMicOn })}>
          {isMicOn ? (
            <Mic size={18} />
          ) : (
            <MicOff size={18} />
          )}
        </div>
      )}
    </div>
  );
};

export default Player;
