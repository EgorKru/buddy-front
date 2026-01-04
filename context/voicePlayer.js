import { createContext, useContext, useState, useCallback, useRef } from 'react';

const VoicePlayerContext = createContext(null);

export function VoicePlayerProvider({ children }) {
  // ID текущего воспроизводимого плеера
  const [activePlayerId, setActivePlayerId] = useState(null);
  // Функция для остановки текущего плеера
  const stopCurrentRef = useRef(null);

  const registerPlayer = useCallback((playerId, stopFn) => {
    // Если это новый плеер и есть активный - останавливаем старый
    if (activePlayerId && activePlayerId !== playerId && stopCurrentRef.current) {
      stopCurrentRef.current();
    }
    
    setActivePlayerId(playerId);
    stopCurrentRef.current = stopFn;
  }, [activePlayerId]);

  const unregisterPlayer = useCallback((playerId) => {
    if (activePlayerId === playerId) {
      setActivePlayerId(null);
      stopCurrentRef.current = null;
    }
  }, [activePlayerId]);

  const stopAll = useCallback(() => {
    if (stopCurrentRef.current) {
      stopCurrentRef.current();
    }
    setActivePlayerId(null);
    stopCurrentRef.current = null;
  }, []);

  return (
    <VoicePlayerContext.Provider value={{ 
      activePlayerId, 
      registerPlayer, 
      unregisterPlayer,
      stopAll 
    }}>
      {children}
    </VoicePlayerContext.Provider>
  );
}

export function useVoicePlayer() {
  const context = useContext(VoicePlayerContext);
  if (!context) {
    // Возвращаем заглушку если провайдер не найден
    return {
      activePlayerId: null,
      registerPlayer: () => {},
      unregisterPlayer: () => {},
      stopAll: () => {},
    };
  }
  return context;
}

