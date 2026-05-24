import { Shield, Phone } from 'lucide-react';
import styles from './landing.module.css';

const CHANNELS = [
  {
    initials: 'DS',
    title: 'Синк по дизайну',
    meta: '4 участника · сейчас активен',
    active: true,
  },
  {
    initials: 'RC',
    title: 'Канал релиза',
    meta: 'Сборка прошла на стенде',
  },
  {
    initials: 'AK',
    title: 'Алекс · личный',
    meta: 'Зашифрованный тред',
    secure: true,
  },
];

const MESSAGES = [
  { variant: 'in', text: 'Можем зафиксировать API-контракт до пятницы?' },
  { variant: 'out', text: 'Да — последние изменения уже в ветке.' },
  { variant: 'in', text: 'Сегодня вечером посмотрю полезную нагрузку WebSocket.' },
];

export function HeroComposition() {
  return (
    <div className={styles.composition} aria-hidden>
      <article className={styles.planeWarm}>
        <p className={styles.planeLabel}>Командные каналы</p>
        <ul className={styles.channelList}>
          {CHANNELS.map((channel) => (
            <li
              key={channel.title}
              className={`${styles.channelRow} ${channel.active ? styles.channelRowActive : ''}`}
            >
              <span className={styles.channelAvatar}>{channel.initials}</span>
              <span className={styles.channelCopy}>
                <strong>{channel.title}</strong>
                <span>{channel.meta}</span>
              </span>
              {channel.secure ? (
                <Shield size={16} strokeWidth={2.25} className={styles.channelSecure} />
              ) : null}
            </li>
          ))}
        </ul>
      </article>

      <article className={styles.planeDeep}>
        <p className={`${styles.planeLabel} ${styles.planeLabelOnDark}`}>Workspace Pager</p>
        <div className={styles.thread}>
          {MESSAGES.map((message) => (
            <p
              key={message.text}
              className={message.variant === 'out' ? styles.bubbleOut : styles.bubbleIn}
            >
              {message.text}
            </p>
          ))}
          <p className={styles.typingLine}>Майя печатает…</p>
        </div>
      </article>

      <aside className={`${styles.planeChip} ${styles.planeChipCall}`}>
        <Phone size={16} strokeWidth={2.25} aria-hidden />
        <span>
          <strong>Голосовая комната</strong>
          <span>В эфире · 2 участника</span>
        </span>
      </aside>
    </div>
  );
}
