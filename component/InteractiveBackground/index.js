import { useEffect, useRef } from 'react';
import styles from '@/component/InteractiveBackground/index.module.css';

const InteractiveBackground = () => {
  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const mouseRef = useRef({ x: 0, y: 0 });
  const animationFrameRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    
    const resizeCanvas = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.scale(dpr, dpr);
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Создаем частицы - больше для большей интерактивности
    const particleCount = 150;
    particlesRef.current = [];

    class Particle {
      constructor() {
        this.x = Math.random() * canvas.width / dpr;
        this.y = Math.random() * canvas.height / dpr;
        this.size = Math.random() * 4 + 1.5;
        this.speedX = (Math.random() - 0.5) * 0.8;
        this.speedY = (Math.random() - 0.5) * 0.8;
        this.opacity = Math.random() * 0.6 + 0.3;
        this.baseOpacity = this.opacity;
        this.colorIndex = Math.floor(Math.random() * 3);
        this.colors = [
          `rgba(102, 126, 234, ${this.opacity})`,
          `rgba(140, 100, 200, ${this.opacity})`,
          `rgba(59, 130, 246, ${this.opacity})`
        ];
        this.color = this.colors[this.colorIndex];
        this.pulse = Math.random() * Math.PI * 2;
        this.pulseSpeed = 0.03 + Math.random() * 0.02;
        this.trail = [];
        this.maxTrailLength = 5;
      }

      update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.pulse += this.pulseSpeed;

        // Сохраняем след
        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > this.maxTrailLength) {
          this.trail.shift();
        }

        // Отталкивание от мыши - более сильное
        const dx = mouseRef.current.x - this.x;
        const dy = mouseRef.current.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const maxDistance = 200;
        const minDistance = 50;

        if (distance < maxDistance && distance > 0) {
          const force = (maxDistance - distance) / maxDistance;
          const angle = Math.atan2(dy, dx);
          
          // Более сильное отталкивание
          this.x -= Math.cos(angle) * force * 4;
          this.y -= Math.sin(angle) * force * 4;
          
          // Увеличиваем непрозрачность при приближении мыши
          this.opacity = Math.min(1, this.baseOpacity + force * 0.5);
        } else {
          this.opacity = this.baseOpacity;
        }

        // Притяжение к другим частицам (слабое)
        particlesRef.current.forEach(other => {
          if (other === this) return;
          const dx = other.x - this.x;
          const dy = other.y - this.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance > 0 && distance < 80) {
            const force = (80 - distance) / 80 * 0.01;
            const angle = Math.atan2(dy, dx);
            this.speedX += Math.cos(angle) * force;
            this.speedY += Math.sin(angle) * force;
          }
        });

        // Ограничение скорости
        const maxSpeed = 2;
        const speed = Math.sqrt(this.speedX * this.speedX + this.speedY * this.speedY);
        if (speed > maxSpeed) {
          this.speedX = (this.speedX / speed) * maxSpeed;
          this.speedY = (this.speedY / speed) * maxSpeed;
        }

        // Границы с отскоком
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
        // Рисуем след
        this.trail.forEach((point, index) => {
          const trailOpacity = (index / this.trail.length) * this.opacity * 0.3;
          ctx.beginPath();
          ctx.arc(point.x, point.y, this.size * 0.5, 0, Math.PI * 2);
          ctx.fillStyle = this.color.replace(/[\d\.]+\)$/g, `${trailOpacity})`);
          ctx.fill();
        });

        // Рисуем саму частицу
        const size = this.size + Math.sin(this.pulse) * 1;
        const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, size);
        gradient.addColorStop(0, this.color.replace(/[\d\.]+\)$/g, `${this.opacity})`));
        gradient.addColorStop(0.5, this.color.replace(/[\d\.]+\)$/g, `${this.opacity * 0.5})`));
        gradient.addColorStop(1, this.color.replace(/[\d\.]+\)$/g, '0)'));
        
        ctx.beginPath();
        ctx.arc(this.x, this.y, size, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
        
        // Свечение
        ctx.shadowBlur = 20;
        ctx.shadowColor = this.color;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    // Инициализация частиц
    for (let i = 0; i < particleCount; i++) {
      particlesRef.current.push(new Particle());
    }

    // Обработка движения мыши
    const handleMouseMove = (e) => {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
    };

    window.addEventListener('mousemove', handleMouseMove);

    // Анимация
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      
      // Рисуем связи между близкими частицами - более яркие и частые
      for (let i = 0; i < particlesRef.current.length; i++) {
        for (let j = i + 1; j < particlesRef.current.length; j++) {
          const dx = particlesRef.current[i].x - particlesRef.current[j].x;
          const dy = particlesRef.current[i].y - particlesRef.current[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 150) {
            const opacity = 0.3 * (1 - distance / 150);
            const gradient = ctx.createLinearGradient(
              particlesRef.current[i].x, 
              particlesRef.current[i].y,
              particlesRef.current[j].x,
              particlesRef.current[j].y
            );
            gradient.addColorStop(0, particlesRef.current[i].color.replace(/[\d\.]+\)$/g, `${opacity})`));
            gradient.addColorStop(1, particlesRef.current[j].color.replace(/[\d\.]+\)$/g, `${opacity})`));
            
            ctx.beginPath();
            ctx.strokeStyle = gradient;
            ctx.lineWidth = 1.5;
            ctx.moveTo(particlesRef.current[i].x, particlesRef.current[i].y);
            ctx.lineTo(particlesRef.current[j].x, particlesRef.current[j].y);
            ctx.stroke();
          }
        }
      }

      // Обновляем и рисуем частицы
      particlesRef.current.forEach(particle => {
        particle.update();
      });

      // Рисуем частицы после обновления
      particlesRef.current.forEach(particle => {
        particle.draw();
      });

      // Связь с курсором - более яркая и заметная
      particlesRef.current.forEach(particle => {
        const dx = mouseRef.current.x - particle.x;
        const dy = mouseRef.current.y - particle.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 150) {
          const opacity = 0.6 * (1 - distance / 150);
          const gradient = ctx.createLinearGradient(
            mouseRef.current.x,
            mouseRef.current.y,
            particle.x,
            particle.y
          );
          gradient.addColorStop(0, `rgba(102, 126, 234, ${opacity})`);
          gradient.addColorStop(1, particle.color.replace(/[\d\.]+\)$/g, `${opacity * 0.5})`));
          
          ctx.beginPath();
          ctx.strokeStyle = gradient;
          ctx.lineWidth = 2.5;
          ctx.moveTo(mouseRef.current.x, mouseRef.current.y);
          ctx.lineTo(particle.x, particle.y);
          ctx.stroke();
          
          // Добавляем свечение вокруг курсора
          if (distance < 80) {
            const glowSize = (80 - distance) / 80 * 30;
            const glowGradient = ctx.createRadialGradient(
              mouseRef.current.x,
              mouseRef.current.y,
              0,
              mouseRef.current.x,
              mouseRef.current.y,
              glowSize
            );
            glowGradient.addColorStop(0, `rgba(102, 126, 234, ${opacity * 0.3})`);
            glowGradient.addColorStop(1, 'rgba(102, 126, 234, 0)');
            
            ctx.beginPath();
            ctx.arc(mouseRef.current.x, mouseRef.current.y, glowSize, 0, Math.PI * 2);
            ctx.fillStyle = glowGradient;
            ctx.fill();
          }
        }
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

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

