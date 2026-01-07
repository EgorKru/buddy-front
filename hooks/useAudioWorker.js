import { useEffect, useRef, useCallback } from 'react';

/**
 * Hook для работы с Web Worker обработки аудио
 * Offloads heavy audio processing to a separate thread
 */
export const useAudioWorker = () => {
  const workerRef = useRef(null);
  const callbacksRef = useRef(new Map());
  const taskIdRef = useRef(0);

  useEffect(() => {
    // Инициализация Web Worker
    if (typeof Worker !== 'undefined' && !workerRef.current) {
      try {
        workerRef.current = new Worker('/workers/audio-worker.js');
        
        workerRef.current.addEventListener('message', (event) => {
          const { id, type, data, error } = event.data;
          
          if (type === 'READY') {
            console.log('[Audio Worker] Ready');
            return;
          }
          
          // Вызываем соответствующий callback
          const callback = callbacksRef.current.get(id);
          if (callback) {
            if (type === 'ERROR') {
              callback.reject(new Error(error));
            } else {
              callback.resolve(data);
            }
            callbacksRef.current.delete(id);
          }
        });
        
        workerRef.current.addEventListener('error', (error) => {
          console.error('[Audio Worker] Error:', error);
        });
      } catch (error) {
        console.error('[Audio Worker] Failed to initialize:', error);
      }
    }
    
    // Cleanup при размонтировании
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
        callbacksRef.current.clear();
      }
    };
  }, []);

  /**
   * Отправка задачи в Web Worker
   */
  const sendTask = useCallback((type, payload) => {
    return new Promise((resolve, reject) => {
      if (!workerRef.current) {
        reject(new Error('Audio Worker not available'));
        return;
      }
      
      const id = taskIdRef.current++;
      callbacksRef.current.set(id, { resolve, reject });
      
      workerRef.current.postMessage({
        id,
        type,
        payload
      });
      
      // Таймаут для предотвращения зависания
      setTimeout(() => {
        if (callbacksRef.current.has(id)) {
          callbacksRef.current.delete(id);
          reject(new Error('Audio Worker task timeout'));
        }
      }, 30000); // 30 секунд
    });
  }, []);

  /**
   * Кодирование аудио
   */
  const encodeAudio = useCallback(async (audioBuffer, format = 'webm') => {
    try {
      const result = await sendTask('ENCODE_AUDIO', { audioBuffer, format });
      return result;
    } catch (error) {
      console.error('[Audio Worker] Encode failed:', error);
      throw error;
    }
  }, [sendTask]);

  /**
   * Декодирование аудио
   */
  const decodeAudio = useCallback(async (audioData) => {
    try {
      const result = await sendTask('DECODE_AUDIO', { audioData });
      return result;
    } catch (error) {
      console.error('[Audio Worker] Decode failed:', error);
      throw error;
    }
  }, [sendTask]);

  /**
   * Анализ аудио (уровень громкости, длительность)
   */
  const analyzeAudio = useCallback(async (audioBuffer) => {
    try {
      const result = await sendTask('ANALYZE_AUDIO', { audioBuffer });
      return result;
    } catch (error) {
      console.error('[Audio Worker] Analyze failed:', error);
      throw error;
    }
  }, [sendTask]);

  /**
   * Сжатие аудио
   */
  const compressAudio = useCallback(async (audioData, quality = 0.7) => {
    try {
      const result = await sendTask('COMPRESS_AUDIO', { audioData, quality });
      return result;
    } catch (error) {
      console.error('[Audio Worker] Compress failed:', error);
      throw error;
    }
  }, [sendTask]);

  return {
    encodeAudio,
    decodeAudio,
    analyzeAudio,
    compressAudio,
    isAvailable: workerRef.current !== null
  };
};

