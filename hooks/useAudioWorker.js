import { useEffect, useRef, useCallback } from 'react';

export const useAudioWorker = () => {
  const workerRef = useRef(null);
  const callbacksRef = useRef(new Map());
  const taskIdRef = useRef(0);

  useEffect(() => {
    
    if (typeof Worker !== 'undefined' && !workerRef.current) {
      try {
        workerRef.current = new Worker('/workers/audio-worker.js');
        
        workerRef.current.addEventListener('message', (event) => {
          const { id, type, data, error } = event.data;
          
          if (type === 'READY') {
            
            return;
          }

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
          
        });
      } catch (error) {
        
      }
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
        callbacksRef.current.clear();
      }
    };
  }, []);

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

      setTimeout(() => {
        if (callbacksRef.current.has(id)) {
          callbacksRef.current.delete(id);
          reject(new Error('Audio Worker task timeout'));
        }
      }, 30000); 
    });
  }, []);

  const encodeAudio = useCallback(async (audioBuffer, format = 'webm') => {
    try {
      const result = await sendTask('ENCODE_AUDIO', { audioBuffer, format });
      return result;
    } catch (error) {
      
      throw error;
    }
  }, [sendTask]);

  const decodeAudio = useCallback(async (audioData) => {
    try {
      const result = await sendTask('DECODE_AUDIO', { audioData });
      return result;
    } catch (error) {
      
      throw error;
    }
  }, [sendTask]);

  const analyzeAudio = useCallback(async (audioBuffer) => {
    try {
      const result = await sendTask('ANALYZE_AUDIO', { audioBuffer });
      return result;
    } catch (error) {
      
      throw error;
    }
  }, [sendTask]);

  const compressAudio = useCallback(async (audioData, quality = 0.7) => {
    try {
      const result = await sendTask('COMPRESS_AUDIO', { audioData, quality });
      return result;
    } catch (error) {
      
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

