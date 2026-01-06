import { useEffect, useRef, useState } from 'react';
import styles from './index.module.css';

export default function AllSeeingEye({ closed = false }) {
  const eyeRef = useRef(null);
  const [pupilOffset, setPupilOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!eyeRef.current || closed) return;

      const rect = eyeRef.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const maxOffset = 7;

      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = dx / dist;
      const ny = dy / dist;

      setPupilOffset({
        x: nx * maxOffset,
        y: ny * maxOffset,
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [closed]);

  return (
    <div
      ref={eyeRef}
      className={`${styles.eyeWrapper} ${closed ? styles.closed : ''}`}
    >
      <div className={styles.triangle}>
        <div className={styles.eye}>
          <div className={styles.iris}>
            <div
              className={styles.pupil}
              style={{
                transform: `translate(${pupilOffset.x}px, ${pupilOffset.y}px)`,
              }}
            />
          </div>
          <div className={styles.highlight} />
        </div>
        <div className={styles.lidTop} />
        <div className={styles.lidBottom} />
      </div>
    </div>
  );
}


