import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { authAPI, setCurrentUser } from '@/utils/api';
import { Eye, EyeOff } from 'lucide-react';
import InteractiveBackground from '@/component/InteractiveBackground';
import styles from '@/styles/login.module.css';

export default function Register() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    displayName: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isPagerEyesClosed, setIsPagerEyesClosed] = useState(false);
  const [pupilOffset, setPupilOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isPagerEyesClosed) return;
      
      // Используем центр экрана как точку отсчета
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const maxOffset = 4;

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
  }, [isPagerEyesClosed]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await authAPI.register(formData);
      setCurrentUser(data.user, data.token);
      router.push('/');
    } catch (err) {
      setError(err.message || 'Ошибка при регистрации');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <InteractiveBackground />
      <div className={styles.decorativeElements}>
        <div className={styles.floatingCircle} style={{ '--delay': '0s', '--duration': '20s' }}></div>
        <div className={styles.floatingCircle} style={{ '--delay': '5s', '--duration': '25s' }}></div>
        <div className={styles.floatingCircle} style={{ '--delay': '10s', '--duration': '30s' }}></div>
      </div>
      <div className={styles.formContainer}>
        <div className={styles.logoContainer}>
          <div className={styles.logoIcon}>
            <div className={styles.logoIconWrapper}>
              <div
                className={`${styles.pagerEyesRow} ${isPagerEyesClosed ? styles.pagerEyesClosed : ''}`}
              >
                <div className={styles.pagerEye}>
                  <div
                    className={styles.pagerPupil}
                    style={{
                      transform: `translate(${pupilOffset.x}px, ${pupilOffset.y}px)`,
                    }}
                  />
                </div>
                <div className={styles.pagerEye}>
                  <div
                    className={styles.pagerPupil}
                    style={{
                      transform: `translate(${pupilOffset.x}px, ${pupilOffset.y}px)`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        <h1>Регистрация</h1>
        <form onSubmit={handleRegister}>
          <div className={styles.formGroup}>
            <label htmlFor="register-username">Имя пользователя</label>
            <input
              type="text"
              id="register-username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
              minLength={3}
              maxLength={20}
              placeholder="Введите имя пользователя"
              autoComplete="username"
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="register-email">Email</label>
            <input
              type="email"
              id="register-email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="Введите email"
              autoComplete="email"
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="register-displayName">Отображаемое имя (необязательно)</label>
            <input
              type="text"
              id="register-displayName"
              name="displayName"
              value={formData.displayName}
              onChange={handleChange}
              placeholder="Как вас называть?"
              autoComplete="name"
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="register-password">Пароль</label>
            <div className={styles.passwordContainer}>
              <input
                type={showPassword ? "text" : "password"}
                id="register-password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                onFocus={() => setIsPagerEyesClosed(true)}
                onBlur={() => setIsPagerEyesClosed(false)}
                onMouseEnter={() => setIsPagerEyesClosed(true)}
                onMouseLeave={() => setIsPagerEyesClosed(false)}
                required
                minLength={6}
                placeholder="Минимум 6 символов"
                autoComplete="new-password"
              />
              <button
                type="button"
                className={styles.passwordToggle}
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>
          {error && <div className={styles.error}>{error}</div>}
          <button type="submit" disabled={loading} className={styles.button}>
            {loading ? 'Регистрация...' : 'Зарегистрироваться'}
          </button>
        </form>
        <p className={styles.link}>
          Уже есть аккаунт? <Link href="/login">Войти</Link>
        </p>
      </div>
    </div>
  );
}

