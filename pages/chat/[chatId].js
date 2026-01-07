import { useRouter } from 'next/router';
import ChatContainer from '@/components/chat/components/ChatContainer';

export default function ChatPage() {
  const router = useRouter();
  const { chatId } = router.query;
  
  return <ChatContainer chatId={chatId} />;
}
