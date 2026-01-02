import { useState, useRef, useEffect } from 'react';
import styles from '@/component/Pager3D/index.module.css';

export default function Pager3D({ size = 90, interactive = true, className = '' }) {
  const [rotation, setRotation] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const pagerRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!interactive) return;

    const handleMouseMove = (e) => {
      if (!isDragging) return;
      
      const deltaX = e.clientX - lastMousePos.x;
      const deltaY = e.clientY - lastMousePos.y;
      
      setRotation(prev => ({
        y: Math.max(-30, Math.min(30, prev.y + deltaX * 0.5)),
        x: Math.max(-30, Math.min(30, prev.x - deltaY * 0.5)),
      }));
      
      setLastMousePos({ x: e.clientX, y: e.clientY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    const handleMouseLeave = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('mouseleave', handleMouseLeave);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [isDragging, lastMousePos, interactive]);

  const handleMouseDown = (e) => {
    if (!interactive) return;
    setIsDragging(true);
    setLastMousePos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMovePassive = (e) => {
    if (!interactive || isDragging || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const deltaX = (e.clientX - centerX) / rect.width;
    const deltaY = (e.clientY - centerY) / rect.height;
    
    setRotation({
      y: deltaX * 15,
      x: -deltaY * 15,
    });
  };

  const handleMouseLeavePassive = () => {
    if (!interactive || isDragging) return;
    setRotation({ x: 0, y: 0 });
  };

  return (
    <div
      ref={containerRef}
      className={`${styles.pagerContainer} ${className}`}
      style={{ width: size, height: size }}
      onMouseMove={handleMouseMovePassive}
      onMouseLeave={handleMouseLeavePassive}
    >
      <div
        ref={pagerRef}
        className={styles.pager3d}
        style={{
          transform: `perspective(1000px) rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
          width: size,
          height: size,
        }}
        onMouseDown={handleMouseDown}
      >
        <div className={styles.pagerBody}>
          <div className={styles.screen}>
            <div className={styles.screenContent}>
              <div className={styles.screenLine}>PAGER</div>
              <div className={styles.screenLine}>READY</div>
            </div>
          </div>
          
          <div className={styles.buttons}>
            <div className={styles.button}></div>
            <div className={styles.button}></div>
            <div className={styles.button}></div>
          </div>
          
          <div className={styles.antenna}>
            <div className={styles.antennaBase}></div>
            <div className={styles.antennaTop}></div>
          </div>
          
          <div className={styles.led}></div>
        </div>
        
        <div className={styles.shine}></div>
      </div>
    </div>
  );
}

