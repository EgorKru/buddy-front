import { useState, useRef, useEffect } from 'react';

const MAX_ROTATION = 30;
const DRAG_SENSITIVITY = 0.5;
const PASSIVE_ROTATION_FACTOR = 15;

export const usePager3DInteraction = (interactive) => {
  const [rotation, setRotation] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);

  useEffect(() => {
    if (!interactive) return;

    const handleMouseMove = (e) => {
      if (!isDragging) return;
      
      const deltaX = e.clientX - lastMousePos.x;
      const deltaY = e.clientY - lastMousePos.y;
      
      setRotation(prev => ({
        y: Math.max(-MAX_ROTATION, Math.min(MAX_ROTATION, prev.y + deltaX * DRAG_SENSITIVITY)),
        x: Math.max(-MAX_ROTATION, Math.min(MAX_ROTATION, prev.x - deltaY * DRAG_SENSITIVITY)),
      }));
      
      setLastMousePos({ x: e.clientX, y: e.clientY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    const handleMouseLeave = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('mouseleave', handleMouseLeave);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [isDragging, lastMousePos, interactive]);

  const handleMouseDown = (e) => {
    if (!interactive) return;
    setIsDragging(true);
    setLastMousePos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMovePassive = (e) => {
    if (!interactive || isDragging || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const deltaX = (e.clientX - centerX) / rect.width;
    const deltaY = (e.clientY - centerY) / rect.height;
    
    setRotation({
      y: deltaX * PASSIVE_ROTATION_FACTOR,
      x: -deltaY * PASSIVE_ROTATION_FACTOR,
    });
  };

  const handleMouseLeavePassive = () => {
    if (!interactive || isDragging) return;
    setRotation({ x: 0, y: 0 });
  };

  return {
    rotation,
    containerRef,
    handleMouseDown,
    handleMouseMovePassive,
    handleMouseLeavePassive,
  };
};

