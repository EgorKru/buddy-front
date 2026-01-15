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
  isCallActive = true, // По умолчанию звонок активен
}) => {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null); // Аудио-элемент для удаленного потока
  const minimizedRemoteVideoRef = useRef(null);
  const minimizedRef = useRef(null);
  const [callDuration, setCallDuration] = useState(0);
  const callStartTimeRef = useRef(null); // Время начала звонка
  const callBecameActiveTimeRef = useRef(null); // Время когда звонок стал активным (fallback)
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

  // Удалённый аудиопоток (для всех звонков - и аудио, и видео)
  useEffect(() => {
    if (!remoteStream) {
      // Очищаем аудио если стрима нет
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = null;
      }
      return;
    }

    if (!remoteAudioRef.current) {
      // Ждем пока ref будет готов
      return;
    }

    // Получаем все треки из стрима
    const allTracks = remoteStream.getTracks();
    const audioTracks = remoteStream.getAudioTracks();
    
    console.log('[CallView] Remote stream - total tracks:', allTracks.length, 'audio tracks:', audioTracks.length);
    
    if (audioTracks.length > 0) {
      // Создаем новый стрим только с аудио-треками
      const audioStream = new MediaStream(audioTracks);
      
      // Убеждаемся что треки включены
      audioTracks.forEach(track => {
        if (!track.enabled) {
          track.enabled = true;
        }
      });
      
      remoteAudioRef.current.srcObject = audioStream;
      
      // Убеждаемся что элемент не muted и volume = 1.0
      remoteAudioRef.current.muted = false;
      remoteAudioRef.current.volume = 1.0;
      
      // Воспроизводим аудио
      const playPromise = remoteAudioRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log('[CallView] Remote audio playing successfully');
          })
          .catch(err => {
            console.error('[CallView] Error playing remote audio:', err);
            // Пробуем еще раз через небольшую задержку
            setTimeout(() => {
              if (remoteAudioRef.current && remoteAudioRef.current.srcObject) {
                remoteAudioRef.current.play().catch(e => {
                  console.error('[CallView] Retry play failed:', e);
                });
              }
            }, 500);
          });
      }
    } else {
      console.warn('[CallView] No audio tracks in remote stream');
      // Очищаем srcObject если треков нет
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = null;
      }
    }
  }, [remoteStream]);

  // Удалённый видеопоток (для мини-окна)
  useEffect(() => {
    if (minimizedRemoteVideoRef.current && remoteStream && isMinimized) {
      minimizedRemoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, isMinimized]);

  // Таймер звонка
  useEffect(() => {
    if (!call || !isCallActive) {
      callStartTimeRef.current = null;
      callBecameActiveTimeRef.current = null;
      setCallDuration(0);
      return;
    }

    // Запоминаем время когда звонок стал активным (fallback)
    if (!callBecameActiveTimeRef.current) {
      callBecameActiveTimeRef.current = Date.now();
    }

    // Используем acceptedAt или startedAt из объекта call (приоритет acceptedAt)
    const acceptedAt = call.acceptedAt || call.startedAt;
    
    if (acceptedAt) {
      // Парсим ISO-8601 дату (может быть с миллисекундами: "2026-01-14T20:30:45.123")
      const startTime = new Date(acceptedAt).getTime();
      
      // Проверяем, что дата валидна и разумна (не в будущем и не слишком давно)
      const now = Date.now();
      if (!isNaN(startTime) && startTime > 0 && startTime <= now && startTime > now - 3600000) {
        // Обновляем время начала, если оно изменилось (например, при обновлении call из события)
        if (!callStartTimeRef.current || callStartTimeRef.current !== startTime) {
          callStartTimeRef.current = startTime;
        }
      } else {
        console.warn('[CallView] Invalid acceptedAt/startedAt:', acceptedAt, 'parsed as:', startTime);
        // Fallback на время когда звонок стал активным
        if (!callStartTimeRef.current) {
          callStartTimeRef.current = callBecameActiveTimeRef.current;
        }
      }
    } else {
      // Если acceptedAt не пришел, используем время когда звонок стал активным
      if (!callStartTimeRef.current) {
        console.warn('[CallView] No acceptedAt/startedAt in call object, using time when call became active');
        callStartTimeRef.current = callBecameActiveTimeRef.current;
      }
    }
    
    const interval = setInterval(() => {
      if (callStartTimeRef.current) {
        const now = Date.now();
        setCallDuration(Math.floor((now - callStartTimeRef.current) / 1000));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [call, isCallActive]);

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

        {/* Скрытый аудио-элемент для удаленного потока (для всех звонков) */}
        {remoteStream && (
          <audio
            ref={remoteAudioRef}
            autoPlay
            playsInline
            style={{ display: 'none' }}
          />
        )}

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

CallView.displayName = 'CallView';

export default CallView;
