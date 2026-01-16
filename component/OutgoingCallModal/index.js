import { useEffect, useState, useRef } from "react";
import { Phone, PhoneOff, Video, VideoOff, Monitor, Mic, MicOff, Minimize2, Maximize2 } from "lucide-react";
import styles from "./index.module.css";

const OutgoingCallModal = ({ 
  call, 
  onCancel,
  onToggleVideo,
  onToggleMic,
  videoEnabled,
  audioEnabled,
  localStream,
}) => {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showVideo, setShowVideo] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [position, setPosition] = useState({ x: typeof window !== 'undefined' ? window.innerWidth - 320 : 0, y: typeof window !== 'undefined' ? window.innerHeight - 200 : 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [hasDragged, setHasDragged] = useState(false);
  const minimizedRef = useRef(null);

  useEffect(() => {
    if (!call) return;
    
    const interval = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);

    return () => {
      clearInterval(interval);
      setElapsedTime(0);
    };
  }, [call]);

  useEffect(() => {
    if (!call) return;

    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    let oscillators = [];
    let gainNode = null;

    const playSoftMusic = () => {
      try {
        
        const notes = [261.63, 329.63, 392.00]; 
        gainNode = audioContext.createGain();
        gainNode.connect(audioContext.destination);

        gainNode.gain.setValueAtTime(0.05, audioContext.currentTime);
        
        notes.forEach((freq, index) => {
          const osc = audioContext.createOscillator();
          osc.connect(gainNode);
          osc.frequency.value = freq;
          osc.type = 'sine'; 
          osc.start(audioContext.currentTime + index * 0.1);
          osc.stop(audioContext.currentTime + 1.5);
          oscillators.push(osc);
        });
      } catch (error) {
        
      }
    };

    const musicInterval = setInterval(playSoftMusic, 3000);
    playSoftMusic(); 

    return () => {
      clearInterval(musicInterval);
      oscillators.forEach(osc => {
        try {
          osc.stop();
        } catch (e) {}
      });
      if (audioContext.state !== 'closed') {
        audioContext.close().catch(() => {});
      }
    };
  }, [call]);

  if (!call) return null;

  const callee = call.callee;
  const calleeName = callee?.displayName || callee?.username || `User ${callee?.id}`;
  const isVideo = call.type === 'VIDEO';

  const getInitials = (name) => {
    if (!name) return "?";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const handleToggleVideo = () => {
    setShowVideo(!showVideo);
    onToggleVideo?.();
  };

  const formatDuration = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

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
            
            if (!hasDragged && !isDragging && !e.target.closest(`.${styles.minimizedControlButton}`)) {
              setIsMinimized(false);
            }
          }}
        >
          <div className={styles.minimizedAvatar}>
            {getInitials(calleeName)}
          </div>
          <div className={styles.minimizedInfo}>
            <span className={styles.minimizedName}>{calleeName}</span>
            <span className={styles.minimizedStatus}>ожидание...</span>
          </div>
          <div className={styles.minimizedPulse}></div>
        </div>
        
        {}
        <div className={styles.minimizedControls}>
          <button
            className={`${styles.minimizedControlButton} ${!audioEnabled ? styles.off : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleMic?.();
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
                handleToggleVideo();
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
              onCancel?.();
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
      <div className={styles.container}>
        {}
        <button 
          className={styles.minimizeButton}
          onClick={() => setIsMinimized(true)}
          title="Свернуть"
        >
          <Minimize2 size={20} />
        </button>
        {}
        <div className={styles.avatarSection}>
          <div className={styles.avatar}>
            {getInitials(calleeName)}
          </div>
        </div>

        {}
        <div className={styles.info}>
          <h2 className={styles.calleeName}>{calleeName}</h2>
          <p className={styles.status}>ожидание...</p>
        </div>

        {}
        <div className={styles.controls}>
          {}
          <div className={styles.controlItem}>
            <button className={styles.controlButton} disabled>
              <Monitor size={24} />
            </button>
            <span className={styles.controlLabel}>Экран</span>
          </div>

          {}
          <div className={styles.controlItem}>
            <button 
              className={`${styles.controlButton} ${!videoEnabled ? styles.off : ''}`}
              onClick={handleToggleVideo}
            >
              {videoEnabled ? <Video size={24} /> : <VideoOff size={24} />}
            </button>
            <span className={styles.controlLabel}>
              {videoEnabled ? 'Выкл. видео' : 'Вкл. видео'}
            </span>
          </div>

          {}
          <div className={styles.controlItem}>
            <button 
              className={`${styles.controlButton} ${styles.endCall}`}
              onClick={onCancel}
            >
              <PhoneOff size={24} />
            </button>
            <span className={styles.controlLabel}>Завершить</span>
          </div>

          {}
          <div className={styles.controlItem}>
            <button 
              className={`${styles.controlButton} ${!audioEnabled ? styles.off : ''}`}
              onClick={onToggleMic}
            >
              {audioEnabled ? <Mic size={24} /> : <MicOff size={24} />}
            </button>
            <span className={styles.controlLabel}>
              {audioEnabled ? 'Выкл. звук' : 'Вкл. звук'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

OutgoingCallModal.displayName = 'OutgoingCallModal';

export default OutgoingCallModal;
