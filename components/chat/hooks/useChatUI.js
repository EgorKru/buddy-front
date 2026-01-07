import { useState, useEffect, useRef } from 'react';

export const useChatUI = () => {
  const [newMessage, setNewMessage] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [imageModal, setImageModal] = useState(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [scrollButtonReady, setScrollButtonReady] = useState(false);
  
  return {
    newMessage,
    setNewMessage,
    sidebarOpen,
    setSidebarOpen,
    contextMenu,
    setContextMenu,
    imageModal,
    setImageModal,
    showScrollToBottom,
    setShowScrollToBottom,
    scrollButtonReady,
    setScrollButtonReady
  };
};

