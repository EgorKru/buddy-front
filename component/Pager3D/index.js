import { usePager3DInteraction } from './usePager3DInteraction';
import PagerBody from './PagerBody';
import styles from '@/component/Pager3D/index.module.css';

export default function Pager3D({ size = 90, interactive = true, className = '' }) {
  const {
    rotation,
    containerRef,
    handleMouseDown,
    handleMouseMovePassive,
    handleMouseLeavePassive,
  } = usePager3DInteraction(interactive);

  return (
    <div
      ref={containerRef}
      className={`${styles.pagerContainer} ${className}`}
      style={{ width: size, height: size }}
      onMouseMove={handleMouseMovePassive}
      onMouseLeave={handleMouseLeavePassive}
    >
      <div
        className={styles.pager3d}
        style={{
          transform: `perspective(1000px) rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
          width: size,
          height: size,
        }}
        onMouseDown={handleMouseDown}
      >
        <PagerBody />
        <div className={styles.shine}></div>
      </div>
    </div>
  );
}
