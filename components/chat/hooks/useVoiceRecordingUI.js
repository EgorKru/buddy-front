import { useState, useRef, useCallback } from 'react';
import { VOICE_MIN_HOLD_TIME, VOICE_LOCK_THRESHOLD } from '../constants/chat';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';

/**
 * Хук для управления UI голосовой записи
 * Объединяет useVoiceRecorder с UI логикой (drag, lock, preview)
 */
export const useVoiceRecordingUI = () => {
  const voiceRecorder = useVoiceRecorder();
  
  const [isLocked, setIsLocked] = useState(false);
  const [isHolding, setIsHolding] = useState(false);
  const [dragDistance, setDragDistance] = useState(0);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [reachedLockThreshold, setReachedLockThreshold] = useState(false);
  
  const buttonRef = useRef(null);
  const startYRef = useRef(0);
  const startTimeRef = useRef(0);
  const startDelayTimeoutRef = useRef(null);
  const audioPreviewRef = useRef(null);
  
  const lockThreshold = VOICE_LOCK_THRESHOLD;
  const minHoldTime = VOICE_MIN_HOLD_TIME;

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsHolding(true);
    startYRef.current = e.clientY;
    startTimeRef.current = Date.now();
    setDragDistance(0);
    setReachedLockThreshold(false);
    
    startDelayTimeoutRef.current = setTimeout(() => {
      if (isHolding && !voiceRecorder.isRecording) {
        voiceRecorder.startRecording();
      }
    }, minHoldTime);
  }, [isHolding, voiceRecorder]);

  const handleTouchStart = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsHolding(true);
    startYRef.current = e.touches[0].clientY;
    startTimeRef.current = Date.now();
    setDragDistance(0);
    setReachedLockThreshold(false);
    
    startDelayTimeoutRef.current = setTimeout(() => {
      if (isHolding && !voiceRecorder.isRecording) {
        voiceRecorder.startRecording();
      }
    }, minHoldTime);
  }, [isHolding, voiceRecorder]);

  const handleMouseMove = useCallback((e) => {
    if (!isHolding || !voiceRecorder.isRecording) return;
    
    const currentY = e.clientY;
    const distance = startYRef.current - currentY;
    setDragDistance(Math.max(0, distance));
    
    if (distance >= lockThreshold && !reachedLockThreshold) {
      setReachedLockThreshold(true);
      setIsLocked(true);
    }
  }, [isHolding, voiceRecorder.isRecording, reachedLockThreshold]);

  const handleTouchMove = useCallback((e) => {
    if (!isHolding || !voiceRecorder.isRecording) return;
    
    const currentY = e.touches[0].clientY;
    const distance = startYRef.current - currentY;
    setDragDistance(Math.max(0, distance));
    
    if (distance >= lockThreshold && !reachedLockThreshold) {
      setReachedLockThreshold(true);
      setIsLocked(true);
    }
  }, [isHolding, voiceRecorder.isRecording, reachedLockThreshold]);

  const handleMouseUp = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (startDelayTimeoutRef.current) {
      clearTimeout(startDelayTimeoutRef.current);
      startDelayTimeoutRef.current = null;
    }
    
    if (!voiceRecorder.isRecording) {
      setIsHolding(false);
      setDragDistance(0);
      return;
    }
    
    if (isLocked) {
      // Если заблокировано, не останавливаем запись
      setIsHolding(false);
      return;
    }
    
    // Останавливаем запись если не заблокировано
    voiceRecorder.stopRecording();
    setIsHolding(false);
    setDragDistance(0);
  }, [voiceRecorder, isLocked]);

  const handleTouchEnd = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (startDelayTimeoutRef.current) {
      clearTimeout(startDelayTimeoutRef.current);
      startDelayTimeoutRef.current = null;
    }
    
    if (!voiceRecorder.isRecording) {
      setIsHolding(false);
      setDragDistance(0);
      return;
    }
    
    if (isLocked) {
      setIsHolding(false);
      return;
    }
    
    voiceRecorder.stopRecording();
    setIsHolding(false);
    setDragDistance(0);
  }, [voiceRecorder, isLocked]);

  const handlePauseRecording = useCallback(() => {
    if (voiceRecorder.isRecording && !voiceRecorder.isPaused) {
      voiceRecorder.pauseRecording();
    }
  }, [voiceRecorder]);

  const handleResumeRecording = useCallback(() => {
    if (voiceRecorder.isRecording && voiceRecorder.isPaused) {
      voiceRecorder.resumeRecording();
    }
  }, [voiceRecorder]);

  const handleStopRecording = useCallback(() => {
    if (voiceRecorder.isRecording) {
      voiceRecorder.stopRecording();
      setIsLocked(false);
      setDragDistance(0);
      setReachedLockThreshold(false);
    }
  }, [voiceRecorder]);

  const handleCancelRecording = useCallback(() => {
    voiceRecorder.cancelRecording();
    setIsLocked(false);
    setDragDistance(0);
    setReachedLockThreshold(false);
    setIsPlayingPreview(false);
  }, [voiceRecorder]);

  const handlePlayPreview = useCallback((playing) => {
    setIsPlayingPreview(playing);
  }, []);

  // Добавляем обработчики событий
  useState(() => {
    if (typeof window === 'undefined') return;
    
    const handleGlobalMouseMove = (e) => {
      if (isHolding) handleMouseMove(e);
    };
    
    const handleGlobalMouseUp = (e) => {
      if (isHolding) handleMouseUp(e);
    };
    
    const handleGlobalTouchMove = (e) => {
      if (isHolding) handleTouchMove(e);
    };
    
    const handleGlobalTouchEnd = (e) => {
      if (isHolding) handleTouchEnd(e);
    };
    
    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
    window.addEventListener('touchend', handleGlobalTouchEnd);
    
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('touchmove', handleGlobalTouchMove);
      window.removeEventListener('touchend', handleGlobalTouchEnd);
    };
  });

  return {
    ...voiceRecorder,
    isLocked,
    isHolding,
    dragDistance,
    isPlayingPreview,
    reachedLockThreshold,
    lockThreshold,
    buttonRef,
    audioPreviewRef,
    handleMouseDown,
    handleTouchStart,
    handlePauseRecording: handlePauseRecording || voiceRecorder.pauseRecording,
    handleResumeRecording: handleResumeRecording || voiceRecorder.resumeRecording,
    handleStopRecording: handleStopRecording || voiceRecorder.stopRecording,
    handleCancelRecording: handleCancelRecording || voiceRecorder.cancelRecording,
    handlePlayPreview
  };
};

