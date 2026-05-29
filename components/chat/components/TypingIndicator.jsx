import React from 'react';
import styles from './TypingIndicator.module.css';

/**
 * Компонент для отображения индикатора печати
 *
 * @param {Object} props
 * @param {Array} props.participants - Массив участников чата
 * @param {Array} props.typingUserIds - Массив ID пользователей которые печатают
 * @param {number} props.currentUserId - ID текущего пользователя
 */
const TypingIndicator = ({ participants = [], typingUserIds = [], currentUserId }) => {
  // Фильтруем только тех кто печатает и не является текущим пользователем
  const typingParticipants = participants.filter(
    (p) => p?.id && typingUserIds.includes(String(p.id)) && String(p.id) !== String(currentUserId)
  );

  if (typingParticipants.length === 0) {
    return null;
  }

  // Формируем текст индикатора
  let text = '';
  if (typingParticipants.length === 1) {
    const name =
      typingParticipants[0].displayName || typingParticipants[0].username || 'Пользователь';
    text = `${name} печатает`;
  } else if (typingParticipants.length === 2) {
    const name1 = typingParticipants[0].displayName || typingParticipants[0].username;
    const name2 = typingParticipants[1].displayName || typingParticipants[1].username;
    text = `${name1} и ${name2} печатают`;
  } else {
    text = `${typingParticipants.length} человек печатают`;
  }

  return (
    <div className={styles.typingIndicator} data-testid="chat-typing-indicator">
      <div className={styles.typingText}>
        {text}
        <span className={styles.dots}>
          <span className={styles.dot}>.</span>
          <span className={styles.dot}>.</span>
          <span className={styles.dot}>.</span>
        </span>
      </div>
    </div>
  );
};

export default TypingIndicator;
