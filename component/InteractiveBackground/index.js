import { useEffect, useRef } from 'react';
import styles from '@/component/InteractiveBackground/index.module.css';

const InteractiveBackground = () => {
  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const mouseRef = useRef({ x: 0, y: 0 });
  const animationFrameRef = useRef(null);
  const lastMouseUpdateRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    class Particle {
      constructor() {
        this.x = (Math.random() * canvas.width) / dpr;
        this.y = (Math.random() * canvas.height) / dpr;
        this.size = Math.random() * 3 + 1;
        this.speedX = (Math.random() - 0.5) * 0.5;
        this.speedY = (Math.random() - 0.5) * 0.5;
        this.opacity = Math.random() * 0.4 + 0.2;
        this.baseOpacity = this.opacity;
        this.colorIndex = Math.floor(Math.random() * 3);
        const colors = [
          [102, 126, 234],
          [140, 100, 200],
          [59, 130, 246],
        ];
        this.colorRGB = colors[this.colorIndex];
        this.pulse = Math.random() * Math.PI * 2;
        this.pulseSpeed = 0.02 + Math.random() * 0.01;
        this.trail = [];
        this.maxTrailLength = 3;
        this.lastInteractionCheck = 0;
      }

      update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.pulse += this.pulseSpeed;

        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > this.maxTrailLength) {
          this.trail.shift();
        }

        const dx = mouseRef.current.x - this.x;
        const dy = mouseRef.current.y - this.y;
        const distanceSq = dx * dx + dy * dy;
        const maxDistanceSq = 200 * 200;

        if (distanceSq < maxDistanceSq && distanceSq > 0) {
          const distance = Math.sqrt(distanceSq);
          const force = (200 - distance) / 200;
          const angle = Math.atan2(dy, dx);

          this.speedX -= Math.cos(angle) * force * 2 * 0.1;
          this.speedY -= Math.sin(angle) * force * 2 * 0.1;

          this.opacity = Math.min(1, this.baseOpacity + force * 0.3);
        } else {
          this.opacity = this.baseOpacity;
        }

        const now = Date.now();
        if (now - this.lastInteractionCheck > 100) {
          let nearbyCount = 0;
          const maxNearby = 5;

          for (let i = 0; i < particlesRef.current.length && nearbyCount < maxNearby; i++) {
            const other = particlesRef.current[i];
            if (other === this) continue;

            const dx = other.x - this.x;
            const dy = other.y - this.y;
            const distSq = dx * dx + dy * dy;

            if (distSq < 6400) {
              const dist = Math.sqrt(distSq);
              const force = ((80 - dist) / 80) * 0.008;
              const angle = Math.atan2(dy, dx);
              this.speedX += Math.cos(angle) * force;
              this.speedY += Math.sin(angle) * force;
              nearbyCount++;
            }
          }
          this.lastInteractionCheck = now;
        }

        const maxSpeed = 1.5;
        const speedSq = this.speedX * this.speedX + this.speedY * this.speedY;
        if (speedSq > maxSpeed * maxSpeed) {
          const speed = Math.sqrt(speedSq);
          this.speedX = (this.speedX / speed) * maxSpeed;
          this.speedY = (this.speedY / speed) * maxSpeed;
        }

        if (this.x < 0 || this.x > canvas.width / dpr) {
          this.speedX *= -0.8;
          this.x = Math.max(0, Math.min(canvas.width / dpr, this.x));
        }
        if (this.y < 0 || this.y > canvas.height / dpr) {
          this.speedY *= -0.8;
          this.y = Math.max(0, Math.min(canvas.height / dpr, this.y));
        }
      }

      draw() {
        if (this.trail.length > 1) {
          ctx.beginPath();
          ctx.moveTo(this.trail[0].x, this.trail[0].y);
          for (let i = 1; i < this.trail.length; i++) {
            ctx.lineTo(this.trail[i].x, this.trail[i].y);
          }
          ctx.strokeStyle = `rgba(${this.colorRGB.join(',')}, ${this.opacity * 0.2})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        const size = this.size + Math.sin(this.pulse) * 0.5;
        ctx.beginPath();
        ctx.arc(this.x, this.y, size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${this.colorRGB.join(',')}, ${this.opacity})`;
        ctx.fill();

        if (this.opacity > 0.5) {
          ctx.beginPath();
          ctx.arc(this.x, this.y, size * 2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${this.colorRGB.join(',')}, ${this.opacity * 0.1})`;
          ctx.fill();
        }
      }
    }

    const getParticleCount = () => {
      return Math.min(80, Math.floor((window.innerWidth * window.innerHeight) / 20000));
    };

    const resizeCanvas = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';

      const particleCount = getParticleCount();
      particlesRef.current = [];
      for (let i = 0; i < particleCount; i++) {
        particlesRef.current.push(new Particle());
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas, { passive: true });

    const handleMouseMove = (e) => {
      const now = performance.now();
      if (now - lastMouseUpdateRef.current < 16) return;
      lastMouseUpdateRef.current = now;

      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    let lastTime = 0;
    const targetFPS = 60;
    const frameInterval = 1000 / targetFPS;

    const animate = (currentTime) => {
      const elapsed = currentTime - lastTime;

      if (elapsed >= frameInterval) {
        lastTime = currentTime - (elapsed % frameInterval);

        ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

        const connectionDistance = 120;
        const connectionDistanceSq = connectionDistance * connectionDistance;

        for (let i = 0; i < particlesRef.current.length; i++) {
          const particle = particlesRef.current[i];

          let checked = 0;
          const maxChecks = 8;

          for (let j = i + 1; j < particlesRef.current.length && checked < maxChecks; j++) {
            const other = particlesRef.current[j];
            const dx = particle.x - other.x;
            const dy = particle.y - other.y;
            const distSq = dx * dx + dy * dy;

            if (distSq < connectionDistanceSq) {
              const dist = Math.sqrt(distSq);
              const opacity = 0.2 * (1 - dist / connectionDistance);

              ctx.beginPath();
              ctx.strokeStyle = `rgba(${particle.colorRGB.join(',')}, ${opacity})`;
              ctx.lineWidth = 1;
              ctx.moveTo(particle.x, particle.y);
              ctx.lineTo(other.x, other.y);
              ctx.stroke();
              checked++;
            }
          }
        }

        particlesRef.current.forEach((particle) => {
          particle.update();
        });

        particlesRef.current.forEach((particle) => {
          particle.draw();
        });

        particlesRef.current.forEach((particle) => {
          const dx = mouseRef.current.x - particle.x;
          const dy = mouseRef.current.y - particle.y;
          const distSq = dx * dx + dy * dy;
          const maxDistSq = 150 * 150;

          if (distSq < maxDistSq) {
            const dist = Math.sqrt(distSq);
            const opacity = 0.4 * (1 - dist / 150);

            ctx.beginPath();
            ctx.strokeStyle = `rgba(102, 126, 234, ${opacity})`;
            ctx.lineWidth = 1.5;
            ctx.moveTo(mouseRef.current.x, mouseRef.current.y);
            ctx.lineTo(particle.x, particle.y);
            ctx.stroke();
          }
        });
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('mousemove', handleMouseMove);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return <canvas ref={canvasRef} className={styles.canvas} />;
};

export default InteractiveBackground;
