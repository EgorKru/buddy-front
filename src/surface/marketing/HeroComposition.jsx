import { Shield, Phone } from 'lucide-react';
import styles from './landing.module.css';

const CHANNELS = [
  {
    initials: 'DS',
    title: 'Design sync',
    meta: '4 members · active now',
    active: true,
  },
  {
    initials: 'RC',
    title: 'Release channel',
    meta: 'Build passed on staging',
  },
  {
    initials: 'AK',
    title: 'Alex · direct',
    meta: 'Encrypted thread',
    secure: true,
  },
];

const MESSAGES = [
  { variant: 'in', text: 'Can we lock the API contract before Friday?' },
  { variant: 'out', text: 'Yes — latest changes are on the branch.' },
  { variant: 'in', text: 'I will review the WebSocket payload tonight.' },
];

/** Layered product planes — channels, workspace thread, direct route, voice. */
export function HeroComposition() {
  return (
    <div className={styles.composition} aria-hidden>
      <article className={styles.planeWarm}>
        <p className={styles.planeLabel}>Team channels</p>
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
        <p className={`${styles.planeLabel} ${styles.planeLabelOnDark}`}>Pager workspace</p>
        <div className={styles.thread}>
          {MESSAGES.map((message) => (
            <p
              key={message.text}
              className={message.variant === 'out' ? styles.bubbleOut : styles.bubbleIn}
            >
              {message.text}
            </p>
          ))}
          <p className={styles.typingLine}>Maya is typing…</p>
        </div>
      </article>

      <aside className={`${styles.planeChip} ${styles.planeChipDirect}`}>
        <Shield size={20} strokeWidth={2} aria-hidden />
        <span>
          <strong>Direct route</strong>
          <span>Encrypted end-to-end</span>
        </span>
      </aside>

      <aside className={`${styles.planeChip} ${styles.planeChipCall}`}>
        <Phone size={16} strokeWidth={2.25} aria-hidden />
        <span>
          <strong>Voice room</strong>
          <span>Live · 2 participants</span>
        </span>
      </aside>
    </div>
  );
}
