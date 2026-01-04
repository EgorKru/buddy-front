import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { authAPI, setCurrentUser } from '@/utils/api';
import { Eye, EyeOff, Radio } from 'lucide-react';
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
              <Radio size={40} className={styles.logoIconSvg} />
              <div className={styles.logoSignal}>
                <div className={styles.signalWave}></div>
                <div className={styles.signalWave}></div>
                <div className={styles.signalWave}></div>
              </div>
            </div>
          </div>
        </div>
        <h1>Регистрация</h1>
        <form onSubmit={handleRegister}>
          <div className={styles.formGroup}>
            <label>Имя пользователя</label>
            <input
              type="text"
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
            <label>Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="Введите email"
              autoComplete="email"
            />
          </div>
          <div className={styles.formGroup}>
            <label>Отображаемое имя (необязательно)</label>
            <input
              type="text"
              name="displayName"
              value={formData.displayName}
              onChange={handleChange}
              placeholder="Как вас называть?"
              autoComplete="name"
            />
          </div>
          <div className={styles.formGroup}>
            <label>Пароль</label>
            <div className={styles.passwordContainer}>
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={formData.password}
                onChange={handleChange}
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

