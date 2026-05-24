/**
 * Форма входа — v2 design system.
 */
import { useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import ds from '@/design-system/primitives.module.css';

function LoginUsernameField({ formData, handleChange, handleBlur, usernameError }) {
  return (
    <div className={ds.field}>
      <label htmlFor="login-username">Email или имя пользователя</label>
      <span className={ds.fieldHint}>Используйте тот же идентификатор, что при регистрации.</span>
      <input
        type="text"
        id="login-username"
        name="username"
        value={formData.username}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder="email@example.com или имя_пользователя"
        autoComplete="username"
        className={`${ds.input} ${usernameError ? ds.inputInvalid : ''}`}
        aria-invalid={usernameError ? 'true' : 'false'}
        aria-describedby={usernameError ? 'login-username-error' : undefined}
      />
      {usernameError ? (
        <p id="login-username-error" className={ds.fieldError} role="alert">
          {usernameError}
        </p>
      ) : null}
    </div>
  );
}

function LoginPasswordField({ formData, handleChange, handleBlur, passwordError, error }) {
  const [showPassword, setShowPassword] = useState(false);

  const describedBy = [passwordError ? 'login-password-error' : null, error ? 'login-error' : null]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={ds.field}>
      <label htmlFor="login-password">Пароль</label>
      <div className={ds.passwordWrap}>
        <input
          type={showPassword ? 'text' : 'password'}
          id="login-password"
          name="password"
          value={formData.password}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder="Введите пароль"
          autoComplete="current-password"
          className={`${ds.input} ${passwordError ? ds.inputInvalid : ''}`}
          aria-invalid={passwordError ? 'true' : 'false'}
          aria-describedby={describedBy || undefined}
        />
        <button
          type="button"
          className={ds.passwordToggle}
          onClick={() => setShowPassword(!showPassword)}
          aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
        >
          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {passwordError ? (
        <p id="login-password-error" className={ds.fieldError} role="alert">
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
}) {
  return (
    <>
      <form className={ds.formStack} onSubmit={handleLogin} noValidate>
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
        />
        {error ? (
          <div id="login-error" className={ds.formError} role="alert">
            {error}
          </div>
        ) : null}
        <div className={ds.formActions}>
          <button type="submit" disabled={loading} className={ds.btnPrimary} aria-busy={loading}>
            {loading ? 'Вход…' : 'Войти'}
          </button>
        </div>
      </form>
      <p className={ds.footerLink}>
        Нет аккаунта? <Link href="/register">Начать</Link>
      </p>
      <p className={ds.trustNote}>
        Сессия защищена при передаче. Личные сообщения остаются приватными на вашем устройстве.
      </p>
    </>
  );
}
