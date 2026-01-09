import { useState, useEffect, useCallback, useRef } from 'react';

export function useMediaDevices() {
  const [devices, setDevices] = useState({ cameras: [], microphones: [], speakers: [] });
  const [selectedCamera, setSelectedCamera] = useState('');
  const [selectedMicrophone, setSelectedMicrophone] = useState('');
  const [localStream, setLocalStream] = useState(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  
  const streamRef = useRef(null);

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

  const startPreview = useCallback(async (video = false, audio = true) => {
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

  const toggleAudio = useCallback(() => {
    if (localStream) {
      const audioTracks = localStream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setAudioEnabled(prev => !prev);
    }
  }, [localStream]);

  const toggleVideo = useCallback(async () => {
    if (!localStream) return;
    
    const videoTracks = localStream.getVideoTracks();
    
    if (videoTracks.length > 0) {
      videoTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setVideoEnabled(prev => !prev);
    } else {
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
        }
      } catch (err) {
        setError('Не удалось включить камеру');
      }
    }
  }, [localStream, selectedCamera]);

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

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

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

