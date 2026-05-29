import { useMessageTextPreview } from '@/hooks/useMessageTextPreview';

export default function ChatLastMessagePreview({ chat, user }) {
  const preview = useMessageTextPreview(chat?.lastMessage, chat, user);
  return preview;
}
