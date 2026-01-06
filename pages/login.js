import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { authAPI, setCurrentUser } from '@/utils/api';
import { Eye, EyeOff } from 'lucide-react';
import InteractiveBackground from '@/component/InteractiveBackground';
import styles from '@/styles/login.module.css';

export default function Login() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isPagerEyesClosed, setIsPagerEyesClosed] = useState(false);
  const [pupilOffset, setPupilOffset] = useState({ x: 0, y: 0 });
  const [showLoader, setShowLoader] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isPagerEyesClosed) return;
      
      // Для логотипа используем центр экрана как точку отсчета
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const maxOffset = showLoader ? 6 : 4; // больше смещение для лоадера

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
  }, [isPagerEyesClosed, showLoader]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await authAPI.login(username, password);
      setCurrentUser(data.user, data.token);
      
      // Показываем лоадер минимум 2 секунды
      setShowLoader(true);
      
      // Минимум 2 секунды показа лоадера
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Переходим на главную
      router.push('/');
      
      // Лоадер скроется автоматически при размонтировании компонента
      // или можно добавить таймер на скрытие через несколько секунд
      setTimeout(() => {
        setShowLoader(false);
      }, 500);
    } catch (err) {
      setError(err.message || 'Неверное имя пользователя или пароль');
      setLoading(false);
    }
  };

  return (
    <>
      {showLoader && (
        <div className={styles.loaderOverlay}>
          <div className={styles.loaderEyesContainer}>
            <div className={styles.pagerEyesRow}>
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
      )}
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
        <h1>Вход</h1>
        <form onSubmit={handleLogin}>
          <div className={styles.formGroup}>
            <label>Имя пользователя</label>
            <input
              type="text"
              id="login-username"
              name="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="Введите имя пользователя"
              autoComplete="username"
            />
          </div>
          <div className={styles.formGroup}>
            <label>Пароль</label>
            <div className={styles.passwordContainer}>
              <input
                type={showPassword ? "text" : "password"}
                id="login-password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setIsPagerEyesClosed(true)}
                onBlur={() => setIsPagerEyesClosed(false)}
                onMouseEnter={() => setIsPagerEyesClosed(true)}
                onMouseLeave={() => setIsPagerEyesClosed(false)}
                required
                placeholder="Введите пароль"
                autoComplete="current-password"
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
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </form>
        <p className={styles.link}>
          Нет аккаунта? <Link href="/register">Зарегистрироваться</Link>
        </p>
      </div>
    </div>
    </>
  );
}

