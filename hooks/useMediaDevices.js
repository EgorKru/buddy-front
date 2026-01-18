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

      const constraints = {
        video: video ? {
          deviceId: selectedCamera ? { exact: selectedCamera } : undefined,
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        } : false,
        audio: audio ? {
          deviceId: selectedMicrophone ? { exact: selectedMicrophone } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
        } : false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      streamRef.current = stream;
      setPermissionGranted(true);
      setVideoEnabled(video);
      setAudioEnabled(audio);
      
      await getDevices();
      
      setLocalStream(stream);
      
      return stream;
    } catch (err) {
      let errorMessage = 'Не удалось получить доступ к устройствам';
      if (err.name === 'NotAllowedError') {
        errorMessage = 'Доступ к устройствам запрещён. Разрешите доступ в настройках браузера.';
      } else if (err.name === 'NotFoundError') {
        errorMessage = 'Устройство не найдено.';
      } else if (err.name === 'NotReadableError') {
        errorMessage = 'Устройство уже используется другим приложением.';
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
    const newAudioEnabled = !audioEnabled;

    if (!newAudioEnabled) {
      if (localStream) {
        const audioTracks = localStream.getAudioTracks();
        audioTracks.forEach(track => {
          track.enabled = false;
        });
      }
      setAudioEnabled(false);
      return;
    }

    if (!localStream) {
      
      try {
        setIsLoading(true);
        setError(null);
        const audioStream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: {
            deviceId: selectedMicrophone ? { exact: selectedMicrophone } : undefined,
            echoCancellation: true,
            noiseSuppression: true,
          },
        });
        
        streamRef.current = audioStream;
        setLocalStream(audioStream);
        setPermissionGranted(true);
        setAudioEnabled(true);
        await getDevices();
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
      } finally {
        setIsLoading(false);
      }
      return;
    }

    const audioTracks = localStream.getAudioTracks();
    if (audioTracks.length > 0) {
      
      audioTracks.forEach(track => {
        track.enabled = true;
      });
      setAudioEnabled(true);
    } else {
      
      try {
        setIsLoading(true);
        setError(null);
        const audioStream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: {
            deviceId: selectedMicrophone ? { exact: selectedMicrophone } : undefined,
            echoCancellation: true,
            noiseSuppression: true,
          },
        });
        
        const audioTrack = audioStream.getAudioTracks()[0];
        const videoTracks = localStream.getVideoTracks();
        if (audioTrack) {
          const allTracks = [...videoTracks, audioTrack].filter(Boolean);
          const updatedStream = new MediaStream(allTracks);
          streamRef.current = updatedStream;
          setAudioEnabled(true);
          setLocalStream(updatedStream);
          
          audioStream.getTracks().forEach(track => {
            if (track !== audioTrack) {
              track.stop();
            }
          });
        } else {
          audioStream.getTracks().forEach(track => track.stop());
        }
      } catch (err) {
        setError('Не удалось включить микрофон');
      } finally {
        setIsLoading(false);
      }
    }
  }, [localStream, audioEnabled, selectedMicrophone, getDevices]);

  const toggleVideo = useCallback(async () => {
    const newVideoEnabled = !videoEnabled;

    if (!newVideoEnabled) {
      if (localStream) {
        const videoTracks = localStream.getVideoTracks();
        videoTracks.forEach(track => {
          track.stop();
          localStream.removeTrack(track);
        });
        
        if (localStream.getTracks().length > 0) {
          const updatedStream = new MediaStream(localStream.getTracks());
          streamRef.current = updatedStream;
          setLocalStream(updatedStream);
        } else {
          setLocalStream(null);
          streamRef.current = null;
        }
      }
      setVideoEnabled(false);
      return;
    }

    if (!localStream) {
      
      try {
        setIsLoading(true);
        setError(null);
        const videoStream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: selectedCamera ? { exact: selectedCamera } : undefined,
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user'
          },
          audio: false,
        });
        
        streamRef.current = videoStream;
        setLocalStream(videoStream);
        setPermissionGranted(true);
        setVideoEnabled(true);
        await getDevices();
      } catch (err) {
        let errorMessage = 'Не удалось получить доступ к камере';
        if (err.name === 'NotAllowedError') {
          errorMessage = 'Доступ к камере запрещён. Разрешите доступ в настройках браузера.';
        } else if (err.name === 'NotFoundError') {
          errorMessage = 'Камера не найдена.';
        } else if (err.name === 'NotReadableError') {
          errorMessage = 'Камера уже используется другим приложением.';
        }
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    const videoTracks = localStream.getVideoTracks();
    if (videoTracks.length > 0) {
      const allEnabled = videoTracks.every(track => track.enabled);
      if (!allEnabled) {
        videoTracks.forEach(track => {
          track.enabled = true;
        });
      }
      setVideoEnabled(true);
      const updatedStream = new MediaStream(localStream.getTracks());
      streamRef.current = updatedStream;
      setLocalStream(updatedStream);
    } else {
      
      try {
        setIsLoading(true);
        setError(null);
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
        const audioTracks = localStream.getAudioTracks();
        if (videoTrack) {
          const allTracks = [videoTrack, ...audioTracks].filter(Boolean);
          const updatedStream = new MediaStream(allTracks);
          streamRef.current = updatedStream;
          setVideoEnabled(true);
          setLocalStream(updatedStream);
          
          videoStream.getTracks().forEach(track => {
            if (track !== videoTrack) {
              track.stop();
            }
          });
        } else {
          videoStream.getTracks().forEach(track => track.stop());
        }
      } catch (err) {
        setError('Не удалось включить камеру');
      } finally {
        setIsLoading(false);
      }
    }
  }, [localStream, videoEnabled, selectedCamera, getDevices]);

  const switchCamera = useCallback(async (deviceId) => {
    setSelectedCamera(deviceId);
    if (localStream && videoEnabled) {
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: { 
            deviceId: { exact: deviceId },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false,
        });
        
        const oldVideoTrack = localStream.getVideoTracks()[0];
        const newVideoTrack = newStream.getVideoTracks()[0];
        const audioTracks = localStream.getAudioTracks();
        
        if (!newVideoTrack) {
          newStream.getTracks().forEach(track => track.stop());
          setError('Не удалось получить видео трек с новой камеры');
          return;
        }
        
        if (oldVideoTrack) {
          oldVideoTrack.stop();
        }
        
        const allTracks = [newVideoTrack, ...audioTracks].filter(Boolean);
        const updatedStream = new MediaStream(allTracks);
        streamRef.current = updatedStream;
        setLocalStream(updatedStream);
        
        newStream.getTracks().forEach(track => {
          if (track !== newVideoTrack) {
            track.stop();
          }
        });
      } catch (err) {
        console.error('Ошибка переключения камеры:', err);
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
          audio: { 
            deviceId: { exact: deviceId },
            echoCancellation: true,
            noiseSuppression: true,
          },
        });
        
        const oldAudioTrack = localStream.getAudioTracks()[0];
        const newAudioTrack = newStream.getAudioTracks()[0];
        const videoTracks = localStream.getVideoTracks();
        
        if (!newAudioTrack) {
          newStream.getTracks().forEach(track => track.stop());
          setError('Не удалось получить аудио трек с нового микрофона');
          return;
        }
        
        if (oldAudioTrack) {
          localStream.removeTrack(oldAudioTrack);
          oldAudioTrack.stop();
        }
        
        localStream.addTrack(newAudioTrack);
        streamRef.current = localStream;
        
        setLocalStream(localStream);
        
        newStream.getTracks().forEach(track => {
          if (track !== newAudioTrack) {
            track.stop();
          }
        });
      } catch (err) {
        console.error('Ошибка переключения микрофона:', err);
        setError('Не удалось переключить микрофон');
      }
    }
  }, [localStream, audioEnabled]);

  const getStream = useCallback(() => {
    return streamRef.current;
  }, []);

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

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;

        const normalizedLevel = Math.min(100, (average / 128) * 100);
        setAudioLevel(normalizedLevel);

        if (normalizedLevel > 5 && !peakDetected) {
          peakDetected = true;
          setIsMicWorking(true);
        }
        
        animationFrameRef.current = requestAnimationFrame(checkAudioLevel);
      };
      
      checkAudioLevel();
    } catch (err) {
      
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

