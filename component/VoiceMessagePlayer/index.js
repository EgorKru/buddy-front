/**
 * VoiceMessagePlayer Component
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Pin } from 'lucide-react';
import { chatAPI, getToken } from '@/utils/api';
import { useVoicePlayer } from '@/context/voicePlayer';
import AudioWaveform from '@/component/AudioWaveform';
import styles from './index.module.css';

export default function VoiceMessagePlayer({ fileUrl, duration: propDuration, messageTime, isOwn, statusIcon, isPinned }) {
  const [audioUrl, setAudioUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const audioRef = useRef(null);
  const blobUrlRef = useRef(null);
  
  const playerIdRef = useRef(fileUrl || `player-${Date.now()}-${Math.random()}`);
  const { activePlayerId, registerPlayer, unregisterPlayer } = useVoicePlayer();

  const stopPlayback = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
  }, []);

  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, []);

  const loadAudioWithAuth = async () => {
    if (blobUrlRef.current) {
      return blobUrlRef.current;
    }

    const url = chatAPI.getVoiceFileUrl(fileUrl);
    const token = getToken();

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });

      if (!response.ok) {
        throw new Error(`Failed to load audio: ${response.status}`);
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      blobUrlRef.current = blobUrl;
      setAudioUrl(blobUrl);
      
      if (audioRef.current) {
        audioRef.current.src = blobUrl;
      }
      
      setIsLoading(false);
      return blobUrl;
    } catch (err) {
      setIsLoading(false);
      setError('Не удалось загрузить');
      throw err;
    }
  };

  useEffect(() => {
    if (fileUrl && !blobUrlRef.current) {
      loadAudioWithAuth().catch(() => {});
    }
  }, [fileUrl]);

  const handlePlay = useCallback(async () => {
    if (!audioUrl) {
      try {
        await loadAudioWithAuth();
      } catch (err) {
        return;
      }
    }
    
    if (activePlayerId && activePlayerId !== playerIdRef.current) {
      return;
    }

    registerPlayer(playerIdRef.current, stopPlayback);
    
    try {
      await audioRef.current.play();
    } catch (err) {
      setError('Ошибка воспроизведения');
      unregisterPlayer(playerIdRef.current);
    }
  }, [audioUrl, activePlayerId, registerPlayer, stopPlayback, unregisterPlayer]);

  const handlePause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      unregisterPlayer(playerIdRef.current);
    }
  }, [unregisterPlayer]);

  const handleEnded = useCallback(() => {
    unregisterPlayer(playerIdRef.current);
  }, [unregisterPlayer]);

  useEffect(() => {
    if (activePlayerId && activePlayerId !== playerIdRef.current && audioRef.current) {
      audioRef.current.pause();
    }
  }, [activePlayerId]);

  if (error) {
    return (
      <div className={styles.voiceMessage}>
        <div className={styles.error}>{error}</div>
      </div>
    );
  }

  return (
    <div className={styles.voiceMessage}>
      <div className={styles.audioWaveformWrapper}>
        <AudioWaveform
          src={audioUrl || ''}
          style="viridara"
          theme="dark"
          height={50}
          width={240}
          barSpacing={2}
          showControls={true}
          showTimestamp={true}
          showSpeedControl={true}
          showBackground={false}
          primaryColor="#1DB954"
          progressColor="#0d9488"
          onPlay={handlePlay}
          onPause={handlePause}
          onEnded={handleEnded}
          externalAudioRef={audioRef}
        />
      </div>
      
      <div className={styles.messageMeta}>
        {isPinned && (
          <Pin size={12} className={styles.pinnedIcon} title="Закреплено" />
        )}
        {messageTime && (
          <span className={styles.messageTime}>{messageTime}</span>
        )}
        {isOwn && statusIcon}
      </div>
      
      <audio ref={audioRef} preload="none" />
    </div>
  );
}
