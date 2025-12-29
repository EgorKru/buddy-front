import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { authAPI, setCurrentUser } from '@/utils/api';
import { Eye, EyeOff } from 'lucide-react';
import InteractiveBackground from '@/component/InteractiveBackground';
import Pager3D from '@/component/Pager3D';
import styles from '@/styles/login.module.css';

export default function Login() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await authAPI.login(username, password);
      setCurrentUser(data.user, data.token);
      router.push('/');
    } catch (err) {
      setError(err.message || 'Неверное имя пользователя или пароль');
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
          <Pager3D size={90} interactive={true} />
        </div>
        <h1>Вход в Pager</h1>
        <p className={styles.subtitle}>Добро пожаловать обратно</p>
        <form onSubmit={handleLogin}>
          <div className={styles.formGroup}>
            <label>Имя пользователя</label>
            <input
              type="text"
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
  );
}

