import { useEffect, useRef, useState } from 'react';
import { X, Video, VideoOff, Mic, MicOff, Settings, ChevronDown, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { useMediaDevices } from '@/hooks/useMediaDevices';
import styles from './MediaPreviewModal.module.css';

export default function MediaPreviewModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = 'Настройка камеры и микрофона',
  confirmText = 'Присоединиться',
  isCreating = false,
}) {
  const videoRef = useRef(null);
  const previousStreamRef = useRef(null);
  const previousVideoTrackIdRef = useRef(null);
  const isUpdatingRef = useRef(false);
  const [showSettings, setShowSettings] = useState(false);
  
  const {
    devices,
    selectedCamera,
    selectedMicrophone,
    localStream,
    audioEnabled,
    videoEnabled,
    isLoading,
    error,
    permissionGranted,
    audioLevel,
    isMicWorking,
    startPreview,
    stopPreview,
    toggleAudio,
    toggleVideo,
    switchCamera,
    switchMicrophone,
    getStream,
    setError,
  } = useMediaDevices();

  useEffect(() => {
    if (isOpen) {
      previousStreamRef.current = null;
      previousVideoTrackIdRef.current = null;
      startPreview(true, true)
        .then((stream) => {
          if (stream && videoRef.current) {
            setTimeout(() => {
              if (videoRef.current && stream) {
                videoRef.current.srcObject = stream;
                videoRef.current.play().catch(() => {});
              }
            }, 100);
          }
        })
        .catch(() => {});
    } else {
      stopPreview();
      setShowSettings(false);
      previousStreamRef.current = null;
      previousVideoTrackIdRef.current = null;
    }
  }, [isOpen, startPreview, stopPreview]);

  useEffect(() => {
    if (!localStream) {
      if (videoRef.current && videoRef.current.srcObject && !isUpdatingRef.current) {
        videoRef.current.srcObject = null;
      }
      previousVideoTrackIdRef.current = null;
      previousStreamRef.current = null;
      isUpdatingRef.current = false;
      return;
    }
    
    if (isUpdatingRef.current) {
      return;
    }
    
    const currentVideoTracks = localStream.getVideoTracks();
    if (currentVideoTracks.length === 0 || !currentVideoTracks[0].enabled) {
      isUpdatingRef.current = false;
      return;
    }
    
    const updateVideo = () => {
      if (!videoRef.current) {
        setTimeout(updateVideo, 50);
        return;
      }
      
      const video = videoRef.current;
      const videoTracks = localStream.getVideoTracks();
      
      if (videoTracks.length > 0 && videoTracks[0].enabled) {
        const currentVideoTrackId = videoTracks[0].id;
        const currentSrcObject = video.srcObject;
        
        const videoTrackChanged = previousVideoTrackIdRef.current !== currentVideoTrackId;
        const hasNoPreviousTrack = previousVideoTrackIdRef.current === null;
        const streamChanged = previousStreamRef.current !== localStream;
        const hasNoVideoInCurrentSrc = !currentSrcObject || currentSrcObject.getVideoTracks().length === 0;
        const srcObjectDifferent = currentSrcObject !== localStream;
        
        const isSameTrackAndStream = currentSrcObject === localStream && 
                                     previousVideoTrackIdRef.current === currentVideoTrackId &&
                                     previousStreamRef.current === localStream;
        
        if (!isSameTrackAndStream) {
          if (srcObjectDifferent || videoTrackChanged || hasNoPreviousTrack || hasNoVideoInCurrentSrc || streamChanged) {
            isUpdatingRef.current = true;
            
            if (video.srcObject !== localStream) {
              video.srcObject = localStream;
            }
            
            previousVideoTrackIdRef.current = currentVideoTrackId;
            previousStreamRef.current = localStream;
            
            setTimeout(() => {
              if (videoRef.current && videoRef.current.srcObject === localStream) {
                isUpdatingRef.current = false;
              } else {
            setTimeout(() => {
              if (videoRef.current && videoRef.current.srcObject === localStream) {
                isUpdatingRef.current = false;
              } else {
                setTimeout(() => {
                  isUpdatingRef.current = false;
                }, 100);
              }
            }, 300);
              }
            }, 300);
          }
        } else {
          previousStreamRef.current = localStream;
        }
        
        const tryPlay = () => {
          if (!videoRef.current) return;
          
          const currentVideo = videoRef.current;
          if (currentVideo.srcObject === localStream) {
            const playPromise = currentVideo.play();
            if (playPromise !== undefined) {
              playPromise.catch((err) => {
                setTimeout(() => {
                  if (currentVideo && currentVideo.srcObject === localStream) {
                    currentVideo.play().catch(() => {});
                  }
                }, 100);
              });
            }
          }
        };
        
        const onCanPlay = () => {
          tryPlay();
        };
        
        const onLoadedMetadata = () => {
          tryPlay();
        };
        
        const onLoadedData = () => {
          tryPlay();
        };
        
        video.removeEventListener('canplay', onCanPlay);
        video.removeEventListener('loadedmetadata', onLoadedMetadata);
        video.removeEventListener('loadeddata', onLoadedData);
        
        if (video.readyState >= 2) {
          setTimeout(tryPlay, 10);
        } else {
          video.addEventListener('canplay', onCanPlay, { once: true });
          video.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
          video.addEventListener('loadeddata', onLoadedData, { once: true });
        }
        
        setTimeout(tryPlay, 50);
        setTimeout(tryPlay, 150);
        
        return () => {
          video.removeEventListener('canplay', onCanPlay);
          video.removeEventListener('loadedmetadata', onLoadedMetadata);
          video.removeEventListener('loadeddata', onLoadedData);
        };
      } else {
        if (video.srcObject && !isUpdatingRef.current) {
          video.srcObject = null;
        }
        previousVideoTrackIdRef.current = null;
        previousStreamRef.current = null;
        isUpdatingRef.current = false;
      }
    };
    
    updateVideo();
  }, [localStream, videoEnabled]);

  const handleConfirm = () => {

    const finalAudio = audioEnabled || (!audioEnabled && !videoEnabled);
    const finalVideo = videoEnabled;
    
    const stream = getStream();
    onConfirm({
      stream,
      audioEnabled: finalAudio,
      videoEnabled: finalVideo,
    });
  };

  const handleClose = () => {
    stopPreview();
    onClose();
  };

  const handleRetry = () => {
    setError(null);
    startPreview(false, false).catch(() => {});
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          <button className={styles.closeButton} onClick={handleClose}>
            <X size={20} />
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.videoContainer}>
            {isLoading ? (
              <div className={styles.loadingState}>
                <Loader2 className={styles.spinner} size={48} />
                <p>Запрос доступа к камере...</p>
              </div>
            ) : error ? (
              <div className={styles.errorState}>
                <VideoOff size={48} />
                <p className={styles.errorText}>{error}</p>
                <button className={styles.retryButton} onClick={handleRetry}>
                  Попробовать снова
                </button>
              </div>
            ) : !videoEnabled || !localStream || !localStream.getVideoTracks().length || (localStream.getVideoTracks()[0] && !localStream.getVideoTracks()[0].enabled) ? (
              <div className={styles.cameraOff}>
                <VideoOff size={64} />
                <p>Камера выключена</p>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={styles.video}
                />
              </>
            )}
          </div>

          {}
          {permissionGranted && audioEnabled && (
            <div className={styles.micTest}>
              <div className={styles.micTestHeader}>
                <span className={styles.micTestLabel}>Проверка микрофона</span>
                {isMicWorking ? (
                  <span className={styles.micTestStatus}>
                    <CheckCircle size={16} className={styles.micTestOk} />
                    Микрофон работает
                  </span>
                ) : (
                  <span className={styles.micTestStatus}>
                    <AlertCircle size={16} className={styles.micTestWaiting} />
                    Скажите что-нибудь...
                  </span>
                )}
              </div>
              <div className={styles.audioLevelContainer}>
                <div className={styles.audioLevelBars}>
                  {[...Array(20)].map((_, i) => (
                    <div
                      key={i}
                      className={`${styles.audioLevelBar} ${
                        i < Math.floor(audioLevel / 5) ? styles.audioLevelBarActive : ''
                      } ${i >= 16 ? styles.audioLevelBarHigh : ''}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className={styles.controls}>
            <button
              className={`${styles.controlButton} ${!audioEnabled ? styles.disabled : ''}`}
              onClick={toggleAudio}
              type="button"
            >
              {audioEnabled ? <Mic size={24} /> : <MicOff size={24} />}
              <span>{audioEnabled ? 'Микрофон вкл' : 'Микрофон выкл'}</span>
            </button>

            <button
              className={`${styles.controlButton} ${!videoEnabled ? styles.disabled : ''}`}
              onClick={toggleVideo}
              type="button"
            >
              {videoEnabled ? <Video size={24} /> : <VideoOff size={24} />}
              <span>{videoEnabled ? 'Камера вкл' : 'Камера выкл'}</span>
            </button>

            <button
              className={`${styles.controlButton} ${styles.settingsButton}`}
              onClick={() => setShowSettings(!showSettings)}
              disabled={!permissionGranted}
            >
              <Settings size={24} />
              <span>Настройки</span>
              <ChevronDown 
                size={16} 
                className={`${styles.chevron} ${showSettings ? styles.chevronOpen : ''}`} 
              />
            </button>
          </div>

          {showSettings && permissionGranted && (
            <div className={styles.settingsPanel}>
              <div className={styles.settingGroup}>
                <label className={styles.settingLabel}>Камера</label>
                <select
                  className={styles.select}
                  value={selectedCamera}
                  onChange={(e) => switchCamera(e.target.value)}
                >
                  {devices.cameras.map(device => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `Камера ${devices.cameras.indexOf(device) + 1}`}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.settingGroup}>
                <label className={styles.settingLabel}>Микрофон</label>
                <select
                  className={styles.select}
                  value={selectedMicrophone}
                  onChange={(e) => switchMicrophone(e.target.value)}
                >
                  {devices.microphones.map(device => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `Микрофон ${devices.microphones.indexOf(device) + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelButton} onClick={handleClose}>
            Отмена
          </button>
          <button 
            className={styles.confirmButton} 
            onClick={handleConfirm}
            disabled={isCreating}
          >
            {isCreating ? (
              <>
                <Loader2 className={styles.buttonSpinner} size={18} />
                Создание...
              </>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

