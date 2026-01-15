import { useEffect, useRef, useState } from "react";
import cx from "classnames";
import { Mic, MicOff, Hand, Monitor } from "lucide-react";

import styles from "@/component/Player/index.module.css";

const Player = (props) => {
  const { 
    stream, 
    muted,           // Для video элемента (локальный всегда muted чтобы не слышать себя)
    playing, 
    isActive, 
    playerId, 
    playerName, 
    isLocal,
    audioEnabled = true,  // Реальное состояние микрофона (включён/выключен)
    handRaised = false,   // Поднята ли рука
    isScreenSharing = false  // Демонстрирует ли экран
  } = props;
  const videoRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  // Для локального: audioEnabled показывает включён ли микрофон
  // Для удалённых: muted показывает слышим ли мы их (всегда false)
  const isMicOn = isLocal ? audioEnabled : !muted;
  
  useEffect(() => {
    if (videoRef.current && stream) {
      // Предотвращаем мерцание: обновляем только если stream действительно изменился
      if (videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream;
      }
    } else if (videoRef.current && !stream) {
      // Очищаем только если stream действительно удален
      if (videoRef.current.srcObject) {
        videoRef.current.srcObject = null;
      }
    }
  }, [stream]);

  // Voice Activity Detection — работает для всех участников
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

    // Если микрофон выключен — не показываем индикатор
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
      const SPEAKING_THRESHOLD = 12; // Порог громкости (чуть ниже для лучшей чувствительности)
      const SPEAKING_DELAY = 250; // Задержка перед выключением индикатора
      
      const checkAudioLevel = () => {
        if (!analyserRef.current) return;
        
        analyserRef.current.getByteFrequencyData(dataArray);
        
        // Считаем среднюю громкость
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
      console.error('Error setting up audio analysis:', err);
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
  const initials = getInitials(displayName);
  
  // Определяем, есть ли видео треки в стриме
  const hasVideoTracks = stream && stream.getVideoTracks().length > 0;
  const hasActiveVideoTracks = hasVideoTracks && 
    stream.getVideoTracks().some(track => track.readyState === 'live' && track.enabled);
  
  // Показываем видео, если есть активные видео треки и playing = true
  // Или если есть screen sharing (всегда показываем видео для screen sharing)
  // Но не показываем видео, если stream пустой или нет треков
  const shouldShowVideo = stream && ((playing && hasActiveVideoTracks) || isScreenSharing);

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
          <div className={cx(styles.avatar, { [styles.avatarSpeaking]: isSpeaking && isMicOn })} style={{ fontSize: isActive ? '120px' : '60px' }}>
            {initials}
          </div>
        </div>
      )}

      <div className={styles.nameLabel}>
        {displayName}
        {isSpeaking && isMicOn && <span className={styles.speakingIndicator}>🔊</span>}
      </div>

      {/* Индикатор поднятой руки */}
      {handRaised && (
        <div className={styles.handRaisedBadge}>
          <Hand size={20} />
        </div>
      )}

      {/* Индикатор демонстрации экрана */}
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
