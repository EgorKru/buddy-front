import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';

const ChatContainer = dynamic(() => import('@/components/chat/components/ChatContainer'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      Загрузка чата...
    </div>
  ),
});

export default function ChatPage() {
  const router = useRouter();
  const { chatId } = router.query;

  return <ChatContainer chatId={chatId} />;
}
