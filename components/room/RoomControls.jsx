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
      
      router.push(`/room/${newRoom.roomId}`);
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

