import { useState } from 'react';
import { useRouter } from 'next/router';
import { Video } from 'lucide-react';
import { useRoomProtocol } from '@/hooks/useRoomProtocol';
import styles from '@/styles/call.module.css';

export default function RoomControls({ chatId, chatType }) {
  const router = useRouter();
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const { createRoom } = useRoomProtocol();

  const handleCreateRoom = async () => {
    if (isCreatingRoom || !chatId) return;
    
    setIsCreatingRoom(true);
    try {
      const type = chatType === 'GROUP' ? 'PRIVATE' : 'PUBLIC';
      const newRoom = await createRoom(null, chatId, type);
      
      if (!newRoom) {
        throw new Error('Не удалось создать комнату: пустой ответ от сервера');
      }
      
      const roomIdToUse = newRoom.roomId;
      if (!roomIdToUse) {
        throw new Error(`Не удалось получить roomId из ответа сервера. Ответ: ${JSON.stringify(newRoom)}`);
      }
      
      if (typeof roomIdToUse !== 'string') {
        throw new Error(`roomId должен быть строкой, получен: ${typeof roomIdToUse}. Значение: ${roomIdToUse}`);
      }
      
      router.push(`/room/${roomIdToUse}`);
    } catch (error) {
      alert(`Ошибка при создании комнаты: ${error.message}`);
      setIsCreatingRoom(false);
    }
  };

  return (
    <div className={styles.callControlsBar}>
      <button
        onClick={handleCreateRoom}
        className={styles.callButton}
        disabled={isCreatingRoom}
        title="Создать видеомит"
      >
        <Video size={18} />
      </button>
    </div>
  );
}

