/**
 * Форма входа: поля и кнопка. FSD: features/auth
 */
import { useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import styles from '@/styles/login.module.css';

export function LoginForm({
  formData,
  error,
  loading,
  handleChange,
  handleLogin,
  onPasswordFocus,
  onPasswordBlur,
}) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <>
      <form onSubmit={handleLogin} noValidate>
        <div className={styles.formGroup}>
          <label htmlFor="login-username">Имя пользователя</label>
          <input
            type="text"
            id="login-username"
            name="username"
            value={formData.username}
            onChange={handleChange}
            required
            placeholder="Введите имя пользователя"
            autoComplete="username"
          />
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="login-password">Пароль</label>
          <div className={styles.passwordContainer}>
            <input
              type={showPassword ? 'text' : 'password'}
              id="login-password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              onFocus={onPasswordFocus}
              onBlur={onPasswordBlur}
              onMouseEnter={onPasswordFocus}
              onMouseLeave={onPasswordBlur}
              required
              placeholder="Введите пароль"
              autoComplete="current-password"
              aria-describedby={error ? 'login-error' : undefined}
            />
            <button
              type="button"
              className={styles.passwordToggle}
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
        </div>
        {error && (
          <div id="login-error" className={styles.error}>
            {error}
          </div>
        )}
        <button type="submit" disabled={loading} className={styles.button}>
          {loading ? 'Вход...' : 'Войти'}
        </button>
      </form>
      <p className={styles.link}>
        Нет аккаунта? <Link href="/register">Зарегистрироваться</Link>
      </p>
    </>
  );
}
