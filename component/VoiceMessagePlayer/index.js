/**
 * VoiceMessagePlayer Component
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Pin } from 'lucide-react';
import { chatAPI, getToken } from '@/utils/api';
import { useVoicePlayer } from '@/context/voicePlayer';
import AudioWaveform from '@/component/AudioWaveform';
import styles from './index.module.css';

// Глобальный кэш blob URL по fileUrl для переиспользования
const blobUrlCache = new Map();
const blobUrlRefCount = new Map(); // Счетчик ссылок для каждого blob URL
const loadingPromises = new Map(); // Очередь загрузки - один промис на fileUrl
const MAX_CONCURRENT_LOADS = 3; // Максимум одновременных загрузок
const MAX_CACHE_SIZE = 50; // Максимум blob URL в кэше
let currentLoads = 0;
const loadQueue = []; // Очередь ожидающих загрузок

// Очистка старых записей из кэша при превышении лимита
const cleanupCache = () => {
  if (blobUrlCache.size > MAX_CACHE_SIZE) {
    // Удаляем самые старые записи (FIFO)
    const entriesToRemove = blobUrlCache.size - MAX_CACHE_SIZE;
    let removed = 0;
    for (const [fileUrl, blobUrl] of blobUrlCache.entries()) {
      if (removed >= entriesToRemove) break;

      const count = blobUrlRefCount.get(blobUrl) || 0;
      if (count === 0) {
        // Можно безопасно удалить
        blobUrlCache.delete(fileUrl);
        blobUrlRefCount.delete(blobUrl);
        URL.revokeObjectURL(blobUrl);
        removed++;
      }
    }
  }
};

export default function VoiceMessagePlayer({
  fileUrl,
  duration: propDuration,
  messageTime,
  isOwn,
  statusIcon,
  isPinned,
}) {
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

  // Очистка blob URL при размонтировании
  useEffect(() => {
    return () => {
      if (blobUrlRef.current && fileUrl) {
        const count = blobUrlRefCount.get(blobUrlRef.current) || 0;
        if (count <= 1) {
          // Последняя ссылка - удаляем из кэша и освобождаем память
          blobUrlCache.delete(fileUrl);
          blobUrlRefCount.delete(blobUrlRef.current);
          URL.revokeObjectURL(blobUrlRef.current);
        } else {
          // Уменьшаем счетчик ссылок
          blobUrlRefCount.set(blobUrlRef.current, count - 1);
        }
        blobUrlRef.current = null;
      }
    };
  }, [fileUrl]);

  const processLoadQueue = () => {
    while (loadQueue.length > 0 && currentLoads < MAX_CONCURRENT_LOADS) {
      const { fileUrl: queuedFileUrl, url: fetchUrl, token, resolve } = loadQueue.shift();
      currentLoads++;

      fetch(fetchUrl, {
        method: 'GET',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Failed to load audio: ${response.status}`);
          }
          return response.blob();
        })
        .then((blob) => {
          const blobUrl = URL.createObjectURL(blob);
          blobUrlCache.set(queuedFileUrl, blobUrl);
          blobUrlRefCount.set(blobUrl, 0); // Будет увеличен при использовании
          currentLoads--;
          cleanupCache(); // Очищаем старые записи если нужно
          resolve(blobUrl);
          processLoadQueue(); // Обрабатываем следующую в очереди
        })
        .catch((err) => {
          currentLoads--;
          resolve(null);
          processLoadQueue(); // Обрабатываем следующую в очереди
        });
    }
  };

  const loadAudioWithAuth = async () => {
    if (!fileUrl) return null;

    // Проверяем кэш
    if (blobUrlCache.has(fileUrl)) {
      const cachedBlobUrl = blobUrlCache.get(fileUrl);
      blobUrlRef.current = cachedBlobUrl;
      setAudioUrl(cachedBlobUrl);

      // Увеличиваем счетчик ссылок
      const count = blobUrlRefCount.get(cachedBlobUrl) || 0;
      blobUrlRefCount.set(cachedBlobUrl, count + 1);

      if (audioRef.current) {
        audioRef.current.src = cachedBlobUrl;
      }

      return cachedBlobUrl;
    }

    // Если уже загружаем этот файл, ждем существующий промис
    if (loadingPromises.has(fileUrl)) {
      const blobUrl = await loadingPromises.get(fileUrl);
      if (blobUrl) {
        blobUrlRef.current = blobUrl;
        setAudioUrl(blobUrl);
        const count = blobUrlRefCount.get(blobUrl) || 0;
        blobUrlRefCount.set(blobUrl, count + 1);
        if (audioRef.current) {
          audioRef.current.src = blobUrl;
        }
      }
      return blobUrl;
    }

    // Если уже есть blobUrlRef, возвращаем его
    if (blobUrlRef.current) {
      return blobUrlRef.current;
    }

    const fetchUrl = chatAPI.getVoiceFileUrl(fileUrl);
    const token = getToken();

    setIsLoading(true);
    setError(null);

    // Создаем промис для загрузки
    const loadPromise = new Promise((resolve) => {
      const startLoad = () => {
        currentLoads++;
        fetch(fetchUrl, {
          method: 'GET',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
          .then((response) => {
            if (!response.ok) {
              throw new Error(`Failed to load audio: ${response.status}`);
            }
            return response.blob();
          })
          .then((blob) => {
            const blobUrl = URL.createObjectURL(blob);
            blobUrlCache.set(fileUrl, blobUrl);
            blobUrlRefCount.set(blobUrl, 0); // Будет увеличен при использовании
            currentLoads--;
            cleanupCache(); // Очищаем старые записи если нужно
            resolve(blobUrl);
            processLoadQueue(); // Обрабатываем следующую в очереди
          })
          .catch((err) => {
            currentLoads--;
            resolve(null);
            processLoadQueue(); // Обрабатываем следующую в очереди
          });
      };

      if (currentLoads < MAX_CONCURRENT_LOADS) {
        // Можем загрузить сразу
        startLoad();
      } else {
        // Добавляем в очередь
        loadQueue.push({ fileUrl, url: fetchUrl, token, resolve });
      }
    });

    loadingPromises.set(fileUrl, loadPromise);

    try {
      const blobUrl = await loadPromise;
      loadingPromises.delete(fileUrl);

      if (blobUrl) {
        blobUrlRef.current = blobUrl;
        setAudioUrl(blobUrl);
        const count = blobUrlRefCount.get(blobUrl) || 0;
        blobUrlRefCount.set(blobUrl, count + 1);

        if (audioRef.current) {
          audioRef.current.src = blobUrl;
        }

        setIsLoading(false);
        return blobUrl;
      }

      setIsLoading(false);
      return null;
    } catch (err) {
      loadingPromises.delete(fileUrl);
      setIsLoading(false);
      setError('Не удалось загрузить');
      return null;
    }
  };

  // Предзагружаем аудио при монтировании с задержкой, чтобы не перегружать сеть
  useEffect(() => {
    if (fileUrl) {
      // Небольшая задержка для батчинга загрузок
      const timeoutId = setTimeout(() => {
        loadAudioWithAuth().catch(() => {});
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [fileUrl]);

  const handlePlay = useCallback(async () => {
    if (!audioUrl) {
      try {
        await loadAudioWithAuth();
        // После загрузки audioUrl обновится, но нужно подождать обновления
        // Поэтому проверяем еще раз
        if (!blobUrlRef.current) {
          return;
        }
      } catch (err) {
        return;
      }
    }

    if (activePlayerId && activePlayerId !== playerIdRef.current) {
      return;
    }

    registerPlayer(playerIdRef.current, stopPlayback);

    try {
      // Убеждаемся, что src установлен
      if (audioRef.current && !audioRef.current.src && blobUrlRef.current) {
        audioRef.current.src = blobUrlRef.current;
      }
      await audioRef.current.play();
    } catch (err) {
      setError('Ошибка воспроизведения');
      unregisterPlayer(playerIdRef.current);
    }
  }, [audioUrl, activePlayerId, registerPlayer, stopPlayback, unregisterPlayer, fileUrl]);

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
          initialDuration={propDuration}
          onPlay={handlePlay}
          onPause={handlePause}
          onEnded={handleEnded}
          externalAudioRef={audioRef}
        />
      </div>

      <div className={styles.messageMeta}>
        {isPinned && <Pin size={12} className={styles.pinnedIcon} title="Закреплено" />}
        {messageTime && <span className={styles.messageTime}>{messageTime}</span>}
        {isOwn && statusIcon}
      </div>

      <audio ref={audioRef} preload="none" />
    </div>
  );
}
