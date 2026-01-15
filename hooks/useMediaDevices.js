import { useState, useEffect, useCallback, useRef } from 'react';

export function useMediaDevices() {
  const [devices, setDevices] = useState({ cameras: [], microphones: [], speakers: [] });
  const [selectedCamera, setSelectedCamera] = useState('');
  const [selectedMicrophone, setSelectedMicrophone] = useState('');
  const [localStream, setLocalStream] = useState(null);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isMicWorking, setIsMicWorking] = useState(false);
  
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);

  const getDevices = useCallback(async () => {
    try {
      const deviceList = await navigator.mediaDevices.enumerateDevices();
      const cameras = deviceList.filter(d => d.kind === 'videoinput');
      const microphones = deviceList.filter(d => d.kind === 'audioinput');
      const speakers = deviceList.filter(d => d.kind === 'audiooutput');
      
      setDevices({ cameras, microphones, speakers });
      
      if (cameras.length > 0 && !selectedCamera) {
        setSelectedCamera(cameras[0].deviceId);
      }
      if (microphones.length > 0 && !selectedMicrophone) {
        setSelectedMicrophone(microphones[0].deviceId);
      }
      
      return { cameras, microphones, speakers };
    } catch (err) {
      setError('Не удалось получить список устройств');
      return { cameras: [], microphones: [], speakers: [] };
    }
  }, [selectedCamera, selectedMicrophone]);

  const startPreview = useCallback(async (video = false, audio = false) => {
    setIsLoading(true);
    setError(null);
    
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      // Запрашиваем доступ к устройствам (нужно для получения разрешения),
      // но затем выключим треки если они не нужны
      const constraints = {
        video: {
          deviceId: selectedCamera ? { exact: selectedCamera } : undefined,
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: {
          deviceId: selectedMicrophone ? { exact: selectedMicrophone } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Выключаем треки если они не нужны
      stream.getVideoTracks().forEach(track => {
        track.enabled = video;
      });
      stream.getAudioTracks().forEach(track => {
        track.enabled = audio;
      });
      
      streamRef.current = stream;
      setLocalStream(stream);
      setPermissionGranted(true);
      setVideoEnabled(video);
      setAudioEnabled(audio);
      
      await getDevices();
      
      return stream;
    } catch (err) {
      let errorMessage = 'Не удалось получить доступ к микрофону';
      if (err.name === 'NotAllowedError') {
        errorMessage = 'Доступ к микрофону запрещён. Разрешите доступ в настройках браузера.';
      } else if (err.name === 'NotFoundError') {
        errorMessage = 'Микрофон не найден.';
      } else if (err.name === 'NotReadableError') {
        errorMessage = 'Микрофон уже используется другим приложением.';
      }
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [selectedCamera, selectedMicrophone, getDevices]);

  const stopPreview = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setLocalStream(null);
  }, []);

  const toggleAudio = useCallback(async () => {
    if (!localStream) {
      // Если стрима нет, запрашиваем доступ при включении
      if (!audioEnabled) {
        try {
          await startPreview(videoEnabled, true);
        } catch (err) {
          // Ошибка уже обработана в startPreview
        }
      }
      return;
    }
    
    const audioTracks = localStream.getAudioTracks();
    if (audioTracks.length > 0) {
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setAudioEnabled(prev => !prev);
    } else if (!audioEnabled) {
      // Если треков нет, но хотим включить - запрашиваем доступ
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: {
            deviceId: selectedMicrophone ? { exact: selectedMicrophone } : undefined,
            echoCancellation: true,
            noiseSuppression: true,
          },
        });
        
        const audioTrack = audioStream.getAudioTracks()[0];
        if (audioTrack) {
          localStream.addTrack(audioTrack);
          setAudioEnabled(true);
          setLocalStream(new MediaStream(localStream.getTracks()));
        }
      } catch (err) {
        setError('Не удалось включить микрофон');
      }
    }
  }, [localStream, audioEnabled, videoEnabled, selectedMicrophone, startPreview]);

  const toggleVideo = useCallback(async () => {
    if (!localStream) {
      // Если стрима нет, запрашиваем доступ при включении
      if (!videoEnabled) {
        try {
          await startPreview(true, audioEnabled);
        } catch (err) {
          // Ошибка уже обработана в startPreview
        }
      }
      return;
    }
    
    const videoTracks = localStream.getVideoTracks();
    
    if (videoTracks.length > 0) {
      videoTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setVideoEnabled(prev => !prev);
      // Обновляем стрим, чтобы React перерендерил компонент
      setLocalStream(new MediaStream(localStream.getTracks()));
    } else if (!videoEnabled) {
      // Если треков нет, но хотим включить - запрашиваем доступ
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: selectedCamera ? { exact: selectedCamera } : undefined,
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user'
          },
          audio: false,
        });
        
        const videoTrack = videoStream.getVideoTracks()[0];
        if (videoTrack) {
          localStream.addTrack(videoTrack);
          setVideoEnabled(true);
          // Обновляем стрим, чтобы React перерендерил компонент
          setLocalStream(new MediaStream(localStream.getTracks()));
        }
      } catch (err) {
        setError('Не удалось включить камеру');
      }
    }
  }, [localStream, videoEnabled, audioEnabled, selectedCamera, startPreview]);

  const switchCamera = useCallback(async (deviceId) => {
    setSelectedCamera(deviceId);
    if (localStream && videoEnabled) {
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: deviceId } },
          audio: false,
        });
        
        const oldVideoTrack = localStream.getVideoTracks()[0];
        const newVideoTrack = newStream.getVideoTracks()[0];
        
        if (oldVideoTrack) {
          localStream.removeTrack(oldVideoTrack);
          oldVideoTrack.stop();
        }
        localStream.addTrack(newVideoTrack);
        
        setLocalStream(localStream);
      } catch (err) {
        setError('Не удалось переключить камеру');
      }
    }
  }, [localStream, videoEnabled]);

  const switchMicrophone = useCallback(async (deviceId) => {
    setSelectedMicrophone(deviceId);
    if (localStream && audioEnabled) {
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: { deviceId: { exact: deviceId } },
        });
        
        const oldAudioTrack = localStream.getAudioTracks()[0];
        const newAudioTrack = newStream.getAudioTracks()[0];
        
        if (oldAudioTrack) {
          localStream.removeTrack(oldAudioTrack);
          oldAudioTrack.stop();
        }
        localStream.addTrack(newAudioTrack);
        
        setLocalStream(localStream);
      } catch (err) {
        setError('Не удалось переключить микрофон');
      }
    }
  }, [localStream, audioEnabled]);

  const getStream = useCallback(() => {
    return streamRef.current;
  }, []);

  // Анализ уровня звука микрофона
  const startAudioAnalysis = useCallback((stream) => {
    try {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = audioContext;
      
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;
      
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let peakDetected = false;
      
      const checkAudioLevel = () => {
        if (!analyserRef.current) return;
        
        analyserRef.current.getByteFrequencyData(dataArray);
        
        // Вычисляем средний уровень громкости
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        
        // Нормализуем до 0-100
        const normalizedLevel = Math.min(100, (average / 128) * 100);
        setAudioLevel(normalizedLevel);
        
        // Если уровень выше порога, значит микрофон работает
        if (normalizedLevel > 5 && !peakDetected) {
          peakDetected = true;
          setIsMicWorking(true);
        }
        
        animationFrameRef.current = requestAnimationFrame(checkAudioLevel);
      };
      
      checkAudioLevel();
    } catch (err) {
      console.error('Ошибка анализа аудио:', err);
    }
  }, []);

  const stopAudioAnalysis = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setAudioLevel(0);
    setIsMicWorking(false);
  }, []);

  // Запускаем анализ при получении стрима
  useEffect(() => {
    if (localStream && audioEnabled) {
      const audioTracks = localStream.getAudioTracks();
      if (audioTracks.length > 0) {
        startAudioAnalysis(localStream);
      }
    } else {
      stopAudioAnalysis();
    }
    
    return () => {
      stopAudioAnalysis();
    };
  }, [localStream, audioEnabled, startAudioAnalysis, stopAudioAnalysis]);

  useEffect(() => {
    return () => {
      stopAudioAnalysis();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [stopAudioAnalysis]);

  return {
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
    getDevices,
    setError,
  };
}

