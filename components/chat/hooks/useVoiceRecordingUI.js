import { useState, useRef, useCallback, useEffect } from 'react';
import { VOICE_MIN_HOLD_TIME, VOICE_LOCK_THRESHOLD } from '../constants/chat';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';

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
  const isHoldingRef = useRef(false);
  const reachedLockThresholdRef = useRef(false);
  
  const lockThreshold = VOICE_LOCK_THRESHOLD;
  const minHoldTime = VOICE_MIN_HOLD_TIME;

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    isHoldingRef.current = true;
    setIsHolding(true);
    startYRef.current = e.clientY;
    startTimeRef.current = Date.now();
    setDragDistance(0);
    reachedLockThresholdRef.current = false;
    setReachedLockThreshold(false);
    setIsLocked(false);
    
    startDelayTimeoutRef.current = setTimeout(() => {
      if (isHoldingRef.current && !voiceRecorder.isRecording) {
        voiceRecorder.startRecording();
      }
    }, minHoldTime);
  }, [voiceRecorder, minHoldTime]);

  const handleTouchStart = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    isHoldingRef.current = true;
    setIsHolding(true);
    startYRef.current = e.touches[0].clientY;
    startTimeRef.current = Date.now();
    setDragDistance(0);
    reachedLockThresholdRef.current = false;
    setReachedLockThreshold(false);
    setIsLocked(false);
    
    startDelayTimeoutRef.current = setTimeout(() => {
      if (isHoldingRef.current && !voiceRecorder.isRecording) {
        voiceRecorder.startRecording();
      }
    }, minHoldTime);
  }, [voiceRecorder, minHoldTime]);

  const handleMouseMove = useCallback((e) => {
    if (!isHoldingRef.current || !voiceRecorder.isRecording) return;
    
    const currentY = e.clientY;
    const distance = startYRef.current - currentY;
    const clampedDistance = Math.max(0, distance);
    setDragDistance(clampedDistance);
    
    if (clampedDistance >= lockThreshold && !reachedLockThresholdRef.current) {
      reachedLockThresholdRef.current = true;
      setReachedLockThreshold(true);
      setIsLocked(true);
    }
  }, [voiceRecorder.isRecording, lockThreshold]);

  const handleTouchMove = useCallback((e) => {
    if (!isHoldingRef.current || !voiceRecorder.isRecording) return;
    
    const currentY = e.touches[0].clientY;
    const distance = startYRef.current - currentY;
    const clampedDistance = Math.max(0, distance);
    setDragDistance(clampedDistance);
    
    if (clampedDistance >= lockThreshold && !reachedLockThresholdRef.current) {
      reachedLockThresholdRef.current = true;
      setReachedLockThreshold(true);
      setIsLocked(true);
    }
  }, [voiceRecorder.isRecording, lockThreshold]);

  const handleMouseUp = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    
    isHoldingRef.current = false;
    
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

  const handleTouchEnd = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    
    isHoldingRef.current = false;
    
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
      reachedLockThresholdRef.current = false;
      setReachedLockThreshold(false);
    }
  }, [voiceRecorder]);

  const handleCancelRecording = useCallback(() => {
    voiceRecorder.cancelRecording();
    setIsLocked(false);
    setDragDistance(0);
    reachedLockThresholdRef.current = false;
    setReachedLockThreshold(false);
    setIsPlayingPreview(false);
  }, [voiceRecorder]);

  const handlePlayPreview = useCallback((playing) => {
    setIsPlayingPreview(playing);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleGlobalMouseMove = (e) => {
      if (isHoldingRef.current) handleMouseMove(e);
    };
    
    const handleGlobalMouseUp = (e) => {
      if (isHoldingRef.current) handleMouseUp(e);
    };
    
    const handleGlobalTouchMove = (e) => {
      if (isHoldingRef.current) handleTouchMove(e);
    };
    
    const handleGlobalTouchEnd = (e) => {
      if (isHoldingRef.current) handleTouchEnd(e);
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
  }, [handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

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

