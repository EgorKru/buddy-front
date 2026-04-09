import { useState } from 'react';
import { useRouter } from 'next/router';
import { Video } from 'lucide-react';
import { roomAPI } from '@/utils/api';
import MediaPreviewModal from '@/features/room/ui/MediaPreviewModal';
import styles from '@/styles/call.module.css';

export default function RoomControls({ chatId, chatType }) {
  const _router = useRouter();
  const [showPreview, setShowPreview] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const handleOpenPreview = () => {
    if (!chatId) return;
    setShowPreview(true);
  };

  const handleConfirm = async ({ stream: _stream, audioEnabled, videoEnabled }) => {
    setIsCreating(true);
    try {
      const type = chatType === 'GROUP' ? 'PRIVATE' : 'PUBLIC';

      const newRoom = await roomAPI.createRoom(null, chatId, type);

      if (!newRoom || !newRoom.roomId) {
        throw new Error('Не удалось получить ID комнаты');
      }

      const params = new URLSearchParams({
        audio: audioEnabled ? '1' : '0',
        video: videoEnabled ? '1' : '0',
      });

      const targetUrl = `/room/${newRoom.roomId}?${params}`;

      window.location.href = targetUrl;
    } catch (error) {
      alert(`Ошибка при создании комнаты: ${error.message}`);
      setIsCreating(false);
    }
  };

  return (
    <>
      <div className={styles.callControlsBar}>
        <button onClick={handleOpenPreview} className={styles.callButton} title="Создать видеомит">
          <Video size={18} />
        </button>
      </div>

      <MediaPreviewModal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        onConfirm={handleConfirm}
        title="Настройка перед встречей"
        confirmText="Создать встречу"
        isCreating={isCreating}
      />
    </>
  );
}
