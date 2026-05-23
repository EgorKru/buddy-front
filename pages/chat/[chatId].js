import { useRouter } from 'next/router';
import ChatContainer from '@/components/chat/components/ChatContainer';

const loadingStyle = {
  minHeight: '60vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

export default function ChatPage() {
  const router = useRouter();
  const { chatId } = router.query;

  if (!router.isReady || chatId == null || chatId === '') {
    return <div style={loadingStyle}>Загрузка чата...</div>;
  }

  return <ChatContainer chatId={chatId} />;
}
