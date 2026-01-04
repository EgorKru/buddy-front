import { useState, useEffect, useRef } from 'react';
import { Send, MessageCircle } from 'lucide-react';
import { getCurrentUser } from '@/utils/api';
import styles from '@/component/ChatPanel/index.module.css';

const ChatPanel = ({ roomId, isOpen, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);
  const messageInputRef = useRef(null);
  const user = getCurrentUser();

  useEffect(() => {
    if (isOpen && roomId) {
      loadMessages();
    }
  }, [isOpen, roomId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const textarea = messageInputRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const newHeight = Math.min(textarea.scrollHeight, 120);
      textarea.style.height = `${newHeight}px`;
      
      // Показываем скроллбар только если контент переполняется
      if (textarea.scrollHeight > 120) {
        textarea.style.overflowY = 'auto';
        textarea.style.paddingRight = '20px';
      } else {
        textarea.style.overflowY = 'hidden';
        textarea.style.paddingRight = '16px';
      }
    }
  }, [newMessage]);

  const loadMessages = async () => {
    return;
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    const message = {
      content: newMessage.trimEnd(),
      senderId: user.id,
      senderUsername: user.username,
      senderDisplayName: user.displayName || user.username,
      createdAt: new Date().toISOString(),
      type: 'TEXT',
    };

    setMessages([...messages, message]);
    setNewMessage('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      if (newMessage.trim()) {
        sendMessage(e);
      }
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
        <textarea
          ref={messageInputRef}
          id="room-chat-message-input"
          name="message"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Написать сообщение..."
          className={styles.messageInput}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
          rows={1}
        />
        <button type="submit" className={styles.sendButton}>
          <Send size={20} />
        </button>
      </form>
    </div>
  );
};

export default ChatPanel;

