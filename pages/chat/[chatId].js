import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';

const ChatContainer = dynamic(() => import('@/components/chat/components/ChatContainer'), {
  ssr: false,
  loading: () => <div style={loadingStyle}>Загрузка чата...</div>,
});

const loadingStyle = {
  minHeight: '60vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

function chatIdFromPath() {
  if (typeof window === 'undefined') return null;
  const match = window.location.pathname.match(/\/chat\/([^/]+)/);
  return match?.[1] ?? null;
}

export default function ChatPage() {
  const router = useRouter();
  const chatId = router.query.chatId || chatIdFromPath();

  if (chatId == null || chatId === '') {
    return <div style={loadingStyle}>Загрузка чата...</div>;
  }

  return <ChatContainer chatId={chatId} />;
}
