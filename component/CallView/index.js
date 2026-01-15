import { useEffect, useRef, useState } from "react";
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Maximize2, Minimize2 } from "lucide-react";
import styles from "./index.module.css";

const CallView = ({
  call,
  localStream,
  remoteStream,
  audioEnabled,
  videoEnabled,
  remoteMuted,
  onToggleAudio,
  onToggleVideo,
  onEndCall,
}) => {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const minimizedRemoteVideoRef = useRef(null);
  const minimizedRef = useRef(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);
  const [position, setPosition] = useState({ 
    x: typeof window !== 'undefined' ? window.innerWidth - 320 : 0, 
    y: typeof window !== 'undefined' ? window.innerHeight - 200 : 0 
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [hasDragged, setHasDragged] = useState(false);

  // Локальный видеопоток
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Удалённый видеопоток (для полного экрана)
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream && !isMinimized) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, isMinimized]);

  // Удалённый видеопоток (для мини-окна)
  useEffect(() => {
    if (minimizedRemoteVideoRef.current && remoteStream && isMinimized) {
      minimizedRemoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, isMinimized]);

  // Таймер звонка
  useEffect(() => {
    if (!call) return;

    const startTime = call.acceptedAt ? new Date(call.acceptedAt).getTime() : Date.now();
    
    const interval = setInterval(() => {
      const now = Date.now();
      setCallDuration(Math.floor((now - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [call]);

  // Обработчики перетаскивания
  const handleMouseDown = (e) => {
    if (!isMinimized) return;
    if (e.target.closest(`.${styles.minimizedControlButton}`)) return;
    setIsDragging(true);
    const rect = minimizedRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !isMinimized) return;
    setHasDragged(true);
    const newX = Math.max(0, Math.min(e.clientX - dragOffset.x, window.innerWidth - 300));
    const newY = Math.max(0, Math.min(e.clientY - dragOffset.y, window.innerHeight - 150));
    setPosition({ x: newX, y: newY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    // Сбрасываем флаг через небольшую задержку, чтобы onClick не сработал
    setTimeout(() => setHasDragged(false), 100);
  };

  useEffect(() => {
    if (isDragging && isMinimized) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isMinimized, dragOffset]);

  if (!call) return null;

  const isVideo = call.type === 'VIDEO';
  const remotePerson = call.caller?.id === call.callee?.id ? call.caller : 
    (call.caller?.id !== call.callee?.id ? 
      (call.caller?.displayName ? call.callee : call.caller) : call.callee);
  
  const remoteUser = call.caller || call.callee;
  const remoteName = remoteUser?.displayName || remoteUser?.username || 'Собеседник';

  const formatDuration = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const getInitials = (name) => {
    if (!name) return "?";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Минимизированный вид
  if (isMinimized) {
    return (
      <div 
        className={styles.minimizedContainer}
        style={{ left: `${position.x}px`, top: `${position.y}px` }}
        ref={minimizedRef}
      >
        <div 
          className={`${styles.minimized} ${isDragging ? styles.dragging : ''}`}
          onMouseDown={handleMouseDown}
          onClick={(e) => {
            // Открываем только если не было перетаскивания и не кликнули по кнопке
            if (!hasDragged && !isDragging && !e.target.closest(`.${styles.minimizedControlButton}`)) {
              setIsMinimized(false);
            }
          }}
        >
          {/* Видео или аватар */}
          {isVideo && remoteStream ? (
            <div className={styles.minimizedVideo}>
              <video
                ref={minimizedRemoteVideoRef}
                autoPlay
                playsInline
                className={styles.minimizedVideoElement}
              />
            </div>
          ) : (
            <div className={styles.minimizedAvatar}>
              {getInitials(remoteName)}
            </div>
          )}
          
          {/* Информация */}
          <div className={styles.minimizedInfo}>
            <span className={styles.minimizedName}>{remoteName}</span>
            <span className={styles.minimizedTimer}>{formatDuration(callDuration)}</span>
          </div>
          
          {/* Индикатор активности */}
          <div className={styles.minimizedPulse}></div>
        </div>
        
        {/* Мини-панель управления */}
        <div className={styles.minimizedControls}>
          <button
            className={`${styles.minimizedControlButton} ${!audioEnabled ? styles.off : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleAudio?.();
            }}
            title={audioEnabled ? 'Выключить микрофон' : 'Включить микрофон'}
          >
            {audioEnabled ? <Mic size={16} /> : <MicOff size={16} />}
          </button>
          
          {isVideo && (
            <button
              className={`${styles.minimizedControlButton} ${!videoEnabled ? styles.off : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                onToggleVideo?.();
              }}
              title={videoEnabled ? 'Выключить камеру' : 'Включить камеру'}
            >
              {videoEnabled ? <Video size={16} /> : <VideoOff size={16} />}
            </button>
          )}
          
          <button
            className={`${styles.minimizedControlButton} ${styles.expandButton}`}
            onClick={(e) => {
              e.stopPropagation();
              setIsMinimized(false);
            }}
            title="Развернуть"
          >
            <Maximize2 size={16} />
          </button>
          
          <button
            className={`${styles.minimizedControlButton} ${styles.endCall}`}
            onClick={(e) => {
              e.stopPropagation();
              onEndCall?.();
            }}
            title="Завершить звонок"
          >
            <PhoneOff size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.callContainer}>
        {/* Заголовок */}
        <div className={styles.header}>
          <button 
            className={styles.minimizeButton}
            onClick={() => setIsMinimized(true)}
            title="Свернуть"
          >
            <Minimize2 size={20} />
          </button>
          <div className={styles.headerInfo}>
            <span className={styles.headerName}>{remoteName}</span>
            <span className={styles.headerTimer}>{formatDuration(callDuration)}</span>
          </div>
        </div>

        {/* Видео область */}
        <div className={styles.videoArea}>
          {/* Удалённое видео / Аватар */}
          {isVideo && remoteStream ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className={styles.remoteVideo}
            />
          ) : (
            <div className={styles.remoteAvatar}>
              <div className={styles.avatarCircle}>
                {getInitials(remoteName)}
              </div>
              {remoteMuted && (
                <div className={styles.mutedIndicator}>
                  <MicOff size={16} />
                </div>
              )}
            </div>
          )}

          {/* Локальное видео (PiP) */}
          {isVideo && localStream && (
            <div className={styles.localVideoContainer}>
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className={styles.localVideo}
              />
              {!videoEnabled && (
                <div className={styles.localVideoOff}>
                  <VideoOff size={24} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Панель управления */}
        <div className={styles.controls}>
          <button
            className={`${styles.controlButton} ${!audioEnabled ? styles.off : ''}`}
            onClick={onToggleAudio}
            title={audioEnabled ? 'Выключить микрофон' : 'Включить микрофон'}
          >
            {audioEnabled ? <Mic size={24} /> : <MicOff size={24} />}
          </button>

          {isVideo && (
            <button
              className={`${styles.controlButton} ${!videoEnabled ? styles.off : ''}`}
              onClick={onToggleVideo}
              title={videoEnabled ? 'Выключить камеру' : 'Включить камеру'}
            >
              {videoEnabled ? <Video size={24} /> : <VideoOff size={24} />}
            </button>
          )}

          <button
            className={`${styles.controlButton} ${styles.endCall}`}
            onClick={onEndCall}
            title="Завершить звонок"
          >
            <PhoneOff size={24} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CallView;
