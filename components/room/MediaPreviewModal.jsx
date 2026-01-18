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
      startPreview(true, true).catch(() => {});
    } else {
      stopPreview();
      setShowSettings(false);
    }
  }, [isOpen, startPreview, stopPreview]);

  useEffect(() => {
    if (!localStream) return;
    
    const updateVideo = () => {
      if (!videoRef.current) {
        setTimeout(updateVideo, 50);
        return;
      }
      
      const video = videoRef.current;
      const videoTracks = localStream.getVideoTracks();
      
      if (videoTracks.length > 0 && videoTracks[0].enabled) {
        if (video.srcObject !== localStream) {
          video.srcObject = localStream;
        } else {
          video.srcObject = null;
          setTimeout(() => {
            if (videoRef.current && localStream) {
              videoRef.current.srcObject = localStream;
            }
          }, 0);
        }
        
        const tryPlay = () => {
          if (videoRef.current && videoRef.current.srcObject === localStream) {
            videoRef.current.play().catch(() => {
              setTimeout(() => {
                if (videoRef.current && videoRef.current.srcObject === localStream) {
                  videoRef.current.play().catch(() => {});
                }
              }, 200);
            });
          }
        };
        
        const onCanPlay = () => {
          tryPlay();
          video.removeEventListener('canplay', onCanPlay);
          video.removeEventListener('loadedmetadata', onLoadedMetadata);
        };
        
        const onLoadedMetadata = () => {
          tryPlay();
          video.removeEventListener('canplay', onCanPlay);
          video.removeEventListener('loadedmetadata', onLoadedMetadata);
        };
        
        video.removeEventListener('canplay', onCanPlay);
        video.removeEventListener('loadedmetadata', onLoadedMetadata);
        
        if (video.readyState >= 2) {
          setTimeout(tryPlay, 50);
        } else {
          video.addEventListener('canplay', onCanPlay, { once: true });
          video.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
          
          setTimeout(() => {
            if (videoRef.current && videoRef.current.srcObject === localStream) {
              tryPlay();
            }
          }, 200);
        }
        
        setTimeout(tryPlay, 100);
      } else {
        if (video.srcObject) {
          video.srcObject = null;
        }
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
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={styles.video}
              />
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

