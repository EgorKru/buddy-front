import { useState, useEffect, useRef, useCallback } from 'react';

const SIDEBAR_POSITION_KEY = 'chatSidebarPosition';
const SIDEBAR_WIDTH_KEY = 'chatSidebarWidth';
const MIN_SIDEBAR_WIDTH = 250;
const MAX_SIDEBAR_WIDTH = 600;
const DEFAULT_SIDEBAR_WIDTH = 320;

export const useSidebarResize = () => {
  const [sidebarPosition, setSidebarPosition] = useState('left');
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef(null);
  const resizeHandleRef = useRef(null);

  useEffect(() => {
    const savedPosition = typeof window !== 'undefined' 
      ? localStorage.getItem(SIDEBAR_POSITION_KEY) || 'left'
      : 'left';
    setSidebarPosition(savedPosition);
    const savedWidth = typeof window !== 'undefined'
      ? parseInt(localStorage.getItem(SIDEBAR_WIDTH_KEY) || DEFAULT_SIDEBAR_WIDTH, 10)
      : DEFAULT_SIDEBAR_WIDTH;
    setSidebarWidth(savedWidth);
    if (typeof window !== 'undefined') {
      document.body.setAttribute('data-sidebar-position', savedPosition);
      document.body.setAttribute('data-sidebar-width', savedWidth);
      document.documentElement.style.setProperty('--sidebar-width', `${savedWidth}px`);
    }
  }, []);

  const toggleSidebarPosition = useCallback(() => {
    const newPosition = sidebarPosition === 'left' ? 'right' : 'left';
    setSidebarPosition(newPosition);
    if (typeof window !== 'undefined') {
      localStorage.setItem(SIDEBAR_POSITION_KEY, newPosition);
      document.body.setAttribute('data-sidebar-position', newPosition);
    }
  }, [sidebarPosition]);

  const handleResizeStart = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    const startX = e.clientX;
    const startWidth = sidebarWidth;
    let currentWidth = startWidth;
    
    const handleMouseMove = (e) => {
      const diff = sidebarPosition === 'left' 
        ? e.clientX - startX 
        : startX - e.clientX;
      const newWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, startWidth + diff));
      currentWidth = newWidth;
      setSidebarWidth(newWidth);
      if (typeof window !== 'undefined') {
        document.body.setAttribute('data-sidebar-width', newWidth);
        document.documentElement.style.setProperty('--sidebar-width', `${newWidth}px`);
      }
    };
    
    const handleMouseUp = () => {
      setIsResizing(false);
      if (typeof window !== 'undefined') {
        localStorage.setItem(SIDEBAR_WIDTH_KEY, currentWidth.toString());
      }
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [sidebarWidth, sidebarPosition]);

  useEffect(() => {
    if (sidebarRef.current) {
      sidebarRef.current.style.width = `${sidebarWidth}px`;
    }
  }, [sidebarWidth]);

  return {
    sidebarPosition,
    sidebarWidth,
    isResizing,
    sidebarRef,
    resizeHandleRef,
    toggleSidebarPosition,
    handleResizeStart,
  };
};

