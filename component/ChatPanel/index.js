import { useState, useEffect, useRef } from 'react';
import { Send, MessageCircle } from 'lucide-react';
import { apiRequest, getCurrentUser } from '@/utils/api';
import styles from '@/component/ChatPanel/index.module.css';

const ChatPanel = ({ roomId, isOpen, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const user = getCurrentUser();

  useEffect(() => {
    if (isOpen && roomId) {
      loadMessages();
    }
  }, [isOpen, roomId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  /**
   * Загрузка сообщений для комнаты
   * @note В будущем здесь будет интеграция с API для получения сообщений комнаты
   */
  const loadMessages = async () => {
    try {
      // TODO: Реализовать загрузку сообщений для video rooms через API
      setLoading(false);
    } catch (error) {
      console.error('Ошибка загрузки сообщений:', error);
    }
  };

  /**
   * Отправка сообщения в чат комнаты
   * @note В будущем здесь будет интеграция с WebSocket/API для отправки сообщений
   */
  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    const message = {
      content: newMessage.trim(),
      senderId: user.id,
      senderUsername: user.username,
      senderDisplayName: user.displayName || user.username,
      createdAt: new Date().toISOString(),
      type: 'TEXT',
    };

    setMessages([...messages, message]);
    setNewMessage('');

    // TODO: Реализовать отправку сообщений через WebSocket/API для video rooms
    try {
      // await apiRequest(`/chats/${chatId}/messages`, {
      //   method: 'POST',
      //   body: JSON.stringify({ content: message.content }),
      // });
    } catch (error) {
      console.error('Ошибка отправки сообщения:', error);
      setMessages(messages.filter(m => m !== message));
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  if (!isOpen) return null;

  return (
    <div className={styles.chatPanel}>
      <div className={styles.chatHeader}>
        <div className={styles.chatTitle}>
          <MessageCircle size={20} />
          <span>Чат комнаты</span>
        </div>
        <button onClick={onClose} className={styles.closeButton}>×</button>
      </div>
      
      <div className={styles.messagesContainer}>
        {messages.length === 0 ? (
          <div className={styles.emptyState}>
            <p>Пока нет сообщений</p>
            <p className={styles.emptyHint}>Начните общение!</p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div
              key={index}
              className={`${styles.message} ${
                msg.senderId === user?.id ? styles.ownMessage : ''
              }`}
            >
              <div className={styles.messageHeader}>
                <span className={styles.senderName}>
                  {msg.senderDisplayName || msg.senderUsername}
                </span>
                <span className={styles.messageTime}>
                  {new Date(msg.createdAt).toLocaleTimeString('ru-RU', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <div className={styles.messageContent}>{msg.content}</div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={sendMessage} className={styles.messageForm}>
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Написать сообщение..."
          className={styles.messageInput}
        />
        <button type="submit" className={styles.sendButton}>
          <Send size={20} />
        </button>
      </form>
    </div>
  );
};

export default ChatPanel;

