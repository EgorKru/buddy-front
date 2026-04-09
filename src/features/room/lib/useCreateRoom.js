/**
 * Хук создания комнаты: вызов API, состояние загрузки и ошибки. FSD: features/room
 */
import { useState, useCallback } from 'react';
import { roomAPI } from '@/shared/api';

export function useCreateRoom() {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState(null);

  const createRoom = useCallback(async ({ audioEnabled, videoEnabled } = {}) => {
    setIsCreating(true);
    setError(null);
    try {
      const newRoom = await roomAPI.createRoom(null, null, 'PUBLIC');
      if (!newRoom?.roomId) {
        throw new Error('Не удалось получить ID комнаты');
      }
      return { ...newRoom, audioEnabled, videoEnabled };
    } catch (err) {
      const message = err?.message || 'Ошибка при создании комнаты';
      setError(message);
      throw err;
    } finally {
      setIsCreating(false);
    }
  }, []);

  return { createRoom, isCreating, error };
}
