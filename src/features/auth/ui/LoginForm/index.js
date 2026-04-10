/**
 * Форма входа: поля и кнопка. FSD: features/auth
 */
import { useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import styles from '@/styles/login.module.css';

function LoginUsernameField({ formData, handleChange, handleBlur, usernameError }) {
  return (
    <div className={styles.formGroup}>
      <label htmlFor="login-username">Имя пользователя</label>
      <input
        type="text"
        id="login-username"
        name="username"
        value={formData.username}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder="Введите имя пользователя"
        autoComplete="username"
        className={usernameError ? styles.inputInvalid : undefined}
        aria-invalid={usernameError ? 'true' : 'false'}
        aria-describedby={usernameError ? 'login-username-error' : undefined}
      />
      {usernameError ? (
        <p id="login-username-error" className={styles.fieldError} role="alert">
          {usernameError}
        </p>
      ) : null}
    </div>
  );
}

function LoginPasswordField({
  formData,
  handleChange,
  handleBlur,
  passwordError,
  error,
  onPasswordFocus,
  onPasswordBlur,
}) {
  const [showPassword, setShowPassword] = useState(false);

  const describedBy = [passwordError ? 'login-password-error' : null, error ? 'login-error' : null]
    .filter(Boolean)
    .join(' ');

  return (
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
          onBlur={(e) => {
            handleBlur(e);
            onPasswordBlur?.();
          }}
          onMouseEnter={onPasswordFocus}
          onMouseLeave={onPasswordBlur}
          placeholder="Введите пароль"
          autoComplete="current-password"
          className={passwordError ? styles.inputInvalid : undefined}
          aria-invalid={passwordError ? 'true' : 'false'}
          aria-describedby={describedBy || undefined}
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
      {passwordError ? (
        <p id="login-password-error" className={styles.fieldError} role="alert">
          {passwordError}
        </p>
      ) : null}
    </div>
  );
}

export function LoginForm({
  formData,
  error,
  loading,
  usernameError,
  passwordError,
  handleChange,
  handleBlur,
  handleLogin,
  onPasswordFocus,
  onPasswordBlur,
}) {
  return (
    <>
      <form onSubmit={handleLogin} noValidate>
        <LoginUsernameField
          formData={formData}
          handleChange={handleChange}
          handleBlur={handleBlur}
          usernameError={usernameError}
        />
        <LoginPasswordField
          formData={formData}
          handleChange={handleChange}
          handleBlur={handleBlur}
          passwordError={passwordError}
          error={error}
          onPasswordFocus={onPasswordFocus}
          onPasswordBlur={onPasswordBlur}
        />
        {error ? (
          <div id="login-error" className={styles.error} role="alert">
            {error}
          </div>
        ) : null}
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
