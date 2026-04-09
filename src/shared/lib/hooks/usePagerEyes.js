/**
 * Хук анимации «глаз» логотипа: смещение зрачков за курсором. FSD: shared/lib
 * Подписка на mousemove отключается, когда глаза закрыты (isClosed).
 * Если useViewportCenter: true — центр берётся от окна (для overlay-лоадера).
 */
import { useState, useEffect, useRef } from 'react';

const DEFAULT_MAX_OFFSET = 4.5;
const DISTANCE_FACTOR_MAX = 1.2;

/**
 * @param {React.RefObject<HTMLElement|null>} logoRef — ref контейнера логотипа (для getBoundingClientRect), при useViewportCenter может быть null
 * @param {boolean} isClosed — глаза закрыты (не обновлять смещение)
 * @param {{ useViewportCenter?: boolean, maxOffset?: number }} [options] — useViewportCenter: центр окна; maxOffset: макс. смещение в px
 * @returns {{ x: number, y: number }} pupilOffset — смещение зрачков в px
 */
export function usePagerEyes(logoRef, isClosed, options = {}) {
  const { useViewportCenter = false, maxOffset = DEFAULT_MAX_OFFSET } = options;
  const [pupilOffset, setPupilOffset] = useState({ x: 0, y: 0 });
  const rafIdRef = useRef(null);

  useEffect(() => {
    if (isClosed) return;

    const handleMouseMove = (e) => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);

      rafIdRef.current = requestAnimationFrame(() => {
        let cx;
        let cy;
        if (useViewportCenter || !logoRef?.current) {
          cx = typeof window !== 'undefined' ? window.innerWidth / 2 : 0;
          cy = typeof window !== 'undefined' ? window.innerHeight / 2 : 0;
        } else {
          const rect = logoRef.current.getBoundingClientRect();
          cx = rect.left + rect.width / 2;
          cy = rect.top + rect.height / 2;
        }
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = dx / dist;
        const ny = dy / dist;
        const distanceFactor = useViewportCenter ? 1 : Math.min(dist / 100, DISTANCE_FACTOR_MAX);
        const desiredX = nx * maxOffset * distanceFactor;
        const desiredY = ny * maxOffset * distanceFactor;
        const clampedX = Math.max(-maxOffset, Math.min(maxOffset, desiredX));
        const clampedY = Math.max(-maxOffset, Math.min(maxOffset, desiredY));
        setPupilOffset({ x: clampedX, y: clampedY });
        rafIdRef.current = null;
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, [isClosed, useViewportCenter, maxOffset, logoRef]);

  return pupilOffset;
}
